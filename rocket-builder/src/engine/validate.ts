import { DIFFICULTY_CONFIG, MAX_CREW } from './constants';
import type { Difficulty, Rocket } from './types';

export interface BuildIssue {
  /** 'block' prevents launch; 'warn' is shown but allows launch. */
  severity: 'block' | 'warn';
  message: string;
}

export const buildCost = (rocket: Rocket): number => {
  const parts = [rocket.payload, rocket.engine, rocket.drive, rocket.comms, rocket.pressure, rocket.protection];
  return parts.reduce((s, p) => s + (p ? p.cost : 0), 0) + rocket.tanks.reduce((s, t) => s + t.cost, 0);
};

/**
 * Problems that make a build un-launchable (missing required parts, impossible
 * combinations). Physics failures such as low TWR are NOT blocked here: the
 * player may launch deliberately and see the result.
 */
export function validateBuild(rocket: Rocket, difficulty: Difficulty, crew: number): BuildIssue[] {
  const issues: BuildIssue[] = [];
  if (!rocket.payload) issues.push({ severity: 'block', message: 'Add a payload system.' });
  if (!rocket.engine) issues.push({ severity: 'block', message: 'Add a launch engine.' });
  if (!rocket.drive) issues.push({ severity: 'block', message: 'Add a Deep-Space Drive.' });
  if (rocket.tanks.length === 0) issues.push({ severity: 'block', message: 'Add at least one fuel tank.' });
  if (!rocket.comms) issues.push({ severity: 'block', message: 'Add a communication system.' });

  if (rocket.engine) {
    const wrong = rocket.tanks.filter((t) => t.propellant !== rocket.engine?.propellant);
    if (wrong.length > 0) {
      issues.push({
        severity: 'block',
        message: `${rocket.engine.name} burns ${rocket.engine.propellant}; ${wrong.length} tank(s) hold a different propellant.`,
      });
    }
  }

  if (crew < 0 || crew > MAX_CREW) issues.push({ severity: 'block', message: `Crew must be 0–${MAX_CREW}.` });
  const seats = rocket.payload?.crewSeats ?? 0;
  if (crew > seats) {
    issues.push({
      severity: 'block',
      message: `${crew} astronaut(s) but the payload has ${seats} seat(s). Choose a crewed payload or reduce crew.`,
    });
  }

  const cfg = DIFFICULTY_CONFIG[difficulty];
  const cost = buildCost(rocket);
  if (cost > cfg.budget) {
    issues.push({
      severity: cfg.budgetBlocksLaunch ? 'block' : 'warn',
      message: cfg.budgetBlocksLaunch
        ? `Over budget by $${cost - cfg.budget}M. Hard missions cannot launch over budget.`
        : `Over budget by $${cost - cfg.budget}M. Budget score will be 0.`,
    });
  }
  return issues;
}

export const canLaunch = (issues: BuildIssue[]): boolean => !issues.some((i) => i.severity === 'block');
