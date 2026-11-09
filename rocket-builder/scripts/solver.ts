/**
 * Dev tool: brute-forces every legal build against every curated planet to
 * check each destination is winnable within budget and to show the best build.
 *
 *   npx tsx scripts/solver.ts
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { COMMS, DRIVES, ENGINES, PAYLOADS, PRESSURE, PROTECTION, TANKS } from '../src/data/components';
import { DIFFICULTY_SETS } from '../src/data/difficulty-sets';
import { derivePlanet, type RawPlanet } from '../src/engine/planet';
import { evaluateMission } from '../src/engine/evaluate';
import { canLaunch, validateBuild } from '../src/engine/validate';
import type { Difficulty, Rocket } from '../src/engine/types';

const here = dirname(fileURLToPath(import.meta.url));
const raw = (JSON.parse(readFileSync(resolve(here, '../src/data/planets.json'), 'utf8')) as { planets: RawPlanet[] })
  .planets;
const only = process.argv[2] as Difficulty | undefined;
const diffs: Difficulty[] = only ? [only] : ['easy', 'medium', 'hard'];

for (const d of diffs) {
  for (const name of DIFFICULTY_SETS[d]) {
    const r = raw.find((p) => p.pl_name === name);
    if (!r) {
      console.log('MISSING', name);
      continue;
    }
    const planet = derivePlanet(r);
    let bestScore = -1;
    let bestDesc = '';
    let wins = 0;
    let crewWins = 0;
    let total = 0;
    for (const payload of PAYLOADS)
      for (const engine of ENGINES)
        for (const drive of DRIVES)
          for (let n = 1; n <= 3; n++)
            for (const tank of TANKS.filter((t) => t.propellant === engine.propellant))
              for (const comms of COMMS)
                for (const pressure of [null, ...PRESSURE])
                  for (const protection of [null, ...PROTECTION])
                    for (let crew = 0; crew <= payload.crewSeats; crew++) {
                      const rocket: Rocket = {
                        payload,
                        engine,
                        drive,
                        tanks: Array<typeof tank>(n).fill(tank),
                        comms,
                        pressure,
                        protection,
                      };
                      if (!canLaunch(validateBuild(rocket, d, crew))) continue;
                      total++;
                      const res = evaluateMission(rocket, planet, d, crew);
                      if (res.success) {
                        wins++;
                        if (crew > 0) crewWins++;
                      }
                      if (res.score.total > bestScore) {
                        bestScore = res.score.total;
                        const s = res.score;
                        bestDesc = [
                          engine.id,
                          `${n}x${tank.id}`,
                          drive.id,
                          comms.id,
                          pressure?.id ?? '-',
                          protection?.id ?? '-',
                          payload.id,
                          `crew${crew}`,
                          `cost${res.cost}`,
                          `dv${res.deltaV.available.toFixed(1)}/${res.deltaV.totalRequired.toFixed(1)}`,
                          `twr${res.twr.toFixed(2)}`,
                          `m${s.mission} p${s.performance} b${s.budget} s${s.suitability} r${s.resources}`,
                        ].join(' ');
                      }
                    }
    console.log(
      `${d.padEnd(6)} ${name.padEnd(19)} ${planet.missionType.padEnd(7)} vorb ${planet.orbitalVelocityKms.toFixed(1).padStart(5)} wins ${wins}/${total} crewWins ${crewWins} best ${bestScore} :: ${bestDesc}`,
    );
  }
}
