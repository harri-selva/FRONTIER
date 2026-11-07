#!/usr/bin/env bash
# Rebuild everything from scratch (about 10 minutes, plus ~25 minutes for the first arXiv fetch).
set -euo pipefail
cd "$(dirname "$0")/.."
PY=${PY:-python}
$PY pipeline/fetch_inputs.py          # 2026 data from the data-pipeline branch
$PY pipeline/fetch_arxiv.py           # titles/authors/abstracts/categories (resumable, cached)
$PY pipeline/prepare.py               # fields, concepts, islands
$PY -m pytest -q                      # tests must pass before any backtest
$PY pipeline/backtest.py              # main + robustness (logs to runs.csv)
$PY pipeline/backtest_featured.py     # featured-gap rule (logs to runs.csv)
$PY pipeline/export_web.py            # current gaps + JSON for the website
$PY qa/hand_checks.py                 # independent recomputation checks
(cd web && npm ci && npm run build)   # static site in web/dist
