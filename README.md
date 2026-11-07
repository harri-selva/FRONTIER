# FRONTIER

Forecasting which research concepts will meet for the first time.

The website lives in its own repo: **Prarthana-sudeesh/FRONTIER-2.0**. This repo
produces the `forecasts.json` file it reads.

## Data pipeline (Person A)

Turns the arXiv metadata dump into `paper_concepts.parquet` (for the model) and
`paper_concepts_first_seen.csv` (for the galaxy).

### Setup
```bash
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```
Download `arxiv-metadata-oai-snapshot.json` from Kaggle into `data/` (not committed).

### Run
```bash
python pipeline/frontier_data.py filter --input data/arxiv-metadata-oai-snapshot.json \
    --cats cs.LG q-bio cond-mat.mtrl-sci physics.optics --out data/papers.parquet
python pipeline/frontier_data.py vocab --papers data/papers.parquet --cutoff-year 2013 \
    --sample 60000 --min-df 10 --out data/vocab.csv
python pipeline/frontier_data.py tag --papers data/papers.parquet --vocab data/vocab.csv \
    --out data/paper_concepts.parquet
```

### Key choices
- Date = `versions[0].created` (first submission), never `update_date`.
- Vocabulary built only from papers up to `--cutoff-year`, to avoid lookahead bias.
- Thresholds and junk lists (`GENERIC_PHRASES`, `ALIASES`) live at the top of the script.

## Model and backtest (Person B)

`pipeline/frontier_model.py` builds the concept network from `paper_concepts.parquet`,
computes link-prediction features (common neighbours, Jaccard, Adamic-Adar, resource
allocation, preferential attachment, growth, age), trains a gradient-boosted model,
backtests it out-of-sample against random and popularity baselines, and writes the
forecasts the website reads.

```bash
python pipeline/frontier_model.py --concepts data/paper_concepts.parquet \
    --t1 2013 --t2 2016 --end 2025 --out outputs/forecasts.json
```
- Train: features <= `t1`, labels = first links in (`t1`, `t2`].
- Test: features <= `t2`, labels = first links in (`t2`, `end`]. Never used for tuning.
- Live forecast: same recipe shifted to the latest data, then scores unlinked pairs.

To get Medicine and Quant gaps, include `q-bio` and `q-fin` in the `filter --cats` step.

## Website data
Both `pipeline/frontier_model.py` and `b2/export_web.py` write a `forecasts.json`
into `outputs/`. Copy it into `public/data/` in the FRONTIER-2.0 repo and redeploy.
To get Medicine and Quant leaderboard entries, include `q-bio` and `q-fin` papers.
