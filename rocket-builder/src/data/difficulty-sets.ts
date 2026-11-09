import type { Difficulty } from '../engine/types';

/**
 * Curated destinations, chosen from the snapshot by these rules
 * (checked by src/data/difficulty-sets.test.ts):
 *
 * Easy:   nearest systems (≤ 13 pc), likely rocky (≤ 1.6 R⊕), equilibrium
 *         temperature 200–350 K, gravity ≤ 1.5 g. All landing missions.
 * Medium: farther (12–40 pc), equilibrium temperature 200–850 K, gravity
 *         ≤ 2.5 g, mix of landing and orbital-survey missions.
 * Hard:   extreme equilibrium temperature (> 1,000 K), including gas
 *         giants hundreds of parsecs away and high-gravity worlds.
 */
export const DIFFICULTY_SETS: Record<Difficulty, string[]> = {
  easy: [
    'Proxima Cen b',
    'Ross 128 b',
    'GJ 1061 d',
    "Teegarden's Star b",
    "Teegarden's Star c",
    'GJ 1002 b',
    'Wolf 1069 b',
    'TRAPPIST-1 e',
  ],
  medium: [
    'GJ 1132 b',
    'LHS 3844 b',
    'GJ 1214 b',
    'LHS 1140 b',
    'TOI-270 d',
    'TOI-1452 b',
    'TOI-700 d',
    'K2-18 b',
  ],
  hard: [
    '55 Cnc e',
    'HD 189733 b',
    'HD 149026 b',
    'WASP-39 b',
    'WASP-76 b',
    'WASP-121 b',
    'WASP-12 b',
    'KELT-9 b',
  ],
};
