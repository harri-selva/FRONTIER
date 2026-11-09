interface Props {
  label: string;
  /** Current value. */
  value: number;
  /** Scale maximum. */
  max: number;
  /** Optional requirement marker. */
  target?: number;
  /** 'over': good when value ≥ target. 'under': good when value ≤ target. */
  mode?: 'over' | 'under';
  display: string;
  hint?: string;
}

export function Meter({ label, value, max, target, mode = 'over', display, hint }: Props) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const tpct = target !== undefined && max > 0 ? Math.max(0, Math.min(100, (target / max) * 100)) : null;
  const good = target === undefined ? true : mode === 'over' ? value >= target : value <= target;
  const color = good ? 'linear-gradient(90deg,#5ee7ff,#7dffb0)' : 'linear-gradient(90deg,#ff4fd8,#ff6b8b)';
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="text-haze">{label}</span>
        <span className={`readout ${good ? 'text-cyber' : 'text-[#ffb3c3]'}`}>{display}</span>
      </div>
      <div
        className="meter"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(value * 100) / 100}
        aria-valuetext={display}
      >
        <span style={{ width: `${pct}%`, background: color }} />
        {tpct !== null && <i className="meter-target" style={{ left: `calc(${tpct}% - 1px)` }} aria-hidden="true" />}
      </div>
      {hint && <p className="mt-1 text-xs text-[#c3b2e8]">{hint}</p>}
    </div>
  );
}
