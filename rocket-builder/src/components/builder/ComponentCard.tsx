import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { RocketComponent } from '../../engine';
import { SourceBadge } from '../Badges';
import { fmtInt, money } from '../format';
import { metaFor, statLines } from './catalogMeta';

interface CardProps {
  component: RocketComponent;
  warning?: string | null;
  onAdd?: () => void;
  overlay?: boolean;
}

export function CardBody({ component: c, warning }: { component: RocketComponent; warning?: string | null }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold leading-tight text-haze">{c.name}</p>
        <span className="readout shrink-0 text-cyber">{money(c.cost)}</span>
      </div>
      <p className="readout text-[1.05rem] text-[#ddd0ff]">
        {statLines(c).join(' · ')} · {fmtInt(c.mass)} kg{c.category === 'tank' ? ' dry' : ''}
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        <SourceBadge kind={c.fictional ? 'fiction' : 'real'} label={c.fictional ? undefined : 'Real tech'} />
      </div>
      {warning && <p className="mt-1 text-xs text-sunset">⚠ {warning}</p>}
    </>
  );
}

/** A draggable palette card. Also has an Add button for click / keyboard users. */
export function ComponentCard({ component: c, warning, onAdd }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette:${c.id}`,
    data: { componentId: c.id },
  });
  const meta = metaFor(c.category);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`group relative rounded-xl border-2 bg-void/70 p-3 transition ${
        isDragging ? 'border-cyber opacity-40' : 'border-[#6b4ba8] hover:border-neon'
      }`}
    >
      <div className="flex gap-2">
        <button
          type="button"
          className="flex w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg border border-neon/60 text-neonsoft active:cursor-grabbing"
          aria-label={`Drag ${c.name} to the ${meta.label} slot`}
          {...listeners}
          {...attributes}
        >
          ⠿
        </button>
        <div className="min-w-0 flex-1" title={`${c.description}\n\n${c.realBasis}`}>
          <CardBody component={c} warning={warning} />
          <p className="mt-1 text-xs text-[#c3b2e8]">{c.description}</p>
          <details className="mt-1 text-xs text-[#c3b2e8]">
            <summary className="cursor-pointer text-cyber">Where do these numbers come from?</summary>
            <p className="mt-1">{c.realBasis}</p>
          </details>
        </div>
      </div>
      {onAdd && (
        <button type="button" className="btn btn-ghost mt-2 w-full !min-h-[36px] !text-[0.6rem]" onClick={onAdd} aria-label={`Add ${c.name} to ${meta.label}`}>
          Add to rocket
        </button>
      )}
    </li>
  );
}

export function CardOverlay({ component }: { component: RocketComponent }) {
  return (
    <div className="w-72 rounded-xl border-2 border-cyber bg-night p-3 shadow-cyber">
      <CardBody component={component} />
    </div>
  );
}
