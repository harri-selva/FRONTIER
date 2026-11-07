# FRONTIER: build plan (Phase 0)

Status: **waiting for approval.** Nothing below has been built yet. The open questions
in section 9 change what gets built, so please answer them first.

Supporting file: `docs/phase0/data_review.md` (10 sample rows per field, top-100 and
50 random concepts per field, and the list of concepts the 2% rule would remove).

---

## 1. What the inputs actually are

### 1.1 Files that exist
The prompt names an `inputs/` folder (`inputs/data/`, `inputs/style/`, `inputs/ui_reference.png`,
`inputs/ui_prompt.md`). **None of these exist on any branch.** What does exist:

| Source | What it is |
|---|---|
| `data-pipeline` branch: `data/paper_concepts_2026.parquet` | the paper data (below) |
| `data-pipeline` branch: `data/vocab_2026.csv` | the concept vocabulary (below) |
| `data-pipeline` branch: `data/paper_concepts_2026_first_seen.csv` | concept → first date. Not needed (recomputed from the papers), ignored as instructed |
| 4 images attached in chat | style references (section 2) |
| `REDESIGN_TASK.docx` attached in chat | a UI/art spec for *redesigning* an existing site (section 3) |
| `B2` branch | an earlier backtest (`b2/`) whose website was moved to `Prarthana-sudeesh/FRONTIER-2.0`, a repo this session **cannot access** |

### 1.2 `paper_concepts_2026.parquet`: 92,176 rows
| column | type | meaning |
|---|---|---|
| `id` | string | arXiv id (e.g. `0704.0034`, old style `q-bio/0401001`), so the URL is `https://arxiv.org/abs/<id>` |
| `first_date` | timestamp | first submission date (Person A used `versions[0].created`, the original date) |
| `year` | int | year of `first_date` (checked: always equal) |
| `primary_cat` | string | arXiv primary category, e.g. `q-fin.ST`, `physics.med-ph`, `q-bio.NC`, `cs.LG` |
| `concepts` | list of strings | concepts found in title + abstract |
| `n_concepts` | int | length of `concepts` (checked: always equal) |

- Dates: 1992-07-09 to **2026-10-29** (2026 is a partial year).
- 1 duplicate id; 10 papers with zero concepts; concepts per paper mean 18.1, median 18, max 52.
- **Not present: title, authors, abstract, DOI, keywords, the full cross-listed category list.**
  Section 9 Q1 covers this. It is the biggest blocker for the detail panel.

### 1.3 `vocab_2026.csv`: 7,920 concepts
`concept, doc_freq, share_biology, share_finance, share_medicine, spread, raw_df, noun_ratio`.
Built by Person A from **all papers up to 2026** (spaCy noun phrases, ≥5 papers, ≤15%, noun-ratio ≥0.3,
hand-reviewed generic list). `share_*` = share of the concept's papers in each field group, where
Person A's groups were finance = `q-fin`+`econ`, biology = `q-bio`, medicine = `physics.med-ph`.

### 1.4 Which papers are "Medicine" and "Quant"
There is no field column. By primary category:

| primary category | papers |
|---|---|
| `q-bio.*` (quantitative biology) | 35,510 |
| `q-fin.*` (quantitative finance) | 13,876 |
| `physics.med-ph` (medical physics) | 6,239 |
| `econ.*` | 6,148 |
| other (cs, cond-mat, math, stat, physics.*…), cross-listed into one of the above | ~30,400 |

