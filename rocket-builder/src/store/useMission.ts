import { useMemo } from 'react';
import { findPlanet } from '../data/planets';
import { evaluateMission, validateBuild } from '../engine';
import { useGame } from './gameStore';
import { resolveBuild } from './resolve';

/** Live evaluation of the current build against the chosen planet. */
export function useMission() {
  const difficulty = useGame((s) => s.difficulty);
  const planetName = useGame((s) => s.planetName);
  const build = useGame((s) => s.build);
  const crew = useGame((s) => s.crew);
  return useMemo(() => {
    const planet = planetName ? findPlanet(planetName) : null;
    if (!planet || !difficulty) return null;
    const rocket = resolveBuild(build);
    return {
      planet,
      difficulty,
      crew,
      rocket,
      result: evaluateMission(rocket, planet, difficulty, crew),
      issues: validateBuild(rocket, difficulty, crew),
    };
  }, [difficulty, planetName, build, crew]);
}
