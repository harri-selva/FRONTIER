"""
The co-mention graph and every feature, for ONE field at ONE cutoff time t.

Plain-English summary
---------------------
  * edge (u, v): concepts u and v appear together in at least one paper.
    We keep first_date / first_paper (earliest joint paper), second_date and n_papers.
  * At cutoff t we only look at papers dated <= t:
      - a concept is "alive" if it has >= MIN_PAPERS papers by t and appears in
        <= MAX_SHARE of all papers by t (otherwise it's a hub word like "model")
      - the snapshot graph A has an edge if the pair co-appeared by t (both alive)
  * candidates = EVERY pair of alive concepts with no edge yet (both in this field)
  * features describe each candidate using only the snapshot (see FEATURES)
  * labels (evaluation only): did the pair first co-appear in (t, t_end]?

No lookahead: every feature below uses papers dated <= t only. The tests check it.
"""
import duckdb
import numpy as np
import pandas as pd
import scipy.sparse as sp

from lands import cluster_papers, concept_primary_land


def end_of_year(year: int) -> pd.Timestamp:
    return pd.Timestamp(year + 1, 1, 1) - pd.Timedelta(microseconds=1)


# ---------------------------------------------------------------------------
# Built once per field (these tables contain the future; they are always
# filtered by date before use)
# ---------------------------------------------------------------------------
def build_edges(papers: pd.DataFrame, pc: pd.DataFrame) -> pd.DataFrame:
    """
    papers: paper_id, date     pc: paper_id, concept_id
    -> u, v, first_date, first_paper, second_date, n_papers   (u < v)
    DuckDB does the big self-join out of memory-friendly columnar storage.
    """
    con = duckdb.connect()
    con.register("papers", papers[["paper_id", "date"]])
    con.register("pc", pc[["paper_id", "concept_id"]])
    e = con.execute("""
        WITH x AS (SELECT pc.paper_id, pc.concept_id, p.date
                   FROM pc JOIN papers p USING (paper_id)),
        pairs AS (
            SELECT a.concept_id AS u, b.concept_id AS v, a.paper_id, a.date,
                   ROW_NUMBER() OVER (PARTITION BY a.concept_id, b.concept_id
                                      ORDER BY a.date, a.paper_id) AS rn
            FROM x a JOIN x b ON a.paper_id = b.paper_id AND a.concept_id < b.concept_id
        )
        SELECT u, v,
               min(date)                                AS first_date,
               arg_min(paper_id, (date, paper_id))      AS first_paper,
               min(date) FILTER (WHERE rn = 2)          AS second_date,
               count(*)                                 AS n_papers
        FROM pairs GROUP BY u, v ORDER BY u, v
    """).df()
    con.close()
    e["u"] = e["u"].astype(np.int64)
    e["v"] = e["v"].astype(np.int64)
    for c in ["first_date", "second_date"]:
        e[c] = pd.to_datetime(e[c])
    return e


class FieldData:
    """Everything about one field that the feature code needs."""

    def __init__(self, papers, concepts, pc, field):
        self.field = field
        self.papers = papers.reset_index(drop=True)
        self.concepts = concepts
        self.pc = pc
        self.n = len(concepts)
        self.edges = build_edges(self.papers, pc)
        # one row per mention, with the paper's date (sorted for fast "<= t" filtering)
        self.mentions = pc.merge(self.papers[["paper_id", "date", "land"]], on="paper_id") \
                          .sort_values("date").reset_index(drop=True)


# ---------------------------------------------------------------------------
# At a cutoff t
# ---------------------------------------------------------------------------
def alive_mask(fd: FieldData, t, min_papers: int, max_share: float) -> np.ndarray:
    """Concepts with >= min_papers papers by t and in <= max_share of papers by t."""
    m = fd.mentions[fd.mentions["date"] <= t]
    n_docs = (fd.papers["date"] <= t).sum()
    cnt = np.bincount(m["concept_id"].to_numpy(), minlength=fd.n)
    return (cnt >= min_papers) & (cnt <= max_share * max(n_docs, 1))


