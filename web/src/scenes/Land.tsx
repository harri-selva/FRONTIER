// LAND: one island = one sub-field. The island surface is the stage for the concept network.
//   crystals = concepts (size = papers), heat glow = more papers,
//   solid lines = studied together, dashed glowing lines = predicted gaps,
//   portals on the coast = gaps leading to concepts on other islands of the same planet.
import { useEffect, useMemo, useState } from "react";
import { Stage, type PointerInfo, type Scene, type View } from "../engine/Stage";
import { C, RAMP } from "../engine/palette";
import { Frame, bayer, dim, rampDither } from "../engine/pixel";
import { rng } from "../engine/noise";
import { STYLE_MED, STYLE_QUANT, drawDrops, drawOcean, makeIsland, updateDrops, type Drop, type IslandSprite } from "../engine/sprites";
import type { FieldId, Gap, LandData, LandInfo } from "../data";
import { sfx } from "../sound";
import { reducedMotion } from "../settings";

interface NodeP { id: number; name: string; papers: number; heat: number; wx: number; wy: number; k: number }
interface Bridge { land: number; name: string; wx: number; wy: number }

class LandScene implements Scene {
  w = 0; h = 0; scale = 2; t = 0;
  field: FieldId;
  data?: LandData; lands: LandInfo[] = []; me?: LandInfo;
  spr?: IslandSprite; heat?: Uint32Array; R = 0;
  nodes: NodeP[] = []; byId = new Map<number, NodeP>();
  neigh = new Map<number, Set<number>>();
  gapById = new Map<string, Gap>();
  bridges = new Map<number, Bridge>();
  zoom = 1; camX = 0; camY = 0;   // screen position of the sprite's top-left
  hoverNode: number | null = null; hoverGap: string | null = null;
  selConcept: number | null = null; selGap: string | null = null;
  drops: Drop[] = []; rnd = rng(9); intro = 0;
  rm = reducedMotion();
  dragging = false;
  els = new Map<string, HTMLElement>();   // "n<id>" node buttons/labels, "b<land>" bridge labels
  onHover: (h: { node: number | null; gap: string | null }) => void = () => {};
  onPickNode: (id: number) => void = () => {};
  onPickGap: (id: string) => void = () => {};
  onPickBridge: (land: number) => void = () => {};

  constructor(field: FieldId) { this.field = field; }

  setData(d: LandData, lands: LandInfo[]) {
    this.data = d; this.lands = lands; this.me = lands.find((l) => l.id === d.land);
    this.gapById = new Map(d.gaps.map((g) => [g.id, g]));
    this.neigh = new Map();
    const add = (a: number, b: number) => { if (!this.neigh.has(a)) this.neigh.set(a, new Set()); this.neigh.get(a)!.add(b); };
    for (const [a, b] of d.links) { add(a, b); add(b, a); }
    if (this.w) this.build();
  }

  resize(w: number, h: number, s: number) { this.w = w; this.h = h; this.scale = s; if (this.data) this.build(); }

