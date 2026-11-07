"""
Tests on the hand-made toy dataset. Run from the project root with:  pytest -v

Every test writes into pytest's `tmp_path` (a fresh temporary folder), so no
real files are overwritten.
"""

import sys
from pathlib import Path

import networkx as nx
import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "data"))

import b1_pipeline as b1          # noqa: E402
from make_toy import PAPERS, write_dataset  # noqa: E402

YEAR, HORIZON = 2016, 9


@pytest.fixture
def toy(tmp_path):
    """Write toy data to a temp folder, build the 2016 features, return everything."""
    data_dir = write_dataset(tmp_path / "data")
    df = b1.build(YEAR, HORIZON, p_2hop=1.0, n_far=10, data_dir=data_dir, out_dir=tmp_path / "out")
    edges, _ = b1.build_edges(data_dir)
    concepts = b1.load_concepts(data_dir)
    A, deg, alive = b1.snapshot(edges, concepts, b1.end_of_year(YEAR))
    return dict(df=df, edges=edges, A=A, deg=deg, alive=alive,
                data_dir=data_dir, tmp=tmp_path)


def row(df, u, v):
    r = df[(df["u"] == u) & (df["v"] == v)]
    assert len(r) == 1, f"pair ({u},{v}) should appear exactly once, found {len(r)}"
    return r.iloc[0]


def test_edge_counts(toy):
    assert len(toy["edges"]) == 6
    assert toy["A"].nnz // 2 == 5          # symmetric matrix stores each edge twice


def test_saved_file(toy):
    assert (toy["tmp"] / "out" / "features_2016_h9.parquet").exists()


def test_pair_2_4(toy):
    r = row(toy["df"], 2, 4)
    expected = dict(cn=1, jaccard=0.333, aa=1.443, ra=0.5, pa=3, deg_min=1, deg_max=3,
                    recent_min=1, recent_max=2, growth_min=0.667, growth_max=1.0,
                    age_min=1, age_max=3)
    for k, val in expected.items():
        assert r[k] == pytest.approx(val, abs=1e-3), k
    assert r["label"] == True  # noqa: E712
    assert r["label_paper"] == "P6"
    assert r["label_date"] == pd.Timestamp("2019-06-01")


def test_pair_0_3(toy):
    r = row(toy["df"], 0, 3)
    expected = dict(cn=1, jaccard=0.333, aa=0.910, ra=0.333, pa=4,
                    recent_min=0, recent_max=2, growth_min=0, growth_max=1.0,
                    age_min=1, age_max=4)
    for k, val in expected.items():
        assert r[k] == pytest.approx(val, abs=1e-3), k
    assert r["label"] == False  # noqa: E712


def test_no_lookahead_in_snapshot(toy):
    """Every edge stored in the 2016 matrix must have first_date <= cutoff."""
    t = b1.end_of_year(YEAR)
    coo = toy["A"].tocoo()
    in_snapshot = {(min(a, b), max(a, b)) for a, b in zip(coo.row, coo.col)}
    dates = toy["edges"].set_index(["u", "v"])["first_date"]
    for pair in in_snapshot:
        assert dates[pair] <= t, f"edge {pair} dated {dates[pair]} leaked into the {YEAR} snapshot"
    # and the reverse: every edge dated <= t is present
    assert in_snapshot == set(dates[dates <= t].index)


def test_candidates_are_unlinked_and_ordered(toy):
    df = toy["df"]
    assert (df["u"] < df["v"]).all()
    assert not df.duplicated(["u", "v"]).any()
    assert (np.asarray(toy["A"][df["u"].to_numpy(), df["v"].to_numpy()]).ravel() == 0).all()


def test_planted_future_paper_changes_nothing(toy):
    """Add a paper dated 2017 (after the cutoff). The 2016 features must not move."""
    planted = PAPERS + [("P_FAKE", "2017-01-01", [0, 4])]
    data2 = write_dataset(toy["tmp"] / "data_planted", papers=planted)
    df2 = b1.build(YEAR, HORIZON, p_2hop=1.0, n_far=10, data_dir=data2,
                   out_dir=toy["tmp"] / "out_planted")
    cols = ["u", "v"] + b1.FEATURE_COLUMNS
    a = toy["df"][cols].sort_values(["u", "v"]).reset_index(drop=True)
    b = df2[cols].sort_values(["u", "v"]).reset_index(drop=True)
    pd.testing.assert_frame_equal(a, b)


def test_matches_networkx(toy):
    """Our numbers must equal networkx's reference implementations."""
    coo = toy["A"].tocoo()
    G = nx.Graph()
    G.add_nodes_from(range(toy["A"].shape[0]))
    G.add_edges_from(zip(coo.row.tolist(), coo.col.tolist()))
    df = toy["df"]
    pairs = list(zip(df["u"].tolist(), df["v"].tolist()))

    nx_vals = {
        "cn": [len(list(nx.common_neighbors(G, u, v))) for u, v in pairs],
        "jaccard": [s for _, _, s in nx.jaccard_coefficient(G, pairs)],
        "aa": [s for _, _, s in nx.adamic_adar_index(G, pairs)],
        "ra": [s for _, _, s in nx.resource_allocation_index(G, pairs)],
        "pa": [s for _, _, s in nx.preferential_attachment(G, pairs)],
    }
    for col, ref in nx_vals.items():
        np.testing.assert_allclose(df[col].to_numpy(dtype=float), ref, atol=1e-9, err_msg=col)
