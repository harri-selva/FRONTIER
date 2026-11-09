import { describe, expect, it } from 'vitest';
import { checkName, containsProfanity, sanitizeName } from './nameFilter';

describe('leaderboard name filter', () => {
  it('strips markup and limits length to 20', () => {
    expect(sanitizeName('<script>alert(1)</script>')).toBe('alert1');
    expect(sanitizeName('<b>Mae Jemison</b>')).toBe('Mae Jemison');
    expect(sanitizeName('a'.repeat(40)).length).toBe(20);
    expect(sanitizeName('  Ada   Lovelace ')).toBe('Ada Lovelace');
  });
  it('blocks profanity including simple letter swaps', () => {
    expect(containsProfanity('sh1t')).toBe(true);
    expect(containsProfanity('Rocket Ranger')).toBe(false);
    expect(checkName('').ok).toBe(false);
    expect(checkName('Mae Jemison').ok).toBe(true);
  });
});
