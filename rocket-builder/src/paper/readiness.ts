import {
  DIFFICULTY_CONFIG,
  type BuildIssue,
  type CheckId,
  type CheckResult,
  type Difficulty,
  type MissionResult,
  type Planet,
  type Rocket,
} from '../engine';
import { FUEL_NAME, kidFailure } from './kid';

export interface Gauge {
  key: string;
  label: string;
  icon: 'lift' | 'fuel' | 'warp' | 'coin' | 'radio' | 'heat' | 'pump' | 'crew';
  ok: boolean;
  /** 0..1.2 fill for the fuel bar. */
  fill?: number;
  detail: string;
}

const find = (r: MissionResult, id: CheckId): CheckResult | undefined => r.checks.find((c) => c.id === id);
const ok = (c: CheckResult | undefined) => !c || c.status !== 'fail';

/** The simple "ready?" chips shown in the builder, only for checks active on this rank. */
export function gauges(rocket: Rocket, r: MissionResult, difficulty: Difficulty, crew: number): Gauge[] {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const list: Gauge[] = [
    {
      key: 'lift',
      label: 'Lift-off',
      icon: 'lift',
      ok: !!rocket.engine && ok(find(r, 'twr')) && ok(find(r, 'maxMass')),
      detail: rocket.engine ? `Push ${r.twr.toFixed(2)} (needs 1.2)` : 'Add an engine',
    },
    {
      key: 'fuel',
      label: 'Fuel power',
      icon: 'fuel',
      ok: r.deltaV.available >= r.deltaV.totalRequired,
      fill: r.deltaV.totalRequired > 0 ? r.deltaV.available / r.deltaV.totalRequired : 0,
      detail: `${r.deltaV.available.toFixed(1)} of ${r.deltaV.totalRequired.toFixed(1)} km/s`,
    },
    {
      key: 'warp',
      label: 'Warp reach',
      icon: 'warp',
      ok: ok(find(r, 'driveRange')) && !!rocket.drive,
      detail: rocket.drive ? `${rocket.drive.rangeLy} of ${find(r, 'driveRange')?.required.replace('≥ ', '') ?? ''} needed` : 'Add a warp drive',
    },
    {
      key: 'coin',
      label: 'Budget',
      icon: 'coin',
      ok: r.cost <= cfg.budget,
      detail: `$${r.cost}M of $${cfg.budget.toLocaleString('en-US')}M`,
    },
  ];
  if (cfg.checks.comms) list.push({ key: 'radio', label: 'Radio', icon: 'radio', ok: ok(find(r, 'comms')) && !!rocket.comms, detail: rocket.comms ? 'Reaches the planet?' : 'Add a radio' });
  if (cfg.checks.heat)
    list.push({ key: 'heat', label: 'Heat shield', icon: 'heat', ok: ok(find(r, 'heatPlanet')) && ok(find(r, 'heatReentry')), detail: rocket.protection ? `Up to ${rocket.protection.maxTempK.toLocaleString('en-US')} K` : 'Add a shield' });
  if (cfg.checks.pressure) list.push({ key: 'pump', label: 'Tank pump', icon: 'pump', ok: ok(find(r, 'pressure')), detail: rocket.engine?.propellant === 'solid' ? 'Not needed' : rocket.pressure ? 'Matches the fuel?' : 'Add a pump' });
  if (cfg.checks.radiation && crew > 0) list.push({ key: 'crew', label: 'Crew shield', icon: 'crew', ok: ok(find(r, 'radiation')), detail: `Radiation ${rocket.protection?.radiationRating ?? 0}/5 (needs 4)` });
  return list;
}

/** Pip's one piece of advice for the current build. */
export function pipTip(rocket: Rocket, r: MissionResult, issues: BuildIssue[], planet: Planet): { mood: 'happy' | 'think' | 'wow'; text: string } {
  if (!rocket.payload) return { mood: 'think', text: 'Start with a cabin. Drag one onto the rocket, or tap Add!' };
  if (!rocket.engine) return { mood: 'think', text: 'Now pick an engine. Strong engines lift heavy rockets.' };
  if (rocket.tanks.length === 0) return { mood: 'think', text: `Add a fuel tank with the ${FUEL_NAME[rocket.engine.propellant]} sticker to match your engine.` };
  if (rocket.tanks.some((t) => t.propellant !== rocket.engine?.propellant))
    return { mood: 'think', text: `Your tanks don’t match your engine! It needs the ${FUEL_NAME[rocket.engine.propellant]} sticker.` };
  if (!rocket.drive) return { mood: 'think', text: 'Add a warp drive so you can cross the space between stars.' };
  if (!rocket.comms) return { mood: 'think', text: 'Add a radio so Mission Control can talk to you.' };
  const block = issues.find((i) => i.severity === 'block');
  if (block) return { mood: 'think', text: block.message };
  const fail = r.checks.find((c) => c.status === 'fail' && c.id !== 'budget');
  if (fail) {
    const k = kidFailure(fail, planet);
    return { mood: 'think', text: `Hmm… ${k.oops} ${k.tip}` };
  }
  if (r.checks.find((c) => c.id === 'budget')?.status === 'fail') return { mood: 'think', text: 'It should fly, but you’re over budget, so you lose the money points. Try cheaper parts!' };
  return { mood: 'wow', text: 'Looks ready to fly! Add astronauts for bonus points, then press Launch.' };
}
