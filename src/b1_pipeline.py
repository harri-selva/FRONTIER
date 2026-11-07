"""
FRONTIER part B1: turn papers + concepts into a table of (concept pair, features, label).

The big idea
------------
Think of every concept as a dot, and draw a line between two dots the first time
a paper mentions both of them. That is the "co-mention graph".

To make a prediction "as of" some cutoff date t, we:
  1. look at the graph using ONLY papers dated on or before t   (snapshot)
  2. pick pairs of concepts that are NOT yet connected           (candidates)
  3. describe each pair with numbers from that old graph         (pair_features, node_features)
  4. check whether the pair got connected later, in (t, t_end]   (add_labels)

Step 4 is the "answer key". It is only used to train and to score the model,
never as an input feature.

STRICT RULE - no lookahead: every feature uses only data dated <= t.

Input: three Parquet files in one folder
  papers.parquet          paper_id (str), date (datetime)
  concepts.parquet        concept_id (int 0..N-1), phrase (str), first_seen (datetime), dominant_cat (str)
  paper_concepts.parquet  paper_id (str), concept_id (int)
"""

from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
import scipy.sparse as sp

MAX_CONCEPTS_PER_PAPER = 30  # a paper with 100 concepts would create 4,950 pairs; cap it


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------
def end_of_year(year: int) -> pd.Timestamp:
    """The last instant of `year`, e.g. 2016 -> 2016-12-31 23:59:59.999999."""
    return pd.Timestamp(year + 1, 1, 1) - pd.Timedelta(microseconds=1)


def load_concepts(data_dir) -> pd.DataFrame:
    """Read the concepts table and check the IDs are exactly 0..N-1 (we use them as matrix rows)."""
    concepts = pd.read_parquet(Path(data_dir) / "concepts.parquet")
    concepts = concepts.sort_values("concept_id").reset_index(drop=True)
    assert (concepts["concept_id"].to_numpy() == np.arange(len(concepts))).all(), \
        "concept_id must be numbered 0..N-1 with no gaps"
    concepts["first_seen"] = pd.to_datetime(concepts["first_seen"])
    return concepts


# ---------------------------------------------------------------------------
# 1. build_edges
# ---------------------------------------------------------------------------
def build_edges(data_dir, cap: int = MAX_CONCEPTS_PER_PAPER):
    """
    Build two tables with DuckDB (an in-process SQL database that reads Parquet
    directly and works on data bigger than memory, so it will cope with ~500k papers).

    edges:        one row per concept pair (u < v) that has EVER appeared together
                  u, v, first_date (date of the earliest paper with both),
                  first_paper (that paper's id), n_papers (how many papers have both)
    concept_year: papers per concept per year: concept_id, year, n_papers

    If a paper has more than `cap` concepts, we keep the `cap` lowest concept_ids
    (a simple, deterministic rule).
    """
    d = Path(data_dir)
    papers = (d / "papers.parquet").as_posix()
    pc = (d / "paper_concepts.parquet").as_posix()
    con = duckdb.connect()

    edges = con.execute(f"""
        WITH pc AS (                       -- remove duplicate mentions, attach the paper date
            SELECT DISTINCT pc.paper_id, pc.concept_id, p.date
            FROM read_parquet('{pc}') pc
            JOIN read_parquet('{papers}') p USING (paper_id)
        ),
        capped AS (                        -- keep at most `cap` concepts per paper
            SELECT * FROM (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY paper_id ORDER BY concept_id) AS rn
                FROM pc
            ) WHERE rn <= {cap}
        ),
        pairs AS (                         -- every pair inside the same paper, u < v
            SELECT a.concept_id AS u, b.concept_id AS v, a.paper_id, a.date
            FROM capped a JOIN capped b
              ON a.paper_id = b.paper_id AND a.concept_id < b.concept_id
        )
        SELECT u, v,
               min(date)                     AS first_date,
               arg_min(paper_id, (date, paper_id)) AS first_paper,  -- ties: smallest id
               count(*)                      AS n_papers
        FROM pairs
        GROUP BY u, v
        ORDER BY u, v
    """).df()

    concept_year = con.execute(f"""
        SELECT pc.concept_id, year(p.date) AS year, count(DISTINCT pc.paper_id) AS n_papers
        FROM read_parquet('{pc}') pc
        JOIN read_parquet('{papers}') p USING (paper_id)
        GROUP BY 1, 2
        ORDER BY 1, 2
    """).df()
    con.close()

    edges["u"] = edges["u"].astype(np.int64)
    edges["v"] = edges["v"].astype(np.int64)
    edges["first_date"] = pd.to_datetime(edges["first_date"])
    concept_year = concept_year.astype({"concept_id": np.int64, "year": np.int64, "n_papers": np.int64})
    return edges, concept_year


