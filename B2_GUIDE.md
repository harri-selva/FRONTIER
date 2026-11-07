# B2 guide: training and evaluating the model

B2 takes B1's pair features and answers: **can we predict which concept pairs
will meet for the first time, better than just picking popular concepts?**

## Setup
```bash
pip install -r requirements.txt
```

## 1. Test with fake data (no B1 files needed)
```bash
python b2/make_fake_data.py
python b2/check_files.py
python b2/run_backtest.py
python b2/run_robustness.py
python b2/run_forecast_export.py
```
Results go to `outputs/fake/`. This only proves the code runs.

## 2. Switch to real data
1. Put B1's files in `data/real/` (see `data/real/README.md`).
2. In `b2/config.py` set `USE_FAKE = False`. Change nothing else.
3. `python b2/check_files.py` - if it says STOP, ask B1 for what it lists.
4. Run the three `run_*.py` scripts. Results go to `outputs/real/`.

**Run the main backtest once. Don't change PARAMS because results look weak**,
which would be tuning on the test set.

## What each script does
| Script | Train on | Test on | Output |
|---|---|---|---|
| run_backtest.py | 2013 features, labels 2014-16 | 2016 features, labels 2017-25 | backtest_metrics.csv, feature_importance.csv |
| run_robustness.py | 3-yr window before each test year | 2012/14/16/18, 5-yr labels | robustness_metrics.csv |
| run_forecast_export.py | 2022 features, labels 2023-25 | 2025 (future, no labels) | forecast_top.csv, stage_candidates.csv |

## Leakage rules (the code checks these and stops if broken)
- Training labels must end by the test feature year (e.g. 2013 + 3 = 2016).
- Every positive label must be dated after its feature year and within the horizon.

## Reading the results
- **base rate**: share of pairs that really do meet. Random guessing gets this.
- **p@100 / p@1000**: of our top 100/1000 picks, the share that really met.
- **lift**: p@k divided by base rate ("x times better than random").
- **AUC**: 0.5 = random, 1.0 = perfect ranking.
- **Baselines**: popularity (`pa` = degree x degree), common neighbours (`cn`), random.
- **The key result**: does the model beat popularity?
- **Stage candidates**: top pairs for Person D, each concept used once so the list is varied.
