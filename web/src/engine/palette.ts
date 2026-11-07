// The FRONTIER palette: 32 colours, picked from the style references
// (deep space navy/purple, cyan, gold and magenta accents, ocean and island colours).
// Every pixel on every scene is one of these colours.
export const HEX = {
  void: "#05060f", navy0: "#0b0e2a", navy1: "#141a3f", navy2: "#1e2557", indigo: "#2b2f73",
  purple0: "#3d2a7a", purple1: "#5a2f8f", violet: "#7b46b5", lavender: "#a98be0",
  magenta: "#c13b8a", pink: "#f06aa8", red: "#e04a3a", rust: "#a8452e", orange: "#f28c28",
  gold: "#ffc94a", cream: "#fff4c2", white: "#ffffff", cyan: "#39d0e8", teal: "#1c8a9e",
  oceanDeep: "#0d2f5a", ocean: "#1565a8", shallow: "#2fa4c8", reef: "#5fd3c8", foam: "#e8fbff",
  sand: "#e8c98a", sandDark: "#b88f55", grassDark: "#2f6b3a", grass: "#4fa04a",
  grassLight: "#9ad25a", rock: "#6b6b7a", slate: "#4a5378", slateLight: "#8a94b8",
} as const;
export type ColorName = keyof typeof HEX;

/** "#rrggbb" -> packed 0xAABBGGRR (the byte order of a little-endian Uint32 view on ImageData). */
export function pack(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export const C: Record<ColorName, number> = Object.fromEntries(
  Object.entries(HEX).map(([k, v]) => [k, pack(v)]),
) as Record<ColorName, number>;

// Colour ramps (dark -> light) used for shading with dithering
export const RAMP = {
  space: [C.void, C.navy0, C.navy1, C.navy2, C.indigo],
  nebula: [C.navy1, C.purple0, C.purple1, C.violet, C.magenta, C.pink],
  nebulaCool: [C.navy1, C.navy2, C.indigo, C.teal, C.cyan],
  ocean: [C.oceanDeep, C.ocean, C.shallow, C.reef],
  grass: [C.grassDark, C.grass, C.grassLight],
  heat: [C.indigo, C.purple1, C.magenta, C.orange, C.gold, C.cream],
  rock: [C.navy2, C.slate, C.rock, C.slateLight],
  gas: [C.rust, C.orange, C.gold, C.cream],
  ice: [C.slate, C.slateLight, C.reef, C.foam, C.white],
  lava: [C.void, C.navy1, C.rust, C.red, C.orange, C.gold],
  violetGas: [C.purple0, C.purple1, C.violet, C.lavender, C.cream],
  crater: [C.navy1, C.slate, C.rock, C.slateLight, C.cream],
  toxic: [C.navy2, C.grassDark, C.grass, C.grassLight, C.cream],
  storm: [C.oceanDeep, C.ocean, C.shallow, C.slateLight, C.foam],
  desert: [C.rust, C.sandDark, C.sand, C.cream],
};
