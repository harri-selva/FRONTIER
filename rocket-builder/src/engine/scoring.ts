import { ATTEMPTS_PER_RUN, DIFFICULTY_CONFIG, MIN_TWR } from './constants';
import { requiredDriveRangeLy } from './physics';
import type { Difficulty, MissionResult, Phase, Planet, Rocket, ScoreBreakdown } from './types';

export const MISSION_POINTS: Record<Phase | 'success', number> = {
  launch: 50,
  transit: 150,
  planet: 250,
  return: 350,
  success: 400,
};

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const lerp = (x: number, x0: number, x1: number, y0: number, y1: number): number =>
  y0 + ((clamp(x, Math.min(x0, x1), Math.max(x0, x1)) - x0) / (x1 - x0)) * (y1 - y0);

/** 0..100. Peak when Δv is 100–125% of required; penalises under- and heavy over-building. */
export function deltaVMarginScore(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio < 0.5) return 0;
  if (ratio < 1) return lerp(ratio, 0.5, 1, 0, 60);
  if (ratio <= 1.25) return 100;
  if (ratio < 2.5) return lerp(ratio, 1.25, 2.5, 100, 0);
  return 0;
}

/** 0..100. Peak at TWR 1.3–2.0; below 1.2 is 0; over-powered decays to 0 at TWR 5. */
export function twrScore(twr: number): number {
  if (!Number.isFinite(twr) || twr < MIN_TWR - 1e-9) return 0;
  if (twr < 1.3) return lerp(twr, MIN_TWR, 1.3, 70, 100);
  if (twr <= 2) return 100;
  if (twr < 5) return lerp(twr, 2, 5, 100, 0);
  return 0;
}

/** 0..200. Over budget = 0. Spending the whole budget = 80; spending nothing = 200. */
export function budgetScore(cost: number, budget: number): number {
  if (cost > budget) return 0;
  return 200 * (0.4 + 0.6 * (1 - cost / budget));
}

/** 0..100 from propellant mass fraction. Sensible band 0.70–0.92. */
export function resourceScore(propellantFraction: number): number {
  const f = propellantFraction;
  if (!Number.isFinite(f) || f <= 0.3) return 0;
  if (f < 0.7) return lerp(f, 0.3, 0.7, 0, 100);
  if (f <= 0.92) return 100;
  if (f < 0.98) return lerp(f, 0.92, 0.98, 100, 0);
  return 0;
}

export interface SuitabilityResult {
  score: number;
  notes: string[];
}

/** 0..100. Deducts for unnecessary or mismatched parts. */
export function suitabilityScore(rocket: Rocket, planet: Planet, crew: number): SuitabilityResult {
  let score = 100;
  const notes: string[] = [];
  const deduct = (n: number, why: string): void => {
    score -= n;
    notes.push(`−${n} suitability: ${why}`);
  };
  const prop = rocket.engine?.propellant;
  const propMass = rocket.tanks.reduce((s, t) => s + t.propellantCapacity, 0);
  if (rocket.pressure) {
    if (prop === 'solid') deduct(20, 'pressure system is unnecessary with a solid motor');
    else if (prop && !rocket.pressure.compatible.includes(prop)) deduct(25, 'pressure system is incompatible with the propellant');
    else if (rocket.pressure.capacity < propMass) deduct(15, 'pressure system is under capacity');
  }
  const driveNeed = requiredDriveRangeLy(planet);
  if (rocket.drive && rocket.drive.rangeLy > driveNeed * 4) deduct(15, 'Deep-Space Drive range is far beyond what this trip needs');
  if (rocket.comms && rocket.comms.rangeLy > Math.max(planet.distanceLy * 20, 1)) deduct(10, 'comms range is far beyond what this trip needs');
  if (rocket.protection && rocket.protection.maxTempK < planet.eqTempK) deduct(15, 'protection is not rated for the planet’s temperature');
  if (rocket.payload && rocket.payload.crewSeats > 0 && crew === 0) deduct(15, 'a crewed module is flying empty');
  return { score: clamp(score, 0, 100), notes };
}

export interface ScoreInput {
  result: Omit<MissionResult, 'score'>;
  rocket: Rocket;
  planet: Planet;
  difficulty: Difficulty;
  crew: number;
  coreMassKg: number;
}

/** Astronaut multiplier: success ×(1 + 0.1·crew); failure ×(1 − 0.15·crew), floored at 0. */
export const crewMultiplier = (success: boolean, crew: number): number =>
  success ? 1 + 0.1 * crew : Math.max(0, 1 - 0.15 * crew);

export function scoreMission(input: ScoreInput): ScoreBreakdown {
  const { result, rocket, planet, difficulty, crew } = input;
  const notes: string[] = [];
  const mission = result.success ? MISSION_POINTS.success : MISSION_POINTS[result.failedPhase ?? 'launch'];
  // On failure, the build-quality categories are scaled by how far the mission got,
  // so a pad explosion cannot earn most of the points. Gameplay rule.
  const progress = mission / MISSION_POINTS.success;
  if (!result.success) notes.push(`Budget, suitability and resource scores scaled by mission progress (×${progress.toFixed(3)}).`);

  const dvRatio = result.deltaV.totalRequired > 0 ? result.deltaV.available / result.deltaV.totalRequired : 0;
  const performance = deltaVMarginScore(dvRatio) + twrScore(result.twr);

  const budget = budgetScore(result.cost, DIFFICULTY_CONFIG[difficulty].budget) * progress;
  if (result.cost > DIFFICULTY_CONFIG[difficulty].budget) notes.push('Over budget: budget efficiency is 0.');

  const suit = suitabilityScore(rocket, planet, crew);
  notes.push(...suit.notes);
  const suitability = suit.score * progress;

  const pf = result.wetMassKg > 0 ? result.propellantKg / result.wetMassKg : 0;
  const resources = resourceScore(pf) * progress;

  const r = (n: number): number => Math.round(n);
  const parts = { mission, performance: r(performance), budget: r(budget), suitability: r(suitability), resources: r(resources) };
  const base = clamp(parts.mission + parts.performance + parts.budget + parts.suitability + parts.resources, 0, 1000);
  const multiplier = crewMultiplier(result.success, crew);
  const total = Math.max(0, Math.round(base * multiplier));
  return { ...parts, base, multiplier, total, notes };
}

/** Average of a run. Always divides by the number of attempts recorded (max 10). */
export function runAverage(scores: number[]): number {
  const used = scores.slice(0, ATTEMPTS_PER_RUN);
  if (used.length === 0) return 0;
  return Math.round((used.reduce((a, b) => a + b, 0) / used.length) * 10) / 10;
}

export const isRunComplete = (scores: number[]): boolean => scores.length >= ATTEMPTS_PER_RUN;
