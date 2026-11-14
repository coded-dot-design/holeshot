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
  { id: "rust", name: "RUST", hex: "#c4572a", tier: 1 },
  { id: "sky", name: "SKYLINE", hex: "#7fb8ff", tier: 1 },
  { id: "mint", name: "COOLANT", hex: "#5dffc8", tier: 2 },
  { id: "plum", name: "PLUM NOIR", hex: "#7a2f8f", tier: 2 },
  { id: "volt", name: "VOLT", hex: "#e8ff1f", tier: 2 },
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
  // Each maker's factory colours (a new bike from the showroom comes in them; ../data/roster.ts MAKERS).
  { id: "f-yamada", name: "YAMADA BLUE", plastic: "#2b6bff", plastic2: "#eef0ff", plate: "#2b6bff", ink: "#eef0ff", tier: 0 },
  { id: "f-hondo", name: "HONDO RED", plastic: "#ff3b4f", plastic2: "#eef0ff", plate: "#eef0ff", ink: "#ff3b4f", tier: 0 },
  { id: "f-kawazakura", name: "KAWAZAKURA LIME", plastic: "#b6ff3b", plastic2: "#1b1a2c", plate: "#b6ff3b", ink: "#0b0a14", tier: 0 },
  { id: "f-starkwolf", name: "STARKWOLF GREY", plastic: "#8a8fa8", plastic2: "#ff8a3d", plate: "#1b1a2c", ink: "#ff8a3d", tier: 0 },
  { id: "f-surgeon", name: "SURGE-ON STING", plastic: "#1b1a2c", plastic2: "#b6ff3b", plate: "#b6ff3b", ink: "#0b0a14", tier: 0 },
  { id: "f-makfox", name: "MAKFOX ORANGE", plastic: "#ff8a3d", plastic2: "#eef0ff", plate: "#eef0ff", ink: "#ff8a3d", tier: 0 },
  { id: "tron", name: "GRID RUNNER", plastic: "#14122a", plastic2: "#22e6ff", plate: "#22e6ff", ink: "#0b0a14", tier: 1 },
  { id: "sunset", name: "SUNSET STRIP", plastic: "#ff8a3d", plastic2: "#ff4fa8", plate: "#ffd166", ink: "#0b0a14", tier: 1 },
  { id: "toxic", name: "TOXIC", plastic: "#5dffc8", plastic2: "#1b1a2c", plate: "#1b1a2c", ink: "#5dffc8", tier: 1 },
  { id: "chrome", name: "CHROME RUSH", plastic: "#eef0ff", plastic2: "#22e6ff", plate: "#22e6ff", ink: "#0b0a14", tier: 2 },
  { id: "glacier", name: "GLACIER", plastic: "#7fe9ff", plastic2: "#eef0ff", plate: "#13a9bb", ink: "#eef0ff", tier: 2 },
  { id: "magma", name: "MAGMA", plastic: "#ff3b4f", plastic2: "#ffd166", plate: "#1b1a2c", ink: "#ffd166", tier: 2 },
  { id: "synth", name: "SYNTHWAVE", plastic: "#b18cff", plastic2: "#22e6ff", plate: "#ff4fa8", ink: "#0b0a14", tier: 2 },
];
export const paint = (id: string) => PAINTS.find((p) => p.id === id) ?? PAINTS[0]!;

/** Helmet shapes the rig draws (../bike/rig.ts RigHelmet): a motocross peak, a long duck-bill peak,
 *  a round street shell, an open-face retro shell with goggles, a shell with a fin, one with spikes. */
export interface HelmetShape { id: string; name: string; tier: number }
export const HELMETS: HelmetShape[] = [
  { id: "peak", name: "MX PEAK", tier: 0 },
  { id: "duck", name: "DUCKBILL", tier: 1 },
  { id: "dome", name: "STREET DOME", tier: 1 },
  { id: "retro", name: "OPEN FACE", tier: 1 },
  { id: "fin", name: "NEON FIN", tier: 2 },
  { id: "spike", name: "SPIKE ROW", tier: 2 },
];
/** Visor tints. */
export const VISORS: Swatch[] = [
  { id: "smoke", name: "SMOKE", hex: "#0a0c16", tier: 0 },
  { id: "iridium", name: "IRIDIUM", hex: "#3a2a7a", tier: 1 },
  { id: "gold", name: "GOLD MIRROR", hex: "#c9922a", tier: 1 },
  { id: "ruby", name: "RUBY", hex: "#a01830", tier: 1 },
  { id: "clear", name: "CLEAR", hex: "#c9d6e8", tier: 1 },
  { id: "ice", name: "ICE MIRROR", hex: "#7fe9ff", tier: 2 },
  { id: "acid", name: "ACID MIRROR", hex: "#8cff4a", tier: 2 },
];
/** Jersey patterns: solid, a chest stripe in the helmet's colour, a split in the pants' colour, a
 *  band in the gloves' colour, a band in the visor's colour. */
