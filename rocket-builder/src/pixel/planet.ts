// Planet renderer copied from the FRONTIER site (web/src/engine/sprites.ts):
// a procedural surface texture wrapped onto a dithered, shaded pixel sphere.
import { C, RAMP } from "./palette";
import { Frame, bayer, rampDither, dim } from "./pixel";
import { fbm3, rng } from "./noise";

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
      const t = p.tex[Math.min(TEX_H - 1, (v * TEX_H) | 0) * TEX_W + ((u * TEX_W) | 0)] ?? 0;
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
      const col = [C.cream, C.gold, C.sandDark][k] ?? C.cream;
      if (!back && Math.hypot(x - cx, y - cy) < R && s < 0) { /* in front of planet: always draw */ }
      if (back && Math.hypot(x - cx, y - cy) < R) continue;
      f.pset(x, y, dimK ? dim(col, dimK) : col);
    }
  }
}

