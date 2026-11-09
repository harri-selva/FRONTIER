import type { Difficulty } from './types';

/** Standard gravity, m/s². Real. */
export const G0 = 9.81;
/** Parsec to light-year. Real. */
export const PC_TO_LY = 3.2616;
/** Earth surface orbital velocity factor for v = 7.9 × √(M/R) km/s. Real (Earth circular velocity at surface). */
export const EARTH_ORBITAL_VELOCITY_KMS = 7.9;

/** Earth launch to low orbit including gravity and drag losses, km/s. Real approximate figure. */
export const DV_EARTH_TO_ORBIT_KMS = 9.4;
/** Landing + ascent on a rocky planet = factor × v_orb. 1.2 covers gravity losses. Gameplay assumption. */
export const LANDING_FACTOR = 2 * 1.2;
/**
 * Orbital survey = insertion + departure, 0.25 × v_orb each.
 * Gameplay assumption: the Deep-Space Drive delivers the craft into a loosely
 * bound high orbit; chemical burns only lower it to a survey orbit and raise it back.
 */
export const SURVEY_FACTOR = 2 * 0.25;
/** Course corrections on the return leg, km/s. Gameplay assumption. */
export const DV_RETURN_CORRECTIONS_KMS = 0.5;
/** Safety margin on the total Δv sum. Gameplay assumption. */
export const DV_MARGIN = 1.1;

/** Minimum thrust-to-weight ratio to clear the pad. Gameplay rule (real rockets lift off at ~1.2–1.5). */
export const MIN_TWR = 1.2;
/** Maximum launch mass, kg. Gameplay pad limit (Saturn V was ~2,900 t). */
export const MAX_LAUNCH_MASS_KG = 350_000;

/** Peak heating the protection must survive on Earth re-entry, K. Approximate (Space Shuttle tiles peaked ~1,530 K). */
export const EARTH_REENTRY_TEMP_K = 1500;
/** Mass per astronaut including seat share, consumables and life-support margin, kg. Gameplay assumption. */
export const CREW_MASS_KG = 1000;
/** Minimum protection radiation rating for a crewed mission (Hard). Gameplay assumption. */
export const CREW_RADIATION_MIN = 4;
/** Radius cut-off between "likely rocky" and "likely gas/ice-rich". Gameplay simplification (cf. Fulton gap ~1.5–2 R⊕). */
export const ROCKY_RADIUS_MAX_RE = 1.6;

export const ATTEMPTS_PER_RUN = 10;
export const MAX_CREW = 4;
export const MAX_TANKS = 3;

export interface DifficultyConfig {
  id: Difficulty;
  label: string;
  /** Budget in millions of US dollars. */
  budget: number;
  checks: {
    comms: boolean;
    heat: boolean;
    pressure: boolean;
    radiation: boolean;
  };
  /** Over-budget blocks launch. */
  budgetBlocksLaunch: boolean;
  summary: string;
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: {
    id: 'easy',
    label: 'Easy',
    budget: 1800,
    checks: { comms: false, heat: false, pressure: false, radiation: false },
    budgetBlocksLaunch: false,
    summary:
      'Nearby temperate rocky worlds. Checks: thrust-to-weight, Δv, drive range, budget. Comms, pressure and protection are simplified and auto-pass.',
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    budget: 1700,
    checks: { comms: true, heat: true, pressure: false, radiation: false },
    budgetBlocksLaunch: false,
    summary:
      'Farther and hotter worlds, some orbital surveys. Adds comms range and heat protection (planet and Earth re-entry).',
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    budget: 1600,
    checks: { comms: true, heat: true, pressure: true, radiation: true },
    budgetBlocksLaunch: true,
    summary:
      'The farthest, hottest worlds and gas giants. Every check is active, including pressure compatibility and crew radiation. Over budget = no launch.',
  },
};
