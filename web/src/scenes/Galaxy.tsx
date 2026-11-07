// GALAXY: a rotating 16-bit spiral galaxy with 14 original planets.
// Only Medicine and Quant are live; the rest show "COMING SOON".
import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, type PointerInfo, type Scene, type View } from "../engine/Stage";
import { C, RAMP } from "../engine/palette";
import { Frame, bayer, rampDither } from "../engine/pixel";
import { fbm2, rng } from "../engine/noise";
import { drawPlanet, makePlanet, type PlanetKind, type PlanetSprite } from "../engine/sprites";
import type { FieldInfo, FieldId } from "../data";
import { fmt } from "../data";
import { sfx } from "../sound";
import { reducedMotion } from "../settings";

interface PlanetDef { id: string; name: string; kind: PlanetKind; size: number; ring: number; angle: number; live?: FieldId }
const PLANETS: PlanetDef[] = [
  { id: "medicine", name: "Medicine", kind: "oceanGreen", size: 19, ring: 1, angle: 0.55, live: "medicine" },
  { id: "quant", name: "Quant", kind: "oceanGold", size: 19, ring: 1, angle: 3.55, live: "quant" },
  { id: "physics", name: "Physics", kind: "storm", size: 13, ring: 0, angle: 0.2 },
  { id: "chemistry", name: "Chemistry", kind: "gas", size: 11, ring: 0, angle: 2.3 },
  { id: "neuro", name: "Neuroscience", kind: "violet", size: 12, ring: 0, angle: 4.4 },
  { id: "materials", name: "Materials", kind: "crater", size: 10, ring: 1, angle: 1.75 },
  { id: "energy", name: "Energy", kind: "lava", size: 11, ring: 1, angle: 2.6 },
  { id: "climate", name: "Climate", kind: "ice", size: 12, ring: 1, angle: 4.9 },
  { id: "cs", name: "Computer Science", kind: "ringedGas", size: 12, ring: 2, angle: 0.0 },
  { id: "biology", name: "Biology", kind: "toxic", size: 13, ring: 2, angle: 1.25 },
  { id: "astronomy", name: "Astronomy", kind: "ringedIce", size: 11, ring: 2, angle: 2.5 },
  { id: "robotics", name: "Robotics", kind: "desert", size: 10, ring: 2, angle: 3.75 },
  { id: "math", name: "Mathematics", kind: "crater", size: 9, ring: 2, angle: 4.6 },
  { id: "agri", name: "Agriculture", kind: "toxic", size: 10, ring: 2, angle: 5.5 },
];
// orbits stay clear of the HUD (top), the title (bottom) and the screen edges
const RINGS = [{ rx: 0.19, ry: 0.15, w: 0.03 }, { rx: 0.3, ry: 0.24, w: 0.018 }, { rx: 0.4, ry: 0.32, w: 0.012 }];

interface Placed { def: PlanetDef; x: number; y: number; r: number }

class GalaxyScene implements Scene {
  w = 0; h = 0; scale = 2; cx = 0; cy = 0;
  bg?: Uint32Array;
  stars: { x: number; y: number; layer: number; ph: number; big: boolean }[] = [];
  arms: { r: number; th: number; c: number }[] = [];
  sprites = new Map<string, PlanetSprite>();
  placed: Placed[] = [];
  mouse = { x: -1, y: -1 };
  hover: string | null = null;
  zoom: { id: string; t0: number } | null = null;
  rm = reducedMotion();
  onHover: (id: string | null, x: number, y: number) => void = () => {};
  onClick: (def: PlanetDef) => void = () => {};
  onZoomed: (def: PlanetDef) => void = () => {};
  labels = new Map<string, HTMLElement>();

