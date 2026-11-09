import type { MissionResult, Phase } from './types';

export type ClipName = 'takeoff' | 'explosion' | 'orbit_arrival';

export type PlaybackStep =
  /** Play a clip. `cutAt` (0..1) stops it partway through. */
  | { kind: 'clip'; clip: ClipName; cutAt?: number }
  /** Code-driven overlay. `background: 'space'` shows a static starfield instead of a clip. */
  | { kind: 'overlay'; variant: 'return' | 'failure' | 'signal-lost' | 'splashdown'; text: string; background?: 'space' | 'last-frame' };

/**
 * Outcome → playback mapping (section 3 of the brief):
 * - launch failure:  explosion only
 * - transit failure: takeoff → orbit_arrival cut partway → "Signal lost"/"Out of fuel" overlay
 * - planet failure:  takeoff → orbit_arrival (full) → failure overlay
 * - return failure:  takeoff → orbit_arrival → "Return journey" overlay on space → failure overlay
 * - success:         takeoff → orbit_arrival → "Return journey" overlay → "Splashdown / Mission complete"
 */
export function playbackFor(failedPhase: Phase | null, failureText = 'Mission failed'): PlaybackStep[] {
  switch (failedPhase) {
    case 'launch':
      return [{ kind: 'clip', clip: 'explosion' }, { kind: 'overlay', variant: 'failure', text: failureText, background: 'last-frame' }];
    case 'transit':
      return [
        { kind: 'clip', clip: 'takeoff' },
        { kind: 'clip', clip: 'orbit_arrival', cutAt: 0.45 },
        { kind: 'overlay', variant: 'signal-lost', text: failureText, background: 'last-frame' },
      ];
    case 'planet':
      return [
        { kind: 'clip', clip: 'takeoff' },
        { kind: 'clip', clip: 'orbit_arrival' },
        { kind: 'overlay', variant: 'failure', text: failureText, background: 'last-frame' },
      ];
    case 'return':
      return [
        { kind: 'clip', clip: 'takeoff' },
        { kind: 'clip', clip: 'orbit_arrival' },
        { kind: 'overlay', variant: 'return', text: 'Return journey', background: 'space' },
        { kind: 'overlay', variant: 'failure', text: failureText, background: 'space' },
      ];
    case null:
      return [
        { kind: 'clip', clip: 'takeoff' },
        { kind: 'clip', clip: 'orbit_arrival' },
        { kind: 'overlay', variant: 'return', text: 'Return journey', background: 'space' },
        { kind: 'overlay', variant: 'splashdown', text: 'Splashdown — Mission complete', background: 'space' },
      ];
  }
}

export const playbackForResult = (r: MissionResult): PlaybackStep[] =>
  playbackFor(r.failedPhase, r.failure?.overlay ?? 'Mission failed');
