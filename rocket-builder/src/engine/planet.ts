import { EARTH_ORBITAL_VELOCITY_KMS, PC_TO_LY, ROCKY_RADIUS_MAX_RE } from './constants';
import type { MassProvenance, Planet } from './types';

/** Row shape of src/data/planets.json (NASA Exoplanet Archive pscomppars). */
export interface RawPlanet {
  pl_name: string;
  hostname: string;
  sy_dist: number | null;
  pl_rade: number | null;
  pl_bmasse: number | null;
  pl_bmassprov: string | null;
  pl_eqt: number | null;
  pl_orbper: number | null;
  pl_orbsmax: number | null;
  st_spectype: string | null;
  discoverymethod: string | null;
  disc_year: number | null;
}

export const parsecsToLightYears = (pc: number): number => pc * PC_TO_LY;

/** Surface gravity in Earth g = M / R² (Earth units). */
export const surfaceGravityG = (massMe: number, radiusRe: number): number => massMe / (radiusRe * radiusRe);

/** Circular orbital velocity at the surface, km/s ≈ 7.9 × √(M / R). */
export const surfaceOrbitalVelocityKms = (massMe: number, radiusRe: number): number =>
  EARTH_ORBITAL_VELOCITY_KMS * Math.sqrt(massMe / radiusRe);

export const massProvenance = (raw: string | null): MassProvenance => {
  if (raw === 'Mass') return 'measured';
  if (raw === 'Msini' || raw === 'Msin(i)/sin(i)') return 'minimum';
  return 'estimated';
};

export const archiveUrl = (name: string): string =>
  `https://exoplanetarchive.ipac.caltech.edu/overview/${encodeURIComponent(name)}`;

export function derivePlanet(raw: RawPlanet): Planet {
  if (raw.sy_dist === null || raw.pl_rade === null || raw.pl_bmasse === null || raw.pl_eqt === null) {
    throw new Error(`Planet ${raw.pl_name} is missing required fields`);
  }
  const planetClass = raw.pl_rade <= ROCKY_RADIUS_MAX_RE ? 'rocky' : 'giant';
  return {
    name: raw.pl_name,
    host: raw.hostname,
    distancePc: raw.sy_dist,
    distanceLy: parsecsToLightYears(raw.sy_dist),
    radiusRe: raw.pl_rade,
    massMe: raw.pl_bmasse,
    massProvenance: massProvenance(raw.pl_bmassprov),
    massProvenanceRaw: raw.pl_bmassprov,
    eqTempK: raw.pl_eqt,
    orbitalPeriodDays: raw.pl_orbper,
    semiMajorAxisAu: raw.pl_orbsmax,
    spectralType: raw.st_spectype,
    discoveryMethod: raw.discoverymethod,
    discoveryYear: raw.disc_year,
    gravityG: surfaceGravityG(raw.pl_bmasse, raw.pl_rade),
    orbitalVelocityKms: surfaceOrbitalVelocityKms(raw.pl_bmasse, raw.pl_rade),
    planetClass,
    missionType: planetClass === 'rocky' ? 'landing' : 'survey',
    archiveUrl: archiveUrl(raw.pl_name),
  };
}
