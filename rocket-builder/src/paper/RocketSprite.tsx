import type { ReactNode } from 'react';
import { Pixelate } from '../pixel/Pixelate';
import type { PropellantType, Rocket } from '../engine';

export const FUEL_COLOR: Record<PropellantType, string> = {
  solid: '#ffb48f',
  kerolox: '#ffe07a',
  hydrolox: '#8fd3ff',
  hydrogen: '#74e0c0',
};
export const FUEL_DARK: Record<PropellantType, string> = {
  solid: '#e98a63',
  kerolox: '#d9b245',
  hydrolox: '#5aa6d6',
  hydrogen: '#3cae8e',
};

const SHIELD: Record<string, { fill: string; detail: string; pattern: 'foil' | 'tiles' | 'water' | 'gems' }> = {
  'protect-mli': { fill: '#ffe07a', detail: '#c99a2e', pattern: 'foil' },
  'protect-pica': { fill: '#8a5a44', detail: '#5d3a2b', pattern: 'tiles' },
  'protect-habitat': { fill: '#5fa8e8', detail: '#cfeeff', pattern: 'water' },
  'protect-hfc': { fill: '#3b2577', detail: '#ffe07a', pattern: 'gems' },
};
const ANTENNA: Record<string, string> = {
  'comms-dsn': '#fff8ef',
  'comms-quantum': '#74e0c0',
  'comms-tachyon': '#ffb48f',
  'comms-subspace': '#ff7cc6',
};
const DRIVE: Record<string, { fill: string; glow: string; spokes: number }> = {
  'drive-sail': { fill: '#ffe07a', glow: '#fff8ef', spokes: 2 },
  'drive-warp': { fill: '#b8a1ff', glow: '#e6dcff', spokes: 4 },
  'drive-fold': { fill: '#ff7cc6', glow: '#ffd0ea', spokes: 6 },
  'drive-singularity': { fill: '#2a1747', glow: '#b8a1ff', spokes: 8 },
};

interface Props {
  rocket: Rocket;
  crew?: number;
  ghosts?: boolean;
  glow?: 'heat' | null;
  lastAdded?: string | null;
  className?: string;
  title?: string;
}

const W = 100;
const BL = 28; // body left
const BW = 44; // body width
const BR = BL + BW;
const CAP_H = 50;
const SHIELD_H = 11;
const DRIVE_H = 20;
const TANK_H = 36;
const ENG_H = 30;

/** Paper "volume": a lit strip on the left, a shadow strip on the right. */
function Shade({ y, h, x = BL, w = BW }: { y: number; h: number; x?: number; w?: number }) {
  return (
    <g pointerEvents="none">
      <rect x={x + 4} y={y} width="4" height={h} fill="#fff" opacity=".35" />
      <rect x={x + 10} y={y} width="1.6" height={h} fill="#fff" opacity=".25" />
      <rect x={x + w - 9} y={y} width="9" height={h} fill="#2a1747" opacity=".14" />
    </g>
  );
}

