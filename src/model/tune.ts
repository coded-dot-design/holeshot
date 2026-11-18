// tune(bike): a garage bike (its model, each part's condition, its mod levels) → what the sim rides:
// the engine and chassis for ../bike/bike.ts (`power`), the chassis shape (`shape`: suspension
// travel, damping, case tolerance), Wheelie City's balance window and hop, and the garage's bars
// (`feel`, 0..1). Pure: the same bike gives the same numbers, so wear and mods change the feel and
// nothing else does. Worn tyres lose grip, a worn motor or battery loses pull (a battery top speed
// too), a stretched chain loses a little drive, worn brakes stop later, blown seals soften the
// damping, case sooner and lose travel; a tired top end loses top speed. The garage's choices
// (tyre compound, gearing, springs, motor map) and mods (exhaust or controller, brakes, weight, the
// long travel kit, a battery pack) and crash damage (bent bars, cracked plastics) each are one line
// here, their numbers in ../data/economy.ts. Every effect has a floor (WORN_FLOOR, TIRED): a worn
// bike always rides, just worse.
import type { BikeShape, Power } from "../bike/bike.ts";
import type { RigKind } from "../bike/rig.ts";
import { model, type ClassId, type Model } from "../data/roster.ts";
import { DAMAGE_FX, FAMILY_FX, MOD_FX, SETUP_FX, TIRED, TYRES, WORN_FLOOR } from "../data/economy.ts";
import { bodyOf } from "../data/roster.ts";
import type { ShownUpgrade } from "../bike/rig.ts";
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
  /** The family upgrade fitted (it shows on the bike: ../bike/bodies.ts), if any. */
  up?: ShownUpgrade;
  /** The wheelie bar: the nose angle past 12 it holds the bike at (no loop-out), and the hand drag's
   *  multiplier with it (Wheelie City reads both; null without a bar). */
  bar: { at: number; dragX: number } | null;
  /** Sound hooks: a turbo's whistle (0..1: the voice code may add a boost whistle and a blow-off on a
   *  lift), how much deeper the exhaust note is (× on the voice's pitch is already in power.voice). */
  sound: { whistle: number; deep: number };
  /** Garage bars, 0..1: pull, top speed, grip, suspension, brakes, weight (light is high). */
  feel: { pull: number; top: number; grip: number; susp: number; brakes: number; light: number };
}

const lerp = (floor: number, c: number) => floor + (1 - floor) * Math.max(0, Math.min(1, c));

