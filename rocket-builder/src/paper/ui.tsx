import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useReducedMotion } from '../components/useReducedMotion';
import { PipSprite, SpeechTail, type Mood } from './sprites';
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

/** Pip with a speech bubble. */
export function PipSays({ mood = 'happy', children, size = 84, live = true }: { mood?: Mood; children: ReactNode; size?: number; live?: boolean }) {
  return (
    <div className="flex items-end gap-2">
      <div className="anim-bob shrink-0" style={{ width: size }}>
        <PipSprite mood={mood} />
      </div>
      <div className="relative min-w-0 flex-1 pb-6">
        <div className="paper anim-pop px-4 py-3 text-[0.98rem] font-medium leading-snug" aria-live={live ? 'polite' : undefined}>
          {children}
        </div>
        <div className="absolute bottom-[0.6rem] left-3">
          <SpeechTail />
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
      className="paper m-auto max-h-[88vh] w-[min(760px,92vw)] overflow-hidden p-0 backdrop:bg-[#24164f]/75"
    >
      <div className="flex items-center gap-3 border-b-2 border-dashed border-[#e3d3bd] px-5 py-3">
        <h2 id="pm-title" className="m-0 flex-1 text-2xl font-extrabold">
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
  const colors = ['#ff7cc6', '#ffe07a', '#74e0c0', '#8fd3ff', '#b8a1ff', '#ffb48f'];
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
              boxShadow: '0 0 0 1.5px #fff8ef',
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
