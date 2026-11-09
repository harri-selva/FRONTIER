import type {
  CommsComponent,
  DriveComponent,
  EngineComponent,
  Planet,
  PayloadComponent,
  PressureComponent,
  ProtectionComponent,
  Rocket,
  TankComponent,
} from '../types';

const base = { cost: 10, description: 'test', fictional: false, realBasis: 'test' };

export const payload = (o: Partial<PayloadComponent> = {}): PayloadComponent => ({
  ...base, id: 'p', name: 'Payload', category: 'payload', mass: 1000, capacity: 500, crewSeats: 4, lifeSupport: true, ...o,
});
export const engine = (o: Partial<EngineComponent> = {}): EngineComponent => ({
  ...base, id: 'e', name: 'Engine', category: 'engine', mass: 1000, thrust: 100_000, isp: 3000, propellant: 'hydrogen', ...o,
});
export const drive = (o: Partial<DriveComponent> = {}): DriveComponent => ({
  ...base, id: 'd', name: 'Drive', category: 'drive', mass: 1000, rangeLy: 60, ...o,
});
export const tank = (o: Partial<TankComponent> = {}): TankComponent => ({
  ...base, id: 't', name: 'Tank', category: 'tank', mass: 1000, propellantCapacity: 50_000, propellant: 'hydrogen', ...o,
});
export const comms = (o: Partial<CommsComponent> = {}): CommsComponent => ({
  ...base, id: 'c', name: 'Comms', category: 'comms', mass: 100, rangeLy: 100, ...o,
});
export const pressure = (o: Partial<PressureComponent> = {}): PressureComponent => ({
  ...base, id: 'pr', name: 'Pressure', category: 'pressure', mass: 100, pressurisation: 'x', capacity: 1_000_000, compatible: ['hydrogen'], ...o,
});
export const protection = (o: Partial<ProtectionComponent> = {}): ProtectionComponent => ({
  ...base, id: 'pt', name: 'Protection', category: 'protection', mass: 100, maxTempK: 5000, radiationRating: 5, ...o,
});

/** A rocket that passes every check against `planet()`. Δv is huge (≈ 75 km/s). */
export const goodRocket = (o: Partial<Rocket> = {}): Rocket => ({
  payload: payload(),
  engine: engine(),
  drive: drive(),
  tanks: [tank()],
  comms: comms(),
  pressure: pressure(),
  protection: protection(),
  ...o,
});

/** Earth twin 10 ly away, 288 K. v_orb = 7.9 km/s, landing mission. */
export const planet = (o: Partial<Planet> = {}): Planet => ({
  name: 'Test b', host: 'Test', distancePc: 10 / 3.2616, distanceLy: 10, radiusRe: 1, massMe: 1,
  massProvenance: 'measured', massProvenanceRaw: 'Mass', eqTempK: 288, orbitalPeriodDays: 365,
  semiMajorAxisAu: 1, spectralType: 'G2V', discoveryMethod: 'Transit', discoveryYear: 2020, gravityG: 1,
  orbitalVelocityKms: 7.9, planetClass: 'rocky', missionType: 'landing', archiveUrl: 'https://example.org', ...o,
});
