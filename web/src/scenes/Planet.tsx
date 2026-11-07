// PLANET: an animated pixel ocean; each island is a sub-field (size = papers).
import { useEffect, useMemo, useState } from "react";
import { Stage, type PointerInfo, type Scene, type View } from "../engine/Stage";
import { C } from "../engine/palette";
import { Frame, bayer, dim } from "../engine/pixel";
import { rng } from "../engine/noise";
import { STYLE_MED, STYLE_QUANT, drawDrops, drawIsland, drawIslandOutline, drawOcean, makeCloud, makeIsland,
  updateDrops, type Drop, type IslandSprite } from "../engine/sprites";
import type { FieldId, FieldInfo, LandInfo } from "../data";
import { fmt } from "../data";
import { sfx } from "../sound";
import { reducedMotion } from "../settings";

interface Placed { land: LandInfo; x: number; y: number; R: number; spr: IslandSprite }

class PlanetScene implements Scene {
  w = 0; h = 0; scale = 2;
  field: FieldId; lands: LandInfo[] = [];
  placed: Placed[] = [];
  flagged = new Set<number>();
  hover: number | null = null;
  mouse = { x: -1, y: -1 };
  drops: Drop[] = [];
  clouds = [0, 1, 2, 3, 4].map((i) => ({ ...makeCloud(31 + i * 7, 40 + i * 6, 13 + (i % 2) * 4), x: i * 140, y: 30 + i * 47, v: 3 + i }));
  rnd = rng(5);
  intro = 0; zoom: { id: number; t0: number } | null = null; t = 0;
  rm = reducedMotion();
  labels = new Map<number, HTMLElement>();
  vignette?: Uint8Array;
  onHover: (l: Placed | null) => void = () => {};
  onClick: (l: LandInfo) => void = () => {};
  onZoomed: (l: LandInfo) => void = () => {};
  ramp: number[];

  constructor(field: FieldId) {
    this.field = field;
    this.ramp = field === "medicine" ? [C.oceanDeep, C.ocean, C.ocean, C.shallow] : [C.navy1, C.indigo, C.ocean, C.ocean];
  }

  setLands(lands: LandInfo[]) {
    this.lands = lands;
    const order = [...lands].sort((a, b) => b.top_gaps - a.top_gaps);
    this.flagged = new Set(order.slice(0, Math.max(3, Math.round(lands.length / 3))).map((l) => l.id));
    if (this.w) this.layout();
  }

