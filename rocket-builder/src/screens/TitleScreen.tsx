import { useEffect, useState } from 'react';
import { useReducedMotion } from '../components/useReducedMotion';
import { DATA_COUNT, DATA_RETRIEVED } from '../data/planets';
import { SYSTEMS } from '../data/space';
import { ATTEMPTS_PER_RUN } from '../engine';
import { MASS_MODEL } from '../ml/massModel';
import { Diorama, Layer } from '../paper/Diorama';
import { LEVEL } from '../paper/kid';
import { RocketSprite } from '../paper/RocketSprite';
import { DEMO_ROCKET, DriftingClouds, HillsAndSun, StarWall } from '../paper/scenery';
import { sfx } from '../paper/sfx';
import { PadSprite, PlanetSprite, TowerSprite } from '../paper/sprites';
import { useGame } from '../store/gameStore';

const BOOT = [
  'EXOPLANET ROCKET BUILDER v3.0',
  `NASA EXOPLANET ARCHIVE ....... ${DATA_COUNT.toLocaleString('en-US')} PLANETS (${DATA_RETRIEVED})`,
  `STAR SYSTEMS CHARTED ......... ${Object.keys(SYSTEMS).length}`,
  `MASS MODEL ................... ${MASS_MODEL.counts.train.toLocaleString('en-US')} TRAINING PLANETS`,
  'TSIOLKOVSKY SOLVER ........... OK',
  'DEEP-SPACE DRIVE ............. FICTIONAL (LABELLED)',
];

function BootLog() {
  const { reduced } = useReducedMotion();
  const total = BOOT.reduce((n, l) => n + l.length + 6, 0);
  const [n, setN] = useState(reduced ? total : 0);
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setN((k) => (k >= total ? (window.clearInterval(id), k) : k + 3)), 16);
    return () => window.clearInterval(id);
  }, [reduced, total]);
  let left = n;
  return (
    <div className="font-title text-[clamp(8px,1vw,11px)] leading-[2.1] text-mint" aria-hidden="true">
      {BOOT.map((line, i) => {
        const show = Math.max(0, Math.min(line.length, left));
        left -= line.length + 6;
        return show > 0 ? (
          <div key={i} className={i === 0 ? 'text-gold' : ''}>
            {line.slice(0, show)}
          </div>
        ) : null;
      })}
      {left > 0 && <div className="blink text-cream">PRESS START</div>}
    </div>
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
    <div className="gutter mx-auto max-w-6xl pt-6">
      <h1 className="sr-only">Exoplanet Rocket Builder</h1>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative">
          <Diorama className="h-[min(58vh,520px)] min-h-[340px] border-[3px] border-slate bg-navy0/40" camera={{ rx: 4 }}>
            <StarWall />
            <Layer x={80} y={64} z={-450} w={18}>
              <PlanetSprite planet={{ name: 'TRAPPIST-1 e', eqTempK: 250, planetClass: 'rocky' }} />
            </Layer>
            <Layer x={16} y={70} z={-500} w={13}>
              <PlanetSprite planet={{ name: 'WASP-39 b', eqTempK: 1166, planetClass: 'giant' }} />
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
              <RocketSprite rocket={DEMO_ROCKET} crew={2} />
            </Layer>
          </Diorama>
          <div className="pointer-events-none absolute inset-x-0 top-6 text-center">
            <p className="font-title text-[clamp(18px,3.4vw,38px)] leading-[1.35] text-gold" style={{ textShadow: '4px 4px 0 #c13b8a, 8px 8px 0 #05060f' }}>
              EXOPLANET
              <br />
              ROCKET BUILDER
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <section className="paper px-5 py-4" aria-label="System status">
            <BootLog />
          </section>
          <section className="paper px-5 py-5" aria-label="Main menu">
            <p className="text-[1.05rem]">
              Design a launch vehicle, fly it to a confirmed exoplanet from the NASA Exoplanet Archive, and get it home. Real data and real
              rocket physics; one clearly labelled fictional warp drive.
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              {inProgress && difficulty && (
                <button
                  type="button"
                  className="pbtn pbtn-butter w-full"
                  onClick={() => {
                    sfx.go();
                    go('planets');
                  }}
                >
                  ▶ Continue {LEVEL[difficulty].name} run ({run.attempts.length}/{ATTEMPTS_PER_RUN})
                </button>
              )}
              <button
                type="button"
                className={`pbtn w-full ${inProgress ? 'pbtn-paper' : 'pbtn-butter'}`}
                onClick={() => {
                  sfx.go();
                  go(briefingSeen ? 'difficulty' : 'briefing');
                }}
                autoFocus
              >
                ▶ {inProgress ? 'New run' : 'Start mission'}
              </button>
              <button
                type="button"
                className="pbtn w-full"
                onClick={() => {
                  sfx.go();
                  go('story');
                }}
              >
                ▶ Secret Project: learn the maths
              </button>
              <button
                type="button"
                className="pbtn pbtn-paper w-full"
                onClick={() => {
                  sfx.click();
                  go('leaderboard');
                }}
              >
                High scores
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
