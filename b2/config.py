"""
B2 settings. The only line you normally change is USE_FAKE.

  USE_FAKE = True   -> uses made-up data in data/fake/ (to test the code)
  USE_FAKE = False  -> uses B1's real files in data/real/
"""
from pathlib import Path

USE_FAKE = True

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / ("fake" if USE_FAKE else "real")
OUT_DIR = ROOT / "outputs" / ("fake" if USE_FAKE else "real")

# ---------------------------------------------------------------------------
# SPACE FOR B1 NOTES
# If B1 renamed a column, add it here as  "their_name": "our_name".
# Example: {"common_neighbours": "cn"}
# ---------------------------------------------------------------------------
COLUMN_RENAMES = {}

# ---------------------------------------------------------------------------
# Files B1 gives us. Feature file = features_<year>_h<horizon>.parquet
#   year    = last year of data used to build the features
#   horizon = how many years after `year` the label looks ahead (h0 = no label)
# ---------------------------------------------------------------------------
def features_file(year: int, horizon: int) -> Path:
    return DATA_DIR / f"features_{year}_h{horizon}.parquet"

CONCEPTS_FILE = DATA_DIR / "concepts.parquet"   # needs concept_id + phrase

MAIN = {"train": (2013, 3), "test": (2016, 9)}

# Robustness: one (train, test) pair per test year
ROBUSTNESS = {
    2012: {"train": (2009, 3), "test": (2012, 5)},
    2014: {"train": (2011, 3), "test": (2014, 5)},
    2016: {"train": (2013, 3), "test": (2016, 5)},
    2018: {"train": (2015, 3), "test": (2018, 5)},
}

FORECAST = {"train": (2022, 3), "predict": (2025, 0)}

FEATURES = [
    "cn", "jaccard", "aa", "ra", "pa",
    "deg_min", "deg_max", "recent_min", "recent_max",
    "growth_min", "growth_max", "age_min", "age_max",
    "same_cat", "is_2hop",
]
ID_COLS = ["u", "v"]
LABEL_COLS = ["label", "label_date", "label_paper"]

# ---------------------------------------------------------------------------
# PARAMS ARE FROZEN. Do not change them after seeing real results.
# Changing settings until results look good is overfitting to the test set.
# ---------------------------------------------------------------------------
PARAMS = {
    "seed": 42,
    "neg_per_pos": 20,          # training: keep all positives + 20 negatives each
    "max_iter": 300,            # gradient boosting rounds
    "learning_rate": 0.05,
    "max_leaf_nodes": 31,
    "min_samples_leaf": 100,
    "l2_regularization": 1.0,
    "top_k": [100, 1000],       # precision@k
    "importance_sample": 200_000,
    "forecast_top_n": 1000,     # rows in forecast_top.csv
    "stage_top_n": 50,          # stage candidates handed to Person D
}
