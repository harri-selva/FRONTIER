"""
FRONTIER - Person A pipeline: arXiv metadata -> clean concepts per paper.

Three stages, run in order:

  1. filter  Stream the multi-GB arXiv JSON line by line, keep papers in your
             chosen categories, record the FIRST submission date, save Parquet.
  2. vocab   Build the concept vocabulary from papers BEFORE the cutoff year
             only (avoids lookahead bias), using spaCy noun chunks + cleaning
             + document-frequency thresholds.
  3. tag     Find every vocabulary concept in every abstract with Aho-Corasick
             (one fast pass, no spaCy), save paper -> concepts as Parquet,
             and print the stats you will be asked about.

Example:
  python frontier_data.py filter --input arxiv-metadata-oai-snapshot.json \
      --cats cs.LG q-bio.NC physics.optics --out papers.parquet
  python frontier_data.py vocab --papers papers.parquet --cutoff-year 2013 \
      --sample 60000 --min-df 10 --out vocab.csv
  python frontier_data.py tag --papers papers.parquet --vocab vocab.csv \
      --out paper_concepts.parquet

Install:
  pip install pandas pyarrow spacy pyahocorasick
  python -m spacy download en_core_web_sm
"""

import argparse
import json
import re
from collections import Counter
from email.utils import parsedate_to_datetime

import pandas as pd

# ---------------------------------------------------------------------------
# Shared text normalisation. Used by BOTH vocab and tag so phrases match.
# ---------------------------------------------------------------------------

LATEX_MATH = re.compile(r"\$[^$]*\$")          # $x^2$ -> removed
LATEX_CMD = re.compile(r"\\[a-zA-Z]+")          # \emph -> removed
NON_WORD = re.compile(r"[^a-z0-9\- ]+")         # punctuation -> space
SPACES = re.compile(r"\s+")


def normalise_text(text: str) -> str:
    """Lowercase, strip LaTeX and punctuation, collapse whitespace."""
    text = text.lower()
    text = LATEX_MATH.sub(" ", text)
    text = LATEX_CMD.sub(" ", text)
    text = text.replace("-", " ")               # 'graph-based' == 'graph based'
    text = NON_WORD.sub(" ", text)
    return SPACES.sub(" ", text).strip()


# Words that are never the start of a real concept. Edit freely.
LEADING_JUNK = {
    "a", "an", "the", "this", "that", "these", "those", "our", "their", "its",
    "his", "her", "we", "it", "such", "some", "any", "each", "every", "all",
    "both", "several", "many", "various", "other", "new", "novel", "proposed",
    "previous", "existing", "different", "same", "first", "second", "recent",
    "further", "present", "current", "given", "specific", "general", "certain",
    "simple", "important", "significant",
    "main", "key", "efficient", "effective", "standard", "typical", "only",
    "individual", "sufficient", "unique", "possible", "relevant", "certain",
}

# Whole phrases that pass the filters but carry no meaning. Grow this list
# by eyeballing the top of vocab.csv - it is the single best quality lever.
GENERIC_PHRASES = {
    "paper", "method", "approach", "result", "work", "problem", "model",
    "study", "analysis", "framework", "technique", "experiment", "performance",
    "data", "system", "algorithm", "application", "case", "number", "set",
    "way", "use", "order", "terms", "addition", "fact", "part", "form",
    "effect", "state of the art", "art", "results", "experiments", "task",
    "tasks", "question", "datum", "proposed method", "numerical simulation",
    "simulation", "theory", "property", "value", "function", "process",
    "information", "structure", "field", "type", "level", "time", "rate",
    # added after reviewing the first real vocab.csv
    "dynamics", "term", "example", "role", "presence", "existence", "class",
    "solution", "change", "condition", "respect", "behavior", "behaviour",
    "mechanism", "parameter", "distribution", "interaction", "individual",
    "aspect", "feature", "factor", "issue", "purpose", "basis", "context",
    "impact", "influence", "regime", "scale", "range", "quantity", "amount",
    "degree", "contribution", "observation", "evidence", "insight",
    "understanding", "implication", "consequence", "account", "point", "kind",
    "variety", "series", "sample", "measure", "measurement", "step", "stage",
    "pattern", "relation", "relationship", "dependence", "limit", "scenario",
    "situation", "phenomenon", "variable", "component", "element", "region",
    "size", "length", "dimension", "description", "presence", "absence",
    "variation", "difference", "increase", "decrease", "number of", "goal",
    "direction", "manner", "means", "view", "idea", "concept", "notion",
    "property", "characteristic", "response", "outcome", "output", "input",
    "data", "sequence data", "sample size", "large number", "wide range",
    "high", "low", "large", "small", "complex", "multiple", "qualitative",
    # added after review round 2
    "finding", "development", "comparison", "mean", "year", "contrast",
    "nature", "deal", "square root", "information",
    # added after review round 3
    "assumption", "emergence", "possibility", "stability", "article",
    "abstract", "importance", "ability", "attempt", "advantage", "review",
    "survey", "literature", "overview", "consideration", "extension",
    "generalization", "improvement", "attention", "question", "fact",
    "argument", "explanation", "interpretation", "discussion", "conclusion",
    "proposal", "summary", "introduction", "focus", "emphasis", "need",
    "lack", "possibility", "tendency", "success", "failure", "problem",
}


