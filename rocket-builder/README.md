# Exoplanet Rocket Builder

A web game for NASA Space Apps. You are a newly appointed NASA rocket scientist: pick a difficulty, pick a
real exoplanet from the NASA Exoplanet Archive, read the mission brief, build a rocket by drag-and-drop,
launch it, and get a scored explanation of why it succeeded or failed. Every mission is a return trip:
Earth → exoplanet → Earth. Each difficulty is a run of 10 attempts; the average goes on that difficulty's
leaderboard.

Style: a papercraft diorama. Each scene is a real 3D stage (CSS 3D perspective) filled with flat cut-paper
sprites: white paper edges, cast shadows, paper grain, string-hung parts that sway. The palette is
construction paper in space purples, bubblegum pink and pastels. All artwork is original and drawn in code
(SVG); the guide is Pip, an original paper robot. The look is a general papercraft style, not a copy of any
existing game's characters, art or UI.

Made for kids: each planet shows 3 big facts (distance, temperature in °C, gravity) with the rest behind
"More facts"; parts show icon bars and colour-matched fuel stickers instead of raw numbers; Pip gives one
plain-language tip at a time; results use 0–3 stars, and every number stays one tap away under "See the
science". Real data is stamped "Real NASA data" and invented parts "Pretend tech".

The previous vaporwave-arcade version is in git history at commit `ad076d5`.

## Run it

