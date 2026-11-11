import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { COMPONENTS_BY_ID } from '../data/components';
import { findPlanet } from '../data/planets';
import {
  ATTEMPTS_PER_RUN,
  MAX_CREW,
  MAX_TANKS,
  evaluateMission,
  type Difficulty,
  type MissionResult,
  type Phase,
  type RocketBuild,
} from '../engine';
import { EMPTY_BUILD, resolveBuild } from './resolve';

export type Screen =
  | 'title'
  | 'briefing'
  | 'difficulty'
  | 'planets'
  | 'mission'
  | 'builder'
  | 'review'
  | 'launch'
  | 'outcome'
  | 'summary'
  | 'leaderboard'
  | 'story';

/** Slots that hold a single component. Tanks are handled separately. */
export type SingleSlot = 'payload' | 'engine' | 'drive' | 'comms' | 'pressure' | 'protection';
export type Slot = SingleSlot | 'tanks';

export interface AttemptRecord {
  planet: string;
  score: number;
  success: boolean;
  failedPhase: Phase | null;
  crew: number;
  cost: number;
  build: RocketBuild;
  at: string;
}

export interface RunState {
  attempts: AttemptRecord[];
  submitted: boolean;
}

const emptyRun = (): RunState => ({ attempts: [], submitted: false });

interface GameState {
  screen: Screen;
  difficulty: Difficulty | null;
  planetName: string | null;
  build: RocketBuild;
  crew: number;
  runs: Record<Difficulty, RunState>;
  /** Result of the latest launch (recomputed from the record, not trusted from storage). */
  lastResult: MissionResult | null;
  briefingSeen: boolean;

  go: (screen: Screen) => void;
  chooseDifficulty: (d: Difficulty) => void;
  choosePlanet: (name: string) => void;
  /** Place a component in its slot. Tanks are appended (max 3). Returns false if it did not fit. */
  place: (componentId: string) => boolean;
  removeSingle: (slot: SingleSlot) => void;
  removeTank: (index: number) => void;
  moveTank: (from: number, to: number) => void;
  clearBuild: () => void;
  setCrew: (n: number) => void;
  launch: () => MissionResult | null;
  nextAttempt: () => void;
  restartRun: (d: Difficulty) => void;
  markSubmitted: (d: Difficulty) => void;
  setBriefingSeen: () => void;
}

