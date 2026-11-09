import { Cabinet } from '../components/Cabinet';
import { SourceBadge } from '../components/Badges';
import { MissionRequirements, PlanetFacts, PlanetOrb } from '../components/PlanetCard';
import { fmt, fmtInt } from '../components/format';
import { atmosphereNote, findPlanet } from '../data/planets';
import { DIFFICULTY_CONFIG, requiredDeltaV } from '../engine';
import { useGame } from '../store/gameStore';

export function MissionBriefScreen() {
  const difficulty = useGame((s) => s.difficulty);
  const planetName = useGame((s) => s.planetName);
  const go = useGame((s) => s.go);
  const planet = planetName ? findPlanet(planetName) : null;
  if (!planet || !difficulty) {
    return (
      <div className="p-8 text-center">
        <button type="button" className="btn btn-primary" onClick={() => go('planets')}>
          Choose a destination
        </button>
      </div>
    );
  }
  const atm = atmosphereNote(planet.name);
  const req = requiredDeltaV(planet);
  const years = (planet.distanceLy * 9.4607e12) / 17 / 3.156e7; // km per ly / Voyager km/s / s per year

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <PlanetOrb planet={planet} size={96} />
        <div>
          <p className="font-display text-[0.65rem] text-neonsoft">Mission brief · {DIFFICULTY_CONFIG[difficulty].label}</p>
          <h1 className="font-display text-xl sm:text-2xl">
            <span className="chrome">{planet.name}</span>
          </h1>
          <a href={planet.archiveUrl} target="_blank" rel="noreferrer" className="text-sm text-cyber underline">
            View on the NASA Exoplanet Archive ↗
          </a>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Cabinet title="Real data (NASA Exoplanet Archive)" id="brief-real">
          <PlanetFacts planet={planet} />
          <div className="mt-4 rounded-lg border border-cyber/40 bg-void/60 p-3 text-sm">
            <p className="font-display text-[0.6rem] text-cyber">Atmosphere</p>
            {atm ? (
              <>
                <p className="mt-1 text-haze">{atm.note}</p>
                <p className="mt-1 text-xs text-[#c3b2e8]">Source: {atm.source}</p>
              </>
            ) : (
              <p className="mt-1 text-haze">Not measured. The archive does not list atmospheric composition for this planet.</p>
            )}
          </div>
          {planet.massProvenance !== 'measured' && (
            <p className="mt-3 text-sm text-sunset">
              ⚠ Mass is {planet.massProvenance === 'minimum' ? 'a minimum mass (M sin i) from radial velocity: the true mass may be higher' : 'estimated from the radius using a mass–radius relation, not measured'}.
              Gravity and orbital velocity inherit that uncertainty.
            </p>
          )}
        </Cabinet>

        <div className="flex flex-col gap-5">
          <Cabinet title="Gameplay assumptions" id="brief-game">
            <ul className="space-y-2 text-sm text-haze">
              <li>
                <SourceBadge kind="game" />{' '}
                {planet.planetClass === 'rocky'
                  ? `Radius ${fmt(planet.radiusRe, 2)} R⊕ ≤ 1.6, so we treat it as rocky: you land, then take off again.`
                  : `Radius ${fmt(planet.radiusRe, 2)} R⊕ > 1.6, so we treat it as gas/ice-rich with no solid surface: you survey from orbit.`}
              </li>
              <li>
                <SourceBadge kind="fiction" /> The Deep-Space Drive covers {fmt(planet.distanceLy * 2, 1)} light-years out and
                back. For scale: at Voyager 1’s speed the one-way trip would take about {fmtInt(years)} years.
              </li>
              <li>
                <SourceBadge kind="game" /> Chemical Δv: {fmt(req.earthLaunch)} km/s to orbit +{' '}
                {fmt(req.planet)} km/s at the planet ({planet.missionType === 'landing' ? '2 × 1.2' : '2 × 0.25'} ×{' '}
                {fmt(planet.orbitalVelocityKms)} km/s) + {fmt(req.returnCorrections)} km/s corrections, plus a 10% margin.
              </li>
              <li>
                <SourceBadge kind="game" /> Protection must beat the equilibrium temperature ({fmtInt(planet.eqTempK)} K) and
                Earth re-entry.
              </li>
            </ul>
          </Cabinet>
          <Cabinet title="Mission requirements" id="brief-req">
            <MissionRequirements planet={planet} difficulty={difficulty} />
          </Cabinet>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="btn btn-ghost" onClick={() => go('planets')}>
              Back
            </button>
            <button type="button" className="btn btn-primary" onClick={() => go('builder')} autoFocus>
              Build rocket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