# ---------------------------------------------------------------------------
# 2. snapshot
# ---------------------------------------------------------------------------
def snapshot(edges: pd.DataFrame, concepts: pd.DataFrame, t: pd.Timestamp):
    """
    The graph as it looked at time t.

    Returns
      A      N x N scipy sparse matrix (CSR), A[u, v] = A[v, u] = 1 if the pair
             co-appeared in a paper dated <= t. Symmetric, zero diagonal.
      deg    number of neighbours of each concept at time t
      alive  True for concepts with first_seen <= t (concepts that "exist" by then)
    """
    n = len(concepts)
    old = edges[edges["first_date"] <= t]           # <-- the no-lookahead filter
    u = old["u"].to_numpy()
    v = old["v"].to_numpy()
    ones = np.ones(2 * len(old), dtype=np.float64)
    A = sp.csr_matrix((ones, (np.r_[u, v], np.r_[v, u])), shape=(n, n))
    deg = np.asarray(A.sum(axis=1)).ravel()
    alive = (concepts["first_seen"] <= t).to_numpy()
    return A, deg, alive


# ---------------------------------------------------------------------------
# 3. node_features
# ---------------------------------------------------------------------------
def node_features(concept_year: pd.DataFrame, concepts: pd.DataFrame, year: int) -> pd.DataFrame:
    """
    Per-concept numbers, using only years <= `year`.
      recent = papers in the 3 years up to and including `year`  (year-2, year-1, year)
      growth = recent / total papers up to `year`  (denominator at least 1)
               ~1.0 means "almost all of its papers are recent", i.e. a fast-growing topic
      age    = year - year(first_seen)
    Returns a DataFrame indexed by concept_id.
    """
    cy = concept_year[concept_year["year"] <= year]           # no lookahead
    total = cy.groupby("concept_id")["n_papers"].sum()
    recent = cy[cy["year"] >= year - 2].groupby("concept_id")["n_papers"].sum()

    out = pd.DataFrame(index=pd.Index(concepts["concept_id"], name="concept_id"))
    out["recent"] = recent.reindex(out.index, fill_value=0).astype(float)
    total = total.reindex(out.index, fill_value=0).astype(float)
    out["growth"] = out["recent"] / np.maximum(total, 1.0)
    out["age"] = year - concepts.set_index("concept_id")["first_seen"].dt.year
    return out


