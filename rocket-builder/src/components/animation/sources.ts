import type { ClipName } from '../../engine';

/**
 * Finds the hand-drawn animation files in public/animations/.
 *
 * Drop-in, no code changes: name a file after its clip and it is picked up.
 *   takeoff.webm | takeoff.mp4      → video
 *   takeoff.gif | .webp | .png      → animated image (duration from manifest, default 4 s)
 *   takeoff.json                    → Lottie animation
 *   takeoff/frames.json             → PNG frame sequence, e.g. {"fps": 12, "frames": ["0001.png", ...]}
 * Optional public/animations/manifest.json overrides any of these:
 *   { "takeoff": { "src": "my-takeoff.mp4" }, "explosion": { "src": "boom.gif", "durationMs": 3000 } }
 */
export type ClipSource =
  | { kind: 'video'; src: string }
  | { kind: 'image'; src: string; durationMs: number }
  | { kind: 'lottie'; src: string }
  | { kind: 'frames'; urls: string[]; fps: number }
  | { kind: 'placeholder' };

const BASE = `${import.meta.env.BASE_URL}animations/`;
const DEFAULT_IMAGE_MS = 4000;

interface ManifestEntry {
  src?: string;
  durationMs?: number;
  fps?: number;
  frames?: string[];
}
type Manifest = Partial<Record<ClipName, ManifestEntry>>;

async function head(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
    if (!res.ok) return null;
    return res.headers.get('content-type') ?? '';
  } catch {
    return null;
  }
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    // Dev servers answer missing files with index.html (text/html), so check the type.
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function fromPath(src: string, type: string, entry?: ManifestEntry): ClipSource | null {
  const url = src.startsWith('http') || src.startsWith('/') ? src : BASE + src;
  const ext = src.split('.').pop()?.toLowerCase() ?? '';
  if (type.startsWith('video/') || ext === 'mp4' || ext === 'webm') return { kind: 'video', src: url };
  if (type.startsWith('image/') || ['gif', 'webp', 'png', 'apng'].includes(ext))
    return { kind: 'image', src: url, durationMs: entry?.durationMs ?? DEFAULT_IMAGE_MS };
  if (type.includes('json') || ext === 'json') return { kind: 'lottie', src: url };
  return null;
}

let manifestPromise: Promise<Manifest> | null = null;
const cache = new Map<ClipName, Promise<ClipSource>>();

async function resolve(clip: ClipName): Promise<ClipSource> {
  manifestPromise ??= getJson<Manifest>(`${BASE}manifest.json`).then((m) => m ?? {});
  const manifest = await manifestPromise;
  const entry = manifest[clip];
  if (entry?.frames && entry.frames.length > 0) {
    return { kind: 'frames', urls: entry.frames.map((f) => (f.startsWith('/') ? f : BASE + f)), fps: entry.fps ?? 12 };
  }
  if (entry?.src) {
    const type = (await head(entry.src.startsWith('/') ? entry.src : BASE + entry.src)) ?? '';
    const s = fromPath(entry.src, type, entry);
    if (s) return s;
  }
  for (const ext of ['webm', 'mp4', 'gif', 'webp', 'png']) {
    const type = await head(`${BASE}${clip}.${ext}`);
    if (type && !type.includes('text/html')) {
      const s = fromPath(`${clip}.${ext}`, type, entry);
      if (s) return s;
    }
  }
  const lottieType = await head(`${BASE}${clip}.json`);
  if (lottieType && lottieType.includes('json')) return { kind: 'lottie', src: `${BASE}${clip}.json` };
  const frames = await getJson<{ fps?: number; frames?: string[] }>(`${BASE}${clip}/frames.json`);
  if (frames?.frames && frames.frames.length > 0) {
    return { kind: 'frames', urls: frames.frames.map((f) => `${BASE}${clip}/${f}`), fps: frames.fps ?? 12 };
  }
  return { kind: 'placeholder' };
}

export function findClip(clip: ClipName): Promise<ClipSource> {
  let p = cache.get(clip);
  if (!p) {
    p = resolve(clip);
    cache.set(clip, p);
  }
  return p;
}

/** Start probing all three clips early (e.g. during the countdown). */
export function preloadClips(): void {
  (['takeoff', 'explosion', 'orbit_arrival'] as const).forEach((c) => void findClip(c));
}
