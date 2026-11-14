// The race's course (Moto Track's, from Fizlet's gallery) and the race, headless (tests/modes.test.mjs races it with no browser). One
// fixed tabletop motocross track on @fzlt/core/terrain: a loop of four straights and four bermed
// left-handers, its floor carved level into rolling dirt, and the features stamped along it from one
// height profile over the lap: the start gate, a rhythm section of doubles, the whoops, the big triple
// and the finish tabletop. Four riders on ./bike.ts (the player and three rivals with their own
// bikes and nerve), the gate, the laps, places, crashes and the respawn. `autopilot` rides a rival
// (or the player, for the poster and the tests). Zero allocation per step.
import { terrain, type Terrain } from "@fzlt/core/terrain";
import { bike, nudge, type Bike, type BikeShape, type Power, TWO_STROKE, FOUR_STROKE, B_CRASH, B_LAND, B_WHEELIE, STRIKE } from "../../bike/bike.ts";
import { atan, cos, pow, sin } from "../../math.ts";

export const CELL = 0.45;
export const TRACK_W = 3.4, KIND_TRACK = 1, KIND_FACE = 2, RIDERS = 4, LAPS = 3;
export const PICK = 0, GRID = 1, RACE = 2, DONE = 3;
/** Events (one ring, read and cleared each step): [type, rider, value]. */
export const E_GATE = 1, E_LAP = 2, E_FINISH = 3, E_CRASH = 4, E_RESPAWN = 5, E_LAND = 6, E_WHEELIE = 7, E_PLACE = 8, E_COUNT = 9;
const COUNT = 3, RESPAWN = 1.45;

/** A turn: `turn` radians (+ left, − right; a hairpin is about ±π), of radius `r` (the plan's RAD if
 *  absent), its berm's height (0.75 if absent). */
export interface Turn { turn: number; r?: number; berm?: number }
/** A section of the loop: a straight's length, −1 (a 90° left turn of radius RAD), or a Turn. */
export type Section = number | Turn;
/** A section's length along the lap, its turn (radians, + left) and its radius. */
export const secLen = (v: Section, RAD: number) => (typeof v === "number" ? (v < 0 ? (Math.PI / 2) * RAD : v) : Math.abs(v.turn) * (v.r ?? RAD));
export const secTurn = (v: Section) => (typeof v === "number" ? (v < 0 ? Math.PI / 2 : 0) : v.turn);
export const secRad = (v: Section, RAD: number) => (typeof v === "number" ? RAD : v.r ?? RAD);
/** Feature kinds: 1 double, 2 whoops, 3 triple, 4 tabletop, 5 step-up, 6 step-down, 7 the finish jump. */
export const F_DOUBLE = 1, F_WHOOPS = 2, F_TRIPLE = 3, F_TABLE = 4, F_STEPUP = 5, F_STEPDOWN = 6, F_FINISH = 7;
/** Each feature kind's length along the lap (where its profile ends). */
export const FEATURE_LEN = [0, 6.8, 9.5, 12.6, 8, 9.4, 9.5, 8.2];

/** A track as data: a closed loop of straights (their length) and turns (90° lefts of radius RAD, or
 *  Turns of any angle, either way, any radius), the features placed on it, the gate and the lap line,
 *  the table's size and the dirt's seed. A generated track (./generate.ts) is just another TrackPlan:
 *  makeTrack builds the rest. */
export interface TrackPlan {
  id: string;
  name: string;
  /** The loop's half length and half width (the fixed track's), the turn radius. */
  A: number;
  B: number;
  RAD: number;
  /** Sections in order: a straight's length, -1 for a 90° left turn of radius RAD, or a Turn. They must close. */
  plan: Section[];
  /** Where the loop starts (x, z) and its first heading (0 is +x, + turns left); default (-A + RAD, B, 0), the fixed track's. */
  start?: [number, number, number];
  /** Features: [kind (F_DOUBLE … F_FINISH), section index, offset into it, …]. */
  features: number[];
  /** The start gate and the lap line, along the lap. */
  gate: number;
  line: number;
  cols: number;
  rows: number;
  seed: number;
}
/** Moto Track's loop: four straights and four bermed left-handers; a rhythm section of doubles on
 *  the first straight, the whoops on the second, the big triple on the third, the finish tabletop. */
export const MOTO_TRACK: TrackPlan = {
  id: "moto-track", name: "NEON LOOP", A: 19.2, B: 10.7, RAD: 5.2,
  plan: [2 * (19.2 - 5.2), -1, 2 * (10.7 - 5.2), -1, 2 * (19.2 - 5.2), -1, 2 * (10.7 - 5.2), -1],
  // (A second double at 0, 15.5 was never there: the first one's profile hid it until features gave
  // the lap back past their own end. Left out, the loop rides as it always has.)
  features: [1, 0, 7.5, 2, 2, 0.6, 3, 4, 9.5, 4, 6, 1.4],
  gate: 1.2, line: 1.6, cols: 104, rows: 68, seed: 20261118,
};

