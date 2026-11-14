// The economy, in one file: what you start with, what every event pays, how fast every part wears,
// and what everything costs (parts, mods, cosmetics, bikes, garage room). Logic lives in
// ../model/economy.ts and ../model/garage.ts; numbers live here, so balancing is one diff.
import type { ClassId } from "./roster.ts";

/** Credits at first run (after the free starter bike and kit). */
export const START_CREDITS = 400;
/** Bikes the garage holds. */
export const GARAGE_SLOTS = 3;

/** The parts every bike wears. `motor` is the class's: a top end, an engine or a battery. */
export type PartId = "tyres" | "chain" | "motor" | "susp" | "brakes";
export const PARTS: PartId[] = ["tyres", "chain", "motor", "susp", "brakes"];
/** Part names in the garage, by class for the motor. */
export const PART_NAME: Record<PartId, string> = { tyres: "TYRES", chain: "CHAIN & SPROCKETS", motor: "MOTOR", susp: "SUSPENSION SEALS", brakes: "BRAKES & GRIPS" };
export const MOTOR_NAME: Record<ClassId, string> = { "2t": "TOP END", "4t": "ENGINE", ebike: "BATTERY", emoto: "BATTERY" };

/** What a part costs to replace or rebuild (back to new), before the model's upkeep.cost. */
export const PART_PRICE: Record<PartId, number> = { tyres: 140, chain: 90, motor: 0, susp: 180, brakes: 80 };
/** The motor's price per class: 2-strokes rebuild cheap and often, 4-strokes rarely and dear. */
export const MOTOR_PRICE: Record<ClassId, number> = { "2t": 220, "4t": 480, ebike: 240, emoto: 420 };
/** A part is offered for service once it is under this. */
export const SERVICE_BELOW = 0.99;

/** Wear, as condition lost (parts are 0..1). Distances in world units (a Race lap is about 110). */
export const WEAR = {
  /** Per 100 units ridden. */
  distance: { tyres: 0.01, chain: 0.005, motor: 0, susp: 0.004, brakes: 0.004 } as Record<PartId, number>,
  /** Per second on the gas (the motor by class, below). */
  gas: { tyres: 0.0005, chain: 0.0008, motor: 0, susp: 0, brakes: 0 } as Record<PartId, number>,
  /** The motor per second on the gas, by class. */
  motorGas: { "2t": 0.0022, "4t": 0.0011, ebike: 0.0009, emoto: 0.001 } as Record<ClassId, number>,
  /** Per second up on one wheel (a spinning rear, a hot clutch). */
  wheelie: { tyres: 0.004, chain: 0.0015, motor: 0.001, susp: 0, brakes: 0.001 } as Record<PartId, number>,
  /** Per second in the air (the landings), and per hard landing. */
  air: { tyres: 0, chain: 0, motor: 0, susp: 0.0015, brakes: 0 } as Record<PartId, number>,
  hard: { tyres: 0.004, chain: 0.002, motor: 0, susp: 0.012, brakes: 0 } as Record<PartId, number>,
  /** Per crash. */
  crash: { tyres: 0.01, chain: 0.006, motor: 0.01, susp: 0.02, brakes: 0.012 } as Record<PartId, number>,
  /** A landing this fast (downward, units/s) is a hard one. */
  hardDrop: 16,
};

/** What each event pays. */
export const PAYOUT = {
  /** Race: by finishing place (1st..4th), a clean race (no crash) bonus, and a pole-to-flag bonus. */
  race: { place: [450, 300, 200, 130], clean: 80, led: 60 },
  /** Big Air: per point of the judges' total (out of 100), per flip, at least `min`. */
  bigair: { perJudge: 4, perFlip: 20, min: 60 },
  /** Wheelie City: a base, per score point, capped. */
  wheelie: { base: 40, perPoint: 1 / 20, cap: 700 },
  /** Free Ride: per second ridden, per second of air and of wheelie, per trick landed (big air or a flip, a flip pays more), capped per session. */
  freeride: { perSecond: 0.5, perAir: 6, perWheelie: 4, perTrick: 5, perFlip: 15, cap: 250 },
  /** Quitting an event: this share of what it would have paid so far (0: nothing). */
  quit: 0,
};

/** Mods: levels and the price of each level (index 1.. is level 1..). */
export type ModId = "power" | "gearing" | "susp";
export const MODS: Record<ModId, { name: string; e: string; max: number; price: number[]; blurb: string }> = {
  power: { name: "EXHAUST", e: "CONTROLLER", max: 3, price: [0, 300, 550, 900], blurb: "More pull through the revs." },
  gearing: { name: "SHORT GEARING", e: "SHORT GEARING", max: 2, price: [0, 200, 380], blurb: "Harder launches, a lower top speed." },
  susp: { name: "SUSPENSION", e: "SUSPENSION", max: 3, price: [0, 280, 520, 850], blurb: "More travel, firmer damping: lands bigger." },
};

/** Cosmetics, by kind and tier (tier 0 colours are in the starter kit and cost the first price). */
export const COSMETIC = {
  paint: [60, 150, 300],
  number: 20,
  helmet: [0, 180, 320],
  helmetPaint: [50, 120, 220],
  visor: [40, 90, 160],
  jersey: [50, 110, 200],
  pants: [40, 90, 170],
  pattern: [40, 100, 180],
  boots: [40, 90, 170],
  gloves: [30, 70, 130],
};

/** The pit crew: a free basic fix (every part back to at least `to`) once you have done `every`
 *  events since the last one, when something is under `below` and you can't pay to fix it. Nobody
 *  is ever stuck: every event pays something, a worn bike still rides (slower), and the crew helps. */
export const PIT_CREW = { every: 3, below: 0.5, to: 0.6 };
/** The floor of tune(): how much of a part's effect is left at condition 0 (the bike always rides). */
export const WORN_FLOOR = { grip: 0.7, motor: 0.72, chain: 0.9, brakes: 0.65, damp: 0.55, caseDrop: 0.85 };
