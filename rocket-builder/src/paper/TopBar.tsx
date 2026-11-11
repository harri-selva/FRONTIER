import { useEffect, useState } from 'react';
import { ATTEMPTS_PER_RUN, runAverage } from '../engine';
import { DATA_RETRIEVED } from '../data/planets';
import { useGame } from '../store/gameStore';
import { setReducedMotionPref, useReducedMotion } from '../components/useReducedMotion';
import { GrownUps } from './GrownUps';
import { LEVEL } from './kid';
import { setMuted, sfx } from './sfx';
import { PaperModal, useMuted } from './ui';
import { setCrt, useCrt } from '../pixel/crt';

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
  const showRun = !!run && !['title', 'briefing', 'difficulty', 'leaderboard', 'story'].includes(screen);

  const crumbs: Record<string, string> = {
    briefing: 'BRIEFING', difficulty: 'SELECT RANK', planets: 'TARGET SELECT', mission: 'TARGET SELECT', builder: 'VEHICLE ASSEMBLY',
    review: 'VEHICLE ASSEMBLY', outcome: 'MISSION REPORT', summary: 'RUN SUMMARY', leaderboard: 'HIGH SCORES', story: 'SECRET PROJECT',
  };
  const crt = useCrt();
  return (
    <header className="sticky top-0 z-40 border-b-[3px] border-slate bg-navy0" style={{ boxShadow: '0 3px 0 #05060f' }}>
      <div className="gutter mx-auto flex min-h-[48px] max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
        <button
          type="button"
          onClick={() => {
            sfx.click();
            go('title');
          }}
          className="flex items-center gap-2"
          aria-label="Exoplanet Rocket Builder: home"
        >
          {logo ? <img src={logo} alt="" className="w-7" /> : null}
          <span className="font-title text-[11px] leading-tight text-gold sm:text-[13px]" style={{ textShadow: '2px 2px 0 #c13b8a' }}>
            EXOPLANET<span className="hidden sm:inline"> ROCKET BUILDER</span>
          </span>
        </button>
        {crumbs[screen] && (
          <span className="hidden font-title text-[9px] text-cyan md:inline">
            <span className="mx-1 text-slate">›</span>
            {crumbs[screen]}
          </span>
        )}
        {showRun && run && difficulty && (
          <span
            className="border-2 border-slate bg-navy1 px-2 py-0.5 font-mono text-lg leading-none text-cream"
            aria-label={`${LEVEL[difficulty].name} run: ${run.attempts.length} of ${ATTEMPTS_PER_RUN} attempts used, average ${runAverage(run.attempts.map((x) => x.score)).toFixed(0)}`}
          >
            <span className="font-title text-[8px] text-gold">{LEVEL[difficulty].name.toUpperCase()}</span>{' '}
            <span aria-hidden="true">
              {Array.from({ length: ATTEMPTS_PER_RUN }, (_, i) => {
                const a = run.attempts[i];
                return (
                  <span key={i} style={{ color: !a ? '#4a5378' : a.success ? '#ffc94a' : '#e04a3a' }}>
                    {a ? '■' : '□'}
                  </span>
                );
              })}
            </span>{' '}
            AVG {runAverage(run.attempts.map((x) => x.score)).toFixed(0)}
          </span>
        )}
        <nav className="ml-auto flex flex-wrap items-center gap-1.5" aria-label="Game menu">
          <button type="button" className="pbtn pbtn-sky pbtn-sm" onClick={() => setHowOpen(true)}>
            How it works
          </button>
          <button type="button" className="pbtn pbtn-paper pbtn-sm" onClick={() => go('leaderboard')}>
            Scores
          </button>
          <button type="button" className={`pbtn pbtn-sm ${crt ? '' : 'pbtn-paper'}`} aria-pressed={crt} onClick={() => setCrt(!crt)} title="CRT scanlines">
            CRT
          </button>
          <button
            type="button"
            className={`pbtn pbtn-sm ${muted ? 'pbtn-paper' : ''}`}
            onClick={() => {
              setMuted(!muted);
              if (muted) sfx.pop();
            }}
            aria-pressed={!muted}
            aria-label={muted ? 'Sound off. Turn sound on' : 'Sound on. Turn sound off'}
          >
            {muted ? '♪ OFF' : '♪ ON'}
          </button>
          <button
            type="button"
            className={`pbtn pbtn-sm ${reduced ? '' : 'pbtn-paper'}`}
            onClick={() => setReducedMotionPref(reduced ? 'off' : 'on')}
            aria-pressed={reduced}
            title="Reduce motion"
          >
            {reduced ? 'Calm' : 'Motion'}
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
