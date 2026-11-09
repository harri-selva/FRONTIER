/**
 * Fetches a snapshot of confirmed exoplanets from the NASA Exoplanet Archive
 * TAP service (table: pscomppars) and writes src/data/planets.json.
 *
 * Run:  npm run fetch-planets
 *
 * The game never calls the archive at runtime; the committed snapshot is used.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { DIFFICULTY_SETS } from '../src/data/difficulty-sets';

const TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
const COLUMNS = [
  'pl_name',
  'hostname',
  'sy_dist',
  'pl_rade',
  'pl_bmasse',
  'pl_bmassprov',
  'pl_eqt',
  'pl_orbper',
  'pl_orbsmax',
  'st_spectype',
  'discoverymethod',
  'disc_year',
];

interface RawRow {
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

const round = (n: number | null, dp: number): number | null =>
  n === null ? null : Math.round(n * 10 ** dp) / 10 ** dp;

async function main(): Promise<void> {
  const query =
    `select ${COLUMNS.join(',')} from pscomppars ` +
    'where sy_dist is not null and pl_rade is not null and pl_bmasse is not null and pl_eqt is not null';
  const url = `${TAP}?query=${encodeURIComponent(query)}&format=json`;
  console.log('Querying NASA Exoplanet Archive…');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Archive returned HTTP ${res.status}`);
  const rows = (await res.json()) as RawRow[];

  const planets = rows
    .filter((r) => r.sy_dist !== null && r.pl_rade !== null && r.pl_bmasse !== null && r.pl_eqt !== null)
    .map((r) => ({
      pl_name: r.pl_name,
      hostname: r.hostname,
      sy_dist: round(r.sy_dist, 4),
      pl_rade: round(r.pl_rade, 4),
      pl_bmasse: round(r.pl_bmasse, 4),
      pl_bmassprov: r.pl_bmassprov,
      pl_eqt: round(r.pl_eqt, 1),
      pl_orbper: round(r.pl_orbper, 5),
      pl_orbsmax: round(r.pl_orbsmax, 5),
      st_spectype: r.st_spectype,
      discoverymethod: r.discoverymethod,
      disc_year: r.disc_year,
    }))
    .sort((a, b) => (a.sy_dist ?? 0) - (b.sy_dist ?? 0));

  const out = {
    source: 'NASA Exoplanet Archive, Planetary Systems Composite Parameters (pscomppars)',
    sourceUrl: 'https://exoplanetarchive.ipac.caltech.edu/',
    retrieved: new Date().toISOString().slice(0, 10),
    count: planets.length,
    planets,
  };

  const here = dirname(fileURLToPath(import.meta.url));
  const target = resolve(here, '../src/data/planets.json');
  writeFileSync(target, JSON.stringify(out) + '\n');
  console.log(`Wrote ${planets.length} planets to ${target}`);

  await fetchSystems(out.retrieved, planets, resolve(here, '../src/data/systems.json'));
}

interface SystemRow {
  pl_name: string;
  hostname: string;
  glon: number | null;
  glat: number | null;
  sy_dist: number | null;
  pl_orbsmax: number | null;
  pl_orbper: number | null;
  pl_orbpererr1: number | null;
  pl_tranmid: number | null;
  pl_tranmiderr1: number | null;
  tran_flag: number | null;
  pl_orbeccen: number | null;
  pl_rade: number | null;
  st_rad: number | null;
  st_teff: number | null;
  st_mass: number | null;
  st_spectype: string | null;
}

/**
 * Every known planet (no filtering) around the curated host stars, plus the
 * star's galactic position, for the star-map and planetary-system views.
 */
async function fetchSystems(retrieved: string, planets: { pl_name: string; hostname: string }[], target: string): Promise<void> {
  const curated = new Set(Object.values(DIFFICULTY_SETS).flat());
  const hosts = [...new Set(planets.filter((p) => curated.has(p.pl_name)).map((p) => p.hostname))];
  const list = hosts.map((h) => `'${h.replace(/'/g, "''")}'`).join(',');
  const cols =
    'pl_name,hostname,glon,glat,sy_dist,pl_orbsmax,pl_orbper,pl_orbpererr1,pl_tranmid,pl_tranmiderr1,tran_flag,pl_orbeccen,pl_rade,st_rad,st_teff,st_mass,st_spectype';
  const url = `${TAP}?query=${encodeURIComponent(`select ${cols} from pscomppars where hostname in (${list})`)}&format=json`;
  console.log(`Querying ${hosts.length} planetary systems…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Archive returned HTTP ${res.status}`);
  const rows = (await res.json()) as SystemRow[];
  const systems: Record<string, unknown> = {};
  for (const h of hosts) {
    const rs = rows.filter((r) => r.hostname === h).sort((a, b) => (a.pl_orbsmax ?? 1e9) - (b.pl_orbsmax ?? 1e9));
    const s = rs[0];
    if (!s) continue;
    systems[h] = {
      host: h,
      glon: s.glon,
      glat: s.glat,
      distancePc: s.sy_dist,
      starRadiusSun: s.st_rad,
      starTeffK: s.st_teff,
      starMassSun: s.st_mass,
      spectralType: s.st_spectype,
      planets: rs.map((r) => ({
        name: r.pl_name,
        aAu: r.pl_orbsmax,
        periodDays: r.pl_orbper,
        periodErrDays: r.pl_orbpererr1,
        conjunctionBjd: r.pl_tranmid,
        conjunctionErrDays: r.pl_tranmiderr1,
        transits: r.tran_flag === 1,
        eccentricity: r.pl_orbeccen,
        radiusRe: r.pl_rade,
      })),
    };
  }
  writeFileSync(target, JSON.stringify({ retrieved, source: 'NASA Exoplanet Archive (pscomppars)', systems }, null, 1) + '\n');
  console.log(`Wrote ${Object.keys(systems).length} systems to ${target}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