def snapshot(fd: FieldData, t, alive: np.ndarray):
    """Sparse symmetric adjacency of edges dated <= t between alive concepts, + degree."""
    e = fd.edges
    keep = (e["first_date"] <= t).to_numpy() & alive[e["u"].to_numpy()] & alive[e["v"].to_numpy()]
    u, v = e["u"].to_numpy()[keep], e["v"].to_numpy()[keep]
    ones = np.ones(2 * len(u), dtype=np.float32)
    A = sp.csr_matrix((ones, (np.r_[u, v], np.r_[v, u])), shape=(fd.n, fd.n))
    deg = np.asarray(A.sum(axis=1)).ravel()
    return A, deg


def node_features(fd: FieldData, t) -> pd.DataFrame:
    """recent (papers in the 3 calendar years up to t), growth = recent/total, age in years."""
    m = fd.mentions[fd.mentions["date"] <= t]
    year = t.year
    total = np.bincount(m["concept_id"].to_numpy(), minlength=fd.n).astype(float)
    rec = m[m["date"].dt.year >= year - 2]
    recent = np.bincount(rec["concept_id"].to_numpy(), minlength=fd.n).astype(float)
    first = m.groupby("concept_id")["date"].min().reindex(range(fd.n))
    age = (year - first.dt.year).fillna(0).to_numpy().astype(float)
    return pd.DataFrame({"recent": recent, "growth": recent / np.maximum(total, 1.0), "age": age})


def concept_land_at(fd: FieldData, t, med_params=None) -> np.ndarray:
    """
    Each concept's land using only papers dated <= t.
    Quant: paper lands come from arXiv categories (known at submission) -> no lookahead.
    Medicine: lands come from clustering, so we re-cluster using papers <= t only.
    """
    m = fd.mentions[fd.mentions["date"] <= t]
    if fd.field == "medicine" and med_params is not None:
        paper_land = cluster_papers(m[["paper_id", "concept_id"]], **med_params)
    else:
        paper_land = m.drop_duplicates("paper_id").set_index("paper_id")["land"]
    prim = concept_primary_land(m[["paper_id", "concept_id"]], paper_land)
    return prim.reindex(range(fd.n), fill_value=-1).to_numpy()


def unlinked_pair_features(A, deg, alive, block: int = 512) -> pd.DataFrame:
    """
    For EVERY pair of alive concepts (u < v) with no edge: cn, jaccard, aa, ra, pa, deg_min, deg_max.

    Shared-neighbour counts are matrix products, e.g. cn = (A @ A)[u, v]. We work on the
    alive sub-graph as a dense matrix and compute `block` rows of each product at a time,
    so the full A @ A is never held in memory.
      ra[u,v] = sum_w A[u,w] * (1/deg_w) * A[w,v]
      aa[u,v] = sum_w A[u,w] * (1/ln(max(deg_w,2))) * A[w,v]
    """
    ids = np.flatnonzero(alive)
    S = A[ids][:, ids].toarray().astype(np.float32)
    d = deg[ids].astype(np.float32)
    w_ra = (1.0 / np.maximum(d, 1.0)).astype(np.float32)
    w_aa = (1.0 / np.log(np.maximum(d, 2.0))).astype(np.float32)
    S_ra, S_aa = S * w_ra[None, :], S * w_aa[None, :]
    n = len(ids)
    cols = {k: [] for k in ["u", "v", "cn", "ra", "aa"]}
    for r0 in range(0, n, block):
        r1 = min(n, r0 + block)
        rows = np.arange(r0, r1)
        mask = (np.arange(n)[None, :] > rows[:, None]) & (S[r0:r1] == 0)   # u < v, not linked
        ri, ci = np.nonzero(mask)
        cn = (S[r0:r1] @ S)[ri, ci]
        ra = (S_ra[r0:r1] @ S)[ri, ci]
        aa = (S_aa[r0:r1] @ S)[ri, ci]
        cols["u"].append(ids[ri + r0].astype(np.int32))
        cols["v"].append(ids[ci].astype(np.int32))
        cols["cn"].append(cn)
        cols["ra"].append(ra)
        cols["aa"].append(aa)
    df = pd.DataFrame({k: np.concatenate(v) for k, v in cols.items()})
    du, dv = deg[df["u"].to_numpy()].astype(np.float32), deg[df["v"].to_numpy()].astype(np.float32)
    union = du + dv - df["cn"].to_numpy()
    df["jaccard"] = np.divide(df["cn"].to_numpy(), union, out=np.zeros_like(union), where=union > 0)
    df["pa"] = du * dv
    df["deg_min"] = np.minimum(du, dv)
    df["deg_max"] = np.maximum(du, dv)
    return df


