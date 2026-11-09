import { describe, expect, it } from 'vitest';
import { evaluateMission, G0, MAX_LAUNCH_MASS_KG, wetMassKg } from '../index';
import type { CheckId, Difficulty, Phase, Rocket } from '../types';
import { comms, drive, engine, goodRocket, planet, pressure, protection, tank } from './fixtures';

const failOf = (r: Rocket, d: Difficulty = 'hard', crew = 0, p = planet()) => evaluateMission(r, p, d, crew);

function expectFailure(r: ReturnType<typeof failOf>, id: CheckId, phase: Phase): void {
  expect(r.success).toBe(false);
  expect(r.failure?.id).toBe(id);
  expect(r.failedPhase).toBe(phase);
}

describe('evaluateMission', () => {
  it('the reference rocket succeeds on every difficulty', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      const r = failOf(goodRocket(), d, 2);
      expect(r.success, d).toBe(true);
      expect(r.failedPhase).toBeNull();
      expect(Object.values(r.phases).every((p) => p === 'pass')).toBe(true);
    }
  });

  it('TWR exactly 1.2 passes; just below fails at launch', () => {
    const base = goodRocket();
    const wet = wetMassKg(base, 0);
    const exact = goodRocket({ engine: engine({ thrust: (1.2 * wet * G0) / 1000 }) });
    expect(failOf(exact).checks.find((c) => c.id === 'twr')?.status).toBe('pass');
    const below = goodRocket({ engine: engine({ thrust: (1.199 * wet * G0) / 1000 }) });
    expectFailure(failOf(below), 'twr', 'launch');
  });

  it('fails at launch when over the max launch mass', () => {
    const heavy = goodRocket({ tanks: [tank({ propellantCapacity: MAX_LAUNCH_MASS_KG })] });
    expectFailure(failOf(heavy), 'maxMass', 'launch');
  });

  it('fails at launch on Hard with no / incompatible / undersized pressure system', () => {
    expectFailure(failOf(goodRocket({ pressure: null })), 'pressure', 'launch');
    expectFailure(failOf(goodRocket({ pressure: pressure({ compatible: ['kerolox'] }) })), 'pressure', 'launch');
    expectFailure(failOf(goodRocket({ pressure: pressure({ capacity: 10 }) })), 'pressure', 'launch');
  });

  it('pressure auto-passes on Easy and Medium', () => {
    for (const d of ['easy', 'medium'] as const) {
      const r = failOf(goodRocket({ pressure: null }), d);
      expect(r.checks.find((c) => c.id === 'pressure')?.status).toBe('auto');
      expect(r.success).toBe(true);
    }
  });

  it('solid motors need no pressure system', () => {
    const solid = goodRocket({
      engine: engine({ propellant: 'solid' }),
      tanks: [tank({ propellant: 'solid' })],
      pressure: null,
    });
    expect(failOf(solid).checks.find((c) => c.id === 'pressure')?.status).toBe('pass');
  });

  it('fails in transit when Δv cannot reach orbit', () => {
    const weak = goodRocket({ engine: engine({ isp: 100 }), tanks: [tank({ propellantCapacity: 10_000 })] });
    const r = failOf(weak);
    expectFailure(r, 'dvOrbit', 'transit');
    expect(r.phases).toEqual({ launch: 'pass', transit: 'fail', planet: 'not-reached', return: 'not-reached' });
  });

  it('fails in transit when the drive range is too short (needs 2 × distance)', () => {
    expectFailure(failOf(goodRocket({ drive: drive({ rangeLy: 19.9 }) })), 'driveRange', 'transit');
    expect(failOf(goodRocket({ drive: drive({ rangeLy: 20 }) })).success).toBe(true);
  });

  it('fails in transit when comms are out of range (Medium+), auto-passes on Easy', () => {
    const r = goodRocket({ comms: comms({ rangeLy: 5 }) });
    expectFailure(failOf(r, 'medium'), 'comms', 'transit');
    expect(failOf(r, 'easy').success).toBe(true);
  });

  it('fails in transit on Hard when a crew lacks radiation shielding; uncrewed is fine', () => {
    const r = goodRocket({ protection: protection({ radiationRating: 2 }) });
    expectFailure(failOf(r, 'hard', 1), 'radiation', 'transit');
    expect(failOf(r, 'hard', 0).success).toBe(true);
    expect(failOf(r, 'medium', 1).success).toBe(true);
  });

  it('fails at the planet when protection is below the equilibrium temperature', () => {
    const r = goodRocket({ protection: protection({ maxTempK: 1600 }) });
    expectFailure(failOf(r, 'medium', 0, planet({ eqTempK: 2000 })), 'heatPlanet', 'planet');
    expect(failOf(r, 'easy', 0, planet({ eqTempK: 2000 })).success).toBe(true);
  });

  it('fails at the planet when Δv covers orbit but not landing + ascent', () => {
    // Need > 9.4 but < 9.4 + 18.96 = 28.36 km/s. Isp 1000 s, ratio ≈ e^1.6 → ≈ 15.7 km/s.
    const r = goodRocket({ engine: engine({ isp: 1000 }), tanks: [tank({ propellantCapacity: 15_000 })] });
    expectFailure(failOf(r), 'dvPlanet', 'planet');
  });

  it('fails on the return leg when Δv covers the planet but not the 10% margin', () => {
    // Need between 28.36 and 31.75 km/s.
    const p = planet();
    let found: Rocket | null = null;
    for (let prop = 10_000; prop < 200_000 && !found; prop += 250) {
      const r = goodRocket({ engine: engine({ isp: 1500 }), tanks: [tank({ propellantCapacity: prop })] });
      const res = evaluateMission(r, p, 'hard', 0);
      if (res.deltaV.available > 28.5 && res.deltaV.available < 31.5) found = r;
    }
    expect(found).not.toBeNull();
    expectFailure(failOf(found as Rocket), 'dvReturn', 'return');
  });

  it('fails on the return leg when the heat shield cannot survive re-entry', () => {
    const r = goodRocket({ protection: protection({ maxTempK: 400 }) });
    expectFailure(failOf(r, 'medium'), 'heatReentry', 'return');
  });

  it('reports the first failure in phase order', () => {
    const r = goodRocket({ drive: drive({ rangeLy: 1 }), protection: protection({ maxTempK: 100 }) });
    expect(failOf(r, 'medium').failure?.id).toBe('driveRange');
  });

  it('budget never fails the mission but is reported', () => {
    const pricey = goodRocket({ payload: { ...goodRocket().payload!, cost: 99_999 } });
    const r = failOf(pricey, 'easy');
    expect(r.success).toBe(true);
    expect(r.checks.find((c) => c.id === 'budget')?.status).toBe('fail');
    expect(r.score.budget).toBe(0);
  });

  it('every failed check carries a plain-English advice sentence with numbers', () => {
    const r = failOf(goodRocket({ engine: engine({ isp: 1000 }), tanks: [tank({ propellantCapacity: 15_000 })] }));
    expect(r.failure?.advice).toMatch(/km\/s/);
    expect(r.failure?.advice).toMatch(/Add a fuel tank or use a higher-Isp engine/);
  });
});
