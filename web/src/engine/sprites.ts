// Procedural, ORIGINAL pixel art: planets, islands and water.
// Nothing here is copied from any game or reference image; everything is generated
// from noise functions and the FRONTIER palette.
import { C, RAMP } from "./palette";
import { Frame, bayer, rampDither, dim } from "./pixel";
import { fbm2, fbm3, rng } from "./noise";

// ---------------------------------------------------------------------------
// Planets: an equirectangular surface texture wrapped onto a shaded sphere
// ---------------------------------------------------------------------------
export type PlanetKind =
  | "oceanGreen" | "oceanGold" | "gas" | "ice" | "lava" | "crater" | "violet" | "toxic" | "storm" | "desert" | "ringedGas" | "ringedIce";

const TEX_W = 128, TEX_H = 64;

export interface PlanetSprite { kind: PlanetKind; tex: Float32Array; ramp: number[]; ring: boolean; seed: number }

export function makePlanet(kind: PlanetKind, seed: number): PlanetSprite {
  const tex = new Float32Array(TEX_W * TEX_H);
  for (let j = 0; j < TEX_H; j++) {
    const lat = (j / TEX_H - 0.5) * Math.PI;
    for (let i = 0; i < TEX_W; i++) {
      const lon = (i / TEX_W) * Math.PI * 2;
      const x = Math.cos(lat) * Math.cos(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.sin(lon);
      let v: number;
      switch (kind) {
        case "gas": case "ringedGas": case "violet":
          v = 0.5 + 0.35 * Math.sin(y * 9 + 3 * fbm3(x * 2, y * 2, z * 2, seed, 3)) + 0.15 * (fbm3(x * 4, y * 8, z * 4, seed + 3, 3) - 0.5);
          break;
        case "storm":
          v = 0.45 + 0.3 * Math.sin(y * 14 + 4 * fbm3(x * 1.5, y * 3, z * 1.5, seed, 3));
          { const dx = lon - 2.0, dy = lat - 0.35; if (dx * dx * 0.6 + dy * dy * 6 < 0.12) v = 0.95 - (dx * dx * 0.6 + dy * dy * 6) * 3; }
          break;
        case "crater": {
          v = 0.45 + 0.4 * (fbm3(x * 3, y * 3, z * 3, seed, 4) - 0.5);
          const r2 = rng(seed);
          for (let k = 0; k < 14; k++) {
            const cl = r2() * Math.PI * 2, ca = (r2() - 0.5) * 2.4, cr = 0.06 + r2() * 0.18;
            const cx = Math.cos(ca) * Math.cos(cl), cy = Math.sin(ca), cz = Math.cos(ca) * Math.sin(cl);
            const d = Math.hypot(x - cx, y - cy, z - cz);
            if (d < cr) v = d > cr * 0.75 ? 0.9 : 0.2 + d;
          }
          break;
        }
        case "lava":
          v = fbm3(x * 3, y * 3, z * 3, seed, 4);
          v = Math.abs(v - 0.5) < 0.035 ? 0.95 : v * 0.5;
          break;
        case "ice": case "ringedIce":
          v = 0.6 + 0.4 * fbm3(x * 2.5, y * 2.5, z * 2.5, seed, 4) - (Math.abs(fbm3(x * 5, y * 5, z * 5, seed + 9, 2) - 0.5) < 0.02 ? 0.5 : 0);
          break;
        case "toxic": case "desert":
          v = fbm3(x * 2.2, y * 2.2, z * 2.2, seed, 5);
          break;
        default: { // ocean worlds: continents + clouds
          const land = fbm3(x * 1.8, y * 1.8, z * 1.8, seed, 5);
          const cloud = fbm3(x * 3 + 7, y * 6, z * 3, seed + 5, 4);
          v = land > 0.53 ? 0.55 + (land - 0.53) * 2 : land * 0.85;
          if (cloud > 0.62) v = 1.5; // marker for cloud
        }
      }
      tex[j * TEX_W + i] = v;
    }
  }
  const rampFor: Record<PlanetKind, number[]> = {
    oceanGreen: [C.oceanDeep, C.ocean, C.shallow, C.grassDark, C.grass, C.grassLight],
    oceanGold: [C.navy2, C.indigo, C.ocean, C.sandDark, C.gold, C.cream],
    gas: RAMP.gas, ringedGas: [C.purple1, C.magenta, C.orange, C.gold, C.cream], violet: RAMP.violetGas,
    storm: RAMP.storm, crater: RAMP.crater, lava: RAMP.lava, ice: RAMP.ice, ringedIce: RAMP.ice,
    toxic: RAMP.toxic, desert: RAMP.desert,
  };
  return { kind, tex, ramp: rampFor[kind], ring: kind.startsWith("ringed"), seed };
}

/**
 * Draw a planet of radius r centred at (cx,cy). rot = rotation (radians).
 * light = direction to the light (screen space, normalised). glow = live planets pulse.
 */
export function drawPlanet(f: Frame, p: PlanetSprite, cx: number, cy: number, r: number, rot: number,
  light: [number, number, number], dimK = 0, glow = 0) {
  const R = Math.max(2, r);
  const ringBack = p.ring, tilt = 0.32;
  if (ringBack) drawRing(f, cx, cy, R, tilt, true, dimK);
  // atmosphere glow for live planets
  if (glow > 0) {
    for (let a = 0; a < 2; a++) f.ring(cx, cy, R + 2 + a, dim(a ? C.cyan : C.teal, 0.2 + 0.6 * (1 - glow)));
  }
  const [lx, ly, lz] = light;
  for (let y = -Math.ceil(R); y <= Math.ceil(R); y++) {
    for (let x = -Math.ceil(R); x <= Math.ceil(R); x++) {
      const d2 = (x * x + y * y) / (R * R);
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2), nx = x / R, ny = y / R;
      const lat = Math.asin(-ny), lon = Math.atan2(nx, nz) + rot;
      const u = ((lon / (Math.PI * 2)) % 1 + 1) % 1, v = lat / Math.PI + 0.5;
      const t = p.tex[Math.min(TEX_H - 1, (v * TEX_H) | 0) * TEX_W + ((u * TEX_W) | 0)];
      const lam = Math.max(0, nx * lx + ny * ly + nz * lz);
      const shade = 0.18 + 0.82 * lam;
      const px = cx + x, py = cy + y;
      let c: number;
      if (t > 1.2) c = shade > 0.35 ? (shade > bayer(px, py) * 0.6 + 0.45 ? C.white : C.slateLight) : C.slate;
      else c = rampDither(p.ramp, Math.min(1, t) * (0.35 + 0.65 * shade) + (shade - 0.5) * 0.25, px, py);
      // night side: dither towards dark
      if (lam < 0.08 && bayer(px, py) > lam * 8) c = dim(c, 0.65);
      // rim light
      if (d2 > 0.86 && lam > 0.2 && bayer(px, py) > 0.5) c = C.cream;
      f.pset(px, py, dimK ? dim(c, dimK) : c);
    }
  }
  if (ringBack) drawRing(f, cx, cy, R, tilt, false, dimK);
}

