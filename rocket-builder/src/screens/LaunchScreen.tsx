import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimationPlayer } from '../components/animation/AnimationPlayer';
import { preloadClips } from '../components/animation/sources';
import { fmtInt } from '../components/format';
import { useReducedMotion } from '../components/useReducedMotion';
import { COMPONENTS_BY_ID } from '../data/components';
import { findPlanet } from '../data/planets';
import { playbackForResult, type Phase, type PlaybackStep } from '../engine';
import { useGame } from '../store/gameStore';

const TRACKER = ['Launch', 'Transit', 'Approach', 'Surface/Orbit', 'Return', 'Complete'] as const;
const FAIL_INDEX: Record<Phase, number> = { launch: 0, transit: 1, planet: 3, return: 4 };
const OVERLAY_MS = 2800;
const COUNTDOWN = 10;

/** Which tracker stage is active for a playback step. */
function trackerIndex(step: PlaybackStep | undefined, clipProgress: number): number {
  if (!step) return 0;
  if (step.kind === 'clip') {
    if (step.clip === 'takeoff' || step.clip === 'explosion') return 0;
    return clipProgress < 0.5 ? 1 : 2;
  }
  if (step.variant === 'return') return 4;
  if (step.variant === 'splashdown') return 5;
  return -1; // failure overlays: tracker shows the failed stage
}

