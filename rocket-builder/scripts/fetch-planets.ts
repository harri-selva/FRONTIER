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
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