# spaCy sometimes singularises wrongly. Fix the known cases here.
LEMMA_FIXES = {"specie": "species", "datum": "data", "dynamic": "dynamics",
               "economic": "economics", "statistic": "statistics",
               "genetic": "genetics", "physic": "physics", "kinetic": "kinetics"}


def clean_chunk(chunk) -> str | None:
    """spaCy noun chunk -> canonical concept string, or None if junk."""
    tokens = [t for t in chunk if not t.is_space]
    # drop leading determiners / pronouns / vague adjectives
    while tokens and (tokens[0].lower_ in LEADING_JUNK or tokens[0].is_stop
                      or len(tokens[0].text.strip(".")) <= 1
                      or tokens[0].pos_ in {"DET", "PRON", "NUM", "PUNCT"}):
        tokens = tokens[1:]
    if not tokens or tokens[-1].pos_ == "PRON":
        return None
    # singularise the head noun only: 'neural networks' -> 'neural network'
    head = tokens[-1].lemma_.lower()
    words = [t.lower_ for t in tokens[:-1]] + [LEMMA_FIXES.get(head, head)]
    phrase = normalise_text(" ".join(words))
    if not phrase:
        return None
    n_words = len(phrase.split())
    if n_words > 4:                       # long chunks are sentences, not concepts
        return None
    if n_words == 1 and len(phrase) < 4:  # 'x', 'id', 'cnn' (see aliases below)
        return None
    if any(ch.isdigit() for ch in phrase):
        return None
    if phrase in GENERIC_PHRASES:
        return None
    # adjective(s) + generic noun is still generic:
    # 'structural feature', 'biological observation', 'long time behavior'
    if (words[-1] in GENERIC_PHRASES
            and all(t.pos_ in {"ADJ", "ADV"} or t.lower_ in {"time", "long"}
                    for t in tokens[:-1])):
        return None
    return phrase


def plural_variants(phrase: str) -> set[str]:
    """Surface forms that should map to the singular canonical phrase."""
    *head, last = phrase.split()
    forms = {last, last + "s"}
    if last.endswith(("s", "x", "z", "ch", "sh")):
        forms.add(last + "es")
    if last.endswith("y") and len(last) > 2 and last[-2] not in "aeiou":
        forms.add(last[:-1] + "ies")
    return {" ".join(head + [f]) for f in forms}


# Hand-made synonym / abbreviation merges. Surface form -> canonical concept.
# Add to this as you spot duplicates in vocab.csv.
ALIASES = {
    "neural net": "neural network",
    "neural nets": "neural network",
    "artificial neural network": "neural network",
    "cnn": "convolutional neural network",
    "cnns": "convolutional neural network",
    "rnn": "recurrent neural network",
    "gnn": "graph neural network",
    "gnns": "graph neural network",
    "llm": "large language model",
    "llms": "large language model",
    "rl": "reinforcement learning",
    "svm": "support vector machine",
    "svms": "support vector machine",
    "dft": "density functional theory",
}


# ---------------------------------------------------------------------------
# Stage 1: filter
# ---------------------------------------------------------------------------