function drawRing(f: Frame, cx: number, cy: number, R: number, tilt: number, back: boolean, dimK: number) {
  for (let k = 0; k < 3; k++) {
    const rr = R * (1.45 + k * 0.17);
    const n = Math.round(rr * 7);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = Math.sin(a);
      if (back ? s > 0 : s <= 0) continue;
      const x = Math.round(cx + Math.cos(a) * rr), y = Math.round(cy + s * rr * tilt);
      const col = [C.cream, C.gold, C.sandDark][k];
      if (!back && Math.hypot(x - cx, y - cy) < R && s < 0) { /* in front of planet: always draw */ }
      if (back && Math.hypot(x - cx, y - cy) < R) continue;
      f.pset(x, y, dimK ? dim(col, dimK) : col);
    }
  }
}

// ---------------------------------------------------------------------------
// Islands: height-map terrain with cliffs, beaches, reefs and a drop shadow
// ---------------------------------------------------------------------------
export interface IslandSprite {
  w: number; h: number; ox: number; oy: number;   // sprite size + offset of the island centre
  px: Uint32Array;          // terrain pixels (0 = transparent)
  mask: Uint8Array;         // 1 = land (top surface)
  reef: Uint8Array;         // 1 = shallow water ring around the island
  coast: Int32Array;        // indices of water pixels touching land (for animated surf)
  radius: number;
}

