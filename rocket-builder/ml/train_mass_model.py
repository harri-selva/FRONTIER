"""Train the planet-mass model used in the game ("Pip's AI").

Task: predict log10(planet mass / Earth masses) from things astronomers can
measure without weighing the planet: its radius, its orbital period, its
equilibrium temperature, and its star's mass and temperature.

Data: ml/data/training.csv (transiting planets with *measured* masses only).

Protocol
  * The 24 planets used in the game are held out completely ("showcase"), so
    the in-game "beat the AI" round only uses planets the model never saw.
  * The rest is split 70 / 15 / 15 into train / validation / test (seed 42).
  * Model selection (MLP size and L2 strength) uses the validation set only.
  * Final model: an ensemble of 5 MLPs (different seeds) trained on train.
    Uncertainty = sqrt(ensemble variance + residual variance from validation).
  * Reported once on the untouched test set, against two baselines:
      - median mass of the training set
      - radius-only broken power law (piecewise linear in log-log), the usual
        "mass-radius relation" style estimate astronomers use.

Outputs
  * src/data/mass-model.json  (weights + scaler + metrics, read by the game)
  * ml/report.md              (metrics, settings, feature importance)

Usage:  ml/.venv/bin/python ml/train_mass_model.py
"""

from __future__ import annotations

import csv
import json
import re
from datetime import date
from pathlib import Path

import numpy as np
from sklearn.neural_network import MLPRegressor

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "ml" / "data" / "training.csv"
SETS = ROOT / "src" / "data" / "difficulty-sets.ts"
OUT_JSON = ROOT / "src" / "data" / "mass-model.json"
OUT_REPORT = ROOT / "ml" / "report.md"
SEED = 42

FEATURES = [
    ("log10_radius", "Planet radius (Earth radii, log10)"),
    ("log10_period", "Orbital period (days, log10)"),
    ("log10_teq", "Equilibrium temperature (K, log10)"),
    ("log10_star_mass", "Star mass (Suns, log10)"),
    ("star_teff_k", "Star temperature (thousands of K)"),
]
# Distance (in standardised feature units) within which a training planet counts as "similar".
SIMILAR_RADIUS = 0.75
# Hinge points (Earth radii) for the radius-only baseline.
KNOTS_RE = [1.5, 4.0, 10.0]


def load() -> tuple[list[str], np.ndarray, np.ndarray, list[str]]:
    with DATA.open() as f:
        lines = [l for l in f if not l.startswith("#") and not l.startswith('"#')]
    rows = list(csv.DictReader(lines))
    names, X, y, retrieved = [], [], [], []
    for r in rows:
        R, M, P, T, Ms, Ts = (float(r[k]) for k in ("pl_rade", "pl_bmasse", "pl_orbper", "pl_eqt", "st_mass", "st_teff"))
        if min(R, M, P, T, Ms, Ts) <= 0:
            continue
        names.append(r["pl_name"])
        X.append(features(R, P, T, Ms, Ts))
        y.append(np.log10(M))
    header = DATA.read_text().splitlines()[0]
    retrieved = re.findall(r"\d{4}-\d{2}-\d{2}", header)
    return names, np.array(X), np.array(y), retrieved


def features(radius_re: float, period_d: float, teq_k: float, star_mass: float, star_teff: float) -> list[float]:
    return [np.log10(radius_re), np.log10(period_d), np.log10(teq_k), np.log10(star_mass), star_teff / 1000.0]


def curated_names() -> set[str]:
    """Every quoted string in difficulty-sets.ts (planet names; other strings never match a planet)."""
    return {a or b for a, b in re.findall(r"'([^']+)'|\"([^\"]+)\"", SETS.read_text())}


def hinge(logR: np.ndarray) -> np.ndarray:
    cols = [np.ones_like(logR), logR] + [np.maximum(0.0, logR - np.log10(k)) for k in KNOTS_RE]
    return np.stack(cols, axis=1)


def metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    d = y_pred - y_true
    return {
        "rmse_dex": float(np.sqrt(np.mean(d**2))),
        "mae_dex": float(np.mean(np.abs(d))),
        "median_abs_pct_error": float(np.median(np.abs(10**d - 1)) * 100),
        "within_factor_2": float(np.mean(np.abs(d) < np.log10(2))),
    }


def make_mlp(hidden: tuple[int, ...], alpha: float, seed: int) -> MLPRegressor:
    return MLPRegressor(
        hidden_layer_sizes=hidden,
        activation="relu",
        alpha=alpha,
        learning_rate_init=3e-3,
        max_iter=4000,
        early_stopping=True,
        validation_fraction=0.15,
        n_iter_no_change=60,
        random_state=seed,
    )