Requires Node 18+.

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm test
```

- `npm run dev`: dev server at http://localhost:5173
- `npm run build`: type-checks, then writes static files to `dist/` (relative paths, so it can be hosted from any folder, e.g. GitHub Pages)
- `npm test`: Vitest unit tests for the physics, scoring, animation mapping, run average, curated data and name filter

## Space map: what is accurate

The planet picker is a zoomable 3D paper star map with four levels (drag to spin and tilt; + / − or
ctrl/pinch-wheel to zoom):

| Level | What is real | What is drawn for clarity |
| --- | --- | --- |
| Star system | Every planet the archive lists for that star; orbit sizes to scale (semi-major axis, AU); star radius to the same scale where it is big enough to see; relative orbital speeds from the real periods; **where each planet is on its orbit today**, from the measured transit/conjunction time (`pl_tranmid`) and period, with the uncertainty propagated (`σ = √(σT² + (n·σP)²)`); the direction toward Earth (at conjunction the planet is between its star and Earth) | Orbits drawn as circles (eccentricities of the curated planets are small); planets enlarged; small stars enlarged (said on screen); dashed orbit + "?" when the position is unknown (no timing in the archive, e.g. Ross 128 b) or uncertain by more than 45° (e.g. GJ 1002 b); which way round the orbit is viewed |
| Our star neighbourhood | Each host star's position from its galactic longitude, latitude and distance, converted to 3D (x toward the Galactic Centre, y toward l = 90°, z toward the North Galactic Pole); stalks show real height above/below the galactic plane; distance rings in light-years | Star dot sizes and colours (colour from temperature, approximate) |
| Milky Way | Sun–Galactic Centre distance 8.178 kpc (GRAVITY Collaboration 2019); the circle around the Sun is the real radius that contains this rank's planets | Spiral arms, bar and disc size are an illustration (stated on screen) |
| Nearby galaxies | Positions from galactic coordinates and measured distances: LMC 49.59 kpc (Pietrzyński et al. 2019), SMC 62.44 kpc (Graczyk et al. 2020), Andromeda 761 kpc (Li et al. 2021), Sagittarius Dwarf ≈ 26 kpc, Triangulum ≈ 0.85 Mpc (published values span ~0.80–0.95) | Galaxies drawn much bigger than real (stated) |

Positions are top-down onto the galactic plane. Planet surfaces are artwork: no exoplanet in the game
has been imaged as more than a point of light, and none has known rings, so none are drawn. Labels are
drawn in a flat layer that follows the 3D anchors each frame, so they never hide behind the map.

The star-system data comes from `src/data/systems.json`, written by `npm run fetch-planets` (every
planet around the 23 curated host stars, plus galactic coordinates, star radius and temperature,
transit/conjunction times and their uncertainties). Tests in `src/data/space.test.ts` check the
coordinate conversion, the Julian date, the orbit phase and its uncertainty cut-off.

## Secret Project (story mode for learning the maths)

From the title screen, **Secret Project** opens *Operation Lantern*: nine "top-secret files" that unlock in order.
Each file has a short story, the formula on a chalkboard, an interactive experiment, a "your turn" question
(with "show me how" working), and a real-data example computed live from the game's NASA snapshot.

| File | Maths | Real example |
| --- | --- | --- |
| 1 The distance trick | parallax: d (pc) = 1 ÷ p (arcsec) | Proxima Centauri ≈ 0.768″ → 1.30 pc (archive 1.301) |
| 2 Very long trips | time = distance ÷ speed | Voyager 1 at 17 km/s ≈ 17,600 years per light-year |
| 3 A planet's shadow | transit depth = (Rp ÷ R★)² | TRAPPIST-1 e dims its star ≈ 0.5% |
| 4 Kepler's clock | a³ = M★ × P² (AU, Suns, years) | reproduces TRAPPIST-1 e's archived orbit within 1% |
| 5 Weighing a planet with AI | the machine-learning model below | "beat the AI" on held-out game planets |
| 6 Gravity check | g = M ÷ R²; v ≈ 7.9 √(M ÷ R) km/s | every game planet |
| 7 The rocket equation | Δv = Isp × 9.81 × ln(m₀ ÷ m₁) | why real engines can't land on Earth-size worlds |
| 8 The lift-off rule | TWR = thrust ÷ (m × 9.81) ≥ 1.2 | |
| 9 Operation Lantern | everything: pick engine and tanks, predict the outcome, then launch **once** | TRAPPIST-1 e |

The final launch is recorded and cannot be repeated (the hub has a "shred the files" reset that erases
everything, for classrooms or testing). Progress is stored in this browser only. `src/story/answers.test.ts`
checks every quiz answer and real-data example against the formulas.

## Machine-learning model: predicting planet mass

`ml/` trains a model that predicts a planet's **mass** from things measurable without weighing it: radius,
orbital period, equilibrium temperature, and the star's mass and temperature. It is used in Secret Project
file 5 and in "More facts" on planets with a measured radius.

- **Data:** 1,750 NASA Exoplanet Archive planets that transit (measured radius) and have a measured mass
  (`pl_bmassprov = 'Mass'`: no minimum masses, no mass-radius estimates, which would be circular).
  `ml/fetch_training_data.py` → `ml/data/training.csv` (committed).
- **Leakage control:** the game's own planets (16 of them are in this data) are held out entirely.
- **Split:** 70/15/15 train/validation/test (seed 42). Model selection uses validation only; the test set is
  used once.
- **Model:** ensemble of 5 scikit-learn MLPs (ReLU), architecture and L2 strength chosen on validation from a
  small grid (selected: 64→32 hidden units, α = 0.001). Target: log₁₀ mass.
- **Uncertainty:** ensemble variance + residual variance, scaled on the validation set so ±1σ covers 68%.
- **Export:** weights to `src/data/mass-model.json`; `src/ml/massModel.ts` runs the forward pass in the browser
  (no ML library). A parity test checks it matches scikit-learn to < 2×10⁻⁴ dex.
- **Out-of-experience check:** the browser counts training planets within a fixed distance in standardised
  feature space and warns when there are fewer than 5.

Test-set results (`ml/report.md`, regenerated by training):

| Model | RMSE (dex) | Median abs. error | Within ×2 |
| --- | --- | --- | --- |
| MLP ensemble | 0.489 | 56% | 60.9% |
| Radius-only broken power law (baseline) | 0.519 | 60% | 60.2% |
| Training median (baseline) | 0.986 | 98% | 14.2% |

Calibrated coverage on test: ±1σ 70.5% (target 68.3%), ±2σ 90.8% (target 95.4%: real masses have heavier
tails than a Gaussian). Permutation importance: radius dominates, then star mass, equilibrium temperature,
period, star temperature.

Limitations, stated plainly: the gain over the radius-only rule is modest (~6% lower RMSE, about the same
within-×2 rate), because planets of the same size can have very different compositions. Known failure: an
Earth twin is predicted at ~9.9 M⊕ because no similar planets (small, long orbit) have measured masses; the
game flags this as out of experience.

Reproduce:

```bash
python3 -m venv ml/.venv && ml/.venv/bin/pip install -r ml/requirements.txt
```

```bash
ml/.venv/bin/python ml/fetch_training_data.py
```

```bash
ml/.venv/bin/python ml/train_mass_model.py
```

Behind a strict firewall, download the URL from `--print-url` with curl and pass it with `--from-json`.

## Refresh the planet data

The game never calls the archive at runtime. `src/data/planets.json` is a committed snapshot.

```bash
npm run fetch-planets
```

This queries the NASA Exoplanet Archive TAP service (`pscomppars`, JSON), keeps planets with non-null
distance, radius, mass and equilibrium temperature, and records the fetch date (shown in the UI as
"Data: NASA Exoplanet Archive, retrieved <date>"). Current snapshot: 5,839 planets, retrieved 2026-11-09.

Behind an HTTPS proxy, Node's `fetch` ignores `HTTPS_PROXY` unless you run with `NODE_USE_ENV_PROXY=1`
(Node 22.21+ / 24).

The full snapshot stays in the repository; a small Vite plugin (`vite.config.ts`) strips it down to the
24 curated planets when bundling, so the app download is about 100 KB gzipped instead of ~1.6 MB.

If you change `src/data/difficulty-sets.ts`, run the tests (they check the curation rules) and the solver
(below) to confirm every destination is still winnable.

## Animation files

Put the three hand-drawn clips in `public/animations/` as `takeoff`, `explosion` and `orbit_arrival`.
Video (`.webm`/`.mp4`), animated image (`.gif`/`.webp`/APNG), Lottie (`.json`) and PNG frame sequences are
all supported; see [`public/animations/README.md`](public/animations/README.md). No code changes are
needed.

Without the files, the launch plays as a sequence of animated paper dioramas: a 10-second flip-card
countdown, lift-off with the camera rising past paper clouds, warp travel through layered star fields,
landing on the planet's horizon or orbiting it, the trip home, and a parachute splashdown with confetti.
Failures have their own versions: an explosion into paper shards, sputtering out of fuel, static and
"Signal lost", overheating. When all three hand-drawn clips are present, they play instead, in a paper
frame, following the same mapping.

Outcome → playback (implemented in `src/engine/animation.ts`, tested):

| Failure point | Playback |
| --- | --- |
| Launch (TWR < 1.2, over pad mass, pressure failure) | `explosion` only |
| Transit (Δv can't reach orbit, drive range, comms, crew radiation) | `takeoff` → `orbit_arrival` cut at 45% → "Signal lost" / "Out of fuel" overlay |
| At the planet (heat, can't land/take off or leave orbit) | `takeoff` → `orbit_arrival` (full) → failure overlay |
| Return leg (Δv margin, re-entry heat) | `takeoff` → `orbit_arrival` → "Return journey" on static space → failure overlay |
| Success | `takeoff` → `orbit_arrival` → "Return journey" → "Splashdown / Mission complete" |

A "Skip" button is always visible. With calm motion (the OS reduced-motion setting or the in-game toggle),
the countdown is skipped and each scene shows as a still for about 1.8 seconds.

## NASA logos

The brief asked for none; a later request asked for NASA logos. The game does not include NASA's
insignia ("meatball"), logotype ("worm") or seal. These marks are protected (14 CFR Part 1221), NASA's media
usage guidelines don't allow them on non-NASA products without written permission, and NASA Space Apps asks
participants not to use them. The game uses Pip, an original paper robot, as its badge instead, and refers to NASA and
its data in text. If your team gets written permission, drop the file at `public/branding/logo.svg` (or
`.png`) and it replaces the Pip badge in the header.

## Physics model and simplifications

All maths is in `src/engine/` (pure TypeScript, no React) and shown in-game under "How the maths works".

| Item | Model | Status |
| --- | --- | --- |
| Distance | light-years = parsecs × 3.2616 | derived from real data |
| Surface gravity | g = M / R² (Earth units) | derived |
| Orbital velocity | v ≈ 7.9 km/s × √(M / R) | derived |
| Planet type | R ≤ 1.6 R⊕ → likely rocky (land and return); larger → gas/ice-rich (orbital survey) | gameplay simplification |
| Δv available | Tsiolkovsky: Δv = Isp × 9.81 × ln(m₀ / m_f) with the launch engine's Isp | real equation |
| Staging | Stacked tanks are drop tanks: bottom burns first, empty tanks are jettisoned; each tank is one Tsiolkovsky step. One engine is shared. | gameplay simplification |
| Launch | TWR = thrust / (m₀ × 9.81) ≥ 1.2; launch mass ≤ 350 t (pad limit); Hard: pressure system present, compatible, big enough | gameplay rules |
| Earth to orbit | 9.4 km/s | real approximate figure incl. losses |
| Rocky planet | land + ascent = 2 × 1.2 × v_orb | brief's model |
| Gas/ice planet | insertion + departure = 2 × 0.25 × v_orb (the drive drops the craft in a loose high orbit) | gameplay assumption |
| Return | 0.5 km/s corrections; re-entry handled by the heat shield | gameplay assumption |
| Return-leg mass | Total Δv sum × 1.1 margin must be met. Failure phase = first threshold missed: < 9.4 km/s → transit ("out of fuel before orbit"); < launch + planet → at the planet; < full total × 1.1 → return leg | documented method |
| Transit | Deep-Space Drive range ≥ 2 × distance | fictional tech |
| Comms | comms range ≥ distance (Medium, Hard) | gameplay rule (most comms parts fictional) |
| Heat | protection max temp ≥ equilibrium temp and ≥ 1,500 K for Earth re-entry (Medium, Hard) | gameplay rule; 1,500 K is approximate (Shuttle tiles peaked ~1,530 K) |
| Crew | 1,000 kg per astronaut; Hard + crew needs radiation rating ≥ 4 | gameplay assumption |

### The finding behind the fictional engines

With the brief's numbers, landing on and leaving an Earth-size world costs about 19 km/s. Adding Earth
launch and the 10% margin, the easiest rocky target (TRAPPIST-1 e) needs 29.0 km/s; Proxima Cen b needs
32.1 km/s. The best real chemical engine (hydrogen/oxygen, Isp ≈ 450 s) with three drop tanks reaches
about 11 km/s with a light payload in this game, and 12.1 km/s with no payload at all. So no real engine
can complete any mission here. That is the physics, not a tuning mistake. The game therefore includes two high-Isp
engines badged **Fictional tech**:

- Gas-Core Nuclear Engine: Isp 1,800 s, inspired by the never-built 1960s–70s "nuclear lightbulb" studies
- Fusion Torch FT-3000: Isp 3,000 s, inspired by fusion studies such as Project Daedalus

The real engines (solid, kerolox, hydrolox) stay in the game as honest baselines; the outcome screen
explains exactly how far short they fall.

### Components

`src/data/components.ts`. Every part has a `realBasis` note shown in the palette ("Where do these numbers
come from?"). Real-tech figures mirror real hardware (Falcon 9 Merlin cluster, RS-25, Shuttle SRB, Orion,
PICA-X, helium COPVs, autogenous pressurisation, DSN). Costs are gameplay values. Fictional parts are
tagged `fictional: true` and badged in the UI: all Deep-Space Drives, the two high-Isp engines, three of the
four comms systems and the hafnium-carbide aeroshell. There are 3–4 options per slot, except launch
engines (5), because the second fictional engine was needed to make Hard winnable.

### Difficulty

| | Budget | Checks |
| --- | --- | --- |
| Easy | $1,800M | TWR, launch mass, Δv, drive range, budget (score only). Comms, pressure, protection auto-pass with an explanation. |
| Medium | $1,700M | + comms range, heat (planet and re-entry). Orbital-survey missions appear. |
| Hard | $1,600M | + pressure compatibility/capacity, crew radiation. Over budget blocks launch. |

The budgets are higher than a brief-style "small" budget because the fictional parts are expensive. They
were tuned with the solver so every destination is winnable within budget:

```bash
npx tsx scripts/solver.ts easy
```

This brute-forces every legal build (about 43,000 per planet) and prints the winning-build count and the
best build. It takes a few minutes per difficulty. KELT-9 b (Hard, 3,921 K, v_orb 51 km/s) has exactly one
winning build, by design the hardest target.

### Curated destinations (`src/data/difficulty-sets.ts`)

Chosen from the snapshot by rules that `src/data/difficulty-sets.test.ts` checks:

- **Easy**: ≤ 13 pc, likely rocky, 200–350 K, ≤ 1.5 g: Proxima Cen b, Ross 128 b, GJ 1061 d, Teegarden's Star b and c, GJ 1002 b, Wolf 1069 b, TRAPPIST-1 e
- **Medium**: farther than every Easy planet, ≤ 2.5 g, landing and survey missions: GJ 1132 b, LHS 3844 b, GJ 1214 b, LHS 1140 b, TOI-270 d, TOI-1452 b, TOI-700 d, K2-18 b
- **Hard**: > 1,000 K, mostly hot Jupiters hundreds of parsecs away: 55 Cnc e, HD 189733 b, HD 149026 b, WASP-39 b, WASP-76 b, WASP-121 b, WASP-12 b, KELT-9 b

Mass provenance comes from `pl_bmassprov`: "Mass" → measured, "Msini" → minimum mass, "M-R relationship"
→ estimated from radius. Cards label which one applies. Atmosphere shows "not measured" unless the planet
is in `src/data/atmosphere-notes.json`, where each note cites its paper (JWST/Hubble/ground-based results
for K2-18 b, GJ 1214 b, LHS 3844 b, 55 Cnc e, HD 189733 b, WASP-39 b, WASP-121 b, KELT-9 b).

## Scoring

0–1000 per attempt before the crew multiplier (`src/engine/scoring.ts`):

- Mission (400): success 400; failure at launch 50, transit 150, planet 250, return 350
- Performance (200): Δv margin (best at 100–125% of required) + TWR (best at 1.3–2.0); both under- and over-building lose points
- Budget efficiency (200): 0 if over budget; 80 at exactly the budget, rising linearly to 200 at $0
- Component suitability (100): deductions for an unnecessary pressure system, incompatible/undersized pressure, drive or comms range far beyond need, protection below the planet's temperature, a crew module flown empty
- Resource balance (100): propellant 70–92% of launch mass
- On failure, budget, suitability and resource points are multiplied by mission progress (e.g. ×0.125 for a pad failure), so an explosion can't score high on cheapness. This rule is my addition; the brief didn't specify it.
- Crew multiplier, shown before launch: success ×(1 + 0.1 × crew), failure ×(1 − 0.15 × crew), floored at 0

A run is 10 attempts per difficulty; the average divides by attempts made (max 10). The in-progress run is
saved in localStorage, so a refresh doesn't lose it. A refresh during the launch animation lands on the
outcome screen, because the attempt was recorded at launch.

## Leaderboard

`src/services/leaderboard.ts` defines `LeaderboardService`. The default is `LocalLeaderboard`
(localStorage, this browser only). If `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set at build
time (see `.env.example`), `SupabaseLeaderboard` is used instead and the Supabase client is loaded on
demand. Names: max 20 characters, tags and symbols stripped, basic profanity filter with letter-swap
detection.

