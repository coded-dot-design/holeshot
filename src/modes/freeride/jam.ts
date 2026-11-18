// The Free Ride jam (online), headless: two to four people on one Free Ride map for JAM seconds, each
// on their own bike; trick points decide it (big air landed clean, flips, long wheelies). Each rider
// is a ./session.ts freeRun on the same ground (riders ride through each other: a jam, not a race),
// side by side at the map's first spawn; a three-second count starts every clock on the same frame,
// so every rider's session ends on the same frame too. Every person's inputs are read from `IN`
// (five a rider) and `AUTO` (1: the autopilot rides them: a seat that left). Same event codes as the
// race (../race/course.ts), [type, rider, value]. Zero allocation per step.
// On an ENDLESS ground (../desert/track.ts) it is the endless ride together: each rider streams its
// own window of the same seeded world (they roam apart: the ground is pure, so where a window sits is
// never state), no clock (each rider's END banks their ride; it is over when everyone has), riders
// bump (`nudge`, as the race), REGROUP brings a rider to the host (the host's: everyone to the host),
// and the shared session scoreboard (../../online/board.ts) is fed from every trick. Commands ride
// `CMD` (a bit each: END, REGROUP), written by the match from each seat's bits every frame.
import { nudge, type BikeShape, type Power } from "../../bike/bike.ts";
import { DONE, E_COUNT, E_FINISH, E_GATE, E_WHEELIE, GRID, RACE, type Track } from "../race/course.ts";
import type { RideMap } from "./maps.ts";
import { freeRun, E_TRICK, E_GROUND, E_BANKED } from "./session.ts";
import { ST_TRICK, ST_DONE, ST_WHIP, ST_LANDED, ST_BANKED } from "../stunts.ts";
import { SC as T_SC, CB as T_CB, PTS as T_PTS, KIND as T_KIND } from "../wheelie/tricks.ts";
import { cos, sin } from "../../math.ts";
import { desertTrack, type DesertTrack } from "../desert/track.ts";
import { board, F_TRICK, F_COMBO, F_DRAG, TK_GROUND, TK_COMBO, TK_AIR } from "../../online/board.ts";

/** A jam's length (seconds) and its count-in. */
export const JAM = 180, COUNT = 3;
/** Endless: a rider was brought to the host (REGROUP). (Past the session's own codes, E_GROUND .. E_LOST.) */
export const E_REGROUP = 20;
/** Endless: a stunts event of the rider's (../stunts.ts ST_*: the combo button, the whips, an air
 *  banked), forwarded as E_STUNT + its type, the value as it was (the scenes' callouts, friends' too). */
export const E_STUNT = 30;
/** Trick points: a big air landed clean (plus per second of air), a flip, a wheelie per second over
 *  `wheelieFrom` seconds. */
export const JAM_POINTS = { air: 100, perAir: 100, flip: 400, wheelie: 60, wheelieFrom: 1 };
/** Side by side at the spawn (units across the line). */
const LANES = [-0.9, 0.9, -2.4, 2.4];
/** Endless commands (../../net.ts C_END, C_REGROUP), a regroup's cooldown (s), the bump distance. */
const CM_END = 1, CM_REGROUP = 2, CM_COMBO = 8, REGROUP_T = 2, BUMP = 0.75;
/** A trick's id on the board: a big air, a flip, a long wheelie. */
export const T_AIR = 1, T_FLIP = 2, T_WHEELIE = 3;

