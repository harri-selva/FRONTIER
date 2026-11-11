import { useEffect, useState } from 'react';
import { useReducedMotion } from '../components/useReducedMotion';
import { findPlanet } from '../data/planets';
import { ATTEMPTS_PER_RUN, PHASES } from '../engine';
import { kidFailure, starsFor } from '../paper/kid';
import { sfx } from '../paper/sfx';
import { Icon, PlanetSprite, StarSprite } from '../paper/sprites';
import { Confetti, CountUp, PipSays } from '../paper/ui';
import { useGame } from '../store/gameStore';

const PHASE_NAME = { launch: 'Ascent', transit: 'Transit', planet: 'Target ops', return: 'Return' } as const;

function ScoreStrip({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tabular font-bold">
          {value}/{max}
        </span>
      </div>
      <div className="mt-1 h-3.5 rounded-full bg-ink/10">
        <span className="block h-full rounded-full transition-[width] duration-1000" style={{ width: `${(value / max) * 100}%`, background: color, boxShadow: '0 2px 0 rgba(42,23,71,.25)' }} />
      </div>
    </li>
  );
}

export function OutcomeScreen() {
  const result = useGame((s) => s.lastResult);
  const difficulty = useGame((s) => s.difficulty);
  const planetName = useGame((s) => s.planetName);
  const runs = useGame((s) => s.runs);
  const next = useGame((s) => s.nextAttempt);
  const go = useGame((s) => s.go);
  const { reduced } = useReducedMotion();
  const [shown, setShown] = useState(reduced ? 3 : 0);
  const [science, setScience] = useState(false);
  const planet = planetName ? findPlanet(planetName) : null;
  const stars = result ? starsFor(result) : 0;

  useEffect(() => {
    if (reduced) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      if (i <= stars) sfx.star(i);
      setShown(i);
      if (i >= 3) window.clearInterval(id);
    }, 420);
    return () => window.clearInterval(id);
  }, [stars, reduced]);

  if (!result || !difficulty || !planet) {
    return (
      <div className="p-10 text-center">
        <button type="button" className="pbtn" onClick={() => go('planets')}>
          Back
        </button>
      </div>
    );
  }
  const n = runs[difficulty].attempts.length;
  const done = n >= ATTEMPTS_PER_RUN;
  const s = result.score;
  const said = result.failure ? kidFailure(result.failure, planet) : null;

  return (
    <div className="gutter mx-auto max-w-5xl pt-6">
      {result.success && <Confetti count={30} />}
      <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
        <section className="paper paper-tilt-l tape relative px-6 pb-6 pt-8 text-center" aria-labelledby="report-title">
          <p className="font-semibold text-ink/75">
            Attempt {n}/{ATTEMPTS_PER_RUN} · {planet.name}
          </p>
          <h1 id="report-title" className="mt-1 text-4xl font-black sm:text-5xl">
            {result.success ? 'Mission complete' : said?.oops}
          </h1>
          <div className="mx-auto mt-4 flex max-w-xs justify-center gap-2" role="img" aria-label={`${stars} out of 3 stars`}>
            {[1, 2, 3].map((i) => (
              <span key={i} className={`w-1/3 ${shown >= i ? 'anim-pop' : 'opacity-0'}`} style={{ marginTop: i === 2 ? 0 : '12%' }}>
                <StarSprite color={i <= stars ? '#ffe07a' : '#d9cde9'} />
              </span>
            ))}
          </div>
          <p className="mt-3 font-display text-6xl font-black text-[#f06aa8]">
            <CountUp to={s.total} />
          </p>
          <p className="font-semibold">points{s.multiplier !== 1 ? ` (crew bonus ×${s.multiplier.toFixed(2)})` : ''}</p>
          <div className="mt-4 text-left">
            {result.success ? (
              <PipSays mood="wow" size={64}>
                Round trip to {planet.name} confirmed. A cheaper or tighter-margin design scores higher.
              </PipSays>
            ) : (
              <PipSays mood="think" size={64}>
                <strong>Tip:</strong> {said?.tip}
              </PipSays>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-5">
          <section className="paper paper-tilt-r px-5 py-4" aria-labelledby="pts-title">
            <h2 id="pts-title" className="text-2xl font-black">
              Score breakdown
            </h2>
            <ul className="mt-3 space-y-2.5">
              <ScoreStrip label="Mission progress" value={s.mission} max={400} color="#f06aa8" />
              <ScoreStrip label="Propulsion efficiency" value={s.performance} max={200} color="#39d0e8" />
              <ScoreStrip label="Budget margin" value={s.budget} max={200} color="#ffc94a" />
              <ScoreStrip label="Component suitability" value={s.suitability} max={100} color="#5fd3c8" />
              <ScoreStrip label="Propellant margin" value={s.resources} max={100} color="#a98be0" />
            </ul>
          </section>

          <section className="paper px-5 py-4">
            <ol className="flex flex-wrap gap-2" aria-label="How far the mission got">
              {PHASES.map((p) => {
                const st = result.phases[p];
                return (
                  <li key={p} className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${st === 'pass' ? 'bg-mint' : st === 'fail' ? 'bg-tomato' : 'bg-ink/10'}`}>
                    {st === 'pass' ? <Icon name="check" size={14} /> : st === 'fail' ? <Icon name="cross" size={14} /> : null}
                    {PHASE_NAME[p]}
                  </li>
                );
              })}
            </ol>
            <button type="button" className="mt-3 text-sm font-bold underline decoration-2 underline-offset-4" aria-expanded={science} onClick={() => setScience(!science)}>
              {science ? 'Hide telemetry' : 'Full telemetry'}
            </button>
            {science && (
              <ul className="mt-2 space-y-1.5 text-sm">
                {result.checks.map((c) => (
                  <li key={c.id} className={`rounded-lg px-2 py-1.5 ${c.status === 'fail' ? 'bg-[#4a1a2c]' : c.status === 'auto' ? 'bg-ink/5' : 'bg-[#0d2f5a]'}`}>
                    <p className="font-bold">
                      {c.status === 'pass' ? '✔' : c.status === 'fail' ? '✖' : '○'} {c.label}: <span className="tabular">{c.actual}</span>{' '}
                      <span className="font-normal">({c.required})</span>
                    </p>
                    <p>{c.advice}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="w-14" aria-hidden="true">
              <PlanetSprite planet={planet} />
            </span>
            {!done && (
              <button
                type="button"
                className="pbtn pbtn-paper"
                onClick={() => {
                  sfx.click();
                  go('builder');
                }}
              >
                Revise vehicle
              </button>
            )}
            <button
              type="button"
              className="pbtn pbtn-lg"
              onClick={() => {
                sfx.go();
                next();
              }}
              autoFocus
            >
              {done ? 'Run summary' : 'Next attempt'}
            </button>
          </div>
          {!done && <p className="text-right text-xs text-slatelight">Either option uses the next attempt on launch. The current design is retained.</p>}
        </div>
      </div>
    </div>
  );
}
