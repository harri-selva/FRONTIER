"""
Train and backtest a basic FRONTIER model on the synthetic data.

  TRAIN: features_2013_h3  -> graph as of end-2013, label = pair first meets in 2014-2016
  TEST : features_2016_h9  -> graph as of end-2016, label = pair first meets in 2017-2025

The test window starts after the training labels end, so this is an honest
"pretend it's 2016 and predict the future" backtest. The test file is never
used during training.

Run from the project root:  python src/train_basic.py
"""

import json
import sys
import warnings
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parent))
import b1_pipeline as b1  # noqa: E402

DATA_DIR = Path("data/synthetic")
OUT_DIR = Path("outputs")
SEED = 0
NEG_PER_POS = 10
P_2HOP, N_FAR = 1.0, 5_000


def feature_columns(df):
    """Every column except the IDs and the answer-key columns."""
    cols = [c for c in df.columns if c not in b1.NOT_FEATURES]
    for bad in b1.NOT_FEATURES:
        assert bad not in cols, f"{bad} must never be a feature"
    return cols


def evaluate(scores, labels):
    """Ranking metrics: sort pairs by score (highest first) and look at the top."""
    labels = np.asarray(labels, dtype=bool)
    order = np.argsort(-np.asarray(scores), kind="stable")
    ranked = labels[order]
    base = labels.mean()
    p20, p100 = ranked[:20].mean(), ranked[:100].mean()
    return {
        "base_rate": float(base),
        "precision@20": float(p20),
        "precision@100": float(p100),
        "auc": float(roc_auc_score(labels, scores)),
        "lift@100": float(p100 / base) if base > 0 else float("nan"),
    }


def main():
    rng = np.random.default_rng(SEED)
    if not (DATA_DIR / "papers.parquet").exists():
        sys.exit("No synthetic data. Run:  python data/make_synthetic.py")

    # ---- 1. build the two feature files -------------------------------------
    train = b1.build(2013, 3, P_2HOP, N_FAR, DATA_DIR, OUT_DIR, seed=SEED)
    test = b1.build(2016, 9, P_2HOP, N_FAR, DATA_DIR, OUT_DIR, seed=SEED + 1)
    feats = feature_columns(train)
    assert feats == feature_columns(test)
    print(f"\nFeatures ({len(feats)}): {feats}")

    # ---- 2. training set: all positives + 10 negatives per positive ---------
    pos = train[train["label"]]
    neg = train[~train["label"]]
    neg = neg.sample(n=min(len(neg), NEG_PER_POS * len(pos)), random_state=SEED)
    tr = pd.concat([pos, neg]).sample(frac=1.0, random_state=SEED)  # shuffle
    X = tr[feats].astype(float)
    y = tr["label"].astype(int)
    X_fit, X_val, y_fit, y_val = train_test_split(X, y, test_size=0.2, stratify=y, random_state=SEED)
    print(f"Training rows: {len(tr):,} ({len(pos):,} positives)  "
          f"fit {len(X_fit):,} / early-stopping holdout {len(X_val):,}")

    # ---- 3. LightGBM with early stopping on the 20% holdout -----------------
    model = lgb.LGBMClassifier(n_estimators=2000, learning_rate=0.03, num_leaves=15,
                               min_child_samples=20, subsample=0.8, subsample_freq=1,
                               colsample_bytree=0.8, random_state=SEED, verbose=-1)
    with warnings.catch_warnings():
        # LightGBM 4.7 renamed eval_set -> eval_X/eval_y; eval_set still works and
        # keeps this script compatible with older LightGBM versions.
        warnings.simplefilter("ignore", category=FutureWarning)
        warnings.filterwarnings("ignore", message=".*eval_set.*")
        model.fit(X_fit, y_fit, eval_set=[(X_val, y_val)], eval_metric="auc",
                  callbacks=[lgb.early_stopping(100, verbose=False)])
    print(f"Early stopping chose {model.best_iteration_} trees")

    # ---- 4. score the FULL test file: model + 3 baselines --------------------
    y_test = test["label"].to_numpy()
    jitter = lambda: rng.uniform(0, 1e-6, len(test))  # breaks ties randomly  # noqa: E731
    scores = {
        "model (LightGBM)": model.predict_proba(test[feats].astype(float))[:, 1],
        "random": rng.random(len(test)),
        "pref. attachment": test["pa"].to_numpy(float) + jitter(),
        "common neighbours": test["cn"].to_numpy(float) + jitter(),
    }
    metrics = {name: evaluate(s, y_test) for name, s in scores.items()}

    print(f"\n=== Backtest on features_2016_h9: {len(test):,} pairs, "
          f"{int(y_test.sum()):,} became linked in 2017-2025 ===")
    print(f"{'method':<20}{'base rate':>10}{'P@20':>8}{'P@100':>8}{'AUC':>8}{'lift@100':>10}")
    for name, m in metrics.items():
        print(f"{name:<20}{m['base_rate']:>10.3f}{m['precision@20']:>8.2f}"
              f"{m['precision@100']:>8.2f}{m['auc']:>8.3f}{m['lift@100']:>10.1f}")

    imp = pd.Series(model.booster_.feature_importance("gain"), index=feats)
    imp = (imp / imp.sum()).sort_values(ascending=False)
    print("\nFeature importance (share of total gain):")
    for f, v in imp.items():
        print(f"  {f:<12} {v:6.1%}  {'#' * int(round(v * 50))}")

    # ---- 5. top 10 predictions with names --------------------------------
    concepts = b1.load_concepts(DATA_DIR).set_index("concept_id")["phrase"]
    top = test.assign(score=scores["model (LightGBM)"]).nlargest(10, "score")
    print("\nTop 10 predicted new pairs (as of end-2016):")
    for _, r in top.iterrows():
        hit = f"HIT {r['label_date'].date()} ({r['label_paper']})" if r["label"] else "miss"
        print(f"  {r['score']:.3f}  {concepts[r['u']]:<24} + {concepts[r['v']]:<24} {hit}")

    OUT_DIR.mkdir(exist_ok=True)
    out = {"metrics": metrics, "feature_importance": imp.round(4).to_dict(),
           "best_iteration": int(model.best_iteration_),
           "n_train_rows": int(len(tr)), "n_test_rows": int(len(test))}
    (OUT_DIR / "metrics.json").write_text(json.dumps(out, indent=2))
    print(f"\nSaved {OUT_DIR / 'metrics.json'}")


if __name__ == "__main__":
    main()
