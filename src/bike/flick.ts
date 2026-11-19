// The bunny hop on the stick, as on a real bike: a quick pull back (the front comes up), then a push
// forward, the whole flick within FLICK_MS of the pull starting. Only started with both wheels down
// (`ready`): in a wheelie or in the air the stick only balances, so rocking back and forth never hops.
// Holding back longer is leaning, not a flick. One source for Endless Wheelie City and the endless
// grounds (../modes/wheelie/scene.ts, ../modes/race/scene.ts). Input side only (the wall clock):
// what it decides travels as a hop press, so the sims stay deterministic.

export const FLICK_MS = 350;

/** A flick reader. `step(lean)`, lean −1 (back) .. 1 (forward), once a frame: true on the flick. */
export function flicker(ready: () => boolean) {
  let backFrom = -1;
  const f = {
    /** Flicks so far (a probe). */
    n: 0,
    step(lean: number) {
      const now = performance.now();
      if (lean < -0.6) {
        // A flick only starts with both wheels down (the pull itself then lifts the front, as it should).
        if (backFrom < 0 && ready()) backFrom = now;
        return false;
      }
      if (lean > 0.45 && backFrom >= 0) {
        const ok = now - backFrom <= FLICK_MS;
        backFrom = -1;
        if (ok) f.n++;
        return ok;
      }
      if (lean > -0.2 && backFrom >= 0 && now - backFrom > FLICK_MS) backFrom = -1;
      return false;
    },
  };
  return f;
}
