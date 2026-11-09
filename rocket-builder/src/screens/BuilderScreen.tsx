import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useState } from 'react';
import { Cabinet } from '../components/Cabinet';
import { CardOverlay } from '../components/builder/ComponentCard';
import { metaFor } from '../components/builder/catalogMeta';
import { Palette } from '../components/builder/Palette';
import { Readouts } from '../components/builder/Readouts';
import { RocketDiagram } from '../components/builder/RocketDiagram';
import { COMPONENTS_BY_ID } from '../data/components';
import { MAX_CREW, canLaunch } from '../engine';
import { useGame } from '../store/gameStore';
import { useMission } from '../store/useMission';

const nameOf = (id: string | number | undefined): string => {
  const cid = String(id ?? '').replace('palette:', '');
  return COMPONENTS_BY_ID[cid]?.name ?? 'part';
};
const slotName = (id: string | number | undefined): string => String(id ?? '').replace('slot:', '').replace('tanks', 'fuel tanks');

const announcements: Announcements = {
  onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}. Use arrow keys to move to a slot, Space to drop, Escape to cancel.`,
  onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} is over the ${slotName(over.id)} slot.` : `${nameOf(active.id)} is not over a slot.`),
  onDragEnd: ({ active, over }) => (over ? `Dropped ${nameOf(active.id)} on the ${slotName(over.id)} slot.` : `${nameOf(active.id)} was dropped outside the rocket.`),
  onDragCancel: ({ active }) => `Cancelled. ${nameOf(active.id)} was not added.`,
};

// Pointer: exact hit test; keyboard: nearest overlapping slot.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

export function BuilderScreen() {
  const mission = useMission();
  const place = useGame((s) => s.place);
  const removeSingle = useGame((s) => s.removeSingle);
  const removeTank = useGame((s) => s.removeTank);
  const moveTank = useGame((s) => s.moveTank);
  const clearBuild = useGame((s) => s.clearBuild);
  const setCrew = useGame((s) => s.setCrew);
  const go = useGame((s) => s.go);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

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
  const activeComponent = activeId ? COMPONENTS_BY_ID[activeId] : undefined;
  const seats = rocket.payload?.crewSeats ?? 0;

  const add = (id: string) => {
    const c = COMPONENTS_BY_ID[id];
    if (!c) return;
    const ok = place(id);
    setMessage(ok ? `${c.name} added to ${metaFor(c.category).label}.` : `${c.name} did not fit: the tank stack is full (3 max).`);
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.data.current?.componentId ?? ''));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const id = String(e.active.data.current?.componentId ?? '');
    const c = COMPONENTS_BY_ID[id];
    if (!c || !e.over) return;
    const accepts = e.over.data.current?.accepts as string | undefined;
    if (accepts !== c.category) {
      setMessage(`${c.name} belongs in the ${metaFor(c.category).label} slot.`);
      return;
    }
    add(id);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{ announcements, screenReaderInstructions: { draggable: 'Press Space or Enter to pick up a part. Use arrow keys to move it over a rocket slot, then Space or Enter to drop. Press Escape to cancel. Or use the Add to rocket button.' } }}
    >
      <p id="dnd-instructions" className="sr-only">
        Press Space or Enter to pick up a part, arrow keys to move it to a slot, Space or Enter to drop. Or use the Add to rocket button.
      </p>
      <div className="mx-auto max-w-[1400px] px-3 py-6 sm:px-4">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-[0.6rem] text-neonsoft">Rocket builder · destination</p>
            <h1 className="font-display text-lg">
              <span className="chrome">{planet.name}</span>
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => go('mission')}>
              Mission brief
            </button>
            <button type="button" className="btn btn-danger" onClick={() => clearBuild()}>
              Clear rocket
            </button>
            <button type="button" className="btn btn-primary" onClick={() => go('review')} disabled={!canLaunch(issues)}>
              Review & launch
            </button>
          </div>
        </div>
        <p className="sr-only" aria-live="assertive">
          {message}
        </p>
        {message && (
          <p className="mb-3 rounded-lg border border-cyber/50 bg-void/70 px-3 py-2 text-sm text-cyber" aria-hidden="true">
            {message}
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(280px,1fr)_minmax(300px,380px)_minmax(280px,1fr)]">
          <Cabinet title="Component palette" id="palette" className="order-2 lg:order-1" bodyClassName="p-3 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto">
            <Palette rocket={rocket} onAdd={add} />
          </Cabinet>

          <Cabinet title="Your rocket" id="rocket" className="order-1 lg:order-2" bodyClassName="p-3">
            <RocketDiagram
              rocket={rocket}
              activeCategory={activeComponent?.category ?? null}
              onRemove={(s) => {
                removeSingle(s);
                setMessage(`Removed ${s}.`);
              }}
              onRemoveTank={(i) => {
                removeTank(i);
                setMessage(`Removed stage ${i + 1} tank.`);
              }}
              onMoveTank={moveTank}
            />
            <div className="mt-4 rounded-lg border border-neon/50 bg-void/60 p-3">
              <label htmlFor="crew" className="font-display text-[0.6rem] text-neonsoft">
                Astronauts: {crew} / {seats} seats
              </label>
              <input
                id="crew"
                type="range"
                min={0}
                max={MAX_CREW}
                step={1}
                value={crew}
                onChange={(e) => setCrew(Number(e.target.value))}
                className="mt-2 w-full accent-[#ff4fd8]"
                aria-valuetext={`${crew} astronauts`}
              />
              <p className="mt-1 text-xs text-[#c3b2e8]">
                Each astronaut adds 1,000 kg (gameplay assumption). Success ×(1 + 0.1 × crew), failure ×(1 − 0.15 × crew).
              </p>
            </div>
          </Cabinet>

          <Cabinet title="Live readout" id="readout" className="order-3" bodyClassName="p-3 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto">
            <Readouts rocket={rocket} result={result} planet={planet} difficulty={difficulty} crew={crew} issues={issues} />
          </Cabinet>
        </div>
      </div>
      <DragOverlay dropAnimation={null}>{activeComponent ? <CardOverlay component={activeComponent} /> : null}</DragOverlay>
    </DndContext>
  );
}
