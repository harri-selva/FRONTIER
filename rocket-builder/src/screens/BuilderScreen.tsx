import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import { ALL_COMPONENTS, COMPONENTS_BY_ID } from '../data/components';
import { MAX_CREW, canLaunch, crewMultiplier, type Category, type Difficulty } from '../engine';
import { Diorama, Layer } from '../paper/Diorama';
import { FUEL_NAME } from '../paper/kid';
import { PartCard, PartIcon } from '../paper/PartCard';
import { gauges, pipTip, type Gauge } from '../paper/readiness';
import { RocketSprite, rocketAspect } from '../paper/RocketSprite';
import { StarWall } from '../paper/scenery';
import { sfx } from '../paper/sfx';
import { AstronautSprite, Icon, PipSprite } from '../paper/sprites';
import { PaperModal, PipSays } from '../paper/ui';
import { slotForCategory, useGame, type SingleSlot } from '../store/gameStore';
import { useMission } from '../store/useMission';

interface Tab {
  cat: Category;
  label: string;
  hint: string;
  show: (d: Difficulty) => boolean;
}
const TABS: Tab[] = [
  { cat: 'payload', label: 'Cabin', hint: 'Who or what rides on top.', show: () => true },
  { cat: 'engine', label: 'Engine', hint: 'Lifts you off Earth and the planet.', show: () => true },
  { cat: 'tank', label: 'Fuel', hint: 'Up to 3 tanks. Match your engine’s fuel colour!', show: () => true },
  { cat: 'drive', label: 'Warp', hint: 'Crosses the light-years between stars. Pretend tech.', show: () => true },
  { cat: 'comms', label: 'Radio', hint: 'Talks to Mission Control.', show: () => true },
  { cat: 'protection', label: 'Shield', hint: 'Protects from heat and radiation.', show: (d) => d !== 'easy' },
  { cat: 'pressure', label: 'Pump', hint: 'Pushes liquid fuel into the engine. Must match the fuel.', show: (d) => d === 'hard' },
];

const ICON_FOR: Record<Category, Parameters<typeof Icon>[0]['name']> = {
  payload: 'crew',
  engine: 'power',
  tank: 'fuel',
  drive: 'warp',
  comms: 'radio',
  protection: 'heat',
  pressure: 'pump',
};

const nameOf = (id: string | number | undefined) => COMPONENTS_BY_ID[String(id ?? '').replace('part:', '')]?.name ?? 'part';
const announcements: Announcements = {
  onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}. Press any arrow key to move it onto the rocket, then Space to drop it.`,
  onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} is over your rocket.` : `${nameOf(active.id)} is not over the rocket.`),
  onDragEnd: ({ active, over }) => (over ? `${nameOf(active.id)} added to your rocket.` : `${nameOf(active.id)} was not added.`),
  onDragCancel: ({ active }) => `Cancelled. ${nameOf(active.id)} was not added.`,
};
/** Keyboard dragging: any arrow key jumps the part straight onto the rocket. */
const toRocket: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) return undefined;
  event.preventDefault();
  const target = context.droppableRects.get('rocket');
  const self = context.collisionRect;
  if (!target || !self) return currentCoordinates;
  return { x: target.left + target.width / 2 - self.width / 2, y: target.top + target.height / 2 - self.height / 2 };
};

const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

function RocketDrop({ children, active }: { children: React.ReactNode; active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'rocket' });
  return (
    <div
      ref={setNodeRef}
      className={`relative rounded-[28px] transition-shadow ${isOver ? 'shadow-[0_0_0_6px_#ffe07a]' : active ? 'shadow-[0_0_0_4px_rgba(255,224,122,.55)]' : ''}`}
    >
      {children}
      {active && (
        <p className="pointer-events-none absolute inset-x-0 top-3 text-center font-display text-lg font-extrabold text-butter drop-shadow-[0_2px_0_rgba(0,0,0,.5)]">
          Drop it on the rocket!
        </p>
      )}
    </div>
  );
}

