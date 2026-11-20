// The bike families' rules, pure: which upgrade fits which bike, where a street bike belongs, and
// what the dirt does to one. Gas dirt bikes and electrics ride every mode as tuned (but for Track
// Day's circuits, on knobblies: ROAD_FX); a street bike is
// built for Wheelie City's asphalt (its road tyres, short stiff springs and long gearing): ridden in
// a dirt mode it slides (less grip), skips (less travel) and cases sooner. The shell asks before a
// street bike goes on the dirt (`dirtWarning`), and every screen (solo and online) tunes the same
// way (`onGround`), so the rules are the same for everyone in a room.
import type { ModFit } from "../data/economy.ts";
import { CLASSES, model, type FamilyId, type Model } from "../data/roster.ts";
import type { ModeId } from "../modes/mode.ts";
import type { Tuned } from "./tune.ts";
import { perHour, type Units } from "./units.ts";
import { pace, timeTo } from "./pace.ts";

/** The modes on asphalt (everything else is dirt, sand or a jump yard). */
export const STREET_MODES: readonly ModeId[] = ["wheelie", "endcity", "trackday"];
/** Whether mode `id` is on the dirt. */
export const onDirt = (id: ModeId) => !STREET_MODES.includes(id);
/** A street bike on the dirt (× on the number named): road tyres slide, short springs bottom out. */
export const DIRT_FX = { grip: 0.72, travel: 0.8, caseDrop: 0.85, brake: 0.8 };
/** A dirt bike (gas or electric) on Track Day's circuits (× on the number named): knobblies squirm on
 *  asphalt at track speeds (less grip in the corners) and the long springs dive under braking. Wheelie
 *  City is the dirt bikes' playground too and stays as tuned: only the circuit, where corner speed and
 *  braking are the whole race, asks for road rubber. */
export const ROAD_FX = { grip: 0.85, brake: 0.88 };
/** A dirt bike's engine and tyres on Track Day's asphalt (ROAD_FX). Pure. */
export const roadPower = (p: Tuned["power"]): Tuned["power"] => ({ ...p, grip: p.grip * ROAD_FX.grip, brake: p.brake * ROAD_FX.brake });
/** The before-you-ride line when a street bike is picked for a dirt mode. */
export const DIRT_LINE = "Street bike on dirt? It won't perform well.";

/** A model's family. */
export const family = (m: Model | string): FamilyId => CLASSES[(typeof m === "string" ? model(m) : m).cls].family;
/** Whether a mod for `fit` goes on model `m` ("fuel" gas dirt bikes, "e" electrics, "street" street bikes, "mini" the mini). */
export function fitsWhere(fit: ModFit | undefined, m: Model) {
  if (!fit) return true;
  const f = family(m);
  return fit === "e" ? f === "electric" : fit === "fuel" ? f === "gas" : fit === "street" ? f === "street" : f === "street" && m.body === "mini";
}
/** A street bike in a dirt mode warns first; anything else rides. */
export const dirtWarning = (m: Model, mode: ModeId) => family(m) === "street" && onDirt(mode);
/** The tuned bike as it rides in mode `mode`: a street bike on the dirt loses grip, travel, its case
 *  line and some braking; everything else is as tuned. Pure (a new Tuned only when it changes). */
export function onGround(t: Tuned, mode: ModeId): Tuned {
  if (mode === "trackday" && family(t.model) !== "street") return { ...t, power: roadPower(t.power) };
  if (family(t.model) !== "street" || !onDirt(mode)) return t;
  const D = DIRT_FX;
  return {
    ...t,
    power: { ...t.power, grip: t.power.grip * D.grip, brake: t.power.brake * D.brake },
    shape: { ...t.shape, travel: (t.shape.travel ?? 0.3) * D.travel, caseDrop: (t.shape.caseDrop ?? 26) * D.caseDrop },
  };
}

/** A bike's pace as the garage's upgrade rows show it: r7's one measure (./pace.ts: full gas from a
 *  standstill on the flat, at the game's 60 Hz step, kept per engine and chassis), read off at 0–20,
 *  0–30 and 0–60 mph and 0–50 and 0–100 km/h as displayed (scaled for feel: ./units.ts SPEED_DISPLAY;
 *  seconds, null if it never gets there), and its top speed (mph as displayed; `ups` in units/s).
 *  (tests/families.test.mjs prints the table before → after.) */
export interface PaceMarks { t20: number | null; t30: number | null; t60: number | null; top: number; /** 0–50 and 0–100 km/h (Metric). */ k50: number | null; k100: number | null; ups: number }
export function paceOf(t: Pick<Tuned, "power" | "shape">): PaceMarks {
  const p = pace(t), at = (v: number, u: Units) => timeTo(p, v / perHour(1, u));
  return { t20: at(20, "imperial"), t30: at(30, "imperial"), t60: at(60, "imperial"), k50: at(50, "metric"), k100: at(100, "metric"), top: perHour(p.top), ups: p.top };
}
