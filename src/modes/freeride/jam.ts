// The Free Ride jam (online), headless: two to four people on one Free Ride map for JAM seconds, each
// on their own bike; trick points decide it (big air landed clean, flips, long wheelies). Each rider
// is a ./session.ts freeRun on the same ground (riders ride through each other: a jam, not a race),
// side by side at the map's first spawn; a three-second count starts every clock on the same frame,
// so every rider's session ends on the same frame too. Every person's inputs are read from `IN`
// (five a rider) and `AUTO` (1: the autopilot rides them: a seat that left). Same event codes as the
// race (../race/course.ts), [type, rider, value]. Zero allocation per step.
import type { BikeShape, Power } from "../../bike/bike.ts";
import { DONE, E_COUNT, E_FINISH, E_GATE, E_WHEELIE, GRID, RACE, type Track } from "../race/course.ts";
import type { RideMap } from "./maps.ts";
import { freeRun, E_TRICK } from "./session.ts";
import { cos, sin } from "../../math.ts";

/** A jam's length (seconds) and its count-in. */
export const JAM = 180, COUNT = 3;
/** Trick points: a big air landed clean (plus per second of air), a flip, a wheelie per second over
 *  `wheelieFrom` seconds. */
export const JAM_POINTS = { air: 100, perAir: 100, flip: 400, wheelie: 60, wheelieFrom: 1 };
/** Side by side at the spawn (units across the line). */
const LANES = [-0.9, 0.9, -2.4, 2.4];

export function freeJam(track: Track | RideMap, bikes: { power: Power; shape?: BikeShape }[], limit = JAM) {
  const map = "isMap" in track ? track : null, t = map ? map.terrain : track.course(), H = bikes.length;
  const runs = bikes.map((b) => freeRun(track, b, limit, t));
  const riders = runs.map((r) => r.riders[0]!);
  // J: phase, the count left, the clock. PTS: each rider's trick points.
  const J = new Float64Array(3), PTS = new Float64Array(H), IN = new Float64Array(H * 5), AUTO = new Uint8Array(H);
  const IV = runs.map((_, r) => IN.subarray(r * 5, r * 5 + 5));
  const ev = new Float64Array(48), NE = new Uint32Array(1);
  const emit = (type: number, r: number, v: number) => void (NE[0]! < 16 && ((ev[NE[0]! * 3] = type), (ev[NE[0]! * 3 + 1] = r), (ev[NE[0]! * 3 + 2] = v), (NE[0] = NE[0]! + 1)));

  function reset() {
    J[0] = GRID;
    J[1] = COUNT;
    J[2] = 0;
    PTS.fill(0);
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
    for (let r = 0; r < H; r++) {
      const fr = runs[r]!;
      fr.step(dt, IV[r]!, AUTO[r] === 1);
      for (let k = 0; k < fr.n; k++) {
        const type = fr.ev[k * 3]!, v = fr.ev[k * 3 + 2]!, b = riders[r]!;
        if (type === E_TRICK) PTS[r] = PTS[r]! + (v === 2 ? JAM_POINTS.flip : JAM_POINTS.air + Math.round(b.landAir * JAM_POINTS.perAir));
        else if (type === E_WHEELIE && v > JAM_POINTS.wheelieFrom) PTS[r] = PTS[r]! + Math.round((v - JAM_POINTS.wheelieFrom) * JAM_POINTS.wheelie);
        emit(type, r, v);
      }
      fr.clear();
      if (fr.phase !== DONE) all = 0;
    }
    if (J[0] === RACE) J[2] = runs[0]!.clock;
    if (J[0] === RACE && all) (J[0] = DONE), emit(E_FINISH, -1, 0);
    return true;
  }
  /** Rider r's place by points (0 is first; ties: the lower seat). */
  const place = (r: number) => {
    let p = 0;
    for (let q = 0; q < H; q++) if (q !== r && (PTS[q]! > PTS[r]! || (PTS[q] === PTS[r] && q < r))) p++;
    return p;
  };
  reset();
  return {
    t, track, riders, runs, ev, humans: H, IN, AUTO, PTS,
    /** The whole state as bytes (rollback, the desync hash). */
    bytes: [J, PTS, NE, ...runs.flatMap((r) => r.bytes)].map((a) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength)),
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
