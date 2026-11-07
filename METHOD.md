# FRONTIER: method (one page, for judges)

**What it does.** FRONTIER finds pairs of research concepts that have never appeared in the same paper but
are likely to be studied together soon. It shows them as a 16-bit universe and proves the method with a backtest.

## Data
- **Papers:** 33,510 real arXiv papers. **Medicine** = 8,707 papers listed under `physics.med-ph`.
  **Quant** = 24,803 papers in `q-fin.*` (plus `econ.*`). Dates run 1997 to 29 Oct 2026, using each
  paper's *first submission* date. Field membership comes from each paper's full arXiv category list,
  fetched from the arXiv API.
- **Concepts:** research phrases tagged in titles and abstracts by Person A's pipeline
  (`paper_concepts_2026.parquet`, `vocab_2026.csv`). We then:
  - merged spelling variants (for example cone-beam CT → CBCT);
  - removed hub words that appear in more than 10% of a field's papers;
  - removed ~600 reviewed generic or filler phrases ("methodology", "growing interest", ...).
- **A link** = at least one paper mentions both concepts. **A gap** = two concepts of the *same field* with no link.
  Cross-field pairs are never scored; a test checks this.
- **Islands (sub-fields):**
  - Quant: arXiv's own sub-categories (9 islands).
  - Medicine: it has one arXiv category, so concepts are grouped by community detection (Louvain on
    co-occurrence weighted by how surprising the pairing is). This gives 12 islands, named by hand from
    each group's most distinctive concepts.

## Scores
For a gap (u, v), let w be any concept both u and v have already appeared with (a *shared neighbour*), and
degree(w) = how many concepts w is linked to.
- **Resource Allocation (our gap score):** RA = Σ 1/degree(w). Specialised shared neighbours count a lot;
  hubs count little.
- Also shown:
  - common neighbours (how many w);
  - Jaccard (shared ÷ all neighbours);
  - Adamic-Adar (Σ 1/ln degree);
  - preferential attachment (degree(u) × degree(v), i.e. "popular concepts meet");
  - the percentile within the field.

## Backtest
- **Main:** freeze the data at the end of 2018, score **every** never-linked pair of concepts that already had
  ≥10 papers, then check which pairs got a first joint paper between 2019 and 29 Oct 2026. That is
  139,616 pairs in Medicine and 1,349,839 in Quant. No sampling.
- **Rankers:** RA, random, preferential attachment, common neighbours, and a LightGBM model.
  LightGBM is trained only on the past: features at 2014, labels 2015–2018, all positives + 10 negatives
  each, early stopping on a 20% hold-out.
- **Robustness:** cutoffs 2014, 2016, 2018 and 2020, each with a fixed 4-year window.
- **Secondary, pre-registered:** a gap only counts as filled after 2 joint papers.
- **Freezing:** all settings live in `pipeline/config.py`, committed before the first run (`6ab71b8`).
  Every run is appended to `runs.csv` with the commit and a fingerprint of the config.

### Results (precision@100 = how many of the top 100 predicted gaps were really filled)

| | Base rate | RA P@100 | Popularity P@100 | Random P@100 | RA AUC | Popularity AUC | LightGBM AUC |
|---|---|---|---|---|---|---|---|
| Medicine, all pairs | 29.1% | **0.99** | 0.98 | 0.28 | **0.773** | 0.752 | 0.729 |
| Quant, all pairs | 14.7% | **0.93** | 0.93 | 0.15 | 0.753 | 0.719 | **0.764** |
| Medicine, specific concepts* | 31.6% | **0.67** | 0.38 | 0.24 | **0.680** | 0.619 | – |
| Quant, specific concepts* | 10.9% | **0.49** | 0.22 | 0.07 | **0.688** | 0.602 | – |
| Medicine, ≥2 joint papers | 12.8% | **0.93** | 0.93 | 0.14 | **0.832** | 0.811 | 0.785 |
| Quant, ≥2 joint papers | 4.7% | **0.82** | 0.74 | 0.04 | 0.818 | 0.783 | **0.834** |

\*Both concepts at or below the 75th degree percentile and with ≥20 papers at the cutoff. This is the
website's "featured gap" rule, fixed before the first run.

**Robustness:** across all 8 cutoff/field runs, RA has a higher AUC than popularity every time
(Medicine 0.759–0.772 vs 0.740–0.751; Quant 0.764–0.777 vs 0.729–0.738).
LightGBM is mixed. It is below RA in all Medicine runs, and above RA in Quant at 2018 and 2020
(0.776 and 0.804 vs 0.764 and 0.777). It does not clearly beat RA, so RA stays the ranking shown.

**How to read this honestly:**
- On all pairs, popularity alone is almost as good as RA at the very top. Many gaps between two big
  topics get filled simply because both topics are big.
- RA's real advantage shows among *specific* concepts, where it finds about twice as many real hits as
  popularity. Precision there is lower, because specific gaps are genuinely harder to predict.

## Leakage safeguards
1. Every feature uses only papers dated ≤ the cutoff. A test plants a paper one day after the cutoff and
   checks that no feature changes.
2. **Survivorship:** a concept only counts if it had ≥10 papers *by the cutoff*. Without this rule, the
   2018 snapshot would have contained 1,722 Medicine concepts instead of 596 (and 3,132 Quant concepts
   instead of 1,769), most of them only reaching 10 papers after 2018.
3. Medicine islands used in the backtest's `same_land` feature are re-clustered from pre-cutoff papers.
4. `label_date` / `label_paper` are asserted never to be features. No text embeddings are used anywhere.
5. LightGBM trains on an earlier window whose labels end at the test cutoff.
6. **Independent checks** (`qa/hand_checks.py`): 10 exported gaps are recomputed with networkx from raw
   tables, and every example hit's first paper is confirmed inside the window. All pass.

## Limitations
- **"Filled" is a weak event.** It means the two concepts appeared in the same abstract once, which can be a
  passing mention. That is why we also report the stricter 2-paper result.
- **Tagging noise.** Concepts come from automatic phrase tagging: some generic words and unmerged synonyms
  remain, and a few fragments are displayed with fixes ("k-space data").
- **Residual vocabulary lookahead.** Person A's phrase list was chosen using data up to 2026. Our
  10-papers-by-cutoff rule removes most of this effect, not all of it. Person A's 2013-vocabulary file
  would remove it fully.
- **No AI-written text in this build.** No API key was available, so proposals, missions and "why it fits"
  are templates filled with real numbers and real paper titles, and each is labelled as such. With
  `ANTHROPIC_API_KEY` set, `generate_content.py` writes them with Claude from the real abstracts.
- **Illustrative firm.** The industry mission names Marshall Wace only as an illustrative example; it makes
  no claim about the firm.
