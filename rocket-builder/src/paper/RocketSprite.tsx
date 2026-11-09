import type { ReactNode } from 'react';
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

const SHIELD: Record<string, { fill: string; detail: string }> = {
  'protect-mli': { fill: '#ffe07a', detail: '#d9b245' },
  'protect-pica': { fill: '#9a6a52', detail: '#6e4636' },
  'protect-habitat': { fill: '#5fa8e8', detail: '#fff8ef' },
  'protect-hfc': { fill: '#3b2577', detail: '#ffe07a' },
};

const ANTENNA: Record<string, string> = {
  'comms-dsn': '#fff8ef',
  'comms-quantum': '#74e0c0',
  'comms-tachyon': '#ffb48f',
  'comms-subspace': '#ff7cc6',
};

const DRIVE: Record<string, { fill: string; glow: string }> = {
  'drive-sail': { fill: '#ffe07a', glow: '#fff8ef' },
  'drive-warp': { fill: '#b8a1ff', glow: '#e6dcff' },
  'drive-fold': { fill: '#ff7cc6', glow: '#ffd0ea' },
  'drive-singularity': { fill: '#2a1747', glow: '#b8a1ff' },
};

interface Props {
  rocket: Rocket;
  crew?: number;
  /** Dashed outlines for missing required parts (builder). */
  ghosts?: boolean;
  /** Tint the whole rocket (heat failure). */
  glow?: 'heat' | null;
  /** Which part was just added: it plays a drop-in. */
  lastAdded?: string | null;
  className?: string;
  title?: string;
}

const W = 100;
const BODY_L = 28;
const BODY_W = 44;