# ---------------------------------------------------------------------------
# 4. candidates
# ---------------------------------------------------------------------------
def candidates(A, alive, p_2hop: float, n_far: int, seed: int = 0, block: int = 1000) -> pd.DataFrame:
    """
    Choose which not-yet-connected pairs to score.

    (a) two-hop pairs: u and v share at least one neighbour (a "friend of a friend").
        (A @ A)[u, v] counts shared neighbours. For N concepts that matrix can be huge,
        so we compute it `block` rows at a time and throw each block away when done.
        Each two-hop pair is kept with probability p_2hop (1.0 keeps them all).
    (b) n_far random pairs of alive concepts, so the model also sees "far apart" pairs.

    Then: deduplicate, make u < v, drop self-pairs and pairs that are already linked.
    """
    rng = np.random.default_rng(seed)
    alive_ids = np.flatnonzero(alive)
    A = A.tocsr()
    us, vs = [], []

    # (a) two-hop pairs, block by block
    for start in range(0, len(alive_ids), block):
        rows = alive_ids[start:start + block]
        two_hop = (A[rows] @ A).tocoo()          # only `block` rows of A@A in memory
        r = rows[two_hop.row]                    # map block row number back to concept id
        c = two_hop.col
        keep = (c > r) & alive[c]                # u < v, both alive
        r, c = r[keep], c[keep]
        r, c = _sample(r, c, p_2hop, rng)        # keep each with probability p_2hop
        us.append(r)
        vs.append(c)

    # (b) random far pairs
    if n_far > 0 and len(alive_ids) >= 2:
        pick = rng.choice(alive_ids, size=(n_far, 2))
        us.append(np.minimum(pick[:, 0], pick[:, 1]))
        vs.append(np.maximum(pick[:, 0], pick[:, 1]))

    u = np.concatenate(us) if us else np.array([], dtype=np.int64)
    v = np.concatenate(vs) if vs else np.array([], dtype=np.int64)
    df = pd.DataFrame({"u": u.astype(np.int64), "v": v.astype(np.int64)})
    df = df[df["u"] < df["v"]].drop_duplicates()
    if len(df):
        linked = np.asarray(A[df["u"].to_numpy(), df["v"].to_numpy()]).ravel() > 0
        df = df[~linked]
    return df.sort_values(["u", "v"]).reset_index(drop=True)


def _sample(r, c, p, rng):
    """Keep each (r, c) pair independently with probability p."""
    if p >= 1.0:
        return r, c
    keep = rng.random(len(r)) < p
    return r[keep], c[keep]


# ---------------------------------------------------------------------------
# 5. pair_features
# ---------------------------------------------------------------------------
def pair_features(A, deg, u, v, chunk: int = 100_000) -> pd.DataFrame:
    """
    Classic link-prediction scores for each pair (u[i], v[i]), computed in chunks.
      cn       common neighbours: how many concepts both are linked to
      jaccard  cn / (deg_u + deg_v - cn)  -- shared neighbours as a share of all neighbours
      aa       Adamic-Adar: sum over shared neighbours w of 1 / ln(deg_w)  (deg floored at 2)
               a shared neighbour that is linked to everything (a hub) counts for little
      ra       resource allocation: sum over shared neighbours w of 1 / deg_w
      pa       preferential attachment: deg_u * deg_v  (popular concepts meet more)
      deg_min, deg_max
    """
    A = A.tocsr()
    u = np.asarray(u, dtype=np.int64)
    v = np.asarray(v, dtype=np.int64)
    w_aa = 1.0 / np.log(np.maximum(deg, 2.0))
    w_ra = 1.0 / np.maximum(deg, 1.0)   # a shared neighbour always has deg >= 2; the guard avoids /0

    parts = []
    for s in range(0, len(u), chunk):
        uu, vv = u[s:s + chunk], v[s:s + chunk]
        shared = A[uu].multiply(A[vv]).tocsr()   # row i: 1 where a concept neighbours both
        cn = np.asarray(shared.sum(axis=1)).ravel()
        du, dv = deg[uu], deg[vv]
        union = du + dv - cn
        parts.append(pd.DataFrame({
            "cn": cn,
            "jaccard": np.divide(cn, union, out=np.zeros_like(cn), where=union > 0),
            "aa": shared @ w_aa,
            "ra": shared @ w_ra,
            "pa": du * dv,
            "deg_min": np.minimum(du, dv),
            "deg_max": np.maximum(du, dv),
        }))
    cols = ["cn", "jaccard", "aa", "ra", "pa", "deg_min", "deg_max"]
    return pd.concat(parts, ignore_index=True) if parts else pd.DataFrame(columns=cols, dtype=float)


