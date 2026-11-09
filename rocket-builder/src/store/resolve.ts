import { COMPONENTS_BY_ID } from '../data/components';
import type {
  CommsComponent,
  DriveComponent,
  EngineComponent,
  PayloadComponent,
  PressureComponent,
  ProtectionComponent,
  Rocket,
  RocketBuild,
  RocketComponent,
  TankComponent,
} from '../engine/types';

function get<T extends RocketComponent>(id: string | null, category: T['category']): T | null {
  if (!id) return null;
  const c = COMPONENTS_BY_ID[id];
  return c && c.category === category ? (c as T) : null;
}

export function resolveBuild(build: RocketBuild): Rocket {
  return {
    payload: get<PayloadComponent>(build.payload, 'payload'),
    engine: get<EngineComponent>(build.engine, 'engine'),
    drive: get<DriveComponent>(build.drive, 'drive'),
    tanks: build.tanks.map((id) => get<TankComponent>(id, 'tank')).filter((t): t is TankComponent => t !== null),
    comms: get<CommsComponent>(build.comms, 'comms'),
    pressure: get<PressureComponent>(build.pressure, 'pressure'),
    protection: get<ProtectionComponent>(build.protection, 'protection'),
  };
}

export const EMPTY_BUILD: RocketBuild = {
  payload: null,
  engine: null,
  drive: null,
  tanks: [],
  comms: null,
  pressure: null,
  protection: null,
};
