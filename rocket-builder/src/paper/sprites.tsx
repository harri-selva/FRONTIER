/*
 * Cut-paper sprites. Simple flat shapes; the #pp-edge filter adds the white
 * paper edge and .sprite adds the cast shadow. All original artwork.
 */
import type { CSSProperties } from 'react';
import type { Planet } from '../engine';

interface SpriteProps {
  className?: string;
  style?: CSSProperties;
  title?: string;
}

const svgProps = (vb: string, p: SpriteProps) => ({
  viewBox: vb,
  className: `sprite ${p.className ?? ''}`,
  style: { width: '100%', height: 'auto', ...p.style },
  role: p.title ? 'img' : undefined,
  'aria-label': p.title,
  'aria-hidden': p.title ? undefined : true,
});

export function StarSprite({ color = '#ffe07a', ...p }: SpriteProps & { color?: string }) {
  return (
    <svg {...svgProps('0 0 100 100', p)}>
      <path
        filter="url(#pp-edge)"
        fill={color}
        d="M50 6 L62 37 L95 38 L69 58 L79 91 L50 72 L21 91 L31 58 L5 38 L38 37 Z"
        strokeLinejoin="round"
      />
      <circle cx="42" cy="44" r="4" fill="#2a1747" opacity=".75" />
      <circle cx="58" cy="44" r="4" fill="#2a1747" opacity=".75" />
    </svg>
  );
}

export function TinyStar({ color = '#fff8ef', ...p }: SpriteProps & { color?: string }) {
  return (
    <svg {...svgProps('0 0 20 20', p)} className={`sprite sprite-flat ${p.className ?? ''}`}>
      <path fill={color} d="M10 0 L12.5 7.5 L20 10 L12.5 12.5 L10 20 L7.5 12.5 L0 10 L7.5 7.5 Z" />
    </svg>
  );
}