function Bunting() {
  const colors = ['#ff7cc6', '#ffe07a', '#74e0c0', '#8fd3ff', '#b8a1ff', '#ffb48f'];
  return (
    <svg viewBox="0 0 300 40" className="sprite" style={{ width: '100%', height: 'auto' }} aria-hidden="true">
      <path d="M0 4 Q150 22 300 4" stroke="#fff8ef" strokeWidth="2" fill="none" />
      {Array.from({ length: 12 }, (_, i) => {
        const x = 8 + i * 24;
        const y = 4 + Math.sin((x / 300) * Math.PI) * 16;
        return <path key={i} d={`M${x} ${y} L${x + 18} ${y} L${x + 9} ${y + 20}Z`} fill={colors[i % colors.length]} filter="url(#pp-edge-thin)" />;
      })}
    </svg>
  );
}

function Crate() {
  return (
    <svg viewBox="0 0 60 50" className="sprite" style={{ width: '100%', height: 'auto' }} aria-hidden="true">
      <g filter="url(#pp-edge)">
        <rect x="4" y="10" width="52" height="38" rx="3" fill="#ffb48f" />
        <rect x="2" y="4" width="56" height="10" rx="3" fill="#e98a63" />
      </g>
      <path d="M8 18 L52 44 M52 18 L8 44" stroke="#e98a63" strokeWidth="3" />
      <circle cx="30" cy="31" r="7" fill="#fff8ef" />
      <path d="M27 31 L30 26 L33 31 Z" fill="#ff7cc6" />
    </svg>
  );
}

