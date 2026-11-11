import { useSyncExternalStore } from 'react';
import type { Phase } from '../engine';

/** Saved progress for the Secret Project story (separate from the 10-try runs). */
export interface StoryProgress {
  done: string[];
  launch: null | {
    engine: string;
    tanks: number;
    predictedSuccess: boolean;
    success: boolean;
    failedPhase: Phase | null;
    oops: string | null;
    deltaV: number;
    needed: number;
    at: string;
  };
}

const KEY = 'exoplanet-rocket-builder:story:v1';
const EMPTY: StoryProgress = { done: [], launch: null };
const listeners = new Set<() => void>();
let cache: StoryProgress | null = null;

function read(): StoryProgress {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as StoryProgress) : EMPTY;
    cache = { done: Array.isArray(v.done) ? v.done : [], launch: v.launch ?? null };
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(p: StoryProgress): void {
  cache = p;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: progress lasts this session */
  }
  listeners.forEach((l) => l());
}

export const useStory = (): StoryProgress =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => EMPTY,
  );

export const markDone = (id: string): void => {
  const p = read();
  if (!p.done.includes(id)) write({ ...p, done: [...p.done, id] });
};

/** The one launch. Refuses to overwrite an existing launch. */
export const recordLaunch = (l: NonNullable<StoryProgress['launch']>): boolean => {
  const p = read();
  if (p.launch) return false;
  write({ ...p, launch: l, done: p.done.includes('lantern') ? p.done : [...p.done, 'lantern'] });
  return true;
};

export const resetStory = (): void => write(EMPTY);