def first_submission_date(record: dict):
    """versions[0].created looks like 'Mon, 2 Apr 2007 19:18:42 GMT'."""
    try:
        return parsedate_to_datetime(record["versions"][0]["created"]).date()
    except (KeyError, IndexError, TypeError, ValueError):
        return None


def stage_filter(args):
    wanted = set(args.cats)
    # prefix match lets you pass 'q-bio' to get every q-bio.* subcategory
    def matches(cats: list[str]) -> bool:
        if args.primary_only:
            cats = cats[:1]
        return any(c in wanted or c.split(".")[0] in wanted for c in cats)

    rows, seen, bad = [], 0, 0
    with open(args.input, "r", encoding="utf-8") as f:
        for line in f:                      # streaming: one paper in memory at a time
            seen += 1
            rec = json.loads(line)
            cats = rec.get("categories", "").split()
            if not matches(cats):
                continue
            date = first_submission_date(rec)
            if date is None:
                bad += 1
                continue
            rows.append({
                "id": rec["id"],
                "first_date": date,
                "year": date.year,
                "primary_cat": cats[0],
                "categories": " ".join(cats),
                "title": SPACES.sub(" ", rec.get("title", "")).strip(),
                "abstract": SPACES.sub(" ", rec.get("abstract", "")).strip(),
            })
            if seen % 500_000 == 0:
                print(f"  scanned {seen:,} lines, kept {len(rows):,}")

    df = pd.DataFrame(rows)
    df["first_date"] = pd.to_datetime(df["first_date"])
    df.to_parquet(args.out, index=False)
    print(f"Scanned {seen:,} papers, kept {len(df):,}, skipped {bad} with no date")
    print("Papers per year:\n", df["year"].value_counts().sort_index().to_string())
    print("Primary category counts:\n", df["primary_cat"].value_counts().head(15).to_string())


# ---------------------------------------------------------------------------
# Stage 2: vocab
# ---------------------------------------------------------------------------

def stage_vocab(args):
    import spacy

    df = pd.read_parquet(args.papers, columns=["id", "year", "title", "abstract"])
    pool = df[df["year"] <= args.cutoff_year]
    print(f"{len(pool):,} papers up to {args.cutoff_year} (vocabulary source)")
    if args.sample and len(pool) > args.sample:
        pool = pool.sample(args.sample, random_state=42)
        print(f"Sampled {len(pool):,} of them for spaCy")

    # parser is needed for noun_chunks; NER is not, so disable it for speed
    nlp = spacy.load("en_core_web_sm", disable=["ner"])
    texts = (pool["title"] + ". " + pool["abstract"]).tolist()

    doc_freq = Counter()         # number of papers each phrase appears in
    for i, doc in enumerate(nlp.pipe(texts, batch_size=256, n_process=args.workers)):
        phrases = {p for p in (clean_chunk(c) for c in doc.noun_chunks) if p}
        phrases = {ALIASES.get(p, p) for p in phrases}
        doc_freq.update(phrases)
        if (i + 1) % 5000 == 0:
            print(f"  parsed {i + 1:,} abstracts, {len(doc_freq):,} distinct phrases")

    n_docs = len(texts)
    max_df = int(args.max_df_frac * n_docs)
    vocab = pd.DataFrame(doc_freq.items(), columns=["concept", "doc_freq"])
    before = len(vocab)
    vocab = vocab[(vocab["doc_freq"] >= args.min_df) & (vocab["doc_freq"] <= max_df)]
    vocab = vocab.sort_values("doc_freq", ascending=False)
    vocab.to_csv(args.out, index=False)

    print(f"\n{before:,} candidate phrases -> {len(vocab):,} concepts "
          f"(min_df={args.min_df}, max_df={max_df} = {args.max_df_frac:.0%} of {n_docs:,} docs)")
    print("\nTop 25 (check for junk -> add to GENERIC_PHRASES):")
    print(vocab.head(25).to_string(index=False))
    print("\nRandom 25 from the middle (check quality):")
    print(vocab.sample(min(25, len(vocab)), random_state=1).to_string(index=False))


# ---------------------------------------------------------------------------
# Stage 3: tag
# ---------------------------------------------------------------------------

