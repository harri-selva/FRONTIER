/** Basic name sanitising and profanity filtering for leaderboard entries. */

export const MAX_NAME_LENGTH = 20;

// Small, deliberately basic list. Matches whole words and common letter swaps.
const BLOCKED = [
  'fuck', 'shit', 'cunt', 'bitch', 'bastard', 'dick', 'cock', 'pussy', 'asshole', 'arse', 'wank',
  'slut', 'whore', 'fag', 'nigger', 'nigga', 'retard', 'twat', 'piss', 'nazi', 'rape',
];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

/** Keep letters, numbers, spaces, - _ . and collapse whitespace. */
export function sanitizeName(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N} _.\-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

export function containsProfanity(name: string): boolean {
  const flat = name
    .toLowerCase()
    .split('')
    .map((ch) => LEET[ch] ?? ch)
    .join('')
    .replace(/[^a-z]/g, '');
  return BLOCKED.some((w) => flat.includes(w));
}

export type NameCheck = { ok: true; name: string } | { ok: false; reason: string };

export function checkName(input: string): NameCheck {
  const name = sanitizeName(input);
  if (name.length === 0) return { ok: false, reason: 'Enter a name (letters and numbers).' };
  if (containsProfanity(name)) return { ok: false, reason: 'Please choose a different name.' };
  return { ok: true, name };
}
