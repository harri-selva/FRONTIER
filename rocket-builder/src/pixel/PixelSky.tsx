import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../components/useReducedMotion';
import { fbm2, rng } from './noise';
import { C, RAMP } from './palette';
import { Frame, bayer, rampDither } from './pixel';

/** Same scale rule as the FRONTIER stage: ~480×270 art pixels, never below 2×. */
const pickScale = (W: number, H: number) => Math.max(2, Math.floor(Math.min(W / 480, H / 270)));

/**
 * Full-screen 16-bit sky behind every screen, ported from the FRONTIER galaxy
 * scene: dithered space gradient, nebula clouds, twinkling parallax stars and a
 * slowly turning pixel spiral galaxy in the corner.
 */
export function PixelSky() {
  const ref = useRef<HTMLCanvasElement>(null);
  const { reduced } = useReducedMotion();

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let f = new Frame(1, 1);
    let bg = new Uint32Array(1);
    let stars: { x: number; y: number; layer: number; ph: number; big: boolean }[] = [];
    const arms: { r: number; th: number; c: number }[] = [];
    const ra = rng(7);
    for (let i = 0; i < 900; i++) {
      const arm = i % 2;
      const rr = Math.pow(ra(), 1.05);
      const th = arm * Math.PI + Math.log(1 + rr * 9) * 1.9 + (ra() - 0.5) * (0.35 + rr * 0.5);
      const col = rr < 0.12 ? C.cream : rr < 0.28 ? (ra() < 0.5 ? C.gold : C.orange) : rr < 0.55 ? (ra() < 0.6 ? C.pink : C.magenta) : ra() < 0.6 ? C.lavender : C.cyan;
      arms.push({ r: rr, th, c: col });
    }
    let w = 0;
    let h = 0;

    const resize = () => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const s = pickScale(W, H);
      w = Math.ceil(W / s);
      h = Math.ceil(H / s);
      cv.width = w;
      cv.height = h;
      cv.style.width = `${w * s}px`;
      cv.style.height = `${h * s}px`;
      f = new Frame(w, h);
      bg = new Uint32Array(w * h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const g = 0.15 + 0.35 * (y / h);
          let c = rampDither(RAMP.space, g, x, y);
          const n1 = fbm2(x * 0.012, y * 0.02, 3, 5);
          const n2 = fbm2(x * 0.016 + 40, y * 0.012, 9, 4);
          if (n1 > 0.56) c = rampDither(RAMP.nebula, (n1 - 0.56) * 3.2, x, y);
          if (n2 > 0.6 && x > w * 0.45) c = rampDither(RAMP.nebulaCool, (n2 - 0.6) * 3.5, x, y);
          bg[y * w + x] = c;
        }
      const r = rng(11);
      stars = Array.from({ length: Math.round((w * h) / 260) }, () => ({ x: r() * w, y: r() * h, layer: r() < 0.6 ? 0 : r() < 0.8 ? 1 : 2, ph: r() * 6.28, big: r() < 0.04 }));
    };

    const draw = (t: number) => {
      f.buf.set(bg);
      const sy = window.scrollY / pickScale(window.innerWidth, window.innerHeight);
      for (const s of stars) {
        const k = [0.04, 0.1, 0.18][s.layer] ?? 0.1;
        const x = (s.x + (reduced ? 0 : t * (s.layer + 1) * 0.6)) % w;
        const y = (((s.y - sy * k) % h) + h) % h;
        const tw = reduced ? 1 : Math.sin(t * (1.5 + s.layer) + s.ph);
        const c = tw > 0.6 ? C.white : tw > -0.2 ? (s.layer ? C.slateLight : C.slate) : C.navy2;
        f.pset(x, y, c);
        if (s.big && tw > 0.2) {
          f.pset(x - 1, y, C.lavender);
          f.pset(x + 1, y, C.lavender);
          f.pset(x, y - 1, C.lavender);
          f.pset(x, y + 1, C.lavender);
        }
      }
      // distant spiral galaxy, upper right
      const R = Math.min(w, h) * 0.22;
      const cx = w * 0.84;
      const cy = h * 0.2;
      for (let yy = -R * 0.4; yy < R * 0.4; yy++)
        for (let xx = -R * 0.5; xx < R * 0.5; xx++) {
          const d = Math.hypot(xx / (R * 0.5), yy / (R * 0.2));
          if (d > 1) continue;
          const v = 1 - d;
          const X = cx + xx;
          const Y = cy + yy;
          if (v * v > bayer(X, Y) * 0.9 + 0.15) f.pset(X, Y, rampDither([C.purple0, C.magenta, C.orange, C.gold, C.cream], v * v * 1.2, X, Y));
        }
      const rot = reduced ? 0 : t * 0.04;
      for (const a of arms) {
        const th = a.th + rot / (0.35 + a.r);
        f.pset(cx + Math.cos(th) * a.r * R, cy + Math.sin(th) * a.r * R * 0.42, a.c);
      }
      ctx.putImageData(f.img, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);
    let raf = 0;
    let lastDraw = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      if (now - lastDraw > 66) {
        lastDraw = now;
        draw((now - t0) / 1000);
      }
      raf = requestAnimationFrame(loop);
    };
    draw(0);
    raf = requestAnimationFrame(loop);
    const onScroll = () => reduced && draw(0);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
    };
  }, [reduced]);

  return <canvas ref={ref} className="pixelated pointer-events-none fixed left-0 top-0 z-0" aria-hidden="true" />;
}
