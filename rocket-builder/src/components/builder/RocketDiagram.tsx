import { useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';
import { MAX_TANKS, type Rocket, type RocketComponent } from '../../engine';
import type { SingleSlot } from '../../store/gameStore';
import { SourceBadge } from '../Badges';
import { metaForSlot, statLines } from './catalogMeta';

interface Props {
  rocket: Rocket;
  activeCategory: string | null;
  onRemove: (slot: SingleSlot) => void;
  onRemoveTank: (i: number) => void;
  onMoveTank: (from: number, to: number) => void;
}

const SHAPES: Record<string, string> = {
  payload: 'polygon(50% 0, 82% 38%, 100% 100%, 0 100%, 18% 38%)',
  engine: 'polygon(14% 0, 86% 0, 100% 100%, 0 100%)',
};

function SlotFrame({
  id,
  label,
  required,
  accepts,
  activeCategory,
  filled,
  shape,
  children,
}: {
  id: string;
  label: string;
  required: boolean;
  accepts: string;
  activeCategory: string | null;
  filled: boolean;
  shape?: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { accepts } });
  const valid = activeCategory === accepts;
  const ring = isOver && valid ? 'border-cyber shadow-cyber' : valid ? 'border-cyber/80 border-dashed' : filled ? 'border-neon' : 'border-[#6b4ba8] border-dashed';
  return (
    <div ref={setNodeRef} className="relative" aria-label={`${label} slot`} role="group">
      <div
        className={`relative mx-auto rounded-lg border-2 ${ring} ${filled ? 'bg-gradient-to-b from-[#3d1a78] to-[#2a1259]' : 'bg-void/50'} px-3 py-2 transition`}
      >
        {shape && (
          <div
            aria-hidden="true"
            className={`mx-auto mb-1 h-6 w-24 ${filled ? 'bg-gradient-to-b from-neonsoft to-neon' : 'bg-[#6b4ba8]/50'}`}
            style={{ clipPath: shape }}
          />
        )}
        <p className="font-display text-[0.55rem] text-neonsoft">
          {label}
          {required ? '' : ' (optional)'}
        </p>
        {children}
      </div>
    </div>
  );
}

function Filled({ c, onRemove, extra }: { c: RocketComponent; onRemove: () => void; extra?: ReactNode }) {
  return (
    <div className="mt-1 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-haze">{c.name}</p>
        <p className="readout text-base text-[#ddd0ff]">{statLines(c).join(' · ')}</p>
        {c.fictional && <SourceBadge kind="fiction" />}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        {extra}
        <button type="button" className="rounded border border-[#ff6b8b] px-2 text-xs text-[#ffb3c3] hover:bg-[#ff6b8b]/20" onClick={onRemove} aria-label={`Remove ${c.name}`}>
          Remove
        </button>
      </div>
    </div>
  );
}

const Empty = ({ text }: { text: string }) => <p className="mt-1 text-xs text-[#c3b2e8]">{text}</p>;

export function RocketDiagram({ rocket, activeCategory, onRemove, onRemoveTank, onMoveTank }: Props) {
  const single = (slot: SingleSlot, c: RocketComponent | null, shape?: string) => {
    const m = metaForSlot(slot);
    return (
      <SlotFrame id={`slot:${slot}`} label={m.label} required={m.required} accepts={m.category} activeCategory={activeCategory} filled={!!c} shape={shape}>
        {c ? <Filled c={c} onRemove={() => onRemove(slot)} /> : <Empty text="Drop or add a part here" />}
      </SlotFrame>
    );
  };

  // Display top-to-bottom; tank index 0 is the bottom tank (burns first).
  const tanksTopDown = rocket.tanks.map((t, i) => ({ t, i })).reverse();

  return (
    <div className="relative mx-auto flex max-w-sm flex-col gap-1">
      <div aria-hidden="true" className="absolute inset-y-6 left-1/2 -z-10 w-1 -translate-x-1/2 bg-gradient-to-b from-neon via-cyber to-neon opacity-40" />
      {single('payload', rocket.payload, SHAPES.payload)}
      {single('protection', rocket.protection)}
      {single('comms', rocket.comms)}
      {single('drive', rocket.drive)}
      {single('pressure', rocket.pressure)}
      <SlotFrame
        id="slot:tanks"
        label={`Fuel tanks ${rocket.tanks.length}/${MAX_TANKS}`}
        required
        accepts="tank"
        activeCategory={activeCategory}
        filled={rocket.tanks.length > 0}
      >
        {tanksTopDown.length === 0 && <Empty text="Drop up to 3 tanks here" />}
        <ol className="space-y-1">
          {tanksTopDown.map(({ t, i }) => (
            <li key={`${t.id}-${i}`} className="rounded-md border border-neon/40 bg-void/40 px-2 py-1">
              <p className="text-[0.65rem] text-[#c3b2e8]">
                Stage {i + 1}
                {i === 0 ? ' (bottom: burns first)' : ''}
              </p>
              <Filled
                c={t}
                onRemove={() => onRemoveTank(i)}
                extra={
                  rocket.tanks.length > 1 ? (
                    <span className="flex gap-1">
                      <button type="button" className="rounded border border-cyber px-1 text-xs text-cyber disabled:opacity-30" disabled={i === rocket.tanks.length - 1} onClick={() => onMoveTank(i, i + 1)} aria-label={`Move stage ${i + 1} up`}>
                        ▲
                      </button>
                      <button type="button" className="rounded border border-cyber px-1 text-xs text-cyber disabled:opacity-30" disabled={i === 0} onClick={() => onMoveTank(i, i - 1)} aria-label={`Move stage ${i + 1} down`}>
                        ▼
                      </button>
                    </span>
                  ) : undefined
                }
              />
            </li>
          ))}
        </ol>
      </SlotFrame>
      {single('engine', rocket.engine, SHAPES.engine)}
    </div>
  );
}
