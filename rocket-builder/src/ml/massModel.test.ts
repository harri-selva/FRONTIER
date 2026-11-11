import { describe, expect, it } from 'vitest';
import { DIFFICULTY_SETS } from '../data/difficulty-sets';
import { MASS_MODEL, baselineMass, predictFromFeatures, predictMass } from './massModel';

describe('planet-mass model (browser inference)', () => {
  it('matches scikit-learn predictions exactly (parity samples)', () => {
    expect(MASS_MODEL.parity.length).toBeGreaterThan(5);
    for (const s of MASS_MODEL.parity) {
      const p = predictFromFeatures(s.features);
      // weights are exported rounded to 6 decimals
      expect(Math.abs(p.log10Mass - s.pred_log10_mass)).toBeLessThan(2e-4);
      expect(Math.abs(p.sigmaDex - s.sigma_dex)).toBeLessThan(2e-4);
    }
  });
  it('reproduces the held-out showcase predictions', () => {
    for (const s of MASS_MODEL.showcase) {
      expect(predictFromFeatures(s.features).massEarth / s.pred_mass_earth).toBeCloseTo(1, 3);
    }
  });
  it('never trained on the game planets', () => {
    const game = new Set(Object.values(DIFFICULTY_SETS).flat());
    for (const s of MASS_MODEL.showcase) expect(game.has(s.name)).toBe(true);
    expect(MASS_MODEL.counts.showcase_held_out).toBe(MASS_MODEL.showcase.length);
  });
  it('beats both baselines on the test set', () => {
    const m = MASS_MODEL.metrics;
    expect(m.test_model.rmse_dex).toBeLessThan(m.test_baseline_radius_power_law.rmse_dex);
    expect(m.test_model.rmse_dex).toBeLessThan(m.test_baseline_median.rmse_dex);
  });
  it('gives sensible answers inside its training range', () => {
    const rocky = predictMass({ radiusEarth: 1.1, periodDays: 5, eqTempK: 600, starMassSun: 0.5, starTeffK: 3800 });
    expect(rocky.outOfExperience).toBe(false);
    expect(rocky.massEarth).toBeGreaterThan(0.3);
    expect(rocky.massEarth).toBeLessThan(5);
    expect(rocky.low).toBeLessThan(rocky.massEarth);
    expect(rocky.high).toBeGreaterThan(rocky.massEarth);
    const hotJupiter = predictMass({ radiusEarth: 13, periodDays: 3.5, eqTempK: 1400, starMassSun: 1.1, starTeffK: 6000 });
    expect(hotJupiter.outOfExperience).toBe(false);
    expect(hotJupiter.massEarth).toBeGreaterThan(rocky.massEarth * 20);
    expect(baselineMass(11)).toBeGreaterThan(baselineMass(1));
  });
  it('flags questions outside its experience (Earth twin: known limitation)', () => {
    const earth = predictMass({ radiusEarth: 1, periodDays: 365.25, eqTempK: 255, starMassSun: 1, starTeffK: 5772 });
    expect(earth.outOfExperience).toBe(true);
    expect(earth.similarTrainingPlanets).toBe(MASS_MODEL.earth_twin_probe.similar_training_planets);
  });
});