def main() -> None:
    names, X, y, retrieved = load()
    curated = curated_names()
    show_mask = np.array([n in curated for n in names])
    rest = np.where(~show_mask)[0]
    rng = np.random.default_rng(SEED)
    rng.shuffle(rest)
    n_train = int(0.70 * len(rest))
    n_val = int(0.15 * len(rest))
    tr, va, te = rest[:n_train], rest[n_train : n_train + n_val], rest[n_train + n_val :]

    mu = X[tr].mean(axis=0)
    sd = X[tr].std(axis=0)
    Z = (X - mu) / sd

    # --- baselines (fit on train) ---
    median_pred = float(np.median(y[tr]))
    H = hinge(X[:, 0])
    beta, *_ = np.linalg.lstsq(H[tr], y[tr], rcond=None)

    # --- model selection on validation ---
    grid = [((16,), 1e-3), ((32, 16), 1e-3), ((32, 16), 1e-2), ((64, 32), 1e-3), ((64, 32), 1e-2)]
    sel = []
    for hidden, alpha in grid:
        m = make_mlp(hidden, alpha, SEED).fit(Z[tr], y[tr])
        sel.append((metrics(y[va], m.predict(Z[va]))["rmse_dex"], hidden, alpha))
    sel.sort()
    best_rmse, best_hidden, best_alpha = sel[0]

    # --- final ensemble ---
    members = [make_mlp(best_hidden, best_alpha, SEED + k).fit(Z[tr], y[tr]) for k in range(5)]

    def ens(Zx: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        P = np.stack([m.predict(Zx) for m in members])
        return P.mean(axis=0), P.var(axis=0)

    va_mean, va_var = ens(Z[va])
    resid_var = max(1e-6, float(np.mean((va_mean - y[va]) ** 2) - np.mean(va_var)))
    # Calibrate: scale sigma so that 68.3% of validation errors fall inside ±1σ.
    va_sigma_raw = np.sqrt(va_var + resid_var)
    sigma_scale = float(np.quantile(np.abs(va_mean - y[va]) / va_sigma_raw, 0.6827))
    te_mean, te_var = ens(Z[te])
    te_sigma = np.sqrt(te_var + resid_var) * sigma_scale
    coverage_1s = float(np.mean(np.abs(te_mean - y[te]) <= te_sigma))
    coverage_2s = float(np.mean(np.abs(te_mean - y[te]) <= 2 * te_sigma))

    results = {
        "test_model": metrics(y[te], te_mean),
        "test_baseline_radius_power_law": metrics(y[te], H[te] @ beta),
        "test_baseline_median": metrics(y[te], np.full(len(te), median_pred)),
        "test_one_sigma_coverage": coverage_1s,
        "test_two_sigma_coverage": coverage_2s,
        "validation_grid": [{"hidden": list(h), "alpha": a, "val_rmse_dex": r} for r, h, a in sel],
    }

    # --- permutation importance on test ---
    base_rmse = results["test_model"]["rmse_dex"]
    importance = []
    for j, (key, label) in enumerate(FEATURES):
        Zp = Z[te].copy()
        Zp[:, j] = np.random.default_rng(SEED + j).permutation(Zp[:, j])
        importance.append({"feature": key, "label": label, "rmse_increase_dex": float(metrics(y[te], ens(Zp)[0])["rmse_dex"] - base_rmse)})

    # --- showcase (game planets, never seen) ---
    showcase = []
    sm_mean, sm_var = ens(Z[show_mask]) if show_mask.any() else (np.array([]), np.array([]))
    for i, idx in enumerate(np.where(show_mask)[0]):
        showcase.append({
            "name": names[idx],
            "true_mass_earth": float(10 ** y[idx]),
            "pred_mass_earth": float(10 ** sm_mean[i]),
            "sigma_dex": float(np.sqrt(sm_var[i] + resid_var) * sigma_scale),
            "features": X[idx].tolist(),
        })

    # parity samples so the TypeScript forward pass can be checked against sklearn
    parity = []
    for i in te[:12]:
        pm, pv = ens(Z[i : i + 1])
        parity.append({"features": X[i].tolist(), "pred_log10_mass": float(pm[0]), "sigma_dex": float(np.sqrt(pv[0] + resid_var) * sigma_scale)})

    out = {
        "model": "Ensemble of 5 multilayer perceptrons (scikit-learn MLPRegressor, ReLU)",
        "target": "log10(planet mass in Earth masses)",
        "features": [{"key": k, "label": l} for k, l in FEATURES],
        "scaler": {"mean": mu.tolist(), "std": sd.tolist()},
        "members": [
            {"layers": [{"W": np.round(W.T, 6).tolist(), "b": np.round(b, 6).tolist()} for W, b in zip(m.coefs_, m.intercepts_)]}
            for m in members
        ],
        "hidden_activation": "relu",
        # Standardised training inputs (rounded) so the game can count similar
        # planets and warn when a question is outside the model's experience.
        "train_points_z": np.round(Z[tr], 2).tolist(),
        "similar_radius_z": SIMILAR_RADIUS,
        "residual_sigma_dex": float(np.sqrt(resid_var)),
        "sigma_scale": sigma_scale,
        "baseline_radius_power_law": {"knots_earth_radii": KNOTS_RE, "beta": beta.tolist()},
        "selected": {"hidden": list(best_hidden), "alpha": best_alpha},
        "counts": {"train": len(tr), "validation": len(va), "test": len(te), "showcase_held_out": int(show_mask.sum())},
        "metrics": results,
        "permutation_importance": importance,
        "showcase": showcase,
        "parity": parity,
        "data": {"source": "NASA Exoplanet Archive (pscomppars): transiting planets with measured masses", "retrieved": retrieved[0] if retrieved else None},
        "trained": date.today().isoformat(),
        "sklearn_seed": SEED,
    }
    # Known limitation probe: an Earth twin is far outside the training data.
    ez = (np.array(features(1.0, 365.25, 255.0, 1.0, 5772.0)) - mu) / sd
    earth_pred = float(10 ** ens(ez[None, :])[0][0])
    earth_similar = int(np.sum(np.linalg.norm(Z[tr] - ez, axis=1) < SIMILAR_RADIUS))
    out["earth_twin_probe"] = {"pred_mass_earth": earth_pred, "similar_training_planets": earth_similar}
    OUT_JSON.write_text(json.dumps(out, separators=(",", ":")) + "\n")

    def row(name: str, m: dict[str, float]) -> str:
        return f"| {name} | {m['rmse_dex']:.3f} | {m['mae_dex']:.3f} | {m['median_abs_pct_error']:.1f}% | {m['within_factor_2'] * 100:.1f}% |"

    report = [
        "# Planet-mass model report",
        "",
        f"Trained {out['trained']} on data retrieved {out['data']['retrieved']}. Generated by `ml/train_mass_model.py`.",
        "",
        f"Planets: {len(tr)} train, {len(va)} validation, {len(te)} test; {int(show_mask.sum())} game planets held out entirely.",
        f"Selected on validation: hidden layers {list(best_hidden)}, L2 alpha {best_alpha}. Final model: 5-network ensemble.",
        "",
        "## Test set (never used for training or selection)",
        "",
        "| Model | RMSE (dex) | MAE (dex) | Median abs. error | Within ×2 |",
        "| --- | --- | --- | --- | --- |",
        row("MLP ensemble", results["test_model"]),
        row("Baseline: radius-only broken power law", results["test_baseline_radius_power_law"]),
        row("Baseline: training median", results["test_baseline_median"]),
        "",
        f"Uncertainty calibrated on validation (σ scale {sigma_scale:.3f}). Test coverage: ±1σ {coverage_1s * 100:.1f}% (ideal 68.3%), ±2σ {coverage_2s * 100:.1f}% (ideal 95.4%).",
        "",
        "## Known limitation",
        "",
        f"An Earth twin (1 R⊕, 365-day orbit, Sun-like star) is predicted at {earth_pred:.1f} M⊕ (true: 1). "
        f"Only {earth_similar} training planets are within the similarity radius: small planets on long orbits rarely have measured masses, "
        "so the model is extrapolating. The game counts similar training planets and warns when there are fewer than 5.",
        "",
        "## Permutation importance (test RMSE increase when a feature is shuffled)",
        "",
        *[f"- {i['label']}: +{i['rmse_increase_dex']:.3f} dex" for i in sorted(importance, key=lambda i: -i["rmse_increase_dex"])],
        "",
        "## Validation grid",
        "",
        *[f"- hidden {g['hidden']}, alpha {g['alpha']}: {g['val_rmse_dex']:.3f} dex" for g in results["validation_grid"]],
        "",
        "## Held-out game planets",
        "",
        "| Planet | Measured mass (M⊕) | Model (M⊕) |",
        "| --- | --- | --- |",
        *[f"| {s['name']} | {s['true_mass_earth']:.2f} | {s['pred_mass_earth']:.2f} |" for s in showcase],
        "",
    ]
    OUT_REPORT.write_text("\n".join(report))
    print("\n".join(report))


if __name__ == "__main__":
    main()