export const slotForCategory = (category: string): Slot | null => {
  switch (category) {
    case 'payload':
    case 'engine':
    case 'drive':
    case 'comms':
    case 'pressure':
    case 'protection':
      return category;
    case 'tank':
      return 'tanks';
    default:
      return null;
  }
};

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      screen: 'title',
      difficulty: null,
      planetName: null,
      build: EMPTY_BUILD,
      crew: 0,
      runs: { easy: emptyRun(), medium: emptyRun(), hard: emptyRun() },
      lastResult: null,
      briefingSeen: false,

      go: (screen) => set({ screen }),
      chooseDifficulty: (d) => {
        const run = get().runs[d];
        // A finished, submitted run restarts automatically when chosen again.
        if (run.attempts.length >= ATTEMPTS_PER_RUN && run.submitted) {
          set((s) => ({ runs: { ...s.runs, [d]: emptyRun() } }));
        }
        set({ difficulty: d, planetName: null, screen: get().runs[d].attempts.length >= ATTEMPTS_PER_RUN ? 'summary' : 'planets' });
      },
      choosePlanet: (name) => set({ planetName: name, screen: 'mission' }),
      place: (componentId) => {
        const c = COMPONENTS_BY_ID[componentId];
        if (!c) return false;
        const slot = slotForCategory(c.category);
        if (!slot) return false;
        if (slot === 'tanks') {
          const tanks = get().build.tanks;
          if (tanks.length >= MAX_TANKS) return false;
          set((s) => ({ build: { ...s.build, tanks: [...s.build.tanks, componentId] } }));
          return true;
        }
        set((s) => {
          const build = { ...s.build, [slot]: componentId };
          // Keep crew within the new payload's seats.
          const seats = slot === 'payload' && c.category === 'payload' ? c.crewSeats : null;
          return { build, crew: seats !== null ? Math.min(s.crew, seats) : s.crew };
        });
        return true;
      },
      removeSingle: (slot) =>
        set((s) => ({ build: { ...s.build, [slot]: null }, crew: slot === 'payload' ? 0 : s.crew })),
      removeTank: (index) => set((s) => ({ build: { ...s.build, tanks: s.build.tanks.filter((_, i) => i !== index) } })),
      moveTank: (from, to) =>
        set((s) => {
          const tanks = [...s.build.tanks];
          if (to < 0 || to >= tanks.length) return {};
          const [t] = tanks.splice(from, 1);
          if (t === undefined) return {};
          tanks.splice(to, 0, t);
          return { build: { ...s.build, tanks } };
        }),
      clearBuild: () => set({ build: EMPTY_BUILD, crew: 0 }),
      setCrew: (n) => set({ crew: Math.max(0, Math.min(MAX_CREW, Math.round(n))) }),
      launch: () => {
        const { difficulty, planetName, build, crew, runs } = get();
        if (!difficulty || !planetName) return null;
        const planet = findPlanet(planetName);
        if (!planet) return null;
        const run = runs[difficulty];
        if (run.attempts.length >= ATTEMPTS_PER_RUN) return null;
        const result = evaluateMission(resolveBuild(build), planet, difficulty, crew);
        const record: AttemptRecord = {
          planet: planetName,
          score: result.score.total,
          success: result.success,
          failedPhase: result.failedPhase,
          crew,
          cost: result.cost,
          build,
          at: new Date().toISOString(),
        };
        set((s) => ({
          lastResult: result,
          screen: 'launch',
          runs: { ...s.runs, [difficulty]: { ...s.runs[difficulty], attempts: [...s.runs[difficulty].attempts, record] } },
        }));
        return result;
      },
      nextAttempt: () => {
        const { difficulty, runs } = get();
        if (!difficulty) return set({ screen: 'difficulty' });
        if (runs[difficulty].attempts.length >= ATTEMPTS_PER_RUN) return set({ screen: 'summary' });
        // Keep the build so the player can iterate on it.
        set({ screen: 'planets', planetName: null, lastResult: null });
      },
      restartRun: (d) =>
        set((s) => ({ runs: { ...s.runs, [d]: emptyRun() }, difficulty: d, planetName: null, screen: 'planets', lastResult: null })),
      markSubmitted: (d) => set((s) => ({ runs: { ...s.runs, [d]: { ...s.runs[d], submitted: true } } })),
      setBriefingSeen: () => set({ briefingSeen: true }),
    }),
    {
      name: 'exoplanet-rocket-builder:run:v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        screen: s.screen,
        difficulty: s.difficulty,
        planetName: s.planetName,
        build: s.build,
        crew: s.crew,
        runs: s.runs,
        briefingSeen: s.briefingSeen,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Recompute the last result from the last attempt instead of trusting storage.
        const d = state.difficulty;
        const last = d ? state.runs[d].attempts.at(-1) : undefined;
        const planet = last ? findPlanet(last.planet) : null;
        if (d && last && planet) {
          state.lastResult = evaluateMission(resolveBuild(last.build), planet, d, last.crew);
        }
        // Mid-launch refresh: the attempt is already recorded, so show the outcome.
        if (state.screen === 'launch') state.screen = state.lastResult ? 'outcome' : 'planets';
        if (state.screen === 'outcome' && !state.lastResult) state.screen = 'planets';
        if ((state.screen === 'mission' || state.screen === 'builder' || state.screen === 'review') && !state.planetName) {
          state.screen = d ? 'planets' : 'difficulty';
        }
      },
    },
  ),
);
