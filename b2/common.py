"""Shared helpers: load + check files, train, score, evaluate."""
import json

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
from sklearn.metrics import average_precision_score, roc_auc_score

import config as C


# ----------------------------------------------------------------- loading --

def load_features(year: int, horizon: int, need_label: bool = True) -> pd.DataFrame:
    path = C.features_file(year, horizon)
    if not path.exists():
        raise FileNotFoundError(f"Missing {path.name} in {path.parent} - ask B1 for it.")
    df = pd.read_parquet(path).rename(columns=C.COLUMN_RENAMES)
    needed = C.ID_COLS + C.FEATURES + (C.LABEL_COLS if need_label else [])
    missing = [c for c in needed if c not in df.columns]
    if missing:
        raise ValueError(f"{path.name} is missing columns {missing} - ask B1.")
    if need_label:
        df["label"] = df["label"].astype(bool)
        check_labels(df, year, horizon, path.name)
    return df


def check_labels(df, year, horizon, name):
    """Leakage guard: every positive must be first linked AFTER the feature year
    and no later than year + horizon."""
    pos = df[df["label"]]
    if pos.empty:
        print(f"  WARNING: {name} has no positive labels")
        return
    yrs = pd.to_datetime(pos["label_date"]).dt.year
    bad = ((yrs <= year) | (yrs > year + horizon)).sum()
    assert bad == 0, (f"LEAKAGE in {name}: {bad} positives dated outside "
                      f"{year + 1}-{year + horizon}. Ask B1.")


def check_split(train, test):
    """Leakage guard: training labels must end by the test feature year."""
    (ty, th), (sy, _) = train, test
    assert ty + th <= sy, (f"LEAKAGE: train labels run to {ty + th} but test features "
                           f"stop at {sy}.")


# ---------------------------------------------------------------- training --

def downsample(df: pd.DataFrame) -> pd.DataFrame:
    rng = np.random.default_rng(C.PARAMS["seed"])
    pos = df[df["label"]]
    neg = df[~df["label"]]
    n_neg = min(len(neg), len(pos) * C.PARAMS["neg_per_pos"])
    neg = neg.iloc[rng.choice(len(neg), n_neg, replace=False)]
    return pd.concat([pos, neg])


def train_model(df: pd.DataFrame):
    sample = downsample(df)
    p = C.PARAMS
    model = HistGradientBoostingClassifier(
        max_iter=p["max_iter"], learning_rate=p["learning_rate"],
        max_leaf_nodes=p["max_leaf_nodes"], min_samples_leaf=p["min_samples_leaf"],
        l2_regularization=p["l2_regularization"], random_state=p["seed"])
    model.fit(sample[C.FEATURES].astype(float), sample["label"])
    print(f"  trained on {len(sample):,} rows "
          f"({sample['label'].sum():,} positives, from {len(df):,} total)")
    return model


def model_scores(model, df):
    return model.predict_proba(df[C.FEATURES].astype(float))[:, 1]


def all_scores(model, df) -> dict:
    """Model plus the three simple baselines."""
    rng = np.random.default_rng(C.PARAMS["seed"])
    return {
        "model": model_scores(model, df),
        "popularity": df["pa"].to_numpy(float),        # big concepts x big concepts
        "common_neighbours": df["cn"].to_numpy(float),
        "random": rng.random(len(df)),
    }


# -------------------------------------------------------------- evaluation --

def precision_at_k(y, s, k, seed):
    # random tiny jitter breaks ties fairly (many pairs share cn = 0, etc.)
    jitter = np.random.default_rng(seed).random(len(s)) * 1e-9
    top = np.argsort(-(s + jitter * (np.abs(s).max() + 1)))[:k]
    return y[top].mean()


def evaluate(y, scores: dict) -> pd.DataFrame:
    y = np.asarray(y, bool)
    base = y.mean()
    rows = []
    for name, s in scores.items():
        row = {"method": name, "base_rate": base}
        for k in C.PARAMS["top_k"]:
            pk = precision_at_k(y, s, k, C.PARAMS["seed"])
            row[f"p@{k}"] = pk
            row[f"lift@{k}"] = pk / base if base else np.nan
        row["auc"] = roc_auc_score(y, s) if 0 < y.sum() < len(y) else np.nan
        row["pr_auc"] = average_precision_score(y, s) if y.any() else np.nan
        rows.append(row)
    return pd.DataFrame(rows)


def feature_importance(model, df) -> pd.DataFrame:
    n = min(len(df), C.PARAMS["importance_sample"])
    sample = df.sample(n, random_state=C.PARAMS["seed"])
    r = permutation_importance(model, sample[C.FEATURES].astype(float), sample["label"],
                               scoring="average_precision", n_repeats=3,
                               random_state=C.PARAMS["seed"])
    return (pd.DataFrame({"feature": C.FEATURES, "importance": r.importances_mean})
            .sort_values("importance", ascending=False))


def save(df: pd.DataFrame, name: str):
    C.OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = C.OUT_DIR / name
    df.to_csv(path, index=False)
    print(f"  saved {path.relative_to(C.ROOT)}")


def fmt(df: pd.DataFrame) -> str:
    return df.to_string(index=False, float_format=lambda x: f"{x:.4f}")


def save_params():
    C.OUT_DIR.mkdir(parents=True, exist_ok=True)
    (C.OUT_DIR / "params_used.txt").write_text(
        f"USE_FAKE = {C.USE_FAKE}\nPARAMS = {json.dumps(C.PARAMS, indent=2)}\n"
        f"COLUMN_RENAMES = {C.COLUMN_RENAMES}\n")
