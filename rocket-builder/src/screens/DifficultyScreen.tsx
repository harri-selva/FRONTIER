import { Cabinet } from '../components/Cabinet';
import { fmt, money } from '../components/format';
import { PLANETS_BY_DIFFICULTY } from '../data/planets';
import { ATTEMPTS_PER_RUN, DIFFICULTIES, DIFFICULTY_CONFIG, runAverage } from '../engine';
import { useGame } from '../store/gameStore';

const CHECK_NAMES = {
  comms: 'Comms range',
  heat: 'Heat protection',
  pressure: 'Pressure compatibility',
  radiation: 'Crew radiation',
} as const;

const ACCENT = { easy: 'border-cyber', medium: 'border-neonsoft', hard: 'border-neon' } as const;

export function DifficultyScreen() {
  const choose = useGame((s) => s.chooseDifficulty);
  const runs = useGame((s) => s.runs);
  const restart = useGame((s) => s.restartRun);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 font-display text-lg sm:text-xl">
        <span className="chrome">Choose difficulty</span>
      </h1>
      <p className="mb-6 max-w-3xl text-haze">
        Each difficulty is a run of {ATTEMPTS_PER_RUN} attempts. Harder levels add engineering checks, not just smaller budgets.
      </p>
      <div className="grid gap-5 md:grid-cols-3">
        {DIFFICULTIES.map((d) => {
          const cfg = DIFFICULTY_CONFIG[d];
          const run = runs[d];
          const n = run.attempts.length;
          const done = n >= ATTEMPTS_PER_RUN;
          const planets = PLANETS_BY_DIFFICULTY[d];
          const near = Math.min(...planets.map((p) => p.distanceLy));
          const far = Math.max(...planets.map((p) => p.distanceLy));
          return (
            <Cabinet key={d} title={cfg.label} id={`diff-${d}`} className={`flex flex-col ${ACCENT[d]}`} bodyClassName="flex flex-1 flex-col p-4">
              <p className="readout text-3xl text-cyber">{money(cfg.budget)}</p>
              <p className="text-xs text-[#c3b2e8]">budget (gameplay value)</p>
              <p className="mt-3 text-sm text-haze">{cfg.summary}</p>
              <p className="mt-3 text-sm text-haze">
                {planets.length} destinations, {fmt(near, 1)}–{fmt(far, 0)} light-years away.
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                <li>✔ Thrust-to-weight, launch mass, Δv, drive range, budget</li>
                {(Object.keys(CHECK_NAMES) as (keyof typeof CHECK_NAMES)[]).map((k) => (
                  <li key={k} className={cfg.checks[k] ? 'text-haze' : 'text-[#c3b2e8]'}>
                    {cfg.checks[k] ? '✔' : '○'} {CHECK_NAMES[k]} {cfg.checks[k] ? '' : '(auto-pass)'}
                  </li>
                ))}
                {cfg.budgetBlocksLaunch && <li className="text-neonsoft">⚠ Over budget blocks launch</li>}
              </ul>
              {n > 0 && (
                <p className="readout mt-3 text-haze">
                  Run: {n}/{ATTEMPTS_PER_RUN} · avg {fmt(runAverage(run.attempts.map((a) => a.score)))}
                </p>
              )}
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <button type="button" className="btn btn-primary flex-1" onClick={() => choose(d)}>
                  {done ? (run.submitted ? 'New run' : 'Finish run') : n > 0 ? 'Continue' : 'Play'}
                </button>
                {n > 0 && !done && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      if (window.confirm(`Restart your ${cfg.label} run? ${n} attempt(s) will be lost.`)) restart(d);
                    }}
                  >
                    Restart
                  </button>
                )}
              </div>
            </Cabinet>
          );
        })}
      </div>
    </div>
  );
}
