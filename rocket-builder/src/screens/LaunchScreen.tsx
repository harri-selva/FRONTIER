import { useEffect, useMemo, useState } from 'react';
import { AnimationPlayer } from '../components/animation/AnimationPlayer';
import { findClip } from '../components/animation/sources';
import { useReducedMotion } from '../components/useReducedMotion';
import { COMPONENTS_BY_ID } from '../data/components';
import { findPlanet } from '../data/planets';
import { playbackForResult, type CheckId, type MissionResult } from '../engine';
import { kidFailure } from '../paper/kid';
import { ArriveScene, PadScene, SpaceScene, SplashScene, type SceneProps } from '../paper/scenes';
import { sfx } from '../paper/sfx';
import { PipSprite } from '../paper/sprites';
import { Confetti } from '../paper/ui';
import { useGame } from '../store/gameStore';
import { resolveBuild } from '../store/resolve';

type SceneName = 'countdown' | 'liftoff' | 'explode' | 'space' | 'arrive' | 'home' | 'splash' | 'done';

const DUR: Record<Exclude<SceneName, 'done'>, number> = {
  countdown: 10000,
  liftoff: 5200,
  explode: 3600,
  space: 4800,
  arrive: 5000,
  home: 4600,
  splash: 5600,
};
const REDUCED_DUR = 1800;

const TICKETS = ['Lift-off', 'Space', 'Approach', 'Land/Orbit', 'Home', 'Done'] as const;

const SIGN: Partial<Record<CheckId, string>> = {
  driveRange: 'OUT OF RANGE',
  comms: 'SIGNAL LOST',
  radiation: 'RADIATION LIMIT',
  dvOrbit: 'OUT OF FUEL',
  heatPlanet: 'THERMAL FAILURE',
  dvReturn: 'OUT OF FUEL',
  heatReentry: 'THERMAL FAILURE',
};
const CAUSE: Partial<Record<CheckId, SceneProps['cause']>> = {
  driveRange: 'fuel',
  comms: 'signal',
  radiation: 'radiation',
  dvOrbit: 'fuel',
  heatPlanet: 'heat',
  dvPlanet: 'fuel',
  dvReturn: 'fuel',
  heatReentry: 'heat',
};

/** Scene list per outcome. Mirrors the brief's outcome → animation mapping. */
function scenesFor(r: MissionResult): SceneName[] {
  switch (r.failedPhase) {
    case 'launch':
      return ['countdown', 'explode', 'done'];
    case 'transit':
      return ['countdown', 'liftoff', 'space', 'done'];
    case 'planet':
      return ['countdown', 'liftoff', 'space', 'arrive', 'done'];
    case 'return':
      return ['countdown', 'liftoff', 'space', 'arrive', 'home', 'done'];
    default:
      return ['countdown', 'liftoff', 'space', 'arrive', 'home', 'splash', 'done'];
  }
}

function ticketFor(scene: SceneName, elapsed: number): number {
  switch (scene) {
    case 'countdown':
    case 'liftoff':
    case 'explode':
      return 0;
    case 'space':
      return elapsed < DUR.space / 2 ? 1 : 2;
    case 'arrive':
      return 3;
    case 'home':
      return 4;
    default:
      return 5;
  }
}

const FAIL_TICKET = { launch: 0, transit: 1, planet: 3, return: 4 } as const;

function PressureDial({ load, label }: { load: number | null; label: string }) {
  const angle = load === null ? -90 : -90 + Math.min(1.25, load) * 144;
  const over = load !== null && load > 1;
  return (
    <div className="paper flex items-center gap-2 px-3 py-2" role="img" aria-label={`Tank pump pressure: ${label}`}>
      <svg viewBox="0 0 60 36" width="64" height="40" aria-hidden="true">
        <path d="M6 32 A24 24 0 0 1 54 32" fill="none" stroke="#dff7ee" strokeWidth="8" />
        <path d="M44 12 A24 24 0 0 1 54 32" fill="none" stroke="#ff5d73" strokeWidth="8" />
        <g transform={`rotate(${angle} 30 32)`} style={{ transition: 'transform 1s cubic-bezier(.3,1.6,.5,1)' }}>
          <path d="M30 32 L30 10" stroke="#2a1747" strokeWidth="3.5" strokeLinecap="round" />
        </g>
        <circle cx="30" cy="32" r="4" fill="#2a1747" />
      </svg>
      <div className="text-xs leading-tight">
        <p className="font-display text-sm font-extrabold">Tank pump</p>
        <p className={over ? 'font-bold text-[#ff8f86]' : ''}>{label}</p>
      </div>
    </div>
  );
}

