# Claude Code prompt — B2: train the FRONTIER model

Copy everything below the line into Claude Code. Paste your B1 files into the
marked area first (one fenced block per file, with its path as the heading).

---

You are working in the FRONTIER repo (branch `B2`). FRONTIER forecasts which
pairs of research concepts will be mentioned together in a paper for the first
time. Your job is **step B2: train and evaluate the link-prediction model.**

## What already exists

**Person A pipeline** (`pipeline/frontier_data.py`, read it first) produces:
- `data/paper_concepts.parquet` — one row per paper: `id`, `first_date`,
  `year`, `primary_cat`, `concepts` (list of canonical concept strings),
  `n_concepts`.
- `data/paper_concepts_first_seen.csv` — `concepts`, `first_seen` date.
- The vocabulary was built only from papers up to the cutoff year (default 2013)
  to avoid lookahead bias. Keep that rule everywhere you touch data.

**B1** (my code, pasted below) is the step before you. Read it carefully and
build on its outputs: same file names, column names, function names and CLI
style. Don't rewrite or duplicate what B1 already does; import from it. If
something B2 needs is missing from B1, tell me what's missing before adding it.

## B1 files — PASTE HERE

<!-- Paste each B1 file below, like this:

### pipeline/b1_xxx.py
```python
...file contents...
```

### (any notes on B1 outputs: file names, columns, how to run it)
```text
...
```
-->

### B1 file 1: `path/to/file`
```python
# paste here
```

### B1 file 2: `path/to/file`
```python
# paste here
```

### B1 notes (outputs, how to run, anything unusual)
```text
paste here
```

## The B2 task

Build `pipeline/frontier_train.py` (same argparse sub-command style as
`frontier_data.py`) that:

1. **Sets up a temporal split, with no leakage.**
   - Pick a feature year `T` and a horizon `H` (CLI args, defaults `T=2016`,
     `H=3`).
   - Candidate pairs: concepts that both exist by `T` but have **never**
     co-occurred in any paper up to `T`.
   - Label = 1 if the pair co-occurs for the first time in years
     `(T, T+H]`, else 0.
   - Training set uses features at `T-H` labelled by `(T-H, T]`; test set uses
     features at `T` labelled by `(T, T+H]`. Features must only use papers
     dated `<= ` the feature year. Add an assertion that checks this.
2. **Handles imbalance.** Positives are rare. Sample negatives (ratio as a CLI
   arg, default 10:1, fixed `random_state=42`) for training, but evaluate on a
   large, unsampled (or clearly documented) test candidate set.
3. **Uses B1's features / graph.** If B1 already computes pair features
   (e.g. common neighbours, Adamic–Adar, Jaccard, preferential attachment,
   concept degree/age/growth), use them. Add only what's missing.
4. **Trains baselines first, then the model.**
   - Baselines: rank by common neighbours, Adamic–Adar, preferential
     attachment (no training).
   - Model: logistic regression, then a gradient-boosted tree model
     (LightGBM if installed, otherwise scikit-learn `HistGradientBoostingClassifier`).
5. **Reports metrics** on the test set: ROC-AUC, PR-AUC, precision@100,
   precision@1000, and the positive rate (so PR-AUC can be read in context).
   Print a comparison table of baselines vs model, plus top feature
   importances.
6. **Saves outputs** to `data/` (git-ignored):
   - `model.joblib` (trained model + feature list)
   - `metrics.json`
   - `predictions_top.csv` — top 1000 predicted pairs *from the latest year*
     (concept_a, concept_b, score), for the galaxy visualisation.

## Ground rules

- Read `pipeline/frontier_data.py` and the B1 files before writing code.
- Never use information after the feature year to build features.
- Keep it runnable on a laptop: stream / chunk where needed, print progress.
- Add any new packages to `requirements.txt`.
- Update `README.md` with a "Training (B2)" section: setup, run commands, key
  choices — same tone as the Person A section.
- Run it end to end on a small sample (e.g. `--max-papers 50000`) to prove it
  works, and show me the metrics table.
- Commit with a clear message and push to branch `B2`.
