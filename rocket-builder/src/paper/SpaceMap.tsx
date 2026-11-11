/*
 * Zoomable 3D paper star map: planetary system → solar neighbourhood →
 * Milky Way → Local Group. A tilted paper "table" holds the map; stars and
 * galaxies stand up on it as billboards, on stalks whose length is their real
 * height above or below the galactic plane.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { useReducedMotion } from '../components/useReducedMotion';
import { DIFFICULTY_SETS } from '../data/difficulty-sets';
import { findPlanet } from '../data/planets';
import {
  AU_PER_SOLAR_RADIUS,
  GALAXIES,
  LY_PER_PC,
  MW_DISC_RADIUS_KPC,
  SUN_GC_KPC,
  SYSTEMS,
  galacticXYZ,
  galactocentricKpc,
  julianDate,
  orbitPhase,
  starColor,
  type StarSystem,
} from '../data/space';
import type { Difficulty } from '../engine';
import { sfx } from './sfx';
import { Icon, PlanetSprite } from './sprites';
import { Pixelate } from '../pixel/Pixelate';

export type MapLevel = 'system' | 'neighbourhood' | 'galaxy' | 'local';
const LEVELS: MapLevel[] = ['system', 'neighbourhood', 'galaxy', 'local'];
/** Half the table's width in cqmin (the table is 2 × HALF wide). */
const HALF = 60;
const LEVEL_NAME: Record<MapLevel, string> = {
  system: 'Star system',
  neighbourhood: 'Our star neighbourhood',
  galaxy: 'Milky Way',
  local: 'Nearby galaxies',
};

const fmt = (n: number, dp = 0) => n.toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: dp });
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
};

interface Ctx {
  spin: number;
  tilt: number;
}

/** Something standing on the map at plane position (u, v) ∈ [-1, 1], height h in the same units. */
function Pin({ u, v, h = 0, ctx, children, stalk = true }: { u: number; v: number; h?: number; ctx: Ctx; children: ReactNode; stalk?: boolean }) {
  const up = h * HALF; // cqmin
  return (
    <div className="absolute" style={{ left: `${50 + u * 50}%`, top: `${50 + v * 50}%`, transformStyle: 'preserve-3d' }}>
      {/* shadow spot on the table */}
      <div className="absolute h-[1.4cqmin] w-[1.4cqmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#160b36]/60" />
      {stalk && Math.abs(up) > 0.3 && (
        <div
          className="absolute left-0 top-0 w-[0.35cqmin] bg-[#fff8ef]/70"
          style={{
            height: `${Math.abs(up)}cqmin`,
            transformOrigin: '0 0',
            transform: `rotateX(${up > 0 ? 90 : -90}deg)`,
            marginLeft: '-0.17cqmin',
          }}
        />
      )}
      <div style={{ transformStyle: 'preserve-3d', transform: `translateZ(${up}cqmin) rotateZ(${-ctx.spin}deg) rotateX(${-ctx.tilt}deg)` }}>
        {children}
      </div>
    </div>
  );
}

/**
 * Label anchor. The visible label is drawn by <LabelLayer> in flat 2D on top
 * of the map, at the anchor's projected position, so 3D depth sorting can
 * never hide it behind the table.
 */
