/**
 * In-browser inference for the planet-mass model trained in ml/train_mass_model.py.
 * A plain forward pass over the exported weights: no ML library needed.
 */
import model from '../data/mass-model.json';

interface Layer {
  W: number[][]; // [out][in]
  b: number[];
}
interface MassModel {
  features: { key: string; label: string }[];
  scaler: { mean: number[]; std: number[] };
  members: { layers: Layer[] }[];
  residual_sigma_dex: number;
  sigma_scale: number;
  baseline_radius_power_law: { knots_earth_radii: number[]; beta: number[] };
  counts: { train: number; validation: number; test: number; showcase_held_out: number };
  metrics: {
    test_model: Metrics;
    test_baseline_radius_power_law: Metrics;
    test_baseline_median: Metrics;
    test_one_sigma_coverage: number;
    test_two_sigma_coverage: number;
  };
  permutation_importance: { feature: string; label: string; rmse_increase_dex: number }[];
  showcase: { name: string; true_mass_earth: number; pred_mass_earth: number; sigma_dex: number; features: number[] }[];
  parity: { features: number[]; pred_log10_mass: number; sigma_dex: number }[];
  selected: { hidden: number[]; alpha: number };
  data: { source: string; retrieved: string | null };
  train_points_z: number[][];
  similar_radius_z: number;
  earth_twin_probe: { pred_mass_earth: number; similar_training_planets: number };
  trained: string;
}
export interface Metrics {
  rmse_dex: number;
  mae_dex: number;
  median_abs_pct_error: number;
  within_factor_2: number;
}

export const MASS_MODEL = model as unknown as MassModel;

export interface PlanetInputs {
  radiusEarth: number;
  periodDays: number;
  eqTempK: number;
  starMassSun: number;
  starTeffK: number;
}

/** Same feature engineering as features() in train_mass_model.py. */
export const toFeatures = (p: PlanetInputs): number[] => [
  Math.log10(p.radiusEarth),
  Math.log10(p.periodDays),
  Math.log10(p.eqTempK),
  Math.log10(p.starMassSun),
  p.starTeffK / 1000,
];

function forward(member: { layers: Layer[] }, z: number[]): number {
  let a = z;
  member.layers.forEach((layer, li) => {
    const last = li === member.layers.length - 1;
    a = layer.W.map((row, j) => {
      let s = layer.b[j] ?? 0;
      for (let k = 0; k < row.length; k++) s += (row[k] ?? 0) * (a[k] ?? 0);
      return last ? s : Math.max(0, s); // ReLU hidden layers, identity output
    });
  });
  return a[0] ?? 0;
}

export interface MassPrediction {
  /** How many training planets are similar (within similar_radius_z in standardised units). */
  similarTrainingPlanets: number;
  /** True when fewer than 5 similar training planets: the model is guessing outside its experience. */
  outOfExperience: boolean;
  log10Mass: number;
  /** Calibrated 1-sigma uncertainty in dex. */
  sigmaDex: number;
  massEarth: number;
  /** ±1σ range in Earth masses. */
  low: number;
  high: number;
}

/** Predict from already-engineered features (the order in MASS_MODEL.features). */
export function predictFromFeatures(x: number[]): MassPrediction {
  const { mean, std } = MASS_MODEL.scaler;
  const z = x.map((v, i) => (v - (mean[i] ?? 0)) / (std[i] ?? 1));
  const outs = MASS_MODEL.members.map((m) => forward(m, z));
  const mu = outs.reduce((s, v) => s + v, 0) / outs.length;
  const varEns = outs.reduce((s, v) => s + (v - mu) ** 2, 0) / outs.length;
  const sigma = Math.sqrt(varEns + MASS_MODEL.residual_sigma_dex ** 2) * MASS_MODEL.sigma_scale;
  const r2 = MASS_MODEL.similar_radius_z ** 2;
  let similar = 0;
  for (const t of MASS_MODEL.train_points_z) {
    let d = 0;
    for (let i = 0; i < t.length; i++) d += ((t[i] ?? 0) - (z[i] ?? 0)) ** 2;
    if (d < r2) similar++;
  }
  return { similarTrainingPlanets: similar, outOfExperience: similar < 5, log10Mass: mu, sigmaDex: sigma, massEarth: 10 ** mu, low: 10 ** (mu - sigma), high: 10 ** (mu + sigma) };
}

export const predictMass = (p: PlanetInputs): MassPrediction => predictFromFeatures(toFeatures(p));

/** The radius-only "rule of thumb" baseline the model is compared against. */
export function baselineMass(radiusEarth: number): number {
  const { knots_earth_radii: knots, beta } = MASS_MODEL.baseline_radius_power_law;
  const r = Math.log10(radiusEarth);
  const cols = [1, r, ...knots.map((k) => Math.max(0, r - Math.log10(k)))];
  return 10 ** cols.reduce((s, c, i) => s + c * (beta[i] ?? 0), 0);
}
