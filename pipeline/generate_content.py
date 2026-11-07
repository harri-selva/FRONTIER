"""
Text for the website: paper summaries, "why this is a good fit", a suggested
paper title + abstract, and three "missions" (PhD / Masters / industry).

Two modes:
  * ANTHROPIC_API_KEY set  -> Claude writes the text at BUILD TIME. Every prompt
    contains the real numbers, the shared neighbour concepts and the real paper
    titles/abstracts, with instructions not to invent facts or citations.
    Results are cached in pipeline/cache/content.json so reruns cost nothing.
  * no key                 -> deterministic templates filled ONLY with real
    numbers, concept names and paper titles. Clearly labelled "template".

The key is read from the environment at build time only. It is never written
to the repo or to the website.
"""
import hashlib
import json
import os
import re
from pathlib import Path

CACHE = Path(__file__).resolve().parent / "cache" / "content.json"
MODEL = "claude-sonnet-5-5"
FIRM = "Marshall Wace"

_cache = None


def _load_cache():
    global _cache
    if _cache is None:
        _cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    return _cache


def save_cache():
    if _cache is not None:
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps(_cache, indent=1, sort_keys=True))


def mode() -> str:
    return "claude" if os.environ.get("ANTHROPIC_API_KEY") else "template"


def _client():
    import anthropic  # only needed when a key is set
    return anthropic.Anthropic()


def _ask_json(key: str, prompt: str, max_tokens: int = 1200) -> dict:
    cache = _load_cache()
    if key in cache:
        return cache[key]
    msg = _client().messages.create(
        model=MODEL, max_tokens=max_tokens,
        system=("You write short, accurate research summaries for a science-discovery website. "
                "Use ONLY the facts given. Never invent papers, authors, results, numbers or citations. "
                "Never copy sentences from abstracts; paraphrase in plain English. Reply with JSON only."),
        messages=[{"role": "user", "content": prompt}])
    text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    data = json.loads(re.search(r"\{.*\}", text, re.S).group(0))
    cache[key] = data
    return data


def _h(*parts) -> str:
    return hashlib.md5("|".join(map(str, parts)).encode()).hexdigest()[:16]


def _join(names):
    names = list(names)
    if len(names) <= 1:
        return "".join(names)
    return ", ".join(names[:-1]) + " and " + names[-1]


# ---------------------------------------------------------------------------
# Paper summaries
# ---------------------------------------------------------------------------
def paper_summary(paper: dict, concept_names: list) -> dict:
    """1-2 sentence summary in our own words. Template mode never touches the abstract text."""
    if mode() == "claude" and paper.get("abstract"):
        d = _ask_json("paper:" + paper["id"], (
            f"Title: {paper['title']}\nAbstract: {paper['abstract']}\n\n"
            "Write a 1-2 sentence plain-English summary (max 45 words) of what this paper does. "
            'Do not reuse phrases of more than 5 words from the abstract. JSON: {"summary": "..."}'),
            max_tokens=200)
        return {"text": d["summary"], "source": "claude"}
    top = concept_names[:4]
    year = paper["date"][:4]
    text = (f"A {year} paper that brings together {_join(top)}." if top
            else f"A {year} paper in this field.")
    return {"text": text, "source": "template"}


