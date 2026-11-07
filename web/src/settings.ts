// Viewer preferences. CRT and sound are off by default. Stored per browser (a convenience only).
import { useSyncExternalStore } from "react";

type S = { crt: boolean; sound: boolean };
const KEY = "frontier.settings";
let state: S = { crt: false, sound: false };
try { state = { ...state, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { /* private mode */ }
const subs = new Set<() => void>();

export const settings = {
  get: () => state,
  set(p: Partial<S>) {
    state = { ...state, ...p };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
    subs.forEach((f) => f());
  },
  subscribe(f: () => void) { subs.add(f); return () => subs.delete(f); },
};
export const useSettings = () => useSyncExternalStore(settings.subscribe, settings.get);

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