### Supabase setup

1. Create a project, then run this in the SQL editor:

```sql
create table public.leaderboard (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 20),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  average numeric(6, 1) not null check (average >= 0 and average <= 1400),
  created_at timestamptz not null default now()
);

create index leaderboard_difficulty_average_idx
  on public.leaderboard (difficulty, average desc);

alter table public.leaderboard enable row level security;

create policy "Anyone can read the leaderboard"
  on public.leaderboard for select
  to anon
  using (true);

create policy "Anyone can submit a score"
  on public.leaderboard for insert
  to anon
  with check (
    char_length(name) between 1 and 20
    and difficulty in ('easy', 'medium', 'hard')
    and average between 0 and 1400
  );
```

2. Copy `.env.example` to `.env.local` and fill in the project URL and anon key (Settings → API).
3. Restart `npm run dev` or rebuild.

Limitation: scores are computed in the browser, so a determined user can submit a fake score. Fine for
a hackathon demo; a real deployment would need server-side verification.

## Accessibility

- Rockets are built only by drag-and-drop: drag a part card anywhere onto the rocket with a mouse, by touch (press and hold ~140 ms, then drag), or with the keyboard (focus the card's hand button, Space to pick up, any arrow key jumps it onto the rocket, Space to drop, Esc to cancel), with screen-reader announcements. The hangar stays pinned in view (also on phones) so there is always a drop target. Fitted parts can be removed with a button.
- Visible focus rings, focus moves to each new screen, skip link, ARIA tabs, meters and live regions
- Text is dark ink on paper-white cards (≈ 14:1) and light text on the purple night (≈ 10:1); the pink used for numbers on paper is ≈ 5:1
- `prefers-reduced-motion` respected, plus an in-game motion toggle; swaying cards hold still when hovered or focused; "Skip" is always available
- Sound effects are synthesized with Web Audio (no audio files), only start after a tap, and have a mute button
- Responsive from phone (no horizontal scroll at 390 px) to desktop

## Data sources

- NASA Exoplanet Archive, Planetary Systems Composite Parameters (`pscomppars`): https://exoplanetarchive.ipac.caltech.edu/
- NASA's exoplanet site, including "Strange New Worlds", as general reference: https://science.nasa.gov/exoplanets/
- Atmosphere notes: the papers cited in `src/data/atmosphere-notes.json`
- Fonts: Grandstander and Lexend from Google Fonts (SIL Open Font License); offline, the game falls back to rounded system fonts

This is a fan-made educational game. It is not affiliated with or endorsed by NASA.

## Project layout

```
scripts/fetch-planets.ts     archive → src/data/planets.json
scripts/solver.ts            brute-force winnability check
src/engine/                  physics, evaluation, scoring, animation mapping (pure TS + tests)
src/data/                    snapshot, systems.json, curated sets, components, atmosphere notes, space-map maths
src/store/                   Zustand store (persisted run), build resolver
src/services/                leaderboard (localStorage / Supabase), name filter
src/paper/                   papercraft kit: 3D diorama, sprites, rocket drawing, launch scenes, kid text, sounds
src/components/              animation player for the hand-drawn clips, reduced-motion hook, typewriter
src/screens/                 one file per screen
src/story/                   Secret Project chapters, quiz, saved progress
src/ml/                      browser inference for the mass model (+ parity tests)
ml/                          data fetch, training script, report
public/animations/           drop the hand-drawn clips here
public/branding/             optional permitted logo
```