/** Draws a detailed paper rocket from whatever parts are fitted. */
function RocketSpriteSvg({ rocket, crew = 0, ghosts = false, glow = null, lastAdded = null, className = '', title }: Props) {
  const back: ReactNode[] = [];
  const parts: ReactNode[] = [];
  const front: ReactNode[] = [];
  const anim = (id: string | undefined) => (id && id === lastAdded ? 'anim-drop' : undefined);
  let y = 8;

  // ---------------- Cabin ----------------
  const p = rocket.payload;
  if (p) {
    if (p.id === 'payload-probe') {
      parts.push(
        <g key={`cap-${p.id}`} className={anim(p.id)}>
          {/* dish */}
          <path d={`M50 ${y + 14} L50 ${y + 6}`} stroke="#fff8ef" strokeWidth="2" />
          <path d={`M34 ${y + 2} Q50 ${y + 18} 66 ${y + 2} Z`} fill="#e6dcff" filter="url(#pp-edge)" />
          <circle cx="50" cy={y + 5} r="2.4" fill="#ff7cc6" />
          {/* solar wings */}
          {[-1, 1].map((s) => (
            <g key={s} filter="url(#pp-edge-thin)">
              <rect x={s < 0 ? 2 : 74} y={y + 22} width="24" height="16" rx="1.5" fill="#3d6fc0" />
              <path d={`M${s < 0 ? 10 : 82} ${y + 22} v16 M${s < 0 ? 18 : 90} ${y + 22} v16 M${s < 0 ? 2 : 74} ${y + 30} h24`} stroke="#8fd3ff" strokeWidth="1" />
            </g>
          ))}
          {/* gold-foil bus */}
          <path d={`M${BL + 6} ${y + 16} L${BR - 6} ${y + 16} L${BR - 2} ${y + 24} L${BR - 2} ${y + CAP_H} L${BL + 2} ${y + CAP_H} L${BL + 2} ${y + 24} Z`} fill="#ffe07a" filter="url(#pp-edge)" />
          <path d={`M${BL + 6} ${y + 30} l6 4 l-6 4 M${BL + 18} ${y + 28} l6 5 l-6 5 M${BL + 30} ${y + 30} l6 4 l-6 4`} stroke="#c99a2e" strokeWidth="1.2" fill="none" />
          <Shade y={y + 18} h={CAP_H - 18} x={BL + 2} w={BW - 4} />
        </g>,
      );
    } else {
      const fill = p.id === 'payload-capsule' ? '#ff7cc6' : '#b8a1ff';
      const stripe = p.id === 'payload-capsule' ? '#ffe07a' : '#ff7cc6';
      const windows = p.crewSeats <= 2 ? 1 : 2;
      parts.push(
        <g key={`cap-${p.id}`} className={anim(p.id)}>
          <path
            d={`M50 ${y - 4} C${BR - 4} ${y + 12} ${BR} ${y + 30} ${BR} ${y + CAP_H} L${BL} ${y + CAP_H} C${BL} ${y + 30} ${BL + 4} ${y + 12} 50 ${y - 4}Z`}
            fill={fill}
            filter="url(#pp-edge)"
          />
          {/* nose band + tip light */}
          <path d={`M41 ${y + 8} Q50 ${y + 12} 59 ${y + 8} L60.5 ${y + 12} Q50 ${y + 16} 39.5 ${y + 12} Z`} fill="#fff8ef" />
          <circle cx="50" cy={y - 3} r="3" fill="#ffe07a" className="anim-twinkle" />
          {/* lit / shadow sides of the cone */}
          <path d={`M50 ${y - 2} C${BL + 8} ${y + 14} ${BL + 4} ${y + 30} ${BL + 4} ${y + CAP_H}`} stroke="#fff" strokeWidth="3" fill="none" opacity=".35" />
          <path d={`M50 ${y - 2} C${BR - 2} ${y + 14} ${BR - 4} ${y + 32} ${BR - 5} ${y + CAP_H}`} stroke="#2a1747" strokeWidth="6" fill="none" opacity=".12" />
          {/* stripe + base ring */}
          <path d={`M${BL + 1} ${y + CAP_H - 9} H${BR - 1}`} stroke={stripe} strokeWidth="3.5" />
          <rect x={BL - 1} y={y + CAP_H - 4} width={BW + 2} height="4" rx="1.5" fill="#fff8ef" />
          {/* portholes with bolted rings */}
          {Array.from({ length: windows }, (_, i) => {
            const cx = windows === 1 ? 50 : i === 0 ? 42 : 58;
            const cy = y + 28;
            const seated = crew > (windows === 1 ? 0 : i * 2);
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r="8.5" fill="#fff8ef" />
                <circle cx={cx} cy={cy} r="8.5" fill="none" stroke="#2a1747" strokeWidth="1" strokeDasharray="1.2 2.4" opacity=".6" />
                <circle cx={cx} cy={cy} r="6" fill={seated ? '#8fd3ff' : '#3b2577'} />
                {seated && (
                  <>
                    <circle cx={cx} cy={cy + 1.2} r="3.4" fill="#fff8ef" />
                    <rect x={cx - 2.3} y={cy} width="4.6" height="2.4" rx="1.2" fill="#5fa8e8" />
                  </>
                )}
                <path d={`M${cx - 3.5} ${cy - 2.5} q2 -2 4 -1.6`} stroke="#fff" strokeWidth="1.3" fill="none" opacity=".8" />
              </g>
            );
          })}
          {/* star decal */}
          <path transform={`translate(${BL + 5} ${y + 34}) scale(.32)`} d="M10 0 L12.9 6.9 L20 7.6 L14.6 12.3 L16.2 19.5 L10 15.8 L3.8 19.5 L5.4 12.3 L0 7.6 L7.1 6.9 Z" fill="#fff8ef" />
        </g>,
      );
    }
  } else if (ghosts) {
    parts.push(<Ghost key="g-cap" d={`M50 ${y - 4} C68 ${y + 12} 72 ${y + 30} 72 ${y + CAP_H} L28 ${y + CAP_H} C28 ${y + 30} 32 ${y + 12} 50 ${y - 4}Z`} />);
  }

  // Radio on the cabin's shoulder
  if (rocket.comms) {
    const c = ANTENNA[rocket.comms.id] ?? '#fff8ef';
    const ay = y + 16;
    front.push(
      <g key={`ant-${rocket.comms.id}`} className={anim(rocket.comms.id)}>
        <path d={`M${BR - 6} ${ay + 12} L88 ${ay - 6}`} stroke="#fff8ef" strokeWidth="2.6" strokeLinecap="round" />
        {rocket.comms.id === 'comms-dsn' ? (
          <g filter="url(#pp-edge-thin)">
            <path d={`M80 ${ay - 16} Q98 ${ay - 10} 92 ${ay + 4} Z`} fill={c} />
            <circle cx="88" cy={ay - 6} r="1.6" fill="#2a1747" />
          </g>
        ) : (
          <g>
            <circle cx="88" cy={ay - 8} r="5.5" fill={c} filter="url(#pp-edge-thin)" />
            <circle cx="88" cy={ay - 8} r="9" fill="none" stroke={c} strokeWidth="1.2" opacity=".7" className="anim-twinkle" />
            <circle cx="88" cy={ay - 8} r="13" fill="none" stroke={c} strokeWidth="1" opacity=".4" className="anim-twinkle" style={{ animationDelay: '.5s' }} />
          </g>
        )}
      </g>,
    );
  } else if (ghosts) {
    front.push(<Ghost key="g-ant" d={`M68 ${y + 28} L88 ${y + 10} M86 ${y + 4} a5 5 0 1 0 0.1 0`} />);
  }
  y += CAP_H;

  // ---------------- Shield ----------------
  if (rocket.protection) {
    const s = SHIELD[rocket.protection.id] ?? { fill: '#fff8ef', detail: '#2a1747', pattern: 'foil' as const };
    parts.push(
      <g key={`sh-${rocket.protection.id}`} className={anim(rocket.protection.id)}>
        <rect x={BL - 4} y={y} width={BW + 8} height={SHIELD_H} rx="4" fill={s.fill} filter="url(#pp-edge)" />
        {s.pattern === 'foil' && <path d={`M${BL - 2} ${y + 6} l4 -3 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 3`} stroke={s.detail} strokeWidth="1.2" fill="none" />}
        {s.pattern === 'tiles' &&
          Array.from({ length: 8 }, (_, i) => <rect key={i} x={BL - 2 + i * 6.4} y={y + 2} width="5.4" height={SHIELD_H - 4} rx="1" fill="none" stroke={s.detail} strokeWidth="1" />)}
        {s.pattern === 'water' && <path d={`M${BL - 2} ${y + 5.5} q4 -3 8 0 t8 0 t8 0 t8 0 t8 0 t8 0`} stroke={s.detail} strokeWidth="1.6" fill="none" />}
        {s.pattern === 'gems' &&
          Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${BL + 1 + i * 8} ${y + 5.5} l2.5 -3 l2.5 3 l-2.5 3 Z`} fill={s.detail} className="anim-twinkle" style={{ animationDelay: `${i * 0.2}s` }} />)}
        <Shade y={y} h={SHIELD_H} x={BL - 4} w={BW + 8} />
      </g>,
    );
    y += SHIELD_H;
  }

  // ---------------- Deep-Space Drive ----------------
  if (rocket.drive) {
    const d = DRIVE[rocket.drive.id] ?? DRIVE['drive-warp']!;
    const cy = y + DRIVE_H / 2;
    back.push(
      <g key={`drb-${rocket.drive.id}`} className={anim(rocket.drive.id)}>
        <ellipse cx="50" cy={cy} rx="48" ry="11" fill={d.glow} opacity=".35" className="anim-twinkle" />
        <path d={`M8 ${cy} A42 9 0 0 1 92 ${cy}`} stroke={d.fill} strokeWidth="7" fill="none" filter="url(#pp-edge-thin)" />
      </g>,
    );
    parts.push(
      <g key={`dr-${rocket.drive.id}`} className={anim(rocket.drive.id)}>
        <rect x={BL} y={y} width={BW} height={DRIVE_H} fill="#e6dcff" filter="url(#pp-edge)" />
        {Array.from({ length: d.spokes }, (_, i) => (
          <rect key={i} x={BL + 3 + (i * (BW - 8)) / Math.max(1, d.spokes - 1)} y={y + 3} width="2.4" height={DRIVE_H - 6} rx="1.2" fill={d.fill} opacity=".8" />
        ))}
        <Shade y={y} h={DRIVE_H} />
      </g>,
    );
    front.push(
      <g key={`drf-${rocket.drive.id}`} className={anim(rocket.drive.id)}>
        <path d={`M8 ${cy} A42 9 0 0 0 92 ${cy}`} stroke={d.fill} strokeWidth="7" fill="none" filter="url(#pp-edge-thin)" />
        {[18, 50, 82].map((x) => (
          <circle key={x} cx={x} cy={cy + (x === 50 ? 9 : 6.5)} r="2.4" fill={d.glow} className="anim-twinkle" />
        ))}
      </g>,
    );
  } else if (ghosts) {
    parts.push(<Ghost key="g-dr" d={`M8 ${y + 10} a42 9 0 1 0 84 0 a42 9 0 1 0 -84 0`} />);
  }
  y += DRIVE_H;

  // ---------------- Pump bottles (beside the top tank) ----------------
  const pumpY = y;
  if (rocket.pressure) {
    back.push(
      <g key={`pr-${rocket.pressure.id}`} className={anim(rocket.pressure.id)}>
        {[0, 1].map((i) => (
          <g key={i} filter="url(#pp-edge-thin)">
            <circle cx={BL - 7} cy={pumpY + 9 + i * 15} r="7.5" fill={i ? '#b8a1ff' : '#fff8ef'} />
          </g>
        ))}
        <rect x={BL - 14} y={pumpY + 8} width="14" height="2.2" fill="#5b4a7a" />
        <rect x={BL - 14} y={pumpY + 23} width="14" height="2.2" fill="#5b4a7a" />
        <circle cx={BL - 9} cy={pumpY + 7} r="2" fill="#fff" opacity=".7" />
      </g>,
    );
  }

  // ---------------- Fuel tanks (top of stack = last index) ----------------
  const top = [...rocket.tanks].reverse();
  if (top.length === 0 && ghosts) {
    parts.push(<Ghost key="g-tank" d={`M${BL} ${y} h${BW} v${TANK_H} h-${BW} Z`} />);
    y += TANK_H;
  }
  top.forEach((t, i) => {
    const color = FUEL_COLOR[t.propellant];
    const dark = FUEL_DARK[t.propellant];
    const ty = y;
    parts.push(
      <g key={`tank-${i}-${rocket.tanks.length}`} className={i === 0 && lastAdded === t.id ? 'anim-drop' : undefined}>
        <rect x={BL} y={ty} width={BW} height={TANK_H} rx="4" fill={color} filter="url(#pp-edge)" />
        <rect x={BL} y={ty + 4} width={BW} height="4" fill={dark} />
        <rect x={BL} y={ty + TANK_H - 8} width={BW} height="4" fill={dark} />
        <g fill="#2a1747" opacity=".3">
          {[6, 14, 22, 30, 38].map((x) => (
            <circle key={x} cx={BL + x} cy={ty + 6} r=".9" />
          ))}
        </g>
        {/* fuel gauge window */}
        <rect x={BR - 13} y={ty + 12} width="6" height="13" rx="3" fill="#fff8ef" />
        <rect x={BR - 12} y={ty + 16} width="4" height="8" rx="2" fill={dark} />
        {/* stage number decal */}
        <circle cx={BL + 14} cy={ty + 18} r="5.5" fill="#fff8ef" />
        <Shade y={ty} h={TANK_H} />
      </g>,
    );
    y += TANK_H;
  });

  // ---------------- Fins ----------------
  const finTop = y - 34;
  back.push(
    <g key="fins" filter="url(#pp-edge)">
      <path d={`M${BL + 2} ${finTop} C${BL - 10} ${finTop + 14} ${BL - 22} ${y + 2} ${BL - 20} ${y + 14} L${BL + 2} ${y + 4} Z`} fill="#ff7cc6" />
      <path d={`M${BR - 2} ${finTop} C${BR + 10} ${finTop + 14} ${BR + 22} ${y + 2} ${BR + 20} ${y + 14} L${BR - 2} ${y + 4} Z`} fill="#ff7cc6" />
    </g>,
  );
  front.push(
    <g key="fin-deco" pointerEvents="none">
      <path d={`M${BL - 4} ${finTop + 16} L${BL - 14} ${y + 6}`} stroke="#b8a1ff" strokeWidth="3" strokeLinecap="round" />
      <path d={`M${BR + 4} ${finTop + 16} L${BR + 14} ${y + 6}`} stroke="#b8a1ff" strokeWidth="3" strokeLinecap="round" />
    </g>,
  );

  // ---------------- Engine ----------------
  const e = rocket.engine;
  if (e) {
    const n = e.id === 'engine-kerolox' || e.id === 'engine-hydrolox' ? 3 : 1;
    const bell = e.id === 'engine-gascore' ? '#74e0c0' : e.id === 'engine-fusion' ? '#ff7cc6' : e.id === 'engine-solid' ? '#9a8ab8' : '#5b4a7a';
    const nw = n === 1 ? (e.id === 'engine-solid' ? 34 : 30) : 14;
    parts.push(
      <g key={`eng-${e.id}`} className={anim(e.id)}>
        {/* engine bay skirt */}
        <path d={`M${BL} ${y} L${BR} ${y} L${BR - 4} ${y + 9} L${BL + 4} ${y + 9} Z`} fill="#3b2577" filter="url(#pp-edge-thin)" />
        <path d={`M${BL + 6} ${y + 4.5} H${BR - 6}`} stroke="#ffe07a" strokeWidth="1.2" strokeDasharray="2 2" />
        {Array.from({ length: n }, (_, i) => {
          const cx = n === 1 ? 50 : 36 + i * 14;
          const top = y + 9;
          const bot = y + ENG_H;
          return (
            <g key={i}>
              <path d={`M${cx - nw / 4} ${top} L${cx + nw / 4} ${top} C${cx + nw / 3} ${top + 8} ${cx + nw / 2} ${bot - 6} ${cx + nw / 2} ${bot} L${cx - nw / 2} ${bot} C${cx - nw / 2} ${bot - 6} ${cx - nw / 3} ${top + 8} ${cx - nw / 4} ${top} Z`} fill={bell} filter="url(#pp-edge-thin)" />
              <ellipse cx={cx} cy={bot} rx={nw / 2} ry="2.2" fill="#2a1747" />
              <path d={`M${cx - nw / 3} ${top + 9} H${cx + nw / 3}`} stroke="#fff8ef" strokeWidth="1" opacity=".5" />
              <path d={`M${cx - nw / 4} ${top + 2} C${cx - nw / 3.4} ${top + 8} ${cx - nw / 2.5} ${bot - 6} ${cx - nw / 2.4} ${bot - 1}`} stroke="#fff" strokeWidth="1.4" fill="none" opacity=".35" />
            </g>
          );
        })}
        {e.id === 'engine-gascore' && <circle cx="50" cy={y + 16} r="4.5" fill="#d8fff1" className="anim-twinkle" />}
        {e.id === 'engine-fusion' && (
          <>
            <ellipse cx="50" cy={y + 15} rx="17" ry="3.5" fill="none" stroke="#ffe07a" strokeWidth="2" />
            <ellipse cx="50" cy={y + 21} rx="15" ry="3" fill="none" stroke="#ffe07a" strokeWidth="2" className="anim-twinkle" />
          </>
        )}
      </g>,
    );
  } else if (ghosts) {
    parts.push(<Ghost key="g-eng" d={`M38 ${y + 6} L62 ${y + 6} L68 ${y + ENG_H} L32 ${y + ENG_H} Z`} />);
  }
  y += ENG_H;

  const H = y + 16;
  const heat = glow === 'heat';
  return (
    <svg
      viewBox={`0 ${-4} ${W} ${H + 4}`}
      className={`sprite ${className}`}
      style={{ width: '100%', height: 'auto', overflow: 'visible' }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <g style={heat ? { filter: 'sepia(1) saturate(4) hue-rotate(-30deg) brightness(1.05)' } : undefined}>
        {back}
        {parts}
        {front}
      </g>
    </svg>
  );
}

function Ghost({ d }: { d: string }) {
  return <path d={d} fill="rgba(255,248,239,0.08)" stroke="#fff8ef" strokeWidth="1.6" strokeDasharray="4 3" opacity=".7" />;
}

/** Height-to-width ratio of the drawn rocket, for layout. */
export function rocketAspect(rocket: Rocket): number {
  const h = 8 + CAP_H + (rocket.protection ? SHIELD_H : 0) + DRIVE_H + Math.max(1, rocket.tanks.length) * TANK_H + ENG_H + 16 + 4;
  return h / W;
}

/** The rocket as 16-bit pixel art. A part being added replays a short drop-in. */
export function RocketSprite(props: Props) {
  return (
    <Pixelate key={props.lastAdded ?? 'r'} className={`${props.lastAdded ? 'anim-pop' : ''} ${props.className ?? ''}`} label={props.title}>
      <RocketSpriteSvg {...props} className="" title={undefined} />
    </Pixelate>
  );
}
