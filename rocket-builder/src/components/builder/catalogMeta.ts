import type { Category, RocketComponent } from '../../engine';
import type { Slot } from '../../store/gameStore';
import { fmt, fmtInt, ly, tonnes } from '../format';

export interface CategoryMeta {
  category: Category;
  slot: Slot;
  label: string;
  group: string;
  required: boolean;
  icon: string;
  help: string;
}

/** Palette order. Thrusters group holds the launch engine and the Deep-Space Drive. */
export const CATEGORIES: CategoryMeta[] = [
  { category: 'payload', slot: 'payload', label: 'Payload system', group: 'Payload', required: true, icon: '◭', help: 'Carries instruments and crew. Astronauts need seats.' },
  { category: 'engine', slot: 'engine', label: 'Launch engine', group: 'Thrusters', required: true, icon: '▼', help: 'Sets thrust (lift-off) and Isp (Δv). Must burn the same propellant as your tanks.' },
  { category: 'drive', slot: 'drive', label: 'Deep-Space Drive', group: 'Thrusters', required: true, icon: '✦', help: 'Fictional. Covers the light-years: range must be at least twice the distance.' },
  { category: 'tank', slot: 'tanks', label: 'Fuel tanks (1–3)', group: 'Fuel tanks', required: true, icon: '▮', help: 'Stack up to 3. Bottom tank burns first and is dropped when empty.' },
  { category: 'comms', slot: 'comms', label: 'Communication system', group: 'Communications', required: true, icon: '⌁', help: 'Range must reach the planet (checked on Medium and Hard).' },
  { category: 'pressure', slot: 'pressure', label: 'Pressure system', group: 'Pressure', required: false, icon: '◎', help: 'Feeds liquid propellant. Must match propellant and capacity (checked on Hard).' },
  { category: 'protection', slot: 'protection', label: 'Protection system', group: 'Protection', required: false, icon: '⬢', help: 'Heat and radiation shielding (checked on Medium and Hard).' },
];

export const metaFor = (c: Category): CategoryMeta => CATEGORIES.find((m) => m.category === c) ?? CATEGORIES[0]!;
export const metaForSlot = (s: Slot): CategoryMeta => CATEGORIES.find((m) => m.slot === s) ?? CATEGORIES[0]!;

/** Short stat lines for a component. */
export function statLines(c: RocketComponent): string[] {
  switch (c.category) {
    case 'payload':
      return [`${c.crewSeats} crew seat${c.crewSeats === 1 ? '' : 's'}`, `Capacity ${fmtInt(c.capacity)} kg`, c.lifeSupport ? 'Life support' : 'No life support'];
    case 'engine':
      return [`Thrust ${fmtInt(c.thrust)} kN`, `Isp ${fmtInt(c.isp)} s`, `Burns ${c.propellant}`];
    case 'drive':
      return [`Range ${fmt(c.rangeLy, 0)} ly`];
    case 'tank':
      return [`Holds ${tonnes(c.propellantCapacity)}`, `${c.propellant}`];
    case 'comms':
      return [`Range ${ly(c.rangeLy)}`];
    case 'pressure':
      return [`Up to ${tonnes(c.capacity)}`, c.compatible.join(' / ')];
    case 'protection':
      return [`Max ${fmtInt(c.maxTempK)} K`, `Radiation ${c.radiationRating}/5`];
  }
}
