# FRONTIER

Forecasting which research concepts will meet for the first time.

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
