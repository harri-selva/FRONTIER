"""
Step 3: the backtest. "Pretend it is <cutoff>. Which unlinked pairs would we have
flagged as gaps, and how many were actually filled later?"

For each field separately:
  MAIN        features at end of 2018, label = first joint paper 2019-01-01 .. end of data
  ROBUSTNESS  cutoffs 2014, 2016, 2018, 2020, each with a fixed 4-year window

Rankers compared on EVERY unlinked pair of alive concepts (no sampling):
  resource_allocation (our gap score) | random | preferential_attachment |
  common_neighbours | lightgbm (trained at cutoff-4 on labels up to the cutoff)

Every run is appended to runs.csv with the git commit and a hash of config.py.
Settings are frozen in config.py; do not change them after looking at results.

Run:  python pipeline/backtest.py
"""
import hashlib
import json
import subprocess
import sys
import time
import warnings
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config as C  # noqa: E402
import graph as G   # noqa: E402

MED_PARAMS = dict(resolution=C.MED_CLUSTER_RESOLUTION, min_land_papers=C.MED_MIN_LAND_PAPERS,
                  seed=C.SEED, max_lands=C.MED_MAX_LANDS)
RANKERS = ["resource_allocation", "lightgbm", "preferential_attachment", "common_neighbours", "random"]
DATA_END = pd.Timestamp(C.DATA_END) + pd.Timedelta(days=1) - pd.Timedelta(microseconds=1)


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------
def wilson(hits: int, n: int, z: float = 1.96):
    """95% confidence interval for a proportion (better than +-2se for small n)."""
    if n == 0:
        return (float("nan"), float("nan"))
    p = hits / n
    den = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / den
    half = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return (max(0.0, centre - half), min(1.0, centre + half))


def metrics(scores: np.ndarray, y: np.ndarray, u=None, v=None) -> dict:
    y = np.asarray(y, dtype=bool)
    order = np.argsort(-scores, kind="stable")
    ranked = y[order]
    base = float(y.mean())
    out = {"n_pairs": int(len(y)), "n_pos": int(y.sum()), "base_rate": base}
    for k in C.TOP_K:
        k_ = min(k, len(y))
        h = int(ranked[:k_].sum())
        lo, hi = wilson(h, k_)
        out[f"p@{k}"] = h / k_ if k_ else float("nan")
        out[f"p@{k}_lo"], out[f"p@{k}_hi"] = lo, hi
    out["auc"] = float(roc_auc_score(y, scores)) if 0 < y.sum() < len(y) else float("nan")
    out["lift@100"] = out["p@100"] / base if base > 0 else float("nan")
    if u is not None:   # how dominated is the top-100 by one concept?
        top = order[:100]
        c = pd.Series(np.r_[u[top], v[top]]).value_counts()
        out["top100_max_concept_share"] = float(c.iloc[0] / len(top)) if len(c) else 0.0
    return out


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------
def feature_matrix(df):
    cols = list(C.FEATURES)
    for bad in C.NOT_FEATURES:
        assert bad not in cols, f"{bad} must never be a feature"
    return df[cols].astype(np.float32)


def train_lgbm(train: pd.DataFrame, seed: int):
    pos = train[train["label"]]
    if len(pos) < 20:
        return None, {"train_pos": int(len(pos)), "note": "too few positives to train"}
    neg = train[~train["label"]].sample(n=min(int((~train["label"]).sum()), C.NEG_PER_POS * len(pos)),
                                        random_state=seed)
    tr = pd.concat([pos, neg]).sample(frac=1.0, random_state=seed)
    X, y = feature_matrix(tr), tr["label"].astype(int)
    X_fit, X_val, y_fit, y_val = train_test_split(X, y, test_size=C.HOLDOUT, stratify=y, random_state=seed)
    model = lgb.LGBMClassifier(**C.LGBM_PARAMS)
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", message=".*eval_set.*")
        warnings.simplefilter("ignore", FutureWarning)
        model.fit(X_fit, y_fit, eval_set=[(X_val, y_val)], eval_metric="auc",
                  callbacks=[lgb.early_stopping(C.EARLY_STOP, verbose=False)])
    imp = pd.Series(model.booster_.feature_importance("gain"), index=C.FEATURES)
    info = {"train_pos": int(len(pos)), "train_rows": int(len(tr)),
            "best_iteration": int(model.best_iteration_),
            "importance": (imp / max(imp.sum(), 1e-9)).round(4).to_dict()}
    return model, info


