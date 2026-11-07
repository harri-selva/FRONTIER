"""
Tests for the FRONTIER pipeline (pipeline/graph.py, lands.py, fields.py, export).

Toy field (same graph as tests/test_toy.py, plus islands):
    P1 2012-06-01 {0,1} land 0      P4 2015-06-01 {3,4} land 1
    P2 2013-06-01 {0,2} land 0      P5 2016-06-01 {3,2} land 1
    P3 2014-06-01 {1,2} land 0      P6 2019-06-01 {4,2} land 1

Graph at the end of 2016:   1 - 0 - 2 - 1 (triangle 0,1,2),  2 - 3 - 4
Degrees: d0=2 d1=2 d2=3 d3=2 d4=1
Unlinked pairs: (0,3) (0,4) (1,3) (1,4) (2,4)
Concept land (majority of papers <= 2016): 0,1,2 -> land 0 ; 3,4 -> land 1
"""
import json
import math
import sys
from pathlib import Path

import networkx as nx
import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipeline"))

import config as C   # noqa: E402
import graph as G    # noqa: E402

T2016 = G.end_of_year(2016)
T_END = G.end_of_year(2025)
LOOSE = dict(min_papers=1, max_share=1.0)     # toy is tiny: every seen concept is alive

BASE = [("P1", "2012-06-01", [0, 1], 0), ("P2", "2013-06-01", [0, 2], 0),
        ("P3", "2014-06-01", [1, 2], 0), ("P4", "2015-06-01", [3, 4], 1),
        ("P5", "2016-06-01", [3, 2], 1), ("P6", "2019-06-01", [4, 2], 1)]
NAMES = ["graphene", "battery", "sensor", "neural network", "protein folding"]


def make_field(rows=BASE, field="quant", n_concepts=5):
    papers = pd.DataFrame({"paper_id": [r[0] for r in rows],
                           "date": pd.to_datetime([r[1] for r in rows]),
                           "land": [r[3] for r in rows]})
    pc = pd.DataFrame([(r[0], c) for r in rows for c in r[2]], columns=["paper_id", "concept_id"])
    concepts = pd.DataFrame({"concept_id": range(n_concepts), "phrase": NAMES[:n_concepts]})
    return G.FieldData(papers, concepts, pc, field)


def table(rows=BASE, t=T2016, t_end=T_END, **kw):
    fd = make_field(rows)
    df = G.features_at(fd, t, t_end, **{**LOOSE, **kw})
    return fd, df.set_index(["u", "v"])


# ---------------------------------------------------------------------------
# Hand-computed values for EVERY feature
# ---------------------------------------------------------------------------
EXPECTED = {
    # (u,v): cn, jaccard, aa, ra, pa, deg_min, deg_max, recent_min, recent_max,
    #        growth_min, growth_max, age_min, age_max, same_land, is_2hop
    (2, 4): (1, 1 / 3, 1 / math.log(2), 1 / 2, 3, 1, 3, 1, 2, 2 / 3, 1.0, 1, 3, False, True),
    (0, 3): (1, 1 / 3, 1 / math.log(3), 1 / 3, 4, 2, 2, 0, 2, 0.0, 1.0, 1, 4, False, True),
    (1, 3): (1, 1 / 3, 1 / math.log(3), 1 / 3, 4, 2, 2, 1, 2, 0.5, 1.0, 1, 4, False, True),
    (0, 4): (0, 0.0, 0.0, 0.0, 2, 1, 2, 0, 1, 0.0, 1.0, 1, 4, False, False),
    (1, 4): (0, 0.0, 0.0, 0.0, 2, 1, 2, 1, 1, 0.5, 1.0, 1, 4, False, False),
}
# Notes on the hand calculation:
#  (2,4): shared neighbour 3 (deg 2): aa = 1/ln 2, ra = 1/2; union = 3+1-1 = 3
#  (0,3), (1,3): shared neighbour 2 (deg 3): aa = 1/ln 3, ra = 1/3; union = 2+2-1 = 3
#  recent = papers 2014-2016: c0 0, c1 1 (P3), c2 2 (P3,P5), c3 2, c4 1
#  total by 2016: c0 2, c1 2, c2 3, c3 2, c4 1 -> growth c0 0, c1 .5, c2 .667, c3 1, c4 1
#  age = 2016 - first year: c0 4, c1 4, c2 3, c3 1, c4 1