  build() {
    const d = this.data!, { w, h } = this;
    const R = Math.round(Math.min(w * 0.36, (h - 34) * 0.47));
    this.R = R;
    this.spr = makeIsland(R, d.land * 13 + (this.field === "quant" ? 500 : 0) + 7, this.field === "medicine" ? STYLE_MED : STYLE_QUANT, Math.max(4, Math.round(R / 14)));
    const spr = this.spr;
    const maxP = Math.max(...d.nodes.map((n) => n.papers));
    this.nodes = d.nodes.map((n) => ({
      id: n.id, name: n.name, papers: n.papers, heat: n.heat,
      wx: Math.round(spr.ox + n.x * R * 0.8), wy: Math.round(spr.oy + n.y * R * 0.8),
      k: n.extra ? 2 : 2 + Math.round(3.2 * Math.sqrt(n.papers / maxP)),
    }));
    this.byId = new Map(this.nodes.map((n) => [n.id, n]));
    // heatmap: density of papers around each concept, drawn as a dithered warm glow on land
    const dens = new Float32Array(spr.w * spr.h);
    const sig = Math.max(6, R * 0.09);
    for (const n of this.nodes) {
      const wgt = Math.log1p(n.papers);
      const rad = Math.ceil(sig * 2.5);
      for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
        const X = n.wx + x, Y = n.wy + y;
        if (X < 0 || Y < 0 || X >= spr.w || Y >= spr.h) continue;
        dens[Y * spr.w + X] += wgt * Math.exp(-(x * x + y * y) / (2 * sig * sig));
      }
    }
    let mx = 0; for (const v of dens) mx = Math.max(mx, v);
    const heat = new Uint32Array(spr.w * spr.h);
    for (let i = 0; i < dens.length; i++) {
      if (!spr.mask[i]) continue;
      const v = dens[i] / mx, x = i % spr.w, y = (i / spr.w) | 0;
      // dithered glow: only where papers are dense, partial coverage so the terrain shows through
      if (v > 0.28 && (v - 0.28) * 1.7 > bayer(x, y)) heat[i] = rampDither(RAMP.heat, (v - 0.28) * 1.5, x, y);
    }
    this.heat = heat;
    // bridges: one portal per other island, placed on the coast in that island's direction
    this.bridges = new Map();
    const me = this.me!;
    for (const g of d.gaps) {
      for (const [other, name] of [[g.u_land, g.u_land_name], [g.v_land, g.v_land_name]] as [number, string][]) {
        if (other === d.land || this.bridges.has(other)) continue;
        const ol = this.lands.find((l) => l.id === other);
        if (!ol) continue;
        const ang = Math.atan2((ol.y - me.y) * 0.5625, ol.x - me.x);
        // walk outwards until we leave the island
        let r = R * 0.5;
        while (r < R * 1.4) {
          const X = Math.round(spr.ox + Math.cos(ang) * r), Y = Math.round(spr.oy + Math.sin(ang) * r);
          if (X < 0 || Y < 0 || X >= spr.w || Y >= spr.h || !spr.mask[Y * spr.w + X]) break;
          r += 1;
        }
        this.bridges.set(other, { land: other, name, wx: Math.round(spr.ox + Math.cos(ang) * (r + 3)), wy: Math.round(spr.oy + Math.sin(ang) * (r + 3)) });
      }
    }
    this.resetView();
  }

  resetView() {
    if (!this.spr) return;
    this.zoom = 1;
    this.camX = Math.round(this.w * 0.47 - this.spr.ox);
    this.camY = Math.round(14 + (this.h - 14) / 2 - this.spr.oy);
  }

  sx = (wx: number) => this.camX + wx * this.zoom;
  sy = (wy: number) => this.camY + wy * this.zoom;

  visibleGaps(): Gap[] {
    const d = this.data!;
    const ids = new Set<string>(d.featured.slice(0, 6));
    const focus = this.hoverNode ?? this.selConcept;
    if (focus !== null) for (const id of d.concept_gaps[String(focus)] || []) ids.add(id);
    if (this.selGap) ids.add(this.selGap);
    return [...ids].map((i) => this.gapById.get(i)!).filter(Boolean);
  }

  /** Endpoints of a gap in screen coordinates, or null if it cannot be drawn here. */
  gapEnds(g: Gap): [number, number, number, number] | null {
    const a = this.byId.get(g.u), b = this.byId.get(g.v);
    if (a && b) return [this.sx(a.wx), this.sy(a.wy), this.sx(b.wx), this.sy(b.wy)];
    const here = a || b;
    const otherLand = a ? g.v_land : g.u_land;
    const br = this.bridges.get(otherLand);
    if (here && br && otherLand !== this.data!.land) return [this.sx(here.wx), this.sy(here.wy), this.sx(br.wx), this.sy(br.wy)];
    return null;
  }

  draw(f: Frame, t: number, dt: number) {
    this.t = t;
    const { w, h } = this;
    const tt = this.rm ? 0 : t;
    drawOcean(f, tt, this.field === "medicine" ? [C.oceanDeep, C.ocean, C.ocean, C.shallow] : [C.navy1, C.indigo, C.ocean, C.ocean], -this.camX * 0.5 + tt * 3, -this.camY * 0.5);
    if (!this.spr || !this.data) return;
    const spr = this.spr, z = this.zoom, x0 = this.camX, y0 = this.camY;
    // reef, terrain, heat
    for (let y = 0; y < spr.h; y++) {
      const Y = y0 + y * z; if (Y + z < 0 || Y >= h) continue;
      for (let x = 0; x < spr.w; x++) {
        const X = x0 + x * z; if (X + z < 0 || X >= w) continue;
        const i = y * spr.w + x;
        let c = spr.px[i];
        if (!c && spr.reef[i]) c = bayer(x, y) > 0.35 ? C.shallow : C.reef;
        if (!c) continue;
        if (this.heat![i]) c = this.heat![i];
        if (z === 1) f.buf[Y * w + X] = c; else f.rect(X, Y, z, z, c);
      }
    }
    // surf
    for (let k = 0; k < spr.coast.length; k++) {
      const i = spr.coast[k], x = i % spr.w, y = (i / spr.w) | 0;
      const ph = Math.sin(x * 0.5 + y * 0.35 + tt * 2.4) + Math.sin(k * 0.11 - tt * 1.3);
      if (ph > 0.4) f.rect(x0 + x * z, y0 + y * z, z, z, ph > 1.2 ? C.white : C.foam);
    }
    if (!this.rm) { updateDrops(this.drops, t, w, h, 0.4 * dt * 60 / 4, this.rnd); }
    drawDrops(f, this.drops, t, (X, Y) => {
      const x = Math.floor((X - x0) / z), y = Math.floor((Y - y0) / z);
      return !(x >= 0 && y >= 0 && x < spr.w && y < spr.h && (spr.mask[y * spr.w + x] || spr.px[y * spr.w + x]));
    });

    const focus = this.hoverNode ?? this.selConcept;
    const selG = this.selGap ? this.gapById.get(this.selGap) : undefined;
    const hot = new Set<number>();
    if (focus !== null) { hot.add(focus); this.neigh.get(focus)?.forEach((n) => hot.add(n)); }
    if (selG) { hot.add(selG.u); hot.add(selG.v); }
    const dimming = focus !== null || !!selG;

    // existing links
    for (const [a, b] of this.data.links) {
      const A = this.byId.get(a), B = this.byId.get(b);
      if (!A || !B) continue;
      const on = focus !== null && (a === focus || b === focus);
      const col = on ? C.cream : dimming ? C.navy2 : C.slate;
      if (dimming && !on && (a + b) % 2) continue;  // thin out dimmed links
      f.line(this.sx(A.wx), this.sy(A.wy), this.sx(B.wx), this.sy(B.wy), col);
    }
    // predicted gaps: animated dashed lines with a dark glow
    const march = Math.floor(tt * 10);
    for (const g of this.visibleGaps()) {
      const e = this.gapEnds(g);
      if (!e) continue;
      const active = g.id === this.selGap || g.id === this.hoverGap || g.u === focus || g.v === focus;
      if (dimming && !active && !this.data.featured.slice(0, 6).includes(g.id)) continue;
      const faint = dimming && !active;
      f.line(e[0] + 1, e[1] + 1, e[2] + 1, e[3] + 1, 0, (i) => ((i + march) % 6 < 4 && !faint ? C.purple0 : false));
      f.line(e[0], e[1], e[2], e[3], 0, (i) => {
        const p = (i + march) % 6;
        if (p >= 4) return false;
        if (faint) return p < 2 ? C.purple1 : false;
        return active ? (p < 2 ? C.gold : C.cream) : p < 2 ? C.magenta : C.pink;
      });
    }
    // bridge portals: bright + labelled when a visible gap uses them, small and dim otherwise
    const used = new Set<number>();
    for (const g of this.visibleGaps()) {
      if (!this.byId.has(g.u) || !this.byId.has(g.v)) {
        const other = this.byId.has(g.u) ? g.v_land : g.u_land;
        if (other !== this.data.land) used.add(other);
      }
    }
    for (const b of this.bridges.values()) {
      const X = this.sx(b.wx), Y = this.sy(b.wy), on = used.has(b.land);
      const pulse = Math.sin(tt * 4) > 0;
      if (on) { f.ring(X, Y, 4, pulse ? C.gold : C.magenta, 3); f.ring(X, Y, 2, C.cream, 1); f.pset(X, Y, C.white); }
      else { f.ring(X, Y, 2, C.purple1, 1); f.pset(X, Y, C.lavender); }
      const el = this.els.get(`b${b.land}`);
      if (el) {
        el.style.transform = `translate(${X * this.scale}px, ${(Y + 5) * this.scale}px) translateX(-50%)`;
        el.style.visibility = on ? "visible" : "hidden";
      }
    }
    // concept crystals
    for (const n of this.nodes) {
      const X = this.sx(n.wx), Y = this.sy(n.wy);
      const k = n.k + (z > 1 ? z - 1 : 0);
      const isHot = hot.has(n.id), sel = n.id === this.selConcept || (selG && (selG.u === n.id || selG.v === n.id));
      const faded = dimming && !isHot;
      const core = n.heat > 0.75 ? C.gold : n.heat > 0.5 ? C.orange : n.heat > 0.3 ? C.cyan : C.reef;
      const body = n.heat > 0.75 ? C.orange : n.heat > 0.5 ? C.magenta : n.heat > 0.3 ? C.teal : C.shallow;
      for (let yy = -k; yy <= k; yy++) for (let xx = -k; xx <= k; xx++) {
        const d = Math.abs(xx) + Math.abs(yy);
        if (d > k) continue;
        let c = d === k ? C.navy0 : d >= k - 1 ? body : core;
        if (xx === -1 && yy === -Math.max(1, k - 2)) c = C.white;
        f.pset(X + xx, Y + yy, faded ? dim(c, 0.6) : c);
      }
      if (sel) f.ring(X, Y, k + 3 + (Math.sin(tt * 6) > 0 ? 1 : 0), C.gold);
      else if (n.id === this.hoverNode) f.ring(X, Y, k + 3, C.white);
      const el = this.els.get(`n${n.id}`);
      if (el) el.style.transform = `translate(${X * this.scale}px, ${(Y + k + 2) * this.scale}px) translateX(-50%)`;
    }
    this.declutter();
    // intro: dissolve in
    if (this.intro < 1 && !this.rm) {
      this.intro = Math.min(1, this.intro + dt / 0.6);
      const k = 1 - this.intro;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bayer(x >> 1, y >> 1) < k) f.buf[y * w + x] = C.void;
    }
  }

  /** Hide labels that would overlap a more important one (priority order set by React). */
  labelPriority: number[] = [];
  declutter() {
    const boxes: [number, number, number, number][] = [];
    for (const id of this.labelPriority) {
      const el = this.els.get(`n${id}`), n = this.byId.get(id);
      if (!el || !n) continue;
      const wpx = el.offsetWidth || 60, hpx = el.offsetHeight || 18;
      const k = n.k + (this.zoom > 1 ? this.zoom - 1 : 0);
      const x = this.sx(n.wx) * this.scale - wpx / 2, y = (this.sy(n.wy) + k + 2) * this.scale;
      const hit = boxes.some(([a, b, c, d]) => x < c && x + wpx > a && y < d && y + hpx > b);
      el.style.visibility = hit ? "hidden" : "visible";
      if (!hit) boxes.push([x - 2, y - 1, x + wpx + 2, y + hpx + 1]);
    }
  }

  nodeAt(x: number, y: number): number | null {
    let best: number | null = null, bd = 1e9;
    for (const n of this.nodes) {
      const d = Math.hypot(x - this.sx(n.wx), y - this.sy(n.wy));
      if (d <= n.k + 3 && d < bd) { bd = d; best = n.id; }
    }
    return best;
  }
  gapAt(x: number, y: number): string | null {
    let best: string | null = null, bd = 3;
    for (const g of this.visibleGaps()) {
      const e = this.gapEnds(g);
      if (!e) continue;
      const d = segDist(x, y, e[0], e[1], e[2], e[3]);
      if (d < bd) { bd = d; best = g.id; }
    }
    return best;
  }
  bridgeAt(x: number, y: number): number | null {
    for (const b of this.bridges.values()) if (Math.hypot(x - this.sx(b.wx), y - this.sy(b.wy)) < 6) return b.land;
    return null;
  }

  pointer(e: PointerInfo) {
    if (e.type === "down") this.dragging = false;
    if (e.type === "move" && e.buttons & 1) {
      if (Math.abs(e.dx) + Math.abs(e.dy) > 0) this.dragging = true;
      this.camX += e.dx; this.camY += e.dy;
      return;
    }
    if (e.type === "leave") { this.hoverNode = null; this.hoverGap = null; this.onHover({ node: null, gap: null }); return; }
    const n = this.nodeAt(e.x, e.y);
    const g = n === null ? this.gapAt(e.x, e.y) : null;
    if (n !== this.hoverNode || g !== this.hoverGap) {
      if (n !== null || g) sfx.blip();
      this.hoverNode = n; this.hoverGap = g;
      this.onHover({ node: n, gap: g });
    }
    if (e.type === "click") {
      if (n !== null) this.onPickNode(n);
      else if (g) this.onPickGap(g);
      else { const b = this.bridgeAt(e.x, e.y); if (b !== null) this.onPickBridge(b); }
    }
  }

  wheel(dy: number, x: number, y: number) { this.setZoom(this.zoom + (dy < 0 ? 1 : -1), x, y); }

  setZoom(z: number, x = this.w / 2, y = this.h / 2) {
    const nz = Math.max(1, Math.min(3, z));
    if (nz === this.zoom) return;
    const wx = (x - this.camX) / this.zoom, wy = (y - this.camY) / this.zoom;
    this.zoom = nz;
    this.camX = Math.round(x - wx * nz); this.camY = Math.round(y - wy * nz);
  }
}

function segDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L));
  return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
}

export default function Land({ field, lands, data, selConcept, selGap, onPickNode, onPickGap, onPickLand }: {
  field: FieldId; lands: LandInfo[]; data?: LandData; selConcept: number | null; selGap: string | null;
  onPickNode: (id: number) => void; onPickGap: (id: string) => void; onPickLand: (land: LandInfo) => void;
}) {
  const scene = useMemo(() => new LandScene(field), [field]);
  const [, setView] = useState<View>({ scale: 2, w: 0, h: 0 });
  const [hover, setHover] = useState<{ node: number | null; gap: string | null }>({ node: null, gap: null });
  const [ready, setReady] = useState(0);

  useEffect(() => { if (data) { scene.setData(data, lands); setReady((r) => r + 1); } }, [data, lands, scene]);
  useEffect(() => { scene.selConcept = selConcept; scene.selGap = selGap; }, [scene, selConcept, selGap]);
  useEffect(() => {
    scene.onHover = setHover;
    scene.onPickNode = (id) => { sfx.select(); onPickNode(id); };
    scene.onPickGap = (id) => { sfx.select(); onPickGap(id); };
    scene.onPickBridge = (id) => { const l = lands.find((x) => x.id === id); if (l) { sfx.warp(); onPickLand(l); } };
  });

  // which nodes get a visible text label: big ones + whatever is in focus
  const labelled = useMemo(() => {
    const s = new Set<number>();
    if (!data) return s;
    [...data.nodes].filter((n) => !n.extra).slice(0, 10).forEach((n) => s.add(n.id));   // nodes arrive most-distinctive first
    const focus = hover.node ?? selConcept;
    if (focus !== null) { s.add(focus); for (const gid of data.concept_gaps[String(focus)] || []) { const g = data.gaps.find((x) => x.id === gid); if (g) { s.add(g.u); s.add(g.v); } } }
    for (const gid of [hover.gap, selGap]) { const g = gid && data.gaps.find((x) => x.id === gid); if (g) { s.add(g.u); s.add(g.v); } }
    return s;
  }, [data, hover, selConcept, selGap]);

  // label priority: focused node, selected/hovered gap ends, then by papers
  useEffect(() => {
    if (!data) return;
    const focus = hover.node ?? selConcept;
    const top: number[] = [];
    if (focus !== null) top.push(focus);
    for (const gid of [selGap, hover.gap]) { const g = gid && data.gaps.find((x) => x.id === gid); if (g) top.push(g.u, g.v); }
    const rest = [...labelled].filter((id) => !top.includes(id))
      .sort((a, b) => (data.nodes.find((n) => n.id === b)?.papers ?? 0) - (data.nodes.find((n) => n.id === a)?.papers ?? 0));
    scene.labelPriority = [...top, ...rest];
  }, [data, labelled, hover, selConcept, selGap, scene]);
  const hg = hover.gap ? data?.gaps.find((g) => g.id === hover.gap) : undefined;
  const hn = hover.node !== null ? data?.nodes.find((n) => n.id === hover.node) : undefined;
  void ready;

  return (
    <div className="scene">
      <Stage scene={scene} onView={setView} cursor={hover.node !== null || hover.gap ? "pointer" : "grab"} />
      <div className="overlay">
        {data?.nodes.map((n) => (
          <button key={n.id} ref={(el) => { if (el) scene.els.set(`n${n.id}`, el); else scene.els.delete(`n${n.id}`); }}
            className={`node-label ${labelled.has(n.id) ? "show" : ""} ${n.id === (hover.node ?? selConcept) ? "focus" : ""}`}
            onClick={() => { sfx.select(); onPickNode(n.id); }}
            onMouseEnter={() => { scene.hoverNode = n.id; setHover({ node: n.id, gap: null }); }}
            onMouseLeave={() => { scene.hoverNode = null; setHover({ node: null, gap: null }); }}
            onFocus={() => { scene.hoverNode = n.id; setHover({ node: n.id, gap: null }); }}
            onBlur={() => { scene.hoverNode = null; setHover({ node: null, gap: null }); }}
            aria-label={`${n.name}: ${n.papers} papers`}>
            {n.name}
          </button>
        ))}
        {[...scene.bridges.values()].map((b) => (
          <button key={b.land} ref={(el) => { if (el) scene.els.set(`b${b.land}`, el); }} className="bridge-label"
            onClick={() => { const l = lands.find((x) => x.id === b.land); if (l) onPickLand(l); }}
            aria-label={`Bridge to ${b.name}`}>⇢ {b.name}</button>
        ))}
        {(hn || hg) && (
          <div className="hover-card panel">
            {hn && (<><b>{hn.name}</b><div>{hn.papers.toLocaleString()} papers · {hn.recent} in the last 3 years · linked to {hn.deg} concepts</div><div className="muted">Click for papers and gaps</div></>)}
            {hg && (<><b>PREDICTED GAP</b><div>{hg.u_name} + {hg.v_name}</div>
              <div>RA {hg.ra.toFixed(3)} · {hg.cn} shared neighbours · top {Math.max(0.01, 100 - hg.pct).toFixed(2)}%</div>
              {hg.cross_land && <div className="muted">Bridges {hg.u_land_name} ⇄ {hg.v_land_name}</div>}
              <div className="muted">Click for the maths and proposal</div></>)}
          </div>
        )}
        <div className="legend panel" aria-label="Legend">
          <div className="legend-title">LEGEND</div>
          <div><span className="lg-crystal" />Concept · size = papers</div>
          <div><span className="lg-heat" />Glow = more papers nearby</div>
          <div><span className="lg-solid" />Studied together</div>
          <div><span className="lg-dash" />Predicted gap (never together)</div>
          <div><span className="lg-portal" />Gap to another island</div>
        </div>
        <div className="zoom-ctl">
          <button className="btn sm" onClick={() => scene.setZoom(scene.zoom + 1)} aria-label="Zoom in">+</button>
          <button className="btn sm" onClick={() => scene.setZoom(scene.zoom - 1)} aria-label="Zoom out">−</button>
          <button className="btn sm" onClick={() => scene.resetView()} aria-label="Reset view">⟲</button>
        </div>
        {!data && <div className="loading">SCANNING SECTOR...</div>}
      </div>
    </div>
  );
}
