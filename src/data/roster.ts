// The bike roster, as data: three families (gas dirt bikes, electric bikes, street bikes), five
// classes, six makers, four models per dirt class and three street bikes (nineteen in all). Every model is an engine and chassis for ../bike/bike.ts (`power`), a suspension, its price
// and its upkeep (how fast its parts wear and what a rebuild costs, as multipliers on the economy's
// rates). The first model of each class is the cheapest: the four starter choices at first run.
// The names written here are the SAFE tier's (fully original: BLUEWAKE's harbour-blue 2-strokes,
// EMBERLINE's red thumpers, LIMEJET's lime-green bruisers, VOLTHOWL's grey electric wolf, BUZZWORKS'
// light volt-motos, TRAILKIT's fox-orange e-bikes, IRONJAW's red naked V4); the default build shows
// the NOD tier over them and the private test link the REAL one (./names.ts, docs/names.md). The ids
// (`yamada`, `buzzline`, …) never change with the names: saves and the net carry ids. Logos and art
// are our own in every tier. Each model's
// look (its `body`: ../bike/bodies.ts) follows its family: gas bikes the rig's own tank, shrouds and
// pipe; electrics no tank and no pipe, a battery box and their own frame; street bikes on asphalt
// rubber with bodywork of their own (a mini, a fully faired supersport, a naked superbike).
import type { Power } from "../bike/bike.ts";
import type { BodyKind } from "../bike/bodies.ts";
import { wear } from "./names.ts";

/** The makers: a name, a one-line voice, and the factory colours (flat, our palette). */
export type MakerId = "yamada" | "hondo" | "kawazakura" | "starkwolf" | "surgeon" | "makfox" | "curbcat" | "nightglass" | "ironjaw";
export interface Maker { id: MakerId; name: string; motto: string; colors: [plastic: string, plastic2: string] }
export const MAKERS: Record<MakerId, Maker> = {
  yamada: { id: "yamada", name: "BLUEWAKE", motto: "Harbour-district blue. The 2-stroke snap every kid on the block chases.", colors: ["#2b6bff", "#eef0ff"] },
  hondo: { id: "hondo", name: "EMBERLINE", motto: "Red thumpers from the night foundry. Smooth, strong, never quits.", colors: ["#ff3b4f", "#eef0ff"] },
  kawazakura: { id: "kawazakura", name: "LIMEJET", motto: "Lime-green bruisers from the cherry-blossom docks. Mean, fast, loud about it.", colors: ["#b6ff3b", "#1b1a2c"] },
  starkwolf: { id: "starkwolf", name: "VOLTHOWL", motto: "A grey wolf on volts. Silent, savage, hunts the far fence.", colors: ["#8a8fa8", "#ff8a3d"] },
  surgeon: { id: "surgeon", name: "BUZZWORKS", motto: "Featherweight volt-motos with a buzz. Point, twist, gone.", colors: ["#1fd6c9", "#1b1a2c"] },
  makfox: { id: "makfox", name: "TRAILKIT", motto: "Fox-orange e-bikes for the alley lines. Quick, light, sly.", colors: ["#ff8a3d", "#eef0ff"] },
  // The street makers: their own ids (and paints), shown under a dirt maker's name in every tier
  // (the mini a Honda-style red, the supersport a Yamaha-style blue) or their own (the naked V4).
  curbcat: { id: "curbcat", name: "EMBERLINE", motto: "Little red street minis built in a garage behind the noodle bar. Up on one wheel by the second lamp post.", colors: ["#ff3b4f", "#eef0ff"] },
  nightglass: { id: "nightglass", name: "BLUEWAKE", motto: "Blue glass and wind tunnels on the harbour front. Faired, flat out, gone.", colors: ["#2b6bff", "#eef0ff"] },
  ironjaw: { id: "ironjaw", name: "IRONJAW", motto: "Naked red brawlers with a screaming V4 and no manners.", colors: ["#d4202c", "#1b1a2c"] },
};

/** The five classes. */
export type ClassId = "2t" | "4t" | "ebike" | "emoto" | "street";
/** The three families: what a bike is built for, how it looks and which upgrade it takes. */
export type FamilyId = "gas" | "electric" | "street";

export interface BikeClass {
  id: ClassId;
  /** The class, for the HUD and the garage. */
  name: string;
  /** The class's makers (the site's card), from its models' makers in the tier shown; each model names its own (`Model.maker`). */
  maker: string;
  /** The class's voice, one line. */
  motto: string;
  /** Its family (gas dirt, electric, street). */
  family: FamilyId;
  /** How the rig draws it: a 2-stroke's chamber, a 4-stroke's silencer, or a body of its own
   *  (../bike/bodies.ts; a model can name another with `Model.body`). */
  rig: "2t" | "4t" | BodyKind;
  /** The motor part this class wears: a top end (2-stroke), an engine (4-stroke) or a battery. */
  motor: "topend" | "engine" | "battery";
}

