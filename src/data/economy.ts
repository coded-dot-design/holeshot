// The economy, in one file: what you start with, what every event pays, how fast every part wears,
// and what everything costs (parts, mods, cosmetics, bikes, garage room). Logic lives in
// ../model/economy.ts and ../model/garage.ts; numbers live here, so balancing is one diff.
import type { ClassId } from "./roster.ts";

/** Credits at first run (after the free starter bike and kit). */
export const START_CREDITS = 200;
/** Bikes the garage holds. */
export const GARAGE_SLOTS = 3;

/** The parts every bike wears. `motor` is the class's: a top end, an engine or a battery. */
export type PartId = "tyres" | "chain" | "motor" | "susp" | "brakes";
export const PARTS: PartId[] = ["tyres", "chain", "motor", "susp", "brakes"];
/** Part names in the garage, by class for the motor. */
export const PART_NAME: Record<PartId, string> = { tyres: "TYRES", chain: "CHAIN & SPROCKETS", motor: "MOTOR", susp: "SUSPENSION SEALS", brakes: "BRAKES & GRIPS" };
export const MOTOR_NAME: Record<ClassId, string> = { "2t": "TOP END", "4t": "ENGINE", ebike: "BATTERY", emoto: "BATTERY" };

/** What a part costs to replace or rebuild (back to new), before the model's upkeep.cost. */
export const PART_PRICE: Record<PartId, number> = { tyres: 120, chain: 80, motor: 0, susp: 180, brakes: 80 };
/** The motor's price per class: 2-strokes rebuild cheap and often, 4-strokes rarely and dear. */
export const MOTOR_PRICE: Record<ClassId, number> = { "2t": 200, "4t": 480, ebike: 240, emoto: 420 };
/** A part is offered for service once it is under this. */
export const SERVICE_BELOW = 0.99;

/** Wear, as condition lost (parts are 0..1). Distances in world units (a Race lap is about 110). */
export const WEAR = {
  /** Per 100 units ridden. */
  distance: { tyres: 0.011, chain: 0.006, motor: 0, susp: 0.005, brakes: 0.005 } as Record<PartId, number>,
  /** Per second on the gas (the motor by class, below). */
  gas: { tyres: 0.0006, chain: 0.001, motor: 0, susp: 0, brakes: 0 } as Record<PartId, number>,
  /** The motor per second on the gas, by class. */
  motorGas: { "2t": 0.0015, "4t": 0.0011, ebike: 0.0012, emoto: 0.0009 } as Record<ClassId, number>,
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
  /** Wheelie City: a base, per score point, capped; per chase escaped over a hump, less per ticket
   *  from the neon patrol (never below `floor`: a session always pays). */
  wheelie: { base: 40, perPoint: 1 / 20, cap: 700, escape: 45, ticket: 15, floor: 20 },
  /** Free Ride: per second ridden, per second of air and of wheelie, per trick landed (big air or a flip, a flip pays more), per km (Endless Desert), per trick point (Endless), capped per session. */
  freeride: { perSecond: 0.5, perAir: 6, perWheelie: 4, perTrick: 5, perFlip: 15, cap: 250, perKm: 20, perPoint: 1 / 100 },
  /** Quitting an event: this share of what it would have paid so far (0: nothing). */
  quit: 0,
};

/** Online (two to four people in one room: ../online/match.ts). Each person's own profile gets the
 *  payout and the wear for their own result, as alone, and online pays MORE, to bring people
 *  together: the solo payout × `bonus`, plus `beat` for each person you finished ahead of (people
 *  still in the room at the end; AI rivals and seats that left don't count). A race won against
 *  three people pays 450 × 1.5 + 3 × 75 = 900, twice the solo win (plus the clean and led bonuses,
 *  × 1.5 too).
 *  It can't be farmed: the extra (everything over the solo payout) pays in full for the first `full`
 *  online rides in any rolling hour (`window`, ms), then halves with each ride after (× fade^k:
 *  50 %, 25 %, 12.5 %, 6.25 %, then nothing: under `floor` it is 0, from the 11th ride in an hour); the solo part
 *  always pays, so online never pays less than riding alone. A ride you left, or one under
 *  `minSeconds`, pays no extra. The hour is counted on the device (the profile keeps the times of
 *  the last `keep` online payouts), so leaving and rejoining a room changes nothing. */
export const ONLINE = { bonus: 1.5, beat: 75, full: 6, fade: 0.5, floor: 0.05, window: 3_600_000, minSeconds: 30, keep: 24 };

/** Mods: levels and the price of each level (index 1.. is level 1..). Stage 1 of every mod costs
 *  more than the start credits: the first real mod comes after about three or four events (the
 *  balance test in tests/garage.test.mjs rides the reference player to it). `only`: the class kind
 *  it fits ("fuel": 2- and 4-strokes, "e": e-bikes and electric dirt bikes). */
