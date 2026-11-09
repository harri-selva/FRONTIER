import { describe, expect, it } from 'vitest';
import {
  budgetScore,
  crewMultiplier,
  deltaVMarginScore,
  evaluateMission,
  isRunComplete,
  MISSION_POINTS,
  resourceScore,
  runAverage,
  suitabilityScore,
  twrScore,
} from '../index';
import { ALL_COMPONENTS } from '../../data/components';
import type { Rocket, RocketComponent } from '../types';
import { engine, goodRocket, payload, planet, pressure, tank } from './fixtures';

describe('score components', () => {
  it('Δv margin peaks at 100–125% and penalises both sides', () => {
    expect(deltaVMarginScore(1.1)).toBe(100);
    expect(deltaVMarginScore(0.4)).toBe(0);
    expect(deltaVMarginScore(0.75)).toBeGreaterThan(0);
    expect(deltaVMarginScore(0.75)).toBeLessThan(60);
    expect(deltaVMarginScore(2)).toBeLessThan(100);
    expect(deltaVMarginScore(3)).toBe(0);
  });
  it('TWR score is 0 below 1.2 and peaks 1.3–2.0', () => {
    expect(twrScore(1.19)).toBe(0);
    expect(twrScore(1.2)).toBe(70);
    expect(twrScore(1.5)).toBe(100);
    expect(twrScore(6)).toBe(0);
  });
  it('budget score: over budget = 0, full spend = 80, spend nothing = 200', () => {
    expect(budgetScore(1001, 1000)).toBe(0);
    expect(budgetScore(1000, 1000)).toBeCloseTo(80);
    expect(budgetScore(0, 1000)).toBeCloseTo(200);
  });
  it('resource score rewards a sensible propellant fraction', () => {
    expect(resourceScore(0.8)).toBe(100);
    expect(resourceScore(0.2)).toBe(0);
    expect(resourceScore(0.99)).toBe(0);
  });
  it('suitability deducts for unnecessary and mismatched parts', () => {
    expect(suitabilityScore(goodRocket(), planet(), 1).score).toBe(100);
    const solidWithPressure = goodRocket({ engine: engine({ propellant: 'solid' }), tanks: [tank({ propellant: 'solid' })] });
    expect(suitabilityScore(solidWithPressure, planet(), 1).score).toBe(80);
    expect(suitabilityScore(goodRocket({ pressure: pressure({ compatible: ['kerolox'] }) }), planet(), 1).score).toBe(75);
    expect(suitabilityScore(goodRocket(), planet(), 0).score).toBe(85); // crewed module flown empty
    expect(suitabilityScore(goodRocket({ payload: payload({ crewSeats: 0 }) }), planet(), 0).score).toBe(100);
  });
});

describe('crew multiplier', () => {
  it('rewards success and punishes failure', () => {
    expect(crewMultiplier(true, 0)).toBe(1);
    expect(crewMultiplier(true, 4)).toBeCloseTo(1.4);
    expect(crewMultiplier(false, 2)).toBeCloseTo(0.7);
    expect(crewMultiplier(false, 4)).toBeCloseTo(0.4);
    expect(crewMultiplier(false, 10)).toBe(0);
  });
});

describe('score bounds', () => {
  it('base is always 0..1000 and total ≥ 0 across many random builds', () => {
    const byCat = (c: RocketComponent['category']) => ALL_COMPONENTS.filter((x) => x.category === c);
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)] as T;
    for (let i = 0; i < 500; i++) {
      const eng = pick(byCat('engine')) as Rocket['engine'];
      const tanks = byCat('tank').filter((t) => 'propellant' in t && t.propellant === eng?.propellant) as Rocket['tanks'];
      const r: Rocket = {
        payload: pick(byCat('payload')) as Rocket['payload'],
        engine: eng,
        drive: pick(byCat('drive')) as Rocket['drive'],
        tanks: Array.from({ length: 1 + Math.floor(rand() * 3) }, () => pick(tanks)),
        comms: pick(byCat('comms')) as Rocket['comms'],
        pressure: rand() < 0.3 ? null : (pick(byCat('pressure')) as Rocket['pressure']),
        protection: rand() < 0.3 ? null : (pick(byCat('protection')) as Rocket['protection']),
      };
      const crew = Math.floor(rand() * 5);
      const p = planet({ distanceLy: 1 + rand() * 1000, eqTempK: 150 + rand() * 3500, orbitalVelocityKms: 3 + rand() * 40 });
      for (const d of ['easy', 'medium', 'hard'] as const) {
        const s = evaluateMission(r, p, d, crew).score;
        expect(s.base).toBeGreaterThanOrEqual(0);
        expect(s.base).toBeLessThanOrEqual(1000);
        expect(s.total).toBeGreaterThanOrEqual(0);
        expect(s.total).toBeLessThanOrEqual(1400);
      }
    }
  });
  it('mission points follow the phase reached', () => {
    expect(MISSION_POINTS).toEqual({ launch: 50, transit: 150, planet: 250, return: 350, success: 400 });
    const s = evaluateMission(goodRocket({ engine: engine({ thrust: 1 }) }), planet(), 'hard', 0).score;
    expect(s.mission).toBe(50);
  });
  it('perfect-ish success scores high and applies the crew bonus', () => {
    const s = evaluateMission(goodRocket(), planet(), 'easy', 2).score;
    expect(s.mission).toBe(400);
    expect(s.multiplier).toBeCloseTo(1.2);
    expect(s.total).toBe(Math.round(s.base * 1.2));
  });
});

describe('10-attempt run average', () => {
  it('averages the attempts', () => {
    expect(runAverage([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000])).toBe(550);
    expect(runAverage([])).toBe(0);
    expect(runAverage([333, 334])).toBe(333.5);
  });
  it('only counts the first 10 attempts', () => {
    expect(runAverage([...Array(10).fill(100), 9999])).toBe(100);
  });
  it('knows when a run is complete', () => {
    expect(isRunComplete(Array(9).fill(0))).toBe(false);
    expect(isRunComplete(Array(10).fill(0))).toBe(true);
  });
});
