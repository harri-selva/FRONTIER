"""
FRONTIER - Person B: link prediction, backtest, and export for the website.

Input:  paper_concepts.parquet from frontier_data.py (id, year, primary_cat, concepts)
Output: web/public/data/forecasts.json (read by the website)

Concepts are nodes. Two concepts are linked once a paper mentions both.
A "research gap" is a pair of concepts that have never been linked but that
the model expects to link soon.

How the backtest avoids lookahead:
  train  features from papers <= T1,  labels = first link in (T1, T2]
  test   features from papers <= T2,  labels = first link in (T2, END]
Nothing after T2 is used to build test features, and the model is never tuned
on test results. Candidates are 2-hop pairs (share at least one neighbour).

The live forecast repeats the same recipe shifted to the latest data:
features <= END - H, labels in (END - H, END], then score pairs on the full
graph <= END to rank gaps that have not happened yet.

Example:
  python pipeline/frontier_model.py --concepts data/paper_concepts.parquet \
      --t1 2013 --t2 2016 --end 2025 --out web/public/data/forecasts.json

Install:
  pip install pandas pyarrow numpy scipy scikit-learn   (lightgbm optional)
"""

import argparse
import json
from datetime import date, datetime, timezone
from itertools import combinations

import numpy as np
import pandas as pd
import scipy.sparse as sp
from sklearn.metrics import roc_auc_score

FEATURES = ["cn", "jaccard", "adamic_adar", "resource_alloc", "pref_attach",
            "deg_min", "deg_max", "growth_min", "growth_max", "age_min", "age_max"]

# arXiv category prefix -> website field. First match wins.
FIELD_RULES = [
    ("q-fin", "quant"),
    ("q-bio", "medicine"),
    ("physics.med-ph", "medicine"),
    ("physics.bio-ph", "medicine"),
    ("cs", "ml"),
    ("stat", "ml"),
]
FIELDS = {
    "medicine": {"name": "Medicine & Biology", "color": "#ff6b8b"},
    "quant": {"name": "Quantitative Finance", "color": "#ffc04d"},
    "ml": {"name": "Machine Learning", "color": "#5cc8ff"},
    "physics": {"name": "Physics & Other", "color": "#a98bff"},
}


def field_of(cat: str) -> str:
    for prefix, field in FIELD_RULES:
        if cat.startswith(prefix):
            return field
    return "physics"


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def load(path: str, max_concepts: int, max_per_paper: int):
    df = pd.read_parquet(path, columns=["year", "primary_cat", "concepts"])
    df = df[df["concepts"].map(len) > 0].reset_index(drop=True)

    exploded = df[["year", "primary_cat", "concepts"]].explode("concepts")
    counts = exploded["concepts"].value_counts()
    keep = counts.index[:max_concepts]
    names = list(keep)
    index = {c: i for i, c in enumerate(names)}

    exploded = exploded[exploded["concepts"].isin(index)]
    first_year = exploded.groupby("concepts")["year"].min()
    fields = (exploded.assign(field=exploded["primary_cat"].map(field_of))
              .groupby("concepts")["field"].agg(lambda s: s.value_counts().index[0]))

    concepts = pd.DataFrame({
        "id": range(len(names)),
        "name": names,
        "papers": [int(counts[c]) for c in names],
        "first_year": [int(first_year[c]) for c in names],
        "field": [fields[c] for c in names],
    })

    # Edge list: (i, j, year) for every co-mention, keeping the earliest year.
    first_link = {}
    for year, cs in zip(df["year"], df["concepts"]):
        ids = sorted({index[c] for c in cs if c in index})
        if len(ids) < 2 or len(ids) > max_per_paper:   # huge lists are noise
            continue
        for i, j in combinations(ids, 2):
            prev = first_link.get((i, j))
            if prev is None or year < prev:
                first_link[(i, j)] = int(year)
    edges = pd.DataFrame([(i, j, y) for (i, j), y in first_link.items()],
                         columns=["i", "j", "year"])
    print(f"{len(df):,} papers, {len(concepts):,} concepts, {len(edges):,} first links")
    return concepts, edges


def adjacency(edges: pd.DataFrame, n: int, upto: int) -> sp.csr_matrix:
    e = edges[edges["year"] <= upto]
    data = np.ones(len(e) * 2, dtype=np.float32)
    rows = np.concatenate([e["i"].values, e["j"].values])
    cols = np.concatenate([e["j"].values, e["i"].values])
    return sp.csr_matrix((data, (rows, cols)), shape=(n, n))


# ---------------------------------------------------------------------------
# Features
# ---------------------------------------------------------------------------

def candidates(A: sp.csr_matrix, max_pairs: int, seed: int = 0):
    """Unlinked 2-hop pairs (i < j). Subsampled uniformly if there are too many."""
    A2 = sp.triu(A @ A, k=1).tocsr()
    A2 = A2 - A2.multiply(A)              # drop pairs already linked
    A2.eliminate_zeros()
    coo = A2.tocoo()
    i, j = coo.row.astype(np.int64), coo.col.astype(np.int64)
    total = len(i)
    if max_pairs and total > max_pairs:
        pick = np.random.default_rng(seed).choice(total, max_pairs, replace=False)
        i, j = i[pick], j[pick]
    return i, j, total


