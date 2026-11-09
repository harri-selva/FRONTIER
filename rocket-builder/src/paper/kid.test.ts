import { describe, expect, it } from 'vitest';
import { ALL_COMPONENTS } from '../data/components';
import { PLANETS_BY_DIFFICULTY } from '../data/planets';
import { evaluateMission, type CheckId, type CheckResult } from '../engine';
import { resolveBuild } from '../store/resolve';
import { bars, feelsLike, KID_DESC, kidFailure, starsFor } from './kid';

const planet = PLANETS_BY_DIFFICULTY.easy[0]!;
const IDS: CheckId[] = ['twr', 'maxMass', 'pressure', 'dvOrbit', 'driveRange', 'comms', 'radiation', 'heatPlanet', 'dvPlanet', 'dvReturn', 'heatReentry', 'budget'];

describe('kid-friendly text', () => {
  it('has a short message and a tip for every check', () => {
    for (const id of IDS) {
      const c = { id } as CheckResult;
      const said = kidFailure(c, planet);
      expect(said.oops.length, id).toBeGreaterThan(5);
      expect(said.oops.length, id).toBeLessThan(80);
      expect(said.tip.length, id).toBeGreaterThan(5);
    }
  });
  it('describes every part in kid words', () => {
    for (const c of ALL_COMPONENTS) expect(KID_DESC[c.id], c.id).toBeTruthy();
  });
  it('converts kelvin to °C', () => {
    expect(feelsLike(273.15).c).toBe(0);
    expect(feelsLike(218).word).toBe('freezing');
  });
  it('keeps bars in 1..5', () => {
    for (const v of [0, 100, 3600, 7600, 99999]) {
      expect(bars.power(v)).toBeGreaterThanOrEqual(1);
      expect(bars.power(v)).toBeLessThanOrEqual(5);
    }
    expect(bars.efficiency(250)).toBe(1);
    expect(bars.efficiency(3000)).toBe(5);
  });
  it('gives 2–3 stars for a success and 0 for a launch failure', () => {
    const good = resolveBuild({ payload: 'payload-probe', engine: 'engine-fusion', drive: 'drive-sail', tanks: ['tank-lh2', 'tank-lh2'], comms: 'comms-quantum', pressure: null, protection: null });
    const r = evaluateMission(good, planet, 'easy', 0);
    expect(r.success).toBe(true);
    expect(starsFor(r)).toBeGreaterThanOrEqual(2);
    const heavy = resolveBuild({ payload: 'payload-explorer', engine: 'engine-kerolox', drive: 'drive-sail', tanks: ['tank-kerolox', 'tank-kerolox', 'tank-kerolox'], comms: 'comms-quantum', pressure: null, protection: null });
    expect(starsFor(evaluateMission(heavy, planet, 'easy', 0))).toBe(0);
  });
});