function useClipsReady(): boolean | null {
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.all((['takeoff', 'explosion', 'orbit_arrival'] as const).map(findClip)).then((s) => {
      if (alive) setReady(s.every((x) => x.kind !== 'placeholder'));
    });
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

/** If the hand-drawn clips are in public/animations, play them in a paper frame. */
function ClipStage({ result, reduced, onDone }: { result: MissionResult; reduced: boolean; onDone: () => void }) {
  const steps = useMemo(() => playbackForResult(result), [result]);
  const [i, setI] = useState(0);
  const step = steps[i];
  useEffect(() => {
    if (!step || step.kind !== 'overlay') return;
    const id = window.setTimeout(() => (i >= steps.length - 1 ? onDone() : setI(i + 1)), reduced ? 1200 : 2600);
    return () => window.clearTimeout(id);
  }, [step, i, steps.length, onDone, reduced]);
  if (!step) return null;
  return (
    <div className="grid h-full place-items-center p-4">
      <div className="paper w-[min(960px,100%)] overflow-hidden p-3">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-night">
          {step.kind === 'clip' ? (
            <AnimationPlayer key={i} clip={step.clip} cutAt={step.cutAt} reduced={reduced} onEnded={() => setI(i + 1)} />
          ) : (
            <div className="grid h-full place-items-center">
              <p className="anim-stamp rounded-2xl bg-butter px-6 py-3 font-display text-3xl font-black">{step.text}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function LaunchScreen() {
  const result = useGame((s) => s.lastResult);
  const planetName = useGame((s) => s.planetName);
  const build = useGame((s) => s.build);
  const crew = useGame((s) => s.crew);
  const go = useGame((s) => s.go);
  const { reduced } = useReducedMotion();
  const clipsReady = useClipsReady();
  const planet = planetName ? findPlanet(planetName) : null;
  const rocket = useMemo(() => resolveBuild(build), [build]);
  const scenes = useMemo(() => (result ? scenesFor(result) : []), [result]);
  const [si, setSi] = useState(0);
  const [count, setCount] = useState(10);
  const [elapsed, setElapsed] = useState(0);
  const scene = scenes[si] ?? 'done';

  // Advance scenes.
  useEffect(() => {
    if (scene === 'done' || clipsReady) return;
    // Set an absolute index (not x + 1) so a repeated effect run can't skip a scene.
    const nextIndex = si + 1;
    if (scene === 'countdown' && reduced) {
      setSi(nextIndex);
      return;
    }
    const ms = reduced ? REDUCED_DUR : DUR[scene];
    const id = window.setTimeout(() => setSi(nextIndex), ms);
    return () => window.clearTimeout(id);
  }, [scene, si, reduced, clipsReady]);

  // Countdown numbers + sounds per scene.
  useEffect(() => {
    setElapsed(0);
    const start = performance.now();
    const tick = window.setInterval(() => setElapsed(performance.now() - start), 250);
    if (scene === 'countdown') {
      setCount(10);
      sfx.tick();
      const id = window.setInterval(() => {
        setCount((c) => {
          if (c > 1) sfx.tick();
          return Math.max(0, c - 1);
        });
      }, 1000);
      return () => {
        window.clearInterval(id);
        window.clearInterval(tick);
      };
    }
    if (scene === 'liftoff') sfx.rumble();
    if (scene === 'explode') window.setTimeout(() => sfx.boom(), reduced ? 0 : 1100);
    if (scene === 'space' || scene === 'home') sfx.whoosh();
    if (scene === 'splash') window.setTimeout(() => sfx.splash(), reduced ? 0 : 3200);
    if (scene === 'done') (result?.success ? sfx.win : sfx.sad)();
    return () => window.clearInterval(tick);
  }, [scene, reduced, result?.success]);

  if (!result || !planet) {
    return (
      <div className="p-10 text-center">
        <button type="button" className="pbtn" onClick={() => go('planets')}>
          Back
        </button>
      </div>
    );
  }

  const failure = result.failure;
  const said = failure ? kidFailure(failure, planet) : null;
  const lastScene = scenes[scenes.length - 2];
  const failingNow = !!failure && (scene === lastScene || scene === 'done') && scene !== 'countdown';
  const props: SceneProps = {
    rocket,
    crew,
    planet,
    reduced,
    failing: failingNow,
    cause: failure ? CAUSE[failure.id] ?? 'boom' : undefined,
    sign: failure ? SIGN[failure.id] ?? (failure.id === 'dvPlanet' && planet.missionType === 'landing' ? 'STUCK!' : 'OUT OF FUEL') : undefined,
  };
  const failTicket = result.failedPhase ? FAIL_TICKET[result.failedPhase] : null;
  const current = scene === 'done' ? (result.success ? 5 : failTicket ?? 0) : ticketFor(scene, elapsed);

  const narration: Record<SceneName, string> = {
    countdown: count > 0 ? `${count}…` : 'Lift-off!',
    liftoff: 'T+0: lift-off. Engines at full thrust.',
    explode: 'Anomaly on the pad.',
    space: failingNow && elapsed > 2000 ? said?.oops ?? '' : `Deep-Space Drive engaged. Course: ${planet.name}.`,
    arrive: failingNow && elapsed > 3200 ? said?.oops ?? '' : planet.missionType === 'landing' ? `Landing on ${planet.name}…` : `Going into orbit around ${planet.name}…`,
    home: failingNow && elapsed > 2000 ? said?.oops ?? '' : 'Return leg: course for Earth.',
    splash: 'Re-entry complete. Parachutes deployed.',
    done: result.success ? 'Mission complete: vehicle recovered.' : said?.oops ?? 'Mission over.',
  };

  const engine = build.engine ? COMPONENTS_BY_ID[build.engine] : undefined;
  const pump = build.pressure ? COMPONENTS_BY_ID[build.pressure] : undefined;
  const solid = engine?.category === 'engine' && engine.propellant === 'solid';
  const load = solid || !pump || pump.category !== 'pressure' ? null : result.propellantKg / pump.capacity;
  const loadLabel = solid ? 'not needed (solid fuel)' : load === null ? 'no pump fitted' : `${Math.round(load * 100)}% full${failure?.id === 'pressure' ? ' · FAILED' : ''}`;

  // On 'done' the final scene stays mounted (same element type), so its end state remains visible.
  const shown: SceneName = scene === 'done' ? lastScene ?? 'countdown' : scene;
  const sceneEl = (() => {
    if (clipsReady) return <ClipStage result={result} reduced={reduced} onDone={() => setSi(scenes.length - 1)} />;
    switch (shown) {
      case 'countdown':
      case 'liftoff':
      case 'explode':
        return <PadScene {...props} phase={shown} />;
      case 'space':
        return <SpaceScene {...props} />;
      case 'arrive':
        return <ArriveScene {...props} />;
      case 'home':
        return <SpaceScene {...props} toEarth />;
      case 'splash':
      case 'done':
        return <SplashScene {...props} />;
    }
  })();

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-night" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <nav aria-label="Mission progress" className="gutter relative z-20 py-2">
        <ol className="mx-auto flex max-w-4xl flex-wrap justify-center gap-1.5">
          {TICKETS.map((t, i) => {
            const failedHere = scene === 'done' && failTicket === i && !result.success;
            const done = i < current || (scene === 'done' && result.success);
            const now = i === current && scene !== 'done';
            return (
              <li
                key={t}
                aria-current={now ? 'step' : undefined}
                className={`rounded-md px-2.5 py-1 font-display text-xs font-extrabold transition-all sm:text-sm ${
                  failedHere ? 'bg-tomato text-ink' : now ? 'scale-110 bg-butter text-ink' : done ? 'bg-mint text-ink' : 'bg-paper/25 text-cream'
                }`}
                style={{ boxShadow: '0 0 0 2.5px #05060f', transform: `rotate(${(i % 2 ? 1 : -1) * 2}deg)` }}
              >
                {failedHere ? '✖ ' : done ? '✔ ' : ''}
                {t}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="relative flex-1 overflow-hidden">
        {sceneEl}
        {scene === 'countdown' && !reduced && count > 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div key={count} className="anim-flip">
              <div
                className="grid h-[min(34vw,200px)] w-[min(34vw,200px)] place-items-center border-4 border-gold bg-navy0 font-title text-[min(16vw,110px)] leading-none text-gold"
                style={{ boxShadow: 'inset 4px 4px 0 #1e2557, 8px 8px 0 #05060f', textShadow: '6px 6px 0 #c13b8a' }}
                aria-hidden="true"
              >
                {count}
              </div>
            </div>
          </div>
        )}

        {scene === 'done' && (
          <div className={`absolute inset-0 flex items-end justify-center p-4 pb-20 ${result.success ? '' : 'bg-night/40'}`}>
            {result.success && <Confetti />}
            <div className="paper anim-pop flex w-[min(560px,100%)] items-center gap-4 px-5 py-4 text-left">
              <div className="w-16 shrink-0">
                <PipSprite mood={result.success ? 'wow' : 'sad'} />
              </div>
              <div className="min-w-0 flex-1">
              <p className="font-display text-2xl font-black leading-tight">{result.success ? 'Mission complete.' : said?.oops}</p>
              {!result.success && said && <p className="mt-1 font-medium">Tip: {said.tip}</p>}
              <button type="button" className="pbtn mt-3" onClick={() => go('outcome')} autoFocus>
                Mission report
              </button>
              </div>
            </div>
          </div>
        )}

        <div className="absolute bottom-3 left-3" style={{ marginLeft: 'env(safe-area-inset-left, 0px)' }}>
          <PressureDial load={load} label={loadLabel} />
        </div>
      </div>

      <div className="gutter relative z-20 flex flex-wrap items-center justify-between gap-3 py-3">
        <p className="paper min-w-0 flex-1 px-4 py-2 font-display text-lg font-extrabold" aria-live="polite">
          {narration[scene]}
        </p>
        {scene !== 'done' && (
          <button type="button" className="pbtn pbtn-paper" onClick={() => go('outcome')}>
            Skip ⏭
          </button>
        )}
      </div>
    </div>
  );
}
