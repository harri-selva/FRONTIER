/** Shared engine types. No React imports anywhere in src/engine. */

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export type PropellantType = 'solid' | 'kerolox' | 'hydrolox' | 'hydrogen';

export type Category = 'payload' | 'engine' | 'drive' | 'tank' | 'comms' | 'pressure' | 'protection';

interface BaseComponent {
  id: string;
  name: string;
  category: Category;
  /** Cost in millions of US dollars (gameplay value). */
  cost: number;
  /** Mass in kg (dry mass for tanks). */
  mass: number;
  description: string;
  /** True for parts that do not exist. Badged "Fictional tech" in the UI. */
  fictional: boolean;
  /** Where the figures come from, or why they are gameplay values. */
  realBasis: string;
}

export interface PayloadComponent extends BaseComponent {
  category: 'payload';
  /** Cargo/instrument capacity, kg. */
  capacity: number;
  crewSeats: number;
  lifeSupport: boolean;
}

export interface EngineComponent extends BaseComponent {
  category: 'engine';
  /** Thrust in kN. */
  thrust: number;
  /** Specific impulse in seconds. */
  isp: number;
  propellant: PropellantType;
}

export interface DriveComponent extends BaseComponent {
  category: 'drive';
  /** Total range in light-years (out and back must fit). */
  rangeLy: number;
}

export interface TankComponent extends BaseComponent {
  category: 'tank';
  /** Propellant capacity, kg. `mass` is the tank's dry mass. */
  propellantCapacity: number;
  propellant: PropellantType;
}

export interface CommsComponent extends BaseComponent {
  category: 'comms';
  rangeLy: number;
}

export interface PressureComponent extends BaseComponent {
  category: 'pressure';
  pressurisation: string;
  /** Maximum propellant mass it can pressurise, kg. */
  capacity: number;
  compatible: PropellantType[];
}

export interface ProtectionComponent extends BaseComponent {
  category: 'protection';
  /** Maximum survivable temperature, K. */
  maxTempK: number;
  /** Radiation shielding rating, 1 (minimal) to 5 (heavy). Gameplay scale. */
  radiationRating: number;
}

export type RocketComponent =
  | PayloadComponent
  | EngineComponent
  | DriveComponent
  | TankComponent
  | CommsComponent
  | PressureComponent
  | ProtectionComponent;

/** A build as stored in state: component ids per slot. */
export interface RocketBuild {
  payload: string | null;
  engine: string | null;
  drive: string | null;
  /** Index 0 is the bottom tank: it burns first and is jettisoned first. */
  tanks: string[];
  comms: string | null;
  pressure: string | null;
  protection: string | null;
}

/** A build with ids resolved to component objects. */
export interface Rocket {
  payload: PayloadComponent | null;
  engine: EngineComponent | null;
  drive: DriveComponent | null;
  tanks: TankComponent[];
  comms: CommsComponent | null;
  pressure: PressureComponent | null;
  protection: ProtectionComponent | null;
}

export type MassProvenance = 'measured' | 'minimum' | 'estimated';
export type PlanetClass = 'rocky' | 'giant';
export type MissionType = 'landing' | 'survey';

export interface Planet {
  name: string;
  host: string;
  /** Real: sy_dist, parsecs. */
  distancePc: number;
  /** Derived: parsecs × 3.2616. */
  distanceLy: number;
  /** Real: Earth radii. */
  radiusRe: number;
  /** Real: Earth masses (see massProvenance). */
  massMe: number;
  massProvenance: MassProvenance;
  massProvenanceRaw: string | null;
  /** Real: equilibrium temperature, K. */
  eqTempK: number;
  orbitalPeriodDays: number | null;
  semiMajorAxisAu: number | null;
  spectralType: string | null;
  discoveryMethod: string | null;
  discoveryYear: number | null;
  /** Derived: mass / radius². Earth g. */
  gravityG: number;
  /** Derived: 7.9 × √(mass / radius). km/s. */
  orbitalVelocityKms: number;
  /** Gameplay simplification from radius. */
  planetClass: PlanetClass;
  missionType: MissionType;
  archiveUrl: string;
}

export type Phase = 'launch' | 'transit' | 'planet' | 'return';
export const PHASES: readonly Phase[] = ['launch', 'transit', 'planet', 'return'];

export type CheckId =
  | 'twr'
  | 'maxMass'
  | 'pressure'
  | 'dvOrbit'
  | 'driveRange'
  | 'comms'
  | 'radiation'
  | 'heatPlanet'
  | 'dvPlanet'
  | 'dvReturn'
  | 'heatReentry'
  | 'budget';

export type CheckStatus = 'pass' | 'fail' | 'auto' | 'skipped';

export interface CheckResult {
  id: CheckId;
  phase: Phase;
  label: string;
  status: CheckStatus;
  /** Human-readable value the craft has. */
  actual: string;
  /** Human-readable requirement. */
  required: string;
  /** One plain-English sentence. */
  advice: string;
  /** Short overlay text used during playback when this check fails. */
  overlay: string;
}

export interface ScoreBreakdown {
  mission: number;
  performance: number;
  budget: number;
  suitability: number;
  resources: number;
  /** Sum before multiplier, 0..1000. */
  base: number;
  multiplier: number;
  /** Final score after multiplier, floored at 0, rounded. */
  total: number;
  notes: string[];
}

export interface DeltaVBudget {
  earthLaunch: number;
  planet: number;
  returnCorrections: number;
  /** (earthLaunch + planet + returnCorrections) × margin. */
  totalRequired: number;
  available: number;
}

export interface MissionResult {
  success: boolean;
  /** Phase where the first failure happened, or null on success. */
  failedPhase: Phase | null;
  failure: CheckResult | null;
  /** Phase outcome map. 'not-reached' after the failure. */
  phases: Record<Phase, 'pass' | 'fail' | 'not-reached'>;
  checks: CheckResult[];
  deltaV: DeltaVBudget;
  twr: number;
  wetMassKg: number;
  dryMassKg: number;
  propellantKg: number;
  cost: number;
  score: ScoreBreakdown;
}
