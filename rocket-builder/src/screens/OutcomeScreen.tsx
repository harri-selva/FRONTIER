import { Cabinet } from '../components/Cabinet';
import { StatusBadge } from '../components/Badges';
import { fmt } from '../components/format';
import { findPlanet } from '../data/planets';
import { ATTEMPTS_PER_RUN, PHASES, runAverage } from '../engine';
import { useGame } from '../store/gameStore';

const PHASE_LABEL = { launch: 'Launch', transit: 'Transit', planet: 'At the planet', return: 'Return' } as const;

function ScoreRow({ label, value, max, note }: { label: string; value: number; max: number; note?: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
      <span className="text-sm text-haze">{label}</span>
      <span className="readout text-xl text-cyber">
        {value} <span className="text-[#c3b2e8]">/ {max}</span>
      </span>
      <div className="meter col-span-2 !h-2" aria-hidden="true">
        <span style={{ width: `${(value / max) * 100}%`, background: 'linear-gradient(90deg,#ff4fd8,#5ee7ff)' }} />
      </div>
      {note && <p className="col-span-2 text-xs text-[#c3b2e8]">{note}</p>}
    </div>
  );
}

export function OutcomeScreen() {
  const result = useGame((s) => s.lastResult);
  const difficulty = useGame((s) => s.difficulty);
  const planetName = useGame((s) => s.planetName);
  const runs = useGame((s) => s.runs);
  const next = useGame((s) => s.nextAttempt);
  const go = useGame((s) => s.go);
  const planet = planetName ? findPlanet(planetName) : null;
  if (!result || !difficulty || !planet) {
    return (
      <div className="p-8 text-center">
        <button type="button" className="btn btn-primary" onClick={() => go('planets')}>
          Back
        </button>
      </div>
    );
  }
  const run = runs[difficulty];
  const n = run.attempts.length;
  const done = n >= ATTEMPTS_PER_RUN;
  const s = result.score;
  const failed = result.checks.filter((c) => c.status === 'fail' && c.id !== 'budget');

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className={`cabinet mb-6 px-5 py-6 text-center ${result.success ? '!border-ok' : '!border-[#ff6b8b]'}`} role="status">
        <p className="font-display text-[0.6rem] text-[#c3b2e8]">
          Attempt {n}/{ATTEMPTS_PER_RUN} · {planet.name}
        </p>
        <h1 className={`mt-2 font-display text-xl leading-relaxed sm:text-3xl ${result.success ? 'text-ok' : 'text-[#ffb3c3]'}`}>
          {result.success ? 'Mission complete' : `Failed: ${PHASE_LABEL[result.failedPhase ?? 'launch']}`}
        </h1>
        {result.failure && <p className="readout mt-2 text-xl text-haze">{result.failure.overlay}</p>}
        <p className="mt-4 font-display text-4xl">
          <span className="chrome">{s.total}</span>
        </p>
        <p className="readout text-haze">
          Run average {fmt(runAverage(run.attempts.map((a) => a.score)))} over {n} attempt{n === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Cabinet title="Why it happened" id="why">
          {failed.length > 0 && (
            <div className="mb-4 rounded-lg border-2 border-[#ff6b8b] bg-[#ff6b8b]/10 p-3">
              <p className="font-display text-[0.6rem] text-[#ffb3c3]">What to change</p>
              <ul className="mt-2 space-y-2">
                {failed.map((c) => (
                  <li key={c.id} className="text-haze">
                    {c.id === result.failure?.id ? <strong>First failure: </strong> : null}
                    {c.advice}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {PHASES.map((phase) => (
            <div key={phase} className="mb-4">
              <h3 className="mb-1 flex items-center gap-2 font-display text-[0.6rem] text-cyber">
                {PHASE_LABEL[phase]}
                <span className="text-[#c3b2e8]">
                  {result.phases[phase] === 'pass' ? '✔ reached' : result.phases[phase] === 'fail' ? '✖ failed here' : '— not reached'}
                </span>
              </h3>
              <ul className="space-y-1">
                {result.checks
                  .filter((c) => c.phase === phase && c.id !== 'budget')
                  .map((c) => (
                    <li key={c.id} className="rounded-md bg-void/50 px-2 py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <StatusBadge status={result.phases[phase] === 'not-reached' && c.status !== 'auto' ? 'skipped' : c.status} />
                        <span className="min-w-[10rem] flex-1 font-semibold text-haze">{c.label}</span>
                        <span className="readout text-[#ddd0ff]">
                          {c.actual} <span className="text-[#c3b2e8]">({c.required})</span>
                        </span>
                      </div>
                      <p className="mt-1 text-[#ddd0ff]">{c.advice}</p>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
          {result.checks
            .filter((c) => c.id === 'budget')
            .map((c) => (
              <div key={c.id} className="rounded-md bg-void/50 px-2 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={c.status} />
                  <span className="flex-1 font-semibold text-haze">{c.label}</span>
                  <span className="readout text-[#ddd0ff]">
                    {c.actual} / {c.required.replace('≤ ', '')}
                  </span>
                </div>
                <p className="mt-1 text-[#ddd0ff]">{c.advice}</p>
              </div>
            ))}
        </Cabinet>

        <div className="flex flex-col gap-5">
          <Cabinet title="Score breakdown" id="score">
            <div className="space-y-3">
              <ScoreRow label="Mission success" value={s.mission} max={400} note={result.success ? 'Full success.' : `Reached: ${PHASE_LABEL[result.failedPhase ?? 'launch']} phase.`} />
              <ScoreRow label="Performance / margin" value={s.performance} max={200} note="Δv 100–125% of required and TWR 1.3–2.0 score best." />
              <ScoreRow label="Budget efficiency" value={s.budget} max={200} />
              <ScoreRow label="Component suitability" value={s.suitability} max={100} />
              <ScoreRow label="Resource balance" value={s.resources} max={100} note="Propellant 70–92% of launch mass scores best." />
              <div className="border-t border-neon/40 pt-2 text-sm">
                <p className="flex justify-between text-haze">
                  <span>Base</span>
                  <span className="readout text-xl">{s.base} / 1000</span>
                </p>
                <p className="flex justify-between text-haze">
                  <span>Crew multiplier</span>
                  <span className="readout text-xl">×{fmt(s.multiplier, 2)}</span>
                </p>
                <p className="flex justify-between font-semibold text-haze">
                  <span>Total</span>
                  <span className="readout text-2xl text-neon">{s.total}</span>
                </p>
              </div>
              {s.notes.length > 0 && (
                <ul className="list-disc pl-5 text-xs text-[#c3b2e8]">
                  {s.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
            </div>
          </Cabinet>
          <div className="flex flex-wrap justify-end gap-3">
            {!done && (
              <button type="button" className="btn btn-ghost" onClick={() => go('builder')}>
                Rebuild for this planet
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={next} autoFocus>
              {done ? 'Run summary' : `Next attempt (${n + 1}/${ATTEMPTS_PER_RUN})`}
            </button>
          </div>
          {!done && (
            <p className="text-right text-xs text-[#c3b2e8]">
              “Rebuild” and “Next attempt” both use a new attempt when you launch. Your rocket is kept.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
