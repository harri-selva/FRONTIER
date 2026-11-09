import { describe, expect, it } from 'vitest';
import { evaluateMission, playbackFor, playbackForResult } from '../index';
import { drive, engine, goodRocket, planet } from './fixtures';

const clips = (steps: ReturnType<typeof playbackFor>) =>
  steps.map((s) => (s.kind === 'clip' ? `${s.clip}${s.cutAt !== undefined ? '(cut)' : ''}` : `overlay:${s.variant}`));

describe('outcome → animation mapping', () => {
  it('launch failure: explosion only', () => {
    expect(clips(playbackFor('launch'))).toEqual(['explosion', 'overlay:failure']);
  });
  it('transit failure: takeoff → orbit_arrival cut partway → signal-lost overlay', () => {
    const steps = playbackFor('transit', 'Signal lost.');
    expect(clips(steps)).toEqual(['takeoff', 'orbit_arrival(cut)', 'overlay:signal-lost']);
    const cut = steps[1];
    expect(cut?.kind === 'clip' && cut.cutAt !== undefined && cut.cutAt > 0 && cut.cutAt < 1).toBe(true);
  });
  it('planet failure: takeoff → full orbit_arrival → failure overlay', () => {
    expect(clips(playbackFor('planet'))).toEqual(['takeoff', 'orbit_arrival', 'overlay:failure']);
  });
  it('return failure: takeoff → orbit_arrival → return overlay on space → failure overlay', () => {
    const steps = playbackFor('return');
    expect(clips(steps)).toEqual(['takeoff', 'orbit_arrival', 'overlay:return', 'overlay:failure']);
    expect(steps[2]?.kind === 'overlay' && steps[2].background).toBe('space');
  });
  it('success: takeoff → orbit_arrival → return → splashdown', () => {
    expect(clips(playbackFor(null))).toEqual(['takeoff', 'orbit_arrival', 'overlay:return', 'overlay:splashdown']);
  });
  it('uses the failing check’s overlay text', () => {
    const r = evaluateMission(goodRocket({ drive: drive({ rangeLy: 1 }) }), planet(), 'hard', 0);
    const last = playbackForResult(r).at(-1);
    expect(last?.kind === 'overlay' && last.text).toBe(r.failure?.overlay);
    const boom = evaluateMission(goodRocket({ engine: engine({ thrust: 1 }) }), planet(), 'hard', 0);
    expect(clips(playbackForResult(boom))[0]).toBe('explosion');
  });
});