def test_candidates_are_exactly_the_unlinked_pairs():
    _, df = table()
    assert set(df.index) == set(EXPECTED)


@pytest.mark.parametrize("pair", list(EXPECTED))
def test_every_feature_hand_computed(pair):
    _, df = table()
    row = df.loc[pair]
    for name, want in zip(C.FEATURES, EXPECTED[pair]):
        assert float(row[name]) == pytest.approx(float(want), abs=1e-5), f"{pair} {name}"


def test_concept_lands():
    fd = make_field()
    assert list(G.concept_land_at(fd, T2016)) == [0, 0, 0, 1, 1]


def test_labels():
    _, df = table()
    assert bool(df.loc[(2, 4), "label"]) is True
    assert df.loc[(2, 4), "label_paper"] == "P6"
    assert df.loc[(2, 4), "label_date"] == pd.Timestamp("2019-06-01")
    assert bool(df.loc[(2, 4), "label2"]) is False      # only one joint paper
    assert df.drop(index=(2, 4))["label"].sum() == 0
    # a second joint paper inside the window makes label2 true
    _, df2 = table(BASE + [("P7", "2021-01-01", [2, 4], 1)])
    assert bool(df2.loc[(2, 4), "label2"]) is True
    # outside the window: no label
    _, df3 = table(t_end=G.end_of_year(2018))
    assert bool(df3.loc[(2, 4), "label"]) is False


def test_label_columns_are_not_features():
    for bad in C.NOT_FEATURES:
        assert bad not in C.FEATURES


# ---------------------------------------------------------------------------
# No lookahead
# ---------------------------------------------------------------------------
def test_future_edges_not_in_snapshot():
    fd = make_field()
    alive = G.alive_mask(fd, T2016, **LOOSE)
    A, _ = G.snapshot(fd, T2016, alive)
    coo = A.tocoo()
    dates = fd.edges.set_index(["u", "v"])["first_date"]
    for a, b in zip(coo.row, coo.col):
        assert dates[(min(a, b), max(a, b))] <= T2016
    assert A.nnz // 2 == 5


def test_planted_paper_one_day_after_cutoff_changes_nothing():
    """A paper dated 2017-01-01 (one day after the cutoff) linking 0 and 4, plus
    papers that would make concept 4 a hub, must not change any feature."""
    _, before = table()
    planted = BASE + [("PX", "2017-01-01", [0, 4], 0), ("PY", "2017-01-01", [4, 1], 0)]
    _, after = table(planted)
    pd.testing.assert_frame_equal(before[C.FEATURES], after[C.FEATURES])


def test_alive_needs_enough_papers_by_the_cutoff():
    """Survivorship: concept 4 has 1 paper by 2016. With min_papers=2 it is not alive,
    even if many later papers would push it over the threshold."""
    future = BASE + [(f"F{i}", "2020-01-01", [4, 0], 0) for i in range(10)]
    fd = make_field(future)
    alive = G.alive_mask(fd, T2016, min_papers=2, max_share=1.0)
    assert list(alive) == [True, True, True, True, False]
    df = G.features_at(fd, T2016, T_END, min_papers=2, max_share=1.0)
    assert not ((df["u"] == 4) | (df["v"] == 4)).any()


def test_hub_concepts_are_removed():
    """Concept 2 is in 3 of 5 papers by 2016 (60%) -> not alive with max_share 0.5."""
    fd = make_field()
    assert list(G.alive_mask(fd, T2016, min_papers=1, max_share=0.5)) == [True, True, False, True, True]


def test_medicine_clustering_only_sees_papers_before_cutoff(monkeypatch):
    seen = {}

    def fake_cluster(pc, **kw):
        seen["papers"] = set(pc["paper_id"])
        return pd.Series(0, index=pc["paper_id"].unique())

    monkeypatch.setattr(G, "cluster_papers", fake_cluster)
    fd = make_field(field="medicine")
    G.concept_land_at(fd, T2016, med_params={"resolution": 1.0})
    assert seen["papers"] == {"P1", "P2", "P3", "P4", "P5"}       # not P6 (2019)


