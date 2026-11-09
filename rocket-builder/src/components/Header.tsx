import { useState } from 'react';
import { ATTEMPTS_PER_RUN, DIFFICULTY_CONFIG, runAverage } from '../engine';
import { DATA_RETRIEVED, DATA_SOURCE_URL } from '../data/planets';
import { useGame } from '../store/gameStore';
import { MathsPanel } from './MathsPanel';
import { MissionPatch } from './MissionPatch';
import { Modal } from './Modal';
import { setReducedMotionPref, useReducedMotion } from './useReducedMotion';
import { fmt } from './format';

export function Header() {
  const [maths, setMaths] = useState(false);
  const screen = useGame((s) => s.screen);
  const difficulty = useGame((s) => s.difficulty);
  const runs = useGame((s) => s.runs);
  const go = useGame((s) => s.go);
  const { reduced, pref } = useReducedMotion();

  const run = difficulty ? runs[difficulty] : null;
  const showRun = run && screen !== 'title' && screen !== 'briefing' && screen !== 'difficulty' && screen !== 'leaderboard';
  const scores = run?.attempts.map((a) => a.score) ?? [];

  return (
    <header className="relative z-10 border-b-2 border-neon/60 bg-void/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-6">
        <button
          type="button"
          onClick={() => go('title')}
          className="flex items-center gap-3 rounded-lg text-left"
          aria-label="Exoplanet Rocket Builder: back to title screen"
        >
          <MissionPatch size={44} />
          <span className="hidden font-display text-[0.65rem] leading-relaxed sm:block">
            <span className="chrome">EXOPLANET</span>
            <br />
            <span className="neon-text">ROCKET BUILDER</span>
          </span>
        </button>

        {showRun && difficulty && run && (
          <div className="flex items-center gap-3 rounded-lg border border-cyber/50 bg-night/80 px-3 py-1" aria-live="polite">
            <span className="font-display text-[0.6rem] text-neonsoft">{DIFFICULTY_CONFIG[difficulty].label}</span>
            <span className="readout text-cyber">
              Attempt {Math.min(run.attempts.length + (screen === 'outcome' || screen === 'launch' ? 0 : 1), ATTEMPTS_PER_RUN)}/
              {ATTEMPTS_PER_RUN}
            </span>
            <span className="readout text-haze">Avg {fmt(runAverage(scores), 1)}</span>
          </div>
        )}

        <nav className="ml-auto flex flex-wrap items-center gap-2" aria-label="Game">
          <button type="button" className="btn btn-ghost !min-h-[36px] !px-2 !text-[0.5rem] sm:!px-3 sm:!text-[0.6rem]" onClick={() => setMaths(true)}>
            How the maths works
          </button>
          <button type="button" className="btn btn-ghost !min-h-[36px] !px-2 !text-[0.5rem] sm:!px-3 sm:!text-[0.6rem]" onClick={() => go('leaderboard')}>
            Leaderboard
          </button>
          <button
            type="button"
            className="btn btn-ghost !min-h-[36px] !px-2 !text-[0.5rem] sm:!px-3 sm:!text-[0.6rem]"
            aria-pressed={reduced}
            onClick={() => setReducedMotionPref(reduced ? 'off' : 'on')}
            title={pref === 'system' ? 'Following your system setting' : 'Set in this browser'}
          >
            Motion: {reduced ? 'reduced' : 'full'}
          </button>
        </nav>
      </div>
      <p className="mx-auto max-w-7xl px-3 pb-1 text-[0.7rem] text-[#c3b2e8] sm:px-6">
        Data:{' '}
        <a href={DATA_SOURCE_URL} target="_blank" rel="noreferrer" className="underline decoration-cyber hover:text-cyber">
          NASA Exoplanet Archive
        </a>
        , retrieved {DATA_RETRIEVED}. A fan-made educational game; not affiliated with or endorsed by NASA.
      </p>
      <Modal open={maths} title="How the maths works" onClose={() => setMaths(false)}>
        <MathsPanel />
      </Modal>
    </header>
  );
}