export interface IslandStyle { grass: number[]; sand: number; sandDark: number; cliff: number; cliffDark: number; peak: number }
export const STYLE_MED: IslandStyle = { grass: [C.grassDark, C.grass, C.grassLight], sand: C.sand, sandDark: C.sandDark, cliff: C.sandDark, cliffDark: C.rust, peak: C.foam };
export const STYLE_QUANT: IslandStyle = { grass: [C.purple1, C.violet, C.lavender], sand: C.cream, sandDark: C.gold, cliff: C.sandDark, cliffDark: C.purple0, peak: C.cream };

/** Generate an island of radius R (pixels). Deterministic for a seed. */
export function makeIsland(R: number, seed: number, style: IslandStyle, cliffH = 3): IslandSprite {
  const pad = Math.ceil(R * 0.25) + 6 + cliffH;
  const w = Math.ceil(R * 2 + pad * 2), h = Math.ceil(R * 2 + pad * 2 + cliffH);
  const ox = Math.floor(w / 2), oy = Math.floor(R + pad);
  const height = new Float32Array(w * h);
  const s = 2.2 / Math.max(R, 8);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - ox) / R, dy = (y - oy) / R;
    const ang = Math.atan2(dy, dx);
    const edge = 0.82 + 0.28 * (fbm2(Math.cos(ang) * 1.6 + seed, Math.sin(ang) * 1.6, seed, 3) - 0.5) * 2;
    const d = Math.hypot(dx, dy) / edge;
    const n = fbm2(x * s * 1.3 + seed * 7, y * s * 1.3, seed + 1, 4);
    height[y * w + x] = (1 - d) * 0.95 + (n - 0.5) * 0.55;
  }
  const px = new Uint32Array(w * h), mask = new Uint8Array(w * h), reef = new Uint8Array(w * h);
  const H = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : height[y * w + x]);
  // 1) drop shadow + cliff (pseudo-3D): land extruded downwards by cliffH pixels
  for (let y = h - 1; y >= 0; y--) for (let x = 0; x < w; x++) {
    for (let k = 1; k <= cliffH; k++) {
      if (H(x, y - k) > 0 && !(H(x, y) > 0)) {
        px[y * w + x] = k === cliffH ? style.cliffDark : (bayer(x, y) > 0.5 ? style.cliff : style.cliffDark);
        break;
      }
    }
  }
  // 2) top surface with light from the north-west
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = height[y * w + x];
    if (v <= 0) continue;
    mask[y * w + x] = 1;
    const slope = (H(x - 1, y - 1) - H(x + 1, y + 1)) * 6;
    let c: number;
    if (v < 0.07) c = bayer(x, y) < 0.5 - slope ? style.sand : style.sandDark;
    else if (v < 0.75) c = rampDither(style.grass, Math.min(1, 0.25 + v * 0.7 + slope), x, y);
    else c = rampDither([style.grass[0], C.slate, C.slateLight, style.peak], Math.min(1, (v - 0.72) * 2.4 + slope + 0.3), x, y);
    px[y * w + x] = c;
  }
  // 3) reef ring (shallow water) and coast list
  const coast: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (mask[i] || px[i]) continue;
    const v = height[i];
    if (v > -0.12) reef[i] = 1;
    if (mask[i - 1] || mask[i + 1] || (y > 0 && mask[i - w]) || (y < h - 1 && mask[i + w])) coast.push(i);
  }
  return { w, h, ox, oy, px, mask, reef, coast: Int32Array.from(coast), radius: R };
}

/** Outline pixels (water pixels next to land) as a highlight, e.g. for hover. */
export function drawIslandOutline(f: Frame, isl: IslandSprite, x0: number, y0: number, c: number) {
  for (const i of isl.coast) f.pset(x0 + (i % isl.w), y0 + ((i / isl.w) | 0), c);
}