  layout() {
    const { w, h } = this;
    const style = this.field === "medicine" ? STYLE_MED : STYLE_QUANT;
    // the islands were packed (pipeline/export_web.py) in a 16:9 box: fit that box below the HUD
    const top = 24, usableH = h - top - 4;
    const bw = Math.min(w, usableH * 16 / 9), bh = bw * 9 / 16;
    const bx = (w - bw) / 2, by = top + (usableH - bh) / 2;
    this.placed = this.lands.map((l) => {
      const R = Math.max(10, Math.round(l.r * bw));
      return { land: l, x: Math.round(bx + l.x * bw), y: Math.round(by + l.y * bh), R,
        spr: makeIsland(R, l.id * 13 + (this.field === "quant" ? 500 : 0), style, Math.max(2, Math.round(R / 9))) };
    });
    // vignette = planet curvature: corners fall off into dithered darkness
    const v = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x / w - 0.5) * 2, dy = (y / h - 0.5) * 2;
      const d = dx * dx * 0.55 + dy * dy * 0.5;
      v[y * w + x] = d > 0.62 + bayer(x, y) * 0.35 ? (d > 0.95 + bayer(x, y) * 0.3 ? 2 : 1) : 0;
    }
    this.vignette = v;
  }

  resize(w: number, h: number, s: number) { this.w = w; this.h = h; this.scale = s; this.layout(); }

  isWater = (x: number, y: number) => {
    for (const p of this.placed) {
      const lx = x - (p.x - p.spr.ox), ly = y - (p.y - p.spr.oy);
      if (lx >= 0 && ly >= 0 && lx < p.spr.w && ly < p.spr.h && (p.spr.mask[ly * p.spr.w + lx] || p.spr.px[ly * p.spr.w + lx])) return false;
    }
    return true;
  };

  draw(f: Frame, t: number, dt: number) {
    this.t = t;
    const { w, h } = this;
    drawOcean(f, this.rm ? 0 : t, this.ramp, this.rm ? 0 : t * 3, 0, this.field === "quant" ? 2 : 0);
    if (!this.rm) {
      updateDrops(this.drops, t, w, h, 0.55 * dt * 60 / 4, this.rnd);
    }
    for (const p of this.placed) {
      const hov = this.hover === p.land.id;
      drawIsland(f, p.spr, p.x, p.y, this.rm ? 0 : t, { glow: this.flagged.has(p.land.id) ? 1 : 0, seed: p.land.id });
      if (hov) drawIslandOutline(f, p.spr, p.x - p.spr.ox, p.y - p.spr.oy, Math.sin(t * 8) > 0 ? C.gold : C.cream);
      if (this.flagged.has(p.land.id)) this.flag(f, p.x + Math.round(p.R * 0.15), p.y - Math.round(p.R * 0.45), t);
      const el = this.labels.get(p.land.id);
      if (el) el.style.transform = `translate(${p.x * this.scale}px, ${(p.y + p.R * 0.55) * this.scale}px) translateX(-50%)`;
    }
    drawDrops(f, this.drops, t, this.isWater);
    // cloud shadows then clouds (parallax depth)
    for (const c of this.clouds) {
      const cx = ((c.x + (this.rm ? 0 : t * c.v)) % (w + 120)) - 60, cy = c.y % h;
      for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
        if (!c.shadow[y * c.w + x]) continue;
        const X = (cx + x + 10) | 0, Y = (cy + y + 16) | 0;
        if ((X + Y) & 1) f.pset(X, Y, dim(f.get(X, Y), 0.35));
      }
      f.blit(c.px, c.w, c.h, cx, cy);
    }
    // planet curvature
    if (this.vignette) for (let i = 0; i < w * h; i++) {
      const v = this.vignette[i];
      if (v) f.buf[i] = v === 2 ? C.void : dim(f.buf[i], 0.55);
    }
    // intro: zoom out of the dive + dissolve in
    if (this.intro < 1 && !this.rm) {
      this.intro = Math.min(1, this.intro + dt / 0.8);
      const k = 1 - this.intro, s = 1 + 3 * k * k, src = f.buf.slice();
      const cx = w / 2, cy = h / 2;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const sx = Math.round(cx + (x - cx) / s), sy = Math.round(cy + (y - cy) / s);
        let c = src[sy * w + sx] ?? C.void;
        if (bayer(x >> 1, y >> 1) < k * 1.2) c = C.void;
        f.buf[y * w + x] = c;
      }
    }
    if (this.zoom) {
      const k = Math.min(1, (t - this.zoom.t0) / 0.75);
      const p = this.placed.find((q) => q.land.id === this.zoom!.id);
      if (p) {
        const s = 1 + 6 * k * k, src = f.buf.slice();
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const sx = Math.round(p.x + (x - p.x) / s), sy = Math.round(p.y + (y - p.y) / s);
          let c = sx >= 0 && sy >= 0 && sx < w && sy < h ? src[sy * w + sx] : C.void;
          if (k > 0.5 && bayer(x >> 1, y >> 1) < (k - 0.5) * 2.2) c = C.void;
          f.buf[y * w + x] = c;
        }
        if (k >= 1) { this.zoom = null; this.onZoomed(p.land); }
      }
    }
  }

  flag(f: Frame, x: number, y: number, t: number) {
    for (let i = 0; i < 9; i++) f.pset(x, y - i, C.cream);
    const wave = this.rm ? 0 : Math.round(Math.sin(t * 5));
    for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) {
      const yy = y - 8 + j + (i > 2 ? wave : 0);
      f.pset(x + 1 + i, yy, (i + j) % 3 === 0 ? C.gold : C.magenta);
    }
    if (Math.sin(t * 4) > 0) { f.pset(x, y - 10, C.white); f.pset(x - 1, y - 10, C.gold); f.pset(x + 1, y - 10, C.gold); }
  }

  hit(x: number, y: number) {
    for (const p of this.placed) if (Math.hypot(x - p.x, (y - p.y) * 1.05) < p.R * 0.95) return p;
    return null;
  }

  pointer(e: PointerInfo) {
    if (this.zoom) return;
    const p = e.type === "leave" ? null : this.hit(e.x, e.y);
    const id = p ? p.land.id : null;
    if (id !== this.hover) { this.hover = id; if (id !== null) sfx.blip(); }
    this.onHover(p);
    if (e.type === "click" && p) this.onClick(p.land);
  }

  startZoom(id: number) {
    if (this.rm) { const p = this.placed.find((q) => q.land.id === id); if (p) this.onZoomed(p.land); return; }
    this.zoom = { id, t0: this.t };
  }
}

