import { describe, expect, it } from 'vitest';
import { findPlanet } from '../data/planets';
import { SYSTEMS } from '../data/space';
import { G0, evaluateMission, surfaceGravityG, thrustToWeight, tsiolkovsky } from '../engine';
import { resolveBuild } from '../store/resolve';

/** Every Secret Project answer and real-data example, checked against the formulas. */
describe('Secret Project answer key', () => {
  it('File 1: parallax 0.5″ → 2 pc; Proxima ≈ 1.30 pc', () => {
    expect(1 / 0.5).toBe(2);
    expect(1 / 0.768).toBeCloseTo(findPlanet('Proxima Cen b')!.distancePc, 2);
  });
  it('File 2: Voyager at 17 km/s takes ≈ 17,600 years per light-year', () => {
    const years = 9.4607e12 / 17 / 31557600;
    expect(years).toBeGreaterThan(17500);
    expect(years).toBeLessThan(17700);
  });
  it('File 3: a 1% dip means a planet 10% of the star’s width; TRAPPIST-1 e dips ≈ 0.5%', () => {
    expect(Math.sqrt(0.01)).toBeCloseTo(0.1, 10);
    const star = SYSTEMS['TRAPPIST-1']!.starRadiusSun! * 109.1;
    const depth = (findPlanet('TRAPPIST-1 e')!.radiusRe / star) ** 2;
    expect(depth).toBeGreaterThan(0.004);
    expect(depth).toBeLessThan(0.006);
  });
  it('File 4: 8-year orbit around 1 Sun → 4 AU; Kepler reproduces TRAPPIST-1 e within 1%', () => {
    expect(Math.cbrt(1 * 8 ** 2)).toBeCloseTo(4, 10);
    const sys = SYSTEMS['TRAPPIST-1']!;
    const e = sys.planets.find((p) => p.name === 'TRAPPIST-1 e')!;
    const a = Math.cbrt(sys.starMassSun! * (e.periodDays! / 365.25) ** 2);
    expect(Math.abs(a / e.aAu! - 1)).toBeLessThan(0.01);
  });
  it('File 6: 8 Earth masses at 2 Earth radii → 2 g', () => {
    expect(surfaceGravityG(8, 2)).toBe(2);
  });
  it('File 7: Isp 300, 100 t → 50 t gives ≈ 2.0 km/s', () => {
    expect(tsiolkovsky(300, 100000, 50000) / 1000).toBeCloseTo(2.04, 2);
  });
  it('File 8: 3,000 kN on 200 t → TWR 1.53', () => {
    expect(thrustToWeight(3000, 200000)).toBeCloseTo(1.53, 2);
    expect(G0).toBe(9.81);
  });
  it('File 9: Operation Lantern has at least one winning and one losing design', () => {
    const planet = findPlanet('TRAPPIST-1 e')!;
    const outcomes = ['engine-hydrolox:tank-hydrolox', 'engine-gascore:tank-lh2', 'engine-fusion:tank-lh2'].flatMap((pair) => {
      const [engine, tank] = pair.split(':') as [string, string];
      return [1, 2, 3].map((n) =>
        evaluateMission(resolveBuild({ payload: 'payload-probe', engine, drive: 'drive-warp', tanks: Array<string>(n).fill(tank), comms: 'comms-quantum', pressure: null, protection: null }), planet, 'easy', 0).success,
      );
    });
    expect(outcomes.some(Boolean)).toBe(true);
    expect(outcomes.some((x) => !x)).toBe(true);
  });
});
