import { describe, expect, it } from 'vitest';
import { DIFFICULTY_SETS } from './difficulty-sets';
import { PLANETS_BY_DIFFICULTY } from './planets';
import { SYSTEMS, galacticXYZ, galactocentricKpc, julianDate, orbitPhase, type SystemPlanet } from './space';

describe('space map maths', () => {
  it('converts galactic coordinates to xyz', () => {
    const toGC = galacticXYZ(0, 0, 10);
    expect(toGC.x).toBeCloseTo(10);
    expect(toGC.y).toBeCloseTo(0);
    const up = galacticXYZ(123, 90, 5);
    expect(up.z).toBeCloseTo(5);
    expect(Math.hypot(up.x, up.y)).toBeCloseTo(0, 6);
    const p = galacticXYZ(313.92595, -1.91805, 1.30119);
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1.30119, 6);
  });
  it('puts the Sun 8.178 kpc from the Galactic Centre', () => {
    const sun = galactocentricKpc(0, 0, 0);
    expect(sun.x).toBeCloseTo(-8.178);
  });
  it('computes Julian dates', () => {
    expect(julianDate(Date.UTC(2000, 0, 1, 12))).toBeCloseTo(2451545.0, 6);
  });
  it('orbit phase is 0 at conjunction and 0.5 half a period later', () => {
    const p: SystemPlanet = { name: 'x', aAu: 0.1, periodDays: 10, periodErrDays: 0.0001, conjunctionBjd: 2460000, conjunctionErrDays: 0.001, transits: true, eccentricity: 0, radiusRe: 1 };
    expect(orbitPhase(p, 2460000).phase).toBeCloseTo(0);
    expect(orbitPhase(p, 2460005).phase).toBeCloseTo(0.5);
    expect(orbitPhase(p, 2459995).phase).toBeCloseTo(0.5);
    expect(orbitPhase(p, 2460005).known).toBe(true);
  });
  it('flags positions as unknown when uncertainty grows past 45°', () => {
    const p: SystemPlanet = { name: 'x', aAu: 0.1, periodDays: 10, periodErrDays: 0.01, conjunctionBjd: 2450000, conjunctionErrDays: 0.01, transits: false, eccentricity: 0, radiusRe: 1 };
    // 1000 orbits later: sigma ≈ 10 days = 360°
    expect(orbitPhase(p, 2460000).known).toBe(false);
    expect(orbitPhase({ ...p, conjunctionBjd: null }, 2460000).known).toBe(false);
  });
  it('has a system with galactic coordinates for every curated planet', () => {
    for (const d of Object.keys(DIFFICULTY_SETS) as (keyof typeof DIFFICULTY_SETS)[]) {
      for (const pl of PLANETS_BY_DIFFICULTY[d]) {
        const s = SYSTEMS[pl.host];
        expect(s, pl.host).toBeTruthy();
        expect(Number.isFinite(s!.glon) && Number.isFinite(s!.glat)).toBe(true);
        expect(s!.distancePc).toBeCloseTo(pl.distancePc, 3);
        expect(s!.planets.some((x) => x.name === pl.name)).toBe(true);
      }
    }
  });
});
