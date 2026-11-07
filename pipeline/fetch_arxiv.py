"""
Step 0b: fetch real paper details (title, authors, abstract, DOI, all categories)
from arXiv's public API for every paper that might be Quant or Medicine.

  - 100 papers per request, one request every 3+ seconds (arXiv's polite-use rule)
  - results are appended to data/raw/arxiv_meta.jsonl as they arrive, so the
    script can be stopped and restarted without re-downloading anything
  - at the end writes data/raw/paper_metadata.parquet in the SAME column format as
    Person A's `frontier_data.py metadata --with-abstract` output. If Person A
    publishes that file, it can replace this one.

Run from the repo root:  python pipeline/fetch_arxiv.py
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fields import candidate_field  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
CACHE = RAW / "arxiv_meta.jsonl"
OUT = RAW / "paper_metadata.parquet"
API = "https://export.arxiv.org/api/query"
BATCH, PAUSE = 100, 3.1
NS = {"a": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
SPACES = re.compile(r"\s+")


def clean(s):
    return SPACES.sub(" ", s or "").strip()


def parse(xml_text):
    """Atom XML -> list of dicts (one per paper)."""
    root = ET.fromstring(xml_text)
    rows = []
    for e in root.findall("a:entry", NS):
        raw_id = e.findtext("a:id", default="", namespaces=NS)
        if "/abs/" not in raw_id:          # an error entry, not a paper
            continue
        pid = re.sub(r"v\d+$", "", raw_id.split("/abs/")[1])
        cats = [c.get("term") for c in e.findall("a:category", NS)]
        prim = e.find("arxiv:primary_category", NS)
        rows.append({
            "id": pid,
            "title": clean(e.findtext("a:title", default="", namespaces=NS)),
            "authors": "; ".join(clean(a.findtext("a:name", default="", namespaces=NS))
                                 for a in e.findall("a:author", NS)),
            "abstract": clean(e.findtext("a:summary", default="", namespaces=NS)),
            "published": e.findtext("a:published", default="", namespaces=NS),
            "primary_cat_api": prim.get("term") if prim is not None else (cats[0] if cats else ""),
            "categories": " ".join(cats),
            "doi": clean(e.findtext("arxiv:doi", default="", namespaces=NS)),
            "journal_ref": clean(e.findtext("arxiv:journal_ref", default="", namespaces=NS)),
        })
    return rows


def fetch(ids):
    url = API + "?" + urllib.parse.urlencode({"id_list": ",".join(ids), "max_results": len(ids)})
    req = urllib.request.Request(url, headers={"User-Agent": "FRONTIER-hackathon/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read().decode("utf-8")


def wanted_ids():
    papers = pd.read_parquet(RAW / "paper_concepts_2026.parquet")
    vocab = pd.read_csv(RAW / "vocab_2026.csv")
    cand = candidate_field(papers, vocab)
    return papers.loc[cand != "", "id"].drop_duplicates().tolist()


def build_parquet():
    """Turn the JSONL cache into the Person-A-compatible metadata table."""
    rows = [json.loads(l) for l in CACHE.read_text().splitlines() if l.strip()]
    m = pd.DataFrame(rows)
    m = m[m["title"] != ""].drop_duplicates("id", keep="last")
    papers = pd.read_parquet(RAW / "paper_concepts_2026.parquet")[["id", "first_date", "year", "primary_cat"]]
    m = m.merge(papers.drop_duplicates("id"), on="id", how="left")
    m["first_author"] = m["authors"].str.split("; ").str[0]
    m["n_authors"] = m["authors"].str.count("; ") + (m["authors"] != "").astype(int)
    m["url"] = "https://arxiv.org/abs/" + m["id"]
    cols = ["id", "title", "authors", "first_author", "n_authors", "first_date", "year",
            "primary_cat", "categories", "doi", "journal_ref", "url", "abstract"]
    m[cols].to_parquet(OUT, index=False)
    print(f"wrote {OUT}: {len(m):,} papers")


def main():
    ids = wanted_ids()
    done = set()
    if CACHE.exists():
        for line in CACHE.read_text().splitlines():
            if line.strip():
                done.add(json.loads(line)["id"])
    todo = [i for i in ids if i not in done]
    print(f"{len(ids):,} candidate papers, {len(done):,} cached, {len(todo):,} to fetch", flush=True)

    with CACHE.open("a") as f:
        for b in range(0, len(todo), BATCH):
            batch = todo[b:b + BATCH]
            for attempt in range(6):
                try:
                    rows = parse(fetch(batch))
                    break
                except Exception as ex:  # network hiccup or arXiv throttling
                    wait = PAUSE * (2 ** attempt)
                    print(f"  batch {b // BATCH}: {ex!r}, retry in {wait:.0f}s", flush=True)
                    time.sleep(wait)
            else:
                print(f"  batch {b // BATCH} failed 6 times, skipping (rerun to retry)", flush=True)
                continue
            got = {r["id"] for r in rows}
            for r in rows:
                f.write(json.dumps(r) + "\n")
            # remember ids arXiv returned nothing for, so we don't ask forever
            for missing in set(batch) - got:
                f.write(json.dumps({"id": missing, "title": ""}) + "\n")
            f.flush()
            if (b // BATCH) % 20 == 0:
                print(f"  {b + len(batch):,}/{len(todo):,} fetched", flush=True)
            time.sleep(PAUSE)
    build_parquet()


if __name__ == "__main__":
    main()
