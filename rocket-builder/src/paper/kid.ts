/**
 * Kid-friendly words for the engine's results. The engine stays the source
 * of truth; this only chooses what to say and how simply to say it.
 */
import type { CheckId, CheckResult, Difficulty, MissionResult, Planet, PropellantType, RocketComponent } from '../engine';

export const LEVEL: Record<Difficulty, { name: string; tag: string; blurb: string }> = {
  easy: { name: 'Cadet', tag: 'Easy', blurb: 'Temperate rocky worlds within 41 light-years. Core checks only: lift-off, Δv, drive range.' },
  medium: { name: 'Pilot', tag: 'Medium', blurb: 'Farther and hotter targets, including orbital surveys. Adds comms range and thermal protection.' },
  hard: { name: 'Commander', tag: 'Hard', blurb: 'Ultra-hot giants up to 1,394 light-years out. Every subsystem is checked and the budget is a hard limit.' },
};

export const FUEL_NAME: Record<PropellantType, string> = {
  solid: 'Solid fuel',
  kerolox: 'Kerosene',
  hydrolox: 'Hydrogen + oxygen',
  hydrogen: 'Pure hydrogen',
};

interface Said {
  oops: string;
  tip: string;
}

/** What went wrong, in one short line, and what to try next. */
export function kidFailure(check: CheckResult, planet: Planet): Said {
  const map: Record<CheckId, Said> = {
    twr: { oops: 'Insufficient thrust: vehicle did not clear the pad.', tip: 'Raise thrust or cut mass (fewer tanks, lighter parts) until TWR ≥ 1.2.' },
    maxMass: { oops: 'Launch mass exceeded the pad limit.', tip: 'Remove a fuel tank or choose lighter parts.' },
    pressure: { oops: 'Pressurisation failure: propellant feed lost.', tip: 'Fit a pressurisation system rated for this propellant and load.' },
    dvOrbit: { oops: 'Propellant exhausted before orbit.', tip: 'Increase Δv: add tankage or use a higher-Isp engine.' },
    driveRange: { oops: 'Deep-Space Drive range exceeded.', tip: 'Fit a drive rated for at least twice the target distance.' },
    comms: { oops: 'Loss of signal: target beyond comms range.', tip: 'Fit a comms system with range ≥ target distance.' },
    radiation: { oops: 'Crew radiation dose limit exceeded.', tip: 'Fit shielding rated ≥ 4, or fly uncrewed.' },
    heatPlanet: { oops: `Thermal protection failed at ${planet.name}.`, tip: 'Fit protection rated above the planet’s equilibrium temperature.' },
    dvPlanet: {
      oops: planet.missionType === 'landing' ? 'Landed, but insufficient Δv to ascend.' : 'Insufficient Δv for orbit insertion and departure.',
      tip: 'Increase Δv: add tankage or use a higher-Isp engine.',
    },
    dvReturn: { oops: 'Propellant exhausted on the return leg.', tip: 'Add Δv margin: the return leg plus 10% is required.' },
    heatReentry: { oops: 'Heat shield failed on Earth re-entry.', tip: 'Fit protection rated ≥ 1,500 K.' },
    budget: { oops: 'Over budget.', tip: 'Substitute cheaper components.' },
  };
  return map[check.id];
}

/** Stars for the results screen. */
export function starsFor(r: MissionResult): 0 | 1 | 2 | 3 {
  if (r.success) return r.score.base >= 750 ? 3 : 2;
  if (r.failedPhase === 'planet' || r.failedPhase === 'return') return 1;
  return 0;
}

/** Temperature in friendly words, with °C. Real value in kelvin stays visible. */
export function feelsLike(k: number): { word: string; c: number } {
  const c = Math.round(k - 273.15);
  const word = k < 230 ? 'freezing' : k < 300 ? 'chilly' : k < 360 ? 'warm' : k < 700 ? 'very hot' : k < 1500 ? 'scorching' : 'hotter than lava';
  return { word, c };
}

export function gravityWords(g: number): string {
  if (g < 0.7) return 'lighter than Earth';
  if (g < 1.3) return 'about like Earth';
  if (g < 2) return 'heavier than Earth';
  return 'super heavy';
}

/** 1–5 bars for card stats, scaled within the game's parts. */
export const bars = {
  power: (kn: number) => clamp(Math.ceil((kn / 7600) * 5), 1, 5),
  efficiency: (isp: number) => clamp(Math.round((Math.log(isp / 200) / Math.log(3000 / 200)) * 5), 1, 5),
  weight: (kg: number, max: number) => clamp(Math.ceil((kg / max) * 5), 1, 5),
  heat: (k: number) => clamp(Math.ceil((k / 4200) * 5), 1, 5),
  fuel: (kg: number) => clamp(Math.ceil((kg / 110000) * 5), 1, 5),
};
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export const KID_DESC: Record<string, string> = {
  'payload-probe': 'A robot science box. No seats, very light.',
  'payload-capsule': 'A cosy capsule for 2 astronauts.',
  'payload-explorer': 'Four-seat crew module with a large science bay. Heavy.',
  'engine-solid': 'Cheap and strong, but gulps fuel.',
  'engine-kerolox': 'Very strong. Like the rockets flying today.',
  'engine-hydrolox': 'The most efficient real rocket engine.',
  'engine-gascore': 'Fictional. Based on never-built gas-core nuclear studies; enough Isp for landings.',
  'engine-fusion': 'Pretend star-power engine. The most efficient, but heavy.',
  'drive-sail': 'Pretend warp drive for nearby stars.',
  'drive-warp': 'Pretend warp drive with medium range.',
  'drive-fold': 'Pretend warp drive with long range.',
  'drive-singularity': 'Pretend warp drive that reaches anywhere in the game.',
  'tank-solid': 'A chunk of solid rocket fuel.',
  'tank-kerolox': 'Kerosene and oxygen. Light tank.',
  'tank-hydrolox': 'Hydrogen and oxygen. Bulky tank.',
  'tank-lh2': 'Light tank of pure hydrogen.',
  'comms-dsn': 'Real deep-space radio (DSN-class). Cannot reach any other star.',
  'comms-quantum': 'Pretend radio for nearby stars.',
  'comms-tachyon': 'Pretend radio with medium range.',
  'comms-subspace': 'Pretend radio that reaches very far.',
  'pressure-blowdown': 'A small pump for small tanks.',
  'pressure-copv': 'Helium bottles, like on real rockets.',
  'pressure-autogenous': 'Uses its own gas. For hydrogen fuels.',
  'protect-mli': 'Shiny space blanket. Not for hot places.',
  'protect-pica': 'A real heat shield, like on space capsules.',
  'protect-habitat': 'Water walls that block radiation. Great for crews.',
  'protect-hfc': 'Pretend super-shield for the hottest worlds.',
};

export const kidDesc = (c: RocketComponent): string => KID_DESC[c.id] ?? c.description;