function Tag({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  const text = Array.isArray(children) ? children.join('') : String(children);
  return <span data-map-label={text} data-strong={strong ? '1' : undefined} className="pointer-events-none absolute bottom-full left-1/2 block h-0 w-0" aria-hidden="true" />;
}

/** Draws every Tag's text in a flat overlay, following the 3D anchors each frame. */
function LabelLayer({ stage }: { stage: React.RefObject<HTMLDivElement> }) {
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const st = stage.current;
      const ly = layer.current;
      if (st && ly) {
        const box = st.getBoundingClientRect();
        const anchors = Array.from(st.querySelectorAll<HTMLElement>('[data-map-label]'));
        while (ly.children.length < anchors.length) {
          const el = document.createElement('span');
          el.className = 'map-label';
          ly.appendChild(el);
        }
        while (ly.children.length > anchors.length) ly.lastChild?.remove();
        // Place labels nearest-first (lowest on screen first) and nudge overlapping ones upward.
        const items = anchors.map((a, i) => {
          const el = ly.children[i] as HTMLElement;
          const text = a.dataset.mapLabel ?? '';
          if (el.textContent !== text) el.textContent = text;
          el.dataset.strong = a.dataset.strong ?? '';
          const r = a.getBoundingClientRect();
          return { el, x: r.left - box.left, y: r.top - box.top, w: el.offsetWidth, h: el.offsetHeight, strong: a.dataset.strong === '1' };
        });
        items.sort((p, q) => Number(q.strong) - Number(p.strong) || q.y - p.y);
        const placed: { l: number; r: number; t: number; b: number }[] = [];
        for (const it of items) {
          let top = it.y - it.h - 4;
          const l = it.x - it.w / 2;
          const r = it.x + it.w / 2;
          for (let tries = 0; tries < 6; tries++) {
            const hit = placed.find((p) => l < p.r + 4 && r > p.l - 4 && top < p.b + 2 && top + it.h > p.t - 2);
            if (!hit) break;
            top = hit.t - it.h - 3;
          }
          placed.push({ l, r, t: top, b: top + it.h });
          it.el.style.transform = `translate(${l.toFixed(1)}px, ${top.toFixed(1)}px)`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage]);
  return <div ref={layer} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" />;
}

function StarDot({ teff, size, label, onClick, highlight, children }: { teff: number | null; size: number; label: string; onClick?: () => void; highlight?: boolean; children?: ReactNode }) {
  const c = starColor(teff);
  // 16-bit star: a 7×7 pixel cross with a white core and a dark outline.
  const rows = ['..ooo..', '.ogggo.', 'oggcggo', 'ogcwcgo', 'oggcggo', '.ogggo.', '..ooo..'];
  const col: Record<string, string> = { o: '#05060f', g: c.glow, c: c.fill, w: '#ffffff' };
  const body = (
    <svg
      viewBox="0 0 7 7"
      shapeRendering="crispEdges"
      className={`block ${highlight ? 'anim-twinkle' : ''}`}
      style={{ width: `${size * 1.2}cqmin`, height: `${size * 1.2}cqmin` }}
      aria-hidden="true"
    >
      {rows.flatMap((r, y) => [...r].map((ch, x) => (ch === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={col[ch]} />)))}
    </svg>
  );
  return (
    <div className="relative -translate-x-1/2 -translate-y-full">
      {onClick ? (
        <button type="button" onClick={onClick} aria-label={label} className="block">
          {body}
        </button>
      ) : (
        body
      )}
      {children}
    </div>
  );
}

/** Logarithmic-spiral galaxy cut-out (an illustration). */
function spiralArm(theta0: number, turns = 1.35, pitchDeg = 13): string {
  const b = Math.tan((pitchDeg * Math.PI) / 180);
  const a = 14;
  let d = '';
  for (let i = 0; i <= 60; i++) {
    const t = (i / 60) * turns * Math.PI * 2;
    const r = a * Math.exp(b * t);
    if (r > 96) break;
    const x = r * Math.cos(t + theta0);
    const y = r * Math.sin(t + theta0);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d;
}
const ARMS = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((t) => spiralArm(t));
const SPECKS = Array.from({ length: 46 }, (_, i) => {
  const t = i * 2.399;
  const r = 18 + ((i * 37) % 76);
  return { x: r * Math.cos(t), y: r * Math.sin(t), s: 1 + (i % 3) * 0.7 };
});

function SpiralGalaxy({ size, hue = 'pink', flat = false, detailed = false }: { size: number; hue?: 'pink' | 'lilac' | 'sky'; flat?: boolean; detailed?: boolean }) {
  return (
    <Pixelate outline={!flat} style={{ width: `${size}cqmin`, animation: 'galaxy-spin 160s linear infinite' }}>
      <SpiralGalaxySvg size={size} hue={hue} flat={flat} detailed={detailed} />
    </Pixelate>
  );
}

function SpiralGalaxySvg({ size, hue = 'pink', flat = false, detailed = false }: { size: number; hue?: 'pink' | 'lilac' | 'sky'; flat?: boolean; detailed?: boolean }) {
  const arm = hue === 'pink' ? '#ff9fd3' : hue === 'lilac' ? '#c9b6ff' : '#a8dcff';
  const arm2 = hue === 'pink' ? '#ffd0ea' : hue === 'lilac' ? '#ffb7e1' : '#e6dcff';
  return (
    <svg viewBox="-100 -100 200 200" style={{ width: `${size}cqmin`, height: `${size}cqmin`, display: 'block', overflow: 'visible' }} aria-hidden="true" className={flat ? '' : 'sprite'}>
      <g>
        <circle r="98" fill={arm} opacity=".12" />
        {ARMS.map((d, i) => (
          <g key={i}>
            <path d={d} fill="none" stroke={arm} strokeWidth={detailed ? 16 : 12} strokeLinecap="round" opacity=".55" />
            <path d={d} fill="none" stroke={i % 2 ? arm2 : arm} strokeWidth={detailed ? 7 : 6} strokeLinecap="round" filter="url(#pp-edge-thin)" />
          </g>
        ))}
        {detailed && SPECKS.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.s} fill="#fff8ef" opacity=".85" />)}
        <ellipse rx="26" ry="11" fill="#ffe07a" transform="rotate(28)" filter="url(#pp-edge-thin)" />
        <circle r="13" fill="#fff3c4" />
      </g>
    </svg>
  );
}