/** Draw island with reef, animated surf and optional shoreline glow. */
export function drawIsland(f: Frame, isl: IslandSprite, cx: number, cy: number, t: number, opts: { glow?: number; seed?: number } = {}) {
  const x0 = (cx - isl.ox) | 0, y0 = (cy - isl.oy) | 0;
  // shadow + reef
  for (let y = 0; y < isl.h; y++) for (let x = 0; x < isl.w; x++) {
    const i = y * isl.w + x;
    if (isl.reef[i]) {
      const X = x0 + x, Y = y0 + y;
      const under = f.get(X, Y);
      if (under) f.pset(X, Y, bayer(X, Y) > 0.35 ? C.shallow : C.reef);
    }
  }
  f.blit(isl.px, isl.w, isl.h, x0, y0);
  // animated surf on the coast
  const seed = opts.seed || 0;
  for (let k = 0; k < isl.coast.length; k++) {
    const i = isl.coast[k];
    const x = i % isl.w, y = (i / isl.w) | 0;
    const ph = Math.sin(x * 0.7 + y * 0.45 + t * 2.4 + seed) + Math.sin(k * 0.13 - t * 1.3);
    if (ph > 0.35) f.pset(x0 + x, y0 + y, ph > 1.2 ? C.white : C.foam);
    else if (opts.glow && ph > -0.6) f.pset(x0 + x, y0 + y, (k + Math.floor(t * 6)) % 3 ? C.gold : C.cream);
  }
}

// ---------------------------------------------------------------------------
// Water: animated pixel ocean
// ---------------------------------------------------------------------------
export function drawOcean(f: Frame, t: number, deep: number[], camX = 0, camY = 0, tint = 0) {
  const { w, h, buf } = f;
  for (let y = 0; y < h; y++) {
    const wy = y + camY;
    const base = 0.25 + 0.25 * Math.sin(wy * 0.02 + tint);
    for (let x = 0; x < w; x++) {
      const wx = x + camX;
      const wave = Math.sin(wx * 0.11 + t * 1.1 + Math.sin(wy * 0.07 + t * 0.6) * 2.2) + Math.sin(wy * 0.23 - t * 0.9 + wx * 0.02);
      let v = base + wave * 0.12;
      let c = rampDither(deep, v, wx, wy);
      if (wave > 1.75 && ((wx + wy) & 1)) c = C.shallow;
      if (wave > 1.93) c = C.foam;
      buf[y * w + x] = c;
    }
  }
}

/** Water droplets: falling drop then an expanding ripple ring. */
export interface Drop { x: number; y: number; t0: number; life: number; big: boolean }
export function updateDrops(drops: Drop[], t: number, w: number, h: number, rate: number, r: () => number) {
  for (let i = drops.length - 1; i >= 0; i--) if (t - drops[i].t0 > drops[i].life) drops.splice(i, 1);
  if (r() < rate) drops.push({ x: r() * w, y: r() * h, t0: t, life: 1.6 + r() * 0.8, big: r() < 0.25 });
}
export function drawDrops(f: Frame, drops: Drop[], t: number, isWater: (x: number, y: number) => boolean) {
  for (const d of drops) {
    const a = t - d.t0;
    if (a < 0.35) {          // falling drop with a short trail
      const yy = d.y - (0.35 - a) * 40;
      f.pset(d.x, yy, C.foam); f.pset(d.x, yy - 1, C.reef); if (d.big) f.pset(d.x, yy - 2, C.shallow);
    } else {                // splash + ripples
      const k = a - 0.35;
      if (!isWater(d.x | 0, d.y | 0)) continue;
      if (k < 0.25) { f.pset(d.x - 1, d.y - 2, C.foam); f.pset(d.x + 1, d.y - 2, C.foam); f.pset(d.x, d.y - 3, C.white); }
      const rr = 1 + k * (d.big ? 7 : 4.5);
      f.ring(d.x, d.y, rr, k < 0.6 ? C.foam : C.reef, rr * 0.45);
      if (d.big && k > 0.3) f.ring(d.x, d.y, rr * 0.55, C.reef, rr * 0.25);
    }
  }
}

// ---------------------------------------------------------------------------
// Pixel clouds that drift over the ocean (with a shadow below: depth cue)
// ---------------------------------------------------------------------------
export function makeCloud(seed: number, w = 46, h = 16): { w: number; h: number; px: Uint32Array; shadow: Uint8Array } {
  const px = new Uint32Array(w * h), shadow = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - w / 2) / (w / 2), dy = (y - h / 2) / (h / 2);
    const v = 1 - (dx * dx + dy * dy * 1.6) + (fbm2(x * 0.18 + seed, y * 0.3, seed, 3) - 0.5) * 1.1;
    if (v > 0.15) {
      px[y * w + x] = v > 0.5 ? C.white : (bayer(x, y) < v * 1.6 ? C.foam : C.slateLight);
      shadow[y * w + x] = 1;
    }
  }
  return { w, h, px, shadow };
}
