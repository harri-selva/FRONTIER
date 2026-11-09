import { useEffect, useState } from 'react';
import { ATTEMPTS_PER_RUN, runAverage } from '../engine';
import { DATA_RETRIEVED } from '../data/planets';
import { useGame } from '../store/gameStore';
import { setReducedMotionPref, useReducedMotion } from '../components/useReducedMotion';
import { GrownUps } from './GrownUps';
import { LEVEL } from './kid';
import { setMuted, sfx } from './sfx';
import { Icon, PipSprite } from './sprites';
import { PaperModal, useMuted } from './ui';

/** Optional permitted logo: public/branding/logo.svg or .png replaces the Pip badge. */
function useBrandLogo(): string | null {
  const [logo, setLogo] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const path of ['branding/logo.svg', 'branding/logo.png']) {
        try {
          const res = await fetch(`${import.meta.env.BASE_URL}${path}`, { method: 'HEAD' });
          if (res.ok && (res.headers.get('content-type') ?? '').startsWith('image/')) {
            if (alive) setLogo(`${import.meta.env.BASE_URL}${path}`);
            return;
          }
        } catch {
          /* missing */
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return logo;
}

export function TopBar() {
  const [howOpen, setHowOpen] = useState(false);
  const screen = useGame((s) => s.screen);
  const difficulty = useGame((s) => s.difficulty);
  const runs = useGame((s) => s.runs);
  const go = useGame((s) => s.go);
  const muted = useMuted();
  const { reduced } = useReducedMotion();
  const logo = useBrandLogo();
  const run = difficulty ? runs[difficulty] : null;
  const showRun = !!run && !['title', 'briefing', 'difficulty', 'leaderboard'].includes(screen);

  return (
    <header className="gutter relative z-20 pt-3">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            sfx.click();
            go('title');
          }}
          className="paper paper-tilt-l flex items-center gap-2 px-3 py-1.5"
          aria-label="Exoplanet Rocket Builder: home"
        >
          <span className="block w-8 sm:w-9">{logo ? <img src={logo} alt="" className="w-9" /> : <PipSprite />}</span>
          <span className="hidden text-left font-display text-lg font-extrabold leading-tight sm:block">
            Exoplanet
            <br />
            <span className="text-[#c2307f]">Rocket Builder</span>
          </span>
        </button>

        {showRun && run && difficulty && (
          <div className="paper paper-tilt-r flex items-center gap-2 px-3 py-1.5 max-sm:order-last max-sm:w-full max-sm:justify-between" aria-label={`${LEVEL[difficulty].name} run: ${run.attempts.length} of ${ATTEMPTS_PER_RUN} tries used`}>
            <span className="font-display text-sm font-extrabold">{LEVEL[difficulty].name}</span>
            <span className="tabular text-sm font-semibold sm:hidden" aria-hidden="true">
              {run.attempts.length}/{ATTEMPTS_PER_RUN} tries
            </span>
            <ol className="hidden gap-0.5 sm:flex" aria-hidden="true">
              {Array.from({ length: ATTEMPTS_PER_RUN }, (_, i) => {
                const a = run.attempts[i];
                const color = !a ? 'rgba(42,23,71,.18)' : a.success ? '#e2a400' : '#ff5d73';
                return (
                  <li key={i} style={{ color }}>
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill={a ? color : 'none'} stroke={color} strokeWidth="2" />
                    </svg>
                  </li>
                );
              })}
            </ol>
            <span className="tabular text-sm font-semibold">avg {runAverage(run.attempts.map((x) => x.score)).toFixed(0)}</span>
          </div>
        )}

        <nav className="ml-auto flex items-center gap-2 sm:gap-2.5" aria-label="Game menu">
          <button type="button" className="pbtn pbtn-butter pbtn-sm" onClick={() => setHowOpen(true)}>
            <Icon name="book" size={20} /> <span className="hidden sm:inline">How it works</span>
          </button>
          <button type="button" className="pbtn pbtn-sky pbtn-icon" onClick={() => go('leaderboard')} aria-label="High scores">
            <Icon name="trophy" />
          </button>
          <button
            type="button"
            className="pbtn pbtn-paper pbtn-icon"
            onClick={() => {
              setMuted(!muted);
              if (muted) sfx.pop();
            }}
            aria-pressed={!muted}
            aria-label={muted ? 'Sound off. Turn sound on' : 'Sound on. Turn sound off'}
          >
            <Icon name={muted ? 'mute' : 'sound'} />
          </button>
          <button
            type="button"
            className="pbtn pbtn-paper pbtn-icon"
            onClick={() => setReducedMotionPref(reduced ? 'off' : 'on')}
            aria-pressed={reduced}
            aria-label={reduced ? 'Calm motion on. Turn full animation on' : 'Full animation on. Switch to calm motion'}
            title={reduced ? 'Calm motion' : 'Full animation'}
          >
            <Icon name="motion" />
            {reduced && <span className="absolute h-[3px] w-7 rotate-45 rounded bg-ink" aria-hidden="true" />}
          </button>
        </nav>
      </div>
      <PaperModal open={howOpen} title="How it works" onClose={() => setHowOpen(false)}>
        <GrownUps />
      </PaperModal>
      <p className="sr-only">Planet data from the NASA Exoplanet Archive, retrieved {DATA_RETRIEVED}.</p>
    </header>
  );
}