export function CloudSprite({ color = '#fff8ef', ...p }: SpriteProps & { color?: string }) {
  return (
    <svg {...svgProps('0 0 200 90', p)}>
      <g filter="url(#pp-edge)" fill={color}>
        <circle cx="60" cy="55" r="30" />
        <circle cx="100" cy="40" r="36" />
        <circle cx="145" cy="55" r="28" />
        <rect x="35" y="55" width="135" height="30" rx="15" />
      </g>
      <path d="M50 75 Q100 85 160 74" stroke="#e6d6f7" strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function HillSprite({ color = '#74e0c0', dark = '#3cae8e', ...p }: SpriteProps & { color?: string; dark?: string }) {
  return (
    <svg {...svgProps('0 0 400 120', p)}>
      <g filter="url(#pp-edge)">
        <path fill={color} d="M0 120 L0 80 Q60 20 130 55 Q200 0 270 50 Q340 15 400 70 L400 120 Z" />
      </g>
      <path fill={dark} opacity=".35" d="M0 120 L0 100 Q120 70 220 95 Q320 75 400 98 L400 120 Z" />
    </svg>
  );
}

/** Vaporwave sun made of paper strips. */
export function SunSprite(p: SpriteProps) {
  return (
    <svg {...svgProps('0 0 200 200', p)}>
      <g filter="url(#pp-edge)">
        <circle cx="100" cy="100" r="90" fill="#ff7cc6" />
        <path d="M10 100 A90 90 0 0 1 190 100 Z" fill="#ffe07a" />
        <path d="M22 60 A90 90 0 0 1 178 60 Z" fill="#ffb48f" opacity=".0" />
      </g>
      <g fill="#24164f">
        <rect x="0" y="112" width="200" height="6" />
        <rect x="0" y="132" width="200" height="9" />
        <rect x="0" y="155" width="200" height="12" />
      </g>
    </svg>
  );
}

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
};

export function planetColors(eqTempK: number): { base: string; band: string; spot: string } {
  if (eqTempK < 250) return { base: '#8fd3ff', band: '#cfeeff', spot: '#5fa8e8' };
  if (eqTempK < 360) return { base: '#74e0c0', band: '#bff5e3', spot: '#3cae8e' };
  if (eqTempK < 750) return { base: '#ffb48f', band: '#ffe0c9', spot: '#e98a63' };
  if (eqTempK < 1500) return { base: '#ff7c7c', band: '#ffc0a8', spot: '#d9485f' };
  return { base: '#ff7cc6', band: '#ffe07a', spot: '#e2459f' };
}

export function PlanetSprite({ planet, ...p }: SpriteProps & { planet: Pick<Planet, 'name' | 'eqTempK' | 'planetClass'> }) {
  const c = planetColors(planet.eqTempK);
  const h = hash(planet.name);
  const tilt = (h % 40) - 20;
  const giant = planet.planetClass === 'giant';
  return (
    <svg {...svgProps('0 0 200 200', p)}>
      {giant && (
        <ellipse cx="100" cy="100" rx="96" ry="22" fill="none" stroke="#b8a1ff" strokeWidth="10" transform={`rotate(${tilt} 100 100)`} filter="url(#pp-edge-thin)" />
      )}
      <g filter="url(#pp-edge)">
        <circle cx="100" cy="100" r="70" fill={c.base} />
      </g>
      <clipPath id={`pc-${h}`}>
        <circle cx="100" cy="100" r="70" />
      </clipPath>
      <mask id={`pm-${h}`}>
        <rect width="200" height="200" fill="#fff" />
        <circle cx="86" cy="86" r="70" fill="#000" />
      </mask>
      <g clipPath={`url(#pc-${h})`}>
        {giant ? (
          <g transform={`rotate(${tilt} 100 100)`}>
            <rect x="20" y="62" width="160" height="12" rx="6" fill={c.band} />
            <rect x="20" y="92" width="160" height="18" rx="9" fill={c.spot} opacity=".55" />
            <rect x="20" y="126" width="160" height="10" rx="5" fill={c.band} />
          </g>
        ) : (
          <>
            <circle cx={70 + (h % 30)} cy={70 + (h % 17)} r="14" fill={c.spot} opacity=".7" />
            <circle cx={120 + (h % 13)} cy={115 - (h % 11)} r="20" fill={c.spot} opacity=".55" />
            <circle cx={88} cy={140} r="9" fill={c.band} opacity=".9" />
            <path d={`M30 ${95 + (h % 9)} Q100 ${70 + (h % 20)} 170 ${100 - (h % 9)}`} stroke={c.band} strokeWidth="8" fill="none" opacity=".7" strokeLinecap="round" />
          </>
        )}
        <circle cx="70" cy="68" r="28" fill="#fff" opacity=".18" />
        <circle cx="100" cy="100" r="70" fill="#2a1747" opacity=".16" mask={`url(#pm-${h})`} />
      </g>
      {giant && (
        <path
          d={`M4 100 A96 22 0 0 0 196 100`}
          fill="none"
          stroke="#b8a1ff"
          strokeWidth="10"
          transform={`rotate(${tilt} 100 100)`}
          filter="url(#pp-edge-thin)"
        />
      )}
    </svg>
  );
}

export function EarthSprite(p: SpriteProps) {
  return (
    <svg {...svgProps('0 0 200 200', p)}>
      <g filter="url(#pp-edge)">
        <circle cx="100" cy="100" r="80" fill="#5fa8e8" />
      </g>
      <clipPath id="earth-clip">
        <circle cx="100" cy="100" r="80" />
      </clipPath>
      <g clipPath="url(#earth-clip)" fill="#74e0c0">
        <path d="M40 60 Q70 40 95 62 Q90 90 60 95 Q40 85 40 60Z" />
        <path d="M110 110 Q150 95 165 125 Q150 160 120 150 Q100 135 110 110Z" />
        <path d="M120 40 Q140 35 150 50 Q138 60 122 55Z" />
        <rect x="20" y="168" width="160" height="20" fill="#fff8ef" />
        <rect x="20" y="16" width="160" height="14" fill="#fff8ef" />
      </g>
    </svg>
  );
}

export function TowerSprite(p: SpriteProps) {
  return (
    <svg {...svgProps('0 0 60 220', p)}>
      <g filter="url(#pp-edge)">
        <rect x="14" y="10" width="32" height="210" fill="#ff7cc6" />
        <rect x="40" y="40" width="20" height="8" fill="#ff7cc6" />
        <rect x="40" y="110" width="20" height="8" fill="#ff7cc6" />
      </g>
      <g stroke="#2a1747" strokeWidth="2.5" opacity=".55">
        {Array.from({ length: 10 }, (_, i) => (
          <path key={i} d={`M14 ${12 + i * 21} L46 ${33 + i * 21} M46 ${12 + i * 21} L14 ${33 + i * 21}`} />
        ))}
      </g>
      <circle cx="30" cy="8" r="6" fill="#ff5d73" className="anim-twinkle" />
    </svg>
  );
}

export function PadSprite(p: SpriteProps) {
  return (
    <svg {...svgProps('0 0 200 40', p)}>
      <g filter="url(#pp-edge)">
        <rect x="10" y="8" width="180" height="16" rx="4" fill="#b8a1ff" />
        <rect x="30" y="24" width="20" height="16" fill="#8a6fe0" />
        <rect x="150" y="24" width="20" height="16" fill="#8a6fe0" />
      </g>
      <g fill="#ffe07a">
        <rect x="20" y="13" width="18" height="6" />
        <rect x="58" y="13" width="18" height="6" />
        <rect x="124" y="13" width="18" height="6" />
        <rect x="162" y="13" width="18" height="6" />
      </g>
    </svg>
  );
}

export type Mood = 'happy' | 'wow' | 'sad' | 'think';

/** Pip: the paper robot guide. Original character. */
export function PipSprite({ mood = 'happy', ...p }: SpriteProps & { mood?: Mood }) {
  const mouth =
    mood === 'happy' ? 'M40 66 Q50 76 60 66' : mood === 'wow' ? '' : mood === 'sad' ? 'M40 72 Q50 64 60 72' : 'M42 70 L58 68';
  return (
    <svg {...svgProps('0 0 100 130', p)}>
      <g filter="url(#pp-edge)">
        <path d="M50 4 L50 22" stroke="#2a1747" strokeWidth="4" />
        <path d="M50 0 L54 7 L61 8 L56 13 L57 20 L50 17 L43 20 L44 13 L39 8 L46 7 Z" fill="#ffe07a" />
        <rect x="14" y="22" width="72" height="62" rx="18" fill="#b8a1ff" />
        <rect x="6" y="44" width="10" height="22" rx="5" fill="#ff7cc6" />
        <rect x="84" y="44" width="10" height="22" rx="5" fill="#ff7cc6" />
        <rect x="26" y="88" width="48" height="34" rx="12" fill="#ff7cc6" />
        <rect x="8" y="92" width="18" height="10" rx="5" fill="#b8a1ff" />
        <rect x="74" y="92" width="18" height="10" rx="5" fill="#b8a1ff" />
      </g>
      <rect x="24" y="34" width="52" height="40" rx="12" fill="#fff8ef" />
      {mood === 'sad' ? (
        <>
          <path d="M33 52 Q38 47 43 52" stroke="#2a1747" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M57 52 Q62 47 67 52" stroke="#2a1747" strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="38" cy="52" rx={mood === 'wow' ? 6 : 5} ry={mood === 'wow' ? 7 : 6} fill="#2a1747" />
          <ellipse cx="62" cy="52" rx={mood === 'wow' ? 6 : 5} ry={mood === 'wow' ? 7 : 6} fill="#2a1747" />
          <circle cx="40" cy="50" r="1.8" fill="#fff" />
          <circle cx="64" cy="50" r="1.8" fill="#fff" />
        </>
      )}
      {mood === 'wow' ? <ellipse cx="50" cy="67" rx="5" ry="6" fill="#2a1747" /> : <path d={mouth} stroke="#2a1747" strokeWidth="4" fill="none" strokeLinecap="round" />}
      <circle cx="30" cy="64" r="4" fill="#ff7cc6" opacity=".6" />
      <circle cx="70" cy="64" r="4" fill="#ff7cc6" opacity=".6" />
      <path d="M44 100 L50 108 L56 100" stroke="#fff8ef" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AstronautSprite({ color = '#fff8ef', visor = '#8fd3ff', ...p }: SpriteProps & { color?: string; visor?: string }) {
  return (
    <svg {...svgProps('0 0 60 80', p)}>
      <g filter="url(#pp-edge-thin)">
        <rect x="14" y="40" width="32" height="34" rx="10" fill={color} />
        <circle cx="30" cy="26" r="20" fill={color} />
      </g>
      <rect x="17" y="17" width="26" height="18" rx="9" fill={visor} />
      <path d="M21 22 Q26 19 30 21" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <rect x="24" y="48" width="12" height="8" rx="2" fill="#ff7cc6" />
    </svg>
  );
}

export function FlameSprite(p: SpriteProps) {
  return (
    <svg {...svgProps('0 0 60 120', p)} className={`sprite sprite-flat ${p.className ?? ''}`}>
      <g className="anim-flicker">
        <path d="M30 120 C5 80 8 40 30 0 C52 40 55 80 30 120Z" fill="#ff7cc6" />
        <path d="M30 105 C14 75 16 45 30 18 C44 45 46 75 30 105Z" fill="#ffb48f" />
        <path d="M30 88 C22 68 22 50 30 34 C38 50 38 68 30 88Z" fill="#ffe07a" />
      </g>
    </svg>
  );
}

export function PuffSprite({ color = '#fff8ef', ...p }: SpriteProps & { color?: string }) {
  return (
    <svg {...svgProps('0 0 100 80', p)}>
      <g filter="url(#pp-edge-thin)" fill={color}>
        <circle cx="30" cy="48" r="24" />
        <circle cx="58" cy="34" r="28" />
        <circle cx="76" cy="54" r="20" />
      </g>
    </svg>
  );
}

export function WaveSprite({ color = '#5fa8e8', ...p }: SpriteProps & { color?: string }) {
  return (
    <svg {...svgProps('0 0 400 60', p)} preserveAspectRatio="none">
      <g filter="url(#pp-edge)">
        <path
          fill={color}
          d="M0 60 L0 25 Q25 5 50 25 T100 25 T150 25 T200 25 T250 25 T300 25 T350 25 T400 25 L400 60 Z"
        />
      </g>
    </svg>
  );
}

export function ParachuteSprite(p: SpriteProps) {
  return (
    <svg {...svgProps('0 0 120 110', p)}>
      <g filter="url(#pp-edge)">
        <path d="M5 50 Q60 -20 115 50 Q100 40 87 50 Q74 40 60 50 Q46 40 33 50 Q20 40 5 50Z" fill="#ff7cc6" />
        <path d="M33 50 Q46 40 60 50 Q60 10 60 8 Q38 15 33 50Z" fill="#ffe07a" />
        <path d="M87 50 Q74 40 60 50 Q60 10 60 8 Q82 15 87 50Z" fill="#8fd3ff" />
      </g>
      <g stroke="#fff8ef" strokeWidth="2">
        <path d="M5 50 L52 104 M33 50 L56 104 M60 50 L60 104 M87 50 L64 104 M115 50 L68 104" />
      </g>
    </svg>
  );
}

export function SpeechTail({ color = '#fff8ef' }: { color?: string }) {
  return (
    <svg viewBox="0 0 30 24" width="30" height="24" aria-hidden="true" style={{ display: 'block' }}>
      <path d="M0 0 L30 0 L6 24 Z" fill={color} />
    </svg>
  );
}

/* ---------- Small icons used in gauges and cards ---------- */

type IconName = 'lift' | 'fuel' | 'warp' | 'coin' | 'radio' | 'heat' | 'pump' | 'crew' | 'weight' | 'power' | 'eff' | 'check' | 'cross' | 'star' | 'sound' | 'mute' | 'motion' | 'book' | 'trophy' | 'back' | 'home' | 'ruler' | 'thermo' | 'gravity' | 'clock';

export function Icon({ name, size = 22, color = 'currentColor', label }: { name: IconName; size?: number; color?: string; label?: string }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, role: label ? 'img' : undefined, 'aria-label': label, 'aria-hidden': label ? undefined : true };
  switch (name) {
    case 'lift':
      return <svg {...common}><path d="M12 20V5M6 11l6-6 6 6" /></svg>;
    case 'fuel':
      return <svg {...common}><path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" /></svg>;
    case 'warp':
      return <svg {...common}><path d="M12 12m-2 0a2 2 0 1 0 4 0a4 4 0 1 0-8 0a6 6 0 1 0 12 0a8 8 0 1 0-16 0" /></svg>;
    case 'coin':
      return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v8M9.5 10.2c0-1.2 5-1.6 5 .4 0 2-5 1.4-5 3.4 0 1.8 5 1.6 5 .2" /></svg>;
    case 'radio':
      return <svg {...common}><path d="M12 13v8M8 21h8M8.5 9.5a5 5 0 0 1 7 0M5.5 6.5a9 9 0 0 1 13 0" /><circle cx="12" cy="12.5" r="1.2" fill={color} /></svg>;
    case 'heat':
      return <svg {...common}><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /></svg>;
    case 'pump':
      return <svg {...common}><circle cx="12" cy="13" r="7" /><path d="M12 13l3-3M12 3v3" /></svg>;
    case 'crew':
      return <svg {...common}><circle cx="12" cy="9" r="5" /><path d="M5 21c1-4 4-6 7-6s6 2 7 6" /></svg>;
    case 'weight':
      return <svg {...common}><path d="M6 20h12l-2-11H8zM9 9a3 3 0 0 1 6 0" /></svg>;
    case 'power':
      return <svg {...common}><path d="M13 2L5 14h6l-1 8 8-12h-6z" /></svg>;
    case 'eff':
      return <svg {...common}><path d="M4 18a8 8 0 1 1 16 0M12 18l4-6" /></svg>;
    case 'check':
      return <svg {...common} strokeWidth={3.2}><path d="M5 12.5l4.5 4.5L19 7" /></svg>;
    case 'cross':
      return <svg {...common} strokeWidth={3.2}><path d="M6 6l12 12M18 6L6 18" /></svg>;
    case 'star':
      return <svg {...common}><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>;
    case 'sound':
      return <svg {...common}><path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" /></svg>;
    case 'mute':
      return <svg {...common}><path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6" /></svg>;
    case 'motion':
      return <svg {...common}><path d="M3 12c3-6 6-6 9 0s6 6 9 0" /></svg>;
    case 'book':
      return <svg {...common}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5" /></svg>;
    case 'trophy':
      return <svg {...common}><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4M12 13v4M8 21h8M9 17h6" /></svg>;
    case 'back':
      return <svg {...common}><path d="M15 5l-7 7 7 7" /></svg>;
    case 'home':
      return <svg {...common}><path d="M4 11l8-7 8 7v9H4z" /></svg>;
    case 'ruler':
      return <svg {...common}><path d="M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2" /></svg>;
    case 'thermo':
      return <svg {...common}><path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z" /></svg>;
    case 'gravity':
      return <svg {...common}><path d="M12 3v14M7 12l5 5 5-5M5 21h14" /></svg>;
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>;
  }
}
