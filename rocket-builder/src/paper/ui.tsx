import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useReducedMotion } from '../components/useReducedMotion';
import { PipSprite, type Mood } from './sprites';
import { isMuted, subscribeMuted } from './sfx';

export function RealStamp({ label = 'Real NASA data' }: { label?: string }) {
  return (
    <span className="stamp stamp-real" title="Real value from the NASA Exoplanet Archive or real science">
      {label}
    </span>
  );
}

export function PretendStamp({ label = 'Pretend tech' }: { label?: string }) {
  return (
    <span className="stamp stamp-pretend" title="This technology does not exist. It's here so the game can reach other stars.">
      {label}
    </span>
  );
}

/** 1–5 paper bars. */
export function Bars({ value, label, color = 'var(--pink)' }: { value: number; label: string; color?: string }) {
  return (
    <span className="inline-flex items-center gap-[3px]" role="img" aria-label={`${label}: ${value} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className="inline-block h-3 w-2.5 rounded-[3px]"
          style={{
            background: i < value ? color : 'rgba(42,23,71,.14)',
            boxShadow: i < value ? '0 1.5px 0 rgba(42,23,71,.3)' : 'none',
          }}
        />
      ))}
    </span>
  );
}

/** Flight-computer readout (the old "Pip says" bubble), styled like a FRONTIER dialog. */
export function PipSays({ mood = 'happy', children, size = 56, live = true }: { mood?: Mood; children: ReactNode; size?: number; live?: boolean }) {
  const accent = mood === 'sad' ? '#e04a3a' : mood === 'wow' ? '#ffc94a' : '#39d0e8';
  return (
    <div className="flex items-stretch gap-0 border-[3px] bg-navy0" style={{ borderColor: accent, boxShadow: '4px 4px 0 #05060f' }}>
      <div className="grid shrink-0 place-items-center border-r-[3px] bg-navy1 p-1.5" style={{ borderColor: accent, width: size + 12 }}>
        <div className="w-full">
          <PipSprite mood={mood} />
        </div>
      </div>
      <div className="min-w-0 flex-1 px-3 py-2">
        <p className="font-title text-[8px] tracking-wider" style={{ color: accent }}>
          FLIGHT COMPUTER<span className="blink">_</span>
        </p>
        <div className="mt-1 text-[1rem] leading-snug" aria-live={live ? 'polite' : undefined}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Paper modal on <dialog>: focus trap, Esc closes, focus returns. */
export function PaperModal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="pm-title"
      className="m-auto max-h-[88vh] w-[min(760px,92vw)] overflow-hidden border-4 border-cyan bg-navy0 p-0 text-cream backdrop:bg-[#05060f]/75"
      style={{ boxShadow: 'inset 3px 3px 0 #1e2557, 6px 6px 0 #05060f' }}
    >
      <div className="flex items-center gap-3 border-b-[3px] border-navy2 px-5 py-3">
        <span className="h-3 w-3 bg-tomato blink" aria-hidden="true" />
        <h2 id="pm-title" className="m-0 flex-1 font-title text-[12px] text-cyan">
          {title}
        </h2>
        <button type="button" className="pbtn pbtn-paper pbtn-icon" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="max-h-[calc(88vh-4.5rem)] overflow-y-auto px-5 py-4">{children}</div>
    </dialog>
  );
}

/** Animated number that counts up. */
export function CountUp({ to, ms = 1200, onDone }: { to: number; ms?: number; onDone?: () => void }) {
  const { reduced } = useReducedMotion();
  const [n, setN] = useState(reduced ? to : 0);
  useEffect(() => {
    if (reduced) {
      setN(to);
      onDone?.();
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
      else onDone?.();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, ms, reduced]);
  return <span className="tabular">{n.toLocaleString('en-US')}</span>;
}

export const useMuted = (): boolean => useSyncExternalStore(subscribeMuted, isMuted, () => false);

/** Scatter of confetti strips. */
export function Confetti({ count = 40 }: { count?: number }) {
  const { reduced } = useReducedMotion();
  if (reduced) return null;
  const colors = ['#f06aa8', '#ffc94a', '#5fd3c8', '#39d0e8', '#a98be0', '#f28c28'];
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const left = (i * 37) % 100;
        const delay = (i % 10) * 0.12;
        const dur = 2.6 + (i % 7) * 0.25;
        return (
          <span
            key={i}
            className="absolute top-0 block h-4 w-2.5 rounded-[2px]"
            style={{
              left: `${left}%`,
              background: colors[i % colors.length],
              boxShadow: '0 0 0 1.5px #05060f',
              animation: `confetti ${dur}s ${delay}s cubic-bezier(.3,.6,.6,1) both`,
              ['--dx' as string]: `${((i * 53) % 120) - 60}px`,
              ['--rot' as string]: `${360 + ((i * 97) % 540)}deg`,
            }}
          />
        );
      })}
    </div>
  );
}
