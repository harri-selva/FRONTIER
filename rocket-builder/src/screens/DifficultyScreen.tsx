import { useState } from 'react';
import { ATTEMPTS_PER_RUN, DIFFICULTIES, DIFFICULTY_CONFIG, runAverage, type Difficulty } from '../engine';
import { LEVEL } from '../paper/kid';
import { sfx } from '../paper/sfx';
import { Icon, StarSprite } from '../paper/sprites';
import { PipSays } from '../paper/ui';
import { useGame } from '../store/gameStore';

const CARD_COLOR: Record<Difficulty, string> = { easy: '#5fd3c8', medium: '#39d0e8', hard: '#f06aa8' };
const STAR_COLOR: Record<Difficulty, string> = { easy: '#ffc94a', medium: '#f28c28', hard: '#e04a3a' };

function Check({ on, icon, text }: { on: boolean; icon: Parameters<typeof Icon>[0]['name']; text: string }) {
  return (
    <li className={`flex items-center gap-2 ${on ? '' : 'opacity-45'}`}>
      <span className="grid h-7 w-7 place-items-center rounded-full bg-paper shadow-[0_2px_0_rgba(42,23,71,.25)]">
        <Icon name={icon} size={16} />
      </span>
      <span className={on ? 'font-semibold' : 'line-through decoration-2'}>{text}</span>
    </li>
  );
}

export function DifficultyScreen() {
  const choose = useGame((s) => s.chooseDifficulty);
  const runs = useGame((s) => s.runs);
  const restart = useGame((s) => s.restartRun);
  const [confirming, setConfirming] = useState<Difficulty | null>(null);

  return (
    <div className="gutter mx-auto max-w-6xl pt-6">
      <h1 className="text-center">Select rank</h1>

      {/* string the badges hang from */}
      <div className="relative mt-8">
        <div className="grid gap-8 pt-2 md:grid-cols-3">
          {DIFFICULTIES.map((d, idx) => {
            const cfg = DIFFICULTY_CONFIG[d];
            const run = runs[d];
            const n = run.attempts.length;
            const done = n >= ATTEMPTS_PER_RUN;
            return (
              <div key={d} className="flex">
                <article
                  className="paper relative flex w-full flex-col px-5 pb-5 pt-4"
                  style={{ borderColor: CARD_COLOR[d] }}
                  aria-labelledby={`rank-${d}`}
                >
                  <div className="flex items-center justify-center gap-1" aria-hidden="true">
                    {Array.from({ length: idx + 1 }, (_, s) => (
                      <span key={s} className="w-12">
                        <StarSprite color={STAR_COLOR[d]} />
                      </span>
                    ))}
                  </div>
                  <h2 id={`rank-${d}`} className="mt-1 text-center text-3xl font-black">
                    {LEVEL[d].name}
                    <span className="ml-2 align-middle text-sm font-bold opacity-70">({LEVEL[d].tag})</span>
                  </h2>
                  <p className="mt-1 text-center font-medium">{LEVEL[d].blurb}</p>
                  <p className="mt-3 flex items-center justify-center gap-1.5 font-display text-xl font-extrabold">
                    <Icon name="coin" /> ${cfg.budget.toLocaleString('en-US')}M budget
                  </p>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    <Check on icon="lift" text="Lift-off and fuel" />
                    <Check on icon="warp" text="Warp drive range" />
                    <Check on={cfg.checks.comms} icon="radio" text="Radio range" />
                    <Check on={cfg.checks.heat} icon="heat" text="Heat shield" />
                    <Check on={cfg.checks.pressure} icon="pump" text="Tank pump" />
                    <Check on={cfg.checks.radiation} icon="crew" text="Crew radiation shield" />
                  </ul>
                  {n > 0 && (
                    <p className="mt-3 text-center text-sm font-semibold">
                      {n}/{ATTEMPTS_PER_RUN} tries · avg {runAverage(run.attempts.map((a) => a.score)).toFixed(0)}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      className="pbtn pbtn-paper"
                      onClick={() => {
                        sfx.go();
                        choose(d);
                      }}
                    >
                      {done ? (run.submitted ? 'New run' : 'Finish run') : n > 0 ? 'Continue' : 'Choose'}
                    </button>
                    {n > 0 && !done && confirming !== d && (
                      <button type="button" className="pbtn pbtn-paper pbtn-sm" onClick={() => setConfirming(d)}>
                        Restart
                      </button>
                    )}
                  </div>
                  {confirming === d && (
                    <div className="mt-3 rounded-xl bg-paper p-3 text-center" role="alert">
                      <p className="font-semibold">Start over? Your {n} tries will be cleared.</p>
                      <div className="mt-2 flex justify-center gap-2">
                        <button
                          type="button"
                          className="pbtn pbtn-sm"
                          onClick={() => {
                            setConfirming(null);
                            sfx.remove();
                            restart(d);
                          }}
                        >
                          Yes, restart
                        </button>
                        <button type="button" className="pbtn pbtn-paper pbtn-sm" onClick={() => setConfirming(null)}>
                          Keep it
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mx-auto mt-8 max-w-xl">
        <PipSays mood="happy">Each rank adds engineering constraints: Pilot adds comms range and thermal protection; Commander adds pressurisation, crew radiation limits and a hard budget.</PipSays>
      </div>
    </div>
  );
}
