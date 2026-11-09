import { useEffect, useSyncExternalStore } from 'react';

const KEY = 'exoplanet-rocket-builder:reduced-motion';
export type MotionPref = 'system' | 'on' | 'off';

const listeners = new Set<() => void>();
const readPref = (): MotionPref => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'on' || v === 'off' ? v : 'system';
  } catch {
    return 'system';
  }
};
const systemReduced = (): boolean =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

export function setReducedMotionPref(p: MotionPref): void {
  try {
    localStorage.setItem(KEY, p);
  } catch {
    /* storage unavailable: preference lasts this session only */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  mq?.addEventListener('change', cb);
  return () => {
    listeners.delete(cb);
    mq?.removeEventListener('change', cb);
  };
}

/** True when the user (or their OS) wants reduced motion. */
export function useReducedMotion(): { reduced: boolean; pref: MotionPref } {
  const pref = useSyncExternalStore(subscribe, readPref, (): MotionPref => 'system');
  const sys = useSyncExternalStore(subscribe, systemReduced, () => false);
  const reduced = pref === 'on' || (pref === 'system' && sys);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reduced);
  }, [reduced]);
  return { reduced, pref };
}
