// The bunny hop on the shared bike (./bike.ts has no jump of its own): a press with both wheels
// down and the last hop's timer run out lifts the bike by `speed` (units/s up, the bike's S[6]),
// then the timer runs. One source for Endless Wheelie City (../modes/wheelie/ride.ts) and the
// endless grounds (../modes/freeride/session.ts). The timer lives in the caller's typed array
// (`T[i]`: state, so a snapshot). Deterministic, zero allocation.
import type { Bike } from "./bike.ts";

/** Seconds after a hop before the next one can start. */
export const HOP_T = 0.4;

/** One step's hop: `press` > 0 asks for it. The timer `T[i]` counts down by dt. True if it hopped. */
export function hop(k: Bike, T: Float64Array, i: number, press: number, speed: number, dt: number) {
  const go = press > 0 && speed > 0 && T[i]! <= 0 && !k.crashed && k.contact[0] && k.contact[1];
  if (go) (k.S[6] = k.S[6]! + speed), (T[i] = HOP_T);
  T[i] = T[i]! - dt;
  return go;
}