def add_labels(df: pd.DataFrame, fd: FieldData, t, t_end) -> pd.DataFrame:
    """
    label      = first joint paper dated in (t, t_end]
    label2     = second joint paper also by t_end (pre-registered stricter definition)
    label_date / label_paper: when and where. EVALUATION ONLY - never features.
    """
    e = fd.edges
    key_e = e["u"].to_numpy() * fd.n + e["v"].to_numpy()
    key = df["u"].to_numpy().astype(np.int64) * fd.n + df["v"].to_numpy()
    pos = np.searchsorted(key_e, key)
    pos = np.minimum(pos, len(key_e) - 1)
    found = key_e[pos] == key
    fdate = np.where(found, e["first_date"].to_numpy().astype("datetime64[ns]")[pos], np.datetime64("NaT", "ns"))
    sdate = np.where(found, e["second_date"].to_numpy().astype("datetime64[ns]")[pos], np.datetime64("NaT", "ns"))
    fpaper = np.where(found, e["first_paper"].to_numpy()[pos], None)
    t64, te64 = np.datetime64(pd.Timestamp(t), "ns"), np.datetime64(pd.Timestamp(t_end), "ns")
    lab = found & (fdate > t64) & (fdate <= te64)
    df["label"] = lab
    df["label2"] = lab & (sdate <= te64)
    df["label_date"] = pd.to_datetime(np.where(lab, fdate, np.datetime64("NaT", "ns")))
    df["label_paper"] = np.where(lab, fpaper, None)
    return df


def features_at(fd: FieldData, t, t_end=None, *, min_papers, max_share, med_params=None) -> pd.DataFrame:
    """The full candidate table for field `fd` at cutoff t (labels if t_end is given)."""
    alive = alive_mask(fd, t, min_papers, max_share)
    A, deg = snapshot(fd, t, alive)
    df = unlinked_pair_features(A, deg, alive)
    u, v = df["u"].to_numpy(), df["v"].to_numpy()

    nf = node_features(fd, t)
    for col in ["recent", "growth", "age"]:
        a, b = nf[col].to_numpy()[u], nf[col].to_numpy()[v]
        df[f"{col}_min"] = np.minimum(a, b).astype(np.float32)
        df[f"{col}_max"] = np.maximum(a, b).astype(np.float32)
    land = concept_land_at(fd, t, med_params)
    df["same_land"] = land[u] == land[v]
    df["is_2hop"] = df["cn"].to_numpy() > 0
    if t_end is not None:
        df = add_labels(df, fd, t, t_end)
    return df


def load_field(field: str, proc_dir) -> FieldData:
    """Load data/processed/<field>/ into a FieldData."""
    from pathlib import Path
    d = Path(proc_dir) / field
    papers = pd.read_parquet(d / "papers.parquet")
    papers["date"] = pd.to_datetime(papers["date"])
    concepts = pd.read_parquet(d / "concepts.parquet")
    pc = pd.read_parquet(d / "paper_concepts.parquet")
    return FieldData(papers, concepts, pc, field)
