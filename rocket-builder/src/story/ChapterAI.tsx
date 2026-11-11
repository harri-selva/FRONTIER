import { useMemo, useState } from 'react';
import { findPlanet } from '../data/planets';
import { MASS_MODEL, baselineMass, predictFromFeatures, predictMass } from '../ml/massModel';
import { sfx } from '../paper/sfx';
import { PipSprite, PlanetSprite } from '../paper/sprites';
import type { ChapterProps } from './chapters';
import { Chalkboard, Dialogue, RealNote, Slider, Widget, fmt, fmt0 } from './Shell';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const factor = (dex: number) => 10 ** dex;

/** Three held-out game planets for "beat the AI": one small, one mid, one giant. */
function pickRounds() {
  const s = [...MASS_MODEL.showcase].sort((a, b) => a.true_mass_earth - b.true_mass_earth);
  const want = ['TRAPPIST-1 e', 'K2-18 b', 'HD 189733 b'];
  const chosen = want.map((n) => s.find((x) => x.name === n)).filter(Boolean) as typeof s;
  return chosen.length === 3 ? chosen : [s[0]!, s[Math.floor(s.length / 2)]!, s[s.length - 1]!];
}

function AiLab() {
  // Starts on a well-covered case (a warm sub-Neptune): ~70 similar training planets.
  const [r, setR] = useState(2.5);
  const [p, setP] = useState(8);
  const [t, setT] = useState(800);
  const [ms, setMs] = useState(0.9);
  const [ts, setTs] = useState(5300);
  const pred = predictMass({ radiusEarth: r, periodDays: p, eqTempK: t, starMassSun: ms, starTeffK: ts });
  const base = baselineMass(r);
  return (
    <Widget title="Pip’s AI lab">
      <div className="grid gap-x-6 sm:grid-cols-2">
        <Slider id="ai-r" label="Planet size (Earth = 1)" min={0.5} max={22} step={0.05} value={r} onChange={setR} display={`${fmt(r, 2)} ×`} />
        <Slider id="ai-p" label="Planet’s year" min={0.5} max={400} step={0.5} value={p} onChange={setP} display={`${fmt(p, 1)} days`} />
        <Slider id="ai-t" label="Planet temperature" min={150} max={3000} step={10} value={t} onChange={setT} display={`${fmt0(t)} K`} />
        <Slider id="ai-ms" label="Star mass" min={0.08} max={2} step={0.01} value={ms} onChange={setMs} display={`${fmt(ms, 2)} Suns`} />
        <Slider id="ai-ts" label="Star temperature" min={2500} max={10000} step={50} value={ts} onChange={setTs} display={`${fmt0(ts)} K`} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-paper p-3" aria-live="polite">
          <p className="text-xs font-extrabold uppercase tracking-wider text-ink/60">AI guess</p>
          <p className="font-display text-3xl font-black text-[#c2307f]">{fmt(pred.massEarth, pred.massEarth < 10 ? 2 : 0)} × Earth</p>
          <p className="text-sm">Probably between {fmt(pred.low, pred.low < 10 ? 2 : 0)} and {fmt(pred.high, pred.high < 10 ? 2 : 0)} (68% range)</p>
          <p className="mt-1 text-sm">Similar planets it learned from: <strong>{pred.similarTrainingPlanets}</strong></p>
          {pred.outOfExperience && (
            <p className="mt-1 rounded-lg bg-[#ffe1e6] px-2 py-1 text-sm font-bold text-[#a3203a]">
              Pip says: “I’ve hardly seen planets like this. Don’t trust my guess!”
            </p>
          )}
        </div>
        <div className="rounded-xl bg-paper p-3">
          <p className="text-xs font-extrabold uppercase tracking-wider text-ink/60">Simple rule (size only)</p>
          <p className="font-display text-3xl font-black">{fmt(base, base < 10 ? 2 : 0)} × Earth</p>
          <p className="text-sm">A “bigger means heavier” curve fitted to the same training planets, ignoring everything but size.</p>
        </div>
      </div>
      <p className="mt-2 text-sm">
        Try an Earth twin: size 1, year 365 days, 255 K, star 1 Sun, 5,800 K. The AI gets it badly wrong ({fmt(MASS_MODEL.earth_twin_probe.pred_mass_earth, 1)} × Earth) and warns
        you, because almost no small planets with long years have ever been weighed. AIs only know what they were shown.
      </p>
    </Widget>
  );
}

