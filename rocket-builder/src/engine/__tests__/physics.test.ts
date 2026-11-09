import { describe, expect, it } from 'vitest';
import {
  derivePlanet,
  parsecsToLightYears,
  requiredDeltaV,
  stagedDeltaV,
  surfaceGravityG,
  surfaceOrbitalVelocityKms,
  thrustToWeight,
  tsiolkovsky,
} from '../index';
import { engine, goodRocket, payload, tank } from './fixtures';

describe('Tsiolkovsky', () => {
  it('matches a hand-calculated value', () => {
    // 300 s × 9.81 m/s² × ln(100,000 / 50,000) = 2943 × 0.693147… = 2039.93 m/s
    expect(tsiolkovsky(300, 100_000, 50_000)).toBeCloseTo(2039.93, 1);
  });
  it('returns 0 for impossible inputs', () => {
    expect(tsiolkovsky(300, 0, 10)).toBe(0);
    expect(tsiolkovsky(300, 10, 20)).toBe(0);
  });
  it('single tank equals Isp·g0·ln(wet/dry)', () => {
    const r = goodRocket({ payload: payload({ mass: 1000 }), tanks: [tank({ mass: 1000, propellantCapacity: 50_000 })] });
    // core = 1000 (payload) + 1000 (engine) + 1000 (drive) + 100 + 100 + 100 = 3300; + tank 1000 = 4300 dry, 54,300 wet
    const expected = 3000 * 9.81 * Math.log(54_300 / 4_300);
    expect(stagedDeltaV(r, 0).totalMs).toBeCloseTo(expected, 6);
  });
  it('drop-tank staging beats one big tank of the same total', () => {
    const staged = goodRocket({ tanks: [tank(), tank()] });
    const single = goodRocket({ tanks: [tank({ mass: 2000, propellantCapacity: 100_000 })] });
    expect(stagedDeltaV(staged, 0).totalMs).toBeGreaterThan(stagedDeltaV(single, 0).totalMs);
  });
  it('returns 0 with no engine or no tanks', () => {
    expect(stagedDeltaV(goodRocket({ engine: null }), 0).totalMs).toBe(0);
    expect(stagedDeltaV(goodRocket({ tanks: [] }), 0).totalMs).toBe(0);
  });
});

describe('thrust-to-weight', () => {
  it('computes thrust / (m g0)', () => {
    expect(thrustToWeight(981, 100_000)).toBeCloseTo(1, 10);
  });
  it('engine thrust uses kN', () => {
    expect(engine().thrust).toBe(100_000);
  });
});

describe('planet derivations', () => {
  it('converts parsecs to light-years', () => {
    expect(parsecsToLightYears(1.3012)).toBeCloseTo(4.244, 3);
  });
  it('computes gravity and orbital velocity', () => {
    expect(surfaceGravityG(1, 1)).toBe(1);
    expect(surfaceGravityG(8, 2)).toBe(2);
    expect(surfaceOrbitalVelocityKms(1, 1)).toBeCloseTo(7.9, 10);
    expect(surfaceOrbitalVelocityKms(4, 1)).toBeCloseTo(15.8, 10);
  });
  it('classifies by radius and labels mass provenance', () => {
    const base = {
      pl_name: 'X b', hostname: 'X', sy_dist: 1, pl_bmasse: 1, pl_eqt: 300, pl_orbper: 1, pl_orbsmax: 0.1,
      st_spectype: null, discoverymethod: 'Transit', disc_year: 2020,
    };
    const rocky = derivePlanet({ ...base, pl_rade: 1.6, pl_bmassprov: 'Mass' });
    const giant = derivePlanet({ ...base, pl_rade: 1.61, pl_bmassprov: 'M-R relationship' });
    expect(rocky.missionType).toBe('landing');
    expect(rocky.massProvenance).toBe('measured');
    expect(giant.missionType).toBe('survey');
    expect(giant.massProvenance).toBe('estimated');
    expect(derivePlanet({ ...base, pl_rade: 1, pl_bmassprov: 'Msini' }).massProvenance).toBe('minimum');
  });
  it('rejects rows with missing required fields', () => {
    expect(() =>
      derivePlanet({
        pl_name: 'X', hostname: 'X', sy_dist: null, pl_rade: 1, pl_bmasse: 1, pl_bmassprov: null, pl_eqt: 1,
        pl_orbper: null, pl_orbsmax: null, st_spectype: null, discoverymethod: null, disc_year: null,
      }),
    ).toThrow();
  });
});

describe('required Δv', () => {
  it('landing: (9.4 + 2.4·v_orb + 0.5) × 1.1', () => {
    const req = requiredDeltaV({ ...derivePlanet({
      pl_name: 'E', hostname: 'E', sy_dist: 1, pl_rade: 1, pl_bmasse: 1, pl_bmassprov: 'Mass', pl_eqt: 288,
      pl_orbper: null, pl_orbsmax: null, st_spectype: null, discoverymethod: null, disc_year: null,
    }) });
    expect(req.planet).toBeCloseTo(2.4 * 7.9, 10);
    expect(req.totalRequired).toBeCloseTo((9.4 + 2.4 * 7.9 + 0.5) * 1.1, 10);
  });
  it('survey uses 0.5·v_orb', () => {
    const p = derivePlanet({
      pl_name: 'G', hostname: 'G', sy_dist: 1, pl_rade: 4, pl_bmasse: 16, pl_bmassprov: 'Mass', pl_eqt: 288,
      pl_orbper: null, pl_orbsmax: null, st_spectype: null, discoverymethod: null, disc_year: null,
    });
    expect(p.missionType).toBe('survey');
    expect(requiredDeltaV(p).planet).toBeCloseTo(0.5 * 15.8, 10);
  });
});
