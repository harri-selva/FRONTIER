"""Makes fake B1-style files in data/fake/ so the code can be tested before
B1's real files arrive. The fake labels depend on aa and pa, so a working model
should beat random.

Run:  python b2/make_fake_data.py
"""
import numpy as np
import pandas as pd

import config as C

FAKE = C.ROOT / "data" / "fake"
N_CONCEPTS, N_PAIRS = 3000, 60_000


def fake(year, horizon, rng):
    u = rng.integers(0, N_CONCEPTS, N_PAIRS)
    v = (u + rng.integers(1, N_CONCEPTS, N_PAIRS)) % N_CONCEPTS
    deg_u, deg_v = rng.gamma(1.5, 20, N_PAIRS), rng.gamma(1.5, 20, N_PAIRS)
    cn = rng.poisson(np.sqrt(deg_u * deg_v) / 15)
    df = pd.DataFrame({
        "u": np.minimum(u, v), "v": np.maximum(u, v),
        "cn": cn, "jaccard": cn / (deg_u + deg_v - cn + 1),
        "aa": cn * rng.uniform(0.1, 0.5, N_PAIRS), "ra": cn * rng.uniform(0.01, 0.05, N_PAIRS),
        "pa": deg_u * deg_v,
        "deg_min": np.minimum(deg_u, deg_v), "deg_max": np.maximum(deg_u, deg_v),
        "recent_min": rng.poisson(3, N_PAIRS), "recent_max": rng.poisson(8, N_PAIRS),
        "growth_min": rng.normal(0, 1, N_PAIRS), "growth_max": rng.normal(1, 1, N_PAIRS),
        "age_min": rng.integers(0, 10, N_PAIRS), "age_max": rng.integers(5, 20, N_PAIRS),
        "same_cat": rng.random(N_PAIRS) < 0.3, "is_2hop": cn > 0,
    })
    if horizon > 0:
        z = -6 + 0.8 * np.log1p(df["aa"]) + 0.3 * np.log1p(df["pa"]) + 0.6 * df["same_cat"] \
            + 0.3 * df["growth_max"]
        df["label"] = rng.random(N_PAIRS) < 1 / (1 + np.exp(-z))
        yrs = rng.integers(year + 1, year + horizon + 1, N_PAIRS)
        df["label_date"] = pd.to_datetime(
            [f"{y}-06-01" if l else None for y, l in zip(yrs, df["label"])])
        df["label_paper"] = [f"fake.{i}" if l else None for i, l in enumerate(df["label"])]
    return df


def main():
    FAKE.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(0)
    splits = {C.MAIN["train"], C.MAIN["test"], C.FORECAST["train"], C.FORECAST["predict"],
              *[s for r in C.ROBUSTNESS.values() for s in r.values()]}
    for year, h in sorted(splits):
        fake(year, h, rng).to_parquet(FAKE / f"features_{year}_h{h}.parquet", index=False)
    pd.DataFrame({"concept_id": range(N_CONCEPTS),
                  "phrase": [f"fake concept {i}" for i in range(N_CONCEPTS)]}
                 ).to_parquet(FAKE / "concepts.parquet", index=False)
    print(f"Wrote {len(splits)} fake feature files + concepts.parquet to {FAKE}")


if __name__ == "__main__":
    main()