export function freeJam(track: Track | RideMap, bikes: { power: Power; shape?: BikeShape; sweet?: number; bar?: { dragX: number } | null }[], limit = JAM) {
  const map = "isMap" in track ? track : null, H = bikes.length;
  const endless = "isEndless" in track ? (track as DesertTrack) : null;
  // Endless: a window of the same world for each rider (its own ground: they roam apart).
  const runs = endless ? bikes.map((b) => freeRun(desertTrack(endless.world.seed, endless.biome.id), b, 1e9)) : bikes.map((b) => freeRun(track, b, limit, map ? map.terrain : track.course()));
  const t = runs[0]!.t;
  const riders = runs.map((r) => r.riders[0]!);
  const CMD = new Uint8Array(H), RG = new Float64Array(H), SB = endless ? board(H) : null;
  // J: phase, the count left, the clock. PTS: each rider's trick points.
  const J = new Float64Array(3), PTS = new Float64Array(H), IN = new Float64Array(H * 5), AUTO = new Uint8Array(H);
  const IV = runs.map((_, r) => IN.subarray(r * 5, r * 5 + 5));
  // Endless: each rider's input with the combo button (I[5], from CMD's COMBO bit).
  const IC = runs.map(() => new Float64Array(6));
  const ev = new Float64Array(48), NE = new Uint32Array(1);
  const emit = (type: number, r: number, v: number) => void (NE[0]! < 16 && ((ev[NE[0]! * 3] = type), (ev[NE[0]! * 3 + 1] = r), (ev[NE[0]! * 3 + 2] = v), (NE[0] = NE[0]! + 1)));

  function reset() {
    J[0] = GRID;
    J[1] = COUNT;
    J[2] = 0;
    PTS.fill(0);
    RG.fill(0);
    SB?.reset();
    NE[0] = 0;
    for (let r = 0; r < H; r++) {
      const fr = runs[r]!, b = riders[r]!;
      fr.reset();
      const yaw = b.yaw, l = LANES[r]!;
      b.reset(b.pos[0]! + sin(yaw) * l, b.pos[2]! + cos(yaw) * l, yaw);
    }
    emit(E_COUNT, 0, COUNT);
  }
  function step(dt: number) {
    if (J[0] === GRID) {
      const before = Math.ceil(J[1]!);
      J[1] = J[1]! - dt;
      if (Math.ceil(J[1]!) !== before && J[1]! > 0) emit(E_COUNT, 0, Math.ceil(J[1]!));
      if (J[1]! <= 0) {
        J[0] = RACE;
        // Every session's clock from this frame (a session starts on its rider's first input alone).
        for (const fr of runs) (fr.S[0] = RACE), (fr.S[2] = 1);
        emit(E_GATE, 0, 0);
      }
      return true;
    }
    let all = 1;
    if (endless) for (let r = 0; r < H; r++) {
      if (CMD[r]! & CM_END && runs[r]!.phase !== DONE) runs[r]!.finish();
      if (RG[r]! > 0) RG[r] = Math.max(0, RG[r]! - dt);
      if (CMD[r]! & CM_REGROUP && RG[r] === 0 && runs[r]!.phase !== DONE) (RG[r] = REGROUP_T), regroup(r);
    }
    for (let r = 0; r < H; r++) {
      const fr = runs[r]!;
      if (endless) {
        const I = IC[r]!;
        I.set(IV[r]!);
        I[5] = CMD[r]! & CM_COMBO ? 1 : 0;
        fr.step(dt, I, AUTO[r] === 1);
      } else fr.step(dt, IV[r]!, AUTO[r] === 1);
      if (endless) stunts(r);
      for (let k = 0; k < fr.n; k++) {
        const type = fr.ev[k * 3]!, v = fr.ev[k * 3 + 2]!, b = riders[r]!;
        let pts = 0, id = 0;
        if (type === E_TRICK) (pts = v === 2 ? JAM_POINTS.flip : JAM_POINTS.air + Math.round(b.landAir * JAM_POINTS.perAir)), (id = v === 2 ? T_FLIP : T_AIR);
        else if (type === E_WHEELIE && v > JAM_POINTS.wheelieFrom) (pts = Math.round((v - JAM_POINTS.wheelieFrom) * JAM_POINTS.wheelie)), (id = T_WHEELIE);
        if (pts) {
          PTS[r] = PTS[r]! + pts;
          SB?.feed(r, F_TRICK, pts, id);
        }
        // Endless: the ground tricks (with the combo's share) and the drags (../stunts.ts) score too.
        if (SB && type === E_GROUND) {
          const ts = fr.sc.S;
          SB.feed(r, F_TRICK, ts[T_PTS]!, TK_GROUND + ts[T_KIND]!);
          if (ts[T_CB]! > 0) SB.feed(r, F_COMBO, ts[T_PTS]!);
        } else if (SB && type === E_BANKED) SB.feed(r, F_DRAG, v);
        emit(type, r, v);
      }
      fr.clear();
      if (fr.phase !== DONE) all = 0;
      if (SB) SB.dist(r, fr.distance), SB.score(r, PTS[r]! + fr.sc.S[T_SC]!);
    }
    // Endless: riders bump (the race's nudge), on the ground, both still riding.
    if (endless && J[0] === RACE) for (let a = 0; a < H; a++) for (let c = a + 1; c < H; c++) if (runs[a]!.phase !== DONE && runs[c]!.phase !== DONE) nudge(riders[a]!, riders[c]!, BUMP);
    if (J[0] === RACE) J[2] = runs[0]!.clock;
    if (J[0] === RACE && all) (J[0] = DONE), emit(E_FINISH, -1, 0);
    return true;
  }
  /** Endless: rider r's stunts events this step, onto the jam's ring (E_STUNT + type) and the board:
   *  a combo trick banked on the spot, an air banked on a clean landing. */
  function stunts(r: number) {
    const st = runs[r]!.st;
    for (let k = 0; k < st.n; k++) {
      const ty = st.ev[k * 2]!, v = st.ev[k * 2 + 1]!;
      if (ty === ST_BANKED) SB!.feed(r, F_TRICK, v, TK_COMBO + st.lastTrick);
      else if (ty === ST_LANDED) SB!.feed(r, F_TRICK, v, TK_AIR);
      if (ty === ST_TRICK || ty === ST_DONE || ty === ST_WHIP || ty === ST_LANDED) emit(E_STUNT + ty, r, v);
    }
  }
  /** Rider r (not the host) to the host, a little behind and beside; the host: everyone to the host. */
  function regroup(r: number) {
    if (r === 0) {
      for (let q = 1; q < H; q++) if (runs[q]!.phase !== DONE) bring(q);
    } else bring(r);
  }
  function bring(r: number) {
    const h = riders[0]!, src = h.crashed ? h.rider : h.pos, yaw = h.yaw, l = LANES[r]! * 1.4;
    // Behind (forward is (cos yaw, −sin yaw)) and to one side, so nobody lands on the host.
    const x = src[0]! - cos(yaw) * 3 + sin(yaw) * l, z = src[2]! + sin(yaw) * 3 + cos(yaw) * l, fr = runs[r]!;
    fr.world!.follow(x, z);
    riders[r]!.reset(x, z, yaw);
    fr.unstuck.clear();
    emit(E_REGROUP, r, 0);
  }
  /** Rider r's place by points (0 is first; ties: the lower seat). */
  const place = (r: number) => {
    if (SB) return SB.place(r);
    let p = 0;
    for (let q = 0; q < H; q++) if (q !== r && (PTS[q]! > PTS[r]! || (PTS[q] === PTS[r] && q < r))) p++;
    return p;
  };
  reset();
  return {
    t, track, riders, runs, ev, humans: H, IN, AUTO, PTS,
    /** The whole state as bytes (rollback, the desync hash). */
    bytes: [J, PTS, NE, ...(SB ? [RG, SB.B] : []), ...runs.flatMap((r) => r.bytes)].map((a) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength)),
    /** Endless: the commands (the match writes them each frame), the scoreboard, the ground's track. */
    CMD, board: SB, endless,
    get n() { return NE[0]!; },
    clear: () => void (NE[0] = 0),
    get phase() { return J[0]!; },
    /** The count left (GRID), the seconds ridden. */
    get count() { return J[1]!; },
    get clock() { return J[2]!; },
    /** Seconds left. */
    get left() { return Math.max(0, limit - J[2]!); },
    points: (r: number) => PTS[r]!,
    place,
    tricks: (r: number) => runs[r]!.tricks,
    flips: (r: number) => runs[r]!.flips,
    step, reset,
  };
}
export type FreeJam = ReturnType<typeof freeJam>;
