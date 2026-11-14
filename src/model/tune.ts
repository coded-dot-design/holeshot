// tune(bike): a garage bike (its model, each part's condition, its mod levels) → what the sim rides:
// the engine and chassis for ../bike/bike.ts (`power`), the chassis shape (`shape`: suspension
// travel, damping, case tolerance), Wheelie City's balance window and hop, and the garage's bars
// (`feel`, 0..1). Pure: the same bike gives the same numbers, so wear and mods change the feel and
// nothing else does. Worn tyres lose grip, a worn motor or battery loses pull (a battery top speed
// too), a stretched chain loses a little drive, worn brakes stop later, blown seals soften the
// damping and case sooner. Every effect has a floor (../data/economy.ts WORN_FLOOR): a worn bike
// always rides, just worse.
import type { BikeShape, Power } from "../bike/bike.ts";
import type { RigKind } from "../bike/rig.ts";
import { CLASSES, model, type ClassId, type Model } from "../data/roster.ts";
import { WORN_FLOOR } from "../data/economy.ts";
import type { BikeSave } from "./profile.ts";

export interface Tuned {
  model: Model;
  cls: ClassId;
  /** For the sim (bike.ts). */
  power: Power;
  shape: BikeShape;
  /** Wheelie City: half the sweet spot (rad) and the hop speed. */
  sweet: number;
  hop: number;
  rig: RigKind;
  /** Garage bars, 0..1: pull, top speed, grip, suspension, brakes, weight (light is high). */
  feel: { pull: number; top: number; grip: number; susp: number; brakes: number; light: number };
}

const lerp = (floor: number, c: number) => floor + (1 - floor) * Math.max(0, Math.min(1, c));

export function tune(b: BikeSave): Tuned {
  const m = model(b.model), cls = m.cls, p = m.power, P = b.parts, M = b.mods, e = cls === "ebike" || cls === "emoto";
  // The motor: wear takes pull (and on a battery, top speed: the voltage sags); the power mod adds
  // pull through the upper revs.
  const motor = lerp(WORN_FLOOR.motor, P.motor), chain = lerp(WORN_FLOOR.chain, P.chain);
  const topCut = e ? lerp(0.86, P.motor) : 1;
  const pw = M.power, gear = M.gearing;
  const curve = Array.from(p.curve, (v, i) => v * (1 + (pw * 0.035 * i) / (p.curve.length - 1)));
  // Short gearing: more drive at the wheel, less top speed.
  const short = 1 - 0.045 * gear;
  const force = p.force * motor * chain * (1 + 0.045 * pw) * (1 + 0.06 * gear);
  const power: Power = {
    ...p,
    curve,
    force,
    gears: Array.from(p.gears, (g) => g * short * topCut),
    grip: p.grip * lerp(WORN_FLOOR.grip, P.tyres),
    brake: p.brake * lerp(WORN_FLOOR.brakes, P.brakes),
  };
  const s = m.susp, sl = M.susp;
  const shape: BikeShape = {
    ...m.frame,
    travel: s.travel * (1 + 0.07 * sl),
    sag: s.sag,
    damp: s.damp * lerp(WORN_FLOOR.damp, P.susp) * (1 + 0.04 * sl),
    caseDrop: s.caseDrop * lerp(WORN_FLOOR.caseDrop, P.susp) * (1 + 0.05 * sl),
  };
  const top = power.gears[power.gears.length - 1]!;
  return {
    model: m, cls, power, shape,
    sweet: m.sweet * (0.85 + 0.15 * P.tyres), hop: m.hop * lerp(0.85, P.susp),
    rig: CLASSES[cls].rig,
    feel: {
      pull: Math.min(1, (force * curve[2]! * (e ? 1.6 : 1) + force * 0.6) / 40),
      top: Math.min(1, top / 19),
      grip: Math.min(1, power.grip / 1.3),
      susp: Math.min(1, (shape.caseDrop! - 18) / 16),
      brakes: Math.min(1, power.brake / 24),
      light: Math.min(1, Math.max(0, (1.3 - p.mass) / 0.8)),
    },
  };
}