/** A track from its plan: the centre line, the profile, the terrain, the rivals' speeds. Pure. */
export function makeTrack(def: TrackPlan) {
  // ---- the track: a closed centre line, integrated from straights and left turns, resampled ----
  const { A, B, RAD } = def, DS = 0.5, COLS = def.cols, ROWS = def.rows, HX = (COLS * CELL) / 2, HZ = (ROWS * CELL) / 2;
  /** The lap's sections in order: straight length, or a turn. */
  const PLAN = def.plan;
  const LAP = PLAN.reduce<number>((s, v) => s + secLen(v, RAD), 0);
  const NT = Math.round(LAP / DS);
  /** The centre line, x and z per point (DS apart), and its heading (bike yaw) per point. */
  const TRACK = new Float64Array(NT * 2), YAW = new Float64Array(NT);
  /** Where the turns are: per point, 1 inside a left turn, -1 inside a right (the outside is +TURN
   *  along the normal [sin yaw, cos yaw]); its radius (0 on a straight) and its section. */
  const TURN = new Int8Array(NT), RADIUS = new Float64Array(NT), SECTION = new Uint16Array(NT);
  {
    const fine = 0.01;
    let x = def.start ? def.start[0] : -A + RAD, z = def.start ? def.start[1] : B, psi = def.start ? def.start[2] : 0, s = 0, k = 0, next = 0;
    for (let sec = 0; sec < PLAN.length; sec++) {
      const v = PLAN[sec]!, len = secLen(v, RAD), turn = secTurn(v), rad = secRad(v, RAD), n = Math.round(len / fine);
      for (let i = 0; i < n; i++) {
        if (s >= next - 1e-9 && k < NT) (TRACK[k * 2] = x), (TRACK[k * 2 + 1] = z), (YAW[k] = psi), (TURN[k] = turn > 0 ? 1 : turn < 0 ? -1 : 0), (RADIUS[k] = turn ? rad : 0), (SECTION[k] = sec), k++, (next = k * (LAP / NT));
        const d = len / n;
        if (turn) psi += (turn > 0 ? d : -d) / rad;
        x += cos(psi) * d;
        z -= sin(psi) * d;
        s += d;
      }
    }
    for (; k < NT; k++) (TRACK[k * 2] = TRACK[(k - 1) * 2]!), (TRACK[k * 2 + 1] = TRACK[(k - 1) * 2 + 1]!), (YAW[k] = YAW[k - 1]!), (SECTION[k] = SECTION[k - 1]!);
  }
  /** Distance along the lap of point i. */
  const sAt = (i: number) => (i * LAP) / NT;
  /** Where each section starts along the lap (the features are placed by section). */
  const SEC: number[] = [];
  PLAN.reduce<number>((s, v) => (SEC.push(s), s + secLen(v, RAD)), 0);

  /** The features: [kind, start s, …]. The profile is their heights over the lap. */
  const GATE_S = def.gate, LINE_S = def.line;
  /** The features: [kind, start s, …], from the plan's [kind, section, offset, …]. */
  const FEATURES: number[] = [];
  for (let k = 0; k < def.features.length; k += 3) FEATURES.push(def.features[k]!, SEC[def.features[k + 1]!]! + def.features[k + 2]!);
  /** Feature names for the HUD, by kind. */
  const FEATURE_NAMES = ["", "RHYTHM", "WHOOPS", "TRIPLE", "TABLETOP", "STEP-UP", "STEP-DOWN", "FINISH JUMP"];
  /** Which feature is under a lap distance (FK) and its height (PF), from prof(s): no double crosses a call (one returned would be boxed). */
  const FK = new Int32Array(1), PF = new Float64Array(1);
  const sm = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  /** A jump: up a face of `up` to `h`, a short back side, a gap, then a landing: a steep face back up to `lh` and a long down ramp `down`. */
  function jump(d: number, up: number, h: number, back: number, gap: number, lh: number, face: number, down: number) {
    if (d < 0) return void (PF[0] = 0);
    if (d < up) return void (PF[0] = h * pow(d / up, 1.25));
    d -= up;
    if (d < back) return void (PF[0] = h * (1 - sm(d / back)));
    d -= back;
    if (d < gap) return void (PF[0] = 0);
    d -= gap;
    if (d < face) return void (PF[0] = lh * sm(d / face));
    d -= face;
    if (d < down) return void (PF[0] = lh * (1 - sm(d / down)));
    return void (PF[0] = 0);
  }
  /** The track's height over its floor at lap distance s (and which feature: FK). */
  function profile(s: number) {
    prof(s);
    return PF[0]!;
  }
  function prof(s: number) {
    s = ((s % LAP) + LAP) % LAP;
    FK[0] = 0;
    for (let k = 0; k < FEATURES.length; k += 2) {
      const kind = FEATURES[k]!, d = s - FEATURES[k + 1]!;
      // Past its own end a feature gives the lap back to the next (a rhythm section is doubles in a row).
      if (d < 0 || d > FEATURE_LEN[kind]!) continue;
      FK[0] = kind;
      if (kind === F_DOUBLE) return jump(d, 1.8, 0.8, 0.5, 1.6, 0.8, 0.5, 2.4);
      if (kind === F_WHOOPS) {
        if (d > 9.5) continue;
        // Five rollers, round (no face steeper than about 22°).
        return void (PF[0] = 0.25 * (0.5 - 0.5 * cos((d / 1.9) * Math.PI * 2)));
      }
      if (kind === F_TRIPLE) {
        // Up a tall face, a hump in the gap (the middle jump of the three), then the landing face and its long down ramp.
        if (d < 3.2) return void (PF[0] = 1.45 * pow(d / 3.2, 1.25));
        if (d < 3.8) return void (PF[0] = 1.45 - 1.05 * sm((d - 3.2) / 0.6));
        if (d < 6.9) return void (PF[0] = 0.4 + 0.35 * sin(((d - 3.8) / 3.1) * Math.PI));
        if (d < 8) return void (PF[0] = 0.4 + sm((d - 6.9) / 1.1));
        if (d < 12.6) return void (PF[0] = 1.4 * (1 - sm((d - 8) / 4.6)));
        continue;
      }
      if (kind === F_TABLE) {
        if (d < 2.1) return void (PF[0] = 0.95 * pow(d / 2.1, 1.2));
        if (d < 5.3) return void (PF[0] = 0.95);
        if (d < 8) return void (PF[0] = 0.95 * (1 - sm((d - 5.3) / 2.7)));
        continue;
      }
      if (kind === F_STEPUP) {
        // A kicker, a short gap, then the face of a higher table: land on its top, roll off its back.
        if (d < 1.8) return void (PF[0] = 0.75 * pow(d / 1.8, 1.25));
        if (d < 2.2) return void (PF[0] = 0.75 - 0.55 * sm((d - 1.8) / 0.4));
        if (d < 3.2) return void (PF[0] = 0.2);
        if (d < 3.8) return void (PF[0] = 0.2 + 0.95 * sm((d - 3.2) / 0.6));
        if (d < 6.4) return void (PF[0] = 1.15);
        if (d < 9.4) return void (PF[0] = 1.15 * (1 - sm((d - 6.4) / 3)));
        continue;
      }
      if (kind === F_STEPDOWN) {
        // A long ramp up to a high deck, its lip, then a drop onto a long down slope.
        if (d < 3.4) return void (PF[0] = 1.05 * sm(d / 3.4));
        if (d < 4.8) return void (PF[0] = 1.05);
        if (d < 5.2) return void (PF[0] = 1.05 - 0.45 * sm((d - 4.8) / 0.4));
        if (d < 9.5) return void (PF[0] = 0.6 * (1 - sm((d - 5.2) / 4.3)));
        continue;
      }
      if (kind === F_FINISH) return jump(d, 2, 1.05, 0.5, 2.2, 1, 0.5, 3);
    }
    return void (PF[0] = 0);
  }
  /** The track floor's height (the ground round it is shaped to it). */
  const FLOOR = 0.3;

  /** The nearest point on the centre line to (x, z): NR = [distance, segment, t along it, signed side]. */
  const NR = new Float64Array(4);
  function near(x: number, z: number, from = -1, span = 0) {
    NR[0] = Infinity;
    const a0 = from < 0 ? 0 : from - span, a1 = from < 0 ? NT : from + span;
    for (let q = a0; q < a1; q++) {
      const s = ((q % NT) + NT) % NT, a = s * 2, b = ((s + 1) % NT) * 2, ax = TRACK[a]!, az = TRACK[a + 1]!, dx = TRACK[b]! - ax, dz = TRACK[b + 1]! - az, l2 = dx * dx + dz * dz || 1;
      const u = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2)), px = x - ax - dx * u, pz = z - az - dz * u, d = Math.sqrt(px * px + pz * pz);
      if (d < NR[0]!) (NR[0] = d), (NR[1] = s), (NR[2] = u), (NR[3] = dx * pz - dz * px >= 0 ? 1 : -1);
    }
  }

  /** near() for the course's build: the same answer wherever the centre line is within NEAR_R (beyond
   *  it, Infinity), from a grid of buckets of the segments round each cell (built once, on the first
   *  build), so building a course costs the cells × a few segments, not the cells × the lap. */
  const NEAR_R = 4.25, BG = 2;
  let BK: Int32Array | null = null, BS: Int32Array | null = null;
  const BW = Math.ceil((HX * 2) / BG) + 2, BH = Math.ceil((HZ * 2) / BG) + 2;
  function buckets() {
    const lists: number[][] = [];
    for (let k = 0; k < BW * BH; k++) lists.push([]);
    for (let s = 0; s < NT; s++) {
      const a = s * 2, b = ((s + 1) % NT) * 2;
      const x0 = Math.min(TRACK[a]!, TRACK[b]!) - NEAR_R, x1 = Math.max(TRACK[a]!, TRACK[b]!) + NEAR_R, z0 = Math.min(TRACK[a + 1]!, TRACK[b + 1]!) - NEAR_R, z1 = Math.max(TRACK[a + 1]!, TRACK[b + 1]!) + NEAR_R;
      for (let j = Math.max(0, Math.floor((z0 + HZ) / BG) + 1); j <= Math.min(BH - 1, Math.floor((z1 + HZ) / BG) + 1); j++)
        for (let i = Math.max(0, Math.floor((x0 + HX) / BG) + 1); i <= Math.min(BW - 1, Math.floor((x1 + HX) / BG) + 1); i++) lists[j * BW + i]!.push(s);
    }
    BS = new Int32Array(BW * BH + 1);
    let n = 0;
    for (let k = 0; k < lists.length; k++) (BS[k] = n), (n += lists[k]!.length);
    BS[lists.length] = n;
    BK = new Int32Array(n);
    for (let k = 0, o = 0; k < lists.length; k++) for (const v of lists[k]!) BK[o++] = v;
  }
  function nearCourse(x: number, z: number) {
    NR[0] = Infinity;
    const i = Math.floor((x + HX) / BG) + 1, j = Math.floor((z + HZ) / BG) + 1;
    if (i < 0 || j < 0 || i >= BW || j >= BH) return;
    const c = j * BW + i;
    for (let k = BS![c]!; k < BS![c + 1]!; k++) {
      const s = BK![k]!, a = s * 2, b = ((s + 1) % NT) * 2, ax = TRACK[a]!, az = TRACK[a + 1]!, dx = TRACK[b]! - ax, dz = TRACK[b + 1]! - az, l2 = dx * dx + dz * dz || 1;
      const u = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2)), px = x - ax - dx * u, pz = z - az - dz * u, d = Math.sqrt(px * px + pz * pz);
      if (d < NR[0]!) (NR[0] = d), (NR[1] = s), (NR[2] = u), (NR[3] = dx * pz - dz * px >= 0 ? 1 : -1);
    }
    if (NR[0]! > NEAR_R) NR[0] = Infinity;
  }

  /** The course: terrain with the track carved and the features stamped. Pure: the same every time. */
  function course(): Terrain {
    if (!BK) buckets();
    const t = terrain({ cols: COLS, rows: ROWS, cell: CELL });
    // Rolling dirt round the track, down to the plinth at the edges.
    t.noise({ seed: def.seed, amp: 1.6, scale: 9, octaves: 3, ridge: 0.2 });
    t.shape((x, z, h) => {
      const ex = Math.min(1, (HX - Math.abs(x)) / 2.6), ez = Math.min(1, (HZ - Math.abs(z)) / 2.6), e = Math.max(0, Math.min(ex, ez));
      return h * e * e * (3 - 2 * e) * 0.9;
    });
    const half = TRACK_W / 2, edge = 1.8;
    t.shape((x, z, h) => {
      nearCourse(x, z);
      const d = NR[0]!;
      if (d >= half + edge + 0.6) return h;
      const s = sAt(NR[1]! + NR[2]!), y = FLOOR + profile(s), u = d <= half + 0.3 ? 0 : (d - half - 0.3) / edge, w = 1 - sm(u);
      // A low bank of dirt along each side (the track sits in it).
      const lip = d > half + 0.3 && d < half + edge ? 0.22 * sin(((d - half - 0.3) / edge) * Math.PI) : 0;
      return h + (y - h) * w + lip * (1 - w * 0.5);
    });
    // The berms: the outside of each turn banked up (the right of a left turn, the left of a right).
    for (let i = 0; i < NT; ) {
      while (i < NT && !TURN[i]) i++;
      if (i >= NT) break;
      const i0 = i, dir = TURN[i]!, sec = SECTION[i]!;
      while (i < NT && TURN[i] === dir && SECTION[i] === sec) i++;
      const n = i - i0 + 2, P = new Float64Array(n * 2), v = PLAN[sec]!;
      for (let j = 0; j < n; j++) {
        const q = ((i0 - 1 + j) % NT) * 2;
        P[j * 2] = TRACK[q]!;
        P[j * 2 + 1] = TRACK[q + 1]!;
      }
      t.berm(P, { width: TRACK_W + 1.2, height: typeof v === "number" ? 0.75 : v.berm ?? 0.75, side: dir, edge: 1.2 });
    }
    // Paint: the track's faces, and the features' faces.
    for (let j = 0; j < ROWS; j++)
      for (let i = 0; i < COLS * 2; i++) {
        const x = t.x0 + ((i >> 1) + (i & 1 ? 1 : 2) / 3) * CELL, z = t.z0 + (j + (i & 1 ? 2 : 1) / 3) * CELL;
        nearCourse(x, z);
        if (NR[0]! > half) continue;
        const s = sAt(NR[1]! + NR[2]!), p = profile(s);
        t.kind[j * COLS * 2 + i] = p > 0.05 && FK[0] !== F_WHOOPS ? KIND_FACE : KIND_TRACK;
      }
    return t;
  }

  /** The track's two edges, [x, y, z] per point, left then right, just over the dirt. */
  function trackEdges(t: Terrain) {
    const E = new Float64Array(NT * 6), half = TRACK_W / 2 + 0.05;
    for (let i = 0; i < NT; i++) {
      const nx = sin(YAW[i]!), nz = cos(YAW[i]!);
      for (let k = 0; k < 2; k++) {
        const s = k ? 1 : -1, x = TRACK[i * 2]! + nx * half * s, z = TRACK[i * 2 + 1]! + nz * half * s;
        E[k * NT * 3 + i * 3] = x; E[k * NT * 3 + i * 3 + 1] = t.height(x, z) + 0.04; E[k * NT * 3 + i * 3 + 2] = z;
      }
    }
    return E;
  }

  /** The speed a rival wants at each point (turns slow, the triple's run-up fast, the whoops skimmed). */
  const WANT = new Float64Array(NT);
  /** 1 where the speed wanted is a turn's: the autopilot brakes to it sooner. */
  const INTO = new Uint8Array(NT);
  {
    for (let i = 0; i < NT; i++) {
      const s = sAt(i);
      let w = 14.5, wt = 99;
      // Ahead: the turn (brake into it), a feature (its speed).
      for (let a = 0; a <= 16; a++) {
        const j = (i + a) % NT, sj = sAt(j);
        // A turn's speed by its radius (8.6 on the fixed track's 5.2).
        // (Tighter than that, slower still: a hairpin is taken at walking pace next to a sweeper.)
        if (TURN[j]) wt = Math.min(wt, 8.6 * (RADIUS[j]! >= 5.2 ? Math.sqrt(RADIUS[j]! / 5.2) : pow(RADIUS[j]! / 5.2, 0.8)) + a * 0.5);
        profile(sj);
        const f = FK[0]!;
        if (f === 1) w = Math.min(w, 11.2 + a * 0.4);
        if (f === 2) w = Math.min(w, 12.5);
        if (f === 3 && a > 3) w = Math.min(w, 12.8);
        if (f === 4) w = Math.min(w, 11.4 + a * 0.3);
        if (f === F_STEPUP) w = Math.min(w, 11.6 + a * 0.3);
        if (f === F_STEPDOWN) w = Math.min(w, 9.6 + a * 0.4);
        if (f === F_FINISH) w = Math.min(w, 12 + a * 0.3);
      }
      if (wt < w) (w = wt), (INTO[i] = 1);
      profile(s);
      if (FK[0] === 3) (w = 12.8), (INTO[i] = 0);
      WANT[i] = w;
    }
  }

  return {
    def, id: def.id, name: def.name, COLS, ROWS, HX, HZ, LAP, NT, TRACK, YAW, TURN, RADIUS, SECTION, GATE_S, LINE_S, FEATURES, FEATURE_NAMES, FK, PF, NR, FLOOR, WANT, INTO,
    sAt, profile, prof, near, course, trackEdges,
  };
}
export type Track = ReturnType<typeof makeTrack>;

