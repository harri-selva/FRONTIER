import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Cabinet } from '../components/Cabinet';
import { fmt } from '../components/format';
import { DIFFICULTIES, DIFFICULTY_CONFIG, type Difficulty } from '../engine';
import { getLeaderboard, type LeaderboardEntry } from '../services/leaderboard';
import { useGame } from '../store/gameStore';

export function LeaderboardScreen() {
  const current = useGame((s) => s.difficulty);
  const go = useGame((s) => s.go);
  const [tab, setTab] = useState<Difficulty>(current ?? 'easy');
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});
  const service = getLeaderboard();

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError(null);
    service
      .list(tab, 20)
      .then((r) => alive && setRows(r))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Could not load the leaderboard.'));
    return () => {
      alive = false;
    };
  }, [tab, service]);

  const onKey = (e: KeyboardEvent) => {
    const i = DIFFICULTIES.indexOf(tab);
    let n = i;
    if (e.key === 'ArrowRight') n = (i + 1) % DIFFICULTIES.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + DIFFICULTIES.length) % DIFFICULTIES.length;
    else return;
    e.preventDefault();
    const d = DIFFICULTIES[n]!;
    setTab(d);
    tabs.current[d]?.focus();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 font-display text-lg sm:text-xl">
        <span className="chrome">High scores</span>
      </h1>
      <div role="tablist" aria-label="Difficulty" className="mb-3 flex gap-2" onKeyDown={onKey}>
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            ref={(el) => {
              tabs.current[d] = el;
            }}
            role="tab"
            type="button"
            id={`lb-tab-${d}`}
            aria-selected={tab === d}
            aria-controls="lb-panel"
            tabIndex={tab === d ? 0 : -1}
            onClick={() => setTab(d)}
            className={`btn ${tab === d ? 'btn-primary' : 'btn-ghost'}`}
          >
            {DIFFICULTY_CONFIG[d].label}
          </button>
        ))}
      </div>
      <Cabinet title={`${DIFFICULTY_CONFIG[tab].label} · top 20`} id="lb" right={<span className="text-[0.5rem]">{service.label}</span>}>
        <div role="tabpanel" id="lb-panel" aria-labelledby={`lb-tab-${tab}`}>
          {error && <p className="text-[#ffb3c3]">{error}</p>}
          {!rows && !error && <p className="readout text-cyber">Loading…</p>}
          {rows && rows.length === 0 && <p className="text-haze">No scores yet. Finish a 10-attempt run to be first.</p>}
          {rows && rows.length > 0 && (
            <table className="w-full text-left">
              <caption className="sr-only">{DIFFICULTY_CONFIG[tab].label} leaderboard, average score over 10 attempts</caption>
              <thead>
                <tr className="font-display text-[0.55rem] text-neonsoft">
                  <th scope="col" className="py-2">#</th>
                  <th scope="col">Name</th>
                  <th scope="col" className="text-right">Average</th>
                  <th scope="col" className="hidden text-right sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.name}-${r.createdAt}`} className={`border-t border-[#6b4ba8] ${i < 3 ? 'text-neonsoft' : 'text-haze'}`}>
                    <td className="readout py-1 text-xl">{i + 1}</td>
                    <td className="readout text-xl">{r.name}</td>
                    <td className="readout text-right text-xl text-cyber">{fmt(r.average, 1)}</td>
                    <td className="hidden text-right text-sm text-[#c3b2e8] sm:table-cell">{r.createdAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Cabinet>
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button type="button" className="btn btn-ghost" onClick={() => go('title')}>
          Title screen
        </button>
        <button type="button" className="btn btn-primary" onClick={() => go('difficulty')}>
          Play
        </button>
      </div>
    </div>
  );
}
