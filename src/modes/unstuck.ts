// Unstuck, for every mode that rides the shared bike: a ring of recent good places (on the ground,
// upright, moving, clear of anything it can hit, on a gentle slope), a stuck detector (the bike has
// barely moved for a while with the rider on the controls) and the place a reset puts it: the newest
// good place that is clear, has run-up room ahead and is not by the spot it got stuck in (never back
// into the same trap). Its numbers are state (in `S` and `R`, typed arrays the sessions add to their
// bytes), so a reset is an input of the frame like any other: online and after a rollback every
// screen agrees. Zero allocation per step.
import type { Bike } from "../bike/bike.ts";
import { cos, sin } from "../math.ts";

/** Good places kept (one a second); progress the watch wants (units) and its timings (seconds). */
export const RING = 10, PROGRESS = 0.5, PROMPT_T = 2, AUTO_T = 4, BLINK = 1.2, SNAP_T = 1;
/** The reset input: I[4] === RESET (the trick slot's other value; online, net.ts B_RESET). */
export const RESET = 2;
/** What `watch` says: nothing, show the prompt, reset now. */
export const U_OK = 0, U_PROMPT = 1, U_AUTO = 2;

export interface Ground { sample(x: number, z: number, out: { [i: number]: number }): number }

export function unstuck(ground: Ground, clear: (x: number, z: number, r: number) => boolean) {
  // S: since the last snapshot, watch x, watch z, seconds without progress, seconds of input in them,
  // the blink left, ring count, ring head, the last stuck x, z.
  const S = new Float64Array(10), R = new Float64Array(RING * 3), G = new Float64Array(4), OUT = new Float64Array(3);
  const SINCE = 0, WX = 1, WZ = 2, STILL = 3, HELD = 4, BL = 5, CNT = 6, HEAD = 7;
  /** A place the bike can stand and ride off from: gentle under it and for `run` units ahead, clear. */
  function good(x: number, z: number, yaw: number, run: number) {
    if (!clear(x, z, 0.7)) return false;
    ground.sample(x, z, G);
    if (G[2]! < 0.9) return false;
    const fx = cos(yaw), fz = -sin(yaw);
    let last = G[0]!;
    for (let d = 1; d <= run; d++) {
      const px = x + fx * d, pz = z + fz * d;
      ground.sample(px, pz, G);
      if (G[2]! < 0.82 || Math.abs(G[0]! - last) > 0.55 || !clear(px, pz, 0.5)) return false;
      last = G[0]!;
    }
    return true;
  }
  function clearAll(b: Bike) {
    S[WX] = b.pos[0]!; S[WZ] = b.pos[2]!; S[STILL] = 0; S[HELD] = 0; S[SINCE] = 0;
  }
  /** Each step: snapshots, the watch. `input` is whether the rider is on the controls. */
  function watch(b: Bike, dt: number, input: boolean) {
    if (S[BL]! > 0) S[BL] = Math.max(0, S[BL]! - dt);
    if (b.crashed) return clearAll(b), U_OK;
    S[SINCE] = S[SINCE]! + dt;
    const spd = b.speed < 0 ? -b.speed : b.speed, rel = b.rel < 0 ? -b.rel : b.rel;
    if (S[SINCE]! >= SNAP_T && b.air === 0 && b.contact[0] && b.contact[1] && rel < 0.25 && spd > 2 && good(b.pos[0]!, b.pos[2]!, b.yaw, 0)) {
      S[SINCE] = 0;
      const h = S[HEAD]!;
      R[h * 3] = b.pos[0]!; R[h * 3 + 1] = b.pos[2]!; R[h * 3 + 2] = b.yaw;
      S[HEAD] = (h + 1) % RING;
      S[CNT] = Math.min(RING, S[CNT]! + 1);
    }
    const dx = b.pos[0]! - S[WX]!, dz = b.pos[2]! - S[WZ]!;
    if (dx * dx + dz * dz > PROGRESS * PROGRESS) {
      S[WX] = b.pos[0]!; S[WZ] = b.pos[2]!; S[STILL] = 0; S[HELD] = 0;
      return U_OK;
    }
    S[STILL] = S[STILL]! + dt;
    if (input) S[HELD] = S[HELD]! + dt;
    // Upside down or on its side and not getting up counts as held (no one rides out of that).
    else if (rel > 1.1) S[HELD] = S[HELD]! + dt;
    if (S[STILL]! >= AUTO_T && S[HELD]! >= AUTO_T / 2) return U_AUTO;
    return S[STILL]! >= PROMPT_T && S[HELD]! >= 1 ? U_PROMPT : U_OK;
  }
  /** Where a reset puts the bike: OUT = [x, z, yaw]. The newest clear place with run-up room, at
   *  least 2 units from where it is now; else the oldest that far; else a clear spot found round it. */
  function pick(b: Bike) {
    const x = b.pos[0]!, z = b.pos[2]!, n = S[CNT]!;
    let fall = -1;
    for (let k = 1; k <= n; k++) {
      const h = (((S[HEAD]! - k) % RING) + RING) % RING, px = R[h * 3]!, pz = R[h * 3 + 1]!, yaw = R[h * 3 + 2]!;
      const dx = px - x, dz = pz - z;
      if (dx * dx + dz * dz < 4) continue;
      fall = h;
      if (good(px, pz, yaw, 6)) return (OUT[0] = px), (OUT[1] = pz), (OUT[2] = yaw), OUT;
      // Nudged sideways: a metre or two either side.
      for (let s = 1; s <= 2; s++) for (let sd = -1; sd <= 1; sd += 2) {
        const qx = px + sin(yaw) * s * sd, qz = pz + cos(yaw) * s * sd;
        if (good(qx, qz, yaw, 6)) return (OUT[0] = qx), (OUT[1] = qz), (OUT[2] = yaw), OUT;
      }
    }
    if (fall >= 0) return (OUT[0] = R[fall * 3]!), (OUT[1] = R[fall * 3 + 1]!), (OUT[2] = R[fall * 3 + 2]!), OUT;
    // Nothing kept: rings round it, facing the way it was going.
    const yaw = b.yaw;
    for (let r = 3; r <= 12; r += 3)
      for (let a = 0; a < 8; a++) {
        const an = yaw + Math.PI + (a * Math.PI) / 4, qx = x + cos(an) * r, qz = z - sin(an) * r;
        if (good(qx, qz, yaw, 6)) return (OUT[0] = qx), (OUT[1] = qz), (OUT[2] = yaw), OUT;
      }
    return (OUT[0] = x - cos(yaw) * 3), (OUT[1] = z + sin(yaw) * 3), (OUT[2] = yaw), OUT;
  }
  /** Reset now: upright on the picked place, still, a blink of grace. Returns OUT. */
  function reset(b: Bike) {
    S[8] = b.pos[0]!; S[9] = b.pos[2]!;
    const o = pick(b);
    b.reset(o[0]!, o[1]!, o[2]!);
    b.clear();
    clearAll(b);
    S[BL] = BLINK;
    return o;
  }
  return {
    S, R, watch, reset, pick, OUT,
    /** Seconds of grace left after a reset (no posts, the blink). */
    get blink() { return S[BL]!; },
    /** Forget the ring (a new ride). */
    clear: () => (S.fill(0), R.fill(0)),
  };
}
export type Unstuck = ReturnType<typeof unstuck>;
