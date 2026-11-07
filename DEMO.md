# FRONTIER: 3-minute demo path

Open the site full-screen. Everything below is one click (or one key) away. ESC always goes up one level.

## 0:00 – Boot and galaxy (20 s)
- Let the boot text run ("2 WORLDS CHARTED"), then press any key.
- **Say:** "Every planet is a research field. Two worlds are live, built from 33,510 real arXiv papers."
- Hover **Physics** → "COMING SOON". Click it → "SIGNAL NOT FOUND… SECTOR UNDER CONSTRUCTION".
- Hover **Quant**: 24,803 papers, 9 sub-fields, 3,344 concepts.

## 0:20 – Quant planet (20 s)
- Click **Quant** (the camera dives in).
- **Say:** "Each island is a sub-field; size is paper count; flags mark the islands with the most open gaps."

## 0:40 – An island and a gap (60 s)
- Click **Pricing of Securities**.
- **Say:** "Crystals are concepts, glow is research volume, solid lines were studied together, and the
  glowing dashed lines are predicted gaps: pairs that have *never* been in the same paper."
- Best gap to open: **pricing problem + vanilla option**. It's #1 in Quant on the leaderboard:
  RA 0.446, 252 shared neighbours. Direct link: `#/quant/pricing-of-securities/g/quant-3628-4929`.
  - **GAPS tab:** "RA adds 1 ÷ degree for every shared neighbour. Here is each neighbour, its degree, its
    contribution, and the total."
  - **PROPOSAL:** the suggested title and abstract, clearly labelled as generated.
  - **MISSIONS:** PhD, Masters and an industry example (illustrative only).
- Backup Quant gap: **Asian option + volatility process** (Pricing of Securities ⇄ Mathematical Finance,
  a cross-island bridge). Link: `#/quant/pricing-of-securities/g/quant-195-4987`.

## 1:40 – Proof (60 s) → click ▶ VALIDATION (top right, on every screen)
- **Medicine:**
  - In 2018 we ranked 139,616 never-linked pairs. Of our top 100, **99** were studied together by
    Oct 2026. Random picks got 28.
  - Specific concepts only: **67/100** vs popularity 38 and random 24.
- **Quant:**
  - Top 100 of 1,349,839 pairs: **93** filled (random 15).
  - Specific concepts only: **49/100** vs popularity 22 and random 7.
- **Example hits to read out:**
  - Quant: predicted in 2018, **Asian option + local volatility**. Filled 0.9 years later by
    *"Hedging short-maturity Asian options in local volatility models"* (arXiv 1911.12944).
  - Medicine: **pencil beam + VMAT**. Filled 3.9 years later by *"Recent Advancements of Artificial
    Intelligence in Particle Therapy"* (arXiv 2211.09038).
  - Medicine: **deposition + neutron**. Filled 2.2 years later by *"Bragg-Curve Simulation of Carbon-Ion
    Beams for Particle-therapy Applications"* (arXiv 2102.12743).
- **Robustness table:** "RA beats popularity in AUC at every cutoff, 2014–2020, in both fields."
- **Stricter test:** "Even counting a gap as filled only after 2 joint papers: Medicine 93/100, Quant 82/100."
- **Run record:** "Settings were committed before the first run; every run is in runs.csv."

## 2:40 – Medicine in 20 s
- GALAXY → **Medicine** → **Radiotherapy Planning**.
- Open the leaderboard's #1 Medicine gap, **adaptive radiotherapy + dose volume histogram**
  (RA 0.385, 167 shared neighbours): `#/medicine/radiotherapy-planning/g/medicine-63-1221`.

## Likely questions
- **"Isn't this just popularity?"**
  On all pairs, popularity is nearly as good at the top. Among specific concepts, RA finds about twice as
  many real hits. Both tables are on the Validation page.
- **"Lookahead?"** Point to the leakage panel:
  - the planted-paper test;
  - concepts must have 10 papers by the cutoff;
  - the model is trained on earlier years only.
- **"Did an AI write the proposals?"** Not in this build. They are templates filled with real numbers and
  titles, labelled as such. Claude generation is wired in for when an API key is set.
