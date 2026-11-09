import { useEffect, useRef } from 'react';
import { PlanetSprite, TinyStar } from './sprites';

/** Seeded positions so the sky is the same on every visit. */
function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const r = rand(7);
const STARS = Array.from({ length: 80 }, (_, i) => ({
  x: r() * 100,
  y: r() * 100,
  s: 0.35 + r() * 0.9,
  c: i % 6 === 0 ? '#ffe07a' : i % 6 === 1 ? '#ffb7e1' : i % 6 === 2 ? '#c9f0ff' : '#fff8ef',
  tw: i % 3 === 0,
  d: (i % 9) * 0.4,
  depth: i % 3,
}));

function Nebula({ color, d, className, style }: { color: string; d: string; className: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 400 300" className={`absolute ${className}`} style={{ filter: 'drop-shadow(0 18px 0 rgba(10,4,30,.18))', ...style }} aria-hidden="true">
      <path d={d} fill={color} />
    </svg>
  );
}

/**
 * Fixed paper sky behind every screen: layered nebula cut-outs, a far-off
 * spiral galaxy, stars and small paper planets, with gentle scroll parallax.
 */
export function PaperSky() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => ref.current?.style.setProperty('--sy', String(window.scrollY)));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const layer = (k: number): React.CSSProperties => ({ transform: `translate3d(0, calc(var(--sy, 0) * ${-k}px), 0)` });

  return (
    <div ref={ref} className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes sky-drift { 0%,100% { transform: translate(0,0) rotate(0); } 50% { transform: translate(2%, -1.5%) rotate(2deg); } }
        @keyframes shoot { 0%, 86% { transform: translate(0,0) rotate(-24deg) scaleX(0); opacity: 0; } 88% { opacity: 1; transform: translate(0,0) rotate(-24deg) scaleX(1); } 100% { transform: translate(-60vw, 26vw) rotate(-24deg) scaleX(.4); opacity: 0; } }
        .sky-drift { animation: sky-drift 26s ease-in-out infinite; }
      `}</style>

      {/* far layer: deep nebulae and a distant galaxy */}
      <div className="absolute inset-0" style={layer(0.04)}>
        <Nebula
          color="#35226f"
          className="sky-drift -left-[12%] -top-[8%] w-[70vw] min-w-[420px] opacity-80"
          d="M40 160 C20 80 120 20 200 50 C260 0 380 40 370 130 C400 220 300 290 210 250 C130 300 30 260 40 160Z"
        />
        <Nebula
          color="#4a2470"
          className="sky-drift -bottom-[18%] -right-[14%] w-[75vw] min-w-[460px] opacity-70"
          style={{ animationDelay: '-9s' }}
          d="M30 140 C10 60 110 10 190 40 C270 10 390 60 370 150 C380 240 280 300 190 260 C100 300 40 230 30 140Z"
        />
        <svg viewBox="-100 -100 200 200" className="sky-drift absolute right-[5%] top-[10%] w-[min(24vw,280px)] opacity-[.32]" aria-hidden="true" style={{ animationDuration: '40s', transform: 'rotate(-20deg) scaleY(.55)' }}>
          {[0, 1, 2, 3].map((i) => {
            let d = '';
            for (let k = 0; k <= 40; k++) {
              const t = (k / 40) * 8;
              const r = 12 * Math.exp(0.23 * t);
              if (r > 95) break;
              d += `${k ? 'L' : 'M'}${(r * Math.cos(t + (i * Math.PI) / 2)).toFixed(1)} ${(r * Math.sin(t + (i * Math.PI) / 2)).toFixed(1)} `;
            }
            return <path key={i} d={d} fill="none" stroke={i % 2 ? '#ffb7e1' : '#c9b6ff'} strokeWidth="9" strokeLinecap="round" />;
          })}
          <circle r="16" fill="#fff3c4" />
          <circle r="96" fill="#c9b6ff" opacity=".12" />
        </svg>
      </div>

      {/* stars at three depths */}
      {[0.06, 0.12, 0.2].map((k, depth) => (
        <div key={depth} className="absolute inset-0" style={layer(k)}>
          {STARS.filter((s) => s.depth === depth).map((s, i) => (
            <span
              key={i}
              className={`absolute block ${s.tw ? 'anim-twinkle' : ''}`}
              style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${(s.s + depth * 0.35) * 0.9}vmin`, minWidth: 5, animationDelay: `${s.d}s` }}
            >
              <TinyStar color={s.c} />
            </span>
          ))}
        </div>
      ))}

      {/* mid layer: lighter nebula wisps */}
      <div className="absolute inset-0" style={layer(0.1)}>
        <Nebula
          color="#7c4fc4"
          className="sky-drift left-[30%] top-[38%] w-[46vw] min-w-[300px] opacity-[.16]"
          style={{ animationDelay: '-4s' }}
          d="M20 150 C40 90 140 70 210 100 C290 70 390 110 360 170 C330 230 220 210 160 220 C80 240 0 210 20 150Z"
        />
        <Nebula
          color="#e2459f"
          className="sky-drift -left-[6%] top-[58%] w-[38vw] min-w-[260px] opacity-[.12]"
          style={{ animationDelay: '-14s' }}
          d="M30 160 C30 100 120 80 190 110 C260 80 380 120 350 180 C320 240 210 230 150 240 C80 250 30 220 30 160Z"
        />
      </div>

      {/* near layer: little paper planets and a moon */}
      <div className="absolute inset-0" style={layer(0.18)}>
        <span className="anim-bob absolute left-[4%] top-[30%] block w-[min(7vw,70px)] opacity-80" style={{ animationDuration: '9s' }}>
          <PlanetSprite planet={{ name: 'sky-a', eqTempK: 200, planetClass: 'giant' }} />
        </span>
        <span className="anim-bob absolute right-[5%] top-[66%] block w-[min(5vw,52px)] opacity-80" style={{ animationDuration: '11s', animationDelay: '-3s' }}>
          <PlanetSprite planet={{ name: 'sky-b', eqTempK: 1200, planetClass: 'rocky' }} />
        </span>
        <svg viewBox="0 0 60 60" className="anim-bob absolute left-[46%] top-[6%] w-[min(4vw,40px)] opacity-85" style={{ animationDuration: '13s' }} aria-hidden="true">
          <path d="M40 6 A26 26 0 1 0 54 44 A20 20 0 1 1 40 6Z" fill="#fff3c4" filter="url(#pp-edge-thin)" />
        </svg>
      </div>

      {/* shooting star */}
      <span
        className="absolute right-[10%] top-[18%] block h-[3px] w-[18vw] origin-right rounded-full"
        style={{ background: 'linear-gradient(90deg, transparent, #fff8ef)', animation: 'shoot 11s ease-in 3s infinite' }}
      />
    </div>
  );
}