export default function Planet({ field, info, lands, onEnter }: { field: FieldId; info?: FieldInfo; lands?: LandInfo[]; onEnter: (slug: string) => void }) {
  const scene = useMemo(() => new PlanetScene(field), [field]);
  const [view, setView] = useState<View>({ scale: 2, w: 0, h: 0 });
  const [hover, setHover] = useState<Placed | null>(null);

  useEffect(() => { if (lands) scene.setLands(lands); }, [lands, scene]);
  const labelHover = (id: number | null) => {
    scene.hover = id;
    setHover(id === null ? null : scene.placed.find((p) => p.land.id === id) ?? null);
  };
  useEffect(() => {
    scene.onHover = (p) => setHover((h) => (h?.land.id === p?.land.id ? h : p));
    scene.onClick = (l) => { sfx.select(); scene.startZoom(l.id); };
    scene.onZoomed = (l) => onEnter(l.slug);
  });

  return (
    <div className="scene">
      <Stage scene={scene} onView={setView} cursor={hover ? "pointer" : "default"} />
      <div className="overlay">
        {lands?.map((l) => (
          <button key={l.id} ref={(el) => { if (el) scene.labels.set(l.id, el); }} className="island-label"
            onClick={() => { sfx.select(); scene.startZoom(l.id); }}
            onMouseEnter={() => labelHover(l.id)} onMouseLeave={() => labelHover(null)}
            onFocus={() => labelHover(l.id)} onBlur={() => labelHover(null)}
            aria-label={`${l.name}: ${l.papers} papers. Open island`}>
            {l.name}
          </button>
        ))}
        {hover && (
          <div className={`tip ${(hover.y - hover.R) * view.scale < 330 ? "below" : ""}`} style={{
            left: Math.max(180, Math.min(window.innerWidth - 180, hover.x * view.scale)),
            top: (hover.y - hover.R) * view.scale < 330 ? (hover.y + hover.R) * view.scale + 8 : (hover.y - hover.R) * view.scale - 10 }}>
            <div className="tip-title">{hover.land.name.toUpperCase()}</div>
            <table className="tip-table"><tbody>
              <tr><td>Papers</td><td>{fmt(hover.land.papers)}</td></tr>
              <tr><td>Concepts</td><td>{fmt(hover.land.concepts)}</td></tr>
              <tr><td>Open gaps (field top 1%)</td><td>{fmt(hover.land.top_gaps)}</td></tr>
            </tbody></table>
            {hover.land.featured.length > 0 && (<div className="tip-list"><div className="muted">Top predicted gaps:</div>
              {hover.land.featured.map((s) => <div key={s}>◆ {s}</div>)}</div>)}
            <div className="tip-hint">CLICK TO EXPLORE</div>
          </div>
        )}
        {info && (
          <div className="planet-hud panel">
            <div className="ph-title">{info.name.toUpperCase()} <span className="badge live">LIVE</span></div>
            <div>{fmt(info.papers)} arXiv papers · {info.first_year}–2026</div>
            <div>{info.lands} islands · {fmt(info.concepts)} concepts</div>
            <div className="muted">Island size = number of papers. <span className="flag-key" aria-hidden="true" /> Flag = most open gaps.</div>
          </div>
        )}
      </div>
    </div>
  );
}
