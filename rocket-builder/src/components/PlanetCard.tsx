import {
  DIFFICULTY_CONFIG,
  EARTH_REENTRY_TEMP_K,
  requiredDeltaV,
  requiredDriveRangeLy,
  type Difficulty,
  type Planet,
} from '../engine';
import { SourceBadge } from './Badges';
import { fmt, fmtInt, ly } from './format';

/** Code-drawn planet sphere, tinted by equilibrium temperature. */
export function PlanetOrb({ planet, size = 72 }: { planet: Planet; size?: number }) {
  const t = planet.eqTempK;
  const hue = t < 250 ? 200 : t < 350 ? 170 : t < 700 ? 30 : t < 1500 ? 15 : 340;
  const light = t > 1500 ? 70 : 60;
  const giant = planet.planetClass === 'giant';
  return (
    <div
      aria-hidden="true"
      className="relative shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 32% 30%, hsl(${hue} 90% ${light + 20}%), hsl(${hue} 80% ${light - 15}%) 55%, hsl(${hue + 30} 70% 15%) 100%)`,
        boxShadow: `0 0 18px hsla(${hue},90%,60%,.55)`,
      }}
    >
      {giant && (
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: 'repeating-linear-gradient(170deg, transparent 0 7px, rgba(13,2,33,.22) 7px 11px)' }}
        />
      )}
    </div>
  );
}

const massLabel = (p: Planet): { text: string; kind: 'real' | 'derived' } =>
  p.massProvenance === 'measured'
    ? { text: 'measured', kind: 'real' }
    : p.massProvenance === 'minimum'
      ? { text: 'minimum mass (M sin i)', kind: 'real' }
      : { text: 'estimated from radius', kind: 'derived' };

export function MissionRequirements({ planet, difficulty }: { planet: Planet; difficulty: Difficulty }) {
  const req = requiredDeltaV(planet);
  const cfg = DIFFICULTY_CONFIG[difficulty];
  return (
    <ul className="space-y-1 text-sm">
      <li>
        <span className="text-[#c3b2e8]">Mission:</span>{' '}
        {planet.missionType === 'landing' ? 'land and return' : 'orbital survey and return'} <SourceBadge kind="game" />
      </li>
      <li>
        <span className="text-[#c3b2e8]">Δv needed:</span>{' '}
        <span className="readout text-cyber">{fmt(req.totalRequired)} km/s</span>{' '}
        <span className="text-xs text-[#c3b2e8]">
          ({fmt(req.earthLaunch)} + {fmt(req.planet)} + {fmt(req.returnCorrections)}) × 1.1
        </span>
      </li>
      <li>
        <span className="text-[#c3b2e8]">Drive range:</span>{' '}
        <span className="readout text-cyber">≥ {fmt(requiredDriveRangeLy(planet))} ly</span>
      </li>
      <li>
        <span className="text-[#c3b2e8]">Comms:</span>{' '}
        {cfg.checks.comms ? <span className="readout text-cyber">≥ {ly(planet.distanceLy)}</span> : <span>auto-pass on {cfg.label}</span>}
      </li>
      <li>
        <span className="text-[#c3b2e8]">Protection:</span>{' '}
        {cfg.checks.heat ? (
          <span className="readout text-cyber">≥ {fmtInt(Math.max(planet.eqTempK, EARTH_REENTRY_TEMP_K))} K</span>
        ) : (
          <span>auto-pass on {cfg.label}</span>
        )}
        {cfg.checks.radiation && <span> · crew radiation rating ≥ 4</span>}
      </li>
    </ul>
  );
}

export function PlanetFacts({ planet, compact = false }: { planet: Planet; compact?: boolean }) {
  const mass = massLabel(planet);
  const rows: { label: string; value: string; kind: 'real' | 'derived' | 'game'; note?: string }[] = [
    { label: 'Host star', value: `${planet.host}${planet.spectralType ? ` (${planet.spectralType})` : ''}`, kind: 'real' },
    { label: 'Distance', value: `${fmt(planet.distanceLy, 2)} ly · ${fmt(planet.distancePc, 2)} pc`, kind: 'real', note: 'ly derived' },
    { label: 'Radius', value: `${fmt(planet.radiusRe, 2)} R⊕`, kind: 'real' },
    { label: 'Mass', value: `${fmt(planet.massMe, 2)} M⊕`, kind: mass.kind, note: mass.text },
    { label: 'Surface gravity', value: `${fmt(planet.gravityG, 2)} g`, kind: 'derived' },
    { label: 'Orbital velocity', value: `${fmt(planet.orbitalVelocityKms, 1)} km/s`, kind: 'derived' },
    { label: 'Equilibrium temp.', value: `${fmtInt(planet.eqTempK)} K`, kind: 'real' },
  ];
  if (!compact) {
    rows.push(
      {
        label: 'Orbital period',
        value: planet.orbitalPeriodDays !== null ? `${fmt(planet.orbitalPeriodDays, 2)} days` : 'not listed',
        kind: 'real',
      },
      {
        label: 'Orbit size',
        value: planet.semiMajorAxisAu !== null ? `${fmt(planet.semiMajorAxisAu, 4)} AU` : 'not listed',
        kind: 'real',
      },
      {
        label: 'Discovered',
        value: `${planet.discoveryYear ?? '?'} · ${planet.discoveryMethod ?? 'unknown method'}`,
        kind: 'real',
      },
      {
        label: 'Planet type',
        value: planet.planetClass === 'rocky' ? 'likely rocky' : 'likely gas/ice-rich, no solid surface expected',
        kind: 'game',
      },
    );
  }
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <dt className="text-[#c3b2e8]">{r.label}</dt>
          <dd className="m-0 flex flex-wrap items-center gap-x-2">
            <span className="readout text-haze">{r.value}</span>
            {!compact && <SourceBadge kind={r.kind} label={r.note ? `${r.kind === 'real' ? 'NASA data' : r.kind === 'derived' ? 'Derived' : 'Gameplay'}: ${r.note}` : undefined} />}
          </dd>
        </div>
      ))}
    </dl>
  );
}
