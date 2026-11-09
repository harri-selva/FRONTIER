import { Cabinet } from '../components/Cabinet';
import { MissionRequirements, PlanetFacts, PlanetOrb } from '../components/PlanetCard';
import { SourceBadge } from '../components/Badges';
import { PLANETS_BY_DIFFICULTY } from '../data/planets';
import { DIFFICULTY_CONFIG } from '../engine';
import { useGame } from '../store/gameStore';

export function PlanetSelectScreen() {
  const difficulty = useGame((s) => s.difficulty);
  const choose = useGame((s) => s.choosePlanet);
  const go = useGame((s) => s.go);
  const attempts = useGame((s) => (s.difficulty ? s.runs[s.difficulty].attempts : []));

  if (!difficulty) {
    return (
      <div className="p-8 text-center">
        <button type="button" className="btn btn-primary" onClick={() => go('difficulty')}>
          Choose a difficulty first
        </button>
      </div>
    );
  }
  const planets = PLANETS_BY_DIFFICULTY[difficulty];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg sm:text-xl">
            <span className="chrome">Choose destination</span>
          </h1>
          <p className="mt-2 max-w-3xl text-haze">
            {DIFFICULTY_CONFIG[difficulty].label} targets. All values are from the NASA Exoplanet Archive unless badged
            otherwise.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => go('difficulty')}>
          Change difficulty
        </button>
      </div>
      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {planets.map((p) => {
          const tries = attempts.filter((a) => a.planet === p.name);
          const best = tries.length ? Math.max(...tries.map((a) => a.score)) : null;
          return (
            <li key={p.name}>
              <Cabinet as="article" title={p.name} id={`planet-${p.name.replace(/\W+/g, '-')}`} className="flex h-full flex-col" bodyClassName="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-center gap-3">
                  <PlanetOrb planet={p} size={56} />
                  <div className="text-sm">
                    <p className="text-haze">{p.planetClass === 'rocky' ? 'Likely rocky' : 'Gas/ice-rich'}</p>
                    <SourceBadge kind="game" label={p.missionType === 'landing' ? 'Land & return' : 'Orbital survey'} />
                  </div>
                </div>
                <PlanetFacts planet={p} compact />
                <div className="rounded-lg border border-neon/40 bg-void/60 p-2">
                  <p className="mb-1 font-display text-[0.6rem] text-neonsoft">Mission requirements</p>
                  <MissionRequirements planet={p} difficulty={difficulty} />
                </div>
                {best !== null && (
                  <p className="readout text-cyber">
                    Flown {tries.length}× · best {best}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary flex-1" onClick={() => choose(p.name)} aria-label={`Select ${p.name}`}>
                    Select
                  </button>
                  <a className="btn btn-ghost" href={p.archiveUrl} target="_blank" rel="noreferrer" aria-label={`${p.name} on the NASA Exoplanet Archive (opens in a new tab)`}>
                    Archive ↗
                  </a>
                </div>
              </Cabinet>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
