export type SourceKind = 'real' | 'derived' | 'game' | 'fiction';

const TEXT: Record<SourceKind, string> = {
  real: 'NASA data',
  derived: 'Derived',
  game: 'Gameplay assumption',
  fiction: 'Fictional tech',
};
const TITLE: Record<SourceKind, string> = {
  real: 'Real value from the NASA Exoplanet Archive',
  derived: 'Calculated from real NASA values with a simple formula',
  game: 'A simplification made for the game, not a real figure',
  fiction: 'This technology does not exist',
};

export function SourceBadge({ kind, label }: { kind: SourceKind; label?: string }) {
  return (
    <span className={`badge badge-${kind}`} title={TITLE[kind]}>
      {kind === 'fiction' && <span aria-hidden="true">✦</span>}
      {label ?? TEXT[kind]}
    </span>
  );
}

export function StatusBadge({ status }: { status: 'pass' | 'fail' | 'auto' | 'skipped' }) {
  const label = status === 'pass' ? 'Pass' : status === 'fail' ? 'Fail' : status === 'auto' ? 'Auto-pass' : 'Skipped';
  const icon = status === 'pass' ? '✔' : status === 'fail' ? '✖' : '○';
  return (
    <span className={`badge badge-${status === 'skipped' ? 'auto' : status}`}>
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}
