// The bike roster, as data: four classes, an original maker each, four models per maker (sixteen in
// all). Every model is an engine and chassis for ../bike/bike.ts (`power`), a suspension, its price
// and its upkeep (how fast its parts wear and what a rebuild costs, as multipliers on the economy's
// rates). The first model of each class is the cheapest: the four starter choices at first run.
// All names are our own: they nod to an era and a feel, never to a real maker or model.
import type { Power } from "../bike/bike.ts";

/** The four classes. */
export type ClassId = "2t" | "4t" | "ebike" | "emoto";

export interface BikeClass {
  id: ClassId;
  /** The class, for the HUD and the garage. */
  name: string;
  /** The maker every model of the class comes from (original). */
  maker: string;
  /** The maker's voice, one line. */
  motto: string;
  /** How the rig draws it: a 2-stroke's chamber, a 4-stroke's silencer, an e-motor's battery. */
  rig: "2t" | "4t" | "e";
  /** The motor part this class wears: a top end (2-stroke), an engine (4-stroke) or a battery. */
  motor: "topend" | "engine" | "battery";
}

export const CLASSES: Record<ClassId, BikeClass> = {
  "2t": { id: "2t", name: "2-STROKE", maker: "CHROMEWASP", motto: "Ring-ding chrome from the neon arcades. Light, loud, peaky.", rig: "2t", motor: "topend" },
  "4t": { id: "4t", name: "4-STROKE", maker: "IRONVAULT WORKS", motto: "Foundry thumpers. Heavy, torquey, built to outlast the city.", rig: "4t", motor: "engine" },
  ebike: { id: "ebike", name: "E-BIKE", maker: "LUMEN & LANE", motto: "Quiet glass-and-light city bikes. Light, quick to lift.", rig: "e", motor: "battery" },
  emoto: { id: "emoto", name: "ELECTRIC DIRT", maker: "VOLTGRIT", motto: "Raw volt-motos wired in a garage. Every newton at once.", rig: "e", motor: "battery" },
};

export interface Model {
  id: string;
  cls: ClassId;
  /** Model name (the maker is the class's). */
  name: string;
  blurb: string;
  /** Credits to buy new (the starters' price is what a first-run pick would cost: they are free then). */
  price: number;
  /** 1 starter .. 4 top of the class. */
  tier: number;
  /** Upkeep: wear speed and rebuild cost, ×. */
  upkeep: { wear: number; cost: number };
  /** The engine and chassis (bike.ts), stock and new. */
  power: Power;
  /** Suspension, stock: travel, sag at rest, damping (share of critical), case tolerance (landing speed). */
  susp: { travel: number; sag: number; damp: number; caseDrop: number };
  /** The frame, if not a full-size motocross bike's (axles, drop, wheel radius; bike.ts BikeShape). */
  frame?: { rear: number; front: number; drop: number; radius: number };
  /** Wheelie City's feel: half the sweet spot round the balance point (rad), the hop speed. */
  sweet: number;
  hop: number;
}