def pair_values(M: sp.csr_matrix, i, j) -> np.ndarray:
    return np.asarray(M[i, j]).ravel().astype(np.float64)


def features(A, A_prev, concepts, cutoff, i, j) -> pd.DataFrame:
    deg = np.asarray(A.sum(axis=1)).ravel()
    deg_prev = np.asarray(A_prev.sum(axis=1)).ravel()
    growth = deg - deg_prev
    with np.errstate(divide="ignore"):
        inv_log = np.where(deg > 1, 1.0 / np.log(np.maximum(deg, 2)), 0.0)
        inv = np.where(deg > 0, 1.0 / np.maximum(deg, 1), 0.0)
    cn = pair_values(A @ A, i, j)
    aa = pair_values(A @ sp.diags(inv_log) @ A, i, j)
    ra = pair_values(A @ sp.diags(inv) @ A, i, j)
    di, dj = deg[i], deg[j]
    age = np.maximum(cutoff - concepts["first_year"].values, 0)
    return pd.DataFrame({
        "cn": cn,
        "jaccard": cn / np.maximum(di + dj - cn, 1),
        "adamic_adar": aa,
        "resource_alloc": ra,
        "pref_attach": di * dj,
        "deg_min": np.minimum(di, dj),
        "deg_max": np.maximum(di, dj),
        "growth_min": np.minimum(growth[i], growth[j]),
        "growth_max": np.maximum(growth[i], growth[j]),
        "age_min": np.minimum(age[i], age[j]),
        "age_max": np.maximum(age[i], age[j]),
    })


def labels(edges: pd.DataFrame, n: int, start: int, end: int, i, j) -> np.ndarray:
    """1 if the pair first links in (start, end]."""
    e = edges[(edges["year"] > start) & (edges["year"] <= end)]
    keys = set((e["i"].values * n + e["j"].values).tolist())
    return np.fromiter((k in keys for k in (i * n + j).tolist()), dtype=np.int8, count=len(i))


def build_set(edges, concepts, cutoff, horizon_end, growth_window, max_pairs, seed):
    n = len(concepts)
    A = adjacency(edges, n, cutoff)
    A_prev = adjacency(edges, n, cutoff - growth_window)
    i, j, total = candidates(A, max_pairs, seed)
    X = features(A, A_prev, concepts, cutoff, i, j)
    y = labels(edges, n, cutoff, horizon_end, i, j) if horizon_end else None
    return A, i, j, X, y, total


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

def make_model():
    try:
        import lightgbm as lgb
        return lgb.LGBMClassifier(n_estimators=300, learning_rate=0.05, num_leaves=31,
                                  min_child_samples=50, subsample=0.8, subsample_freq=1,
                                  colsample_bytree=0.8, verbose=-1), "lightgbm"
    except ImportError:
        from sklearn.ensemble import HistGradientBoostingClassifier
        return HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05,
                                              min_samples_leaf=50), "sklearn-hgb"


def fit(X, y, neg_ratio: int, seed: int):
    """Train on all positives plus a sample of negatives (training only)."""
    pos = np.flatnonzero(y == 1)
    neg = np.flatnonzero(y == 0)
    if len(pos) == 0:
        raise SystemExit("No positive training pairs - widen the label window.")
    rng = np.random.default_rng(seed)
    neg = rng.choice(neg, min(len(neg), len(pos) * neg_ratio), replace=False)
    idx = np.concatenate([pos, neg])
    model, kind = make_model()
    model.fit(X.iloc[idx][FEATURES], y[idx])
    return model, kind


def importance(model) -> dict:
    imp = getattr(model, "feature_importances_", None)
    if imp is None:
        return {}
    imp = np.asarray(imp, dtype=float)
    imp = imp / imp.sum() if imp.sum() else imp
    return {f: round(float(v), 4) for f, v in zip(FEATURES, imp)}


def precision_at(scores, y, ks):
    order = np.argsort(-scores, kind="stable")
    return [float(y[order[:k]].mean()) if k <= len(y) else None for k in ks]


# ---------------------------------------------------------------------------
# Export helpers
# ---------------------------------------------------------------------------

def bridges(A: sp.csr_matrix, i: int, j: int, deg, top: int = 3):
    ni = set(A.indices[A.indptr[i]:A.indptr[i + 1]].tolist())
    nj = set(A.indices[A.indptr[j]:A.indptr[j + 1]].tolist())
    common = sorted(ni & nj, key=lambda k: deg[k])   # rarer shared neighbours = more specific
    return [int(k) for k in common[:top]]


def brief(a, b, bridge_names, cn, end_year):
    via = ", ".join(bridge_names) if bridge_names else "indirect neighbours"
    return (f"Speculative. No abstract up to {end_year} mentions both \"{a}\" and \"{b}\", "
            f"yet they share {int(cn)} neighbouring concepts (e.g. {via}). "
            f"Ranked by a model backtested out-of-sample; check prior work before relying on it.")


