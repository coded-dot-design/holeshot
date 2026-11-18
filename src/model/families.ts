// The bike families' rules, pure: which upgrade fits which bike, where a street bike belongs, and
// what the dirt does to one. Gas dirt bikes and electrics ride every mode as tuned; a street bike is
// built for Wheelie City's asphalt (its road tyres, short stiff springs and long gearing): ridden in
// a dirt mode it slides (less grip), skips (less travel) and cases sooner. The shell asks before a
// street bike goes on the dirt (`dirtWarning`), and every screen (solo and online) tunes the same
// way (`onGround`), so the rules are the same for everyone in a room.
import type { ModFit } from "../data/economy.ts";
import { CLASSES, model, type FamilyId, type Model } from "../data/roster.ts";
import type { ModeId } from "../modes/mode.ts";
import type { Tuned } from "./tune.ts";
import { bike } from "../bike/bike.ts";
import { MI_PER_KM, speed, type Units } from "./units.ts";

/** The modes on asphalt (everything else is dirt, sand or a jump yard). */
export const STREET_MODES: readonly ModeId[] = ["wheelie", "endcity"];
/** Whether mode `id` is on the dirt. */
export const onDirt = (id: ModeId) => !STREET_MODES.includes(id);
/** A street bike on the dirt (× on the number named): road tyres slide, short springs bottom out. */
export const DIRT_FX = { grip: 0.72, travel: 0.8, caseDrop: 0.85, brake: 0.8 };
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
  if (family(t.model) !== "street" || !onDirt(mode)) return t;
  const D = DIRT_FX;
  return {
    ...t,
    power: { ...t.power, grip: t.power.grip * D.grip, brake: t.power.brake * D.brake },
    shape: { ...t.shape, travel: (t.shape.travel ?? 0.3) * D.travel, caseDrop: (t.shape.caseDrop ?? 26) * D.caseDrop },
  };
}

/** mph in a world unit a second (about a metre a second). */
export const MPH = 2.236936;
const FLAT = { sample(_x: number, _z: number, o: { [i: number]: number }) { o[0] = 0; o[1] = 0; o[2] = 1; o[3] = 0; return 0; } };
const memo = new Map<string, Pace>();
/** A bike's pace, measured on the sim: full gas from a standstill on the flat (the weight a little
 *  forward), at the game's 60 Hz step, to 0–20, 0–30 and 0–60 mph (seconds; null if it never gets
 *  there) and its top speed (mph). Deterministic; kept per engine and chassis. (The garage's upgrade
 *  rows show it before → after; tests/families.test.mjs prints the table.) */
export interface Pace { t20: number | null; t30: number | null; t60: number | null; top: number; /** 0–50 and 0–100 km/h (Metric). */ k50: number | null; k100: number | null; ups: number }
export function paceOf(t: Pick<Tuned, "power" | "shape">): Pace {
  const key = JSON.stringify([t.power, t.shape]), hit = memo.get(key);
  if (hit) return hit;
  const b = bike(FLAT, t.power, t.shape), at: (number | null)[] = [null, null, null, null, null], marks = [20, 30, 60, 50 * MI_PER_KM, 100 * MI_PER_KM];
  b.reset(0, 0, 0);
  let top = 0, still = 0;
  for (let i = 0; i < 30 * 60; i++) {
    b.set(1, 0, -0.6, 0);
    b.step(1 / 60);
    b.clear();
    if (b.crashed) break;
    const v = b.speed * MPH;
    for (let k = 0; k < 5; k++) if (at[k] === null && v >= marks[k]!) at[k] = (i + 1) / 60;
    if (b.speed > top * 1.001) (top = b.speed), (still = 0);
    else if (++still > 120) break;
  }
  const out = { t20: at[0]!, t30: at[1]!, t60: at[2]!, k50: at[3]!, k100: at[4]!, top: top * MPH, ups: top };
  if (memo.size > 64) memo.clear();
  memo.set(key, out);
  return out;
}
/** A pace as the garage says it, in the rider's units: "0–30 1.47 S · 0–60 — · 50 MPH" (Metric: 0–50 and 0–100 km/h). */
export function paceLine(p: Pace, units: Units = "imperial") {
  const s = (v: number | null) => (v === null ? "—" : v.toFixed(2) + " S"), m = units === "metric";
  return `${m ? "0–50" : "0–30"} ${s(m ? p.k50 : p.t30)} · ${m ? "0–100" : "0–60"} ${s(m ? p.k100 : p.t60)} · ${speed(p.ups, units)}`;
}