export type ModId = "power" | "brakes" | "weight" | "travel" | "cells";
export const MODS: Record<ModId, { name: string; e: string; max: number; price: number[]; blurb: string; only?: "e" | "fuel" }> = {
  power: { name: "EXHAUST", e: "CONTROLLER", max: 3, price: [0, 750, 1250, 1900], blurb: "Stage 1-3: more pull, most of it high in the revs." },
  brakes: { name: "BRAKES", e: "BRAKES", max: 2, price: [0, 750, 1150], blurb: "Bigger discs, sharper pads: stops shorter." },
  weight: { name: "WEIGHT SAVING", e: "WEIGHT SAVING", max: 2, price: [0, 900, 1500], blurb: "Light bolts, a lighter frame: quicker to lift, flick and flip." },
  travel: { name: "LONG TRAVEL KIT", e: "LONG TRAVEL KIT", max: 1, price: [0, 1300], blurb: "Longer forks and shock: soaks big landings, a touch lazier to rotate." },
  cells: { name: "BATTERY PACK", e: "BATTERY PACK", max: 2, price: [0, 950, 1600], blurb: "More cells: holds its voltage (top speed) as it wears, runs cooler. Heavier.", only: "e" },
};

/** Cosmetics, by kind and tier (tier 0 colours are in the starter kit and cost the first price). */
export const COSMETIC = {
  paint: [60, 150, 300],
  graphics: [0, 120, 240],
  plastics: [80, 140, 220],
  plate: [30, 60, 110],
  outfit: [0, 320, 520],
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

// ---- the garage, deeper (tune choices, tyre compounds, crash damage, warnings and failures, the
// showroom, trade-ins, more cosmetics). Logic: ../model/garage.ts, ../model/upkeep.ts, ../model/tune.ts.

/** Tune choices: bought once per bike, then free to switch (sprockets, springs, a motor map). Each
 *  is a trade: short gearing launches harder and tops out lower; tall the other way; soft springs
 *  grip and soak small bumps but bottom out sooner, stiff ones hold big landings and skip in the
 *  ruts; the eco map is gentle on the battery, the race map pulls harder and cooks it. */
export type SetupId = "gearing" | "spring" | "map";
export const SETUPS: Record<SetupId, { name: string; opts: { id: string; name: string; price: number; blurb: string }[]; only?: "e" }> = {
  gearing: { name: "GEARING", opts: [
    { id: "short", name: "SHORT", price: 350, blurb: "Harder launches and wheelies, a lower top speed." },
    { id: "stock", name: "STOCK", price: 0, blurb: "As it left the factory." },
    { id: "tall", name: "TALL", price: 350, blurb: "More top speed, a lazier launch." },
  ] },
  spring: { name: "SUSPENSION", opts: [
    { id: "soft", name: "SOFT", price: 400, blurb: "Grips and soaks the chop; bottoms out on big landings." },
    { id: "stock", name: "STOCK", price: 0, blurb: "The all-rounder." },
    { id: "stiff", name: "STIFF", price: 400, blurb: "Holds big jumps; skips in the ruts, less grip." },
  ] },
  map: { name: "MOTOR MAP", only: "e", opts: [
    { id: "eco", name: "ECO", price: 250, blurb: "Softer pull, the battery runs cool and lasts." },
    { id: "std", name: "STANDARD", price: 0, blurb: "The factory map." },
    { id: "race", name: "RACE", price: 450, blurb: "More pull and top speed; the battery runs hot and wears fast." },
  ] },
};
/** What each choice does in tune() (× on the number named) and to the wear (× on a part's rate). */
export const SETUP_FX = {
  gearing: { short: { gears: 0.94, force: 1.08 }, stock: { gears: 1, force: 1 }, tall: { gears: 1.06, force: 0.93 } },
  spring: { soft: { damp: 0.82, caseDrop: 0.94, grip: 1.03, travel: 1 }, stock: { damp: 1, caseDrop: 1, grip: 1, travel: 1 }, stiff: { damp: 1.18, caseDrop: 1.07, grip: 0.97, travel: 1 } },
  map: { eco: { force: 0.9, gears: 1, heat: 0.7 }, std: { force: 1, gears: 1, heat: 1 }, race: { force: 1.1, gears: 1.03, heat: 1.6 } },
};
/** Tyre compounds, chosen with each new set: grip (×), wear (×), price (× the set's). */
export type TyreId = "soft" | "med" | "hard";
export const TYRES: Record<TyreId, { name: string; grip: number; wear: number; price: number; blurb: string }> = {
  soft: { name: "SOFT", grip: 1.08, wear: 1.7, price: 1.2, blurb: "Sticks to anything, gone in a few races." },
  med: { name: "MEDIUM", grip: 1, wear: 1, price: 1, blurb: "The all-rounder." },
  hard: { name: "HARD", grip: 0.92, wear: 0.55, price: 0.9, blurb: "Slides more, lasts for ages." },
};
/** Mod effects in tune(), per level. */
export const MOD_FX = {
  /** Exhaust / controller: drive force + per level, and the curve + per level toward the limiter. */
  power: { force: 0.045, curve: 0.035 },
  brakes: { brake: 0.12 },
  /** Weight saving: mass and pitch inertia − per level. */
  weight: { mass: 0.04, gyr: 0.03 },
  /** Long travel kit: travel ×, case line ×, pitch inertia × (lazier), hop ×. */
  travel: { travel: 1.18, caseDrop: 1.1, gyr: 1.03, hop: 0.95 },
  /** Battery pack: the sag floor of the top speed + per level, mass + per level, motor heat − per level. */
  cells: { sag: 0.045, mass: 0.025, heat: 0.15 },
};
/** Wear's feel beyond WORN_FLOOR: a tired top end (or engine) loses top speed to this floor at 0;
 *  cooked suspension loses travel to this floor (it bottoms out). */
export const TIRED = { top: 0.94, travel: 0.78 };

/** Parts read as worn under WARN (amber, the garage and the menu say so) and may fail under FAIL.at
 *  (red, "MAY FAIL"; the ride screen asks before you go). A part under the line fails in an event
 *  with a chance that grows from 0 at the line to FAIL.max at 0, rolled from the event's seed (one
 *  failure an event at most). A failure costs FAIL.pay of the event's payout (towed in) and leaves
 *  the part at 0 until it is replaced; the pit crew helps at once if you can't pay. Nothing above
 *  the line ever fails. */
export const WARN = 0.35;
export const FAIL = { at: 0.15, max: 0.5, pay: 0.5, minSeconds: 10 };
export const FAIL_NAME: Record<PartId, string> = { tyres: "PUNCTURE", chain: "CHAIN SNAPPED", motor: "MOTOR LET GO", susp: "SEALS BLEW", brakes: "BRAKES FADED" };

/** Crash damage (0 new .. 1 wrecked): bent bars (the bike pulls in the air, a narrower balance
 *  window) and cracked plastics (they look it, and flap: a hair of top speed). Per crash and per hard
 *  landing; fixed for DAMAGE_PRICE (× the model's upkeep.cost). */
export type DamageId = "bars" | "plastics";
export const DAMAGE = { crash: { bars: 0.12, plastics: 0.15 }, hard: { bars: 0, plastics: 0.03 } };
export const DAMAGE_PRICE: Record<DamageId, number> = { bars: 70, plastics: 110 };
export const DAMAGE_NAME: Record<DamageId, string> = { bars: "BENT BARS", plastics: "CRACKED PLASTICS" };
export const DAMAGE_FX = { airPitch: 0.1, sweet: 0.2, top: 0.02 };

/** The showroom: tiers 1-2 are always for sale; tier 3 and 4 open with progress (events ridden) or
 *  credits earned, whichever comes first. */
export const UNLOCK: Record<number, { events: number; earned: number }> = { 3: { events: 12, earned: 5000 }, 4: { events: 25, earned: 12000 } };
/** Trade-in: a share of the new price, scaled by condition (worst part, damage), plus a share of
 *  what its mods cost. Rounded to 10. */
export const TRADE = { base: 0.5, wornLoss: 0.3, damageLoss: 0.1, mods: 0.35 };

/** A service log entry per bike (newest first), at most this many. */
export const LOG_MAX = 24;

/* The balance, measured (tests/garage.test.mjs "balance", 2026-11-14). The reference player rides a
   mid-field race (3rd, a crash: 200), Big Air (judges 55, a flip: 240), Wheelie City (2,000 pts: 140)
   and Free Ride (two minutes: 152) in rotation: 183 credits an event on average. Start: 200 credits;
   the cheapest real mod (stage 1 exhaust or brakes) is 750, so it comes after 3 events (4 in the
   other orders of the rotation), never on day one; tune choices (350-450) and cosmetics come sooner.
   Upkeep on a starter, servicing every part under 40 %: 2-stroke 41-46 % of what it earns (rebuilds
   often: the class's identity), electric dirt 36 %, 4-stroke 28 %, e-bike 21 %; amortised by wear
   alone (no early replacement) the 2-stroke is about 28 %. A tier 2 bike (2,600-4,200) is 20-35
   events of savings away, less with a trade-in (TRADE: about half the new price for a bike in good order). The
   pit crew and FAIL keep a broke rider riding: every finished event pays, failures cost half that
   event's payout, never all of it. Change a number here and the test says what moved. */
