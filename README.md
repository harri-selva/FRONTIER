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

### Reviewing the concept list
```bash
python pipeline/review_vocab.py data/vocab.csv
```
Prints SUSPECTS (single words used evenly across finance, biology and medicine,
which usually means generic) and the most common single words. Copy real junk
into `GENERIC_PHRASES` in `pipeline/frontier_data.py`, rerun `vocab`, then `tag`.

### Key choices
- Date = `versions[0].created` (first submission), never `update_date`.
- Vocabulary built only from papers up to `--cutoff-year`, to avoid lookahead bias.
- Field spread: real concepts usually belong to one field; evenly spread words are flagged for review, never auto-deleted.
- Thresholds and junk lists (`GENERIC_PHRASES`, `ALIASES`) live at the top of the script.
