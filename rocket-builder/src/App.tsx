import { useEffect, useRef } from 'react';
import { useReducedMotion } from './components/useReducedMotion';
import { DATA_RETRIEVED, DATA_SOURCE_URL } from './data/planets';
import { PaperDefs } from './paper/Diorama';
import { PixelSky } from './pixel/PixelSky';
import { useCrt } from './pixel/crt';
import { TopBar } from './paper/TopBar';
import { useGame, type Screen } from './store/gameStore';
import { TitleScreen } from './screens/TitleScreen';
import { BriefingScreen } from './screens/BriefingScreen';
import { DifficultyScreen } from './screens/DifficultyScreen';
import { PlanetScreen } from './screens/PlanetScreen';
import { BuilderScreen } from './screens/BuilderScreen';
import { LaunchScreen } from './screens/LaunchScreen';
import { OutcomeScreen } from './screens/OutcomeScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { StoryScreen } from './screens/StoryScreen';

// 'mission' and 'review' are folded into the planet and builder screens.
const SCREENS: Record<Screen, () => JSX.Element> = {
  title: TitleScreen,
  briefing: BriefingScreen,
  difficulty: DifficultyScreen,
  planets: PlanetScreen,
  mission: PlanetScreen,
  builder: BuilderScreen,
  review: BuilderScreen,
  launch: LaunchScreen,
  outcome: OutcomeScreen,
  summary: SummaryScreen,
  leaderboard: LeaderboardScreen,
  story: StoryScreen,
};

const TITLES: Record<Screen, string> = {
  title: 'Home',
  briefing: 'Briefing',
  difficulty: 'Pick your rank',
  planets: 'Pick a planet',
  mission: 'Pick a planet',
  builder: 'Build your rocket',
  review: 'Build your rocket',
  launch: 'Launch!',
  outcome: 'Mission report',
  summary: 'Run summary',
  leaderboard: 'High scores',
  story: 'Secret Project',
};

export function App() {
  useReducedMotion();
  const screen = useGame((s) => s.screen);
  const crt = useCrt();
  const mainRef = useRef<HTMLElement>(null);
  const Current = SCREENS[screen];
  const fullBleed = screen === 'launch';

  useEffect(() => {
    document.title = `${TITLES[screen]} · Exoplanet Rocket Builder`;
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [screen]);

  return (
    <div className="relative flex min-h-full flex-col">
      <PaperDefs />
      {!fullBleed && <PixelSky />}
      {crt && <div className="crt-fx" aria-hidden="true" />}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-lg focus:bg-butter focus:px-3 focus:py-2 focus:font-bold"
      >
        Skip to the game
      </a>
      {!fullBleed && <TopBar />}
      <main id="main" ref={mainRef} tabIndex={-1} className="relative z-10 flex-1 outline-none" aria-label={TITLES[screen]}>
        {/* key: every screen change plays the paper page-flip entrance */}
        <div key={screen === 'review' ? 'builder' : screen === 'mission' ? 'planets' : screen} className={fullBleed ? '' : 'anim-flip'}>
          <Current />
        </div>
      </main>
      {!fullBleed && (
        <footer className="gutter relative z-10 pb-4 pt-6 text-center text-xs text-[#d8ccf5]">
          Planet facts:{' '}
          <a href={DATA_SOURCE_URL} target="_blank" rel="noreferrer" className="underline">
            NASA Exoplanet Archive
          </a>
          , retrieved {DATA_RETRIEVED}. A fan-made game. Not affiliated with or endorsed by NASA.
        </footer>
      )}
    </div>
  );
}
