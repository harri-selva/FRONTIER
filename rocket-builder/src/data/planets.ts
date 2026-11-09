import snapshot from './planets.json';
import atmosphere from './atmosphere-notes.json';
import { DIFFICULTY_SETS } from './difficulty-sets';
import { derivePlanet, type RawPlanet } from '../engine/planet';
import type { Difficulty, Planet } from '../engine/types';

interface Snapshot {
  source: string;
  sourceUrl: string;
  retrieved: string;
  count: number;
  planets: RawPlanet[];
}

const data = snapshot as Snapshot;

export const DATA_SOURCE = data.source;
export const DATA_SOURCE_URL = data.sourceUrl;
export const DATA_RETRIEVED = data.retrieved;
export const DATA_COUNT = data.count;

const byName = new Map(data.planets.map((p) => [p.pl_name, p]));

export const PLANETS_BY_DIFFICULTY: Record<Difficulty, Planet[]> = {
  easy: [],
  medium: [],
  hard: [],
};
for (const d of Object.keys(DIFFICULTY_SETS) as Difficulty[]) {
  PLANETS_BY_DIFFICULTY[d] = DIFFICULTY_SETS[d]
    .map((name) => byName.get(name))
    .filter((p): p is RawPlanet => p !== undefined)
    .map(derivePlanet);
}

export const findPlanet = (name: string): Planet | null => {
  for (const list of Object.values(PLANETS_BY_DIFFICULTY)) {
    const p = list.find((x) => x.name === name);
    if (p) return p;
  }
  return null;
};

export interface AtmosphereNote {
  note: string;
  source: string;
}

const notes = (atmosphere as { notes: Record<string, AtmosphereNote> }).notes;
export const atmosphereNote = (name: string): AtmosphereNote | null => notes[name] ?? null;