export function tune(b: BikeSave): Tuned {
  const m = model(b.model), cls = m.cls, p = m.power, P = b.parts, M = b.mods, e = cls === "ebike" || cls === "emoto";
  const D = b.dmg ?? { bars: 0, plastics: 0 }, gx = SETUP_FX.gearing[(b.gearing ?? "stock") as keyof typeof SETUP_FX.gearing] ?? SETUP_FX.gearing.stock;
  const sx = SETUP_FX.spring[(b.spring ?? "stock") as keyof typeof SETUP_FX.spring] ?? SETUP_FX.spring.stock;
  const mx = e ? SETUP_FX.map[(b.map ?? "std") as keyof typeof SETUP_FX.map] ?? SETUP_FX.map.std : SETUP_FX.map.std;
  const tyre = TYRES[b.tyre ?? "med"] ?? TYRES.med, F = MOD_FX;
  const pw = M.power ?? 0, cells = e ? M.cells ?? 0 : 0, light = M.weight ?? 0, travel = M.travel ?? 0;
  // The family upgrades (each fits one family: ../model/families.ts; the profile keeps them 0 elsewhere).
  const FX = FAMILY_FX, swap = e && M.swap ? 1 : 0, bore = !e && cls !== "street" && M.bore ? 1 : 0, boost = cls === "street" && M.boost ? 1 : 0;
  const wbar = cls === "street" && m.body === "mini" && M.wbar ? 1 : 0;
  const upForce = (swap ? FX.swap.force : 1) * (bore ? FX.bore.force : 1) * (boost ? FX.boost.force : 1);
  const upTop = (swap ? FX.swap.top : 1) * (bore ? FX.bore.top : 1) * (boost ? FX.boost.top : 1);
  const upMass = (swap ? FX.swap.mass : 1) * (bore ? FX.bore.mass : 1) * (boost ? FX.boost.mass : 1);
  // The motor: wear takes pull and top speed (a battery's voltage sags further; more cells hold it);
  // the exhaust or controller adds pull through the upper revs; a motor map trades pull for heat.
  const motor = lerp(WORN_FLOOR.motor, P.motor), chain = lerp(WORN_FLOOR.chain, P.chain);
  const topCut = e ? lerp(Math.min(0.98, 0.86 + F.cells.sag * cells), P.motor) : lerp(TIRED.top, P.motor);
  // (A turbo's boost comes on from the middle of the revs.)
  const curve = Array.from(p.curve, (v, i) => v * (1 + (pw * F.power.curve * i) / (p.curve.length - 1)) * (boost ? 1 + FX.boost.curve * Math.max(0, i / (p.curve.length - 1) - 0.35) : 1));
  // Gearing (short: drive at the wheel, less top speed; tall: the other way); cracked plastics flap.
  const gearCut = gx.gears * mx.gears * (1 - DAMAGE_FX.top * D.plastics) * upTop;
  const force = p.force * motor * chain * (1 + F.power.force * pw) * gx.force * mx.force * upForce;
  const mass = (p.mass * (1 - F.weight.mass * light) + F.cells.mass * cells) * upMass;
  const power: Power = {
    ...p,
    mass,
    gyr: p.gyr * (1 - F.weight.gyr * light) * (travel ? F.travel.gyr : 1),
    curve,
    force,
    gears: Array.from(p.gears, (g) => g * gearCut * topCut),
    // Worn tyres slide; the compound and the springs set the grip of a new set.
    grip: p.grip * lerp(WORN_FLOOR.grip, P.tyres) * tyre.grip * sx.grip,
    brake: p.brake * lerp(WORN_FLOOR.brakes, P.brakes) * (1 + F.brakes.brake * (M.brakes ?? 0)),
    // Bent bars: the rider can't pitch it as well in the air.
    airPitch: p.airPitch * (1 - DAMAGE_FX.airPitch * D.bars),
    // A big bore's deeper note: the voice's pitch down (idle and limiter).
    voice: bore ? [p.voice[0] * FX.bore.voice, p.voice[1] * FX.bore.voice, p.voice[2]] : p.voice,
  };
  const s = m.susp;
  // Suspension: cooked seals soften the damping, case sooner and lose travel (it bottoms out).
  const shape: BikeShape = {
    ...m.frame,
    travel: s.travel * (travel ? F.travel.travel : 1) * sx.travel * lerp(TIRED.travel, P.susp),
    sag: s.sag,
    damp: s.damp * lerp(WORN_FLOOR.damp, P.susp) * sx.damp,
    caseDrop: s.caseDrop * lerp(WORN_FLOOR.caseDrop, P.susp) * (travel ? F.travel.caseDrop : 1) * sx.caseDrop,
  };
  const top = power.gears[power.gears.length - 1]!;
  return {
    model: m, cls, power, shape,
    sweet: m.sweet * (0.85 + 0.15 * P.tyres) * (1 - DAMAGE_FX.sweet * D.bars) * (wbar ? FX.wbar.sweet : 1), hop: m.hop * lerp(0.85, P.susp) * (travel ? F.travel.hop : 1),
    rig: bodyOf(m),
    up: wbar ? "wbar" : swap ? "swap" : bore ? "bore" : boost ? "boost" : undefined,
    bar: wbar ? { at: FX.wbar.at, dragX: FX.wbar.dragX } : null,
    sound: { whistle: boost ? FX.boost.whistle : 0, deep: bore ? 1 - FX.bore.voice : 0 },
    feel: {
      pull: Math.min(1, (force * curve[2]! * (e ? 1.6 : 1) + force * 0.6) / 40),
      top: Math.min(1, top / 21),
      grip: Math.min(1, power.grip / 1.3),
      susp: Math.min(1, (shape.caseDrop! - 18) / 16),
      brakes: Math.min(1, power.brake / 24),
      light: Math.min(1, Math.max(0, (1.3 - mass) / 0.8)),
    },
  };
}