  constructor() {
    for (const p of PLANETS) this.sprites.set(p.id, makePlanet(p.kind, p.id.length * 97 + p.angle * 10));
    const r = rng(7);
    for (let i = 0; i < 2300; i++) {
      // two logarithmic spiral arms, denser towards the core, with scatter growing outwards
      const arm = i % 2, rr = Math.pow(r(), 1.05);
      const th = arm * Math.PI + Math.log(1 + rr * 9) * 1.9 + (r() - 0.5) * (0.35 + rr * 0.5);
      const col = rr < 0.12 ? C.cream : rr < 0.28 ? (r() < 0.5 ? C.gold : C.orange) : rr < 0.55 ? (r() < 0.6 ? C.pink : C.magenta) : r() < 0.6 ? C.lavender : C.cyan;
      this.arms.push({ r: rr, th, c: col });
    }
  }

  resize(w: number, h: number, s: number) {
    this.w = w; this.h = h; this.scale = s;
    this.cx = Math.round(w / 2); this.cy = Math.round(h * 0.47);
    // background: dithered space gradient + nebula clouds (precomputed once per size)
    const bg = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = 0.15 + 0.35 * (y / h);
      let c = rampDither(RAMP.space, g, x, y);
      const n1 = fbm2(x * 0.012, y * 0.02, 3, 5), n2 = fbm2(x * 0.016 + 40, y * 0.012, 9, 4);
      if (n1 > 0.56) c = rampDither(RAMP.nebula, (n1 - 0.56) * 3.2, x, y);
      if (n2 > 0.6 && x > w * 0.45) c = rampDither(RAMP.nebulaCool, (n2 - 0.6) * 3.5, x, y);
      bg[y * w + x] = c;
    }
    this.bg = bg;
    const r = rng(11);
    this.stars = Array.from({ length: Math.round((w * h) / 260) }, () => ({
      x: r() * w, y: r() * h, layer: r() < 0.6 ? 0 : r() < 0.8 ? 1 : 2, ph: r() * 6.28, big: r() < 0.04,
    }));
  }

  draw(f: Frame, t: number) {
    const { w, h, cx, cy } = this;
    if (!this.bg) return;
    f.buf.set(this.bg);
    // parallax stars
    const mx = this.mouse.x < 0 ? 0 : (this.mouse.x / w - 0.5), my = this.mouse.y < 0 ? 0 : (this.mouse.y / h - 0.5);
    for (const s of this.stars) {
      const k = [2, 5, 9][s.layer];
      const x = (s.x - mx * k + t * (s.layer + 1) * 0.6) % w, y = s.y - my * k;
      const tw = this.rm ? 1 : Math.sin(t * (1.5 + s.layer) + s.ph);
      const c = tw > 0.6 ? C.white : tw > -0.2 ? (s.layer ? C.slateLight : C.slate) : C.navy2;
      f.pset(x, y, c);
      if (s.big && tw > 0.2) { f.pset(x - 1, y, C.lavender); f.pset(x + 1, y, C.lavender); f.pset(x, y - 1, C.lavender); f.pset(x, y + 1, C.lavender); }
    }
    // galaxy core glow (dithered ellipse)
    const R = Math.min(w * 0.36, h * 0.62);
    for (let y = -R * 0.5; y < R * 0.5; y++) for (let x = -R; x < R; x++) {
      const d = Math.hypot(x / R, y / (R * 0.42));
      if (d > 0.5) continue;
      const v = 1 - d / 0.5;
      const X = cx + x, Y = cy + y;
      if (v * v > bayer(X, Y) * 0.9 + 0.08) f.pset(X, Y, rampDither([C.purple0, C.magenta, C.orange, C.gold, C.cream], v * v * 1.2, X, Y));
    }
    // spiral arms (differential rotation: inner parts turn faster)
    const rot = this.rm ? 0 : t * 0.05;
    for (const a of this.arms) {
      const th = a.th + rot / (0.35 + a.r);
      const x = cx + Math.cos(th) * a.r * R, y = cy + Math.sin(th) * a.r * R * 0.42;
      f.pset(x, y, a.c);
    }
    // planets (back to front)
    const S = Math.max(0.8, Math.min(w / 480, h / 270));
    this.placed = PLANETS.map((def) => {
      const ring = RINGS[def.ring];
      const ang = def.angle + (this.rm ? 0 : t * ring.w * (def.live ? 0.35 : 1));
      const x = cx + Math.cos(ang) * ring.rx * w, y = cy + Math.sin(ang) * ring.ry * h;
      const depth = 0.82 + 0.3 * (Math.sin(ang) * 0.5 + 0.5);
      return { def, x: Math.round(x), y: Math.round(y), r: Math.round(def.size * S * depth) };
    }).sort((a, b) => a.y - b.y);
    for (const p of this.placed) {
      const live = !!p.def.live, hov = this.hover === p.def.id;
      const L = norm([cx - p.x, cy - p.y, 60]);
      const pulse = live ? 0.5 + 0.5 * Math.sin(t * 2.4) : 0;
      drawPlanet(f, this.sprites.get(p.def.id)!, p.x, p.y, p.r, t * (live ? 0.25 : 0.12) + p.def.angle, L,
        live || hov ? 0 : 0.45, live ? pulse : 0);
      if (live) {   // satellite + blinking beacon
        const sa = t * 1.3 + p.def.angle;
        const sx = p.x + Math.cos(sa) * (p.r + 6), sy = p.y + Math.sin(sa) * (p.r + 6) * 0.45;
        if (Math.sin(sa) < 0 || Math.hypot(sx - p.x, sy - p.y) > p.r) {
          f.rect(sx - 1, sy, 3, 1, C.slateLight); f.pset(sx, sy - 1, C.white);
          f.pset(sx, sy + 1, Math.sin(t * 8) > 0 ? C.red : C.gold);
        }
        if (Math.sin(t * 3) > 0.3) { f.pset(p.x, p.y - p.r - 3, C.gold); f.pset(p.x, p.y - p.r - 4, C.cream); }
      }
      if (hov) f.ring(p.x, p.y, p.r + 4 + (Math.sin(t * 6) > 0 ? 1 : 0), live ? C.gold : C.slateLight);
      // position the HTML label/button under the planet
      const el = this.labels.get(p.def.id);
      if (el) el.style.transform = `translate(${p.x * this.scale}px, ${(p.y + p.r + 5) * this.scale}px) translateX(-50%)`;
    }
    // zoom-dive into a live planet: nearest-neighbour magnification of the frame
    if (this.zoom) {
      const k = Math.min(1, (t - this.zoom.t0) / 0.9);
      const p = this.placed.find((q) => q.def.id === this.zoom!.id)!;
      if (p) {
        const s = 1 + 14 * k * k;
        const src = f.buf.slice();
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const sx = Math.round(p.x + (x - p.x) / s), sy = Math.round(p.y + (y - p.y) / s);
          let c = sx >= 0 && sy >= 0 && sx < w && sy < h ? src[sy * w + sx] : C.void;
          if (k > 0.55 && bayer(x >> 1, y >> 1) < (k - 0.55) * 2.3) c = C.void;   // pixel dissolve
          f.buf[y * w + x] = c;
        }
      }
      if (k >= 1) { const z = this.zoom; this.zoom = null; this.onZoomed(PLANETS.find((d) => d.id === z.id)!); }
    }
  }

  hit(x: number, y: number): Placed | null {
    let best: Placed | null = null;
    for (const p of this.placed) if (Math.hypot(x - p.x, y - p.y) <= p.r + 4) best = p;  // front-most wins
    return best;
  }

  pointer(e: PointerInfo) {
    if (this.zoom) return;
    this.mouse = e.type === "leave" ? { x: -1, y: -1 } : { x: e.x, y: e.y };
    const p = e.type === "leave" ? null : this.hit(e.x, e.y);
    const id = p ? p.def.id : null;
    if (id !== this.hover) { this.hover = id; if (id) sfx.blip(); }
    this.onHover(id, p ? p.x : 0, p ? p.y - p.r : 0);
    if (e.type === "click" && p) this.onClick(p.def);
  }

  startZoom(id: string, now: number) {
    if (this.rm) { this.onZoomed(PLANETS.find((d) => d.id === id)!); return; }
    this.zoom = { id, t0: now };
  }
}