def build_automaton(concepts: list[str]):
    import ahocorasick

    A = ahocorasick.Automaton()
    surface_to_canon = {}
    for c in concepts:
        for form in plural_variants(c):
            surface_to_canon.setdefault(form, c)
    for alias, canon in ALIASES.items():
        if canon in set(concepts):
            surface_to_canon[normalise_text(alias)] = canon
    for surface, canon in surface_to_canon.items():
        A.add_word(f" {surface} ", (len(surface) + 2, canon))  # spaces = whole words
    A.make_automaton()
    return A


def find_concepts(A, text: str) -> list[str]:
    padded = f" {normalise_text(text)} "
    # Prefer longest match: 'graph neural network' should not ALSO count
    # as 'neural network' at the same position.
    hits = []
    for end, (length, canon) in A.iter(padded):
        hits.append((end - length + 1, end, canon))
    hits.sort(key=lambda h: (h[0], -(h[1] - h[0])))
    found, last_end = set(), -1
    for start, end, canon in hits:
        if start >= last_end - 1:          # -1 because padding spaces overlap
            found.add(canon)
            last_end = end
    return sorted(found)


def stage_tag(args):
    df = pd.read_parquet(args.papers, columns=["id", "first_date", "year",
                                               "primary_cat", "title", "abstract"])
    concepts = pd.read_csv(args.vocab)["concept"].tolist()
    A = build_automaton(concepts)
    print(f"Tagging {len(df):,} papers against {len(concepts):,} concepts...")

    df["concepts"] = [find_concepts(A, t + ". " + a)
                      for t, a in zip(df["title"], df["abstract"])]
    df["n_concepts"] = df["concepts"].str.len()
    out = df[["id", "first_date", "year", "primary_cat", "concepts", "n_concepts"]]
    out.to_parquet(args.out, index=False)

    # ---- the numbers Person A must be able to quote ----
    exploded = out.explode("concepts").dropna(subset=["concepts"])
    first_seen = exploded.groupby("concepts")["first_date"].min()
    used = exploded["concepts"].nunique()
    print("\n=== STATS FOR THE TEAM ===")
    print(f"Papers tagged:            {len(out):,}")
    print(f"Papers with 0 concepts:   {(out['n_concepts'] == 0).sum():,}")
    print(f"Concepts per paper:       mean {out['n_concepts'].mean():.1f}, "
          f"median {out['n_concepts'].median():.0f}")
    print(f"Concepts in vocabulary:   {len(concepts):,}  (actually used: {used:,})")
    pairs = (out["n_concepts"] * (out["n_concepts"] - 1) // 2).sum()
    print(f"Co-mention pairs (edges, with repeats): {pairs:,}")
    first_seen.rename("first_seen").to_csv(args.out.replace(".parquet", "_first_seen.csv"))
    print(f"Wrote {args.out} and concept first-seen dates (for the galaxy).")


# ---------------------------------------------------------------------------

def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    f = sub.add_parser("filter")
    f.add_argument("--input", required=True)
    f.add_argument("--cats", nargs="+", required=True,
                   help="e.g. cs.LG q-bio physics.optics (prefix 'q-bio' = all q-bio.*)")
    f.add_argument("--primary-only", action="store_true",
                   help="match only a paper's first (primary) category")
    f.add_argument("--out", default="papers.parquet")

    v = sub.add_parser("vocab")
    v.add_argument("--papers", default="papers.parquet")
    v.add_argument("--cutoff-year", type=int, required=True,
                   help="only papers up to this year build the vocabulary")
    v.add_argument("--sample", type=int, default=60000)
    v.add_argument("--min-df", type=int, default=10)
    v.add_argument("--max-df-frac", type=float, default=0.15)
    v.add_argument("--workers", type=int, default=1)
    v.add_argument("--out", default="vocab.csv")

    t = sub.add_parser("tag")
    t.add_argument("--papers", default="papers.parquet")
    t.add_argument("--vocab", default="vocab.csv")
    t.add_argument("--out", default="paper_concepts.parquet")

    args = p.parse_args()
    {"filter": stage_filter, "vocab": stage_vocab, "tag": stage_tag}[args.cmd](args)


if __name__ == "__main__":
    main()