Proposed rule (Option A, recommended):
- **QUANT** = primary `q-fin.*` or `econ.*` (Person A's finance group), plus cross-listed papers
  whose concepts vote finance → **26,505 papers**, 1997 to 2026 (`q-fin` itself starts 2007).
- **MEDICINE** = primary `physics.med-ph`, plus cross-listed papers whose concepts vote medicine
  → **10,487 papers**, 1993 to 2026 (thin before 2005).
- `q-bio` (biology) is **not** used. Biology and Neuroscience stay as "coming soon" planets.
- "Concepts vote" = average of `share_finance / share_medicine / share_biology` over the paper's
  concepts; the highest wins. Spot checks look right (a `math.PR` paper on option pricing votes
  finance; a `stat.AP` paper on breast-cancer chemotherapy votes medicine).

Option B would make Medicine = medical physics + all of quantitative biology (65,666 papers),
giving islands like Neuroscience and Genomics. But most of q-bio is not medicine (evolution, ecology,
protein structure), and it makes the graph 3× bigger. Your call: section 9 Q2.

### 1.5 Measured numbers that shape the backtest
Concepts with ≥10 papers in the field; a link = at least one joint paper.

| field | cutoff | window | alive concepts | graph density | unlinked pairs | newly linked | base rate |
|---|---|---|---|---|---|---|---|
| Quant | 2014 | 4 yrs | 3,323 | 5.5% | 5.2M | 163k | 3.1% |
| Quant | 2018 | 4 yrs | 3,670 | 7.2% | 6.2M | 319k | 5.1% |
| Quant | 2018 | 8 yrs (2019-2026) | 3,670 | 7.2% | 6.2M | 746k | 11.9% |
| Medicine | 2014 | 4 yrs | 1,966 | 4.8% | 1.8M | 86k | 4.7% |
| Medicine | 2018 | 4 yrs | 2,357 | 7.1% | 2.6M | 200k | 7.8% |
| Medicine | 2018 | 8 yrs (2019-2026) | 2,357 | 7.1% | 2.6M | 407k | 15.8% |

Plain English: with ~18 concepts per paper, every paper creates ~150 pairs, so "two concepts
appeared in the same abstract once" is a **weak** event. 5-16% of all unlinked pairs get filled
within 4-8 years. Section 9 Q4 asks whether to use a stricter definition.

---

## 2. Style references, as I understand them

1. **Alien landscape (pixel art)**: deep navy/indigo sky packed with stars; purple-magenta nebula;
   a black eclipse planet with a hot orange-white corona; rust-red planets; jagged mountains in
   cyan/teal with orange rim light; a reflective lake. Saturated, limited palette, visible dithering.
2. **Classic 16-bit space scene**: black space, sparse white cross-shaped stars, a large blue
   cloud-swirled planet in the foreground, an olive-grey cratered moon and a blue banded crescent
   planet. Hard day/night edges, dithered shading, console-era look.
3. **Modern pixel solar system**: navy space with grey-purple dust clouds, multicoloured diamond
   stars; a big orange-yellow banded gas giant, small orange, lavender and blue planets, a huge blue
   cratered ringed planet cut off at the edge.
4. **Aerial photo of tropical islands** (not pixel art; stock-photo watermarks): deep blue ocean →
   turquoise reef shallows → white surf → green hills. I read this as the *composition and
   colour zones* for the planet view, to be redrawn as pixel art, not copied.

Derived art direction:
- **Resolution**: scenes render at 640×360 internal pixels and scale up by a whole number
  (×2 = 1280×720, ×3 = 1920×1080, ×6 = 4K), nearest-neighbour only. No blur, no smooth gradients;
  gradients are dithered.
- **Palette (~28 colours, one palette file + CSS variables)**: space navy `#0b0e2a` `#141a3f`, indigo `#24245e`,
  purple `#3d2a7a`, violet `#6b3fa0`, magenta `#c13b8a`, pink `#f06aa8`, orange `#f28c28`,
  gold `#ffc94a`, cream `#fff4c2`, white; cyan `#39d0e8`, teal `#1c8a9e`; ocean deep `#0d3b66`,
  ocean `#1565a8`, shallows `#2fa4c8`, reef `#5fd3c8`, foam `#e8fbff`; sand `#e8c98a`;
  grass `#2f6b3a` `#4fa04a` `#9ad25a`; rust `#a8452e`, red `#e04a3a`; olive-grey `#7a7a5a`;
  slate `#4a5378` `#8a94b8`. Final values are tuned against the references in build.
- **Type**: "Press Start 2P" (titles/HUD, used sparingly because it is wide) and "VT323" or
  "Pixelify Sans" for body text in panels; both open licence, self-hosted.
- **Motion**: twinkling parallax stars, slow galaxy rotation, planets spinning (scrolling surface
  texture inside a pixel sphere mask), looping wave tiles, surf foam, water droplets/splash
  particles at shorelines, zoom-dive transitions with a pixel-dissolve.

**UI reference**: `inputs/ui_reference.png` was not provided, so I can't describe it.
See section 9 Q3.

---

## 3. The UI spec and conflicts

`inputs/ui_prompt.md` does not exist. The attached **REDESIGN_TASK.docx** is the only detailed UI
spec, so I propose treating it as the primary UI spec. Summary: four zoom levels
(Galaxy → Planet → Land → Detail panel) with warp/dissolve transitions, breadcrumbs, ESC/back,
shareable hash URLs; a boot sequence; 12-16 original planets (2 live with a beacon/satellite and hover
stats, the rest "COMING SOON" / "SIGNAL NOT FOUND"); animated ocean islands sized by papers with a
cue for islands with many gaps; a pixel-island network with solid links, animated dashed gap links,
"bridge" markers to other islands, pan/zoom/drag, hover-highlight, sparse labels, legend;
an RPG-dialog detail panel with 5 tabs (PAPERS, GAPS, WHY IT FITS, PROPOSAL, MISSIONS);
VALIDATION (#backtest), RESEARCH GAPS/LEADERBOARD (#gaps), HOW IT WORKS (#method);
retro UI kit, optional CRT and sound (off by default), reduced-motion support, keyboard navigation,
1280×720 to 4K.

Conflicts between the docx and your chat prompt:

| # | Topic | Chat prompt | Docx | Proposal |
|---|---|---|---|---|
| C1 | Task | build the whole project **here** | **redesign** the existing site in another repo (audit → `qa/before/`) | Build here from scratch; that repo isn't reachable. **Q5** |
| C2 | Backtest | main cutoff 2018 → 2019-2026; robustness 2014/16/18/20; LightGBM; RA primary | "keep the backtest we've already built" (B2: train 2013/test 2016, robustness 2012-2018, popularity as the key baseline) | Follow the chat prompt (newer, RA-centred). **Q6** |
| C3 | Hosting | Vercel/Netlify | GitHub Pages, hash routing, relative paths | Hash routing + relative paths: works on all three |
| C4 | Planets | 2 + ~10-14 | 12-16 total | 14 total (2 live + 12) |
| C5 | Detail panel | sections a/b | 5 tabs | Use the 5 tabs; same content |
| C6 | Extra scope | — | boot sequence, leaderboard, method page, CRT, sound, keyboard, 4K | Include; sound/CRT last |
| C7 | Example islands | — | "Neuroscience, Oncology" | Use the real derived lands (no oncology island in the data) |
| C8 | Concept filter | ≤ ~2% of papers | — | **Q7**: 2% removes the core vocabulary |

---

## 4. Lands (islands)

### QUANT: use arXiv sub-categories (primary-category counts; cross-listed papers join the nearest land)
| land | from | papers (primary) |
|---|---|---|
| Statistical Finance | q-fin.ST | 2,404 |
| Mathematical Finance | q-fin.MF | 2,052 |
| General Finance | q-fin.GN (+ EC: 1) | 1,763 |
| Risk Management | q-fin.RM | 1,677 |
| Computational Finance | q-fin.CP | 1,656 |
| Portfolio Management | q-fin.PM | 1,514 |
| Trading & Market Microstructure | q-fin.TR | 1,444 |
| Pricing of Securities | q-fin.PR | 1,366 |
| Economics & Econometrics | econ.GN/EM/TH | 6,148 |

The 6,481 cross-listed finance papers join the land whose concept profile they match best.

### MEDICINE: one arXiv category, so lands come from clustering
Method: concept co-occurrence graph (weighted by PMI, i.e. how much more often two concepts appear
together than chance), Louvain community detection, each paper goes to the community most of its
concepts belong to, and names come from each community's *most distinctive* concepts. First run
(resolution 1.5) gives these clean groups; I named them by hand:

| proposed land | papers | distinctive concepts (from the data) |
|---|---|---|
| Cardiovascular Biomechanics | 1,397 | artery, wall shear stress, aneurysm, aorta, stenosis, blood flow |
| AI for Medical Imaging | 1,386 | convolutional neural network, dice score, data augmentation, medical image |
| Proton & Radiation Therapy | 1,305 | proton therapy, carbon ion, Bragg peak, VMAT, treatment plan |
| Ultrasound & Photoacoustics | 992 | transducer, ultrasound imaging, photoacoustic imaging, frame rate |
| Nanomedicine & Drug Delivery | 979 | nanoparticle, drug delivery, hyperthermia, scaffold, biosensor |
| CT & MRI Reconstruction | 911 | compressed sensing, MRI reconstruction, CT reconstruction, parallel imaging |
| Diffusion MRI & Brain Microstructure | 910 | diffusion MRI, white matter, myelin, tractography, fractional anisotropy |
| Medical Software & AI Tools | 790 | large language model, python, software tool, developer |
| Radiomics & Outcome Prediction | 610 | radiomic feature, survival prediction, feature selection, SHAP |
| PET & Radiation Detectors | 537 | PET scanner, scintillator, coincidence, time resolution |
| Airborne Infection & COVID-19 | 207 | airborne transmission, COVID-19, aerosol, face mask |
| EEG & Epilepsy | 167 | epileptic seizure, EEG, source localization, electrical stimulation |

The 9 smaller communities (<150 papers each) merge into their nearest land. Names will be
re-checked after the final concept filter.

**Lookahead note:** this clustering uses all papers to 2026. That's fine for *display*, but the
`same_land` *feature* in the backtest would then use the future. So in backtests, `same_land`
uses a concept→land map fitted only on papers ≤ cutoff (Quant's arXiv sub-categories have no such issue).

### Concepts within a field
- Per field, concept ids 0..N-1; a phrase used in both fields (e.g. "network") becomes two separate
  nodes, one per planet. This makes cross-field gaps impossible by construction, and a test checks it.
- **Primary land** = the land where the concept appears in the most papers.
- A gap whose two concepts have different primary lands is a **cross-land gap** (highlighted).

---

## 5. Data pipeline (Python, `pipeline/`)

```
pipeline/
  frontier_data.py      Person A's script (unchanged)
  config.py             ALL frozen settings (cutoffs, windows, filters, seeds, LightGBM params)
  fetch_inputs.py       copies the 2026 files from the data-pipeline branch into data/raw/
  prepare.py            load, dedupe, field assignment, concept tables (0..N-1 per field), lands
  graph.py              B1 code moved here: DuckDB edges, snapshot, blockwise candidates, features, labels
  backtest.py           main + robustness per field; 5 rankers; metrics; example hits; runs.csv
  current_gaps.py       features at the latest cutoff; top gaps per land and per field
  generate_content.py   Anthropic SDK at build time (cached JSON) or templated fallback
  export_web.py         static JSON into web/public/data/
tests/                  toy tests (B1) + new tests (below)
```

1. **Clean**: drop the duplicate id (keep the earliest date), drop the 10 papers with no concepts,
   and report every drop in `outputs/cleaning_report.md`.
2. **Concepts**: use Person A's concept lists (no keywords column exists). Fix the `cros`
   singularisation bug, merge obvious synonyms (e.g. `mri` ↔ `magnetic resonance imaging`,
   `ct` ↔ `computed tomography`) with a small reviewed alias table, and apply the frequency filter (Q7)
   plus a reviewed generic stop-list (`period`, `world`, `methodology`, `design`…).
3. **Graph**: DuckDB self-join → `(u, v, first_date, first_paper, n_papers)`, as in B1.
   Papers with >30 concepts (4,245 papers) are capped at 30. Proposal: keep each paper's 30 *most
   specific* concepts (rarest), not the lowest ids.
4. **Features at a cutoff**: B1's cn, jaccard, aa, ra, pa, deg min/max, recent/growth/age min/max,
   plus `same_land` and `is_2hop`. Chunked scipy.sparse; A@A only ever in row blocks.
5. **No lookahead**:
   - **Survivorship fix**: at cutoff *t*, a concept is "alive" only if it already had ≥10 field
     papers dated ≤ *t*. Without this, concepts that only became popular *after* *t* are
     guaranteed to be in the vocabulary, which inflates results.
   - Residual leak, stated in METHOD.md: Person A picked the *phrase list* using 2026 data.
     The ≥10-papers-by-cutoff rule removes most of the effect; the only fully clean alternative is
     Person A's 2013 vocabulary file (which you told me to ignore).
   - `label_date` / `label_paper` asserted never to be features (same assertion as B1).
6. **Current gaps**: features at 2026-10-29 (end of data), ranked by RA, top N per land and per field.

### Tests (pytest)
- Toy dataset with hand-computed expected values for **every** feature, including `same_land`
  (extends B1's existing tests).
- Future-edge leakage test.
- Planted paper dated **one day after** the cutoff: no feature changes.
- **No cross-field pairs**: every candidate/gap has both concepts in the same field.
- Survivorship test: a concept that reaches 10 papers only after the cutoff is not a candidate.
- Export checks: every number in the exported gap JSON matches a recomputation from raw edges.

---

## 6. Backtest design

Per field, separately.

- **Main**: features at end of 2018; label = first joint paper in 2019-01-01 … 2026-10-29
  (7.8 years; 2026 is partial). 2018 leaves enough future to observe and enough past to learn from.
  Medicine before 2005 is too thin for earlier main cutoffs.
- **Robustness**: cutoffs 2014, 2016, 2018, 2020 with a fixed **4-year** window (2020 → 2021-2024,
  all complete years).
- **Evaluated on ALL unlinked alive pairs**, not a sample (2.6M Medicine, 6.2M Quant at 2018).
  That makes base rate, precision and AUC exact, which is a strong point for judges.
- **Rankers**: Resource Allocation (primary), random, preferential attachment, common neighbours,
  LightGBM.
- **LightGBM**: trained at an earlier cutoff whose labels end at the test cutoff (main: features
  2014, labels 2015-2018; robustness cutoff *c*: features *c*-4, labels *c*-3 … *c*). All positives
  + 10 negatives each; early stopping on a 20% hold-out from that training period only.
  The test period is never touched in training.
- **Metrics**: base rate, precision@20 / @100 / @1000, AUC, lift@100, plus 95% confidence intervals
  for precision@k, so a 0.90 vs 0.85 difference isn't oversold.
- **Freezing**: all settings in `pipeline/config.py`, committed **before** the first test-period run.
  Every run appends to `runs.csv` (timestamp, git commit, config hash, field, cutoff, ranker,
  metrics). Rerunning with changed settings is visible in the log.
- **Example hits**: 3-5 per field from RA's top 100 at 2018: concept pair, year predicted, first
  paper that filled it (arXiv id and date), lead time. Each one is checked to be dated inside the
  window.
- **Sanity checks**: predictions dominated by hub concepts (report how many of the top 100 share one
  concept); shuffled-label run should give AUC ≈ 0.5.
- If LightGBM clearly beats RA, I report it and ask before showing a combined score (as instructed).

---

## 7. Content generation (`pipeline/generate_content.py`)
- With `ANTHROPIC_API_KEY`: build-time calls only for what the UI shows (≈ top gaps × 2 fields,
  and the papers they reference). Prompts include the actual numbers, shared neighbours and
  paper text, with instructions not to invent citations or facts. Results cached in
  `pipeline/cache/content.json` (rerun = no repeat calls). Key never in the repo or frontend.
- **No key is set in this environment.** Without one: templated text from the numbers
  ("These two concepts share 14 neighbours, including X, Y, Z…"), clearly labelled as templated.
- **Paper summaries need abstracts, which the data doesn't have** (Q1). Without abstracts I can't
  summarise a paper at all; the panel would show arXiv id, date, link and the paper's concepts only.

---

## 8. Frontend (`web/`)

- **Stack**: Vite + React + TypeScript; **PixiJS v8** for the galaxy, planet and island scenes.
  Why Pixi: GPU-drawn sprites at 60fps, crisp nearest-neighbour scaling, an easy low-res render
  target scaled by whole numbers, and it handles thousands of particles (stars, waves, droplets).
  React handles HTML UI (HUD, breadcrumbs, panels, tables), where text must be selectable,
  accessible and readable.
- **Art**: all original and procedural, generated in TypeScript at load time: planets via a pixel
  sphere mask over noise-generated surface textures (ringed, cratered, gas, ice, lava, ocean),
  dithered shading; islands from a height-map (land → sand → reef → shallows) with stepped
  pseudo-3D cliffs and drop shadow; wave tiles, foam and droplet sprites; star layers.
- **Network**: layout **precomputed in Python** (force layout per land, fitted inside the island
  shape) so it is deterministic and instant; Pixi draws nodes as glowing crystals, solid
  links, animated dashed gap links, bridge markers at the island edge; a dithered **heat glow**
  under nodes so busy areas are brighter. Show the top ~80-150 concepts per land by size.
- **Routing**: hash URLs (`#/galaxy`, `#/quant`, `#/quant/risk-management`,
  `#/quant/risk-management/c/123`, `#/gap/…`, `#/backtest`, `#/gaps`, `#/method`).
- **Data loading**: `fields.json` up front; per-field and per-land JSON lazily.
- **Deploy**: `npm run build` → static `web/dist/`, works on GitHub Pages, Netlify and Vercel.

### Export JSON (`web/public/data/`)
`fields.json`, `<field>/lands.json`, `<field>/land_<id>.json` (concepts with size and
position, edges, gaps with all numbers and text), `<field>/papers_<land>.json` (referenced papers
only), `<field>/backtest.json` (main metrics, robustness table, example hits), `gaps_top.json`
(leaderboard). Target: every file < 500 KB.

### QA
`pytest` green; `npm run build` with no TypeScript errors and no console warnings; Playwright
click-through (boot → galaxy → coming-soon planet → Medicine → island → concept → each tab →
gap → Validation; same for Quant; deep-link reload; ESC/back) with screenshots in
`qa/screenshots/`, reviewed against the style references; 5 gaps hand-checked against raw
edges; 5 backtest hits checked against the label window.

Deliverables: README.md, DEMO.md, METHOD.md as specified.

---

## 9. Open questions (answers change the build)

**Q1. Paper titles, authors and abstracts are missing (blocker for the PAPERS tab, summaries,
"why it fits" and proposals).** Options:
  - **(a) Recommended:** Person A has the arXiv Kaggle file. They export a slim
    `papers_meta.parquet` (id, title, authors, abstract, doi, categories) for these 92k papers and
    commit it to the data-pipeline branch. It also restores the cross-listed categories, which
    makes field assignment exact.
  - (b) Allow this environment to reach `export.arxiv.org` (currently blocked); I fetch metadata
    for only the papers the site shows (a few thousand, batched, rate-limited).
  - (c) Neither: papers show arXiv id, date, link and concepts only; no summaries.

**Q2. Medicine definition**: Option A (medical physics + medicine-voting cross-lists, 10.5k
papers, the 12 lands above) or Option B (also all quantitative biology, 65.7k papers)?
Recommended: A.

**Q3. UI reference**: `inputs/ui_reference.png` and `inputs/ui_prompt.md` don't exist. Please
upload them, or confirm the docx is the UI spec.

**Q4. What counts as a link / a filled gap?** Spec: ≥1 joint paper. Because papers carry ~18
concepts, one passing co-mention fills a gap. Recommended: keep ≥1 as the main definition (as
specified), and pre-register **≥2 joint papers** as a secondary result, both frozen before the
first test run. Or make ≥2 the main one.

**Q5. Build here or redesign the existing site?** The docx describes redesigning
`Prarthana-sudeesh/FRONTIER-2.0`, which this session can't access. Recommended: build
the new site here in `web/`. If you want the existing site reused, ask its owner to give the
Claude GitHub app access to that repo.

**Q6. Backtest settings**: the chat prompt (2018 main; 2014-2020 robustness; LightGBM) or B2's
existing ones (2013/2016; 2012-2018)? Recommended: the chat prompt, with RA as primary.

**Q7. Concept frequency filter**: the specified "≤ ~2% of papers" removes 165 Quant and 200
Medicine concepts, including **volatility, portfolio, option, stock market, deep learning,
tumor, radiotherapy, MRI, computed tomography**. Recommended: ≥10 papers and **≤10%**, plus
a reviewed stop-list for generic words. That drops `market, price, risk, image, patient` but
keeps the core vocabulary. See `docs/phase0/data_review.md` for the full list.

**Q8. Display filter**: hub concepts produce many top-RA gaps. Recommended: the backtest uses all
concepts (honest), while the UI's *featured* gaps require each concept to be reasonably specific
and no concept to appear in more than 3 of a land's top 10. Both are shown and labelled.

**Q9. Content API key**: none is set here. Should I build with templated text and you run
`generate_content.py` with your key later, or will you add the key to this environment?

**Q10. Branch**: I'll keep working on `B1/Neriyan` unless you want a new branch for the full app.

---

## 10. Build order (after approval)
1. Pipeline: fetch → prepare → graph → tests (no test-period runs yet).
2. Freeze `config.py`, commit, then run the backtests; log to `runs.csv`.
3. Current gaps + content generation + export.
4. Frontend: palette/fonts/UI kit → galaxy → planet → land network → detail panel →
   Validation/Gaps/Method → boot, keyboard, reduced motion → CRT/sound.
5. QA (Playwright, hand checks), then README / DEMO / METHOD.
