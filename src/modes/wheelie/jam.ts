// Endless Wheelie City together (online), headless: two to four people in the same open world
// (./open.ts: one seed, so every road, town and yard is the same on every screen), each its own
// ./roam.ts session: its own window and gather round its own bike, its own score and combo, and its
// own neon patrol (each rider's chase is theirs: a unit only ever sees, follows and tickets the rider
// whose session it belongs to, so a cop can't ticket a friend for you). Riders bump (`nudge`, as the
// race), REGROUP brings a rider to the host (the host's: everyone to the host), END banks a rider's
// ride (over when everyone has), and the shared session scoreboard (../../online/board.ts) is fed
// from each rider's banked tricks, combos, hand drags and escapes. Inputs: `IN` (five a rider: gas,
// brake, lean, steer, reset as 2), `AUTO` (1: the autopilot rides them: a seat that left) and `CMD`
// (END, REGROUP, HOP bits), written by the match each frame. Events stay on each rider's run
// (`runs[r].ev`, as the offline scene reads them) until `clear`. Zero allocation per step.
import { nudge } from "../../bike/bike.ts";
import { cos, sin } from "../../math.ts";
import { DONE as J_DONE, RACE } from "../race/course.ts";
import { board, F_TRICK, F_COMBO, F_DRAG, F_BONUS } from "../../online/board.ts";
import { openRun, type OpenRun } from "./roam.ts";
import { CITY_SEED } from "./open.ts";
import { DONE, E_TRICK, E_HOP, E_BANKED, E_ESCAPE, E_END } from "./rules.ts";
import { SC, CB, PTS, KIND, HOP } from "./tricks.ts";
import type { RideSpec } from "./ride.ts";

const CM_END = 1, CM_REGROUP = 2, CM_HOP = 4, REGROUP_T = 2, BUMP = 0.8;
/** Single file behind the host (a regroup) or behind rider 0 at the start (units). */
const BEHIND = [0, 3, 6, 9];
/** A rider was brought to the host (REGROUP: on that rider's run, value its seat). */
export const E_REGROUP = 40;

export function cityJam(specs: RideSpec[], seed: number, citySeed = CITY_SEED) {
  const H = specs.length;
  // Each rider's patrol rolls its own dice (a seed each), on the same world.
  const runs: OpenRun[] = specs.map((s, r) => openRun([s], ((seed + r * 7919) >>> 0) || 1, citySeed));
  const riders = runs.map((r) => r.bike.b);
  const J = new Float64Array(2), IN = new Float64Array(H * 5), AUTO = new Uint8Array(H), CMD = new Uint8Array(H), RG = new Float64Array(H), SB = board(H);
  const AI = runs.map(() => new Float64Array(5));
  function reset() {
    J[0] = RACE;
    J[1] = 0;
    RG.fill(0);
    SB.reset();
    for (let r = 0; r < H; r++) runs[r]!.reset(0);
    // Single file on the first road, behind rider 0.
    const b = riders[0]!, yaw = b.yaw;
    for (let r = 1; r < H; r++) runs[r]!.place(b.pos[0]! - cos(yaw) * BEHIND[r]!, b.pos[2]! + sin(yaw) * BEHIND[r]!, yaw);
  }
  function bring(r: number) {
    const h = riders[0]!, src = h.crashed ? h.rider : h.pos, yaw = h.yaw;
    runs[r]!.place(src[0]! - cos(yaw) * BEHIND[r]!, src[2]! + sin(yaw) * BEHIND[r]!, yaw);
    runs[r]!.unstuck.clear();
    emitOn(r, E_REGROUP, r);
  }
  const emitOn = (r: number, type: number, v: number) => runs[r]!.emit(type, v);
  function step(dt: number) {
    let all = 1;
    for (let r = 0; r < H; r++) {
      const u = runs[r]!, c = CMD[r]!;
      if (c & CM_END && u.S[0] !== DONE) (u.S[0] = DONE), emitOn(r, E_END, 0);
      if (RG[r]! > 0) RG[r] = Math.max(0, RG[r]! - dt);
      if (c & CM_REGROUP && RG[r] === 0 && u.S[0] !== DONE) {
        RG[r] = REGROUP_T;
        if (r === 0) for (let q = 1; q < H; q++) runs[q]!.S[0] !== DONE && bring(q);
        else bring(r);
      }
      const n0 = u.n, q = r * 5;
      if (AUTO[r]) {
        const I = AI[r]!;
        u.autopilot(I);
        u.step(dt, I[0]!, I[1]!, I[2]!, I[3]!, I[4]!, false, false);
      } else u.step(dt, IN[q]!, IN[q + 1]!, IN[q + 2]!, IN[q + 3]!, c & CM_HOP ? 1 : 0, true, IN[q + 4] === 2);
      // The board: what this step banked.
      const s = u.sc.S;
      for (let k = n0; k < u.n; k++) {
        const ty = u.ev[k * 2]!, v = u.ev[k * 2 + 1]!;
        if (ty === E_TRICK || ty === E_HOP) {
          SB.feed(r, F_TRICK, s[PTS]!, ty === E_HOP ? HOP : s[KIND]!);
          if (s[CB]! > 0) SB.feed(r, F_COMBO, s[PTS]!);
        } else if (ty === E_BANKED) SB.feed(r, F_DRAG, v);
        else if (ty === E_ESCAPE) SB.feed(r, F_BONUS, v);
      }
      SB.score(r, s[SC]!);
      SB.dist(r, u.far);
      if (u.S[0] !== DONE) all = 0;
    }
    for (let a = 0; a < H; a++) for (let c = a + 1; c < H; c++) if (runs[a]!.S[0] !== DONE && runs[c]!.S[0] !== DONE) nudge(riders[a]!, riders[c]!, BUMP);
    J[1] = J[1]! + dt;
    if (all && J[0] !== J_DONE) J[0] = J_DONE;
    return true;
  }
  reset();
  const u8 = (a: Float64Array) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  return {
    runs, riders, humans: H, IN, AUTO, CMD, board: SB,
    /** The whole state as bytes (rollback, the desync hash). */
    bytes: [u8(J), u8(RG), SB.bytes, ...runs.flatMap((r) => r.bytes)],
    get phase() { return J[0]!; },
    get clock() { return J[1]!; },
    /** Every rider's events cleared (after the frame's were heard). */
    clear() { for (const u of runs) u.clear(); },
    place: (r: number) => SB.place(r),
    points: (r: number) => SB.get(r, 6),
    step, reset,
  };
}
export type CityJam = ReturnType<typeof cityJam>;
