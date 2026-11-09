export const fmt = (n: number, dp = 1): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const fmtInt = (n: number): string => Math.round(n).toLocaleString('en-US');
export const tonnes = (kg: number): string => `${fmt(kg / 1000, 1)} t`;
export const money = (m: number): string => `$${fmtInt(m)}M`;
export const ly = (v: number): string => (v < 1 ? `${fmt(v, 4)} ly` : `${fmt(v, 1)} ly`);
