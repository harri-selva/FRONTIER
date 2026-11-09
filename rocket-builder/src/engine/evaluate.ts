import {
  CREW_RADIATION_MIN,
  DIFFICULTY_CONFIG,
  EARTH_REENTRY_TEMP_K,
  MAX_LAUNCH_MASS_KG,
  MIN_TWR,
} from './constants';
import {
  coreMassKg,
  dryMassKg,
  propellantKg,
  requiredDeltaV,
  requiredDriveRangeLy,
  stagedDeltaV,
  thrustToWeight,
  wetMassKg,
} from './physics';
import { scoreMission } from './scoring';
import type { CheckResult, Difficulty, MissionResult, Phase, Planet, Rocket } from './types';
import { PHASES } from './types';
import { buildCost } from './validate';

const fmt = (n: number, dp = 1): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const tonnes = (kg: number): string => `${fmt(kg / 1000, 1)} t`;

type Partial = Omit<CheckResult, 'status'> & { ok: boolean; active: boolean };

function finalize(c: Partial): CheckResult {
  const { ok, active, ...rest } = c;
  if (!active) return { ...rest, status: 'auto' };
  return { ...rest, status: ok ? 'pass' : 'fail' };
}

/**
 * Evaluate a mission. Pure function: same inputs → same result.
 * The first failing check, in phase order, decides the outcome.
 */