# ---------------------------------------------------------------------------

def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--concepts", default="data/paper_concepts.parquet")
    p.add_argument("--t1", type=int, default=2013, help="train feature cutoff")
    p.add_argument("--t2", type=int, default=2016, help="test feature cutoff")
    p.add_argument("--end", type=int, default=2025, help="last year of data")
    p.add_argument("--horizon", type=int, default=3, help="years ahead for live forecast")
    p.add_argument("--growth-window", type=int, default=3)
    p.add_argument("--max-concepts", type=int, default=4000)
    p.add_argument("--max-per-paper", type=int, default=40)
    p.add_argument("--max-pairs", type=int, default=2_000_000)
    p.add_argument("--neg-ratio", type=int, default=20)
    p.add_argument("--top", type=int, default=300, help="gaps to export")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--out", default="web/public/data/forecasts.json")
    a = p.parse_args()
    if not (a.t1 < a.t2 < a.end):
        raise SystemExit("Need t1 < t2 < end.")

    concepts, edges = load(a.concepts, a.max_concepts, a.max_per_paper)
    n = len(concepts)
    ks = [10, 50, 100, 500, 1000]

    # ---- backtest ----
    _, _, _, Xtr, ytr, _ = build_set(edges, concepts, a.t1, a.t2, a.growth_window,
                                     a.max_pairs, a.seed)
    model, kind = fit(Xtr, ytr, a.neg_ratio, a.seed)
    _, _, _, Xte, yte, total_te = build_set(edges, concepts, a.t2, a.end, a.growth_window,
                                            a.max_pairs, a.seed + 1)
    s_model = model.predict_proba(Xte[FEATURES])[:, 1]
    s_pop = Xte["pref_attach"].values
    s_rand = np.random.default_rng(a.seed).random(len(yte))
    base = float(yte.mean())
    bt = {
        "train": f"features <= {a.t1}, labels {a.t1 + 1}-{a.t2}",
        "test": f"features <= {a.t2}, labels {a.t2 + 1}-{a.end}",
        "model": kind,
        "candidates": int(total_te),
        "evaluated": int(len(yte)),
        "positives": int(yte.sum()),
        "base_rate": base,
        "k": ks,
        "precision": {
            "model": precision_at(s_model, yte, ks),
            "popularity": precision_at(s_pop, yte, ks),
            "random": precision_at(s_rand, yte, ks),
        },
        "auc": {},
        "importance": importance(model),
    }
    if 0 < yte.sum() < len(yte):
        bt["auc"] = {"model": float(roc_auc_score(yte, s_model)),
                     "popularity": float(roc_auc_score(yte, s_pop))}
    print(f"Backtest base rate {base:.4%}; precision@100 model "
          f"{bt['precision']['model'][2]} vs popularity {bt['precision']['popularity'][2]}")

    # ---- live forecast (same recipe, shifted to latest data) ----
    shift = a.end - a.horizon
    _, _, _, Xl, yl, _ = build_set(edges, concepts, shift, a.end, a.growth_window,
                                   a.max_pairs, a.seed + 2)
    live_model, _ = fit(Xl, yl, a.neg_ratio, a.seed)
    A, i, j, Xf, _, _ = build_set(edges, concepts, a.end, None, a.growth_window,
                                  a.max_pairs, a.seed + 3)
    s = live_model.predict_proba(Xf[FEATURES])[:, 1]
    order = np.argsort(-s, kind="stable")[:a.top]
    deg = np.asarray(A.sum(axis=1)).ravel()
    names = concepts["name"].tolist()
    gaps = []
    for r in order:
        ci, cj = int(i[r]), int(j[r])
        br = bridges(A, ci, cj, deg)
        gaps.append({
            "a": ci, "b": cj,
            "score": round(float(s[r]), 4),
            "cn": int(Xf["cn"].iat[r]),
            "adamic_adar": round(float(Xf["adamic_adar"].iat[r]), 3),
            "pref_attach": int(Xf["pref_attach"].iat[r]),
            "growth": int(Xf["growth_min"].iat[r] + Xf["growth_max"].iat[r]),
            "bridges": br,
            "brief": brief(names[ci], names[cj], [names[k] for k in br], Xf["cn"].iat[r], a.end),
        })

    used_fields = sorted(set(concepts["field"]))
    out = {
        "meta": {
            "demo": False,
            "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "data_end": a.end,
            "horizon": f"{a.end + 1}-{a.end + a.horizon}",
            "source": "arXiv metadata snapshot",
            "n_concepts": n,
            "n_links": int(len(edges)),
        },
        "fields": [{"id": f, **FIELDS[f]} for f in used_fields],
        "concepts": concepts.to_dict(orient="records"),
        "gaps": gaps,
        "backtest": bt,
    }
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"))
    print(f"Wrote {len(gaps)} gaps to {a.out} ({date.today()})")


if __name__ == "__main__":
    main()