# ---------------------------------------------------------------------------
# Correctness against networkx on a bigger random graph (and across blocks)
# ---------------------------------------------------------------------------
def test_pair_features_match_networkx():
    rng = np.random.default_rng(0)
    rows = []
    for i in range(120):
        cs = sorted(rng.choice(30, size=rng.integers(2, 5), replace=False).tolist())
        rows.append((f"R{i}", f"20{10 + i % 7}-03-01", cs, 0))
    papers = pd.DataFrame({"paper_id": [r[0] for r in rows], "date": pd.to_datetime([r[1] for r in rows]),
                           "land": 0})
    pc = pd.DataFrame([(r[0], c) for r in rows for c in r[2]], columns=["paper_id", "concept_id"])
    fd = G.FieldData(papers, pd.DataFrame({"concept_id": range(30), "phrase": [str(i) for i in range(30)]}),
                     pc, "quant")
    alive = G.alive_mask(fd, T2016, **LOOSE)
    A, deg = G.snapshot(fd, T2016, alive)
    df = G.unlinked_pair_features(A, deg, alive, block=7)     # small blocks: test the blocking
    g = nx.Graph()
    g.add_nodes_from(np.flatnonzero(alive).tolist())
    coo = A.tocoo()
    g.add_edges_from(zip(coo.row.tolist(), coo.col.tolist()))
    pairs = list(zip(df["u"].tolist(), df["v"].tolist()))
    assert len(pairs) == len(list(nx.non_edges(g)))
    ref = {
        "cn": [len(list(nx.common_neighbors(g, u, v))) for u, v in pairs],
        "jaccard": [s for *_, s in nx.jaccard_coefficient(g, pairs)],
        "aa": [s for *_, s in nx.adamic_adar_index(g, pairs)],
        "ra": [s for *_, s in nx.resource_allocation_index(g, pairs)],
        "pa": [s for *_, s in nx.preferential_attachment(g, pairs)],
    }
    for col, want in ref.items():
        np.testing.assert_allclose(df[col].to_numpy(dtype=float), want, rtol=1e-5, atol=1e-6, err_msg=col)


# ---------------------------------------------------------------------------
# No cross-field pairs
# ---------------------------------------------------------------------------
def test_no_cross_field_pairs_toy():
    """Two fields built separately: every candidate's concepts appear in that field's papers."""
    med = make_field([r for r in BASE if r[0] in {"P1", "P2", "P3"}], field="medicine")
    qua = make_field([r for r in BASE if r[0] in {"P4", "P5", "P6"}], field="quant")
    for fd in (med, qua):
        df = G.features_at(fd, T2016, T_END, **LOOSE)
        used = set(fd.pc["concept_id"])
        assert set(df["u"]) | set(df["v"]) <= used


REAL = ROOT / "data" / "processed"


@pytest.mark.skipif(not (REAL / "quant" / "papers.parquet").exists(), reason="run pipeline/prepare.py first")
def test_real_fields_are_disjoint():
    q = set(pd.read_parquet(REAL / "quant" / "papers.parquet")["paper_id"])
    m = set(pd.read_parquet(REAL / "medicine" / "papers.parquet")["paper_id"])
    assert not (q & m), "a paper is in both fields"


WEB = ROOT / "web" / "public" / "data"


@pytest.mark.skipif(not (WEB / "fields.json").exists(), reason="run pipeline/export_web.py first")
def test_exported_gaps_are_within_field():
    for field in C.FIELDS:
        concepts = json.loads((WEB / field / "concepts.json").read_text())
        ids = {c["id"] for c in concepts}
        for f in (WEB / field).glob("land_*.json"):
            land = json.loads(f.read_text())
            for gap in land["gaps"]:
                assert gap["u"] in ids and gap["v"] in ids, f"cross-field gap in {f.name}"
                assert gap["field"] == field
