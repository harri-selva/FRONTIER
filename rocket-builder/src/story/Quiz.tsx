import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { sfx } from '../paper/sfx';
import { Icon } from '../paper/sprites';

export type QuizSpec =
  | { kind: 'number'; question: ReactNode; answer: number; tolerance: number; unit?: string; working: ReactNode }
  | { kind: 'choice'; question: ReactNode; options: string[]; correct: number; working: ReactNode };

/** "Your turn" question. Correct answers unlock the next file. */
export function Quiz({ spec, onCorrect, solved }: { spec: QuizSpec; onCorrect: () => void; solved: boolean }) {
  const id = useId();
  const [value, setValue] = useState('');
  const [state, setState] = useState<'idle' | 'right' | 'wrong'>(solved ? 'right' : 'idle');
  const [showWork, setShowWork] = useState(false);

  const judge = (ok: boolean) => {
    if (ok) {
      sfx.win();
      setState('right');
      onCorrect();
    } else {
      sfx.nope();
      setState('wrong');
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (spec.kind !== 'number') return;
    const n = Number(value.replace(/,/g, ''));
    judge(Number.isFinite(n) && Math.abs(n - spec.answer) <= spec.tolerance);
  };

  return (
    <section className="rounded-2xl border-[3px] border-dashed border-[#f06aa8]/50 bg-[#2b1d4f] p-4" aria-labelledby={`${id}-q`}>
      <h3 id={`${id}-q`} className="flex items-center gap-2 font-display text-xl font-black text-[#f06aa8]">
        <Icon name="star" /> Your turn, Agent
      </h3>
      <div className="mt-1 text-[1.02rem] font-medium">{spec.question}</div>
      {spec.kind === 'number' ? (
        <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor={`${id}-a`} className="sr-only">
            Your answer
          </label>
          <input
            id={`${id}-a`}
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={state === 'right'}
            className="w-36 rounded-xl border-0 bg-paper px-3 py-2 font-display text-xl font-bold shadow-[inset_0_3px_0_rgba(42,23,71,.15)]"
          />
          {spec.unit && <span className="font-bold">{spec.unit}</span>}
          {state !== 'right' && (
            <button type="submit" className="pbtn pbtn-sm">
              Check
            </button>
          )}
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Answers">
          {spec.options.map((o, i) => (
            <button
              key={o}
              type="button"
              disabled={state === 'right'}
              onClick={() => judge(i === spec.correct)}
              className={`pbtn pbtn-sm ${state === 'right' && i === spec.correct ? 'pbtn-mint' : 'pbtn-paper'}`}
            >
              {o}
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 min-h-[1.5em] font-bold" role="status">
        {state === 'right' && <span className="text-leaf">Correct! File unlocked.</span>}
        {state === 'wrong' && <span className="text-[#ff8f86]">Not quite. Try again, or peek at the working.</span>}
      </p>
      <button type="button" className="text-sm font-bold underline decoration-2 underline-offset-4" aria-expanded={showWork} onClick={() => setShowWork(!showWork)}>
        {showWork ? 'Hide the working' : 'Show me how'}
      </button>
      {showWork && <div className="mt-2 rounded-xl bg-paper p-3 text-sm">{spec.working}</div>}
    </section>
  );
}