function Blob({ size, color }: { size: number; color: string }) {
  return (
    <Pixelate style={{ width: `${size}cqmin` }}>
      <BlobSvg size={size} color={color} />
    </Pixelate>
  );
}

function BlobSvg({ size, color }: { size: number; color: string }) {
  return (
    <svg viewBox="-50 -50 100 100" style={{ width: `${size}cqmin`, height: `${size}cqmin`, display: 'block' }} aria-hidden="true" className="sprite">
      <path filter="url(#pp-edge-thin)" fill={color} d="M-30 -10 C-34 -34 2 -42 18 -28 C40 -30 44 -2 30 12 C34 34 2 40 -12 30 C-38 34 -44 8 -30 -10Z" />
      <circle cx="-6" cy="-4" r="9" fill="#fff8ef" opacity=".6" />
    </svg>
  );
}

/* ---------------- Levels ---------------- */

/** Scale and framing for a star system: true-scale orbits, zoomed to keep the chosen planet readable. */
function systemLayout(sys: StarSystem, selected: string | null) {
  const planets = sys.planets.filter((p) => p.aAu !== null) as (StarSystem['planets'][number] & { aAu: number })[];
  const sel = planets.find((p) => p.name === selected) ?? planets[0];
  const aMax = Math.max(...planets.map((p) => p.aAu));
  let k = 0.9 / aMax;
  if (sel && sel.aAu * k < 0.18) k = 0.5 / sel.aAu;
  const outside = planets.filter((p) => p.aAu * k > 1.02).map((o) => `${o.name} (${o.aAu} AU)`);
  // Star radius to the same scale as the orbits; enlarged only if it would be too small to see.
  const starTrue = (sys.starRadiusSun ?? 0.5) * AU_PER_SOLAR_RADIUS * k;
  const starSize = Math.max(starTrue * 2 * HALF, 4.2);
  const enlarged = starTrue * 2 * HALF < 4.2;
  const selP = sel?.periodDays ?? 1;
  const base = 10; // seconds per orbit for the chosen planet
  return { planets, sel, k, outside, starSize, enlarged, selP, base, perSecondDays: selP / base };
}

