# FRONTIER

Explore research as a 16-bit pixel-art universe and find **research gaps**: pairs of concepts that
have never appeared in the same paper but are predicted to meet, **validated with a backtest**.

- **Galaxy:** 14 planets. **Medicine** and **Quant** are live, built from 33,510 real arXiv papers.
- **Planet:** each island is a sub-field (size = papers).
- **Island:** a network of concepts. Solid lines = studied together; glowing dashed lines = predicted gaps;
  portals = gaps to other islands.
- **Side panel:** real papers, the Resource Allocation maths, why it fits, a suggested paper and three missions.
- **Validation:** "in 2018 we would have predicted these gaps; this many were filled by 2026".

Read **[METHOD.md](METHOD.md)** for how it works and **[DEMO.md](DEMO.md)** for the 3-minute pitch path.

## Quick start: run the site (no Python needed)
The exported data is committed in `web/public/data/`, so the site runs on its own:
```bash
cd web
npm ci
npm run dev        # http://localhost:5173
```
Production build and local preview:
```bash
npm run build      # -> web/dist (static files)
npx vite preview --port 4173
```

## Rebuild the data (Python 3.11+)
Create and activate a virtual environment.

Mac / Linux:
```bash
python3 -m venv .venv
source .venv/bin/activate
```
Windows (PowerShell):
```bash
python -m venv .venv
.venv\Scripts\Activate.ps1
```
Then install the packages and run everything:
```bash
pip install -r requirements.txt
bash pipeline/run_all.sh
```
`run_all.sh` runs these steps in order:

| Step | Script | What it does |
|---|---|---|
| 1 | `pipeline/fetch_inputs.py` | copies `paper_concepts_2026.parquet` and `vocab_2026.csv` from the `data-pipeline` branch |
| 2 | `pipeline/fetch_arxiv.py` | fetches titles, authors, abstracts, DOIs and all categories from the arXiv API (~25 min first time; cached and resumable) |
| 3 | `pipeline/prepare.py` | dedupes, assigns fields from arXiv categories, cleans concepts, builds islands; writes `outputs/cleaning_report.md` |
| 4 | `pytest` | 26 tests: hand-computed features, leakage, planted paper, survivorship, networkx, no cross-field pairs |
| 5 | `pipeline/backtest.py` | main backtest + robustness for both fields; appends to `runs.csv` |
| 6 | `pipeline/backtest_featured.py` | backtest of the website's featured-gap rule; appends to `runs.csv` |
| 7 | `pipeline/export_web.py` | current gaps (as of 29 Oct 2026) + static JSON in `web/public/data/` |
| 8 | `qa/hand_checks.py` | independent networkx recomputation of 10 gaps + check of every example hit |

All settings live in `pipeline/config.py`. They were frozen before the first backtest run; **do not
change them and rerun because the results look weak**. That would be tuning on the test set.

**AI-written text (optional).** Set `ANTHROPIC_API_KEY` and `pip install anthropic` before
`export_web.py`. Claude then writes the summaries, "why it fits" text, proposals and missions at build
time, grounded in the real abstracts, and caches them in `pipeline/cache/`. Without a key, clearly
labelled templates are used; this build uses templates. Never commit a key.

## Tests and QA
```bash
pytest -v                                        # pipeline tests
python qa/hand_checks.py                         # writes qa/hand_checks.md
(cd web && npm run build && npx vite preview --port 4173 &) ; node qa/run_qa.cjs   # Playwright click-through
```
`qa/run_qa.cjs` clicks through boot → galaxy → coming-soon planet → each field → island → concept →
every tab → gap → Validation, then reloads a deep link, walks back with ESC, and visits the leaderboard,
the method page and the CRT toggle. Screenshots go to `qa/screenshots/`. It fails on any browser console
error or warning.

## Deploy (static site, hash URLs, relative paths)
- **Netlify:** base directory `web`, build command `npm run build`, publish directory `web/dist`.
- **Vercel:** root directory `web`, framework preset Vite, output `dist`.
- **GitHub Pages:** build, then publish the contents of `web/dist` (for example with the
  `actions/deploy-pages` workflow). Relative paths and `#/` routes mean no extra configuration is needed.

## Folder structure
```
pipeline/   data pipeline (Python): fetch, prepare, graph, backtest, export, content
tests/      pytest (toy data with hand-computed values, leakage, cross-field)
web/        Vite + React + TypeScript site; pixel engine in web/src/engine, scenes in web/src/scenes
web/public/data/   exported JSON the site reads (committed)
qa/         Playwright click-through, hand checks, screenshots
runs.csv    every backtest run (commit, config fingerprint, metrics)
src/, data/make_*.py   original B1 prototype (synthetic data), kept for reference
```

---

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
