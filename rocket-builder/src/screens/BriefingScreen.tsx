import { useState } from 'react';
import { Cabinet } from '../components/Cabinet';
import { Typewriter } from '../components/Typewriter';
import { useReducedMotion } from '../components/useReducedMotion';
import { useGame } from '../store/gameStore';

interface Line {
  who: string;
  role: string;
  text: string;
}

// Fictional characters. Their facts are real.
const LINES: Line[] = [
  {
    who: 'Dr. Rosa Okafor',
    role: 'Flight Director',
    text: 'Welcome to the team. Your job: design rockets that fly to a real exoplanet and come back. Every destination comes from the NASA Exoplanet Archive.',
  },
  {
    who: 'Sam Whitlock',
    role: 'Propulsion Lead',
    text: 'Straight talk: no real rocket can do this. The nearest exoplanet, Proxima Centauri b, is 4.2 light-years away. At Voyager 1’s speed that is about 73,000 years.',
  },
  {
    who: 'Dr. Rosa Okafor',
    role: 'Flight Director',
    text: 'So we cheat in one honest, clearly labelled way: a fictional Deep-Space Drive covers the light-years. Everything else (lift-off, landing, fuel, heat) uses real physics.',
  },
  {
    who: 'Sam Whitlock',
    role: 'Propulsion Lead',
    text: 'Watch your thrust-to-weight: below 1.2 you never leave the pad. Watch your Δv: the rocket equation decides if you make it home. Anything badged “Fictional tech” does not exist.',
  },
  {
    who: 'Dr. Rosa Okafor',
    role: 'Flight Director',
    text: 'You get ten attempts per difficulty. Your average goes on the leaderboard. Astronauts multiply your score, and your risk. Good luck.',
  },
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
    setSeen();
    go('difficulty');
  };
  const next = () => {
    if (!typed && !reduced) {
      setTyped(true);
      return;
    }
    if (last) finish();
    else {
      setI(i + 1);
      setTyped(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Cabinet title={`NASA mission briefing · ${i + 1}/${LINES.length}`} id="briefing">
        <div className="flex flex-col gap-5 sm:flex-row">
          <div
            className="mx-auto flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border-2 border-cyber bg-void font-display text-2xl text-cyber shadow-cyber"
            aria-hidden="true"
          >
            {line.who
              .replace('Dr. ', '')
              .split(' ')
              .map((p) => p[0])
              .join('')}
          </div>
          <div className="flex-1">
            <p className="font-display text-[0.7rem] text-neonsoft">
              {line.who} <span className="text-[#c3b2e8]">· {line.role}</span>
            </p>
            <p className="readout mt-3 min-h-[7.5rem] text-[1.45rem] text-haze" aria-live="polite">
              <Typewriter key={i} text={line.text} instant={typed || reduced} onDone={() => setTyped(true)} />
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-[#c3b2e8]">Characters are fictional; the facts they state are real.</p>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button type="button" className="btn btn-ghost" onClick={finish}>
            Skip briefing
          </button>
          <button type="button" className="btn btn-primary" onClick={next} autoFocus>
            {!typed && !reduced ? 'Show all' : last ? 'Choose difficulty' : 'Next'}
          </button>
        </div>
      </Cabinet>
    </div>
  );
}
