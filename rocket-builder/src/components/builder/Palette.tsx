import { useRef, useState, type KeyboardEvent } from 'react';
import { ALL_COMPONENTS } from '../../data/components';
import type { Rocket, RocketComponent } from '../../engine';
import { CATEGORIES } from './catalogMeta';
import { ComponentCard } from './ComponentCard';

const GROUPS = Array.from(new Set(CATEGORIES.map((c) => c.group)));

function warningFor(c: RocketComponent, rocket: Rocket): string | null {
  const engineProp = rocket.engine?.propellant;
  if (c.category === 'tank' && engineProp && c.propellant !== engineProp) return `Your engine burns ${engineProp}.`;
  if (c.category === 'engine' && rocket.tanks.length > 0 && rocket.tanks.some((t) => t.propellant !== c.propellant))
    return `Your tanks hold ${rocket.tanks[0]?.propellant}; you would need new tanks.`;
  if (c.category === 'pressure' && engineProp === 'solid') return 'Not needed with a solid motor.';
  if (c.category === 'pressure' && engineProp && !c.compatible.includes(engineProp)) return `Cannot pressurise ${engineProp}.`;
  return null;
}

interface Props {
  rocket: Rocket;
  onAdd: (id: string) => void;
}

export function Palette({ rocket, onAdd }: Props) {
  const [tab, setTab] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const group = GROUPS[tab] ?? GROUPS[0]!;

  const onKey = (e: KeyboardEvent) => {
    let next = tab;
    if (e.key === 'ArrowRight') next = (tab + 1) % GROUPS.length;
    else if (e.key === 'ArrowLeft') next = (tab - 1 + GROUPS.length) % GROUPS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = GROUPS.length - 1;
    else return;
    e.preventDefault();
    setTab(next);
    tabs.current[next]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label="Component categories" className="mb-3 flex flex-wrap gap-1" onKeyDown={onKey}>
        {GROUPS.map((g, i) => (
          <button
            key={g}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${i}`}
            aria-selected={tab === i}
            aria-controls={`panel-${i}`}
            tabIndex={tab === i ? 0 : -1}
            onClick={() => setTab(i)}
            className={`rounded-lg border-2 px-2 py-1 text-xs font-semibold transition ${
              tab === i ? 'border-neon bg-neon text-void' : 'border-[#6b4ba8] bg-void/60 text-haze hover:border-neon'
            }`}
          >
            {g}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {CATEGORIES.filter((m) => m.group === group).map((m) => (
          <section key={m.category} className="mb-4">
            <h3 className="mb-1 font-display text-[0.6rem] text-neonsoft">
              {m.icon} {m.label} {m.required ? <span className="text-cyber">· required</span> : <span className="text-[#c3b2e8]">· optional</span>}
            </h3>
            <p className="mb-2 text-xs text-[#c3b2e8]">{m.help}</p>
            <ul className="space-y-2">
              {ALL_COMPONENTS.filter((c) => c.category === m.category).map((c) => (
                <ComponentCard key={c.id} component={c} warning={warningFor(c, rocket)} onAdd={() => onAdd(c.id)} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