export function evaluateMission(rocket: Rocket, planet: Planet, difficulty: Difficulty, crew: number): MissionResult {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const wet = wetMassKg(rocket, crew);
  const dry = dryMassKg(rocket, crew);
  const prop = propellantKg(rocket);
  const thrust = rocket.engine?.thrust ?? 0;
  const twr = thrustToWeight(thrust, wet);
  const dvAvail = stagedDeltaV(rocket, crew).totalMs / 1000;
  const req = requiredDeltaV(planet);
  const driveNeed = requiredDriveRangeLy(planet);
  const driveHave = rocket.drive?.rangeLy ?? 0;
  const commsHave = rocket.comms?.rangeLy ?? 0;
  const protectTemp = rocket.protection?.maxTempK ?? 0;
  const radRating = rocket.protection?.radiationRating ?? 0;
  const cost = buildCost(rocket);
  const enginePropellant = rocket.engine?.propellant ?? null;

  // ---- Pressure system (Hard) ----
  let pressureOk = true;
  let pressureActual = 'none fitted';
  let pressureRequired = 'no pressure system needed for a solid motor';
  let pressureAdvice = 'Pressure system is fine.';
  if (enginePropellant && enginePropellant !== 'solid') {
    pressureRequired = `compatible with ${enginePropellant}, capacity ≥ ${tonnes(prop)}`;
    const p = rocket.pressure;
    if (!p) {
      pressureOk = false;
      pressureAdvice = 'Liquid-propellant tanks need a pressure system to feed the engine. Fit one.';
    } else {
      pressureActual = `${p.name}: ${tonnes(p.capacity)}, ${p.compatible.join('/')}`;
      if (!p.compatible.includes(enginePropellant)) {
        pressureOk = false;
        pressureAdvice = `${p.name} cannot pressurise ${enginePropellant}. Choose a compatible pressure system.`;
      } else if (p.capacity < prop) {
        pressureOk = false;
        pressureAdvice = `${p.name} handles ${tonnes(p.capacity)} but your tanks hold ${tonnes(prop)}. Use a bigger pressure system or fewer tanks.`;
      }
    }
  } else if (rocket.pressure) {
    pressureActual = rocket.pressure.name;
  }

  const raw: Partial[] = [
    {
      id: 'twr',
      phase: 'launch',
      label: 'Thrust-to-weight at lift-off',
      active: true,
      ok: twr >= MIN_TWR - 1e-9,
      actual: fmt(twr, 2),
      required: `≥ ${fmt(MIN_TWR, 2)}`,
      advice:
        twr >= MIN_TWR - 1e-9
          ? `TWR ${fmt(twr, 2)} clears the pad.`
          : `TWR ${fmt(twr, 2)}: the rocket will not leave the pad. Use a more powerful engine or remove mass (fewer tanks, lighter parts).`,
      overlay: 'Engine thrust too low. Vehicle lost on the pad.',
    },
    {
      id: 'maxMass',
      phase: 'launch',
      label: 'Launch mass',
      active: true,
      ok: wet <= MAX_LAUNCH_MASS_KG,
      actual: tonnes(wet),
      required: `≤ ${tonnes(MAX_LAUNCH_MASS_KG)} (pad limit, gameplay assumption)`,
      advice:
        wet <= MAX_LAUNCH_MASS_KG
          ? 'Launch mass is within the pad limit.'
          : `Your rocket weighs ${tonnes(wet)}; the pad limit is ${tonnes(MAX_LAUNCH_MASS_KG)}. Remove a tank or pick lighter parts.`,
      overlay: 'Structural overload. Launch mount collapsed.',
    },
    {
      id: 'pressure',
      phase: 'launch',
      label: 'Tank pressurisation',
      active: cfg.checks.pressure,
      ok: pressureOk,
      actual: pressureActual,
      required: pressureRequired,
      advice: cfg.checks.pressure ? pressureAdvice : 'Simplified on this difficulty: pressure auto-passes.',
      overlay: 'Tank pressure failure. Propellant feed lost.',
    },
    {
      id: 'dvOrbit',
      phase: 'transit',
      label: 'Δv to reach Earth orbit',
      active: true,
      ok: dvAvail >= req.earthLaunch,
      actual: `${fmt(dvAvail)} km/s`,
      required: `≥ ${fmt(req.earthLaunch)} km/s`,
      advice:
        dvAvail >= req.earthLaunch
          ? 'Enough Δv to reach Earth orbit.'
          : `Your Δv was ${fmt(dvAvail)} km/s; reaching orbit alone needs ${fmt(req.earthLaunch)} km/s. Add a fuel tank or use a higher-Isp engine.`,
      overlay: 'Out of fuel before orbit.',
    },
    {
      id: 'driveRange',
      phase: 'transit',
      label: 'Deep-Space Drive range (out and back)',
      active: true,
      ok: driveHave >= driveNeed,
      actual: `${fmt(driveHave)} ly`,
      required: `≥ ${fmt(driveNeed)} ly`,
      advice:
        driveHave >= driveNeed
          ? 'The drive can make the round trip.'
          : `The drive reaches ${fmt(driveHave)} ly but the round trip is ${fmt(driveNeed)} ly. Fit a longer-range Deep-Space Drive.`,
      overlay: 'Drive exhausted mid-transit. Out of range.',
    },
    {
      id: 'comms',
      phase: 'transit',
      label: 'Communication range',
      active: cfg.checks.comms,
      ok: commsHave >= planet.distanceLy,
      actual: `${fmt(commsHave, commsHave < 1 ? 4 : 1)} ly`,
      required: `≥ ${fmt(planet.distanceLy)} ly`,
      advice: !cfg.checks.comms
        ? 'Simplified on this difficulty: comms auto-pass.'
        : commsHave >= planet.distanceLy
          ? 'Mission control can hear the craft at the destination.'
          : `Comms reach ${fmt(commsHave, commsHave < 1 ? 4 : 1)} ly but the planet is ${fmt(planet.distanceLy)} ly away. Fit a longer-range comms system.`,
      overlay: 'Out of comms range: no contact with mission control.',
    },
    {
      id: 'radiation',
      phase: 'transit',
      label: 'Crew radiation shielding',
      active: cfg.checks.radiation && crew > 0,
      ok: radRating >= CREW_RADIATION_MIN,
      actual: `rating ${radRating}`,
      required: crew > 0 ? `≥ ${CREW_RADIATION_MIN} with crew aboard` : 'no limit when uncrewed',
      advice: !(cfg.checks.radiation && crew > 0)
        ? crew > 0
          ? 'Simplified on this difficulty: crew radiation auto-passes.'
          : 'Uncrewed mission: no radiation limit applies.'
        : radRating >= CREW_RADIATION_MIN
          ? 'Crew shielding is adequate.'
          : `Shielding rating ${radRating} is below the crewed minimum of ${CREW_RADIATION_MIN}. Fit heavier radiation protection or fly uncrewed.`,
      overlay: 'Crew radiation dose exceeded. Mission aborted.',
    },
    {
      id: 'heatPlanet',
      phase: 'planet',
      label: 'Heat protection at the planet',
      active: cfg.checks.heat,
      ok: protectTemp >= planet.eqTempK,
      actual: `${fmt(protectTemp, 0)} K`,
      required: `≥ ${fmt(planet.eqTempK, 0)} K (equilibrium temperature)`,
      advice: !cfg.checks.heat
        ? 'Simplified on this difficulty: heat protection auto-passes.'
        : protectTemp >= planet.eqTempK
          ? 'Protection survives the planet’s temperature.'
          : `Protection is rated to ${fmt(protectTemp, 0)} K but the planet is about ${fmt(planet.eqTempK, 0)} K. Fit a higher-temperature protection system.`,
      overlay: 'Thermal protection failed.',
    },
    {
      id: 'dvPlanet',
      phase: 'planet',
      label: planet.missionType === 'landing' ? 'Δv to land and take off again' : 'Δv for orbit insertion and departure',
      active: true,
      ok: dvAvail >= req.earthLaunch + req.planet,
      actual: `${fmt(dvAvail)} km/s`,
      required: `≥ ${fmt(req.earthLaunch + req.planet)} km/s (orbit ${fmt(req.earthLaunch)} + planet ${fmt(req.planet)})`,
      advice:
        dvAvail >= req.earthLaunch + req.planet
          ? 'Enough Δv for the planet phase.'
          : `Your Δv was ${fmt(dvAvail)} km/s; reaching orbit and completing the ${planet.missionType === 'landing' ? 'landing and ascent' : 'orbital survey'} needs ${fmt(req.earthLaunch + req.planet)} km/s. Add a fuel tank or use a higher-Isp engine.`,
      overlay: planet.missionType === 'landing' ? 'Out of fuel. Cannot lift off again.' : 'Out of fuel. Cannot leave orbit.',
    },
    {
      id: 'dvReturn',
      phase: 'return',
      label: 'Δv for the whole mission (+10% margin)',
      active: true,
      ok: dvAvail >= req.totalRequired,
      actual: `${fmt(dvAvail)} km/s`,
      required: `≥ ${fmt(req.totalRequired)} km/s`,
      advice:
        dvAvail >= req.totalRequired
          ? `Δv ${fmt(dvAvail)} km/s covers the ${fmt(req.totalRequired)} km/s mission.`
          : `Your Δv was ${fmt(dvAvail)} km/s; this mission needs ${fmt(req.totalRequired)} km/s including the 10% margin. Add a fuel tank or use a higher-Isp engine.`,
      overlay: 'Out of fuel on the way home.',
    },
    {
      id: 'heatReentry',
      phase: 'return',
      label: 'Heat protection for Earth re-entry',
      active: cfg.checks.heat,
      ok: protectTemp >= EARTH_REENTRY_TEMP_K,
      actual: `${fmt(protectTemp, 0)} K`,
      required: `≥ ${fmt(EARTH_REENTRY_TEMP_K, 0)} K`,
      advice: !cfg.checks.heat
        ? 'Simplified on this difficulty: re-entry auto-passes.'
        : protectTemp >= EARTH_REENTRY_TEMP_K
          ? 'Protection survives Earth re-entry.'
          : `Protection is rated to ${fmt(protectTemp, 0)} K; Earth re-entry needs ${fmt(EARTH_REENTRY_TEMP_K, 0)} K. Fit a heat shield.`,
      overlay: 'Heat shield failure on re-entry.',
    },
  ];

  const checks = raw.map(finalize);

  const budgetCheck: CheckResult = {
    id: 'budget',
    phase: 'launch',
    label: 'Budget',
    status: cost <= cfg.budget ? 'pass' : 'fail',
    actual: `$${fmt(cost, 0)}M`,
    required: `≤ $${fmt(cfg.budget, 0)}M`,
    advice:
      cost <= cfg.budget
        ? `Spent $${fmt(cost, 0)}M of $${fmt(cfg.budget, 0)}M.`
        : `Over budget by $${fmt(cost - cfg.budget, 0)}M: budget score is 0. Choose cheaper parts.`,
    overlay: 'Over budget.',
  };

  const failure = checks.find((c) => c.status === 'fail') ?? null;
  const failedPhase: Phase | null = failure ? failure.phase : null;
  const phases = Object.fromEntries(
    PHASES.map((p) => {
      if (!failedPhase) return [p, 'pass'];
      const fi = PHASES.indexOf(failedPhase);
      const pi = PHASES.indexOf(p);
      return [p, pi < fi ? 'pass' : pi === fi ? 'fail' : 'not-reached'];
    }),
  ) as MissionResult['phases'];

  const result: Omit<MissionResult, 'score'> = {
    success: failure === null,
    failedPhase,
    failure,
    phases,
    checks: [...checks, budgetCheck],
    deltaV: { ...req, available: dvAvail },
    twr,
    wetMassKg: wet,
    dryMassKg: dry,
    propellantKg: prop,
    cost,
  };

  return {
    ...result,
    score: scoreMission({ result, rocket, planet, difficulty, crew, coreMassKg: coreMassKg(rocket, crew) }),
  };
}
