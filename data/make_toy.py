"""
A tiny hand-made dataset (6 papers, 5 concepts) small enough to check by hand.

    P1 2012-06-01 {0,1}   P2 2013-06-01 {0,2}   P3 2014-06-01 {1,2}
    P4 2015-06-01 {3,4}   P5 2016-06-01 {3,2}   P6 2019-06-01 {4,2}

Graph at end of 2016 (P6 not yet published):

    1 --- 0
     \\   /
      \\ /
       2 --- 3 --- 4

Pair (2,4) is not linked in 2016, but P6 links it in 2019 -> a positive example.

Run:  python data/make_toy.py            (writes to data/toy/)
"""

import sys
from pathlib import Path

import pandas as pd

PAPERS = [
    ("P1", "2012-06-01", [0, 1]),
    ("P2", "2013-06-01", [0, 2]),
    ("P3", "2014-06-01", [1, 2]),
    ("P4", "2015-06-01", [3, 4]),
    ("P5", "2016-06-01", [3, 2]),
    ("P6", "2019-06-01", [4, 2]),
]
CONCEPTS = [
    (0, "graphene", "2012-06-01", "cond-mat"),
    (1, "battery", "2012-06-01", "cond-mat"),
    (2, "sensor", "2013-06-01", "physics"),
    (3, "neural network", "2015-06-01", "cs"),
    (4, "protein folding", "2015-06-01", "q-bio"),
]


def write_dataset(out_dir, papers=PAPERS, concepts=CONCEPTS):
    """Write papers/concepts/paper_concepts Parquet files into out_dir."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    pd.DataFrame({
        "paper_id": [p[0] for p in papers],
        "date": pd.to_datetime([p[1] for p in papers]),
    }).to_parquet(out / "papers.parquet", index=False)
    pd.DataFrame({
        "paper_id": [p[0] for p in papers for _ in p[2]],
        "concept_id": [c for p in papers for c in p[2]],
    }).to_parquet(out / "paper_concepts.parquet", index=False)
    pd.DataFrame({
        "concept_id": [c[0] for c in concepts],
        "phrase": [c[1] for c in concepts],
        "first_seen": pd.to_datetime([c[2] for c in concepts]),
        "dominant_cat": [c[3] for c in concepts],
    }).to_parquet(out / "concepts.parquet", index=False)
    return out


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent / "toy"
    print(f"Wrote toy data to {write_dataset(target)}")
