"""
Lands (islands) = sub-fields of a planet.

QUANT uses arXiv's own sub-categories (q-fin.ST, q-fin.PM, ...): no clustering needed.

MEDICINE has only one arXiv category (physics.med-ph), so we discover sub-fields:
  1. Build a concept co-occurrence graph from the papers.
  2. Weight each link by PMI = log( how often two concepts appear together
     / how often they would by chance ). High PMI = a specific association.
  3. Louvain community detection groups concepts that cluster together.
  4. Each paper joins the community most of its concepts belong to.
  5. Tiny communities merge into the community they are most connected to.
The function only sees the papers it is given, so the backtest can call it with
papers up to the cutoff (no lookahead in the `same_land` feature).
"""
import duckdb
import networkx as nx
import numpy as np
import pandas as pd


def cluster_papers(pc: pd.DataFrame, resolution: float, min_land_papers: int,
                   seed: int = 42, max_lands: int = 99, max_share: float = 0.05, min_papers: int = 10) -> pd.Series:
    """
    pc: paper_id, concept_id (one row per mention).
    Returns a Series paper_id -> integer land id (0 = biggest land).
    """
    n_docs = pc["paper_id"].nunique()
    cnt = pc.groupby("concept_id")["paper_id"].nunique()
    keep = cnt[(cnt >= min_papers) & (cnt <= max_share * n_docs)].index
    x = pc[pc["concept_id"].isin(keep)]

    con = duckdb.connect()
    con.register("x", x)
    e = con.execute("""
        SELECT a.concept_id AS u, b.concept_id AS v, count(*) AS n
        FROM x a JOIN x b ON a.paper_id = b.paper_id AND a.concept_id < b.concept_id
        GROUP BY 1, 2 HAVING count(*) >= 3
        ORDER BY 1, 2
    """).df()
    con.close()
    e["w"] = np.log(e["n"] * n_docs / (cnt[e["u"]].to_numpy() * cnt[e["v"]].to_numpy()))
    e = e[e["w"] > 0]

    # sorted input -> Louvain gives the same answer every run (it depends on node order)
    e = e.sort_values(["u", "v"]).reset_index(drop=True)
    G = nx.Graph()
    G.add_nodes_from(sorted(set(e["u"]) | set(e["v"])))
    G.add_weighted_edges_from(e[["u", "v", "w"]].itertuples(index=False))
    comms = nx.community.louvain_communities(G, weight="w", resolution=resolution, seed=seed)
    c_of = {c: i for i, cs in enumerate(comms) for c in cs}

    def assign(pc_part, mapping):
        k = pc_part["concept_id"].map(mapping)
        y = pc_part.assign(k=k).dropna(subset=["k"])
        # majority vote; ties -> smallest community id (deterministic)
        votes = y.groupby(["paper_id", "k"]).size().rename("n").reset_index()
        votes = votes.sort_values(["paper_id", "n", "k"], ascending=[True, False, True])
        return votes.drop_duplicates("paper_id").set_index("paper_id")["k"].astype(int)

    land = assign(x, c_of)

    # merge small communities (or the smallest, while there are more than max_lands)
    # into the community they share the most PMI weight with
    while True:
        sizes = land.value_counts()
        small = sizes[sizes < min_land_papers]
        if len(sizes) > max_lands:          # too many lands: merge the smallest one too
            small = sizes.tail(1)
        if len(small) == 0 or len(sizes) <= 1:
            break
        s = int(small.index[-1])                    # smallest first
        members = {c for c, k in c_of.items() if k == s}
        wsum = {}
        for u, v, w in G.edges(members, data="weight"):
            other = c_of[v] if u in members else c_of[u]
            if other != s and other in sizes.index:
                wsum[other] = wsum.get(other, 0.0) + w
        # divide by the target's size so big lands don't swallow everything
        target = max(wsum, key=lambda k: wsum[k] / sizes[k]) if wsum else int(sizes.index[0])
        c_of = {c: (target if k == s else k) for c, k in c_of.items()}
        land = assign(x, c_of)

    # papers with no clustered concept: use all their concepts' majority land
    rest = pc[~pc["paper_id"].isin(land.index)]
    if len(rest):
        concept_land = land.rename("k").reset_index().merge(pc, on="paper_id") \
            .groupby("concept_id")["k"].agg(lambda s: s.value_counts().index[0])
        extra = assign(rest, concept_land.to_dict())
        land = pd.concat([land, extra])
    leftover = pc.loc[~pc["paper_id"].isin(land.index), "paper_id"].unique()
    if len(leftover):
        land = pd.concat([land, pd.Series(int(land.value_counts().index[0]), index=leftover)])

    # renumber 0..K-1 by size
    order = {k: i for i, k in enumerate(land.value_counts().index)}
    return land.map(order).astype(int)


def concept_primary_land(pc: pd.DataFrame, paper_land: pd.Series) -> pd.Series:
    """concept_id -> the land where the concept appears in the most papers (ties: lowest land)."""
    y = pc.assign(land=pc["paper_id"].map(paper_land)).dropna(subset=["land"])
    votes = y.groupby(["concept_id", "land"]).size().rename("n").reset_index()
    votes = votes.sort_values(["concept_id", "n", "land"], ascending=[True, False, True])
    return votes.drop_duplicates("concept_id").set_index("concept_id")["land"].astype(int)


def distinctive_concepts(pc: pd.DataFrame, paper_land: pd.Series, land: int, top: int = 40) -> list:
    """Concepts most specific to one land: share of the concept's papers in the land x log(count)."""
    cnt = pc.groupby("concept_id")["paper_id"].nunique()
    y = pc[pc["paper_id"].map(paper_land) == land]
    n = y.groupby("concept_id")["paper_id"].nunique()
    score = n / cnt[n.index] * np.log1p(n)
    return score.sort_values(ascending=False).head(top).index.tolist()


def name_clusters(pc, paper_land, phrase_of, names: dict) -> dict:
    """Give each cluster the hand-written name whose anchor concepts it contains most of."""
    lands = sorted(paper_land.unique())
    top = {k: [phrase_of[c] for c in distinctive_concepts(pc, paper_land, k, 60)] for k in lands}
    scores = []
    for k in lands:
        for name, anchors in names.items():
            hit = sum(1 for a in anchors if a in top[k])
            if hit:
                scores.append((hit, -k, k, name))
    out, used = {}, set()
    for hit, _, k, name in sorted(scores, reverse=True):
        if k not in out and name not in used:
            out[k], used = name, used | {name}
    for k in lands:   # unnamed: use its two most distinctive concepts
        if k not in out:
            out[k] = " & ".join(t.title() for t in top[k][:2])
    return out
