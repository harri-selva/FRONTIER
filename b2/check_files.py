"""Step 1: check B1's files exist, have the right columns, and report base rates.

Run:  python b2/check_files.py
"""
import pandas as pd

import config as C

EXPECTED = sorted({C.MAIN["train"], C.MAIN["test"], C.FORECAST["train"],
                   C.FORECAST["predict"],
                   *[s for r in C.ROBUSTNESS.values() for s in r.values()]})


def main():
    print(f"Checking {C.DATA_DIR}\n")
    problems = []
    for year, h in EXPECTED:
        path = C.features_file(year, h)
        if not path.exists():
            print(f"  MISSING  {path.name}")
            problems.append(f"{path.name} is missing")
            continue
        df = pd.read_parquet(path).rename(columns=C.COLUMN_RENAMES)
        need = C.ID_COLS + C.FEATURES + (C.LABEL_COLS if h > 0 else [])
        missing = [c for c in need if c not in df.columns]
        if missing:
            print(f"  BAD      {path.name}: missing columns {missing}")
            problems.append(f"{path.name} is missing columns {missing}")
            continue
        rate = f"base rate {df['label'].astype(bool).mean():.4%}" if h > 0 else "no labels (forecast)"
        print(f"  OK       {path.name:30s} {len(df):>12,} rows   {rate}")

    if not C.CONCEPTS_FILE.exists():
        print(f"  MISSING  {C.CONCEPTS_FILE.name}")
        problems.append("concepts.parquet is missing")
    else:
        cols = pd.read_parquet(C.CONCEPTS_FILE).columns
        miss = [c for c in ["concept_id", "phrase"] if c not in cols]
        if miss:
            problems.append(f"concepts.parquet is missing columns {miss}")
            print(f"  BAD      concepts.parquet: missing {miss}")
        else:
            print(f"  OK       concepts.parquet")

    if problems:
        print("\nSTOP. Ask B1 for:")
        for p in problems:
            print(f"  - {p}")
    else:
        print("\nAll files look good.")


if __name__ == "__main__":
    main()
