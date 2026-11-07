// 8/16-bit style sound effects generated with the Web Audio API (no audio files).
// Muted by default; the speaker button in the HUD turns them on.
import { settings } from "./settings";

let ctx: AudioContext | null = null;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, vol = 0.06, slide = 0) {
  if (!settings.get().sound) return;
  const a = ac(), o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), a.currentTime + dur);
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start(); o.stop(a.currentTime + dur);
}

export const sfx = {
  blip: () => tone(880, 0.05, "square", 0.03),
  select: () => { tone(660, 0.07, "square", 0.05); setTimeout(() => tone(990, 0.09, "square", 0.05), 60); },
  warp: () => tone(180, 0.6, "sawtooth", 0.05, 1400),
  back: () => tone(520, 0.12, "triangle", 0.06, -260),
  error: () => { tone(220, 0.12, "square", 0.05); setTimeout(() => tone(160, 0.2, "square", 0.05), 110); },
};