function systemCaptionText(sys: StarSystem, selected: string | null, reduced: boolean): string {
  const L = systemLayout(sys, selected);
  const hrs = L.perSecondDays * 24;
  return `Orbit sizes are to scale. Planets are drawn much bigger than real${L.enlarged ? ', and so is the star' : ''}. ${
    reduced ? 'Showing where the planets are today.' : `They start where they are today; 1 second here ≈ ${hrs < 48 ? `${fmt(hrs, 1)} hours` : `${fmt(L.perSecondDays, 1)} days`} there.`
  } A dashed orbit or “?” means that planet’s place on its orbit isn’t known.${L.outside.length ? ` Off the edge: ${L.outside.join(', ')}.` : ''}`;
}

function SystemLevel({ sys, selected, ctx, choosable, onPick, reduced }: { sys: StarSystem; selected: string | null; ctx: Ctx; choosable: Set<string>; onPick: (n: string) => void; reduced: boolean }) {
  const { planets, sel, k, selP, base, starSize } = systemLayout(sys, selected);
  const jd = useMemo(() => julianDate(Date.now()), []);

  return (
    <>
      {/* orbits */}
      {planets.map((p) => {
        const r = p.aAu * k;
        if (r > 1.6) return null;
        const ph = orbitPhase(p, jd);
        return (
          <div
            key={`o-${p.name}`}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: `${r * 100}%`,
              height: `${r * 100}%`,
              transform: 'translate(-50%,-50%)',
              border: `${p.name === sel?.name ? 0.55 : 0.3}cqmin ${ph.known ? 'solid' : 'dashed'} ${p.name === sel?.name ? '#ffe07a' : 'rgba(255,248,239,.45)'}`,
            }}
          />
        );
      })}
      {/* toward Earth */}
      <div className="absolute left-1/2 top-[97%] -translate-x-1/2 text-center" style={{ transform: 'translateX(-50%) rotateX(0deg)' }}>
        <span className="rounded-md bg-butter px-2 py-0.5 text-[clamp(10px,1.9cqmin,14px)] font-extrabold text-ink">↓ Toward Earth</span>
      </div>
      {/* star */}
      <Pin u={0} v={0} ctx={ctx} stalk={false}>
        <StarDot teff={sys.starTeffK} size={starSize} label={sys.host}>
          <Tag strong>{sys.host}</Tag>
        </StarDot>
      </Pin>
      {/* planets on their orbits, placed where they are today */}
      {planets.map((p) => {
        const r = p.aAu * k;
        if (r > 1.6) return null;
        const ph = orbitPhase(p, jd);
        const a0 = ph.known ? 90 - ph.phase * 360 : hash(p.name) % 360;
        const dur = Math.max(2, base * ((p.periodDays ?? selP) / selP));
        const isSel = p.name === sel?.name;
        const canPick = choosable.has(p.name);
        const size = Math.min(9, 3 + Math.log2(1 + (p.radiusRe ?? 1)) * 1.6) * (isSel ? 1.35 : 1);
        const planet = findPlanet(p.name);
        const spinStyle: CSSProperties = {
          ['--a0' as string]: `${a0}deg`,
          animation: `map-orbit ${dur}s linear infinite`,
          animationPlayState: reduced ? 'paused' : 'running',
          transformStyle: 'preserve-3d',
        };
        const counterStyle: CSSProperties = {
          ['--a0' as string]: `${a0}deg`,
          animation: `map-counter ${dur}s linear infinite`,
          animationPlayState: reduced ? 'paused' : 'running',
          transformStyle: 'preserve-3d',
        };
        return (
          <div key={p.name} className="absolute left-1/2 top-1/2" style={spinStyle}>
            <div className="absolute" style={{ left: `${r * HALF}cqmin`, top: 0, transformStyle: 'preserve-3d' }}>
              <div style={counterStyle}>
                <div style={{ transformStyle: 'preserve-3d', transform: `translateZ(0.5cqmin) rotateZ(${-ctx.spin}deg) rotateX(${-ctx.tilt}deg)` }}>
                  <div className="relative -translate-x-1/2 -translate-y-full" style={{ width: `${size}cqmin` }}>
                    <button
                      type="button"
                      tabIndex={canPick ? 0 : -1}
                      aria-label={canPick ? `Choose ${p.name}` : p.name}
                      disabled={!canPick}
                      onClick={() => canPick && onPick(p.name)}
                      className={`block w-full rounded-full ${canPick ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <PlanetSprite planet={planet ?? { name: p.name, eqTempK: 600, planetClass: (p.radiusRe ?? 1) > 1.6 ? 'giant' : 'rocky' }} />
                    </button>
                    {(isSel || canPick) && <Tag strong={isSel}>{p.name.replace(sys.host, '').trim() || p.name}{ph.known ? '' : ' ?'}</Tag>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function NeighbourhoodLevel({ difficulty, ctx, onPickHost, selectedHost }: { difficulty: Difficulty; ctx: Ctx; onPickHost: (h: string) => void; selectedHost: string | null }) {
  const rankHosts = new Set(DIFFICULTY_SETS[difficulty].map((n) => findPlanet(n)?.host).filter(Boolean) as string[]);
  const R = Math.max(...[...rankHosts].map((h) => SYSTEMS[h]?.distancePc ?? 1)) * 1.12;
  const ringsLy = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 1500].filter((ly) => ly / LY_PER_PC < R * 0.98);
  const shownRings = ringsLy.slice(-3);
  return (
    <>
      {shownRings.map((ly) => {
        const r = ly / LY_PER_PC / R;
        return (
          <div key={ly} className="absolute left-1/2 top-1/2 rounded-full border-[0.3cqmin] border-dashed border-[#fff8ef]/35" style={{ width: `${r * 100}%`, height: `${r * 100}%`, transform: 'translate(-50%,-50%)' }}>
            <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded bg-night/80 px-1 text-[clamp(10px,1.7cqmin,13px)] font-bold text-[#e6dcff]">
              {fmt(ly)} ly
            </span>
          </div>
        );
      })}
      <div className="absolute left-1/2 top-[1%] -translate-x-1/2 rounded-md bg-lilac px-2 py-0.5 text-[clamp(10px,1.8cqmin,14px)] font-extrabold text-ink">
        ↑ Toward the middle of the Milky Way
      </div>
      <Pin u={0} v={0} ctx={ctx} stalk={false}>
        <StarDot teff={5772} size={3.2} label="The Sun">
          <Tag strong>Sun (home!)</Tag>
        </StarDot>
      </Pin>
      {Object.values(SYSTEMS).map((s) => {
        if (s.distancePc > R) return null;
        const p = galacticXYZ(s.glon, s.glat, s.distancePc);
        const mine = rankHosts.has(s.host);
        return (
          <Pin key={s.host} u={-p.y / R} v={-p.x / R} h={p.z / R} ctx={ctx}>
            <StarDot
              teff={s.starTeffK}
              size={mine ? 2.6 : 1.6}
              label={mine ? `${s.host}, ${fmt(s.distancePc * LY_PER_PC, 1)} light-years away. Open this star system` : s.host}
              onClick={mine ? () => onPickHost(s.host) : undefined}
              highlight={s.host === selectedHost}
            >
              {mine && (
                <Tag strong={s.host === selectedHost}>
                  {s.host} · {fmt(s.distancePc * LY_PER_PC, s.distancePc * LY_PER_PC < 20 ? 1 : 0)} ly
                </Tag>
              )}
            </StarDot>
          </Pin>
        );
      })}
    </>
  );
}

function GalaxyLevel({ ctx, radiusPc }: { ctx: Ctx; radiusPc: number }) {
  const W = 17; // kpc half-width of the view
  const sunV = SUN_GC_KPC / W;
  const circle = Math.max((radiusPc / 1000 / W) * 2, 0.025);
  return (
    <>
      <div className="absolute left-1/2 top-1/2" style={{ transform: 'translate(-50%,-50%)' }}>
        <SpiralGalaxy size={(MW_DISC_RADIUS_KPC / W) * 2 * HALF} hue="lilac" flat detailed />
      </div>
      <Pin u={0} v={0} ctx={ctx} stalk={false}>
        <div className="relative h-[3cqmin] w-[3cqmin] -translate-x-1/2 -translate-y-full">
          <Tag>Centre: a giant black hole</Tag>
        </div>
      </Pin>
      <div
        className="absolute rounded-full border-[0.45cqmin] border-butter"
        style={{ left: '50%', top: `${50 + sunV * 50}%`, width: `${circle * 100}%`, height: `${circle * 100}%`, transform: 'translate(-50%,-50%)', boxShadow: '0 0 0 0.3cqmin #2a1747' }}
      />
      <Pin u={0} v={sunV} ctx={ctx} stalk={false}>
        <StarDot teff={5772} size={2.2} label="The Sun">
          <Tag strong>Sun · our planets are in the tiny yellow circle</Tag>
        </StarDot>
      </Pin>
    </>
  );
}

function LocalLevel({ ctx }: { ctx: Ctx }) {
  const R = 950; // kpc
  return (
    <>
      <Pin u={0} v={0} ctx={ctx} stalk={false}>
        <div className="relative -translate-x-1/2 -translate-y-full">
          <SpiralGalaxy size={11} hue="lilac" detailed />
          <Tag strong>Milky Way: we live here</Tag>
        </div>
      </Pin>
      {GALAXIES.map((g) => {
        const p = galactocentricKpc(g.glon, g.glat, g.distKpc);
        const size = g.kind === 'spiral' ? (g.distKpc > 800 ? 7 : 10) : g.kind === 'irregular' ? 3.6 : 2.6;
        const near = g.distKpc < 100;
        return (
          <Pin key={g.name} u={-p.y / R} v={-p.x / R} h={p.z / R} ctx={ctx}>
            <div className="relative -translate-x-1/2 -translate-y-full" title={`${g.name}: ${fmt(g.distKpc * 3261.6 / 1e6, 2)} million light-years. ${g.source}`}>
              {g.kind === 'spiral' ? <SpiralGalaxy size={size} hue={g.name.startsWith('Andromeda') ? 'pink' : 'sky'} detailed /> : <Blob size={size} color={g.kind === 'dwarf' ? '#ffe07a' : '#8fd3ff'} />}
              {!near && <Tag>{g.name.split(' (')[0]} · {fmt((g.distKpc * 3261.6) / 1e6, 1)} million ly</Tag>}
            </div>
          </Pin>
        );
      })}
      <Pin u={0.34} v={0.16} ctx={ctx} stalk={false}>
        <div className="relative h-[1cqmin] w-[1cqmin]">
          <Tag>The small galaxies right next to ours are too close to see apart here</Tag>
        </div>
      </Pin>
    </>
  );
}

/* ---------------- Map shell ---------------- */

interface Props {
  difficulty: Difficulty;
  selected: string | null;
  onSelect: (planetName: string) => void;
}

export function SpaceMap({ difficulty, selected, onSelect }: Props) {
  const { reduced } = useReducedMotion();
  const [level, setLevel] = useState<MapLevel>('system');
  const [dir, setDir] = useState<'in' | 'out'>('in');
  const [spin, setSpin] = useState(-18);
  const [tilt, setTilt] = useState(52);
  const drag = useRef<{ x: number; y: number; spin: number; tilt: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const choosable = useMemo(() => new Set(DIFFICULTY_SETS[difficulty]), [difficulty]);
  const host = selected ? findPlanet(selected)?.host ?? null : null;
  const sys = host ? SYSTEMS[host] : undefined;
  const rankRadiusPc = Math.max(...DIFFICULTY_SETS[difficulty].map((n) => findPlanet(n)?.distancePc ?? 1)) * 1.12;

  const go = (l: MapLevel) => {
    if (l === level) return;
    setDir(LEVELS.indexOf(l) > LEVELS.indexOf(level) ? 'out' : 'in');
    sfx.whoosh();
    setLevel(l);
  };
  const li = LEVELS.indexOf(level);

  // Pinch / ctrl+wheel zooms between levels (plain wheel keeps scrolling the page).
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let last = 0;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const now = performance.now();
      if (now - last < 650) return;
      last = now;
      const i = LEVELS.indexOf(level);
      const next = e.deltaY > 0 ? LEVELS[Math.min(3, i + 1)] : LEVELS[Math.max(0, i - 1)];
      if (next && next !== level) go(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const down = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { x: e.clientX, y: e.clientY, spin, tilt };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setSpin(d.spin + (e.clientX - d.x) * 0.35);
    setTilt(Math.max(20, Math.min(75, d.tilt - (e.clientY - d.y) * 0.25)));
  };
  const up = () => {
    drag.current = null;
    setDragging(false);
  };

  const ctx = { spin, tilt };
  const caption: Record<MapLevel, string> = {
    system: '',
    neighbourhood: `Real positions of the stars, seen from above the Milky Way’s disc. Stalks show how far above or below the disc each star is. Bright stars have your ${difficulty === 'easy' ? 'Cadet' : difficulty === 'medium' ? 'Pilot' : 'Commander'} planets. Tap one!`,
    galaxy: `The Sun is ${fmt(SUN_GC_KPC * 3261.6)} light-years from the centre (measured). The spiral arms are an illustration: no one has seen our galaxy from outside.`,
    local: 'Real positions of the nearest big galaxies, seen from above the Milky Way. Galaxies are drawn bigger than real so you can see them.',
  };

  return (
    <section className="relative" aria-label={`Space map: ${LEVEL_NAME[level]}`}>
      <style>{`
        @keyframes map-orbit { from { transform: rotate(var(--a0)); } to { transform: rotate(calc(var(--a0) - 360deg)); } }
        @keyframes map-counter { from { transform: rotate(calc(-1 * var(--a0))); } to { transform: rotate(calc(-1 * var(--a0) + 360deg)); } }
        @keyframes galaxy-spin { to { transform: rotate(-360deg); } }
        @keyframes zoom-from-far { from { transform: scale(.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes zoom-from-near { from { transform: scale(2.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .map-label { position: absolute; left: 0; top: 0; white-space: nowrap; padding: 4px 6px; font: 400 clamp(7px, 0.9vw, 9px)/1.3 var(--f-title); color: #8a94b8; background: rgba(11,14,42,.88); border: 2px solid #05060f; will-change: transform; }
        .map-label[data-strong='1'] { color: #ffc94a; border-color: #ffc94a; box-shadow: 2px 2px 0 #05060f; }
      `}</style>
      <div
        ref={stage}
        className={`diorama h-[min(62vh,580px)] min-h-[340px] select-none rounded-[28px] ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ perspective: '1300px', perspectiveOrigin: '50% 30%', touchAction: 'pan-y' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <div
          key={level + (level === 'system' ? host ?? '' : '')}
          className="absolute inset-0"
          style={{ transformStyle: 'preserve-3d', animation: `${dir === 'in' ? 'zoom-from-far' : 'zoom-from-near'} .8s cubic-bezier(.2,.9,.25,1) both` }}
        >
          <div
            className="absolute left-1/2 top-[50%] h-[120cqmin] w-[120cqmin]"
            style={{
              transformStyle: 'preserve-3d',
              transform: `translate(-50%,-50%) rotateX(${tilt}deg) rotateZ(${spin}deg)`,
              transition: dragging ? 'none' : 'transform .4s ease-out',
            }}
          >
            {/* the paper table */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: level === 'local' ? 'radial-gradient(circle, rgba(59,37,119,.72), rgba(36,22,79,.6) 70%)' : 'radial-gradient(circle, rgba(70,48,140,.75), rgba(43,26,94,.62) 72%)',
                boxShadow: '0 0 0 0.6cqmin #4a5378, 0 0 0 1.2cqmin #05060f',
                backgroundImage: 'var(--grain)',
                backgroundBlendMode: 'multiply',
              }}
            />
            {level === 'system' && sys && (
              <SystemLevel sys={sys} selected={selected} ctx={ctx} choosable={choosable} onPick={onSelect} reduced={reduced} />
            )}
            {level === 'neighbourhood' && (
              <NeighbourhoodLevel
                difficulty={difficulty}
                ctx={ctx}
                selectedHost={host}
                onPickHost={(h) => {
                  const pick = DIFFICULTY_SETS[difficulty].find((n) => findPlanet(n)?.host === h);
                  if (pick) onSelect(pick);
                  go('system');
                }}
              />
            )}
            {level === 'galaxy' && <GalaxyLevel ctx={ctx} radiusPc={rankRadiusPc} />}
            {level === 'local' && <LocalLevel ctx={ctx} />}
          </div>
        </div>

        <LabelLayer stage={stage} />

        {/* level tickets */}
        <nav className="absolute left-3 top-3 flex flex-wrap gap-1.5" aria-label="Zoom level">
          {LEVELS.map((l, i) => (
            <button
              key={l}
              type="button"
              onClick={() => go(l)}
              aria-current={l === level ? 'true' : undefined}
              className={`rounded-md px-2 py-1 text-xs font-extrabold transition sm:text-sm ${l === level ? 'bg-butter text-ink' : 'bg-paper/85 text-ink hover:bg-paper'}`}
              style={{ boxShadow: '0 0 0 2px #05060f, 0 3px 0 2px rgba(20,8,50,.3)', transform: `rotate(${i % 2 ? 1.5 : -1.5}deg)` }}
            >
              {LEVEL_NAME[l]}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-3 right-3 flex flex-col gap-2">
          <button type="button" className="pbtn pbtn-paper pbtn-icon" disabled={li === 0} onClick={() => go(LEVELS[li - 1]!)} aria-label={li > 0 ? `Zoom in to ${LEVEL_NAME[LEVELS[li - 1]!]}` : 'Zoom in'}>
            <span className="text-2xl leading-none">+</span>
          </button>
          <button type="button" className="pbtn pbtn-paper pbtn-icon" disabled={li === 3} onClick={() => go(LEVELS[li + 1]!)} aria-label={li < 3 ? `Zoom out to ${LEVEL_NAME[LEVELS[li + 1]!]}` : 'Zoom out'}>
            <span className="text-2xl leading-none">−</span>
          </button>
        </div>
        <p className="pointer-events-none absolute bottom-3 left-3 hidden rounded-md bg-night/70 px-2 py-1 text-xs font-semibold text-[#e6dcff] sm:block">
          <Icon name="motion" size={14} /> Drag to spin · buttons to zoom
        </p>
      </div>
      <p className="mt-3 rounded-2xl bg-night/70 px-4 py-2 text-sm text-[#2b2f73]" aria-live="polite">
        <strong className="text-butter">{LEVEL_NAME[level]}{level === 'system' && sys ? `: ${sys.host}` : ''}.</strong>{' '}
        {level === 'system' ? (sys ? systemCaptionText(sys, selected, reduced) : 'Pick a planet below.') : caption[level]}
      </p>
    </section>
  );
}
