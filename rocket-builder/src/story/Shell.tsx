import type { ReactNode } from 'react';
import { PipSprite, type Mood } from '../paper/sprites';
import { RealStamp } from '../paper/ui';

export interface Line {
  who: 'pip' | 'director';
  mood?: Mood;
  text: ReactNode;
}

function Speaker({ who, mood }: { who: Line['who']; mood?: Mood }) {
  if (who === 'pip') return <PipSprite mood={mood ?? 'happy'} />;
  return (
    <svg viewBox="0 0 100 120" className="sprite" aria-hidden="true">
      <g filter="url(#pp-edge)">
        <rect x="22" y="70" width="56" height="46" rx="16" fill="#3b2577" />
        <circle cx="50" cy="44" r="28" fill="#c98b6b" />
        <path d="M22 40 Q24 12 50 12 Q78 12 78 40 Q70 26 50 26 Q30 26 22 40Z" fill="#2a1747" />
      </g>
      <rect x="30" y="38" width="16" height="11" rx="4" fill="none" stroke="#2a1747" strokeWidth="3" />
      <rect x="54" y="38" width="16" height="11" rx="4" fill="none" stroke="#2a1747" strokeWidth="3" />
      <path d="M46 43 h8" stroke="#2a1747" strokeWidth="3" />
      <path d="M40 60 Q50 66 60 60" stroke="#2a1747" strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="44" y="80" width="12" height="16" fill="#ffe07a" />
    </svg>
  );
}

/** Story dialogue: alternating Pip and the (fictional) Director. */
export function Dialogue({ lines }: { lines: Line[] }) {
  return (
    <ol className="space-y-3">
      {lines.map((l, i) => (
        <li key={i} className={`anim-rise flex items-end gap-3 ${l.who === 'director' ? 'flex-row-reverse text-right' : ''}`} style={{ animationDelay: `${i * 0.12}s` }}>
          <span className="w-14 shrink-0">
            <Speaker who={l.who} mood={l.mood} />
          </span>
          <div className={`min-w-0 flex-1 rounded-2xl px-4 py-2.5 font-medium shadow-[0_3px_0_rgba(42,23,71,.15)] ${l.who === 'pip' ? 'bg-[#2b2f73]' : 'bg-[#3d2a7a]'}`}>
            <p className="text-xs font-extrabold uppercase tracking-wider text-ink/60">{l.who === 'pip' ? 'Flight computer' : 'Director Okafor'}</p>
            <div>{l.text}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The maths on a chalkboard card. */
export function Chalkboard({ formula, children }: { formula: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-[#0b0e2a] p-4 text-cream shadow-[0_0_0_4px_#05060f,0_6px_0_4px_rgba(42,23,71,.25)]" aria-label="The maths">
      <p className="text-xs font-extrabold uppercase tracking-widest text-butter">The maths</p>
      <p className="mt-1 font-display text-[clamp(1.3rem,3.4vw,2rem)] font-black text-butter">{formula}</p>
      <div className="mt-2 space-y-1.5 text-[0.98rem] text-[#2b2f73]">{children}</div>
    </section>
  );
}

export function RealNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-2 rounded-2xl bg-[#0d2f5a] p-3 text-[0.95rem]">
      <RealStamp label="Real data" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Widget({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-[#1e2557] p-4" aria-label={title}>
      <p className="text-xs font-extrabold uppercase tracking-widest text-ink/60">Try it</p>
      <h3 className="font-display text-xl font-black">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function Slider({ id, label, min, max, step, value, onChange, display }: { id: string; label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; display: string }) {
  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-bold">
          {label}
        </label>
        <span className="tabular font-display text-lg font-black text-[#f06aa8]">{display}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" aria-valuetext={display} />
    </div>
  );
}

export const fmt = (n: number, dp = 2) => n.toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: dp });
export const fmt0 = (n: number) => Math.round(n).toLocaleString('en-US');