/** Draws a rocket from whatever parts are fitted. Height grows with tanks. */
export function RocketSprite({ rocket, crew = 0, ghosts = false, glow = null, lastAdded = null, className = '', title }: Props) {
  const parts: ReactNode[] = [];
  let y = 6;
  const anim = (id: string | undefined) => (id && id === lastAdded ? 'anim-drop' : undefined);

  // ---- Payload / capsule
  const p = rocket.payload;
  const capH = 46;
  if (p) {
    const fill = p.id === 'payload-probe' ? '#fff8ef' : p.id === 'payload-capsule' ? '#ff7cc6' : '#b8a1ff';
    const windows = p.crewSeats === 0 ? 0 : p.crewSeats <= 2 ? 1 : 2;
    parts.push(
      <g key={`cap-${p.id}`} className={anim(p.id)}>
        {p.id === 'payload-probe' ? (
          <g filter="url(#pp-edge)">
            <path d={`M${BODY_L + 8} ${y + 14} Q50 ${y - 6} ${BODY_L + BODY_W - 8} ${y + 14} Z`} fill="#b8a1ff" />
            <rect x={BODY_L + 4} y={y + 14} width={BODY_W - 8} height={capH - 14} rx="6" fill={fill} />
            <rect x="4" y={y + 22} width="22" height="14" rx="2" fill="#5fa8e8" />
            <rect x="74" y={y + 22} width="22" height="14" rx="2" fill="#5fa8e8" />
          </g>
        ) : (
          <g filter="url(#pp-edge)">
            <path d={`M50 ${y} C${BODY_L + BODY_W - 2} ${y + 14} ${BODY_L + BODY_W} ${y + 30} ${BODY_L + BODY_W} ${y + capH} L${BODY_L} ${y + capH} C${BODY_L} ${y + 30} ${BODY_L + 2} ${y + 14} 50 ${y}Z`} fill={fill} />
          </g>
        )}
        {p.id === 'payload-probe' && (
          <g stroke="#2a1747" strokeWidth="1.5" opacity=".5">
            <path d={`M15 ${y + 22} V${y + 36} M85 ${y + 22} V${y + 36}`} />
          </g>
        )}
        {Array.from({ length: windows }, (_, i) => {
          const cx = windows === 1 ? 50 : i === 0 ? 42 : 58;
          const cy = y + 30;
          const seated = crew > (windows === 1 ? 0 : i * 2);
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r="7.5" fill="#2a1747" />
              <circle cx={cx} cy={cy} r="5.5" fill={seated ? '#8fd3ff' : '#5b4a7a'} />
              {seated && <circle cx={cx} cy={cy + 1} r="3" fill="#fff8ef" />}
            </g>
          );
        })}
        {p.id === 'payload-explorer' && <rect x={BODY_L + 2} y={y + 40} width={BODY_W - 4} height="3" fill="#ff7cc6" />}
      </g>,
    );
  } else if (ghosts) {
    parts.push(<Ghost key="g-cap" d={`M50 ${y} C70 ${y + 14} 72 ${y + 30} 72 ${y + capH} L28 ${y + capH} C28 ${y + 30} 30 ${y + 14} 50 ${y}Z`} />);
  }

  // Antenna on the capsule's shoulder
  if (rocket.comms) {
    const c = ANTENNA[rocket.comms.id] ?? '#fff8ef';
    const ay = y + 18;
    parts.push(
      <g key={`ant-${rocket.comms.id}`} className={anim(rocket.comms.id)}>
        <path d={`M${BODY_L + BODY_W - 4} ${ay + 10} L86 ${ay - 6}`} stroke="#fff8ef" strokeWidth="3" />
        {rocket.comms.id === 'comms-dsn' ? (
          <path d={`M80 ${ay - 14} Q96 ${ay - 8} 90 ${ay + 4} Z`} fill={c} filter="url(#pp-edge-thin)" />
        ) : (
          <circle cx="87" cy={ay - 8} r="5" fill={c} filter="url(#pp-edge-thin)" className="anim-twinkle" />
        )}
      </g>,
    );
  } else if (ghosts) {
    parts.push(<Ghost key="g-ant" d={`M70 ${y + 26} L86 ${y + 12} M82 ${y + 6} a5 5 0 1 0 0.1 0`} />);
  }
  y += capH;

  // ---- Protection band
  if (rocket.protection) {
    const s = SHIELD[rocket.protection.id] ?? { fill: '#fff8ef', detail: '#2a1747' };
    parts.push(
      <g key={`sh-${rocket.protection.id}`} className={anim(rocket.protection.id)}>
        <rect x={BODY_L - 4} y={y} width={BODY_W + 8} height="10" rx="4" fill={s.fill} filter="url(#pp-edge)" />
        <path d={`M${BODY_L} ${y + 5} H${BODY_L + BODY_W}`} stroke={s.detail} strokeWidth="2" strokeDasharray="4 4" />
      </g>,
    );
    y += 10;
  }

  // ---- Deep-Space Drive ring
  const driveH = 18;
  if (rocket.drive) {
    const d = DRIVE[rocket.drive.id] ?? DRIVE['drive-warp']!;
    parts.push(
      <g key={`dr-${rocket.drive.id}`} className={anim(rocket.drive.id)}>
        <rect x={BODY_L} y={y} width={BODY_W} height={driveH} fill="#fff8ef" filter="url(#pp-edge)" />
        <ellipse cx="50" cy={y + driveH / 2} rx="40" ry="8" fill={d.fill} filter="url(#pp-edge)" />
        <ellipse cx="50" cy={y + driveH / 2} rx="26" ry="3.5" fill={d.glow} className="anim-twinkle" />
      </g>,
    );
  } else if (ghosts) {
    parts.push(<Ghost key="g-dr" d={`M10 ${y + 9} a40 8 0 1 0 80 0 a40 8 0 1 0 -80 0`} />);
  }
  y += driveH;

  // ---- Fuel tanks (top of stack = last index)
  const tankH = 34;
  const tanksTopDown = [...rocket.tanks].reverse();
  if (tanksTopDown.length === 0 && ghosts) {
    parts.push(<Ghost key="g-tank" d={`M${BODY_L} ${y} h${BODY_W} v${tankH} h-${BODY_W} Z`} />);
    y += tankH;
  }
  tanksTopDown.forEach((t, i) => {
    const color = FUEL_COLOR[t.propellant];
    const dark = FUEL_DARK[t.propellant];
    const ty = y;
    parts.push(
      <g key={`tank-${i}-${rocket.tanks.length}`} className={i === 0 && lastAdded === t.id ? 'anim-drop' : undefined}>
        <rect x={BODY_L} y={ty} width={BODY_W} height={tankH} rx="5" fill={color} filter="url(#pp-edge)" />
        <rect x={BODY_L} y={ty + 6} width={BODY_W} height="5" fill={dark} opacity=".55" />
        <rect x={BODY_L} y={ty + tankH - 11} width={BODY_W} height="5" fill={dark} opacity=".55" />
        <g fill="#2a1747" opacity=".35">
          <circle cx={BODY_L + 5} cy={ty + 18} r="1.5" />
          <circle cx={BODY_L + BODY_W - 5} cy={ty + 18} r="1.5" />
        </g>
      </g>,
    );
    y += tankH;
  });

  // ---- Pressure bottles beside the top tank
  if (rocket.pressure) {
    const top = 6 + capH + (rocket.protection ? 10 : 0) + driveH;
    parts.push(
      <g key={`pr-${rocket.pressure.id}`} className={anim(rocket.pressure.id)} filter="url(#pp-edge-thin)">
        <circle cx={BODY_L - 8} cy={top + 12} r="7" fill="#fff8ef" />
        <circle cx={BODY_L - 8} cy={top + 26} r="6" fill="#b8a1ff" />
      </g>,
    );
  }

  // ---- Engine + fins
  const engH = 26;
  const e = rocket.engine;
  parts.push(
    <g key="fins" filter="url(#pp-edge)">
      <path d={`M${BODY_L} ${y - 26} L${BODY_L - 18} ${y + 8} L${BODY_L} ${y + 2} Z`} fill="#ff7cc6" />
      <path d={`M${BODY_L + BODY_W} ${y - 26} L${BODY_L + BODY_W + 18} ${y + 8} L${BODY_L + BODY_W} ${y + 2} Z`} fill="#ff7cc6" />
    </g>,
  );
  if (e) {
    const nozzles =
      e.id === 'engine-kerolox' || e.id === 'engine-hydrolox' ? 3 : 1;
    const nozzleFill = e.id === 'engine-gascore' ? '#74e0c0' : e.id === 'engine-fusion' ? '#ff7cc6' : '#5b4a7a';
    const nw = nozzles === 1 ? (e.id === 'engine-solid' ? 34 : 28) : 13;
    parts.push(
      <g key={`eng-${e.id}`} className={anim(e.id)}>
        <rect x={BODY_L + 4} y={y} width={BODY_W - 8} height="8" fill="#5b4a7a" filter="url(#pp-edge-thin)" />
        {Array.from({ length: nozzles }, (_, i) => {
          const cx = nozzles === 1 ? 50 : 36 + i * 14;
          return (
            <path
              key={i}
              d={`M${cx - nw / 4} ${y + 8} L${cx + nw / 4} ${y + 8} L${cx + nw / 2} ${y + engH} L${cx - nw / 2} ${y + engH} Z`}
              fill={nozzleFill}
              filter="url(#pp-edge-thin)"
            />
          );
        })}
        {(e.id === 'engine-gascore' || e.id === 'engine-fusion') && (
          <circle cx="50" cy={y + 4} r="4" fill="#fff8ef" className="anim-twinkle" />
        )}
      </g>,
    );
  } else if (ghosts) {
    parts.push(<Ghost key="g-eng" d={`M38 ${y} L62 ${y} L68 ${y + engH} L32 ${y + engH} Z`} />);
  }
  y += engH;

  const H = y + 4;
  const heat = glow === 'heat';
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`sprite ${className}`}
      style={{ width: '100%', height: 'auto', overflow: 'visible' }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-height-ratio={(H / W).toFixed(3)}
    >
      <g style={heat ? { filter: 'sepia(1) saturate(4) hue-rotate(-30deg) brightness(1.05)' } : undefined}>{parts}</g>
    </svg>
  );
}

function Ghost({ d }: { d: string }) {
  return <path d={d} fill="rgba(255,248,239,0.08)" stroke="#fff8ef" strokeWidth="1.6" strokeDasharray="4 3" opacity=".7" />;
}

/** Height-to-width ratio of the drawn rocket, for layout. */
export function rocketAspect(rocket: Rocket): number {
  const h = 6 + 46 + (rocket.protection ? 10 : 0) + 18 + Math.max(1, rocket.tanks.length) * 34 + 26 + 4;
  return h / W;
}