def score_all(test: pd.DataFrame, model, rng) -> dict:
    jit = lambda: rng.uniform(0, 1e-9, len(test))  # random tie-breaking  # noqa: E731
    s = {
        "resource_allocation": test["ra"].to_numpy(np.float64) + jit(),
        "preferential_attachment": test["pa"].to_numpy(np.float64) * (1 + jit()) + jit(),
        "common_neighbours": test["cn"].to_numpy(np.float64) + jit(),
        "random": rng.random(len(test)),
    }
    if model is not None:
        s["lightgbm"] = model.predict_proba(feature_matrix(test))[:, 1] + jit()
    return s


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
def run_context():
    cfg = (Path(__file__).parent / "config.py").read_bytes()
    try:
        commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True,
                                text=True, cwd=C.ROOT).stdout.strip()
        dirty = subprocess.run(["git", "status", "--porcelain", "pipeline/config.py"], capture_output=True,
                               text=True, cwd=C.ROOT).stdout.strip()
    except Exception:
        commit, dirty = "unknown", ""
    return {"timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"), "git_commit": commit + ("+dirty-config" if dirty else ""),
            "config_hash": hashlib.md5(cfg).hexdigest()[:10]}


def log_runs(rows):
    df = pd.DataFrame(rows)
    header = not C.RUNS_CSV.exists()
    df.to_csv(C.RUNS_CSV, mode="a", header=header, index=False)


# ---------------------------------------------------------------------------
# One evaluation
# ---------------------------------------------------------------------------
def evaluate(fd, cutoff_year: int, t_end, kind: str, ctx: dict, rng):
    t = G.end_of_year(cutoff_year)
    kw = dict(min_papers=C.MIN_PAPERS, max_share=C.MAX_SHARE, med_params=MED_PARAMS)
    test = G.features_at(fd, t, t_end, **kw)
    # LightGBM: trained strictly in the past (features at cutoff-4, labels up to the cutoff)
    t_tr = G.end_of_year(cutoff_year - C.TRAIN_GAP)
    train = G.features_at(fd, t_tr, t, **kw)
    assert train["label_date"].max() <= t if train["label"].any() else True, "training labels leak past cutoff"
    model, info = train_lgbm(train, C.SEED)
    scores = score_all(test, model, rng)

    u, v = test["u"].to_numpy(), test["v"].to_numpy()
    rows, res = [], {"cutoff": cutoff_year, "window_end": str(pd.Timestamp(t_end).date()), "kind": kind,
                     "train": info, "metrics": {}, "metrics_secondary": {}}
    for name in RANKERS:
        if name not in scores:
            continue
        for label_col, store in [("label", "metrics"), ("label2", "metrics_secondary")]:
            m = metrics(scores[name], test[label_col].to_numpy(), u, v)
            res[store][name] = m
            rows.append({**ctx, "field": fd.field, "kind": kind, "cutoff": cutoff_year,
                         "window_end": res["window_end"],
                         "label": "primary(>=1 joint paper)" if label_col == "label" else "secondary(>=2 joint papers)",
                         "ranker": name, **m})
    # sanity: RA against shuffled labels should be ~0.5
    sh = rng.permutation(test["label"].to_numpy())
    res["sanity_shuffled_auc_ra"] = float(roc_auc_score(sh, scores["resource_allocation"])) if sh.any() else None
    return test, scores, res, rows


