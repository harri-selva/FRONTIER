import {
  CREW_MASS_KG,
  DV_EARTH_TO_ORBIT_KMS,
  DV_MARGIN,
  DV_RETURN_CORRECTIONS_KMS,
  G0,
  LANDING_FACTOR,
  SURVEY_FACTOR,
} from './constants';
import type { Planet, Rocket } from './types';

/** Tsiolkovsky rocket equation. Returns Δv in m/s. */
export function tsiolkovsky(ispSeconds: number, wetMassKg: number, dryMassKg: number): number {
  if (ispSeconds <= 0 || wetMassKg <= 0 || dryMassKg <= 0 || wetMassKg < dryMassKg) return 0;
  return ispSeconds * G0 * Math.log(wetMassKg / dryMassKg);
}

/** Thrust-to-weight at Earth's surface. Thrust in kN, mass in kg. */
export function thrustToWeight(thrustKn: number, massKg: number): number {
  if (massKg <= 0) return 0;
  return (thrustKn * 1000) / (massKg * G0);
}

/** Mass of everything except tanks and propellant, kg. Includes crew. */
export function coreMassKg(rocket: Rocket, crew: number): number {
  const parts = [rocket.payload, rocket.engine, rocket.drive, rocket.comms, rocket.pressure, rocket.protection];
  return parts.reduce((sum, p) => sum + (p ? p.mass : 0), 0) + crew * CREW_MASS_KG;
}

export const tankDryMassKg = (rocket: Rocket): number => rocket.tanks.reduce((s, t) => s + t.mass, 0);
export const propellantKg = (rocket: Rocket): number => rocket.tanks.reduce((s, t) => s + t.propellantCapacity, 0);

/** Fully fuelled launch mass, kg. */
export const wetMassKg = (rocket: Rocket, crew: number): number =>
  coreMassKg(rocket, crew) + tankDryMassKg(rocket) + propellantKg(rocket);

/** Mass with every tank empty but still attached, kg. */
export const dryMassKg = (rocket: Rocket, crew: number): number => coreMassKg(rocket, crew) + tankDryMassKg(rocket);

export interface StageBurn {
  tankIndex: number;
  startMassKg: number;
  endMassKg: number;
  deltaVms: number;
}

/**
 * Δv available, in m/s.
 *
 * Gameplay simplification of staging: stacked tanks are drop tanks. Tanks
 * burn bottom-first (index 0); when a tank is empty its dry mass is jettisoned.
 * Each burn is one Tsiolkovsky step with the launch engine's Isp. With a single
 * tank this is exactly Δv = Isp × g0 × ln(m₀ / m_f) with m₀ = wet mass, m_f = dry mass.
 * A real rocket would need an engine per stage; here one engine is shared.
 */
export function stagedDeltaV(rocket: Rocket, crew: number): { totalMs: number; burns: StageBurn[] } {
  const engine = rocket.engine;
  if (!engine || rocket.tanks.length === 0) return { totalMs: 0, burns: [] };
  let mass = wetMassKg(rocket, crew);
  const burns: StageBurn[] = [];
  let total = 0;
  rocket.tanks.forEach((tank, i) => {
    const start = mass;
    const end = start - tank.propellantCapacity;
    const dv = tsiolkovsky(engine.isp, start, end);
    burns.push({ tankIndex: i, startMassKg: start, endMassKg: end, deltaVms: dv });
    total += dv;
    // Jettison the empty tank (except the last: the craft keeps it).
    mass = i < rocket.tanks.length - 1 ? end - tank.mass : end;
  });
  return { totalMs: total, burns };
}

/** Chemical Δv required for the planet phase, km/s. */
export function planetPhaseDeltaVKms(planet: Planet): number {
  const factor = planet.missionType === 'landing' ? LANDING_FACTOR : SURVEY_FACTOR;
  return factor * planet.orbitalVelocityKms;
}

export interface RequiredDeltaV {
  earthLaunch: number;
  planet: number;
  returnCorrections: number;
  totalRequired: number;
}

/** All in km/s. Total = (launch + planet + return) × 1.1 margin. */
export function requiredDeltaV(planet: Planet): RequiredDeltaV {
  const earthLaunch = DV_EARTH_TO_ORBIT_KMS;
  const planetDv = planetPhaseDeltaVKms(planet);
  const returnCorrections = DV_RETURN_CORRECTIONS_KMS;
  return {
    earthLaunch,
    planet: planetDv,
    returnCorrections,
    totalRequired: (earthLaunch + planetDv + returnCorrections) * DV_MARGIN,
  };
}

/** Required Deep-Space Drive range, light-years (out and back). */
export const requiredDriveRangeLy = (planet: Planet): number => 2 * planet.distanceLy;