# ---------------------------------------------------------------------------
# 6. add_labels
# ---------------------------------------------------------------------------
def add_labels(df: pd.DataFrame, edges: pd.DataFrame, t, t_end) -> pd.DataFrame:
    """
    label = True if the pair first appears together in a paper dated in (t, t_end].
    label_date / label_paper say when and where. They are for evaluation only
    (they come from the future) and must NEVER be used as model features.
    """
    e = edges[["u", "v", "first_date", "first_paper"]]
    out = df.merge(e, on=["u", "v"], how="left")
    hit = (out["first_date"] > t) & (out["first_date"] <= t_end)
    out["label"] = hit.fillna(False).astype(bool)
    out["label_date"] = out["first_date"].where(out["label"])
    out["label_paper"] = out["first_paper"].where(out["label"])
    return out.drop(columns=["first_date", "first_paper"])


# ---------------------------------------------------------------------------
# 7. build
# ---------------------------------------------------------------------------
FEATURE_COLUMNS = [
    "cn", "jaccard", "aa", "ra", "pa", "deg_min", "deg_max",
    "recent_min", "recent_max", "growth_min", "growth_max", "age_min", "age_max",
    "same_cat", "is_2hop",
]
NOT_FEATURES = ["u", "v", "label", "label_date", "label_paper"]


def build(year: int, horizon: int, p_2hop: float, n_far: int,
          data_dir="data/synthetic", out_dir="outputs", seed: int = 0) -> pd.DataFrame:
    """
    Build the full feature table for cutoff = end of `year`, with labels for the
    window (end of year, end of year+horizon]. horizon=0 means "no labels"
    (e.g. predicting the real future). Saves features_<year>_h<horizon>.parquet.
    """
    t = end_of_year(year)
    t_end = end_of_year(year + horizon)

    concepts = load_concepts(data_dir)
    edges, concept_year = build_edges(data_dir)
    A, deg, alive = snapshot(edges, concepts, t)

    df = candidates(A, alive, p_2hop=p_2hop, n_far=n_far, seed=seed)
    pf = pair_features(A, deg, df["u"].to_numpy(), df["v"].to_numpy())
    df = pd.concat([df.reset_index(drop=True), pf], axis=1)

    # per-concept features -> for a pair, store the smaller and the larger value
    nf = node_features(concept_year, concepts, year)
    for col in ["recent", "growth", "age"]:
        a = nf[col].to_numpy()[df["u"].to_numpy()]
        b = nf[col].to_numpy()[df["v"].to_numpy()]
        df[f"{col}_min"] = np.minimum(a, b)
        df[f"{col}_max"] = np.maximum(a, b)

    cat = concepts["dominant_cat"].to_numpy()
    df["same_cat"] = cat[df["u"].to_numpy()] == cat[df["v"].to_numpy()]
    df["is_2hop"] = df["cn"] > 0

    if horizon > 0:
        df = add_labels(df, edges, t, t_end)

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"features_{year}_h{horizon}.parquet"
    df.to_parquet(path, index=False)
    n_pos = int(df["label"].sum()) if "label" in df else 0
    print(f"[build] cutoff {t.date()}  pairs {len(df):,}  positives {n_pos:,}  -> {path}")
    return df


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="Build FRONTIER B1 features for one cutoff year.")
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--horizon", type=int, default=3)
    ap.add_argument("--p-2hop", type=float, default=1.0)
    ap.add_argument("--n-far", type=int, default=10_000)
    ap.add_argument("--data-dir", default="data/synthetic")
    ap.add_argument("--out-dir", default="outputs")
    a = ap.parse_args()
    build(a.year, a.horizon, a.p_2hop, a.n_far, a.data_dir, a.out_dir)