// The voices per class (Hz at idle and the limiter, the wave).
const V2: Power["voice"] = [92, 330, "sawtooth"], V4: Power["voice"] = [46, 150, "square"], VE: Power["voice"] = [240, 620, "sine"], VM: Power["voice"] = [180, 900, "sine"];
const two = (force: number, mass: number, top: number, peak: number): Power => ({
  name: "2-STROKE", mass, gyr: 0.58, force,
  curve: [0.14, 0.17, 0.22, 0.32, 0.55, 0.92 * peak, 1, 0.92 * peak, 0.6],
  gears: [6.4 * top, 9.8 * top, 13.2 * top, 17.2 * top], launch: 0.55, rev: 10, roll: 9, up: 0.95, down: 0.66,
  airPitch: 7.5, grip: 1.1, brake: 21, voice: V2,
});
const four = (force: number, mass: number, top: number, gyr: number): Power => ({
  name: "4-STROKE", mass, gyr, force,
  curve: [0.62, 0.8, 0.92, 0.98, 1, 0.97, 0.9, 0.78, 0.6],
  gears: [6.8 * top, 10.2 * top, 13.4 * top, 16.6 * top], launch: 0.34, rev: 5.5, roll: 5.5, up: 0.9, down: 0.5,
  airPitch: 5.6, grip: 1.2, brake: 22, voice: V4,
});
const ebike = (force: number, mass: number, top: number): Power => ({
  name: "E-BIKE", mass, gyr: 0.6, force,
  curve: [1, 1, 0.98, 0.94, 0.86, 0.74, 0.6, 0.45, 0.3],
  gears: [6.2 * top, 9.4 * top, 12.8 * top], launch: 0, rev: 30, roll: 8, up: 0.85, down: 0.5,
  airPitch: 7, grip: 1.08, brake: 15, voice: VE,
});
const emoto = (force: number, mass: number, top: number): Power => ({
  name: "E-MOTO", mass, gyr: 0.6, force,
  curve: [1, 1, 1, 0.97, 0.9, 0.8, 0.68, 0.56, 0.44],
  gears: [15.5 * top], launch: 0, rev: 30, roll: 10, up: 1.1, down: 0,
  airPitch: 6.5, grip: 1.12, brake: 20, voice: VM,
});
/** A pedal e-bike's shorter frame (quick to lift). */
const EB = { rear: -0.6, front: 0.6, drop: 0.4, radius: 0.34 };
const S = (travel: number, damp = 0.62, caseDrop = 26) => ({ travel, sag: 0.09, damp, caseDrop });