export interface Pattern { id: string; name: string; tier: number }
export const PATTERNS: Pattern[] = [
  { id: "solid", name: "SOLID", tier: 0 },
  { id: "stripe", name: "CHEST STRIPE", tier: 0 },
  { id: "split", name: "SPLIT", tier: 1 },
  { id: "accent", name: "GLOVE BAND", tier: 1 },
  { id: "neon", name: "NEON BAND", tier: 2 },
];
export const visor = (id: string) => VISORS.find((s) => s.id === id) ?? VISORS[0]!;

/** The rider kit's slots, for the shop: what each holds. */
export type KitSlot = "helmet" | "helmetPaint" | "visor" | "jersey" | "pants" | "pattern" | "boots" | "gloves";

/** Graphics kits on the plastics, in the scheme's second colour (the circuit glows). The rig draws
 *  them (../bike/rig.ts `gfx`). */
export interface Graphics { id: string; name: string; tier: number }
export const GRAPHICS: Graphics[] = [
  { id: "none", name: "CLEAN", tier: 0 },
  { id: "bolt", name: "BOLT", tier: 1 },
  { id: "chevron", name: "CHEVRONS", tier: 1 },
  { id: "rally", name: "RALLY STRIPE", tier: 2 },
  { id: "circuit", name: "CIRCUIT", tier: 2 },
];
/** Plastics colour: the scheme's own, or any swatch over the main plastics. */
export const PLASTICS = [{ id: "scheme", name: "SCHEME", hex: "", tier: 0 }, ...SWATCHES];
/** Number-plate decals: the plate and its number's ink, front and both side plates, with the
 *  rider's own number drawn on the sides. */
export interface PlateDecal { id: string; name: string; plate: string; ink: string; tier: number }
export const PLATES: PlateDecal[] = [
  { id: "scheme", name: "SCHEME", plate: "", ink: "", tier: 0 },
  { id: "white", name: "WHITE", plate: "#eef0ff", ink: "#0b0a14", tier: 0 },
  { id: "black", name: "BLACK", plate: "#0b0a14", ink: "#eef0ff", tier: 0 },
  { id: "gold", name: "VETERAN GOLD", plate: "#ffd166", ink: "#0b0a14", tier: 1 },
  { id: "neon", name: "NEON", plate: "#22e6ff", ink: "#0b0a14", tier: 2 },
];
/** Outfits: a whole rider kit at once (owned piece by piece once bought), cheaper than the pieces. */
export interface Outfit { id: string; name: string; tier: number; kit: { helmetPaint: string; jersey: string; pants: string; pattern: string; boots: string; gloves: string } }
export const OUTFITS: Outfit[] = [
  { id: "hornet", name: "HORNET", tier: 1, kit: { helmetPaint: "gold", jersey: "gold", pants: "ink", pattern: "split", boots: "ink", gloves: "gold" } },
  { id: "nightshift", name: "NIGHT SHIFT", tier: 1, kit: { helmetPaint: "violet", jersey: "ink", pants: "ink", pattern: "neon", boots: "violet", gloves: "violet" } },
  { id: "foundry", name: "FOUNDRY", tier: 1, kit: { helmetPaint: "steel", jersey: "rust", pants: "steel", pattern: "stripe", boots: "ink", gloves: "rust" } },
  { id: "coolant", name: "COOLANT LEAK", tier: 2, kit: { helmetPaint: "mint", jersey: "teal", pants: "ink", pattern: "accent", boots: "mint", gloves: "mint" } },
  { id: "afterglow", name: "AFTERGLOW", tier: 2, kit: { helmetPaint: "pink", jersey: "plum", pants: "ink", pattern: "neon", boots: "pink", gloves: "volt" } },
];
/** The bike's look slots (per bike) and the rider's kit slots, for the shop. */
export type LookSlot = "paint" | "graphics" | "plastics" | "plate" | "number";
