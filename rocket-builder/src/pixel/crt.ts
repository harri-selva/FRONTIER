import { useSyncExternalStore } from 'react';

/** Optional CRT scanline filter, as on the FRONTIER site. Remembered per browser. */
const KEY = 'exoplanet-rocket-builder:crt';
const listeners = new Set<() => void>();
const read = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};
export function setCrt(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}
export const useCrt = (): boolean =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => false,
  );
