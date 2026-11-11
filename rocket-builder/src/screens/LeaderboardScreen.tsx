import { useEffect, useState, type KeyboardEvent } from 'react';
import { DIFFICULTIES, type Difficulty } from '../engine';
import { LEVEL } from '../paper/kid';
import { sfx } from '../paper/sfx';
import { PipSays } from '../paper/ui';
import { getLeaderboard, type LeaderboardEntry } from '../services/leaderboard';
import { useGame } from '../store/gameStore';

const RIBBON = ['#ffe07a', '#e6dcf5', '#ffb48f'];

export function LeaderboardScreen() {
  const current = useGame((s) => s.difficulty);
  const go = useGame((s) => s.go);
  const [tab, setTab] = useState<Difficulty>(current ?? 'easy');
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const service = getLeaderboard();

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError(null);
    service
      .list(tab, 20)
      .then((r) => alive && setRows(r))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Could not load the scores.'));
    return () => {
      alive = false;
    };
  }, [tab, service]);

  const onKey = (e: KeyboardEvent) => {
    const i = DIFFICULTIES.indexOf(tab);
    const n = e.key === 'ArrowRight' ? (i + 1) % 3 : e.key === 'ArrowLeft' ? (i + 2) % 3 : -1;
    if (n < 0) return;
    e.preventDefault();
    const d = DIFFICULTIES[n]!;
    setTab(d);
    document.getElementById(`lb-${d}`)?.focus();
  };

  return (
    <div className="gutter mx-auto max-w-3xl pt-6">
      <h1 className="text-center text-4xl font-black text-cream sm:text-5xl">High scores</h1>
      <div role="tablist" aria-label="Rank" className="mt-5 flex justify-center gap-3" onKeyDown={onKey}>
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            id={`lb-${d}`}
            role="tab"
            type="button"
            aria-selected={tab === d}
            aria-controls="lb-panel"
            tabIndex={tab === d ? 0 : -1}
            onClick={() => {
              sfx.click();
              setTab(d);
            }}
            className={`pbtn pbtn-sm ${tab === d ? '' : 'pbtn-paper'}`}
          >
            {LEVEL[d].name}
          </button>
        ))}
      </div>
      <section id="lb-panel" role="tabpanel" aria-labelledby={`lb-${tab}`} className="paper tape relative mt-6 px-5 pb-5 pt-7">
        {error && <p className="font-bold text-[#ff8f86]">{error}</p>}
        {!rows && !error && <p className="font-semibold">Loading…</p>}
        {rows && rows.length === 0 && (
          <PipSays mood="think" live={false}>
            No scores yet for {LEVEL[tab].name}. Finish 10 tries to be the first!
          </PipSays>
        )}
        {rows && rows.length > 0 && (
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <li
                key={`${r.name}-${r.createdAt}`}
                className="anim-rise flex items-center gap-3 rounded-2xl bg-[#1e2557] px-3 py-2"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-lg font-black"
                  style={{ background: RIBBON[i] ?? '#fff8ef', boxShadow: '0 0 0 3px #05060f, 0 3px 0 3px rgba(42,23,71,.2)' }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-xl font-extrabold">{r.name}</span>
                <span className="tabular font-display text-2xl font-black text-[#f06aa8]">{Math.round(r.average)}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 text-xs text-ink/70">Average score over 10 tries. Saved in: {service.label}.</p>
      </section>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" className="pbtn pbtn-paper" onClick={() => go('title')}>
          Home
        </button>
        <button type="button" className="pbtn" onClick={() => go('difficulty')}>
          Play
        </button>
      </div>
    </div>
  );
}