def example_hits(fd, test, scores, cutoff_year, n_show=5, top=100):
    """Hits from RA's top-100 at the given cutoff, preferring varied concepts."""
    order = np.argsort(-scores["resource_allocation"], kind="stable")[:top]
    top_df = test.iloc[order].copy()
    top_df["rank"] = np.arange(1, len(top_df) + 1)
    hits = top_df[top_df["label"]]
    papers = fd.papers.set_index("paper_id")
    phrase = fd.concepts.set_index("concept_id")["phrase"]
    out, used = [], set()
    for _, r in hits.iterrows():
        if {r["u"], r["v"]} & used and len(hits) > n_show * 2:
            continue
        p = papers.loc[r["label_paper"]]
        out.append({
            "u": int(r["u"]), "v": int(r["v"]),
            "u_name": C.DISPLAY.get(phrase[r["u"]], phrase[r["u"]]),
            "v_name": C.DISPLAY.get(phrase[r["v"]], phrase[r["v"]]),
            "rank": int(r["rank"]), "ra": round(float(r["ra"]), 4), "cn": int(r["cn"]),
            "predicted_in": cutoff_year,
            "filled_date": str(pd.Timestamp(r["label_date"]).date()),
            "lead_time_years": round((pd.Timestamp(r["label_date"]) - G.end_of_year(cutoff_year)).days / 365.25, 1),
            "paper_id": r["label_paper"], "title": p["title"], "authors": p["authors"],
            "url": p["url"],
        })
        used |= {r["u"], r["v"]}
        if len(out) >= n_show:
            break
    # cumulative hits of the top-100 by year (for "this many were filled by <year>")
    yrs = pd.to_datetime(top_df.loc[top_df["label"], "label_date"]).dt.year
    by_year = {int(y): int((yrs <= y).sum()) for y in range(cutoff_year + 1, pd.Timestamp(C.DATA_END).year + 1)}
    return out, by_year


def main():
    ctx = run_context()
    if "dirty" in ctx["git_commit"]:
        print("WARNING: config.py has uncommitted changes. Commit (freeze) it before reporting results.")
    C.OUT.mkdir(exist_ok=True)
    for field in C.FIELDS:
        rng = np.random.default_rng(C.SEED)
        fd = G.load_field(field, C.PROC)
        result = {"field": field, "run": ctx}
        all_rows = []

        print(f"\n=== {C.FIELD_NAMES[field]}: MAIN cutoff {C.MAIN_CUTOFF} -> {C.DATA_END} ===")
        test, scores, res, rows = evaluate(fd, C.MAIN_CUTOFF, DATA_END, "main", ctx, rng)
        all_rows += rows
        result["main"] = res
        result["examples"], result["top100_filled_by_year"] = example_hits(fd, test, scores, C.MAIN_CUTOFF)
        print_table(res)

        result["robustness"] = []
        for c in C.ROBUST_CUTOFFS:
            t_end = G.end_of_year(c + C.ROBUST_WINDOW)
            print(f"--- robustness cutoff {c} -> {t_end.date()}")
            _, _, r, rows = evaluate(fd, c, t_end, "robustness", ctx, rng)
            all_rows += rows
            result["robustness"].append(r)
            print_table(r, brief=True)

        log_runs(all_rows)
        (C.OUT / f"backtest_{field}.json").write_text(json.dumps(result, indent=2, default=str))
        print(f"wrote outputs/backtest_{field}.json")


def print_table(res, brief=False):
    m = res["metrics"]
    print(f"  pairs {m['random']['n_pairs']:,}  filled {m['random']['n_pos']:,}  base rate {m['random']['base_rate']:.4f}"
          f"  | LightGBM trained on {res['train'].get('train_pos', 0)} positives")
    print(f"  {'ranker':<24}{'P@20':>7}{'P@100':>7}{'  95% CI':>14}{'P@1000':>8}{'AUC':>7}{'lift@100':>9}")
    for name, x in m.items():
        print(f"  {name:<24}{x['p@20']:>7.2f}{x['p@100']:>7.2f}   [{x['p@100_lo']:.2f}-{x['p@100_hi']:.2f}]"
              f"{x['p@1000']:>8.3f}{x['auc']:>7.3f}{x['lift@100']:>9.1f}")
    if not brief:
        s = res["metrics_secondary"]
        print("  secondary label (>= 2 joint papers): " + ", ".join(
            f"{k} P@100={x['p@100']:.2f} AUC={x['auc']:.3f}" for k, x in s.items()))
        print(f"  sanity: RA vs shuffled labels AUC = {res['sanity_shuffled_auc_ra']:.3f}")


if __name__ == "__main__":
    main()
