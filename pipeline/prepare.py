"""
Step 1: clean the raw data and split it into the two fields (planets).

Reads   data/raw/paper_concepts_2026.parquet, data/raw/vocab_2026.csv,
        data/raw/paper_metadata.parquet (Person A: title, authors, DOI, ALL arXiv categories)
        data/raw/arxiv_abstracts.parquet (optional: abstracts from the arXiv API, for AI text)
Writes  data/processed/<field>/papers.parquet          paper_id, date, land, title, authors, ...
        data/processed/<field>/concepts.parquet        concept_id 0..N-1, phrase, display, ...
        data/processed/<field>/paper_concepts.parquet  paper_id, concept_id
        data/processed/<field>/lands.json              land id -> name, papers
        outputs/cleaning_report.md                     what was dropped and why

Run:  python pipeline/prepare.py
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config as C  # noqa: E402
from fields import final_field  # noqa: E402
from lands import cluster_papers, concept_primary_land, name_clusters  # noqa: E402


def normalise(concepts) -> list:
    """Apply aliases, drop stop-list words, de-duplicate, sort alphabetically."""
    out = set()
    for c in concepts:
        c = C.ALIASES.get(c, c)
        if c and c not in C.STOPLIST:
            out.add(c)
    return sorted(out)


def quant_land(row) -> str:
    """Land key for a Quant paper from its arXiv categories."""
    cats = (row["categories"] or row["primary_cat"]).split()
    if row["primary_cat"].startswith("econ"):
        return "econ"
    if row["primary_cat"].startswith("q-fin"):
        return row["primary_cat"]
    for c in cats:
        if c.startswith("q-fin"):
            return c
    return "econ" if any(c.startswith("econ") for c in cats + [row["primary_cat"]]) else ""


def main():
    report = ["# Cleaning report", ""]
    papers = pd.read_parquet(C.RAW / "paper_concepts_2026.parquet")
    vocab = pd.read_csv(C.RAW / "vocab_2026.csv")
    report.append(f"- Loaded {len(papers):,} papers from paper_concepts_2026.parquet")

    # 1. duplicates: keep the earliest date
    papers = papers.sort_values(["id", "first_date"])
    dup = papers.duplicated("id")
    report.append(f"- Dropped {int(dup.sum())} duplicate paper id(s) (kept the earliest date): "
                  f"{', '.join(papers.loc[dup, 'id'])}")
    papers = papers[~dup]

    # 2. paper details: Person A's metadata (every paper), abstracts from the arXiv API if fetched
    meta = pd.read_parquet(C.RAW / "paper_metadata.parquet")[
        ["id", "title", "authors", "first_author", "n_authors", "categories", "doi", "journal_ref"]]
    papers = papers.merge(meta.drop_duplicates("id"), on="id", how="left")
    report.append(f"- Person A metadata (title, authors, categories): {papers['title'].notna().sum():,} of {len(papers):,} papers")
    abs_path = C.RAW / "arxiv_abstracts.parquet"
    if abs_path.exists():
        ab = pd.read_parquet(abs_path)[["id", "abstract"]].drop_duplicates("id")
        papers = papers.merge(ab, on="id", how="left")
    else:
        papers["abstract"] = ""
    report.append(f"- Abstracts available (arXiv API, for AI text only): {int((papers['abstract'].fillna('') != '').sum()):,}")
    for col in ["title", "authors", "first_author", "categories", "doi", "journal_ref", "abstract"]:
        papers[col] = papers[col].fillna("")
    papers["url"] = "https://arxiv.org/abs/" + papers["id"]

    # 3. field
    papers["field"] = final_field(papers, vocab)
    report.append(f"- Field assignment (from each paper's full arXiv category list): "
                  f"{papers['field'].value_counts().to_dict()}  ('' = neither field, not used)")
    papers = papers[papers["field"] != ""].copy()
    no_meta = (papers["title"] == "").sum()
    report.append(f"- Papers in the two fields without arXiv metadata: {int(no_meta)}")

    # 4. concepts
    papers["concepts"] = papers["concepts"].map(lambda cs: normalise(list(cs)))
    empty = papers["concepts"].str.len() == 0
    report.append(f"- Dropped {int(empty.sum())} papers with no concepts left after cleaning "
                  f"(10 had none at all; the rest only had stop-list words)")
    papers = papers[~empty]

    for field in C.FIELDS:
        d = papers[papers["field"] == field].copy().reset_index(drop=True)
        out = C.PROC / field
        out.mkdir(parents=True, exist_ok=True)

        # concept ids: alphabetical over every phrase used in this field
        phrases = sorted({c for cs in d["concepts"] for c in cs})
        cid = {p: i for i, p in enumerate(phrases)}
        # cap per paper: first 30 alphabetically == lowest ids (does not depend on the future)
        d["cids"] = d["concepts"].map(lambda cs: sorted(cid[c] for c in cs)[:C.MAX_CONCEPTS_PER_PAPER])
        n_capped = int((d["concepts"].str.len() > C.MAX_CONCEPTS_PER_PAPER).sum())
        pc = d[["id", "cids"]].explode("cids").rename(columns={"id": "paper_id", "cids": "concept_id"})
        pc["concept_id"] = pc["concept_id"].astype(np.int64)

        # lands
        if field == "quant":
            keys = d.apply(quant_land, axis=1)
            names = sorted(set(C.QUANT_LANDS.values()))
            name_of_key = {k: C.QUANT_LANDS[k] for k in C.QUANT_LANDS}
            land_name = keys.map(lambda k: name_of_key.get(k, ""))
            # papers without a q-fin/econ category (no metadata): majority land of their concepts
            known = land_name != ""
            tmp_land = pd.Series(land_name[known].map({n: i for i, n in enumerate(names)}).to_numpy(),
                                 index=d.loc[known, "id"])
            cl = concept_primary_land(pc, tmp_land)
            for i in np.flatnonzero(~known.to_numpy()):
                ls = [cl.get(c) for c in d.at[i, "cids"] if c in cl.index]
                land_name.iat[i] = names[pd.Series(ls).mode().iat[0]] if ls else "General Finance"
            # number lands by size
            order = land_name.value_counts().index.tolist()
            land_names = {i: n for i, n in enumerate(order)}
            d["land"] = land_name.map({n: i for i, n in land_names.items()})
        else:
            paper_land = cluster_papers(pc, C.MED_CLUSTER_RESOLUTION, C.MED_MIN_LAND_PAPERS, C.SEED,
                                        max_lands=C.MED_MAX_LANDS)
            d["land"] = d["id"].map(paper_land).astype(int)
            land_names = name_clusters(pc, paper_land, dict(enumerate(phrases)), C.MED_LAND_NAMES)

        # concept table
        cnt = pc.groupby("concept_id")["paper_id"].nunique()
        dates = pc.merge(d[["id", "first_date"]].rename(columns={"id": "paper_id"}), on="paper_id")
        first_seen = dates.groupby("concept_id")["first_date"].min()
        prim = concept_primary_land(pc, d.set_index("id")["land"])
        concepts = pd.DataFrame({
            "concept_id": np.arange(len(phrases)),
            "phrase": phrases,
            "display": [C.DISPLAY.get(p, p) for p in phrases],
            "n_papers": cnt.reindex(range(len(phrases)), fill_value=0).to_numpy(),
            "first_seen": first_seen.reindex(range(len(phrases))).to_numpy(),
            "land": prim.reindex(range(len(phrases)), fill_value=-1).to_numpy(),
        })
        concepts["dominant_cat"] = concepts["land"].astype(str)   # B1-compatible column name

        cols = ["id", "first_date", "year", "primary_cat", "categories", "land", "title", "authors",
                "first_author", "n_authors", "doi", "journal_ref", "url", "abstract"]
        d[cols].rename(columns={"id": "paper_id", "first_date": "date"}).to_parquet(out / "papers.parquet", index=False)
        concepts.to_parquet(out / "concepts.parquet", index=False)
        pc.to_parquet(out / "paper_concepts.parquet", index=False)
        lands = [{"id": int(k), "name": land_names[k], "papers": int((d["land"] == k).sum())}
                 for k in sorted(land_names)]
        (out / "lands.json").write_text(json.dumps(lands, indent=2))

        report += ["", f"## {C.FIELD_NAMES[field]}",
                   f"- papers: {len(d):,} ({d['first_date'].min().date()} to {d['first_date'].max().date()})",
                   f"- distinct concepts: {len(phrases):,}; with >= {C.MIN_PAPERS} papers and <= "
                   f"{C.MAX_SHARE:.0%} of papers (all time): "
                   f"{int(((cnt >= C.MIN_PAPERS) & (cnt <= C.MAX_SHARE * len(d))).sum()):,}",
                   f"- papers with more than {C.MAX_CONCEPTS_PER_PAPER} concepts (capped): {n_capped:,}",
                   "- lands: " + "; ".join(f"{l['name']} ({l['papers']:,})" for l in lands)]
        print(f"[{field}] {len(d):,} papers, {len(phrases):,} concepts, {len(lands)} lands")
        for l in lands:
            print(f"    {l['id']:2d} {l['name']:<40} {l['papers']:6,}")

    C.OUT.mkdir(exist_ok=True)
    (C.OUT / "cleaning_report.md").write_text("\n".join(report) + "\n")
    print("\n".join(report))


if __name__ == "__main__":
    main()
