import {
  DIFFICULTY_CONFIG,
  EARTH_REENTRY_TEMP_K,
  MAX_LAUNCH_MASS_KG,
  MIN_TWR,
  crewMultiplier,
  requiredDriveRangeLy,
  type BuildIssue,
  type Difficulty,
  type MissionResult,
  type Planet,
  type Rocket,
} from '../../engine';
import { Meter } from '../Meter';
import { fmt, fmtInt, ly, money, tonnes } from '../format';

interface Props {
  rocket: Rocket;
  result: MissionResult;
  planet: Planet;
  difficulty: Difficulty;
  crew: number;
  issues: BuildIssue[];
}

export function PressureMeter({ rocket, result, difficulty }: { rocket: Rocket; result: MissionResult; difficulty: Difficulty }) {
  const p = rocket.pressure;
  const prop = rocket.engine?.propellant;
  const checked = DIFFICULTY_CONFIG[difficulty].checks.pressure;
  if (prop === 'solid') {
    return <Meter label="Pressure load" value={0} max={1} display="not needed (solid)" hint={p ? 'A pressure system is unnecessary with a solid motor.' : undefined} />;
  }
  if (!p) {
    return (
      <Meter
        label="Pressure load"
        value={0}
        max={1}
        target={1}
        display="no pressure system"
        hint={checked ? 'Hard: liquid propellant needs a pressure system or the rocket fails at launch.' : 'Auto-passes on this difficulty.'}
      />
    );
  }
  const load = p.capacity > 0 ? result.propellantKg / p.capacity : 0;
  const compatible = !prop || p.compatible.includes(prop);
  return (
    <Meter
      label="Pressure load"
      value={compatible ? load * 100 : 150}
      max={150}
      target={100}
      mode="under"
      display={compatible ? `${fmtInt(load * 100)}% of ${tonnes(p.capacity)}` : `incompatible with ${prop}`}
      hint={checked ? undefined : 'Pressure auto-passes on this difficulty.'}
    />
  );
}

export function Readouts({ rocket, result, planet, difficulty, crew, issues }: Props) {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const req = result.deltaV.totalRequired;
  const dv = result.deltaV.available;
  const needTemp = Math.max(planet.eqTempK, EARTH_REENTRY_TEMP_K);
  const temp = rocket.protection?.maxTempK ?? 0;
  const driveNeed = requiredDriveRangeLy(planet);
  const warnings: string[] = [];

  if (rocket.engine && result.twr < MIN_TWR) warnings.push(`TWR ${fmt(result.twr, 2)}: the rocket will not leave the pad. Needs ≥ ${MIN_TWR}.`);
  if (result.wetMassKg > MAX_LAUNCH_MASS_KG) warnings.push(`Launch mass ${tonnes(result.wetMassKg)} exceeds the ${tonnes(MAX_LAUNCH_MASS_KG)} pad limit.`);
  if (rocket.engine && rocket.tanks.length > 0 && dv < result.deltaV.earthLaunch) warnings.push(`Δv ${fmt(dv)} km/s cannot even reach Earth orbit (${fmt(result.deltaV.earthLaunch)} km/s).`);
  else if (rocket.engine && rocket.tanks.length > 0 && dv < req) warnings.push(`Δv ${fmt(dv)} km/s is short of the ${fmt(req)} km/s this mission needs.`);
  if (rocket.drive && rocket.drive.rangeLy < driveNeed) warnings.push(`Drive range ${fmt(rocket.drive.rangeLy, 0)} ly < round trip ${fmt(driveNeed)} ly.`);
  if (cfg.checks.comms && rocket.comms && rocket.comms.rangeLy < planet.distanceLy) warnings.push(`Comms reach ${ly(rocket.comms.rangeLy)}; the planet is ${ly(planet.distanceLy)} away.`);
  if (cfg.checks.heat && temp < needTemp) warnings.push(`Protection ${fmtInt(temp)} K < ${fmtInt(needTemp)} K needed (planet / re-entry).`);
  if (cfg.checks.radiation && crew > 0 && (rocket.protection?.radiationRating ?? 0) < 4) warnings.push('Crew aboard: radiation rating must be ≥ 4 on Hard.');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[#6b4ba8] bg-void/60 p-2">
          <p className="text-xs text-[#c3b2e8]">Total mass</p>
          <p className="readout text-2xl text-haze">{tonnes(result.wetMassKg)}</p>
          <p className="text-xs text-[#c3b2e8]">dry {tonnes(result.dryMassKg)}</p>
        </div>
        <div className="rounded-lg border border-[#6b4ba8] bg-void/60 p-2">
          <p className="text-xs text-[#c3b2e8]">Crew multiplier</p>
          <p className="readout text-2xl text-haze">
            ×{fmt(crewMultiplier(true, crew), 2)} / ×{fmt(crewMultiplier(false, crew), 2)}
          </p>
          <p className="text-xs text-[#c3b2e8]">success / failure</p>
        </div>
      </div>
      <Meter label="Cost vs budget" value={result.cost} max={cfg.budget * 1.25} target={cfg.budget} mode="under" display={`${money(result.cost)} / ${money(cfg.budget)}`} />
      <Meter label="Thrust-to-weight" value={result.twr} max={3} target={MIN_TWR} display={rocket.engine ? fmt(result.twr, 2) : 'no engine'} />
      <Meter label="Δv available vs required" value={dv} max={Math.max(req * 1.5, dv)} target={req} display={`${fmt(dv)} / ${fmt(req)} km/s`} />
      <Meter label="Launch mass vs pad limit" value={result.wetMassKg} max={MAX_LAUNCH_MASS_KG * 1.2} target={MAX_LAUNCH_MASS_KG} mode="under" display={`${tonnes(result.wetMassKg)} / ${tonnes(MAX_LAUNCH_MASS_KG)}`} />
      <PressureMeter rocket={rocket} result={result} difficulty={difficulty} />
      <Meter
        label={`Temperature rating vs ${cfg.checks.heat ? 'planet / re-entry' : 'planet (auto-pass)'}`}
        value={temp}
        max={Math.max(needTemp, temp) * 1.25}
        target={cfg.checks.heat ? needTemp : undefined}
        display={`${fmtInt(temp)} K / ${fmtInt(needTemp)} K`}
      />
      <Meter label="Drive range vs round trip" value={rocket.drive?.rangeLy ?? 0} max={Math.max(driveNeed, rocket.drive?.rangeLy ?? 0) * 1.25} target={driveNeed} display={`${fmt(rocket.drive?.rangeLy ?? 0, 0)} / ${fmt(driveNeed)} ly`} />
      {cfg.checks.comms && (
        <Meter label="Comms range vs distance" value={rocket.comms?.rangeLy ?? 0} max={Math.max(planet.distanceLy, rocket.comms?.rangeLy ?? 0) * 1.25} target={planet.distanceLy} display={`${ly(rocket.comms?.rangeLy ?? 0)} / ${ly(planet.distanceLy)}`} />
      )}

      <div aria-live="polite">
        {[...issues.map((i) => ({ text: i.message, block: i.severity === 'block' })), ...warnings.map((w) => ({ text: w, block: false }))].length > 0 ? (
          <ul className="space-y-1 text-sm">
            {issues.map((i) => (
              <li key={i.message} className={i.severity === 'block' ? 'text-[#ffb3c3]' : 'text-sunset'}>
                {i.severity === 'block' ? '⛔' : '⚠'} {i.message}
              </li>
            ))}
            {warnings.map((w) => (
              <li key={w} className="text-sunset">
                ⚠ {w}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ok">✔ All active checks look good.</p>
        )}
      </div>
    </div>
  );
}
