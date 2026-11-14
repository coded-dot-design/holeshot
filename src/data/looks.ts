// Cosmetics, as data: bike paint schemes and the rider's kit (helmet shape, helmet paint and visor,
// jersey and pants colours and a pattern, boots, gloves). Prices are in ./economy.ts (COSMETIC), by
// kind and tier. Flat neon colours that read on both the night table and the day table.

/** A colour the kit can wear. `tier` 0 is in the starter kit (free at first run). */
export interface Swatch { id: string; name: string; hex: string; tier: number }
export const SWATCHES: Swatch[] = [
  { id: "cyan", name: "GRID CYAN", hex: "#22e6ff", tier: 0 },
  { id: "pink", name: "HOT PINK", hex: "#ff4fa8", tier: 0 },
  { id: "lime", name: "ACID LIME", hex: "#b6ff3b", tier: 0 },
  { id: "orange", name: "SODIUM", hex: "#ff8a3d", tier: 0 },
  { id: "violet", name: "ULTRAVIOLET", hex: "#b18cff", tier: 0 },
  { id: "white", name: "CHROME WHITE", hex: "#eef0ff", tier: 0 },
  { id: "ink", name: "NIGHT INK", hex: "#1b1a2c", tier: 0 },
  { id: "gold", name: "SIGNAL GOLD", hex: "#ffd166", tier: 1 },
  { id: "red", name: "TAIL RED", hex: "#ff3b4f", tier: 1 },
  { id: "teal", name: "DEEP TEAL", hex: "#13a9bb", tier: 1 },
  { id: "steel", name: "GUNMETAL", hex: "#4a4e6a", tier: 1 },
  { id: "mint", name: "COOLANT", hex: "#5dffc8", tier: 2 },
];
export const swatch = (id: string) => SWATCHES.find((s) => s.id === id) ?? SWATCHES[0]!;

/** A bike paint scheme: the two plastics, the number plate and its ink. */
export interface Paint { id: string; name: string; plastic: string; plastic2: string; plate: string; ink: string; tier: number }
export const PAINTS: Paint[] = [
  { id: "gridline", name: "GRIDLINE", plastic: "#22e6ff", plastic2: "#eef0ff", plate: "#eef0ff", ink: "#0b0a14", tier: 0 },
  { id: "pinkout", name: "PINK OUT", plastic: "#ff4fa8", plastic2: "#1b1a2c", plate: "#ff4fa8", ink: "#0b0a14", tier: 0 },
  { id: "acid", name: "ACID", plastic: "#b6ff3b", plastic2: "#1b1a2c", plate: "#b6ff3b", ink: "#0b0a14", tier: 0 },
  { id: "sodium", name: "SODIUM LAMP", plastic: "#ff8a3d", plastic2: "#eef0ff", plate: "#eef0ff", ink: "#0b0a14", tier: 0 },
  { id: "ultra", name: "ULTRAVIOLET", plastic: "#b18cff", plastic2: "#1b1a2c", plate: "#ffd166", ink: "#0b0a14", tier: 1 },
  { id: "blackout", name: "BLACKOUT", plastic: "#24223a", plastic2: "#ff4fa8", plate: "#24223a", ink: "#eef0ff", tier: 1 },
  { id: "chrome", name: "CHROME RUSH", plastic: "#eef0ff", plastic2: "#22e6ff", plate: "#22e6ff", ink: "#0b0a14", tier: 2 },
];
export const paint = (id: string) => PAINTS.find((p) => p.id === id) ?? PAINTS[0]!;

/** Helmet shapes the rig draws: a motocross peak, a round street shell, a shell with a fin. */
export interface HelmetShape { id: string; name: string; tier: number }
export const HELMETS: HelmetShape[] = [
  { id: "peak", name: "MX PEAK", tier: 0 },
  { id: "dome", name: "STREET DOME", tier: 1 },
  { id: "fin", name: "NEON FIN", tier: 2 },
];
/** Visor tints. */
export const VISORS: Swatch[] = [
  { id: "smoke", name: "SMOKE", hex: "#0a0c16", tier: 0 },
  { id: "iridium", name: "IRIDIUM", hex: "#3a2a7a", tier: 1 },
  { id: "gold", name: "GOLD MIRROR", hex: "#c9922a", tier: 1 },
  { id: "ice", name: "ICE MIRROR", hex: "#7fe9ff", tier: 2 },
];
/** Jersey patterns: solid, a chest stripe in the helmet's colour, a split in the pants' colour. */
export interface Pattern { id: string; name: string; tier: number }
export const PATTERNS: Pattern[] = [
  { id: "solid", name: "SOLID", tier: 0 },
  { id: "stripe", name: "CHEST STRIPE", tier: 0 },
  { id: "split", name: "SPLIT", tier: 1 },
];
export const visor = (id: string) => VISORS.find((s) => s.id === id) ?? VISORS[0]!;

/** The rider kit's slots, for the shop: what each holds. */
export type KitSlot = "helmet" | "helmetPaint" | "visor" | "jersey" | "pants" | "pattern" | "boots" | "gloves";
