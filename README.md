# FRONTIER

Forecasting which research concepts will meet for the first time.

## Data pipeline (Person A)

Turns the arXiv metadata dump into `paper_concepts.parquet` (for the model) and
`paper_concepts_first_seen.csv` (for the galaxy). Both final files, plus the
concept list `vocab.csv`, are committed in `data/`.

### Final results
| | |
|---|---|
| Papers scanned | 3.2 million (all of arXiv) |
| Papers kept | 92,176 in quantitative finance, quantitative biology and medical physics |
| Concept vocabulary | 8,640 concepts, built from the 19,730 papers up to 2013 |
| Concepts per paper | about 19 (median 19) |
| Co-mention pairs | 18.9 million (with repeats) |

Notes for the model: 2026 is a partial year, and the network is fairly dense,
so consider requiring 2+ shared papers before counting a link.

### Setup
```bash
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```
Download `arxiv-metadata-oai-snapshot.json` from Kaggle
(Cornell-University/arxiv) into `data/`. It is not committed (5.7 GB).

### Run (the exact commands used)
```bash
python pipeline/frontier_data.py filter --input data/arxiv-metadata-oai-snapshot.json \
    --cats q-fin physics.med-ph q-bio --out data/papers.parquet
python pipeline/frontier_data.py vocab --papers data/papers.parquet --cutoff-year 2013 \
    --sample 25000 --min-df 5 --out data/vocab.csv
python pipeline/frontier_data.py tag --papers data/papers.parquet --vocab data/vocab.csv \
    --out data/paper_concepts.parquet
```
Paper details (title, authors, first-published date, link) for the model,
briefs and galaxy:
```bash
python pipeline/frontier_data.py metadata --papers data/papers.parquet \
    --out data/paper_metadata.parquet
```
Optional review of the concept list:
```bash
python pipeline/review_vocab.py data/vocab.csv
```

### How concepts are chosen
1. spaCy finds noun phrases in each title and abstract (papers up to 2013 only).
2. Cleaning: strip filler words ("our", "novel"), singularise, max 4 words,
   drop a hand-reviewed list of generic words (`GENERIC_PHRASES`).
3. Frequency: keep phrases in at least 5 papers and at most 15% of papers.
4. Noun-ratio check: keep a concept only if spaCy saw it as a real noun phrase
   in at least 30% of the papers whose text contains it. This removes everyday
   words matched out of context ("the current study", "left open").
5. Field spread: each concept records its share of finance, biology and
   medicine papers. Evenly spread single words were reviewed by hand.
6. Tagging: Aho-Corasick finds every concept in all 92k papers in one pass.

### Key choices
- Date = `versions[0].created` (first submission), never `update_date`.
- Vocabulary built only from papers up to the cutoff year, to avoid lookahead bias.
- Known limits: maths symbols, unmerged synonyms, short acronyms, ideas
  described rather than named, and very new ideas too rare to pass the filter.
