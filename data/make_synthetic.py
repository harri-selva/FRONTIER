"""
Generate a realistic-looking synthetic dataset to train and test the basic model.

  ~300 concepts, born gradually between 2000 and 2020
  ~20,000 papers dated 2000-2025, each mentioning 3-6 concepts

How a paper picks its concepts (this is what gives the graph features real signal):
  1. The first concept is chosen in proportion to popularity (papers so far + 1),
     but brand-new concepts are given a push so they actually get used.
  2. Each further concept is chosen by one of three rules:
       - triadic closure (P_CLOSURE): pick a neighbour of a concept already in the
         paper, i.e. a "friend of a friend" of the others -> closes triangles
       - popularity     (P_POPULAR): pick in proportion to popularity
       - random         (the rest) : any alive concept, preferring the same category
The output uses exactly the same 3-table format as the real data.

Run:  python data/make_synthetic.py      (writes to data/synthetic/)
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

SEED = 42
N_CONCEPTS = 300
N_PAPERS = 20_000
N_FOUNDING = 30            # concepts that already exist in 2000
P_CLOSURE = 0.55
P_POPULAR = 0.35
POP_POWER = 1.5          # >1 = stronger rich-get-richer (popular concepts reused more)
P_RANDOM_SAME_CAT = 0.6
CATEGORIES = ["cs", "physics", "cond-mat", "q-bio", "math"]
WORDS_A = ["quantum", "neural", "graphene", "protein", "topological", "stochastic", "optical",
           "bayesian", "spin", "molecular", "sparse", "thermal", "photonic", "deep", "genomic"]
WORDS_B = ["network", "sensor", "battery", "folding", "insulator", "lattice", "imaging",
           "inference", "transport", "dynamics", "embedding", "catalyst", "membrane", "laser",
           "solver", "crystal", "kernel", "circuit", "assay", "field"]


def make(out_dir, seed=SEED):
    rng = np.random.default_rng(seed)

    # --- concepts: name, category, birth date -------------------------------------
    names = rng.permutation([f"{a} {b}" for a in WORDS_A for b in WORDS_B])[:N_CONCEPTS]
    cats = rng.choice(CATEGORIES, size=N_CONCEPTS)
    start, end_birth = pd.Timestamp("2000-01-01"), pd.Timestamp("2020-12-31")
    birth = np.sort(rng.uniform(start.value, end_birth.value, N_CONCEPTS - N_FOUNDING))
    birth = np.r_[np.full(N_FOUNDING, start.value), birth].astype("int64")  # ns timestamps

    # --- papers: dates; more papers in later years (the field grows) --------------
    span = pd.Timestamp("2025-12-31").value - start.value
    dates = np.sort(start.value + span * np.sqrt(rng.uniform(0, 1, N_PAPERS))).astype("int64")

    popularity = np.zeros(N_CONCEPTS)               # papers mentioning each concept so far
    neighbours = [set() for _ in range(N_CONCEPTS)]  # co-mention graph built as we go
    paper_rows = []

    for i, d in enumerate(dates):
        alive = np.flatnonzero(birth <= d)
        k = min(int(rng.integers(3, 7)), len(alive))    # 3..6 concepts
        # new concepts (popularity 0) get a weight boost so they get picked up
        w = (popularity[alive] + 1.0) ** POP_POWER + 8.0 * (popularity[alive] < 3)
        chosen = [int(rng.choice(alive, p=w / w.sum()))]

        while len(chosen) < k:
            r = rng.random()
            if r < P_CLOSURE:
                pool = set().union(*(neighbours[c] for c in chosen)) - set(chosen)
                pool = np.fromiter(pool, dtype=np.int64)
                if len(pool) == 0:
                    continue
                pw = (popularity[pool] + 1.0) ** POP_POWER
                pick = int(rng.choice(pool, p=pw / pw.sum()))
            elif r < P_CLOSURE + P_POPULAR:
                pw = (popularity[alive] + 1.0) ** POP_POWER
                pick = int(rng.choice(alive, p=pw / pw.sum()))
            else:
                same = alive[cats[alive] == cats[chosen[0]]]
                pool = same if (len(same) > 1 and rng.random() < P_RANDOM_SAME_CAT) else alive
                pick = int(rng.choice(pool))
            if pick not in chosen:
                chosen.append(pick)

        pid = f"S{i:05d}"
        for c in chosen:
            popularity[c] += 1
            neighbours[c].update(x for x in chosen if x != c)
            paper_rows.append((pid, c))

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    papers = pd.DataFrame({"paper_id": [f"S{i:05d}" for i in range(N_PAPERS)],
                           "date": pd.to_datetime(dates).normalize()})
    pc = pd.DataFrame(paper_rows, columns=["paper_id", "concept_id"])

    # first_seen = date of the first paper that actually mentions the concept
    # (that is how the real data defines it). Unused concepts keep their birth date.
    first_use = pc.merge(papers, on="paper_id").groupby("concept_id")["date"].min()
    first_seen = pd.Series(pd.to_datetime(birth).normalize(), index=range(N_CONCEPTS))
    first_seen.update(first_use)
    concepts = pd.DataFrame({"concept_id": np.arange(N_CONCEPTS), "phrase": names,
                             "first_seen": first_seen.values, "dominant_cat": cats})

    papers.to_parquet(out / "papers.parquet", index=False)
    pc.to_parquet(out / "paper_concepts.parquet", index=False)
    concepts.to_parquet(out / "concepts.parquet", index=False)
    print(f"Wrote {len(papers):,} papers, {len(concepts)} concepts, "
          f"{len(pc):,} mentions to {out}")


if __name__ == "__main__":
    make(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent / "synthetic")
