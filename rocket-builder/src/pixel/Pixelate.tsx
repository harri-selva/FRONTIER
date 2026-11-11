import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { HEX } from './palette';
import { PX } from './PixelPlanet';

/*
 * Turns a vector (SVG) sprite into 16-bit pixel art:
 *   1. render the SVG at low resolution (container width ÷ PX),
 *   2. snap every pixel to the nearest of the 32 FRONTIER palette colours,
 *   3. hard alpha cut-off (no soft edges),
 *   4. a 1-pixel dark outline, like classic console sprites,
 * then show it scaled up with nearest-neighbour sampling.
 */

const PALETTE = Object.values(HEX).map((h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
});
const OUTLINE = [5, 6, 15] as const;

function nearest(r: number, g: number, b: number): readonly [number, number, number] {
  let best = PALETTE[0]!;
  let bd = Infinity;
  for (const p of PALETTE) {
    // perceptual-ish weights
    const d = 2 * (p[0] - r) ** 2 + 4 * (p[1] - g) ** 2 + 3 * (p[2] - b) ** 2;
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

const cache = new Map<string, ImageData>();
function remember(key: string, img: ImageData) {
  cache.set(key, img);
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
}

function quantize(img: ImageData, outline: boolean): ImageData {
  const { width: w, height: h, data } = img;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3] ?? 0;
    if (a < 120) {
      data[i * 4 + 3] = 0;
      continue;
    }
    solid[i] = 1;
    const [r, g, b] = nearest(data[i * 4] ?? 0, data[i * 4 + 1] ?? 0, data[i * 4 + 2] ?? 0);
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  if (outline) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (solid[i]) continue;
        const near = (x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w]);
        if (near) {
          data[i * 4] = OUTLINE[0];
          data[i * 4 + 1] = OUTLINE[1];
          data[i * 4 + 2] = OUTLINE[2];
          data[i * 4 + 3] = 255;
        }
      }
  }
  return img;
}

interface Props {
  children: ReactNode;
  /** CSS pixels per art pixel. */
  px?: number;
  outline?: boolean;
  className?: string;
  style?: CSSProperties;
  label?: string;
}

export function Pixelate({ children, px = PX, outline = true, className = '', style, label }: Props) {
  const src = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [markup, setMarkup] = useState('');
  const [width, setWidth] = useState(0);

  // Read the SVG markup that React rendered into the hidden source node.
  useLayoutEffect(() => {
    const html = src.current?.innerHTML ?? '';
    if (html !== markup) setMarkup(html);
  });

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !markup || !width) return;
    const m = /viewBox="([-\d.]+)[ ,]+([-\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)"/.exec(markup);
    const vw = m ? Number(m[3]) : 100;
    const vh = m ? Number(m[4]) : 100;
    const W = Math.max(4, Math.round(width / px));
    const H = Math.max(4, Math.round((W * vh) / vw));
    const key = `${W}x${H}|${outline ? 1 : 0}|${markup}`;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const hit = cache.get(key);
    if (hit) {
      cv.width = W;
      cv.height = H;
      ctx.putImageData(hit, 0, 0);
      return;
    }
    let alive = true;
    // Make the markup a standalone image: own namespace, an explicit size, and the outline filters it references.
    // Clean the root tag (drop size/style/class/aria the page added) and give it a pixel size.
    const svg0 = markup.trim();
    const rootEnd = svg0.indexOf('>');
    if (!svg0.startsWith('<svg') || rootEnd < 0) return;
    const root = svg0
      .slice(0, rootEnd)
      .replace(/\s(width|height|style|class|role|aria-[a-z-]+|xmlns)="[^"]*"/g, '');
    let svg = `${root} xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"${svg0.slice(rootEnd)}`;
    svg = svg.replace(/url\(#pp-edge(-thin)?\)/g, '');
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      const off = document.createElement('canvas');
      off.width = W;
      off.height = H;
      const octx = off.getContext('2d');
      if (!octx) return;
      octx.imageSmoothingEnabled = false;
      octx.drawImage(img, 0, 0, W, H);
      const data = quantize(octx.getImageData(0, 0, W, H), outline);
      remember(key, data);
      cv.width = W;
      cv.height = H;
      ctx.putImageData(data, 0, 0);
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return () => {
      alive = false;
    };
  }, [markup, width, px, outline]);

  return (
    <span ref={wrap} className={`relative block ${className}`} style={style} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <div ref={src} hidden aria-hidden="true">
        {children}
      </div>
      <canvas ref={canvas} className="pixelated block h-auto w-full" />
    </span>
  );
}

/** Wrap a vector sprite component so it always renders as pixel art. */
export function pixelated<P extends { className?: string; style?: CSSProperties; title?: string }>(Comp: (p: P) => JSX.Element, px?: number) {
  const Wrapped = (props: P) => {
    const { className, style, title, ...rest } = props;
    return (
      <Pixelate px={px} className={className} style={style} label={title}>
        <Comp {...(rest as P)} />
      </Pixelate>
    );
  };
  Wrapped.displayName = `Pixelated(${Comp.name})`;
  return Wrapped;
}
