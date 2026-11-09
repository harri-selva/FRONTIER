import { useState } from 'react';
import { Typewriter } from '../components/Typewriter';
import { useReducedMotion } from '../components/useReducedMotion';
import { Diorama, Layer } from '../paper/Diorama';
import { DEMO_ROCKET, StarWall } from '../paper/scenery';
import { sfx } from '../paper/sfx';
import { PipSprite, PlanetSprite, type Mood } from '../paper/sprites';
import { RocketSprite } from '../paper/RocketSprite';
import { useGame } from '../store/gameStore';

const LINES: { mood: Mood; text: string }[] = [
  { mood: 'happy', text: 'Hi! I’m Pip, your mission robot. Welcome to NASA’s rocket team!' },
  { mood: 'wow', text: 'Every planet here is REAL. Astronomers found them around other stars.' },
  { mood: 'think', text: 'They’re very far away. Real rockets would take thousands of years, so we use a pretend warp drive.' },
  { mood: 'happy', text: 'Your job: build a rocket that can lift off, reach the planet, and get home safely.' },
  { mood: 'wow', text: 'You get 10 tries. Brave astronauts make your score bigger. Ready?' },
];

export function BriefingScreen() {
  const go = useGame((s) => s.go);
  const setSeen = useGame((s) => s.setBriefingSeen);
  const { reduced } = useReducedMotion();
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState(false);
  const line = LINES[i] ?? LINES[0]!;
  const last = i === LINES.length - 1;

  const finish = () => {
    sfx.go();
    setSeen();
    go('difficulty');
  };
  const next = () => {
    if (!typed && !reduced) {
      setTyped(true);
      return;
    }
    sfx.pop();
    if (last) finish();
    else {
      setI(i + 1);
      setTyped(false);
    }
  };

  return (
    <div className="gutter mx-auto max-w-4xl pt-4">
      <h1 className="sr-only">Meet Pip</h1>
      <Diorama className="h-[min(46vh,400px)] min-h-[280px] rounded-[28px]" camera={{ rx: 3 }}>
        <StarWall />
        <Layer x={78} y={45} z={-300} w={24}>
          <div className="anim-bob" style={{ animationDuration: '8s' }}>
            <PlanetSprite planet={{ name: 'Proxima Cen b', eqTempK: 218, planetClass: 'rocky' }} />
          </div>
        </Layer>
        <Layer x={20} y={18} z={-150} w={9}>
          <div className="anim-bob">
            <RocketSprite rocket={DEMO_ROCKET} />
          </div>
        </Layer>
        <Layer x={50} y={4} z={40} w={30}>
          <div key={i} className="anim-pop">
            <div className={line.mood === 'wow' ? 'anim-wobble' : 'anim-bob'}>
              <PipSprite mood={line.mood} />
            </div>
          </div>
        </Layer>
      </Diorama>

      <div className="paper tape relative mx-auto -mt-6 max-w-2xl px-6 pb-5 pt-7">
        <p className="min-h-[4.5em] font-display text-[1.35rem] font-bold leading-snug" aria-live="polite">
          <Typewriter key={i} text={line.text} instant={typed || reduced} onDone={() => setTyped(true)} />
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <ol className="flex gap-1.5" aria-label={`Step ${i + 1} of ${LINES.length}`}>
            {LINES.map((_, n) => (
              <li key={n} className="h-2.5 w-6 rounded-full" style={{ background: n <= i ? '#ff7cc6' : 'rgba(42,23,71,.15)' }} />
            ))}
          </ol>
          <div className="flex gap-3">
            <button type="button" className="pbtn pbtn-paper pbtn-sm" onClick={finish}>
              Skip
            </button>
            <button type="button" className="pbtn" onClick={next} autoFocus>
              {!typed && !reduced ? 'Show all' : last ? 'Let’s go!' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
