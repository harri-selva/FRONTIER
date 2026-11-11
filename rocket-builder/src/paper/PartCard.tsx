import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { RocketComponent } from '../engine';
import { bars, FUEL_NAME, kidDesc } from './kid';
import { FUEL_COLOR } from './RocketSprite';
import { AstronautSprite, Icon } from './sprites';
import { Bars, PretendStamp, RealStamp } from './ui';
import { Pixelate } from '../pixel/Pixelate';

export function FuelSticker({ fuel }: { fuel: keyof typeof FUEL_COLOR }) {
  return (
    <span className="sticker" style={{ background: FUEL_COLOR[fuel] }}>
      <span className="h-2.5 w-2.5 rounded-full bg-ink/70" aria-hidden="true" />
      {FUEL_NAME[fuel]}
    </span>
  );
}

/** Small drawing of a part for its card. */
export function PartIcon({ c }: { c: RocketComponent }) {
  const box = { viewBox: '0 0 60 60', width: 56, height: 56, 'aria-hidden': true as const, className: 'sprite shrink-0' };
  switch (c.category) {
    case 'payload':
      return (
        <svg {...box}>
          <g filter="url(#pp-edge)">
            {c.crewSeats === 0 ? (
              <>
                <rect x="18" y="22" width="24" height="26" rx="4" fill="#fff8ef" />
                <rect x="2" y="28" width="14" height="10" fill="#5fa8e8" />
                <rect x="44" y="28" width="14" height="10" fill="#5fa8e8" />
                <path d="M20 22 Q30 8 40 22Z" fill="#b8a1ff" />
              </>
            ) : (
              <path d="M30 6 C44 16 46 34 46 52 L14 52 C14 34 16 16 30 6Z" fill={c.crewSeats <= 2 ? '#ff7cc6' : '#b8a1ff'} />
            )}
          </g>
          {c.crewSeats > 0 && <circle cx="30" cy="32" r="6" fill="#8fd3ff" stroke="#2a1747" strokeWidth="2.5" />}
        </svg>
      );
    case 'engine': {
      const n = c.id === 'engine-kerolox' || c.id === 'engine-hydrolox' ? 3 : 1;
      const fill = c.id === 'engine-gascore' ? '#74e0c0' : c.id === 'engine-fusion' ? '#ff7cc6' : '#5b4a7a';
      return (
        <svg {...box}>
          <rect x="12" y="10" width="36" height="10" rx="3" fill="#b8a1ff" filter="url(#pp-edge)" />
          {Array.from({ length: n }, (_, i) => {
            const cx = n === 1 ? 30 : 18 + i * 12;
            const w = n === 1 ? 26 : 11;
            return <path key={i} d={`M${cx - w / 4} 20 L${cx + w / 4} 20 L${cx + w / 2} 50 L${cx - w / 2} 50Z`} fill={fill} filter="url(#pp-edge-thin)" />;
          })}
        </svg>
      );
    }
    case 'drive':
      return (
        <svg {...box}>
          <ellipse cx="30" cy="30" rx="26" ry="11" fill={{ 'drive-sail': '#ffe07a', 'drive-warp': '#b8a1ff', 'drive-fold': '#ff7cc6', 'drive-singularity': '#2a1747' }[c.id] ?? '#b8a1ff'} filter="url(#pp-edge)" />
          <ellipse cx="30" cy="30" rx="15" ry="4" fill="#fff8ef" />
        </svg>
      );
    case 'tank':
      return (
        <svg {...box}>
          <rect x="16" y="6" width="28" height="48" rx="6" fill={FUEL_COLOR[c.propellant]} filter="url(#pp-edge)" />
          <rect x="16" y="14" width="28" height="4" fill="#2a1747" opacity=".2" />
          <rect x="16" y="42" width="28" height="4" fill="#2a1747" opacity=".2" />
        </svg>
      );
    case 'comms':
      return (
        <svg {...box}>
          <path d="M30 54 V24" stroke="#fff8ef" strokeWidth="4" />
          <circle cx="30" cy="20" r="9" fill={{ 'comms-dsn': '#fff8ef', 'comms-quantum': '#74e0c0', 'comms-tachyon': '#ffb48f', 'comms-subspace': '#ff7cc6' }[c.id] ?? '#fff'} filter="url(#pp-edge)" />
          <path d="M14 10 Q8 20 14 30 M46 10 Q52 20 46 30" stroke="#2a1747" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      );
    case 'pressure':
      return (
        <svg {...box} >
          <g filter="url(#pp-edge)">
            <circle cx="22" cy="24" r="12" fill="#fff8ef" />
            <circle cx="40" cy="38" r="12" fill="#b8a1ff" />
          </g>
        </svg>
      );
    case 'protection':
      return (
        <svg {...box}>
          <path d="M30 6 L50 14 V30 C50 42 41 50 30 55 C19 50 10 42 10 30 V14Z" fill={{ 'protect-mli': '#ffe07a', 'protect-pica': '#9a6a52', 'protect-habitat': '#5fa8e8', 'protect-hfc': '#3b2577' }[c.id] ?? '#fff'} filter="url(#pp-edge)" />
        </svg>
      );
  }
}

