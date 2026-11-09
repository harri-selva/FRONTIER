/**
 * Positions for the zoomable space map. All pure functions; no React.
 *
 * Accuracy notes (also shown in the UI):
 * - Star positions: real galactic longitude/latitude and distance from the
 *   NASA Exoplanet Archive, converted to 3D (x toward the Galactic Centre,
 *   y toward galactic rotation l = 90°, z toward the North Galactic Pole).
 * - Orbit sizes: real semi-major axes (AU). Drawn as circles (all curated
 *   planets have small eccentricities; the value is listed).
 * - Orbit position today: from the measured time of transit/conjunction and
 *   the period. Uncertainty grows with every orbit since that measurement;
 *   above 45° the position is shown as uncertain.
 * - Milky Way spiral arms are an illustration. The Sun's distance from the
 *   Galactic Centre and the galaxies' positions are measured values (cited).
 */
import systemsJson from './systems.json';

export interface SystemPlanet {
  name: string;
  aAu: number | null;
  periodDays: number | null;
  periodErrDays: number | null;
  conjunctionBjd: number | null;
  conjunctionErrDays: number | null;
  transits: boolean;
  eccentricity: number | null;
  radiusRe: number | null;
}

export interface StarSystem {
  host: string;
  glon: number;
  glat: number;
  distancePc: number;
  starRadiusSun: number | null;
  starTeffK: number | null;
  starMassSun: number | null;
  spectralType: string | null;
  planets: SystemPlanet[];
}

const data = systemsJson as unknown as { retrieved: string; systems: Record<string, StarSystem> };
export const SYSTEMS: Record<string, StarSystem> = data.systems;
export const SYSTEMS_RETRIEVED = data.retrieved;

export const AU_PER_SOLAR_RADIUS = 0.004650467;
export const LY_PER_PC = 3.2616;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Heliocentric galactic Cartesian position in parsecs. */
export function galacticXYZ(glonDeg: number, glatDeg: number, distPc: number): { x: number; y: number; z: number } {
  const l = rad(glonDeg);
  const b = rad(glatDeg);
  return { x: distPc * Math.cos(b) * Math.cos(l), y: distPc * Math.cos(b) * Math.sin(l), z: distPc * Math.sin(b) };
}

/** Julian Date for a JS timestamp. (BJD differs from JD by at most ~8.3 minutes; negligible here.) */
export const julianDate = (ms: number): number => ms / 86400000 + 2440587.5;

export interface OrbitPhase {
  /** 0..1: fraction of an orbit since the last conjunction (planet between star and Earth). */
  phase: number;
  /** 1-sigma uncertainty in degrees. */
  sigmaDeg: number;
  known: boolean;
}

/** Where the planet is on its orbit at `jd`, with propagated uncertainty. */
export function orbitPhase(p: SystemPlanet, jd: number): OrbitPhase {
  if (!p.periodDays || p.conjunctionBjd === null) return { phase: 0, sigmaDeg: Infinity, known: false };
  const n = (jd - p.conjunctionBjd) / p.periodDays;
  const phase = ((n % 1) + 1) % 1;
  const sT = p.conjunctionErrDays ?? 0;
  const sP = p.periodErrDays ?? 0;
  const sigmaDays = Math.sqrt(sT * sT + (Math.abs(n) * sP) ** 2);
  const sigmaDeg = (360 * sigmaDays) / p.periodDays;
  return { phase, sigmaDeg, known: (p.conjunctionErrDays !== null || p.periodErrDays !== null) && sigmaDeg <= 45 };
}

/** Star colour from temperature (approximate, for drawing). */
export function starColor(teffK: number | null): { fill: string; glow: string; word: string } {
  const t = teffK ?? 5000;
  if (t >= 7500) return { fill: '#cfe6ff', glow: '#8fd3ff', word: 'blue-white' };
  if (t >= 6000) return { fill: '#fff8ef', glow: '#ffe9b0', word: 'white' };
  if (t >= 5200) return { fill: '#ffe07a', glow: '#ffd04a', word: 'yellow' };
  if (t >= 3700) return { fill: '#ffb48f', glow: '#ff9a5c', word: 'orange' };
  return { fill: '#ff8a7a', glow: '#ff5d73', word: 'red' };
}

/* ---------------- Milky Way and nearby galaxies ---------------- */

/** Sun–Galactic Centre distance, kpc. GRAVITY Collaboration 2019, A&A 625, L10. */
export const SUN_GC_KPC = 8.178;
/** Rough radius of the Milky Way's stellar disc, kpc (≈ 50,000 ly; estimates vary). Used only for the drawing. */
export const MW_DISC_RADIUS_KPC = 15;

export interface Galaxy {
  name: string;
  kid: string;
  glon: number;
  glat: number;
  distKpc: number;
  /** Rough size for drawing, kpc radius. */
  radiusKpc: number;
  kind: 'spiral' | 'irregular' | 'dwarf';
  source: string;
}

export const GALAXIES: Galaxy[] = [
  { name: 'Large Magellanic Cloud', kid: 'A small galaxy that orbits ours', glon: 280.4652, glat: -32.8884, distKpc: 49.59, radiusKpc: 4.3, kind: 'irregular', source: 'Distance: Pietrzyński et al. 2019, Nature 567, 200' },
  { name: 'Small Magellanic Cloud', kid: 'Another little neighbour galaxy', glon: 302.8084, glat: -44.3277, distKpc: 62.44, radiusKpc: 2.8, kind: 'irregular', source: 'Distance: Graczyk et al. 2020, ApJ 904, 13' },
  { name: 'Sagittarius Dwarf', kid: 'A tiny galaxy being pulled apart by ours', glon: 5.57, glat: -14.17, distKpc: 26.5, radiusKpc: 1.5, kind: 'dwarf', source: 'Approximate distance ≈ 26 kpc (Vasiliev & Belokurov 2020)' },
  { name: 'Andromeda (M31)', kid: 'The biggest galaxy near us. It is heading our way!', glon: 121.1744, glat: -21.5729, distKpc: 761, radiusKpc: 23, kind: 'spiral', source: 'Distance: Li et al. 2021, ApJ 920, 84 (761 ± 11 kpc)' },
  { name: 'Triangulum (M33)', kid: 'A smaller spiral galaxy near Andromeda', glon: 133.6102, glat: -31.3305, distKpc: 850, radiusKpc: 9, kind: 'spiral', source: 'Approximate: published distances span about 0.80–0.95 Mpc' },
];

/** Galactocentric position (kpc) with the Galactic Centre at the origin and the Sun at x = −8.178. */
export function galactocentricKpc(glonDeg: number, glatDeg: number, distKpc: number): { x: number; y: number; z: number } {
  const h = galacticXYZ(glonDeg, glatDeg, distKpc);
  return { x: h.x - SUN_GC_KPC, y: h.y, z: h.z };
}
