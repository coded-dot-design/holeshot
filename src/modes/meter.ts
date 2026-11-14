// The ride meter every mode runs on the player's bike: seconds, distance, gas, air, wheelie time,
// crashes and hard landings, read off the bike each step (not from its events, which the modes'
// sims consume). Typed arrays: no allocation per step. `stats()` makes the RunStats once at the end.
import type { Bike } from "../bike/bike.ts";
import { WEAR } from "../data/economy.ts";
import { blankStats, type ModeId, type RunStats } from "./mode.ts";

export function meter(mode: ModeId) {
  // seconds, distance, gas, air, wheelie, crashes, hard, was crashed, was in the air
  const M = new Float64Array(9);
  return {
    M,
    /** One step of dt on bike `b` with the throttle at `gas` (0..1). Skip it while the clock is not running. */
    tick(b: Bike, dt: number) {
      M[0] = M[0]! + dt;
      const crashed = b.crashed;
      if (!crashed) {
        const v = b.speed;
        M[1] = M[1]! + (v < 0 ? -v : v) * dt;
        M[2] = M[2]! + b.throttle * dt;
        if (b.air > 0) M[3] = M[3]! + dt;
        if (b.contact[0] && !b.contact[1] && b.rel > 0.1) M[4] = M[4]! + dt;
      }
      if (crashed && !M[7]) M[5] = M[5]! + 1;
      M[7] = crashed ? 1 : 0;
      // A landing: in the air last step, on the ground now; hard by the drop.
      const air = !crashed && b.air > 0 ? 1 : 0;
      if (M[8] && !air && !crashed && b.landAir > 0.18 && b.landDrop > WEAR.hardDrop) M[6] = M[6]! + 1;
      M[8] = air;
    },
    reset() {
      M.fill(0);
    },
    /** The stats so far (plus the mode's own fields). */
    stats(extra: Partial<RunStats> = {}): RunStats {
      return { ...blankStats(mode), seconds: M[0]!, distance: M[1]!, gas: M[2]!, air: M[3]!, wheelie: M[4]!, crashes: M[5]!, hard: M[6]!, ...extra };
    },
  };
}
export type Meter = ReturnType<typeof meter>;
