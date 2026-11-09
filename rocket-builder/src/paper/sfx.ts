/**
 * Tiny synthesized sound effects (Web Audio, no files). Paper pops, whooshes
 * and dings. Only ever started from a user action; muted state is remembered.
 */
const KEY = 'exoplanet-rocket-builder:muted';
let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();
const listeners = new Set<() => void>();

export const isMuted = (): boolean => muted;
export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem(KEY, m ? '1' : '0');
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}
export function subscribeMuted(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, vol = 0.15, slideTo?: number, delay = 0): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.2, filterFrom = 1200, filterTo = 200, delay = 0): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(filterFrom, t);
  f.frequency.exponentialRampToValueAtTime(filterTo, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const sfx = {
  pop: () => tone(520, 0.12, 'triangle', 0.18, 880),
  click: () => tone(700, 0.06, 'square', 0.06),
  drop: () => {
    tone(300, 0.1, 'triangle', 0.2, 180);
    noise(0.08, 0.08, 3000, 800);
  },
  remove: () => tone(500, 0.15, 'triangle', 0.14, 220),
  nope: () => {
    tone(220, 0.12, 'square', 0.08);
    tone(180, 0.16, 'square', 0.08, undefined, 0.12);
  },
  tick: () => tone(1000, 0.05, 'sine', 0.12),
  go: () => {
    tone(523, 0.12, 'triangle', 0.16);
    tone(784, 0.25, 'triangle', 0.16, undefined, 0.12);
  },
  rumble: () => noise(2.6, 0.35, 900, 120),
  whoosh: () => noise(0.8, 0.18, 4000, 300),
  boom: () => {
    noise(1.2, 0.5, 1600, 60);
    tone(90, 0.8, 'sine', 0.3, 40);
  },
  sad: () => {
    tone(392, 0.25, 'triangle', 0.14);
    tone(330, 0.25, 'triangle', 0.14, undefined, 0.22);
    tone(262, 0.45, 'triangle', 0.14, undefined, 0.44);
  },
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.15, undefined, i * 0.12));
  },
  star: (i: number) => tone(660 + i * 220, 0.2, 'triangle', 0.15, undefined, 0),
  splash: () => noise(0.9, 0.3, 2500, 200),
};