function GaugeChip({ g }: { g: Gauge }) {
  return (
    <li className={`flex items-center gap-2.5 rounded-2xl px-3 py-2 ${g.ok ? 'bg-[#dff7ee]' : 'bg-[#ffe1e6]'}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${g.ok ? 'bg-mint' : 'bg-tomato'} text-ink shadow-[0_0_0_3px_#fff8ef]`}>
        <Icon name={g.ok ? 'check' : 'cross'} size={18} label={g.ok ? 'OK' : 'Not yet'} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-display font-extrabold leading-tight">
          <Icon name={g.icon} size={16} /> {g.label}
        </p>
        {g.fill !== undefined ? (
          <div className="relative mt-1 h-3 rounded-full bg-ink/10" aria-hidden="true">
            <span
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (g.fill / 1.4) * 100)}%`, background: g.ok ? '#3cae8e' : '#ff5d73' }}
            />
            <span className="absolute -top-1 bottom-[-4px] w-[3px] rounded bg-ink" style={{ left: `${100 / 1.4}%` }} />
          </div>
        ) : null}
        <p className="tabular text-xs text-ink/80">{g.detail}</p>
      </div>
    </li>
  );
}

export function BuilderScreen() {
  const mission = useMission();
  const place = useGame((s) => s.place);
  const removeSingle = useGame((s) => s.removeSingle);
  const removeTank = useGame((s) => s.removeTank);
  const clearBuild = useGame((s) => s.clearBuild);
  const setCrew = useGame((s) => s.setCrew);
  const launch = useGame((s) => s.launch);
  const go = useGame((s) => s.go);
  const [tab, setTab] = useState<Category>('payload');
  const [dragging, setDragging] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [checkOpen, setCheckOpen] = useState(false);
  const [message, setMessage] = useState('');
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: toRocket }),
  );
  const maxByCat = useMemo(() => {
    const m: Partial<Record<Category, number>> = {};
    for (const c of ALL_COMPONENTS) {
      const w = c.mass + (c.category === 'tank' ? c.propellantCapacity : 0);
      m[c.category] = Math.max(m[c.category] ?? 0, w);
    }
    return m;
  }, []);

  if (!mission) {
    return (
      <div className="p-10 text-center">
        <button type="button" className="pbtn" onClick={() => go('planets')}>
          Pick a planet first
        </button>
      </div>
    );
  }
  const { rocket, result, planet, difficulty, crew, issues } = mission;
  const tabs = TABS.filter((t) => t.show(difficulty));
  const activeTab = tabs.find((t) => t.cat === tab) ?? tabs[0]!;
  const seats = rocket.payload?.crewSeats ?? 0;
  const tip = pipTip(rocket, result, issues, planet);
  const gs = gauges(rocket, result, difficulty, crew);
  const ready = canLaunch(issues);

  const add = (id: string) => {
    const c = COMPONENTS_BY_ID[id];
    if (!c) return;
    if (place(id)) {
      sfx.drop();
      setLastAdded(id);
      setMessage(`${c.name} added.`);
    } else {
      sfx.nope();
      setMessage('Only 3 fuel tanks fit. Remove one first.');
    }
  };
  const fittedCount = (id: string): number => {
    const c = COMPONENTS_BY_ID[id];
    if (!c) return 0;
    const slot = slotForCategory(c.category);
    if (slot === 'tanks') return rocket.tanks.filter((t) => t.id === id).length;
    return slot && rocket[slot]?.id === id ? 1 : 0;
  };
  const remove = (id: string) => {
    const c = COMPONENTS_BY_ID[id];
    if (!c) return;
    const slot = slotForCategory(c.category);
    sfx.remove();
    if (slot === 'tanks') {
      const i = rocket.tanks.map((t) => t.id).lastIndexOf(id);
      if (i >= 0) removeTank(i);
    } else if (slot) removeSingle(slot as SingleSlot);
    setLastAdded(null);
    setMessage(`${c.name} removed.`);
  };
  const warningFor = (id: string): string | null => {
    const c = COMPONENTS_BY_ID[id];
    if (!c) return null;
    const ep = rocket.engine?.propellant;
    if (c.category === 'tank' && ep && c.propellant !== ep) return `Doesn’t match your engine (${FUEL_NAME[ep]}).`;
    if (c.category === 'engine' && rocket.tanks.length > 0 && rocket.tanks.some((t) => t.propellant !== c.propellant)) return 'Your tanks would need swapping.';
    if (c.category === 'pressure' && ep === 'solid') return 'Not needed with solid fuel.';
    if (c.category === 'pressure' && ep && !c.compatible.includes(ep)) return `Can’t pump ${FUEL_NAME[ep]}.`;
    if (c.category === 'comms' && c.rangeLy < planet.distanceLy && difficulty !== 'easy') return 'Can’t reach this planet.';
    if (c.category === 'drive' && c.rangeLy < planet.distanceLy * 2) return 'Can’t reach there and back.';
    return null;
  };
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const id = String(e.active.data.current?.componentId ?? '');
    if (e.over?.id === 'rocket') add(id);
  };

  const rocketWidth = Math.min(30, 64 / rocketAspect(rocket));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={(e) => {
        sfx.pop();
        setDragging(String(e.active.data.current?.componentId ?? ''));
      }}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
      accessibility={{ announcements, screenReaderInstructions: { draggable: 'Press Space to pick up a part, any arrow key to move it onto the rocket, then Space to drop it.' } }}
    >
      <div className="gutter mx-auto max-w-6xl pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-[#e6dcff]">Destination</p>
            <h1 className="text-3xl font-black text-paper drop-shadow-[0_3px_0_rgba(0,0,0,.35)] sm:text-4xl">{planet.name}</h1>
          </div>
          <div className="flex gap-3">
            <button type="button" className="pbtn pbtn-paper pbtn-sm" onClick={() => go('planets')}>
              <Icon name="back" size={18} /> Planets
            </button>
            <button
              type="button"
              className="pbtn pbtn-paper pbtn-sm"
              onClick={() => {
                sfx.remove();
                clearBuild();
                setLastAdded(null);
              }}
            >
              Start over
            </button>
          </div>
        </div>
        <p className="sr-only" aria-live="assertive">
          {message}
        </p>

        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          {/* Hangar: stays in view while you scroll the parts, so drag-and-drop always has a target */}
          <div className="sticky top-0 z-30 -mx-4 self-start rounded-b-[28px] bg-[#2b1a5e] px-3 pb-3 pt-2 shadow-[0_10px_24px_rgba(10,4,30,.45)] sm:mx-0 sm:rounded-[28px] lg:top-3 lg:bg-transparent lg:p-0 lg:shadow-none">
            <RocketDrop active={!!dragging}>
              <Diorama className="h-[36vh] min-h-[230px] rounded-[24px] lg:h-[min(62vh,580px)] lg:min-h-[360px]" camera={{ rx: 3 }} label={`Your rocket for ${planet.name}`}>
                <StarWall z={-600} />
                <Layer x={50} y={0} z={-400} w={200}>
                  <div className="h-[34cqh] rounded-t-[40%] bg-[#3b2577]" style={{ boxShadow: 'inset 0 6px 0 rgba(255,255,255,.08)' }} />
                </Layer>
                <Layer x={50} y={78} z={-260} w={150}>
                  <Bunting />
                </Layer>
                <Layer x={50} y={0} z={-120} w={150}>
                  <div className="h-[16cqh] rounded-t-[50%] bg-[#5a3a9e]" />
                </Layer>
                <Layer x={16} y={6} z={-200} w={8}>
                  <div className="h-[62cqh] w-full rounded bg-[#ff9fd3]" style={{ boxShadow: '0 0 0 3px #fff8ef' }} />
                </Layer>
                <Layer x={84} y={6} z={-200} w={8}>
                  <div className="h-[62cqh] w-full rounded bg-[#ff9fd3]" style={{ boxShadow: '0 0 0 3px #fff8ef' }} />
                </Layer>
                <Layer x={22} y={4} z={-40} w={13}>
                  <Crate />
                </Layer>
                <Layer x={50} y={5} z={0} w={rocketWidth} style={{ transition: 'width .5s cubic-bezier(.3,1.4,.5,1)' }}>
                  <div className="anim-bob" style={{ animationDuration: '5s' }}>
                    <RocketSprite rocket={rocket} crew={crew} ghosts lastAdded={lastAdded} />
                  </div>
                </Layer>
                <Layer x={80} y={3} z={50} w={11}>
                  <div className={tip.mood === 'wow' ? 'anim-wobble' : 'anim-bob'}>
                    <PipSprite mood={tip.mood} />
                  </div>
                </Layer>
              </Diorama>
              <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
                <button
                  type="button"
                  className="pbtn max-sm:pbtn-sm"
                  disabled={!ready}
                  onClick={() => {
                    sfx.go();
                    setCheckOpen(true);
                  }}
                >
                  <Icon name="lift" size={22} /> Launch!
                </button>
                {!ready && <span className="rounded-md bg-night/80 px-2 py-0.5 text-xs font-bold text-paper">Parts with a red dot first</span>}
              </div>
            </RocketDrop>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <PipSays mood={tip.mood}>{tip.text}</PipSays>
            <div className="paper flex flex-wrap items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-extrabold">Astronauts</p>
                <p className="text-sm">
                  {seats === 0 ? 'Pick a cabin with seats to bring a crew.' : `Bring home = ×${crewMultiplier(true, crew).toFixed(1)} points. Crash = ×${crewMultiplier(false, crew).toFixed(2)}.`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="pbtn pbtn-paper pbtn-icon" disabled={crew <= 0} onClick={() => { sfx.remove(); setCrew(crew - 1); }} aria-label="One less astronaut">
                  −
                </button>
                <div className="flex min-w-[7.5rem] justify-center gap-1" aria-live="polite" aria-label={`${crew} of ${seats} seats filled`}>
                  {Array.from({ length: Math.max(seats, 1) }, (_, i) => (
                    <span key={i} className={`w-7 ${i < crew ? 'anim-pop' : 'opacity-25'}`}>
                      <AstronautSprite visor={i < crew ? '#8fd3ff' : '#5b4a7a'} />
                    </span>
                  ))}
                </div>
                <button type="button" className="pbtn pbtn-mint pbtn-icon" disabled={crew >= Math.min(seats, MAX_CREW)} onClick={() => { sfx.pop(); setCrew(crew + 1); }} aria-label="One more astronaut">
                  +
                </button>
              </div>
            </div>
            <section className="paper px-4 py-4" aria-labelledby="ready-title">
              <h2 id="ready-title" className="text-2xl font-black">
                Ready to fly?
              </h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {gs.map((g) => (
                  <GaugeChip key={g.key} g={g} />
                ))}
              </ul>
            </section>

            <section aria-label="Rocket parts">
          <div role="tablist" aria-label="Part types" className="flex flex-wrap gap-2">
            {tabs.map((t) => {
              const fitted =
                t.cat === 'tank' ? rocket.tanks.length > 0 : !!rocket[slotForCategory(t.cat) as SingleSlot];
              const required = ['payload', 'engine', 'tank', 'drive', 'comms'].includes(t.cat);
              return (
                <button
                  key={t.cat}
                  type="button"
                  role="tab"
                  id={`tab-${t.cat}`}
                  aria-selected={activeTab.cat === t.cat}
                  aria-controls="parts-panel"
                  onClick={() => {
                    sfx.click();
                    setTab(t.cat);
                  }}
                  onKeyDown={(e) => {
                    const i = tabs.findIndex((x) => x.cat === t.cat);
                    const next = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length] : e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length] : null;
                    if (next) {
                      e.preventDefault();
                      setTab(next.cat);
                      document.getElementById(`tab-${next.cat}`)?.focus();
                    }
                  }}
                  tabIndex={activeTab.cat === t.cat ? 0 : -1}
                  className={`pbtn pbtn-sm ${activeTab.cat === t.cat ? '' : 'pbtn-paper'}`}
                >
                  <Icon name={ICON_FOR[t.cat]} size={18} />
                  {t.label}
                  {fitted ? (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-mint" aria-label="fitted">
                      <Icon name="check" size={12} />
                    </span>
                  ) : required ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-tomato" aria-label="needed" />
                  ) : null}
                </button>
              );
            })}
          </div>
          <div id="parts-panel" role="tabpanel" aria-labelledby={`tab-${activeTab.cat}`} className="mt-4">
            <p className="mb-3 font-semibold text-[#e6dcff]">
              {activeTab.hint} <span className="text-butter">Grab a card and drop it on the rocket{' '}<span className="sm:hidden">(press and hold first)</span>.</span>
            </p>
            <ul key={activeTab.cat} className="grid gap-5 sm:grid-cols-2">
              {ALL_COMPONENTS.filter((c) => c.category === activeTab.cat).map((c, i) => (
                <li key={c.id} className="anim-pop flex select-none" style={{ animationDelay: `${i * 0.05}s` }}>
                  <PartCard
                    c={c}
                    fitted={fittedCount(c.id)}
                    warning={warningFor(c.id)}
                    onRemove={() => remove(c.id)}
                    maxMass={maxByCat[c.category] ?? 1}
                  />
                </li>
              ))}
            </ul>
          </div>
            </section>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && COMPONENTS_BY_ID[dragging] ? (
          <div className="paper flex items-center gap-2 px-3 py-2 shadow-2xl" style={{ transform: 'rotate(-4deg)' }}>
            <PartIcon c={COMPONENTS_BY_ID[dragging]!} />
            <span className="font-display font-extrabold">{COMPONENTS_BY_ID[dragging]!.name}</span>
          </div>
        ) : null}
      </DragOverlay>

      <PaperModal open={checkOpen} title="Pre-flight check" onClose={() => setCheckOpen(false)}>
        <PipSays mood={result.success ? 'wow' : 'think'} live={false}>
          {result.success
            ? `Everything checks out for ${planet.name}. Let’s fly!`
            : 'Some checks are red. You can still launch and see what happens, or go back and fix them.'}
        </PipSays>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {gs.map((g) => (
            <GaugeChip key={g.key} g={g} />
          ))}
        </ul>
        <p className="mt-3 text-sm">
          {crew > 0 ? `${crew} astronaut${crew > 1 ? 's' : ''} aboard: ×${crewMultiplier(true, crew).toFixed(1)} if you make it home, ×${crewMultiplier(false, crew).toFixed(2)} if not.` : 'No astronauts this time.'}
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <button type="button" className="pbtn pbtn-paper" onClick={() => setCheckOpen(false)}>
            Keep building
          </button>
          <button
            type="button"
            className="pbtn pbtn-lg"
            autoFocus
            onClick={() => {
              setCheckOpen(false);
              sfx.go();
              launch();
            }}
          >
            3, 2, 1… Go!
          </button>
        </div>
      </PaperModal>
    </DndContext>
  );
}
