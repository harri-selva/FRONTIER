import { MissionPatch } from '../components/MissionPatch';
import { DATA_COUNT, DATA_RETRIEVED } from '../data/planets';
import { ATTEMPTS_PER_RUN, DIFFICULTY_CONFIG } from '../engine';
import { useGame } from '../store/gameStore';

export function TitleScreen() {
  const go = useGame((s) => s.go);
  const briefingSeen = useGame((s) => s.briefingSeen);
  const difficulty = useGame((s) => s.difficulty);
  const runs = useGame((s) => s.runs);
  const run = difficulty ? runs[difficulty] : null;
  const inProgress = difficulty && run && run.attempts.length > 0 && run.attempts.length < ATTEMPTS_PER_RUN;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-4xl flex-col items-center justify-center px-4 py-10 text-center">
      <div className="cabinet w-full overflow-hidden">
        <div className="cabinet-marquee justify-center">
          <span aria-hidden="true">★</span>
          <span>Insert coin · Deep-space division</span>
          <span aria-hidden="true">★</span>
        </div>
        <div className="checker px-4 py-10 sm:px-10">
          <div className="mx-auto mb-6 w-fit rounded-full p-1 shadow-neon">
            <MissionPatch size={150} />
          </div>
          <h1 className="font-display text-2xl leading-snug sm:text-4xl">
            <span className="chrome block">EXOPLANET</span>
            <span className="neon-text block">ROCKET BUILDER</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-haze">
            You are NASA’s newest rocket scientist. Pick a real exoplanet, build a rocket, and bring the crew home.
            Earth → exoplanet → Earth.
          </p>
          <p className="readout mt-6 text-cyber">
            <span className="blink" aria-hidden="true">
              ▶
            </span>{' '}
            PRESS START
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {inProgress && difficulty && (
              <button type="button" className="btn btn-primary" onClick={() => go('planets')}>
                Continue {DIFFICULTY_CONFIG[difficulty].label} run ({run.attempts.length}/{ATTEMPTS_PER_RUN})
              </button>
            )}
            <button
              type="button"
              className={inProgress ? 'btn btn-ghost' : 'btn btn-primary'}
              onClick={() => go(briefingSeen ? 'difficulty' : 'briefing')}
              autoFocus
            >
              Start mission
            </button>
            {briefingSeen && (
              <button type="button" className="btn btn-ghost" onClick={() => go('briefing')}>
                Replay briefing
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => go('leaderboard')}>
              Leaderboard
            </button>
          </div>
        </div>
      </div>
      <p className="mt-6 max-w-2xl text-sm text-[#c3b2e8]">
        Built on {DATA_COUNT.toLocaleString('en-US')} confirmed planets from the NASA Exoplanet Archive (snapshot{' '}
        {DATA_RETRIEVED}). Real data and gameplay assumptions are labelled everywhere.
      </p>
    </div>
  );
}
