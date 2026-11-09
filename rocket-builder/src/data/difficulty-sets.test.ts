import { describe, expect, it } from 'vitest';
import { PLANETS_BY_DIFFICULTY } from './planets';
import { DIFFICULTY_SETS } from './difficulty-sets';
import { ALL_COMPONENTS } from './components';

describe('curated planets follow the difficulty rules', () => {
  it('every curated name exists in the snapshot', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      expect(PLANETS_BY_DIFFICULTY[d].length).toBe(DIFFICULTY_SETS[d].length);
      expect(PLANETS_BY_DIFFICULTY[d].length).toBeGreaterThanOrEqual(6);
      expect(PLANETS_BY_DIFFICULTY[d].length).toBeLessThanOrEqual(8);
    }
  });
  it('easy: nearest, rocky, 200–350 K, ≤ 1.5 g', () => {
    for (const p of PLANETS_BY_DIFFICULTY.easy) {
      expect(p.distancePc, p.name).toBeLessThanOrEqual(13);
      expect(p.missionType, p.name).toBe('landing');
      expect(p.eqTempK, p.name).toBeGreaterThanOrEqual(200);
      expect(p.eqTempK, p.name).toBeLessThanOrEqual(350);
      expect(p.gravityG, p.name).toBeLessThanOrEqual(1.5);
    }
  });
  it('medium: farther than easy, ≤ 2.5 g, includes surveys', () => {
    const maxEasy = Math.max(...PLANETS_BY_DIFFICULTY.easy.map((p) => p.distancePc));
    for (const p of PLANETS_BY_DIFFICULTY.medium) {
      expect(p.distancePc, p.name).toBeGreaterThan(maxEasy);
      expect(p.gravityG, p.name).toBeLessThanOrEqual(2.5);
    }
    expect(PLANETS_BY_DIFFICULTY.medium.some((p) => p.missionType === 'survey')).toBe(true);
    expect(PLANETS_BY_DIFFICULTY.medium.some((p) => p.missionType === 'landing')).toBe(true);
  });
  it('hard: extreme temperatures (> 1000 K)', () => {
    for (const p of PLANETS_BY_DIFFICULTY.hard) expect(p.eqTempK, p.name).toBeGreaterThan(1000);
  });
});

describe('component catalog', () => {
  it('has unique ids and 3–4 options in each slot category (5 launch engines)', () => {
    const ids = new Set(ALL_COMPONENTS.map((c) => c.id));
    expect(ids.size).toBe(ALL_COMPONENTS.length);
    const count = (cat: string) => ALL_COMPONENTS.filter((c) => c.category === cat).length;
    for (const cat of ['payload', 'drive', 'tank', 'comms', 'pressure', 'protection']) {
      expect(count(cat), cat).toBeGreaterThanOrEqual(3);
      expect(count(cat), cat).toBeLessThanOrEqual(4);
    }
    expect(count('engine')).toBe(5);
  });
  it('every Deep-Space Drive is tagged fictional', () => {
    for (const c of ALL_COMPONENTS.filter((x) => x.category === 'drive')) expect(c.fictional).toBe(true);
  });
});
