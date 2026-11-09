import { useState, type FormEvent } from 'react';
import { Cabinet } from '../components/Cabinet';
import { fmt } from '../components/format';
import { ATTEMPTS_PER_RUN, DIFFICULTY_CONFIG, runAverage } from '../engine';
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

  if (!difficulty) {
    return (
      <div className="p-8 text-center">
        <button type="button" className="btn btn-primary" onClick={() => go('difficulty')}>
          Choose difficulty
        </button>
      </div>
    );
  }
  const run = runs[difficulty];
  const avg = runAverage(run.attempts.map((a) => a.score));
  const complete = run.attempts.length >= ATTEMPTS_PER_RUN;
  const successes = run.attempts.filter((a) => a.success).length;
  const service = getLeaderboard();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const check = checkName(name);
    if (!check.ok) {
      setError(check.reason);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await service.submit({ name: check.name, difficulty, average: avg });
      markSubmitted(difficulty);
      go('leaderboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Cabinet title={`${DIFFICULTY_CONFIG[difficulty].label} run summary`} id="summary">
        <div className="text-center">
          <p className="font-display text-[0.6rem] text-[#c3b2e8]">Final average over {run.attempts.length} attempts</p>
          <p className="mt-2 font-display text-5xl">
            <span className="chrome">{fmt(avg, 1)}</span>
          </p>
          <p className="readout mt-2 text-haze">
            {successes} of {run.attempts.length} missions returned home
          </p>
        </div>
        <ol className="mt-6 grid gap-1 sm:grid-cols-2">
          {run.attempts.map((a, i) => (
            <li key={a.at} className="flex justify-between gap-2 rounded-md bg-void/50 px-2 py-1 text-sm">
              <span className="text-haze">
                {i + 1}. {a.planet} {a.crew > 0 ? `· ${a.crew} crew` : ''}
              </span>
              <span className={`readout ${a.success ? 'text-ok' : 'text-[#ffb3c3]'}`}>
                {a.success ? '✔' : '✖'} {a.score}
              </span>
            </li>
          ))}
        </ol>

        {complete && !run.submitted && (
          <form onSubmit={submit} className="mt-6 rounded-xl border-2 border-neon/60 bg-void/60 p-4" noValidate>
            <label htmlFor="pilot-name" className="font-display text-[0.65rem] text-neonsoft">
              Enter your name for the leaderboard
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                id="pilot-name"
                value={name}
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => setName(e.target.value)}
                autoComplete="nickname"
                className="readout min-w-0 flex-1 rounded-lg border-2 border-cyber bg-void px-3 py-2 text-xl text-haze"
                aria-describedby="name-help name-error"
                autoFocus
              />
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Submitting…' : 'Submit score'}
              </button>
            </div>
            <p id="name-help" className="mt-1 text-xs text-[#c3b2e8]">
              Up to {MAX_NAME_LENGTH} characters: letters, numbers, spaces, - _ . Saved to: {service.label}.
            </p>
            <p id="name-error" className="mt-1 text-sm text-[#ffb3c3]" role="alert">
              {error}
            </p>
          </form>
        )}
        {run.submitted && <p className="mt-6 text-center text-ok">Score submitted.</p>}
        {!complete && (
          <p className="mt-6 text-center text-haze">
            {ATTEMPTS_PER_RUN - run.attempts.length} attempt(s) left in this run.
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {!complete && (
            <button type="button" className="btn btn-primary" onClick={() => go('planets')}>
              Continue run
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => go('leaderboard')}>
            Leaderboard
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (complete && !run.submitted && !window.confirm('Start a new run without submitting this score?')) return;
              restart(difficulty);
            }}
          >
            New {DIFFICULTY_CONFIG[difficulty].label} run
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => go('difficulty')}>
            Other difficulty
          </button>
        </div>
      </Cabinet>
    </div>
  );
}