export function LaunchScreen() {
  const result = useGame((s) => s.lastResult);
  const planetName = useGame((s) => s.planetName);
  const build = useGame((s) => s.build);
  const go = useGame((s) => s.go);
  const { reduced } = useReducedMotion();
  const planet = planetName ? findPlanet(planetName) : null;
  const steps = useMemo(() => (result ? playbackForResult(result) : []), [result]);

  const [count, setCount] = useState(reduced ? 0 : COUNTDOWN);
  const [stepIndex, setStepIndex] = useState(0);
  const [clipProgress, setClipProgress] = useState(0);

  useEffect(() => preloadClips(), []);

  // Countdown 10 → 0.
  useEffect(() => {
    if (count <= 0) return;
    const id = window.setTimeout(() => setCount((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [count]);

  const step = count <= 0 ? steps[stepIndex] : undefined;
  const isLast = stepIndex >= steps.length - 1;
  const advance = useCallback(() => {
    setClipProgress(0);
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }, [steps.length]);

  // Overlays advance on a timer, except the final one.
  useEffect(() => {
    if (!step || step.kind !== 'overlay' || isLast) return;
    const id = window.setTimeout(advance, reduced ? 1200 : OVERLAY_MS);
    return () => window.clearTimeout(id);
  }, [step, isLast, advance, reduced]);

  // Approximate progress through the orbit clip, for the Transit → Approach tracker step.
  useEffect(() => {
    if (!step || step.kind !== 'clip' || step.clip !== 'orbit_arrival') return;
    const start = performance.now();
    const id = window.setInterval(() => setClipProgress(Math.min(1, (performance.now() - start) / 3500)), 250);
    return () => window.clearInterval(id);
  }, [step]);

  if (!result || !planet) {
    return (
      <div className="p-8 text-center">
        <button type="button" className="btn btn-primary" onClick={() => go('planets')}>
          Back
        </button>
      </div>
    );
  }

  const failedAt = result.failedPhase ? FAIL_INDEX[result.failedPhase] : null;
  const active = step ? trackerIndex(step, clipProgress) : -2;
  const showFailure = step?.kind === 'overlay' && (step.variant === 'failure' || step.variant === 'signal-lost');
  const currentTracker = showFailure && failedAt !== null ? failedAt : active;

  // The clip shown underneath overlays that use the last frame.
  const lastClipIndex = (() => {
    for (let i = stepIndex; i >= 0; i--) if (steps[i]?.kind === 'clip') return i;
    return -1;
  })();
  const lastClip = steps[lastClipIndex];
  const background = step?.kind === 'overlay' ? step.background : undefined;

  const pressureCap = result.checks.find((c) => c.id === 'pressure');
  const pressureFail = result.failure?.id === 'pressure';
  const tankLoad = (() => {
    const p = build.pressure ? COMPONENTS_BY_ID[build.pressure] : undefined;
    const engine = build.engine ? COMPONENTS_BY_ID[build.engine] : undefined;
    if (engine?.category === 'engine' && engine.propellant === 'solid') return 'solid motor: none needed';
    if (!p || p.category !== 'pressure') return 'no pressure system';
    return `${fmtInt((result?.propellantKg ?? 0) / p.capacity * 100)}% of capacity`;
  })();

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-void text-haze">
      {/* Mission status tracker */}
      <nav aria-label="Mission status" className="border-b-2 border-neon/60 bg-night/90 px-3 py-2">
        <ol className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-1 sm:gap-2">
          {TRACKER.map((t, i) => {
            const failedHere = failedAt === i && (showFailure || isLast) && count <= 0 && stepIndex === steps.length - 1;
            const done = currentTracker > i || (result.success && isLast && step?.kind === 'overlay');
            const now = currentTracker === i;
            const cls = failedHere
              ? 'border-[#ff6b8b] bg-[#ff6b8b]/25 text-[#ffd0da]'
              : now
                ? 'border-cyber bg-cyber/20 text-cyber'
                : done
                  ? 'border-ok/70 text-ok'
                  : 'border-[#6b4ba8] text-[#c3b2e8]';
            return (
              <li key={t} className={`rounded-md border-2 px-2 py-1 font-display text-[0.5rem] sm:text-[0.6rem] ${cls}`} aria-current={now ? 'step' : undefined}>
                {failedHere ? '✖ ' : done ? '✔ ' : ''}
                {t}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="relative flex-1 overflow-hidden">
        {count > 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <p className="font-display text-[0.7rem] text-neonsoft">T-minus · {planet.name}</p>
            <p className="font-display text-7xl sm:text-9xl" aria-live="assertive" aria-atomic="true">
              <span className="chrome">{count}</span>
            </p>
            <p className="readout text-cyber">All systems: go for launch</p>
          </div>
        ) : (
          <>
            {/* Clip layer */}
            {background === 'space' ? (
              <div className="absolute inset-0 bg-void" aria-hidden="true">
                <div className="vw-stars" />
              </div>
            ) : (
              lastClip?.kind === 'clip' && (
                <div className={`absolute inset-0 ${showFailure && lastClip.clip === 'explosion' && !reduced ? 'shake' : ''}`}>
                  <AnimationPlayer
                    key={lastClipIndex}
                    clip={lastClip.clip}
                    cutAt={lastClip.cutAt}
                    paused={step?.kind === 'overlay'}
                    reduced={reduced}
                    onEnded={advance}
                  />
                </div>
              )
            )}

            {/* Overlay layer */}
            {step?.kind === 'overlay' && (
              <div className={`absolute inset-0 flex items-center justify-center p-4 ${step.variant === 'signal-lost' && !reduced ? 'static-noise' : ''}`}>
                <div
                  className={`fade-in max-w-xl rounded-2xl border-4 px-6 py-6 text-center shadow-neon ${
                    step.variant === 'splashdown'
                      ? 'border-ok bg-night/90'
                      : step.variant === 'return'
                        ? 'border-cyber bg-night/85'
                        : 'border-[#ff6b8b] bg-night/90'
                  }`}
                  role="status"
                  aria-live="assertive"
                >
                  <p className="font-display text-[0.65rem] text-[#c3b2e8]">
                    {step.variant === 'return' ? 'Phase 5' : step.variant === 'splashdown' ? 'Mission status' : 'Mission status'}
                  </p>
                  <p className={`mt-2 font-display text-lg leading-relaxed sm:text-2xl ${step.variant === 'splashdown' ? 'text-ok' : step.variant === 'return' ? 'text-cyber' : 'text-[#ffb3c3]'}`}>
                    {step.variant === 'signal-lost' && result.failure?.id === 'comms' ? 'SIGNAL LOST' : step.variant === 'failure' || step.variant === 'signal-lost' ? 'MISSION FAILURE' : step.text}
                  </p>
                  {(step.variant === 'failure' || step.variant === 'signal-lost') && <p className="readout mt-3 text-xl text-haze">{step.text}</p>}
                  {step.variant === 'return' && (
                    <p className="readout mt-3 text-haze">
                      Leaving {planet.name} · {fmtInt(planet.distanceLy)} ly to home
                    </p>
                  )}
                  {step.variant === 'splashdown' && <p className="readout mt-3 text-xl text-haze">Crew and craft recovered. Earth → {planet.name} → Earth.</p>}
                </div>
              </div>
            )}
          </>
        )}

        {/* Pressure meter overlay */}
        <div className="absolute bottom-3 left-3 rounded-lg border-2 border-neon/60 bg-night/85 px-3 py-2 text-xs" aria-label="Tank pressure">
          <p className="font-display text-[0.5rem] text-neonsoft">Tank pressure</p>
          <p className={`readout text-base ${pressureFail ? 'text-[#ffb3c3]' : 'text-cyber'} ${pressureFail && !reduced && count <= 0 ? 'blink' : ''}`}>
            {pressureFail ? 'FAILURE · ' : ''}
            {tankLoad}
            {pressureCap?.status === 'auto' ? ' · not checked on this difficulty' : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t-2 border-neon/60 bg-night/90 px-3 py-2">
        {count <= 0 && isLast && step?.kind === 'overlay' ? (
          <button type="button" className="btn btn-primary" onClick={() => go('outcome')} autoFocus>
            View results
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => go('outcome')} autoFocus>
            Skip animation ⏭
          </button>
        )}
      </div>
    </div>
  );
}