# ---------------------------------------------------------------------------
# Gap content
# ---------------------------------------------------------------------------
def gap_content(g: dict, field_name: str, evidence: list) -> dict:
    """
    g: the gap with numbers (u_name, v_name, cn, ra, pct, shared[...], land names, ...)
    evidence: real papers [{id, title, authors, date, abstract, concept}] for u, v and shared neighbours
    """
    if mode() == "claude":
        ev = "\n".join(f"- [{p['id']}] {p['title']} ({p['date'][:4]}) - about {p['concept']}. "
                       f"Abstract: {p.get('abstract', '')[:700]}" for p in evidence)
        shared = ", ".join(f"{s['name']} (degree {s['deg']}, 1/deg = {s['ra']:.4f})" for s in g["shared"][:10])
        shared += ". Most substantial shared topics: " + ", ".join(g.get("notable", []))
        d = _ask_json("gap:" + _h(g["field"], g["u"], g["v"], g["ra"]), (
            f"Field: {field_name}. Two research concepts have NEVER appeared together in a paper in our "
            f"arXiv corpus (to Oct 2026): A = '{g['u_name']}' ({g['u_papers']} papers, sub-field "
            f"{g['u_land_name']}) and B = '{g['v_name']}' ({g['v_papers']} papers, sub-field {g['v_land_name']}).\n"
            f"They share {g['cn']} neighbour concepts (concepts each has appeared with): {shared}.\n"
            f"Resource Allocation score {g['ra']:.4f}, top {100 - g['pct']:.2f}% of unlinked pairs in the field.\n"
            f"Real papers (use only these as evidence, cite by [id]):\n{ev}\n\n"
            "Return JSON with keys:\n"
            ' "why": 3-4 sentences, plain English, why A and B are a promising combination, grounded in the shared '
            "neighbours and the listed papers (cite ids in brackets);\n"
            ' "title": a proposed paper title;\n'
            ' "abstract": a ~120 word proposed abstract (hypothetical, no invented results);\n'
            ' "phd": 2-3 sentences, a multi-year PhD project;\n'
            ' "masters": 2-3 sentences, a 6-12 month Masters project;\n'
            f' "industry": 2-3 sentences for an industry research team, using {FIRM} only as an illustrative '
            "example firm; make no claims about what that firm actually does or wants."),
            max_tokens=1400)
        return {**d, "source": "claude"}
    return _template_gap(g, field_name, evidence)


def _template_gap(g, field_name, evidence):
    U, V = g["u_name"], g["v_name"]
    ws = g.get("notable", [s["name"] for s in g["shared"]])[:3]
    w_txt = _join(ws) if ws else "no shared concepts"
    top_pct = max(0.01, round(100 - g["pct"], 2))
    cross = g["u_land_name"] != g["v_land_name"]
    where = (f"{U} sits on the {g['u_land_name']} island and {V} on {g['v_land_name']}, so this gap "
             f"would connect two sub-fields of {field_name}." if cross
             else f"Both belong to the {g['u_land_name']} sub-field of {field_name}.")
    ev_u = next((p for p in evidence if p["concept"] == U), None)
    ev_v = next((p for p in evidence if p["concept"] == V), None)
    ev_txt = ""
    if ev_u and ev_v:
        ev_txt = (f" For example, \"{ev_u['title']}\" ({ev_u['date'][:4]}) works on {U}, and "
                  f"\"{ev_v['title']}\" ({ev_v['date'][:4]}) works on {V}.")
    why = (f"{U} ({g['u_papers']} papers) and {V} ({g['v_papers']} papers) have never been studied in the same "
           f"paper, yet they are each already connected to {g['cn']} of the same concepts, including {w_txt}. "
           f"Many shared neighbours, especially specialised ones, are the classic sign that two topics are "
           f"close enough to meet: this pair ranks in the top {top_pct}% of all unlinked {field_name} pairs by "
           f"Resource Allocation. {where}{ev_txt}")
    w1 = ws[0] if ws else "shared methods"
    title = f"Bridging {U} and {V} through {w1}"
    abstract = (f"{U} and {V} are both active topics in {field_name}, yet no paper in our corpus has studied them "
                f"together. Both are already linked to {g['cn']} common concepts, including {w_txt}, which "
                f"suggests the methods and data needed to connect them already exist. We propose a study that "
                f"uses {w1} as a bridge: first, review how {U} and {V} are each currently treated through {w1}; "
                f"second, design an approach that combines them and test it on established benchmarks from both "
                f"lines of work; third, measure whether the combination improves on each topic studied alone. "
                f"We expect the work to clarify where the two literatures overlap and to open a new line of "
                f"research between them.")
    phd = (f"A 3-4 year programme building a unified framework for {U} and {V}. Year 1: systematic review of "
           f"the {g['cn']} shared concepts (starting with {w_txt}); years 2-3: develop and validate a joint "
           f"method; year 4: generalise it and release open tools and data.")
    masters = (f"A 6-12 month project: reproduce one recent {U} study and one recent {V} study, then run a "
               f"focused experiment combining the two through {w1}, reporting what transfers and what does not.")
    industry = (f"Illustrative example only (no claim about the firm's actual work): an industry research team "
                f"such as {FIRM} could run a short feasibility study testing whether combining {U} with {V} "
                f"via {w1} adds measurable value to an existing {field_name.lower()} pipeline, then decide "
                f"whether to invest further.")
    return {"why": why, "title": title, "abstract": abstract, "phd": phd, "masters": masters,
            "industry": industry, "source": "template"}
