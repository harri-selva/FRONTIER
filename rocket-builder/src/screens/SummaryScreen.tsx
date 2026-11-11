import { useState, type FormEvent } from 'react';
import { ATTEMPTS_PER_RUN, runAverage } from '../engine';
import { LEVEL } from '../paper/kid';
import { sfx } from '../paper/sfx';
import { PipSprite, StarSprite } from '../paper/sprites';
import { Confetti, CountUp } from '../paper/ui';
import { getLeaderboard } from '../services/leaderboard';
import { MAX_NAME_LENGTH, checkName } from '../services/nameFilter';
import { useGame } from '../store/gameStore';

export function SummaryScreen() {
  const difficulty = useGame((s) => s.difficulty);
  const runs = useGame((s) => s.runs);
  const markSubmitted = useGame((s) => s.markSubmitted);
  const restart = useGame((s) => s.restartRun);
  const go = useGame((s) => s.go);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);

  if (!difficulty) {
    return (
      <div className="p-10 text-center">
        <button type="button" className="pbtn" onClick={() => go('difficulty')}>
          Pick a rank
        </button>
      </div>
    );
  }
  const run = runs[difficulty];
  const avg = runAverage(run.attempts.map((a) => a.score));
  const complete = run.attempts.length >= ATTEMPTS_PER_RUN;
  const wins = run.attempts.filter((a) => a.success).length;
  const service = getLeaderboard();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const check = checkName(name);
    if (!check.ok) {
      sfx.nope();
      setError(check.reason);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await service.submit({ name: check.name, difficulty, average: avg });
      sfx.win();
      markSubmitted(difficulty);
      go('leaderboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your score. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gutter mx-auto max-w-3xl pt-6">
      {complete && wins > 0 && <Confetti count={36} />}
      <section className="paper tape relative px-6 pb-6 pt-8 text-center" aria-labelledby="sum-title">
        <div className="mx-auto w-20">
          <PipSprite mood={wins >= 5 ? 'wow' : 'happy'} />
        </div>
        <h1 id="sum-title" className="mt-2 text-4xl font-black">
          {LEVEL[difficulty].name} {complete ? 'run complete' : 'run in progress'}
        </h1>
        <p className="mt-1 text-lg">
          {wins} of {run.attempts.length} rockets made it home
        </p>
        <p className="mt-3 font-display text-7xl font-black text-[#f06aa8]">
          <CountUp to={Math.round(avg)} />
        </p>
        <p className="font-semibold">average score</p>

        <ol className="mx-auto mt-5 grid max-w-xl grid-cols-5 gap-2 sm:grid-cols-10" aria-label="Your tries">
          {Array.from({ length: ATTEMPTS_PER_RUN }, (_, i) => {
            const a = run.attempts[i];
            return (
              <li key={i} className="flex flex-col items-center" title={a ? `${a.planet}: ${a.score}` : 'not flown'}>
                <span className="w-9">
                  <StarSprite color={!a ? '#e6dcf5' : a.success ? '#ffe07a' : '#ff9fb0'} />
                </span>
                <span className="tabular text-xs font-bold">{a ? a.score : '–'}</span>
              </li>
            );
          })}
        </ol>

        {complete && !run.submitted && (
          <form onSubmit={submit} className="mx-auto mt-6 max-w-md text-left" noValidate>
            <label htmlFor="pilot-name" className="font-display text-xl font-extrabold">
              Your name for the high-score board
            </label>
            <div className="mt-2 flex flex-wrap gap-3">
              <input
                id="pilot-name"
                value={name}
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => setName(e.target.value)}
                autoComplete="nickname"
                className="min-w-0 flex-1 rounded-2xl border-0 bg-[#1e2557] px-4 py-3 font-display text-xl font-bold shadow-[inset_0_3px_0_rgba(42,23,71,.15)]"
                aria-describedby="name-help name-error"
                autoFocus
              />
              <button type="submit" className="pbtn pbtn-mint" disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
            <p id="name-help" className="mt-1 text-sm text-ink/75">
              Up to {MAX_NAME_LENGTH} letters or numbers. Use a nickname, not your full name.
            </p>
            <p id="name-error" className="mt-1 font-bold text-[#ff8f86]" role="alert">
              {error}
            </p>
          </form>
        )}
        {run.submitted && <p className="mt-5 font-bold text-leaf">Score saved.</p>}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {!complete && (
            <button type="button" className="pbtn" onClick={() => go('planets')}>
              Keep playing
            </button>
          )}
          <button type="button" className="pbtn pbtn-sky" onClick={() => go('leaderboard')}>
            High scores
          </button>
          <button
            type="button"
            className={`pbtn ${confirmNew ? '' : 'pbtn-paper'}`}
            onClick={() => {
              if (complete && !run.submitted && !confirmNew) {
                setConfirmNew(true);
                return;
              }
              setConfirmNew(false);
              restart(difficulty);
            }}
          >
            {confirmNew ? 'Skip saving and play again' : `Play ${LEVEL[difficulty].name} again`}
          </button>
          <button type="button" className="pbtn pbtn-paper" onClick={() => go('difficulty')}>
            Change rank
          </button>
        </div>
      </section>
    </div>
  );
}
