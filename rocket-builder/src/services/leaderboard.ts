import type { Difficulty } from '../engine/types';
import { MAX_NAME_LENGTH, checkName } from './nameFilter';

export interface LeaderboardEntry {
  name: string;
  difficulty: Difficulty;
  /** Average score over the 10-attempt run. */
  average: number;
  createdAt: string;
}

export interface LeaderboardService {
  readonly label: string;
  list(difficulty: Difficulty, limit?: number): Promise<LeaderboardEntry[]>;
  submit(entry: Omit<LeaderboardEntry, 'createdAt'>): Promise<void>;
}

const sortEntries = (a: LeaderboardEntry, b: LeaderboardEntry): number =>
  b.average - a.average || a.createdAt.localeCompare(b.createdAt);

function validated(entry: Omit<LeaderboardEntry, 'createdAt'>): LeaderboardEntry {
  const check = checkName(entry.name);
  if (!check.ok) throw new Error(check.reason);
  if (!Number.isFinite(entry.average) || entry.average < 0 || entry.average > 1400) throw new Error('Invalid score');
  return { ...entry, name: check.name.slice(0, MAX_NAME_LENGTH), createdAt: new Date().toISOString() };
}

export class LocalLeaderboard implements LeaderboardService {
  readonly label = 'This browser (localStorage)';
  private key = 'exoplanet-rocket-builder:leaderboard:v1';

  private read(): LeaderboardEntry[] {
    try {
      const raw = localStorage.getItem(this.key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as LeaderboardEntry[]) : [];
    } catch {
      return [];
    }
  }

  async list(difficulty: Difficulty, limit = 20): Promise<LeaderboardEntry[]> {
    return this.read()
      .filter((e) => e.difficulty === difficulty)
      .sort(sortEntries)
      .slice(0, limit);
  }

  async submit(entry: Omit<LeaderboardEntry, 'createdAt'>): Promise<void> {
    const all = [...this.read(), validated(entry)];
    try {
      localStorage.setItem(this.key, JSON.stringify(all.slice(-500)));
    } catch {
      throw new Error('Could not save to this browser’s storage.');
    }
  }
}

interface SupabaseRow {
  name: string;
  difficulty: Difficulty;
  average: number;
  created_at: string;
}

export class SupabaseLeaderboard implements LeaderboardService {
  readonly label = 'Online (Supabase)';
  constructor(
    private url: string,
    private anonKey: string,
  ) {}

  private clientPromise: Promise<import('@supabase/supabase-js').SupabaseClient> | null = null;
  private client() {
    // Loaded on demand so the library is only downloaded when Supabase is configured.
    this.clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(this.url, this.anonKey, { auth: { persistSession: false } }),
    );
    return this.clientPromise;
  }

  async list(difficulty: Difficulty, limit = 20): Promise<LeaderboardEntry[]> {
    const c = await this.client();
    const { data, error } = await c
      .from('leaderboard')
      .select('name,difficulty,average,created_at')
      .eq('difficulty', difficulty)
      .order('average', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return ((data ?? []) as SupabaseRow[]).map((r) => ({
      name: r.name,
      difficulty: r.difficulty,
      average: Number(r.average),
      createdAt: r.created_at,
    }));
  }

  async submit(entry: Omit<LeaderboardEntry, 'createdAt'>): Promise<void> {
    const v = validated(entry);
    const c = await this.client();
    const { error } = await c.from('leaderboard').insert({ name: v.name, difficulty: v.difficulty, average: v.average });
    if (error) throw new Error(error.message);
  }
}

let instance: LeaderboardService | null = null;

/** Supabase when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set, otherwise localStorage. */
export function getLeaderboard(): LeaderboardService {
  if (instance) return instance;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  instance = url && key ? new SupabaseLeaderboard(url, key) : new LocalLeaderboard();
  return instance;
}
