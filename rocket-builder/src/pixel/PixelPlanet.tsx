import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from '../components/useReducedMotion';
import { Frame } from './pixel';
import { drawPlanet, makePlanet, type PlanetKind, type PlanetSprite } from './planet';

/** Art pixels per CSS pixel block: every art pixel is drawn as a PX×PX square. */
export const PX = 3;

export interface PlanetLike {
  name: string;
  eqTempK: number;
  planetClass: 'rocky' | 'giant';
}

/**
 * Surface style from the planet's real class and equilibrium temperature.
 * The look is an artist's impression; only class and temperature are real.
 */
export function planetKind(p: PlanetLike): PlanetKind {
  const T = p.eqTempK;
  if (p.planetClass === 'giant') {
    if (T >= 2000) return 'lava';
    if (T >= 1000) return 'gas';
    if (T >= 500) return 'violet';
    return 'storm';
  }
  if (T < 240) return 'ice';
  if (T < 330) return 'crater';
  if (T < 900) return 'desert';
  return 'lava';
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h) % 100000;
};

const spriteCache = new Map<string, PlanetSprite>();
function spriteFor(kind: PlanetKind, seed: number): PlanetSprite {
  const k = `${kind}:${seed}`;
  let s = spriteCache.get(k);
  if (!s) {
    s = makePlanet(kind, seed);
    spriteCache.set(k, s);
  }
  return s;
}

/* One shared clock for every spinning planet on the page (~12 fps keeps it cheap). */
type Tick = (t: number) => void;
const ticks = new Set<Tick>();
let raf = 0;
let last = 0;
function loop(now: number) {
  if (now - last > 80) {
    last = now;
    ticks.forEach((f) => f(now / 1000));
  }
  raf = ticks.size ? requestAnimationFrame(loop) : 0;
}
function subscribe(f: Tick): () => void {
  ticks.add(f);
  if (!raf) raf = requestAnimationFrame(loop);
  return () => ticks.delete(f);
}

const LIGHT: [number, number, number] = (() => {
  const v = [-0.55, -0.45, 0.7];
  const n = Math.hypot(...v);
  return v.map((x) => x / n) as [number, number, number];
})();

interface Props {
  planet: PlanetLike;
  /** Override the style (e.g. 'oceanGreen' for Earth). */
  kind?: PlanetKind;
  spin?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

/** A FRONTIER-style pixel planet that fills its container's width. */
export function PixelPlanet({ planet, kind, spin = true, className = '', style, title }: Props) {
  const wrap = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const { reduced } = useReducedMotion();
  const k = kind ?? planetKind(planet);
  const seed = hash(planet.name);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(Math.max(10, Math.round(el.clientWidth / PX))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !size) return;
    cv.width = size;
    cv.height = size;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const f = new Frame(size, size);
    const sprite = spriteFor(k, seed);
    const r = size / 2 - 1.5;
    const draw = (t: number) => {
      f.clear(0);
      drawPlanet(f, sprite, Math.floor(size / 2), Math.floor(size / 2), r, t * 0.18 + seed, LIGHT);
      ctx.putImageData(f.img, 0, 0);
    };
    draw(0);
    if (!spin || reduced) return;
    return subscribe(draw);
  }, [size, k, seed, spin, reduced]);

  return (
    <span ref={wrap} className={`block ${className}`} style={style} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <canvas ref={canvas} className="pixelated block h-auto w-full" style={{ aspectRatio: '1' }} />
    </span>
  );
}