const norm = (v: number[]): [number, number, number] => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };

export default function Galaxy({ fields, onEnter }: { fields: FieldInfo[] | undefined; onEnter: (f: FieldId) => void }) {
  const scene = useMemo(() => new GalaxyScene(), []);
  const [view, setView] = useState<View>({ scale: 2, w: 0, h: 0 });
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const t0 = useRef(performance.now());

  useEffect(() => {
    scene.onHover = (id, x, y) => setHover((h) => (id ? (h && h.id === id && Math.abs(h.x - x) < 2 && Math.abs(h.y - y) < 2 ? h : { id, x, y }) : null));
    scene.onClick = (def) => activate(def);
    scene.onZoomed = (def) => def.live && onEnter(def.live);
  });

  const activate = (def: PlanetDef) => {
    if (def.live) { sfx.warp(); scene.startZoom(def.id, (performance.now() - t0.current) / 1000); }
    else { sfx.error(); setMsg(def.name); }
  };

  const info = (id: string) => fields?.find((f) => f.id === id);
  const labelHover = (id: string | null) => {
    scene.hover = id;
    const p = id ? scene.placed.find((q) => q.def.id === id) : undefined;
    setHover(p ? { id: p.def.id, x: p.x, y: p.y - p.r } : null);
  };
  const hp = hover && PLANETS.find((p) => p.id === hover.id);

  return (
    <div className="scene">
      <Stage scene={scene} onView={setView} cursor={hover ? "pointer" : "default"} />
      <div className="overlay">
        {PLANETS.map((p) => (
          <button key={p.id} ref={(el) => { if (el) scene.labels.set(p.id, el); }}
            className={`planet-label ${p.live ? "live" : "soon"}`}
            onClick={() => activate(p)}
            onMouseEnter={() => labelHover(p.id)} onMouseLeave={() => labelHover(null)}
            onFocus={() => labelHover(p.id)} onBlur={() => labelHover(null)}
            aria-label={p.live ? `${p.name}: open planet` : `${p.name}: coming soon`}>
            {p.live && <span className="dot" aria-hidden="true" />}{p.name.toUpperCase()}
          </button>
        ))}
        {hp && hover && (
          <div className="tip" style={{ left: hover.x * view.scale, top: hover.y * view.scale - 12 }}>
            {hp.live ? (() => {
              const f = info(hp.live!);
              return (<>
                <div className="tip-title">{hp.name.toUpperCase()} <span className="badge live">LIVE</span></div>
                {f ? (<table className="tip-table"><tbody>
                  <tr><td>Papers</td><td>{fmt(f.papers)}</td></tr>
                  <tr><td>Sub-fields (islands)</td><td>{f.lands}</td></tr>
                  <tr><td>Concepts</td><td>{fmt(f.concepts)}</td></tr>
                  <tr><td>Open gaps (top 1%)</td><td>{fmt(f.top_gaps)}</td></tr>
                </tbody></table>) : <div>Loading...</div>}
                <div className="tip-hint">CLICK TO LAND</div>
              </>);
            })() : (<>
              <div className="tip-title">{hp.name.toUpperCase()} <span className="badge soon">COMING SOON</span></div>
              <div>Sector not yet charted.</div>
            </>)}
          </div>
        )}
        {msg && (
          <div className="modal-back" onClick={() => setMsg(null)}>
            <div className="dialog" role="alertdialog" aria-labelledby="sig" onClick={(e) => e.stopPropagation()}>
              <div className="dialog-head"><span className="dialog-icon" aria-hidden="true" />INCOMING TRANSMISSION</div>
              <p id="sig" className="blink-text">SIGNAL NOT FOUND...</p>
              <p>SECTOR <b>{msg.toUpperCase()}</b> UNDER CONSTRUCTION.</p>
              <p className="muted">Only Medicine and Quant are charted in this build.</p>
              <button className="btn" autoFocus onClick={() => setMsg(null)}>OK</button>
            </div>
          </div>
        )}
        <div className="galaxy-title" aria-hidden="true">
          <div className="logo-big">FRONTIER</div>
          <div className="subtitle">PRESS START TO EXPLORE: CHOOSE A LIVE WORLD</div>
        </div>
      </div>
    </div>
  );
}