export const MODELS: Model[] = [
  // CHROMEWASP: 2-strokes. Cheap rebuilds, often.
  { id: "buzzline", cls: "2t", name: "BUZZLINE", blurb: "The arcade kid's first chrome. Little down low, a hard hit up top.", price: 1800, tier: 1, upkeep: { wear: 1, cost: 1 }, power: two(18, 0.9, 1, 1), susp: S(0.28), sweet: 0.08, hop: 5.4 },
  { id: "razorhive", cls: "2t", name: "RAZORHIVE", blurb: "Sharper porting, a lighter frame. Loops out if you blink.", price: 3600, tier: 2, upkeep: { wear: 1.1, cost: 1.1 }, power: two(19.5, 0.88, 1.02, 1.04), susp: S(0.3, 0.64, 27), sweet: 0.075, hop: 5.6 },
  { id: "nectar-burn", cls: "2t", name: "NECTAR BURN", blurb: "Pre-mix and neon. A wider band that pulls out of the berms.", price: 5600, tier: 3, upkeep: { wear: 1.15, cost: 1.2 }, power: two(20.5, 0.9, 1.04, 1.06), susp: S(0.31, 0.66, 28), sweet: 0.08, hop: 5.7 },
  { id: "hivequeen", cls: "2t", name: "HIVEQUEEN", blurb: "The factory racer from the old posters. Screams, flies, wears fast.", price: 8200, tier: 4, upkeep: { wear: 1.3, cost: 1.35 }, power: two(22, 0.86, 1.06, 1.1), susp: S(0.33, 0.68, 29), sweet: 0.07, hop: 5.9 },
  // IRONVAULT WORKS: 4-strokes. Slow to wear, dear to fix.
  { id: "anvil", cls: "4t", name: "ANVIL", blurb: "A foundry thumper. Smooth from the bottom, slow to rotate.", price: 2200, tier: 1, upkeep: { wear: 0.65, cost: 1 }, power: four(17.5, 1.15, 1, 0.68), susp: S(0.29), sweet: 0.1, hop: 5 },
  { id: "forgeback", cls: "4t", name: "FORGEBACK", blurb: "More bore, the same calm. Holds a line through the whoops.", price: 4200, tier: 2, upkeep: { wear: 0.7, cost: 1.1 }, power: four(18.8, 1.14, 1.02, 0.67), susp: S(0.31, 0.64, 28), sweet: 0.1, hop: 5.1 },
  { id: "slag-ox", cls: "4t", name: "SLAG OX", blurb: "Heavy as a girder, pulls like a freight lift. Cases nothing.", price: 6400, tier: 3, upkeep: { wear: 0.72, cost: 1.25 }, power: four(20, 1.2, 1.03, 0.7), susp: S(0.33, 0.66, 30), sweet: 0.11, hop: 5 },
  { id: "bulkhead", cls: "4t", name: "BULKHEAD", blurb: "The Works' sealed-bay racer: big torque, a top end that keeps on.", price: 9000, tier: 4, upkeep: { wear: 0.8, cost: 1.4 }, power: four(21.2, 1.12, 1.06, 0.66), susp: S(0.34, 0.68, 31), sweet: 0.1, hop: 5.2 },
  // LUMEN & LANE: e-bikes. Light, cheap to run, slow on a race track.
  { id: "glidewire", cls: "ebike", name: "GLIDEWIRE", blurb: "A glass-frame city bike with a three-speed hub. Lifts on a whisper.", price: 1200, tier: 1, upkeep: { wear: 0.8, cost: 0.6 }, power: ebike(12, 0.6, 1), frame: EB, susp: S(0.24, 0.6, 22), sweet: 0.12, hop: 6.2 },
  { id: "pulse-pedal", cls: "ebike", name: "PULSE PEDAL", blurb: "More assist, stiffer forks. Hops kerbs like they owe it money.", price: 2600, tier: 2, upkeep: { wear: 0.85, cost: 0.65 }, power: ebike(13.2, 0.6, 1.05), frame: EB, susp: S(0.26, 0.62, 23), sweet: 0.12, hop: 6.5 },
  { id: "arclight", cls: "ebike", name: "ARCLIGHT", blurb: "Long-travel trail e-bike, lit like a night bus. Floats the jumps.", price: 4400, tier: 3, upkeep: { wear: 0.9, cost: 0.7 }, power: ebike(14.2, 0.62, 1.1), frame: EB, susp: S(0.3, 0.64, 25), sweet: 0.11, hop: 6.4 },
  { id: "nightloop", cls: "ebike", name: "NIGHTLOOP", blurb: "The lane's flagship: a race motor in a pedal bike's frame.", price: 6600, tier: 4, upkeep: { wear: 1, cost: 0.8 }, power: ebike(15.4, 0.6, 1.16), frame: EB, susp: S(0.32, 0.66, 26), sweet: 0.11, hop: 6.6 },
  // VOLTGRIT: electric dirt bikes. Instant torque, one gear, batteries to look after.
  { id: "sparkhound", cls: "emoto", name: "SPARKHOUND", blurb: "Garage-wired and hungry. Every newton at once, then a whine.", price: 2000, tier: 1, upkeep: { wear: 0.85, cost: 1 }, power: emoto(13.5, 0.85, 1), susp: S(0.28), sweet: 0.07, hop: 5.6 },
  { id: "gridrat", cls: "emoto", name: "GRIDRAT", blurb: "Light, twitchy, a fat cell pack. Rides the city's spare current.", price: 3900, tier: 2, upkeep: { wear: 0.9, cost: 1.05 }, power: emoto(14.6, 0.82, 1.03), susp: S(0.3, 0.64, 27), sweet: 0.07, hop: 5.8 },
  { id: "overcharge", cls: "emoto", name: "OVERCHARGE", blurb: "A bigger motor and the cooling to keep it. Pulls to the far fence.", price: 6000, tier: 3, upkeep: { wear: 0.95, cost: 1.15 }, power: emoto(16, 0.86, 1.06), susp: S(0.32, 0.66, 28), sweet: 0.075, hop: 5.8 },
  { id: "feral-coil", cls: "emoto", name: "FERAL COIL", blurb: "Voltgrit's lab bike. Brutal on the gas, gentle on nothing.", price: 8600, tier: 4, upkeep: { wear: 1.05, cost: 1.3 }, power: emoto(17.4, 0.84, 1.1), susp: S(0.34, 0.68, 30), sweet: 0.07, hop: 6 },
];

/** A model by id (the first starter if unknown). */
export const model = (id: string): Model => MODELS.find((m) => m.id === id) ?? MODELS[0]!;
/** The four starter choices: the cheapest model in each class. */
export const STARTERS: Model[] = (Object.keys(CLASSES) as ClassId[]).map((c) => MODELS.filter((m) => m.cls === c).sort((a, b) => a.price - b.price)[0]!);
/** What the v1 shop sells new (a subset; the data holds the full roster). */
export const SHOP_MODELS: string[] = MODELS.filter((m) => m.tier <= 2).map((m) => m.id);