export const CLASSES: Record<ClassId, BikeClass> = {
  "2t": { id: "2t", name: "2-STROKE", maker: "", motto: "Ring-ding smoke under neon. Light, loud, peaky: cheap rebuilds, often.", family: "gas", rig: "2t", motor: "topend" },
  "4t": { id: "4t", name: "4-STROKE", maker: "", motto: "Thumpers. Heavy, torquey, slow to wear and dear to fix.", family: "gas", rig: "4t", motor: "engine" },
  ebike: { id: "ebike", name: "E-BIKE", maker: "", motto: "Pedal-assist alley bikes. Light, quick to lift, slow on a race track.", family: "electric", rig: "ebike", motor: "battery" },
  emoto: { id: "emoto", name: "ELECTRIC DIRT", maker: "", motto: "Volt-motos. Every newton at once, one gear, a battery to look after.", family: "electric", rig: "emoto", motor: "battery" },
  street: { id: "street", name: "STREET", maker: "", motto: "Asphalt bikes. Sticky road rubber, short springs, long legs: kings of Wheelie City, lost on the dirt.", family: "street", rig: "naked", motor: "engine" },
};

export interface Model {
  id: string;
  cls: ClassId;
  maker: MakerId;
  /** Model name (with its maker: `makerOf`). */
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
  /** Its look, when not its class's (a street class's mini, supersport or naked: ../bike/bodies.ts). */
  body?: BodyKind;
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
/** Street bikes: road tyres (grip on the asphalt), five or six gears, a long top gear, short stiff
 *  springs (a dirt landing cases them: ../model/families.ts takes more off on the dirt). The voice
 *  per body: a mini's buzzy single, a supersport's howl, a naked V4's bark. */
const street = (name: string, force: number, mass: number, top: number, gyr: number, voice: Power["voice"]): Power => ({
  name, mass, gyr, force,
  curve: [0.5, 0.62, 0.74, 0.86, 0.95, 1, 0.98, 0.9, 0.72],
  gears: [6.6 * top, 10 * top, 13.4 * top, 16.6 * top, 19.4 * top, 21.8 * top], launch: 0.42, rev: 7.5, roll: 7, up: 0.92, down: 0.58,
  airPitch: 5, grip: 1.34, brake: 26, voice,
});
const VMINI: Power["voice"] = [70, 260, "square"], VSPORT: Power["voice"] = [88, 420, "sawtooth"], VNAKED: Power["voice"] = [52, 210, "sawtooth"];
/** A mini street bike's short, low frame (quick to lift, easy to hold up). */
const MINI = { rear: -0.56, front: 0.6, drop: 0.38, radius: 0.34 };
/** A big street bike's long, low wheelbase (stable at speed, slower to lift). */
const BIG = { rear: -0.7, front: 0.86, drop: 0.4, radius: 0.33 };
const R = (travel: number, damp = 0.72, caseDrop = 20) => ({ travel, sag: 0.08, damp, caseDrop });
/** A pedal e-bike's shorter frame (quick to lift). */
const EB = { rear: -0.6, front: 0.6, drop: 0.4, radius: 0.34 };
const S = (travel: number, damp = 0.62, caseDrop = 26) => ({ travel, sag: 0.09, damp, caseDrop });
/** The top gear stretches with the tier (1 starter .. 4): the better bikes keep their torque (the
 *  lower gears and the curve are untouched) and run on a little further at the top. Small steps: the
 *  stretch gives a tier 4 bike about 3 mph more at the top (a starter none), so a race on stock bikes
 *  of one class stays close. Measured: tests/pace.test.mjs, the garage's PACE row. */
export const TOP_STRETCH = [1, 1.025, 1.05, 1.08] as const;
const tall = (p: Power, tier: number): Power => {
  const g = Array.from(p.gears), k = TOP_STRETCH[tier - 1] ?? 1;
  g[g.length - 1] = g[g.length - 1]! * k;
  return { ...p, gears: g };
};

export const MODELS: Model[] = ([
  // 2-strokes: the blue maker and the lime one. Cheap rebuilds, often. The 250 is the class's best snap.
  { id: "buzzline", cls: "2t", maker: "yamada", name: "RIPPER 125", blurb: "The little blue screamer every kid starts on. Nothing down low, a hard hit up top.", price: 1800, tier: 1, upkeep: { wear: 1, cost: 1 }, power: two(18, 0.9, 1, 1), susp: S(0.28), sweet: 0.08, hop: 5.4 },
  { id: "razorhive", cls: "2t", maker: "kawazakura", name: "SPRITE 150", blurb: "Lime-green and short-tempered. Light, twitchy, bites at the top of the revs.", price: 3600, tier: 2, upkeep: { wear: 1.1, cost: 1.1 }, power: two(19.5, 0.88, 1.02, 1.04), susp: S(0.3, 0.64, 27), sweet: 0.075, hop: 5.6 },
  { id: "nectar-burn", cls: "2t", maker: "yamada", name: "RIPPER 200", blurb: "The middle blue. A wider band than the 125 that pulls out of the berms.", price: 5600, tier: 3, upkeep: { wear: 1.15, cost: 1.2 }, power: two(20.5, 0.9, 1.04, 1.06), susp: S(0.31, 0.66, 28), sweet: 0.08, hop: 5.7 },
  { id: "hivequeen", cls: "2t", maker: "yamada", name: "RIPPER 250", blurb: "Harbour-blue legend. The sharpest two-stroke snap in the city: screams, flies, wears fast.", price: 8200, tier: 4, upkeep: { wear: 1.3, cost: 1.35 }, power: two(22.4, 0.86, 1.07, 1.14), susp: S(0.33, 0.68, 29), sweet: 0.07, hop: 5.9 },
  // 4-strokes: the red maker and the lime one. Slow to wear, dear to fix.
  { id: "anvil", cls: "4t", maker: "hondo", name: "BLAZE 150", blurb: "A red thumper to learn on. Smooth from the bottom, slow to rotate.", price: 2200, tier: 1, upkeep: { wear: 0.65, cost: 1 }, power: four(17.5, 1.15, 1, 0.68), susp: S(0.29), sweet: 0.1, hop: 5 },
  { id: "forgeback", cls: "4t", maker: "hondo", name: "BLAZE 250", blurb: "More bore, the same calm. Holds a line through the whoops.", price: 4200, tier: 2, upkeep: { wear: 0.7, cost: 1.1 }, power: four(18.8, 1.14, 1.02, 0.67), susp: S(0.31, 0.64, 28), sweet: 0.1, hop: 5.1 },
  { id: "slag-ox", cls: "4t", maker: "kawazakura", name: "BRUTE 450", blurb: "A lime-green big-bore. Heavy as a girder, pulls like a freight lift. Cases nothing.", price: 6400, tier: 3, upkeep: { wear: 0.72, cost: 1.25 }, power: four(20, 1.2, 1.03, 0.7), susp: S(0.33, 0.66, 30), sweet: 0.11, hop: 5 },
  { id: "bulkhead", cls: "4t", maker: "hondo", name: "BLAZE 450 PRO", blurb: "The factory team's red racer: big torque, a top end that keeps on.", price: 9000, tier: 4, upkeep: { wear: 0.8, cost: 1.4 }, power: four(21.2, 1.12, 1.06, 0.66), susp: S(0.34, 0.68, 31), sweet: 0.1, hop: 5.2 },
  // E-bikes: the fox-orange maker. Light, cheap to run, slow on a race track.
  { id: "glidewire", cls: "ebike", maker: "makfox", name: "CUB", blurb: "A fox-orange alley bike with a three-speed hub. Lifts on a whisper.", price: 1200, tier: 1, upkeep: { wear: 0.8, cost: 0.6 }, power: ebike(12, 0.6, 1), frame: EB, susp: S(0.24, 0.6, 22), sweet: 0.12, hop: 6.2 },
  { id: "pulse-pedal", cls: "ebike", maker: "makfox", name: "RED", blurb: "More assist, stiffer forks. Hops kerbs like they owe it money.", price: 2600, tier: 2, upkeep: { wear: 0.85, cost: 0.65 }, power: ebike(13.2, 0.6, 1.05), frame: EB, susp: S(0.26, 0.62, 23), sweet: 0.12, hop: 6.5 },
  { id: "arclight", cls: "ebike", maker: "makfox", name: "FROST", blurb: "Long-travel trail e-bike, lit like a night bus. Floats the jumps.", price: 4400, tier: 3, upkeep: { wear: 0.9, cost: 0.7 }, power: ebike(14.2, 0.62, 1.1), frame: EB, susp: S(0.3, 0.64, 25), sweet: 0.11, hop: 6.4 },
  { id: "nightloop", cls: "ebike", maker: "makfox", name: "SILVER", blurb: "The den's flagship: a race motor in a pedal bike's frame.", price: 6600, tier: 4, upkeep: { wear: 1, cost: 0.8 }, power: ebike(15.4, 0.6, 1.16), frame: EB, susp: S(0.32, 0.66, 26), sweet: 0.11, hop: 6.6 },
  // Electric dirt: the light volt-motos and the grey wolf (race). Instant torque, one gear, batteries to look after.
  { id: "sparkhound", cls: "emoto", maker: "surgeon", name: "DART", blurb: "Featherweight and hungry. Every newton at once, then a whine.", price: 2000, tier: 1, upkeep: { wear: 0.85, cost: 1 }, power: emoto(13.5, 0.85, 1), susp: S(0.28), sweet: 0.07, hop: 5.6 },
  { id: "gridrat", cls: "emoto", maker: "surgeon", name: "DART MAX", blurb: "Bigger cells, longer legs, the same buzz. Rides the city's spare current.", price: 3900, tier: 2, upkeep: { wear: 0.9, cost: 1.05 }, power: emoto(14.6, 0.82, 1.03), susp: S(0.3, 0.64, 27), sweet: 0.07, hop: 5.8 },
  { id: "overcharge", cls: "emoto", maker: "starkwolf", name: "GREYWOLF", blurb: "A wolf's motor and the cooling to keep it. Pulls to the far fence.", price: 6000, tier: 3, upkeep: { wear: 0.95, cost: 1.15 }, power: emoto(16, 0.86, 1.06), susp: S(0.32, 0.66, 28), sweet: 0.075, hop: 5.8 },
  { id: "feral-coil", cls: "emoto", maker: "starkwolf", name: "ALPHA", blurb: "The pack leader. Brutal on the gas, silent, gentle on nothing.", price: 8600, tier: 4, upkeep: { wear: 1.05, cost: 1.3 }, power: emoto(17.4, 0.84, 1.1), susp: S(0.34, 0.68, 30), sweet: 0.07, hop: 6 },
  // Street bikes: a red mini, a blue supersport, a red naked V4. Built for Wheelie City's
  // asphalt; on the dirt they slide and case (../model/families.ts). Never a starter.
  { id: "curb-pup", cls: "street", body: "mini", maker: "curbcat", name: "BLOCK PUP 125", blurb: "A little red street mini with fat tyres. Low, light, wheelies all day down the avenue.", price: 2400, tier: 1, upkeep: { wear: 0.6, cost: 0.8 }, power: street("MINI", 15, 0.82, 0.62, 0.56, VMINI), frame: MINI, susp: R(0.16, 0.7, 19), sweet: 0.12, hop: 5.6 },
  { id: "tidebreaker", cls: "street", body: "sport", maker: "nightglass", name: "TIDEBREAKER 600", blurb: "Harbour-blue and fully faired. Screams to the far end of the boulevard; hates a rut.", price: 9800, tier: 3, upkeep: { wear: 0.9, cost: 1.5 }, power: street("SUPERSPORT", 20.5, 1.12, 1.02, 0.7, VSPORT), frame: BIG, susp: R(0.18, 0.74, 20), sweet: 0.075, hop: 4.8 },
  { id: "bare-knuckle", cls: "street", body: "naked", maker: "ironjaw", name: "BARE KNUCKLE V4", blurb: "A red naked superbike: no fairing, a screaming V4, torque for every gear. Lifts the front on a thought.", price: 12500, tier: 4, upkeep: { wear: 0.95, cost: 1.7 }, power: street("NAKED", 22.5, 1.16, 1.06, 0.66, VNAKED), frame: BIG, susp: R(0.2, 0.72, 21), sweet: 0.085, hop: 4.9 },
] as Model[]).map((m) => ({ ...m, power: tall(m.power, m.tier) }));


/** A model's family (gas, electric, street). */
export const familyOf = (m: Model): FamilyId => CLASSES[m.cls].family;
/** A model's look (its body, else its class's). */
export const bodyOf = (m: Model): BikeClass["rig"] => m.body ?? CLASSES[m.cls].rig;

/** A model's maker. */
export const makerOf = (m: Model): Maker => MAKERS[m.maker];
/** A model by id (the first starter if unknown). */
export const model = (id: string): Model => MODELS.find((m) => m.id === id) ?? MODELS[0]!;
/** The four starter choices: the cheapest model in each dirt class (street bikes are bought). */
export const STARTERS: Model[] = (Object.keys(CLASSES) as ClassId[]).filter((c) => CLASSES[c].family !== "street").map((c) => MODELS.filter((m) => m.cls === c).sort((a, b) => a.price - b.price)[0]!);
/** What the v1 shop sells new (a subset; the data holds the full roster). */
export const SHOP_MODELS: string[] = MODELS.filter((m) => m.tier <= 2).map((m) => m.id);

// The names in the tier shown (./names.ts): the makers, the models, then each class's maker line.
const classMakers = () => {
  for (const c of Object.values(CLASSES)) c.maker = [...new Set(MODELS.filter((m) => m.cls === c.id).map((m) => MAKERS[m.maker].name))].join(" · ");
};
wear(Object.values(MAKERS), (s, m) => s.makers[m.id], ["name", "motto"]);
wear(MODELS, (s, m) => s.models[m.id], ["name", "blurb"], classMakers);
