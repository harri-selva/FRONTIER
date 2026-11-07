// A tiny pixel-art renderer: a low-resolution framebuffer (Uint32 per pixel) that is
// copied to a <canvas> once per frame and scaled up by a whole number by the browser
// with nearest-neighbour sampling (CSS image-rendering: pixelated).

// 4x4 Bayer matrix: the classic ordered-dithering pattern used by 16-bit era games
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x: number, y: number) => BAYER[((y & 3) << 2) | (x & 3)];

/** Pick a colour from a ramp for value v in [0,1], dithering between neighbouring entries. */
export function rampDither(ramp: number[], v: number, x: number, y: number): number {
  const f = Math.max(0, Math.min(0.9999, v)) * (ramp.length - 1);
  const i = Math.floor(f);
  return f - i > bayer(x, y) ? ramp[Math.min(i + 1, ramp.length - 1)] : ramp[i];
}

export class Frame {
  w: number; h: number; buf: Uint32Array; img: ImageData;
  constructor(w: number, h: number) {
    this.w = w; this.h = h;
    this.img = new ImageData(w, h);
    this.buf = new Uint32Array(this.img.data.buffer);
  }
  clear(c: number) { this.buf.fill(c); }
  pset(x: number, y: number, c: number) {
    x |= 0; y |= 0;
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.buf[y * this.w + x] = c;
  }
  get(x: number, y: number) {
    x |= 0; y |= 0;
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.buf[y * this.w + x] : 0;
  }
  rect(x: number, y: number, w: number, h: number, c: number) {
    const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
    const x1 = Math.min(this.w, (x + w) | 0), y1 = Math.min(this.h, (y + h) | 0);
    for (let j = y0; j < y1; j++) this.buf.fill(c, j * this.w + x0, j * this.w + x1);
  }
  /** Bresenham line; `pattern(i)` can return false to skip a pixel (dashes). */
  line(x0: number, y0: number, x1: number, y1: number, c: number, pattern?: (i: number) => number | false) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, i = 0;
    for (;;) {
      if (pattern) { const pc = pattern(i); if (pc !== false) this.pset(x0, y0, pc); } else this.pset(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
      i++;
      if (i > 4000) break;
    }
  }
  /** Filled circle */
  disc(cx: number, cy: number, r: number, c: number) {
    const r2 = r * r;
    for (let y = -Math.ceil(r); y <= Math.ceil(r); y++)
      for (let x = -Math.ceil(r); x <= Math.ceil(r); x++)
        if (x * x + y * y <= r2) this.pset(cx + x, cy + y, c);
  }
  /** Circle outline (midpoint) */
  ring(cx: number, cy: number, r: number, c: number, ry = r) {
    const n = Math.max(12, Math.round(2 * Math.PI * Math.max(r, ry)));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.pset(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * ry), c);
    }
  }
  /** Copy a sprite (with 0 = transparent) at integer position, optional integer zoom. */
  blit(src: Uint32Array, sw: number, sh: number, dx: number, dy: number, zoom = 1) {
    dx |= 0; dy |= 0;
    for (let y = 0; y < sh * zoom; y++) {
      const ty = dy + y; if (ty < 0 || ty >= this.h) continue;
      const sy = (y / zoom) | 0;
      for (let x = 0; x < sw * zoom; x++) {
        const tx = dx + x; if (tx < 0 || tx >= this.w) continue;
        const c = src[sy * sw + ((x / zoom) | 0)];
        if (c) this.buf[ty * this.w + tx] = c;
      }
    }
  }
}

/** Darken a packed colour by mixing with the void colour (used for "dimmed" things). */
export function dim(c: number, k: number): number {
  const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
  const f = 1 - k;
  return ((255 << 24) | (((b * f + 15 * k) | 0) << 16) | (((g * f + 6 * k) | 0) << 8) | ((r * f + 5 * k) | 0)) >>> 0;
}
