# B1 files go here

Copy these files from B1 into this folder (`data/real/`). They are NOT uploaded
to GitHub (too big). Only this README is.

| File | Used for |
|---|---|
| features_2013_h3.parquet | main train |
| features_2016_h9.parquet | main test |
| features_2009_h3.parquet | robustness 2012 train |
| features_2012_h5.parquet | robustness 2012 test |
| features_2011_h3.parquet | robustness 2014 train |
| features_2014_h5.parquet | robustness 2014 test |
| features_2016_h5.parquet | robustness 2016 test (train = 2013_h3) |
| features_2015_h3.parquet | robustness 2018 train |
| features_2018_h5.parquet | robustness 2018 test |
| features_2022_h3.parquet | forecast train |
| features_2025_h0.parquet | forecast (no labels) |
| concepts.parquet | from Person A: `concept_id`, `phrase` |

Every features file needs: `u, v, cn, jaccard, aa, ra, pa, deg_min, deg_max,
recent_min, recent_max, growth_min, growth_max, age_min, age_max, same_cat,
is_2hop`, and (except `_h0`) `label, label_date, label_paper`.

If B1 renamed a column, write it in `COLUMN_RENAMES` in `b2/config.py`.

## Notes from B1
- (write anything B1 tells you here)