function Stats({ c }: { c: RocketComponent }) {
  const row = 'flex items-center justify-between gap-2';
  switch (c.category) {
    case 'payload':
      return (
        <div className={row}>
          <span className="text-xs font-semibold">Seats</span>
          <span className="flex gap-0.5" aria-label={`${c.crewSeats} seats`}>
            {c.crewSeats === 0 ? <span className="text-xs">none</span> : Array.from({ length: c.crewSeats }, (_, i) => <span key={i} className="w-4"><AstronautSprite /></span>)}
          </span>
        </div>
      );
    case 'engine':
      return (
        <>
          <div className={row}><span className="text-xs font-semibold">Power</span><Bars value={bars.power(c.thrust)} label="Power" /></div>
          <div className={row}><span className="text-xs font-semibold">Fuel saver</span><Bars value={bars.efficiency(c.isp)} label="Fuel saver" color="#3cae8e" /></div>
          <div className="mt-1"><FuelSticker fuel={c.propellant} /></div>
        </>
      );
    case 'drive':
      return <p className="text-sm font-bold">Reaches {c.rangeLy.toLocaleString('en-US')} light-years</p>;
    case 'tank':
      return (
        <>
          <div className={row}><span className="text-xs font-semibold">Fuel</span><Bars value={bars.fuel(c.propellantCapacity)} label="Fuel amount" color="#3cae8e" /></div>
          <div className="mt-1"><FuelSticker fuel={c.propellant} /></div>
        </>
      );
    case 'comms':
      return <p className="text-sm font-bold">Reaches {c.rangeLy < 1 ? 'only our solar system' : `${c.rangeLy.toLocaleString('en-US')} light-years`}</p>;
    case 'pressure':
      return (
        <>
          <p className="text-xs font-semibold">Feeds up to {(c.capacity / 1000).toLocaleString('en-US')} t of fuel</p>
          <div className="mt-1 flex flex-wrap gap-1">{c.compatible.map((f) => <FuelSticker key={f} fuel={f} />)}</div>
        </>
      );
    case 'protection':
      return (
        <>
          <div className={row}><span className="text-xs font-semibold">Heat</span><Bars value={bars.heat(c.maxTempK)} label="Heat protection" color="#ff5d73" /></div>
          <div className={row}><span className="text-xs font-semibold">Radiation</span><Bars value={c.radiationRating} label="Radiation protection" color="#5fa8e8" /></div>
          <p className="text-xs">Up to {c.maxTempK.toLocaleString('en-US')} K</p>
        </>
      );
  }
}

interface Props {
  c: RocketComponent;
  fitted: number;
  warning?: string | null;
  onRemove?: () => void;
  maxMass: number;
}

export function PartCard({ c, fitted, warning, onRemove, maxMass }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: `part:${c.id}`,
    data: { componentId: c.id },
  });
  const on = fitted > 0;
  return (
    // The whole card is the drag surface (pointer + touch). The grab handle is the keyboard activator.
    <div
      ref={setNodeRef}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform), touchAction: 'pan-y' }}
      className={`paper group flex w-full cursor-grab flex-col p-3 transition-transform active:cursor-grabbing ${isDragging ? 'opacity-40' : 'hover:-rotate-1 hover:scale-[1.02]'} ${on ? 'ring-4 ring-mint' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="relative touch-none rounded-xl"
          aria-label={`Drag ${c.name} onto your rocket. Press Space to pick up, arrow keys to move, Space to drop.`}
          {...attributes}
        >
          <Pixelate className="w-14" px={2}>
            <PartIcon c={c} />
          </Pixelate>
          <span className="sticker absolute -bottom-2 -right-2" aria-hidden="true">
            Drag
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[1.05rem] font-extrabold leading-tight">{c.name}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 text-sm font-bold"><Icon name="coin" size={16} />${c.cost}M</span>
            {c.fictional ? <PretendStamp /> : <RealStamp label="Real tech" />}
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-sm leading-snug">{kidDescFor(c)}</p>
      <div className="mt-2 space-y-1">
        <Stats c={c} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold">Weight</span>
          <Bars value={bars.weight(c.mass + (c.category === 'tank' ? c.propellantCapacity : 0), maxMass)} label="Weight" color="#b8a1ff" />
        </div>
      </div>
      {warning && <p className="mt-2 rounded-lg bg-[#4a1a2c] px-2 py-1 text-xs font-bold text-[#ff8f86]">{warning}</p>}
      <div className="mt-auto flex items-center gap-2 pt-3">
        <span className={`flex-1 text-xs font-bold ${on ? 'text-leaf' : 'text-ink/70'}`}>
          {on
            ? c.category === 'tank'
              ? `${fitted} fitted. Drag again to add another.`
              : 'Fitted.'
            : 'Drag onto the vehicle ↗'}
        </span>
        {on && onRemove && (
          <button
            type="button"
            className="pbtn pbtn-paper pbtn-sm"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRemove}
            aria-label={`Remove ${c.name}`}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

const kidDescFor = (c: RocketComponent) => kidDesc(c);
