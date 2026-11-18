// pace(tuned): a bike's acceleration and top speed, measured on the sim, not guessed. The tuned bike
// (its model, wear, gearing and mods: ../model/tune.ts) rides the flat from a standstill on full gas,
// the rider's weight a little forward (the launch every mode's autopilot uses), at the game's own
// 60 Hz step; the speed after each frame is kept, so any "0 to v" time is read off the trace. The
// top speed is the most it reached once the speed stopped rising. The garage's PACE row and the
// showroom cards show it (0–20 / 0–30 mph and the top, or 0–30 / 0–50 km/h); tests/pace.test.mjs
// measures every bike in the roster. Pure and deterministic (the same bike gives the same numbers);
// a measure is a few thousand bike steps, so each power is measured once and kept.
import { bike, type BikeGround } from "../bike/bike.ts";
import type { Tuned } from "./tune.ts";
import { MI_PER_KM, type Units } from "./units.ts";

/** The longest run (seconds) and the lean (+1 back) the launch holds. */
export const PACE_SECS = 25, PACE_LEAN = -0.6;
/** The "0 to" speeds the garage shows, in the rider's units. */
export const PACE_MARKS: Record<Units, readonly [number, number]> = { imperial: [20, 30], metric: [30, 50] };
/** World units a second (about metres a second) in mph or km/h. */
export const perHour = (ups: number, units: Units = "imperial") => ups * 3.6 * (units === "metric" ? 1 : MI_PER_KM);

export interface Pace {
  /** The speed (units/s) after each 1/60 s frame from a standstill. */
  trace: Float32Array;
  /** The most it reached (units/s). */
  top: number;
  /** It crashed on the launch (a wheelie looped out): the trace ends there. */
  crashed: boolean;
}

const FLAT: BikeGround = { sample(_x, _z, o) { o[0] = 0; o[1] = 0; o[2] = 1; o[3] = 0; return 0; } };
const memo = new Map<string, Pace>();

/** Measure a tuned bike (kept per engine and chassis: the garage redraws often). */
export function pace(t: Pick<Tuned, "power" | "shape">): Pace {
  const key = JSON.stringify([t.power, t.shape]);
  const hit = memo.get(key);
  if (hit) return hit;
  const b = bike(FLAT, t.power, t.shape), n = PACE_SECS * 60, trace = new Float32Array(n);
  b.reset(0, 0, 0);
  let top = 0, still = 0, i = 0, crashed = false;
  for (; i < n; i++) {
    b.set(1, 0, PACE_LEAN, 0);
    b.step(1 / 60);
    b.clear();
    if (b.crashed) { crashed = true; break; }
    const v = b.speed;
    trace[i] = v;
    // Done once it has stopped gaining (2 s with under 0.1 % more).
    if (v > top * 1.001) (top = v), (still = 0);
    else if (++still > 120) { i++; break; }
  }
  const out = { trace: trace.slice(0, i), top, crashed };
  if (memo.size > 64) memo.clear();
  memo.set(key, out);
  return out;
}

/** Seconds from a standstill to `ups` units/s (between frames, linear), or null if it never gets there. */
export function timeTo(p: Pace, ups: number): number | null {
  const T = p.trace;
  for (let i = 0; i < T.length; i++) {
    if (T[i]! >= ups) {
      const a = i ? T[i - 1]! : 0, f = T[i]! > a ? (ups - a) / (T[i]! - a) : 1;
      return (i + f) / 60;
    }
  }
  return null;
}

/** The garage's numbers in the rider's units: [label, value] for 0–a, 0–b and the top. */
export function paceRow(t: Pick<Tuned, "power" | "shape">, units: Units = "imperial"): [string, string][] {
  const p = pace(t), u = units === "metric" ? "KM/H" : "MPH", per = perHour(1, units);
  const at = (v: number) => { const s = timeTo(p, v / per); return s === null ? "—" : `${s.toFixed(2)} S`; };
  const [a, b] = PACE_MARKS[units];
  return [[`0–${a} ${u}`, at(a)], [`0–${b} ${u}`, at(b)], ["TOP", `${Math.round(perHour(p.top, units))} ${u}`]];
}
