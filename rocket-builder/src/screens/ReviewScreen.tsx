import { Cabinet } from '../components/Cabinet';
import { SourceBadge, StatusBadge } from '../components/Badges';
import { PressureMeter } from '../components/builder/Readouts';
import { Meter } from '../components/Meter';
import { fmt, money, tonnes } from '../components/format';
import { DIFFICULTY_CONFIG, MIN_TWR, PHASES, canLaunch, crewMultiplier } from '../engine';
import { useGame } from '../store/gameStore';
import { useMission } from '../store/useMission';

const PHASE_LABEL = { launch: 'Launch', transit: 'Transit', planet: 'At the planet', return: 'Return' } as const;

export function ReviewScreen() {
  const mission = useMission();
  const launch = useGame((s) => s.launch);
  const go = useGame((s) => s.go);
  if (!mission) {
    return (
      <div className="p-8 text-center">
        <button type="button" className="btn btn-primary" onClick={() => go('planets')}>
          Choose a destination
        </button>
      </div>
    );
  }
  const { rocket, result, planet, difficulty, crew, issues } = mission;
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const ok = canLaunch(issues);
  const parts = [
    ['Payload', rocket.payload],
    ['Launch engine', rocket.engine],
    ['Deep-Space Drive', rocket.drive],
    ['Comms', rocket.comms],
    ['Pressure', rocket.pressure],
    ['Protection', rocket.protection],
  ] as const;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="font-display text-[0.6rem] text-neonsoft">Launch preparation review</p>
      <h1 className="mb-6 font-display text-lg sm:text-xl">
        <span className="chrome">{planet.name}</span>
      </h1>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Cabinet title="Pre-flight checklist" id="checklist">
          <p className="mb-3 text-sm text-haze">
            Predicted from your numbers. You can launch a build that fails, and see exactly where it breaks.
          </p>
          {PHASES.map((phase) => (
            <div key={phase} className="mb-4">
              <h3 className="mb-1 font-display text-[0.6rem] text-cyber">{PHASE_LABEL[phase]}</h3>
              <ul className="space-y-1">
                {result.checks
                  .filter((c) => c.phase === phase && c.id !== 'budget')
                  .map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-void/50 px-2 py-1 text-sm">
                      <StatusBadge status={c.status} />
                      <span className="min-w-[10rem] flex-1 text-haze">{c.label}</span>
                      <span className="readout text-[#ddd0ff]">
                        {c.actual} <span className="text-[#c3b2e8]">({c.required})</span>
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 rounded-md bg-void/50 px-2 py-1 text-sm">
            <StatusBadge status={result.cost <= cfg.budget ? 'pass' : 'fail'} />
            <span className="flex-1 text-haze">Budget</span>
            <span className="readout text-[#ddd0ff]">
              {money(result.cost)} / {money(cfg.budget)}
            </span>
          </div>
        </Cabinet>

        <div className="flex flex-col gap-5">
          <Cabinet title="Estimated performance" id="perf">
            <div className="space-y-3">
              <Meter label="Δv available vs required" value={result.deltaV.available} max={Math.max(result.deltaV.totalRequired * 1.5, result.deltaV.available)} target={result.deltaV.totalRequired} display={`${fmt(result.deltaV.available)} / ${fmt(result.deltaV.totalRequired)} km/s`} />
              <Meter label="Thrust-to-weight" value={result.twr} max={3} target={MIN_TWR} display={fmt(result.twr, 2)} />
              <PressureMeter rocket={rocket} result={result} difficulty={difficulty} />
              <p className="readout text-haze">
                Launch mass {tonnes(result.wetMassKg)} · propellant {tonnes(result.propellantKg)} (
                {fmt((result.propellantKg / Math.max(1, result.wetMassKg)) * 100, 0)}%)
              </p>
            </div>
          </Cabinet>
          <Cabinet title="Crew risk" id="crew">
            <p className="text-sm text-haze">
              {crew} astronaut{crew === 1 ? '' : 's'} aboard. Score multiplier: <strong className="text-ok">×{fmt(crewMultiplier(true, crew), 2)}</strong> on
              success, <strong className="text-[#ffb3c3]">×{fmt(crewMultiplier(false, crew), 2)}</strong> on failure.{' '}
              <SourceBadge kind="game" />
            </p>
          </Cabinet>
          <Cabinet title="Parts" id="parts">
            <ul className="space-y-1 text-sm">
              {parts.map(([label, c]) => (
                <li key={label} className="flex flex-wrap justify-between gap-2">
                  <span className="text-[#c3b2e8]">{label}</span>
                  <span className="text-haze">
                    {c ? c.name : '—'} {c?.fictional && <SourceBadge kind="fiction" />}
                  </span>
                </li>
              ))}
              <li className="flex flex-wrap justify-between gap-2">
                <span className="text-[#c3b2e8]">Tanks</span>
                <span className="text-haze">{rocket.tanks.map((t) => t.name).join(' + ') || '—'}</span>
              </li>
            </ul>
          </Cabinet>
          {issues.length > 0 && (
            <ul className="space-y-1 text-sm" aria-live="polite">
              {issues.map((i) => (
                <li key={i.message} className={i.severity === 'block' ? 'text-[#ffb3c3]' : 'text-sunset'}>
                  {i.severity === 'block' ? '⛔' : '⚠'} {i.message}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="btn btn-ghost" onClick={() => go('builder')}>
              Back to builder
            </button>
            <button type="button" className="btn btn-primary" disabled={!ok} onClick={() => launch()} autoFocus={ok}>
              Launch ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