/** Race options: the rivals' nerve (their share of the speed the line wants, a range: 0.9..0.98 by
 *  default; a series' higher tiers raise it). */
export interface RaceOpts {
  nerve?: [number, number];
  /** Online: riders 0..humans-1 are people (rider 0 rides `me`, the others `bikes[r]`); the rest of
   *  the four are rivals (`rivals` in order). Each step reads every person's inputs from `IN` (five a
   *  rider: gas, brake, lean, steer, trick) and `AUTO` (1: the autopilot rides them: a seat that left). */
  humans?: number;
  bikes?: { power: Power; shape?: BikeShape }[];
}
/** Online: once the first person is past the flag, the rest have this long (seconds) to finish. */
export const GRACE = 30;
/** A race: four riders, the gate, laps and places. The player is rider 0 (online: riders 0..humans-1). */
export function motoRace(seed = 20261118, track: Track = makeTrack(MOTO_TRACK), me: { power: Power; shape?: BikeShape } = { power: TWO_STROKE }, rivals: Power[] = [FOUR_STROKE, TWO_STROKE, FOUR_STROKE], opts: RaceOpts = {}) {
  const NV0 = opts.nerve?.[0] ?? 0.9, NV1 = opts.nerve?.[1] ?? 0.98;
  const { HX, HZ, LAP, NT, TRACK, YAW, GATE_S, LINE_S, FK, PF, NR, WANT, INTO, sAt, prof, near } = track;
  const t = track.course();
  const riders: Bike[] = [];
  const H = Math.max(1, Math.min(RIDERS, opts.humans ?? 1)), DEF = [FOUR_STROKE, TWO_STROKE, FOUR_STROKE];
  const mine = (r: number) => (r ? opts.bikes?.[r] : me) ?? me;
  const POWERS: Power[] = [];
  for (let r = 0; r < RIDERS; r++) POWERS.push(r < H ? mine(r).power : rivals[r - H] ?? DEF[(r - H) % 3]!);
  for (let r = 0; r < RIDERS; r++) riders.push(bike(t, POWERS[r]!, r < H ? mine(r).shape : {}));
  // Per rider: near index, laps, progress (laps × LAP + s), lane, nerve (speed share), finish time,
  // crashes, place, last pitch (for the autopilot), respawn, best lap, lap start, finished.
  const R = new Float64Array(RIDERS * 16);
  const NI = 0, LP = 1, PG = 2, LN = 3, NV = 4, FT = 5, CR = 6, PL = 7, PP = 8, LS = 9, BL = 10, DN = 11, LT = 12, OFF = 13;
  const S = new Float64Array(8); // phase, clock, countdown, gate down, started, the first person's finish time
  const ev = new Float64Array(48);
  // NE: the event count, the seeded draw.
  const NE = new Uint32Array(2);
  NE[1] = seed >>> 0;
  const rand = () => ((NE[1] = (Math.imul(NE[1]! ^ (NE[1]! >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0), NE[1]! / 4294967296);
  const emit = (type: number, r: number, v: number) => void (NE[0]! < 16 && ((ev[NE[0]! * 3] = type), (ev[NE[0]! * 3 + 1] = r), (ev[NE[0]! * 3 + 2] = v), (NE[0] = NE[0]! + 1)));
  const IN = new Float64Array(5), LD = new Float64Array(1), G4 = new Float64Array(4), HOLD = new Float64Array(3);
  // Every person's inputs (five a rider) and the autopilot flags, read by each step.
  const PIN = new Float64Array(RIDERS * 5), AUTO = new Uint8Array(RIDERS);

  function place(r: number, i: number, lane: number, back = 0) {
    const b = riders[r]!, yaw = YAW[i]!, nx = sin(yaw), nz = cos(yaw);
    b.reset(TRACK[i * 2]! + nx * lane - cos(yaw) * back, TRACK[i * 2 + 1]! + nz * lane + sin(yaw) * back, yaw);
    R[r * 16 + NI] = i;
  }
  function reset(power?: Power) {
    if (power) riders[0]!.use(power), (POWERS[0] = power);
    S.fill(0);
    NE[0] = 0;
    NE[1] = seed >>> 0;
    R.fill(0);
    const gi = Math.round(GATE_S / (LAP / NT)) - 1;
    for (let r = 0; r < RIDERS; r++) {
      // Lanes across the gate, the player second from the inside.
      const lane = [-0.35, -1.15, 0.45, 1.25][r]!;
      R[r * 16 + LN] = lane;
      R[r * 16 + NV] = r ? NV0 + rand() * (NV1 - NV0) : 1;
      place(r, gi, lane, 0.35);
      R[r * 16 + PG] = sAt(gi) - 0.35;
      R[r * 16 + PL] = r;
    }
  }
  /** The nearest track point to rider r, searched round its last; its progress and laps. */
  function follow(r: number) {
    const b = riders[r]!, o = r * 16;
    near(b.pos[0]!, b.pos[2]!, R[o + NI]!, 8);
    const was = R[o + PG]!, s = sAt(NR[1]! + NR[2]!), ws = ((was % LAP) + LAP) % LAP;
    R[o + NI] = NR[1]!;
    R[o + OFF] = NR[0]! * NR[3]!;
    // Progress runs on through the laps (the step along the line, wrapped).
    let ds = s - ws;
    ds -= LAP * Math.floor(ds / LAP + 0.5);
    const now = (R[o + PG] = was + ds);
    // Over the line: a lap done.
    const laps = Math.floor((now - LINE_S) / LAP), before = Math.floor((was - LINE_S) / LAP);
    if (laps > before && laps >= 1 && laps > R[o + LP]! && !R[o + DN]) {
      R[o + LP] = laps;
      const lapT = S[1]! - R[o + LT]!;
      R[o + LT] = S[1]!;
      if (!R[o + BL] || lapT < R[o + BL]!) R[o + BL] = lapT;
      if (laps >= LAPS) (R[o + DN] = 1), (R[o + FT] = S[1]!), places(), emit(E_FINISH, r, R[o + PL]!);
      else emit(E_LAP, r, laps);
    }
  }
  function places() {
    for (let r = 0; r < RIDERS; r++) {
      let p = 0;
      for (let q = 0; q < RIDERS; q++) {
        if (q === r) continue;
        const dq = R[q * 16 + DN]!, dr = R[r * 16 + DN]!;
        if (dq && dr ? R[q * 16 + FT]! < R[r * 16 + FT]! : dq ? 1 : dr ? 0 : R[q * 16 + PG]! > R[r * 16 + PG]! || (R[q * 16 + PG] === R[r * 16 + PG] && q < r)) p++;
      }
      if (p !== R[r * 16 + PL] && !R[r * 16 + DN]) {
        if (r < H && S[0] === RACE) emit(E_PLACE, r, p);
        R[r * 16 + PL] = p;
      }
    }
  }

  /** Inputs that ride rider r round the track: out = [gas, brake, lean, steer, trick]. */
  function autopilot(r: number, out: Float64Array) {
    const b = riders[r]!, i = R[r * 16 + NI]!, sp = b.speed, look = 4 + Math.max(0, sp) * 0.22 | 0, k = (i + look) % NT;
    prof(sAt(i + 3));
    const onJump = FK[0] === 1 || FK[0]! >= 3, lane = onJump ? R[r * 16 + LN]! * 0.25 : R[r * 16 + LN]! * 0.7;
    const tx = TRACK[k * 2]! + sin(YAW[k]!) * lane, tz = TRACK[k * 2 + 1]! + cos(YAW[k]!) * lane;
    const fx = b.cy, fz = -b.sy, ux = tx - b.pos[0]!, uz = tz - b.pos[2]!, ul = Math.sqrt(ux * ux + uz * uz) || 1;
    const cross = (fx * uz - fz * ux) / ul;
    out[3] = Math.max(-1, Math.min(1, cross * 2.6));
    const want = WANT[i]! * (onJump ? 1 : R[r * 16 + NV]!);
    const p = b.pitch, rate = (p - R[r * 16 + PP]!) * 60;
    R[r * 16 + PP] = p;
    out[4] = 0;
    if (b.air > 0) {
      // In the air: match the ground ahead (a down ramp is nose down), the gas off.
      landing(b);
      prof(LD[0]! + 0.3);
      const hi = PF[0]!;
      prof(LD[0]! - 0.3);
      const slope = atan((hi - PF[0]!) / 0.6);
      const e = slope - (p + rate * 0.25);
      out[2] = Math.max(-1, Math.min(1, e * 3.2));
      out[0] = 0;
      out[1] = 0;
    } else {
      // Up a jump's face the gas stays on (rolling up it shut loses the speed the gap needs); into
      // one, brake down to its speed sooner than into a turn.
      prof(sAt(i));
      const face = onJump && PF[0]! > 0.03;
      out[0] = sp < want ? 1 : sp < want + (face ? 2.5 : 0.8) ? (face ? 0.8 : 0.35) : 0;
      out[1] = !face && sp > want + (onJump || INTO[i] ? 1 : 2) ? 0.8 : 0;
      // Keep the front down (a wheelie out of a turn costs the line).
      const rel = b.rel;
      out[2] = rel > 0.12 ? -1 : rel > 0.05 ? -0.4 : 0;
    }
    return out;
  }
  /** Where a bike in the air comes down: its flight stepped on to the ground ahead, as a lap distance, into LD. */
  function landing(b: Bike) {
    let x = b.pos[0]!, y = b.pos[1]! - 0.7, z = b.pos[2]!, vy = b.vy;
    const vx = b.cy * b.speed, vz = -b.sy * b.speed;
    for (let k = 0; k < 60; k++) {
      x += vx * 0.03; z += vz * 0.03; vy -= 20 * 0.03; y += vy * 0.03;
      t.sample(x, z, G4);
      if (y <= G4[0]!) break;
    }
    near(x, z, R[riders.indexOf(b) * 16 + NI]!, 30);
    LD[0] = sAt(NR[1]! + NR[2]!);
  }
  /** Rider r's bike events into the race's (a crash counts; the player's landings and wheelies). */
  function bikeEvents(r: number) {
    const b = riders[r]!;
    for (let k = 0; k < b.n; k++) {
      const type = b.ev[k * 2]!, v = b.ev[k * 2 + 1]!;
      if (type === B_CRASH) (R[r * 16 + CR] = R[r * 16 + CR]! + 1), emit(E_CRASH, r, v);
      else if (type === B_LAND && r < H) emit(E_LAND, r, v);
      else if (type === B_WHEELIE && r < H) emit(E_WHEELIE, r, v);
    }
    b.clear();
  }
  /** Advance dt with the player's inputs (gas, brake, lean, steer); `auto` rides the player too. */
  function step(dt: number, I: Float64Array, auto = false) {
    for (let k = 0; k < 5; k++) PIN[k] = I[k] ?? 0;
    AUTO[0] = auto ? 1 : 0;
    return stepAll(dt);
  }
  /** Advance dt with every person's inputs as they are in `IN` and `AUTO` (online). */
  function stepAll(dt: number) {
    const ph = S[0]!;
    let moving = false;
    if (ph === PICK) {
      for (let r = 0; r < RIDERS; r++) riders[r]!.set(0, 1, 0, 0), riders[r]!.step(dt) && (moving = true);
      return moving;
    }
    if (ph === GRID) {
      // The countdown: everyone holds the brake against the gate and revs; it drops on 0.
      const before = Math.ceil(S[2]!);
      S[2] = S[2]! - dt;
      if (Math.ceil(S[2]!) !== before && S[2]! > 0) emit(E_COUNT, 0, Math.ceil(S[2]!));
      for (let r = 0; r < RIDERS; r++) {
        const b = riders[r]!;
        if (r >= H || AUTO[r]) b.set(0.4 + 0.4 * (sin(S[2]! * 7 + r) > 0 ? 1 : 0), 1, 0, 0);
        else b.set(PIN[r * 5]!, 1, PIN[r * 5 + 2]!, 0);
        // The gate holds the front wheel: it revs and squats, it does not roll.
        HOLD[0] = b.pos[0]!; HOLD[2] = b.pos[2]!;
        b.step(dt);
        b.pos[0] = HOLD[0]!; b.pos[2] = HOLD[2]!;
        b.S[5] = 0;
      }
      if (S[2]! <= 0) (S[0] = RACE), (S[3] = 1), emit(E_GATE, 0, 0);
      return true;
    }
    S[1] = S[1]! + (ph === RACE ? dt : 0);
    for (let r = 0; r < RIDERS; r++) {
      const b = riders[r]!, o = r * 16;
      if (b.crashed) {
        b.set(0, 0, 0, 0);
        b.step(dt);
        bikeEvents(r);
        if (b.crashTime > RESPAWN) {
          // Back on the track just behind where it went down, facing on.
          let i = (R[o + NI]! - 1 + NT) % NT;
          for (let k = 0; k < 40 && (prof(sAt(i)), PF[0]! > 0.02 || (prof(sAt(i + 2)), PF[0]! > 0.02)); k++) i = (i - 1 + NT) % NT;
          place(r, i, R[o + LN]! * 0.5);
          R[o + PG] = R[o + PG]! - ((((sAt(R[o + NI]!) - sAt(i)) % LAP) + LAP) % LAP);
          emit(E_RESPAWN, r, 0);
        }
        moving = true;
        continue;
      }
      if (R[o + DN]) {
        // Past the flag: roll on, easing off, to a stop on the start straight.
        b.set(0, Math.abs(b.speed) > 0.4 ? 0.5 : 0, 0, autopilot(r, IN)[3]!);
        if (b.step(dt)) moving = true;
        follow(r);
        continue;
      }
      if (r >= H || AUTO[r]) autopilot(r, IN), b.set(IN[0]!, IN[1]!, IN[2]!, IN[3]!, 0);
      else b.set(PIN[r * 5]!, PIN[r * 5 + 1]!, PIN[r * 5 + 2]!, PIN[r * 5 + 3]!, 0);
      if (b.step(dt)) moving = true;
      bikeEvents(r);
      follow(r);
      // Off the table: a crash.
      if (!b.crashed && (Math.abs(b.pos[0]!) > HX - 0.3 || Math.abs(b.pos[2]!) > HZ - 0.3)) b.knock(STRIKE), b.clear(), (R[o + CR] = R[o + CR]! + 1), emit(E_CRASH, r, 9);
    }
    for (let a = 0; a < RIDERS; a++) for (let c = a + 1; c < RIDERS; c++) nudge(riders[a]!, riders[c]!, 0.75);
    places();
    if (S[0] === RACE && over()) (S[0] = DONE), (moving = true);
    return moving || S[0] === RACE;
  }
  /** The race is over: every person past the flag (alone: you), or GRACE seconds after the first. */
  function over() {
    let all = 1, any = 0;
    for (let r = 0; r < H; r++) if (R[r * 16 + DN]) any = 1;
    else all = 0;
    if (any && !S[5]) S[5] = S[1]!;
    return all === 1 || (any === 1 && S[1]! - S[5]! >= GRACE);
  }
  /** Line up and start the countdown, on `power`. */
  function go(power: Power) {
    reset(power);
    S[0] = GRID;
    S[2] = COUNT;
    emit(E_COUNT, 0, COUNT);
  }

  reset();
  return {
    t, track, riders, R, S, ev,
    /** People in the race (riders 0..humans-1), their inputs (five a rider) and autopilot flags. */
    humans: H, IN: PIN, AUTO,
    /** The whole state as bytes (rollback, the desync hash). */
    bytes: [R, S, NE, ...riders.map((b) => b.state)].map((a) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength)),
    get n() { return NE[0]!; },
    clear: () => void (NE[0] = 0),
    get phase() { return S[0]!; },
    /** Seconds since the gate. */
    get clock() { return S[1]!; },
    /** Countdown seconds left. */
    get count() { return S[2]!; },
    lap: (r: number) => Math.max(1, Math.min(LAPS, R[r * 16 + LP]! + 1)),
    place: (r: number) => R[r * 16 + PL]!,
    finished: (r: number) => R[r * 16 + DN] === 1,
    finishTime: (r: number) => R[r * 16 + FT]!,
    bestLap: (r: number) => R[r * 16 + BL]!,
    crashes: (r: number) => R[r * 16 + CR]!,
    progress: (r: number) => R[r * 16 + PG]!,
    nearIndex: (r: number) => R[r * 16 + NI]!,
    offTrack: (r: number) => R[r * 16 + OFF]!,
    powers: POWERS,
    step, stepAll, reset, go, autopilot,
    /** Lap distance of the player's next feature (for the HUD): its kind, or 0. */
    feature(r: number) {
      prof(sAt(R[r * 16 + NI]! + 6));
      return FK[0]!;
    },
  };
}
export type MotoRace = ReturnType<typeof motoRace>;
