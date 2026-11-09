import { ATTEMPTS_PER_RUN } from '../engine';
import { DATA_COUNT } from '../data/planets';
import { Diorama, Layer } from '../paper/Diorama';
import { LEVEL } from '../paper/kid';
import { RocketSprite } from '../paper/RocketSprite';
import { DEMO_ROCKET, DriftingClouds, HillsAndSun, StarWall } from '../paper/scenery';
import { sfx } from '../paper/sfx';
import { PadSprite, PipSprite, PlanetSprite, TowerSprite } from '../paper/sprites';
import { useGame } from '../store/gameStore';

const WORD_1 = 'EXOPLANET';
const WORD_2 = 'ROCKET BUILDER';
const CHIP_COLORS = ['#ff7cc6', '#ffe07a', '#74e0c0', '#8fd3ff', '#b8a1ff', '#ffb48f'];

function PaperWord({ text, offset, size }: { text: string; offset: number; size: string }) {
  return (
    <span className="inline-flex flex-wrap justify-center gap-[0.12em]" aria-hidden="true">
      {text.split('').map((ch, i) =>
        ch === ' ' ? (
          <span key={i} className="w-[0.35em]" />
        ) : (
          <span
            key={i}
            className="anim-pop inline-block"
            style={{ animationDelay: `${(offset + i) * 0.05}s` }}
          >
            <span
              className="inline-block rounded-[0.18em] px-[0.12em] font-display font-black leading-[1.05] text-ink"
              style={{
                fontSize: size,
                background: CHIP_COLORS[(offset + i) % CHIP_COLORS.length],
                transform: `rotate(${((offset + i) * 37) % 11 - 5}deg)`,
                boxShadow: '0 0 0 0.09em #fff8ef, 0 0.12em 0 0.09em rgba(20,8,50,.35)',
              }}
            >
              {ch}
            </span>
          </span>
        ),
      )}
    </span>
  );
}

export function TitleScreen() {
  const go = useGame((s) => s.go);
  const briefingSeen = useGame((s) => s.briefingSeen);
  const difficulty = useGame((s) => s.difficulty);
  const runs = useGame((s) => s.runs);
  const run = difficulty ? runs[difficulty] : null;
  const inProgress = difficulty && run && run.attempts.length > 0 && run.attempts.length < ATTEMPTS_PER_RUN;

  return (
    <div className="gutter mx-auto max-w-6xl pt-4">
      <h1 className="sr-only">Exoplanet Rocket Builder</h1>
      <div className="relative">
        <Diorama className="h-[min(64vh,560px)] min-h-[380px] rounded-[28px]" camera={{ rx: 4 }}>
          <StarWall />
          <Layer x={80} y={64} z={-450} w={20}>
            <div className="anim-bob" style={{ animationDuration: '9s' }}>
              <PlanetSprite planet={{ name: 'TRAPPIST-1 e', eqTempK: 250, planetClass: 'rocky' }} />
            </div>
          </Layer>
          <Layer x={16} y={70} z={-500} w={14}>
            <div className="anim-bob" style={{ animationDuration: '11s' }}>
              <PlanetSprite planet={{ name: 'WASP-39 b', eqTempK: 1166, planetClass: 'giant' }} />
            </div>
          </Layer>
          <HillsAndSun />
          <DriftingClouds />
          <Layer x={50} y={5} z={-20} w={36}>
            <PadSprite />
          </Layer>
          <Layer x={62} y={9} z={-30} w={8}>
            <TowerSprite />
          </Layer>
          <Layer x={50} y={9} z={0} w={15}>
            <div className="anim-bob" style={{ animationDuration: '4s' }}>
              <RocketSprite rocket={DEMO_ROCKET} crew={2} />
            </div>
          </Layer>
          <Layer x={24} y={4} z={60} w={13}>
            <div className="anim-wobble">
              <PipSprite mood="happy" />
            </div>
          </Layer>
        </Diorama>

        {/* Title sits on the diorama like a paper sign */}
        <div className="pointer-events-none absolute inset-x-0 top-[6%] flex flex-col items-center gap-2 px-2 text-center">
          <PaperWord text={WORD_1} offset={0} size="clamp(1.8rem, 7.5vw, 4.6rem)" />
          <PaperWord text={WORD_2} offset={WORD_1.length} size="clamp(1.25rem, 4.6vw, 2.8rem)" />
        </div>
      </div>

      <div className="paper paper-tilt-r tape relative mx-auto -mt-10 max-w-2xl px-5 pb-6 pt-7 text-center">
        <p className="text-lg font-medium">
          Build a paper rocket, fly to a <strong>real planet</strong> around another star, and bring your crew home!
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
          {inProgress && difficulty && (
            <button
              type="button"
              className="pbtn pbtn-mint pbtn-lg"
              onClick={() => {
                sfx.go();
                go('planets');
              }}
            >
              Keep playing ({LEVEL[difficulty].name} {run.attempts.length}/{ATTEMPTS_PER_RUN})
            </button>
          )}
          <button
            type="button"
            className={`pbtn pbtn-lg ${inProgress ? 'pbtn-paper' : ''}`}
            onClick={() => {
              sfx.go();
              go(briefingSeen ? 'difficulty' : 'briefing');
            }}
            autoFocus
          >
            {inProgress ? 'New game' : 'Play!'}
          </button>
          <button
            type="button"
            className="pbtn pbtn-sky"
            onClick={() => {
              sfx.click();
              go('leaderboard');
            }}
          >
            High scores
          </button>
        </div>
        <p className="mt-4 text-sm text-ink/75">
          {DATA_COUNT.toLocaleString('en-US')} real planets found by NASA and other astronomers. We picked 24 for you.
        </p>
      </div>
    </div>
  );
}
