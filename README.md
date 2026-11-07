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

---

## B1: graph features, backtest and basic model

B1 answers: *which two concepts that have never appeared in the same paper will appear
together in the future?* It turns the papers into a co-mention graph, describes each
not-yet-linked pair with numbers, and checks against what really happened later.

### Files
| File | What it does |
|---|---|
| `src/b1_pipeline.py` | The pipeline: `build_edges` → `snapshot` → `candidates` → `pair_features` / `node_features` → `add_labels`, glued together by `build`. |
| `src/train_basic.py` | Builds train (2013) and test (2016) feature files from the synthetic data, trains LightGBM, compares it with 3 baselines, saves `outputs/metrics.json`. |
| `data/make_toy.py` | Writes the 6-paper, 5-concept toy dataset (small enough to check by hand). |
| `data/make_synthetic.py` | Writes a ~20,000-paper, 300-concept fake dataset with realistic "rich get richer" and "friend of a friend" behaviour. |
| `tests/test_toy.py` | Checks exact feature values on the toy data, no-lookahead, and agreement with networkx. |

### Input format (3 Parquet files in one folder)
- `papers.parquet`: `paper_id` (str), `date` (datetime)
- `concepts.parquet`: `concept_id` (int, 0..N-1), `phrase`, `first_seen` (datetime), `dominant_cat`
- `paper_concepts.parquet`: `paper_id`, `concept_id`

Note: Person A's `paper_concepts.parquet` currently has a different shape (one row per paper,
a list of concept strings). It needs converting to these 3 tables before B1 can read it.

### Setup
```bash
python3 -m venv .venv
```
Activate it (do this in every new terminal):
- Mac / Linux: `source .venv/bin/activate`
- Windows (PowerShell): `.venv\Scripts\Activate.ps1`
- Windows (cmd): `.venv\Scripts\activate.bat`

```bash
pip install -r requirements.txt
```

### Run the tests
```bash
pytest -v
```

### Run the synthetic model
```bash
python data/make_synthetic.py
python src/train_basic.py
```
Outputs go to `outputs/` (git-ignored): `features_2013_h3.parquet`, `features_2016_h9.parquet`, `metrics.json`.

To build features for any year on any data folder:
```bash
python src/b1_pipeline.py --year 2016 --horizon 3 --data-dir data/synthetic --out-dir outputs
```

### How the backtest works
- **Cutoff** `t` = end of `year`. The graph and every feature use only papers dated `<= t`.
- **Label** = the pair first appears together in `(t, end of year+horizon]`.
  `label_date` and `label_paper` say when/where; they are never features.
- **Train** on cutoff 2013 (labels 2014-2016); **test** on cutoff 2016 (labels 2017-2025).
  The test file is never touched during training.

### Features (all computed on the graph at the cutoff)
| Feature | Meaning |
|---|---|
| `cn` | common neighbours: concepts linked to both |
| `jaccard` | `cn / (deg_u + deg_v - cn)`: shared neighbours as a fraction of all neighbours |
| `aa` | Adamic-Adar: shared neighbours, each weighted `1/ln(its degree)` (hubs count less) |
| `ra` | resource allocation: shared neighbours, each weighted `1/its degree` |
| `pa` | preferential attachment: `deg_u * deg_v` |
| `deg_min`, `deg_max` | the smaller/larger degree of the two |
| `recent_*` | papers in the last 3 years (min/max over the two concepts) |
| `growth_*` | recent papers ÷ all papers so far (1.0 = all its papers are recent) |
| `age_*` | years since the concept was first seen |
| `same_cat` | both concepts have the same `dominant_cat` |
| `is_2hop` | `cn > 0` |

### What the metrics mean
- **base rate**: fraction of test pairs that really did link. A random guess scores this.
- **precision@20 / @100**: rank all pairs by score; of the top 20 (100), what fraction linked?
  This is the number that matters for "here are our top predictions".
- **AUC**: chance a random positive pair is scored above a random negative pair.
  0.5 = random, 1.0 = perfect. Measures the whole ranking, not just the top.
- **lift@100**: precision@100 ÷ base rate. "How many times better than random at the top."

### Baselines
- **random**: random scores.
- **preferential attachment**: rank by `pa` alone ("popular concepts meet").
- **common neighbours**: rank by `cn` alone ("friends of friends meet").
Ties are broken with tiny random noise. A model is only useful if it beats all three.
