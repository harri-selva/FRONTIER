import { useEffect, useRef } from 'react';
import { Backdrop } from './components/Backdrop';
import { Header } from './components/Header';
import { useReducedMotion } from './components/useReducedMotion';
import { useGame, type Screen } from './store/gameStore';
import { TitleScreen } from './screens/TitleScreen';
import { BriefingScreen } from './screens/BriefingScreen';
import { DifficultyScreen } from './screens/DifficultyScreen';
import { PlanetSelectScreen } from './screens/PlanetSelectScreen';
import { MissionBriefScreen } from './screens/MissionBriefScreen';
import { BuilderScreen } from './screens/BuilderScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { LaunchScreen } from './screens/LaunchScreen';
import { OutcomeScreen } from './screens/OutcomeScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';

const SCREENS: Record<Screen, () => JSX.Element> = {
  title: TitleScreen,
  briefing: BriefingScreen,
  difficulty: DifficultyScreen,
  planets: PlanetSelectScreen,
  mission: MissionBriefScreen,
  builder: BuilderScreen,
  review: ReviewScreen,
  launch: LaunchScreen,
  outcome: OutcomeScreen,
  summary: SummaryScreen,
  leaderboard: LeaderboardScreen,
};

const TITLES: Record<Screen, string> = {
  title: 'Title',
  briefing: 'Mission briefing',
  difficulty: 'Choose difficulty',
  planets: 'Choose destination',
  mission: 'Mission brief',
  builder: 'Rocket builder',
  review: 'Launch preparation',
  launch: 'Launch',
  outcome: 'Mission outcome',
  summary: 'Run summary',
  leaderboard: 'Leaderboard',
};

export function App() {
  useReducedMotion(); // keeps the <html data-reduced-motion> flag in sync
  const screen = useGame((s) => s.screen);
  const mainRef = useRef<HTMLElement>(null);
  const Current = SCREENS[screen];

  // Move focus to the new screen for keyboard and screen-reader users.
  useEffect(() => {
    document.title = `${TITLES[screen]} · Exoplanet Rocket Builder`;
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [screen]);

  return (
    <div className="relative min-h-screen">
      <Backdrop />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded focus:bg-neon focus:px-3 focus:py-2 focus:text-void">
        Skip to content
      </a>
      {screen !== 'launch' && <Header />}
      <main id="main" ref={mainRef} tabIndex={-1} className="relative z-10 outline-none" aria-label={TITLES[screen]}>
        <Current />
      </main>
    </div>
  );
}