function ReportCard() {
  const m = MASS_MODEL.metrics;
  const imp = [...MASS_MODEL.permutation_importance].sort((a, b) => b.rmse_increase_dex - a.rmse_increase_dex);
  const maxImp = imp[0]?.rmse_increase_dex ?? 1;
  const nice: Record<string, string> = {
    log10_radius: 'Planet size',
    log10_period: 'Length of year',
    log10_teq: 'Planet temperature',
    log10_star_mass: 'Star mass',
    star_teff_k: 'Star temperature',
  };
  return (
    <Widget title="The AI’s report card (test planets it never saw)">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-paper p-3">
          <p className="text-sm font-bold">Neural-network AI</p>
          <p className="font-display text-2xl font-black text-[#c2307f]">{pct(m.test_model.within_factor_2)}</p>
          <p className="text-xs">guesses within 2× of the real mass</p>
        </div>
        <div className="rounded-xl bg-paper p-3">
          <p className="text-sm font-bold">Simple size rule</p>
          <p className="font-display text-2xl font-black">{pct(m.test_baseline_radius_power_law.within_factor_2)}</p>
          <p className="text-xs">within 2×</p>
        </div>
        <div className="rounded-xl bg-paper p-3">
          <p className="text-sm font-bold">Always guess the average</p>
          <p className="font-display text-2xl font-black">{pct(m.test_baseline_median.within_factor_2)}</p>
          <p className="text-xs">within 2×</p>
        </div>
      </div>
      <p className="mt-2 text-sm">
        Typical error: the AI is off by about ×{fmt(factor(m.test_model.mae_dex), 1)}, the size rule by ×{fmt(factor(m.test_baseline_radius_power_law.mae_dex), 1)}.
        The AI is a bit better, not magic: planets of the same size can be rocky or puffy.
      </p>
      <p className="mt-3 text-sm font-bold">What the AI looks at most</p>
      <ul className="mt-1 space-y-1">
        {imp.map((f) => (
          <li key={f.feature} className="flex items-center gap-2 text-sm">
            <span className="w-36 shrink-0">{nice[f.feature] ?? f.label}</span>
            <span className="h-3 rounded-full bg-[#b8a1ff]" style={{ width: `${Math.max(4, (f.rmse_increase_dex / maxImp) * 60)}%` }} aria-hidden="true" />
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-ink/70">Measured by shuffling one clue at a time and seeing how much worse the AI gets.</p>
    </Widget>
  );
}

function BeatTheAI({ onDone }: { onDone: () => void }) {
  const rounds = useMemo(pickRounds, []);
  const [i, setI] = useState(0);
  const [guessLog, setGuessLog] = useState(0.5); // log10 mass
  const [revealed, setRevealed] = useState(false);
  const [wins, setWins] = useState(0);
  const round = rounds[i];
  if (!round) return null;
  const planet = findPlanet(round.name);
  const ai = predictFromFeatures(round.features);
  const guess = 10 ** guessLog;
  const kidErr = Math.abs(guessLog - Math.log10(round.true_mass_earth));
  const aiErr = Math.abs(ai.log10Mass - Math.log10(round.true_mass_earth));
  const finished = i === rounds.length - 1 && revealed;
  return (
    <Widget title={`Beat the AI: round ${i + 1} of ${rounds.length}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-16">{planet && <PlanetSprite planet={planet} />}</span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-display text-xl font-black">{round.name}</p>
          <p>
            Size {fmt(10 ** (round.features[0] ?? 0), 2)} × Earth · year {fmt(10 ** (round.features[1] ?? 0), 2)} days · {fmt0(10 ** (round.features[2] ?? 0))} K
          </p>
          <p className="text-xs text-ink/70">The AI never saw this planet while learning.</p>
        </div>
      </div>
      <Slider
        id={`bt-${i}`}
        label="Your guess for its mass"
        min={-1}
        max={3.5}
        step={0.01}
        value={guessLog}
        onChange={(v) => !revealed && setGuessLog(v)}
        display={`${fmt(guess, guess < 10 ? 2 : 0)} × Earth`}
      />
      {!revealed ? (
        <button
          type="button"
          className="pbtn pbtn-sm mt-3"
          onClick={() => {
            setRevealed(true);
            const won = kidErr < aiErr;
            if (won) {
              setWins(wins + 1);
              sfx.win();
            } else sfx.pop();
          }}
        >
          Lock in my guess
        </button>
      ) : (
        <div className="mt-3 rounded-xl bg-paper p-3" role="status">
          <p>
            Measured mass: <strong>{fmt(round.true_mass_earth, round.true_mass_earth < 10 ? 2 : 0)} × Earth</strong>
          </p>
          <p>
            AI: {fmt(ai.massEarth, ai.massEarth < 10 ? 2 : 0)} · You: {fmt(guess, guess < 10 ? 2 : 0)}
          </p>
          <p className="font-bold">{kidErr < aiErr ? 'You beat the AI!' : 'The AI was closer this time.'}</p>
          {!finished ? (
            <button
              type="button"
              className="pbtn pbtn-sm mt-2"
              onClick={() => {
                setI(i + 1);
                setRevealed(false);
                setGuessLog(0.5);
              }}
            >
              Next planet
            </button>
          ) : (
            <p className="mt-2 font-bold text-leaf">
              Final score: you {wins} – AI {rounds.length - wins}.{' '}
              <button type="button" className="pbtn pbtn-sm ml-2" onClick={onDone}>
                File complete
              </button>
            </p>
          )}
        </div>
      )}
    </Widget>
  );
}

export function ChAI({ solved, onSolved }: ChapterProps) {
  return (
    <>
      <Dialogue
        lines={[
          { who: 'director', text: 'To land, we need the planet’s mass. Astronomers weigh planets by measuring how much they make their star wobble. It’s slow, hard work, and many planets have never been weighed.' },
          { who: 'pip', mood: 'wow', text: `So we built an AI! We showed it ${fmt0(MASS_MODEL.counts.train)} real planets whose size AND mass were measured, and let it learn the pattern.` },
          { who: 'pip', mood: 'think', text: `Then we tested it on ${MASS_MODEL.counts.test} planets it had never seen. That’s the fair way to check an AI: never test on the homework answers.` },
        ]}
      />
      <Chalkboard formula="clues → neural network → mass">
        <p>
          The AI is a small neural network: layers of simple maths units that multiply the clues by learned numbers and add them up.
          We trained 5 of them and average their answers. When they disagree, the AI is less sure, and its range gets wider.
        </p>
        <p>Clues: planet size, length of year, planet temperature, star mass, star temperature.</p>
      </Chalkboard>
      <AiLab />
      <ReportCard />
      {solved ? (
        <RealNote>You’ve completed this file. The AI is also used in the main game: open “More facts” on a planet to see its guess.</RealNote>
      ) : (
        <BeatTheAI onDone={onSolved} />
      )}
      <RealNote>
        Training data: {MASS_MODEL.data.source}, retrieved {MASS_MODEL.data.retrieved}. Only planets with a measured size (they transit their star) and a measured mass were used.
      </RealNote>
      <div className="flex items-end gap-2">
        <span className="w-12">
          <PipSprite mood="think" />
        </span>
        <p className="text-sm italic">Real astronomers use mass predictions like this (for example a tool called “Forecaster”) to plan which planets to weigh with big telescopes.</p>
      </div>
    </>
  );
}
