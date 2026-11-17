// Wheelie City's town and session, headless (tests/modes.test.mjs and tests/cops.test.mjs play it
// with no browser). The town is four neighbourhoods on one table (./hoods.ts: THE BLOCK, HILLCREST,
// DOWNTOWN, NEON MARINA), each its own layout, separated by canals and fenced along their edges,
// linked by humps: hit one at speed and you fly the canal into the next hood (the launch is set so
// the jump lands on the far ramp, and the bike is held level in the air: it lands upright); too slow
// and you bump the fence at its top. The bike is the shared bike (../../bike/bike.ts) through
// ./ride.ts on this ground; ./tricks.ts scores it; ./cops.ts is the neon patrol. A session is ninety
// seconds from the first touch of the gas: wheelies, manuals and hops score, with bonuses for a trick
// across a crosswalk, through a sprinkler or past a neighbour who has come out to shake a fist. Loop
// it out, nose it in or land off balance and it is a crash: the trick and the combo are gone, a
// tumble, then back up; ride hard into something and it is a crash too (a bonk). Stunt too loud near
// the neighbours and the heat rises: patrol units come after you; a catch is a ticket, a hump loses
// them. `autopilot` rides each hood's loop with wheelies and, with the patrol after it, turns for the
// hood's escape hump (the poster, the tests). Deterministic and seeded (../../math.ts, never the builtin
// transcendentals); zero allocation per step.
import { hypot } from "@fzlt/core/steer";
import { ride, RIDES, TWELVE, type RideSpec } from "./ride.ts";
import { B_CRASH, B_STOPPIE } from "../../bike/bike.ts";
import { cos, sin } from "../../math.ts";
import { unstuck, U_AUTO, U_PROMPT } from "../unstuck.ts";
import { tricks, ON, SC, PTS, F_CROSS, F_SPRINK, F_GRUMP, BANKED, MAXCB, CB as T_CB, GAP as T_GAP } from "./tricks.ts";
import {
  HOODS, CX, CZ, HX, HZ, GAP, CURB, W, HUMPS, NHUMP, ENTRY, BRANCH, hoodAt, NHOOD,
  K_ROAD, K_WALK, K_LAWN, K_DRIVE, K_WATER, K_SAND, RAMP, DECK, LIP, HUMP_H, HUMP_W, BANK, CANAL,
} from "./hoods.ts";
import { cops, FIXED_C, heading, C_TICKET, C_ESCAPE, C_STARS, C_UNIT, C_CLEAR, HEAT, STARS, NEAR } from "./cops.ts";

export { HX, HZ, CURB, K_ROAD, K_WALK, K_LAWN, K_DRIVE, K_WATER };
export const SESSION = 90;
export const READY = 0, RUN = 1, CRASH = 2, DONE = 3;
/** Events (one ring, read and cleared each step): what, and a value. */
export const E_START = 1, E_TRICK = 2, E_CRASH = 3, E_RESPAWN = 4, E_GRUMP = 5, E_BARK = 6, E_SPLASH = 7, E_BONUS = 8, E_END = 9, E_HOP = 10, E_AIR = 11,
  E_JUMP = 12, E_LAND = 13, E_TICKET = 14, E_ESCAPE = 15, E_STARS = 16, E_UNIT = 17, E_CLEAR = 18,
  /** Unstuck: the prompt (1 up, 0 down); a reset to the last good spot on the street (1 asked for, 2 automatic). */
  E_STUCK = 19, E_RESET = 20,
  /** The hand drag: it starts (value 1); banked (its points) when the nose comes back under 12; lost (the points it had) on a loop-out. */
  E_DRAG = 21, E_BANKED = 22, E_LOST = 23;
/** The hand drag: hold the nose past 12 o'clock HAND_T seconds and the rider drops a hand to the road;
 *  while it drags it earns DRAG_RATE a second ×DRAG_X (× the combo), plus STREAK × seconds² when banked. */
export const HAND_T = 1.5, DRAG_RATE = 40, DRAG_X = 10, STREAK = 120;
const TAU = 6.283185307179586, CRASH_T = 1.8, R_BIKE = 0.45, BONK_V = 5;
/** Over a hump: the least speed along it that flies, the flight's time, how far past the far lip it lands, the pitch it is held to. */
export const FLY_V = 5, FLY_T = 1, LAND_AT = 2.4, FLY_PITCH = -0.08;
/** Heat: a neighbour out, a sprinkler, the dog, per second on a lawn, per point of a banked trick (capped). */
export const HEAT_FROM = { grump: 10, splash: 9, bark: 3, lawn: 7, perPoint: 1 / 150, trickCap: 10 };

/** The world's lists for the scene: buildings (x, z, w, d, height, face, look, base), their hoods,
 *  cars, crosswalks, sprinklers, trees and lamps (with their hoods). */
export const HOUSES = W.houses, NH = HOUSES.length / 8, CARS = W.cars, NCARS = CARS.length / 4, CAR_L = 2.3, CAR_W = 1.1;
export const CROSS = W.cross, SPRINK = W.sprink, NSP = SPRINK.length / 4, SP_REACH = 2.6, TREES = W.trees, LAMPS = W.lamps;
/** The dog's yard on THE BLOCK (world): x0, x1, z where it trots, and its fence [x0, z0, x1, z1]. */
export const DOG = [7.8 + CX[0]!, 10.2 + CX[0]!, 5.0 + CZ[0]!];
const FENCE_L = [7.4, 3.6, 10.6, 5.6];
export const FENCE = [FENCE_L[0]! + CX[0]!, FENCE_L[1]! + CZ[0]!, FENCE_L[2]! + CX[0]!, FENCE_L[3]! + CZ[0]!];
/** Neighbours: house index, door x, door z, face, zone [x0, z0, x1, z1] (world). */
export const NEIGH: number[] = [];
for (const h of W.home) {
  const o = h * 8, x = HOUSES[o]!, z = HOUSES[o + 1]!, d = HOUSES[o + 3]!, f = HOUSES[o + 5]!, fz = z + (f * d) / 2;
  NEIGH.push(h, x - 0.5, fz, f, x - 3.4, f < 0 ? fz - 6.9 : fz, x + 3.4, f < 0 ? fz : fz + 6.9);
}
export const NN = NEIGH.length / 8;
/** Each neighbour's, sprinkler's and crosswalk's hood (Endless Wheelie City moves them with it). */
export const NEIGH_H = Uint8Array.from({ length: NN }, (_, i) => W.hood[NEIGH[i * 8]!]!);
const quad = (x: number, z: number) => (z < 0 ? 0 : 2) + (x < 0 ? 0 : 1);
export const SPRINK_H = Uint8Array.from({ length: NSP }, (_, i) => quad(SPRINK[i * 4]!, SPRINK[i * 4 + 1]!));
export const CROSS_H = Uint8Array.from({ length: CROSS.length / 4 }, (_, i) => quad(CROSS[i * 4]! + CROSS[i * 4 + 2]!, CROSS[i * 4 + 1]! + CROSS[i * 4 + 3]!));
/** What they shout (comic and generic, never mean). */
export const LINES = ["HEY! MY LAWN!", "SLOW DOWN!", "I JUST MOWED THAT!", "WHEELS DOWN, KID!", "NOT THE PETUNIAS!", "IT'S SUNDAY!", "BACK IN MY DAY…", "KEEP IT ON THE ROAD!", "I'M CALLING IT IN!", "SOME OF US WORK NIGHTS!"];
/** The autopilot's gains (tuned headless): under the balance point by, gas at rest, nose rate per radian off, most nose rate, gas per rate error, gas per unit of speed under the target, lean per rate error, target speed, brake dead band, brake gain. */
export const AP = [0.008, 0.077, 33.317, 2.172, 0.387, 0.04, 0.729, 3.383, 0.391, 1.244];
/** Where the autopilot's loop starts in each hood (the waypoint it heads for first). */
const START_LEG = [0, 0, 3, 4];

// ---- the ground, per hood (local coordinates, typed arrays: a plain array of doubles can change shape) ----
const F64 = (a: number[]) => Float64Array.from(a);
const RD = HOODS.map((h) => F64(h.roads)), RG = HOODS.map((h) => F64(h.rings)), DR = HOODS.map((h) => F64(h.drives)), BL = HOODS.map((h) => F64(h.blocks));
const SF = HOODS.map((h) => F64(h.surf)), BU = HOODS.map((h) => F64(h.bumps)), KI = HOODS.map((h) => F64(h.kicks));
/** Each hood's humps: global index, local lip x, z, dir x, z. */
const HU = HOODS.map((_, k) => {
  const a: number[] = [];
  for (let i = 0; i < NHUMP; i++) if (HUMPS[i * 5 + 4] === k) a.push(i, HUMPS[i * 5]! - CX[k]!, HUMPS[i * 5 + 1]! - CZ[k]!, HUMPS[i * 5 + 2]!, HUMPS[i * 5 + 3]!);
  return F64(a);
});
/** Solid boxes [x0, z0, x1, z1] per hood (local): buildings, cars, fences, trees, lamps, terraces and water; round solids [x, z, r]. */
const SOL = HOODS.map((h, k) => {
  const s: number[] = [];
  for (let o = 0; o < h.houses.length; o += 8) {
    const x = h.houses[o]!, z = h.houses[o + 1]!, w = h.houses[o + 2]! / 2, d = h.houses[o + 3]! / 2;
    s.push(x - w, z - d, x + w, z + d);
  }
  for (let o = 0; o < h.cars.length; o += 4) {
    const x = h.cars[o]!, z = h.cars[o + 1]!, along = Math.abs(cos(h.cars[o + 2]!)) > 0.5, a = (along ? CAR_L : CAR_W) / 2, b = (along ? CAR_W : CAR_L) / 2;
    s.push(x - a, z - b, x + a, z + b);
  }
  if (k === 0) {
    const F = FENCE_L;
    s.push(F[0]!, F[3]! - 0.1, F[2]!, F[3]! + 0.1, F[0]! - 0.1, F[1]!, F[0]! + 0.1, F[3]!, F[2]! - 0.1, F[1]!, F[2]! + 0.1, F[3]!);
  }
  for (let o = 0; o < h.trees.length; o += 2) s.push(h.trees[o]! - 0.25, h.trees[o + 1]! - 0.25, h.trees[o]! + 0.25, h.trees[o + 1]! + 0.25);
  for (let o = 0; o < h.lamps.length; o += 2) s.push(h.lamps[o]! - 0.12, h.lamps[o + 1]! - 0.12, h.lamps[o]! + 0.12, h.lamps[o + 1]! + 0.12);
  for (let o = 0; o < h.terr.length; o += 6) s.push(h.terr[o]!, h.terr[o + 1]!, h.terr[o + 2]!, h.terr[o + 3]!);
  return F64(s);
});
const PO = HOODS.map((h) => F64(h.posts));
/** Each hood's loop (x, z, …, local). */
const RT = HOODS.map((h) => F64(h.route));
/** Endless: the autopilot's line through every hood (local x, z: along the south street, east). */
const RTE = F64([-34, 8.6, 0, 8.6, 34, 8.6]);

// ---- Endless Wheelie City: the same four hoods as reused SLOTS in a row along +x, canal to canal ----
/** Slot k's centre is (k × PITCH, 0); its hood kind is `slotKind(k)`. Two slots side by side are
 *  never the same kind (k + 2·bit: neighbours differ by an odd number, mod 4), so one built hood per
 *  kind is enough: only a slot and the one it nears are ever drawn. Every slot has a hump at both
 *  ends on its south street (local z 8.5), lined up with the next slot's: the road runs on at every
 *  join, the hump flies the canal. */
export const PITCH = 2 * HX + GAP, CITY_SEED = 2611, SLOT_Z = 8.5;
/** The hood kind of endless slot k for `seed` (pure: the same row of hoods on every screen). */
export function slotKind(k: number, seed = CITY_SEED) {
  const m = Math.floor(k / 2);
  let h = Math.imul(m, 0x27d4eb2d) ^ Math.imul(seed, 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 15), 0x297a2d39);
  const v = (k + 2 * ((h >>> 16) & 1)) % 4;
  return v < 0 ? v + 4 : v;
}
/** The slot a world x is in. */
export const slotAt = (x: number) => Math.floor((x + PITCH / 2) / PITCH);

// (Results go through Q, never returned: a double returned from a call that is not inlined is boxed.)
// Q: road gap, height, kind, hump height.
const Q = new Float64Array(4);
const inR = (x: number, z: number, R: ArrayLike<number>, o: number) => x >= R[o]! && x <= R[o + 2]! && z >= R[o + 1]! && z <= R[o + 3]!;

/** The town's ground: the fixed table (four hoods in a 2 × 2) or the endless row of slots. The
 *  fixed one is the module's exports below, exactly as before (the goldens hold it). */
export function town(endless = false, seed = CITY_SEED) {
  // Endless: every kind gets a stub to both ends of its south street and a hump at each (east 0, west 1).
  const RDx = endless ? HOODS.map((h) => F64([...h.roads, HX - 2, 6.5, HX, 10.5, -HX, 6.5, -HX + 2, 10.5])) : RD;
  const HUx = endless ? HOODS.map(() => F64([0, HX - LIP, SLOT_Z, 1, 0, 1, -(HX - LIP), SLOT_Z, -1, 0])) : HU;
  /** Where (x, z) is: hood kind, its centre x, z (LOC). */
  const LOC = new Float64Array(3);
  function locate(x: number, z: number) {
    if (!endless) {
      const h = hoodAt(x, z);
      LOC[0] = h; LOC[1] = CX[h]!; LOC[2] = CZ[h]!;
      return h;
    }
    const k = slotAt(x), h = slotKind(k, seed);
    LOC[0] = h; LOC[1] = k * PITCH; LOC[2] = 0;
    return h;
  }
  /** Distance to the nearest road or turning circle in hood h (0 on one): into Q[0]. */
  function roadGap(h: number, x: number, z: number) {
    const R = RDx[h]!, C = RG[h]!;
    Q[0] = 1e9;
    for (let o = 0; o < R.length; o += 4) {
      const ax = R[o]! - x, bx = x - R[o + 2]!, az = R[o + 1]! - z, bz = z - R[o + 3]!;
      const dx = ax > bx ? (ax > 0 ? ax : 0) : bx > 0 ? bx : 0, dz = az > bz ? (az > 0 ? az : 0) : bz > 0 ? bz : 0, d = dx > dz ? dx : dz;
      if (d < Q[0]!) Q[0] = d;
    }
    for (let o = 0; o < C.length; o += 3) {
      // (hypot's own arithmetic, inline: the same bits, and no boxed double from a call.)
      const ax = x - C[o]! < 0 ? C[o]! - x : x - C[o]!, ay = z - C[o + 1]! < 0 ? C[o + 1]! - z : z - C[o + 1]!, mx = ax > ay ? ax : ay, zz = mx === 0 ? 1 : mx, pp = ax / zz, qq = ay / zz;
      const d = (ax === Infinity || ay === Infinity ? Infinity : Math.sqrt(pp * pp + qq * qq) * mx) - C[o + 2]!;
      if (d < Q[0]!) Q[0] = d > 0 ? d : 0;
    }
  }
  /** The hump ramps of hood h at local (x, z): their height, or −1 off them, into Q[3]. */
  function humpQ(h: number, x: number, z: number) {
    const U = HUx[h]!;
    let r = -1;
    for (let o = 0; o < U.length; o += 5) {
      const px = x - U[o + 1]!, pz = z - U[o + 2]!, dx = U[o + 3]!, dz = U[o + 4]!, s = px * dx + pz * dz, l = px * dz - pz * dx;
      if ((l < 0 ? -l : l) < HUMP_W && s > -(RAMP + DECK) && s < LIP + BANK) r = s < -DECK ? (HUMP_H * (s + RAMP + DECK)) / RAMP : HUMP_H;
    }
    Q[3] = r;
  }
  /** The ground's height at world (x, z): into Q[1]; the hood's kind cues into Q[2] (water off the bank). */
  function heightQ(x: number, z: number) {
    const h = locate(x, z), lx = x - LOC[1]!, lz = z - LOC[2]!, ax = (lx < 0 ? -lx : lx) - HX, az = (lz < 0 ? -lz : lz) - HZ;
    if (ax > 0 || az > 0) {
      // Off the hood: its bank (the hump's deck runs on over it), then the canal.
      Q[2] = 1;
      if ((ax > az ? ax : az) >= BANK) return void (Q[1] = CANAL);
      humpQ(h, lx, lz);
      const r = Q[3]!;
      return void (Q[1] = r >= 0 ? r : CURB);
    }
    Q[2] = 0;
    roadGap(h, lx, lz);
    const g = Q[0]!;
    let y = g > 0 ? (g >= 0.08 ? CURB : CURB * (g / 0.08)) : 0;
    if (g <= 0) {
      const B = BU[h]!, K = KI[h]!;
      for (let o = 0; o < B.length; o += 5) {
        const bx = Math.abs(lx - B[o]!);
        if (bx < B[o + 3]! && lz > B[o + 1]! && lz < B[o + 2]!) {
          const u = bx / B[o + 3]!;
          y += B[o + 4]! * (1 - u * u);
        }
      }
      for (let o = 0; o < K.length; o += 5) if (lx > K[o]! && lx < K[o + 2]! && lz > K[o + 1]! && lz < K[o + 3]!) y += (K[o + 4]! * (lz - K[o + 1]!)) / (K[o + 3]! - K[o + 1]!);
    }
    humpQ(h, lx, lz);
    const r = Q[3]!;
    Q[1] = r > y ? r : y;
  }
  /** The ground's height at (x, z). */
  function height(x: number, z: number) {
    heightQ(x, z);
    return Q[1]!;
  }
  /** The kind of ground at (x, z) (K_ROAD … K_PLAZA). */
  function kindAt(x: number, z: number) {
    const h = locate(x, z), lx = x - LOC[1]!, lz = z - LOC[2]!, ax = (lx < 0 ? -lx : lx) - HX, az = (lz < 0 ? -lz : lz) - HZ;
    if (ax > 0 || az > 0) return (ax > az ? ax : az) >= BANK ? K_WATER : K_WALK;
    roadGap(h, lx, lz);
    const g = Q[0]!, D = DR[h]!, Bk = BL[h]!, F = SF[h]!;
    if (g <= 0) {
      for (let o = 0; o < F.length; o += 5) if (lx >= F[o]! && lx <= F[o + 2]! && lz >= F[o + 1]! && lz <= F[o + 3]!) return F[o + 4]!;
      return K_ROAD;
    }
    for (let o = 0; o < D.length; o += 4) if (lx >= D[o]! && lx <= D[o + 2]! && lz >= D[o + 1]! && lz <= D[o + 3]!) return K_DRIVE;
    for (let o = 0; o < Bk.length; o += 4)
      if (lx >= Bk[o]! && lx <= Bk[o + 2]! && lz >= Bk[o + 1]! && lz <= Bk[o + 3]!) return lx - Bk[o]! < 1 || Bk[o + 2]! - lx < 1 || lz - Bk[o + 1]! < 1 || Bk[o + 3]! - lz < 1 ? K_WALK : K_LAWN;
    return g < 1.2 ? K_WALK : K_LAWN;
  }
  /** The ground for the bike: height and normal (from the neighbours), and the kind. */
  const ground = {
    sample(x: number, z: number, out: { [i: number]: number }) {
      const e = 0.05;
      heightQ(x + e, z); const hx1 = Q[1]!;
      heightQ(x - e, z); const hx0 = Q[1]!;
      heightQ(x, z + e); const hz1 = Q[1]!;
      heightQ(x, z - e); const hz0 = Q[1]!;
      heightQ(x, z);
      const nx = -(hx1 - hx0) / (2 * e), nz = -(hz1 - hz0) / (2 * e), l = Math.sqrt(nx * nx + nz * nz + 1);
      out[0] = Q[1]!; out[1] = nx / l; out[2] = 1 / l; out[3] = nz / l;
      return kindAt(x, z);
    },
  };
  /** A spot a reset can use: on the street (road, drive, walk, plaza, boardwalk; never a lawn, sand or
   *  the water), inside its hood's fence, r clear of anything solid. */
  function streetClear(x: number, z: number, r: number, solidOnly = false) {
    const h = locate(x, z), lx = x - LOC[1]!, lz = z - LOC[2]!;
    if ((lx < 0 ? -lx : lx) > HX - 0.5 - r || (lz < 0 ? -lz : lz) > HZ - 0.5 - r) return false;
    const k = kindAt(x, z);
    if (k === K_WATER || (!solidOnly && (k === K_LAWN || k === K_SAND))) return false;
    const B = SOL[h]!, C = PO[h]!;
    for (let o = 0; o < B.length; o += 4) if (lx > B[o]! - r - R_BIKE && lx < B[o + 2]! + r + R_BIKE && lz > B[o + 1]! - r - R_BIKE && lz < B[o + 3]! + r + R_BIKE) return false;
    for (let o = 0; o < C.length; o += 4) {
      const dx = lx - C[o]!, dz = lz - C[o + 1]!, rr = C[o + 2]! + r + R_BIKE;
      if (dx * dx + dz * dz < rr * rr) return false;
    }
    return true;
  }
  return { endless, seed, heightQ, height, kindAt, ground, streetClear, locate, LOC, HU: HUx };
}
export type Town = ReturnType<typeof town>;
const FIXED = town(false);
/** The fixed table's ground (the scene, the tests). */
export const height = FIXED.height, kindAt = FIXED.kindAt, ground = FIXED.ground, streetClear = FIXED.streetClear;
const heightQ = FIXED.heightQ;

// S: the session's state, by index.
const PH = 0, CLOCK = 1, RIDE = 2, CT = 3, GRUMPS = 4, SPLASH = 5, BARKS = 6, LEG = 7, HOPAIR = 8, WHY = 9, WALL = 10, SPCLK = 11, HOOD = 12, FLY = 13, FLYTO = 14, FLYT = 15, DIR = 16, GO = 17, JUMPS = 18, VISITED = 19, STUCK = 20, UNSTUCK = 21;
export const S_HOOD = HOOD, S_FLY = FLY, S_JUMPS = JUMPS, S_VISITED = VISITED, S_UNSTUCK = UNSTUCK;

/** A session in town. Inputs each step: gas, brake, lean (−1 back .. 1 forward), steer, hop. */
export function cityRun(specs: RideSpec[] = RIDES, seed = 1, endless = false, citySeed = CITY_SEED) {
  // The ground: the fixed table, or the endless row of slots (each hood kind's centre moves to the
  // slot it is in: HC, x and z per kind, which the patrol paths by too; OFF: each kind's move from
  // its place on the fixed table, for the world lists: neighbours, sprinklers, crosswalks, the dog).
  const T = endless ? town(true, citySeed) : FIXED, HC = endless ? Float64Array.from(FIXED_C) : FIXED_C, OFF = new Float64Array(8);
  // Walking the bike: anywhere a bike can be but the water, never into a wall, a house, a post (the fence).
  const bike = ride(T.ground, specs, (p: Float64Array) => T.streetClear(p[0]!, p[1]!, 0.05, true)), sc = tricks(), cop = cops(seed, HC);
  // Unstuck (a person riding): the ring of good spots on the street, the watch; US[0]: the prompt is up.
  const U = unstuck(T.ground, T.streetClear), US = new Float64Array(1);
  // Endless: the slot ridden, the start's x, the furthest along +x from it (the distance).
  const ES = new Float64Array(3);
  /** Endless: into slot k (its hood kind moves there). */
  function toSlot(k: number) {
    const h = slotKind(k, citySeed);
    ES[0] = k;
    HC[h * 2] = k * PITCH; HC[h * 2 + 1] = 0;
    OFF[h * 2] = k * PITCH - CX[h]!; OFF[h * 2 + 1] = -CZ[h]!;
    if (h === 0) DG[0] = (DOG[0]! + DOG[1]!) / 2 + OFF[0]!;
    return h;
  }
  // S: phase, time left, ride, crash timer, grumps, splashes, barks, route leg, hop air, crash reason,
  // wall hit, sprinkler clock, hood, flying, flying to (hump), flight time, loop direction, escaping
  // for (hump + 1), humps jumped, hoods visited (bits), the autopilot's stuck timer and its rescues.
  const S = new Float64Array(22);
  const ev = new Float64Array(48);
  let n = 0;
  // Neighbours: timer (out while > 0), cooldown, line. Sprinklers: cooldown. Dog: x, bark timer, cooldown, hop.
  const NB = new Float64Array(NN * 3), SPC = new Float64Array(NSP), DG = new Float64Array(4);
  /** The hand drag: seconds past 12 (charging), dragging (0/1), points pending (at risk), seconds dragging. */
  const HD = new Float64Array(4);
  function emit(type: number, v: number) {
    if (n < 24) (ev[n * 2] = type), (ev[n * 2 + 1] = v), n++;
  }
  function crashed(why: number) {
    if (S[PH] !== RUN) return;
    // A loop-out (any crash) mid-drag: the drag's points are lost.
    if (HD[1] || HD[2]! > 0) emit(E_LOST, Math.round(HD[2]!));
    HD.fill(0);
    S[PH] = CRASH; S[CT] = CRASH_T; S[WHY] = why;
    sc.drop();
    emit(E_CRASH, why);
  }
  function reset(which = S[RIDE]!, hood = 0) {
    S.fill(0);
    S[CLOCK] = SESSION; S[RIDE] = which; S[HOOD] = hood; S[LEG] = START_LEG[hood]!; S[DIR] = 1; S[VISITED] = 1 << hood;
    sc.reset();
    cop.reset(seed);
    NB.fill(0); SPC.fill(0); DG.fill(0); HD.fill(0);
    U.clear(); US[0] = 0;
    DG[0] = (DOG[0]! + DOG[1]!) / 2;
    n = 0;
    if (endless) {
      // Slot 0, on its south street heading east (the way the town goes on).
      const h = toSlot(0);
      S[HOOD] = h; S[LEG] = 0; S[VISITED] = 1 << h;
      bike.use(which, -40, SLOT_Z + 0.1, 0);
      ES[1] = -40; ES[2] = 0;
      return;
    }
    const st = HOODS[hood]!.start;
    bike.use(which, st[0]! + CX[hood]!, st[1]! + CZ[hood]!, st[2]!);
  }
  /** Bump out of anything solid in the hood and its fence; a hard hit is a crash. Not in the air over a hump. */
  function collide() {
    if (S[FLY]) return;
    const p = bike.b.pos, h = S[HOOD]!, cx = HC[h * 2]!, cz = HC[h * 2 + 1]!, B = SOL[h]!, C = PO[h]!;
    for (let o = 0; o < B.length; o += 4) {
      const lx = p[0]! - cx, lz = p[2]! - cz;
      const qx = Math.max(B[o]!, Math.min(B[o + 2]!, lx)), qz = Math.max(B[o + 1]!, Math.min(B[o + 3]!, lz));
      let dx = lx - qx, dz = lz - qz;
      const dd = hypot(dx, dz);
      if (dd >= R_BIKE) continue;
      if (dd > 1e-6) (dx /= dd), (dz /= dd);
      else (dx = -bike.b.cy), (dz = bike.b.sy);
      p[0] = qx + dx * R_BIKE + cx; p[2] = qz + dz * R_BIKE + cz;
      hit(bike.wall(dx, dz, BONK_V));
    }
    for (let o = 0; o < C.length; o += 4) {
      let dx = p[0]! - cx - C[o]!, dz = p[2]! - cz - C[o + 1]!;
      const dd = hypot(dx, dz), r = C[o + 2]! + R_BIKE;
      if (dd >= r || dd < 1e-6) continue;
      dx /= dd; dz /= dd;
      p[0] = cx + C[o]! + dx * r; p[2] = cz + C[o + 1]! + dz * r;
      hit(bike.wall(dx, dz, BONK_V));
    }
    for (let a = 0; a < 3; a += 2) {
      const lim = (a ? HZ : HX) - 0.5, c = a ? cz : cx, l = p[a]! - c;
      if (Math.abs(l) > lim) {
        const s = l > 0 ? 1 : -1;
        p[a] = c + s * lim;
        hit(bike.wall(a ? 0 : -s, a ? -s : 0, BONK_V));
      }
    }
  }
  function hit(v: number) {
    // (A hard hit is a crash, STRIKE, called through the shared bike's own crash event.)
    S[WALL] = v;
  }
  /** On a hump's deck at speed: launch for the far ramp (the flight is set: it lands on it). */
  function humps() {
    const b = bike.b, h = S[HOOD]!, U = T.HU[h]!, lx = b.pos[0]! - HC[h * 2]!, lz = b.pos[2]! - HC[h * 2 + 1]!;
    for (let o = 0; o < U.length; o += 5) {
      const dx = U[o + 3]!, dz = U[o + 4]!, px = lx - U[o + 1]!, pz = lz - U[o + 2]!, s = px * dx + pz * dz, l = px * dz - pz * dx;
      if ((l < 0 ? -l : l) >= HUMP_W || s < -1.1 || s > LIP + 0.6) continue;
      const along = b.speed * (b.cy * dx - b.sy * dz);
      if (along < FLY_V) continue;
      launch(U[o]!);
      return;
    }
  }
  function launch(i: number) {
    // (Endless: i is the slot's own hump, 0 east, 1 west; its partner is the next slot's facing one.)
    const b = bike.b, j = endless ? i : i ^ 1, dx = endless ? (i ? -1 : 1) : HUMPS[i * 5 + 2]!, dz = endless ? 0 : HUMPS[i * 5 + 3]!, p = b.pos;
    // Straight across: the heading set to the hump's, the line kept; the landing on the far ramp.
    const fx = endless ? (ES[0]! + dx) * PITCH - dx * (HX - LIP) : HUMPS[j * 5]!;
    const lx = dx !== 0 ? fx + dx * LAND_AT : p[0]!, lz = dz !== 0 ? HUMPS[j * 5 + 1]! + dz * LAND_AT : p[2]!;
    const D = (lx - p[0]!) * dx + (lz - p[2]!) * dz;
    T.heightQ(p[0]!, p[2]!);
    const off = p[1]! - Q[1]!;
    T.heightQ(lx, lz);
    const yl = Q[1]! + off, g = bike.spec.shape.gravity ?? 20;
    b.S[0] = dx > 0.5 ? 0 : dx < -0.5 ? Math.PI : dz > 0 ? -Math.PI / 2 : Math.PI / 2;
    b.S[1] = 0; b.S[3] = 0;
    b.S[5] = D / FLY_T;
    b.S[6] = (yl - p[1]! + 0.5 * g * FLY_T * FLY_T) / FLY_T;
    S[FLY] = 1; S[FLYTO] = j; S[FLYT] = 0; S[GO] = 0;
    S[JUMPS] = S[JUMPS]! + 1;
    emit(E_JUMP, i);
  }
  /** Down in the next hood: the patrol is lost; the autopilot picks up that hood's loop. */
  function landed() {
    const j = S[FLYTO]!, dx = j ? -1 : 1, h = endless ? toSlot(ES[0]! + dx) : HUMPS[j * 5 + 4]!;
    S[FLY] = 0; S[HOOD] = h; S[GO] = 0;
    if (endless) (S[LEG] = dx > 0 ? 0 : RTE.length / 2 - 1), (S[DIR] = dx);
    else (S[LEG] = ENTRY[j * 2]!), (S[DIR] = ENTRY[j * 2 + 1]!);
    S[VISITED] = S[VISITED]! | (1 << h);
    emit(E_LAND, h);
    const pts = cop.escape();
    // LOST THEM: the points, and the combo kept and one up (the clock on it starts again).
    if (pts > 0) (sc.S[SC] = sc.S[SC]! + pts), (sc.S[T_CB] = Math.min(MAXCB, sc.S[T_CB]! + 1)), (sc.S[T_GAP] = 0), emit(E_ESCAPE, pts);
  }
  /** Advance dt. `person`: a person is riding (the unstuck watch runs); `again`: the reset input (R). */
  function step(dt: number, gas: number, brake: number, lean: number, steer: number, hop: number, person = false, again = false) {
    const ph = S[PH]!;
    if (person && S[PH] === RUN && !S[FLY] && !bike.b.crashed) {
      const u = U.watch(bike.b, dt, gas > 0.1 || brake > 0.1 || lean !== 0 || steer !== 0);
      if (again || u === U_AUTO) {
        // Back to the last good spot on the street (never the trap), upright and still; its hood.
        const o = U.reset(bike.b);
        bike.reset(o[0]!, o[1]!, o[2]!);
        S[HOOD] = endless ? toSlot(slotAt(o[0]!)) : hoodAt(o[0]!, o[1]!);
        sc.drop();
        if (US[0]) US[0] = 0;
        emit(E_RESET, again ? 1 : 2);
        return true;
      }
      const up = u === U_PROMPT ? 1 : 0;
      if (up !== US[0]) (US[0] = up), emit(E_STUCK, up);
    }
    if (ph === READY && gas > 0) (S[PH] = RUN), emit(E_START, 0);
    const live = S[PH] === RUN, fly = S[FLY] === 1;
    const wasAir = bike.air, b = bike.b;
    // Over a hump the bike is held level for the far ramp (the rider's inputs wait for the landing).
    if (fly && !b.crashed) (b.S[3] = (FLY_PITCH - b.S[2]!) * 4), (b.S[1] = 0);
    let moving = bike.step(dt, fly ? 0 : live || ph === READY ? gas : 0, fly ? 0 : live ? brake : ph === DONE ? 0.35 : brake, fly ? 0 : ph === DONE ? (bike.nose > 0.05 ? 1 : 0) : lean, fly || ph === DONE ? 0 : steer, live && !fly ? hop : 0);
    for (let k = 0; k < b.n; k++) {
      const t = b.ev[k * 2]!, v = b.ev[k * 2 + 1]!;
      if (t === B_CRASH) crashed(v);
      else if (t === B_STOPPIE && S[PH] === RUN && sc.stoppie(v) === BANKED) bankedNow(E_TRICK);
    }
    b.clear();
    collide();
    if (fly) {
      S[FLYT] = S[FLYT]! + dt;
      moving = true;
      if ((S[FLYT]! > 0.25 && !bike.air) || b.crashed || S[FLYT]! > 3) landed();
    } else if ((S[PH] === RUN || ph === READY) && !b.crashed) humps();
    const x = b.pos[0]!, z = b.pos[2]!, speed = b.speed < 0 ? -b.speed : b.speed;
    if (S[PH] === RUN && !fly) drag(dt);
    if (endless && S[PH] !== READY && x - ES[1]! > ES[2]!) ES[2] = x - ES[1]!;
    if (S[PH] === RUN) {
      if (!endless) S[CLOCK] = Math.max(0, S[CLOCK]! - dt);
      // The trick in progress, and a hop when it lands.
      if (bike.air) {
        if (!wasAir) emit(E_AIR, 0);
        S[HOPAIR] = S[HOPAIR]! + dt;
      } else if (wasAir) {
        if (!fly && sc.hop(S[HOPAIR]!, bike.nose > 0.14) === BANKED) bankedNow(E_HOP);
        S[HOPAIR] = 0;
      }
      if (sc.step(dt, bike.nose, bike.balance, bike.spec.sweet, speed, b.throttle, bike.air) === BANKED) bankedNow(E_TRICK);
      if (sc.S[ON]) {
        for (let o = 0; o < CROSS.length; o += 4) {
          const ch = CROSS_H[o / 4]!;
          if (endless && ch !== S[HOOD]) continue;
          if (inR(x - OFF[ch * 2]!, z - OFF[ch * 2 + 1]!, CROSS, o) && sc.bonus(F_CROSS)) emit(E_BONUS, F_CROSS);
        }
      }
      if (S[CLOCK] === 0) {
        if (sc.S[ON] && sc.step(dt, 0, 1, 0, 0, 0, false) === BANKED) bankedNow(E_TRICK);
        S[PH] = DONE;
        emit(E_END, 0);
      }
    } else if (S[PH] === CRASH) {
      S[CT] = S[CT]! - dt;
      if (!endless) S[CLOCK] = Math.max(0, S[CLOCK]! - dt);
      moving = true;
      if (S[CT]! <= 0) {
        S[PH] = S[CLOCK]! > 0 ? RUN : DONE;
        // Back up where it fell (in the hood: never in a canal).
        const h = S[HOOD]!, lx = Math.max(-HX + 1.5, Math.min(HX - 1.5, x - HC[h * 2]!)), lz = Math.max(-HZ + 1.5, Math.min(HZ - 1.5, z - HC[h * 2 + 1]!));
        bike.reset(lx + HC[h * 2]!, lz + HC[h * 2 + 1]!, b.yaw);
        collide();
        emit(S[PH] === DONE ? E_END : E_RESPAWN, 0);
      }
    }
    const on = S[PH] === RUN || S[PH] === CRASH;
    if (on && world(dt, x, z, speed)) moving = true;
    if (cop.step(dt, x, z, S[HOOD]!, S[FLY] === 1, on, speed, S[PH] === CRASH)) moving = true;
    for (let k = 0; k < cop.n; k++) {
      const t = cop.ev[k * 2]!, v = cop.ev[k * 2 + 1]!;
      if (t === C_TICKET) {
        // A ticket: the combo and the trick in progress are gone, and half the points at risk.
        sc.drop();
        sc.S[SC] = Math.max(0, sc.S[SC]! - v);
        emit(E_TICKET, v);
      } else if (t === C_STARS) emit(E_STARS, v);
      else if (t === C_UNIT) emit(E_UNIT, v);
      else if (t === C_CLEAR) emit(E_CLEAR, v);
      else if (t === C_ESCAPE) void 0;
    }
    cop.clear();
    return moving || S[PH] === RUN;
  }
  /** The hand drag: past 12 o'clock on the rear wheel, held HAND_T s, the hand goes down; back under
   *  12, it banks (points, the streak bonus). */
  function drag(dt: number) {
    const b = bike.b, past = !bike.air && b.contact[0] === 1 && b.contact[1] === 0 && bike.nose > TWELVE;
    if (past) {
      HD[0] = HD[0]! + dt;
      if (!HD[1] && HD[0]! >= HAND_T) (HD[1] = 1), (HD[3] = 0), emit(E_DRAG, 1);
      if (HD[1]) (HD[3] = HD[3]! + dt), (HD[2] = HD[2]! + DRAG_RATE * DRAG_X * (1 + sc.S[T_CB]!) * dt);
      return;
    }
    if (HD[1]) {
      const pts = Math.round(HD[2]! + STREAK * HD[3]! * HD[3]!);
      sc.S[SC] = sc.S[SC]! + pts;
      sc.S[T_CB] = Math.min(MAXCB, sc.S[T_CB]! + 1);
      sc.S[T_GAP] = 0;
      cop.banked(pts);
      emit(E_BANKED, pts);
    }
    HD.fill(0);
  }
  /** A trick banked: its event, its heat, its points at risk while the heat is on. */
  function bankedNow(type: number) {
    const pts = sc.S[PTS]!;
    emit(type, type === E_TRICK ? sc.S[10]! : 0);
    cop.banked(pts);
    cop.heat(Math.min(HEAT_FROM.trickCap, pts * HEAT_FROM.perPoint));
  }
  /** Neighbours, sprinklers and the dog. True while any of them moves. */
  function world(dt: number, x: number, z: number, speed: number) {
    let any = false;
    const kind = S[FLY] ? K_WATER : T.kindAt(x, z), on = sc.S[ON] === 1, loud = on || speed > 9 || kind === K_LAWN;
    if (kind === K_LAWN && S[PH] === RUN && !bike.air) cop.heat(HEAT_FROM.lawn * dt);
    for (let i = 0; i < NN; i++) {
      const nh = NEIGH_H[i]!;
      if (endless && nh !== S[HOOD]) continue;
      const o = i * 8, b = i * 3, ox = OFF[nh * 2]!, oz = OFF[nh * 2 + 1]!, inZone = x > NEIGH[o + 4]! + ox && x < NEIGH[o + 6]! + ox && z > NEIGH[o + 5]! + oz && z < NEIGH[o + 7]! + oz;
      if (NB[b + 1]! > 0) NB[b + 1] = NB[b + 1]! - dt;
      if (NB[b]! > 0) {
        NB[b] = Math.max(0, NB[b]! - dt);
        any = true;
        if (inZone && on && NB[b]! < 2.2 && sc.bonus(F_GRUMP)) emit(E_BONUS, F_GRUMP);
      } else if (inZone && loud && NB[b + 1]! <= 0 && S[PH] === RUN) {
        NB[b] = 2.6; NB[b + 1] = 8; NB[b + 2] = (S[GRUMPS]! * 3 + i) % LINES.length;
        S[GRUMPS] = S[GRUMPS]! + 1;
        cop.heat(HEAT_FROM.grump);
        emit(E_GRUMP, i);
        any = true;
      }
    }
    S[SPCLK] = S[SPCLK]! + dt;
    for (let i = 0; i < NSP; i++) {
      const sh = SPRINK_H[i]!;
      if (endless && sh !== S[HOOD]) continue;
      const o = i * 4, dx = x - (SPRINK[o]! + OFF[sh * 2]!), dz = z - (SPRINK[o + 1]! + OFF[sh * 2 + 1]!), dd = hypot(dx, dz);
      if (SPC[i]! > 0) SPC[i] = SPC[i]! - dt;
      if (dd > SP_REACH || dd < 0.2 || SPC[i]! > 0) continue;
      let da = heading(dx, dz) - sprinklerAim(i);
      da -= TAU * Math.floor(da / TAU + 0.5);
      if (Math.abs(da) < 0.45) {
        SPC[i] = 1.2;
        S[SPLASH] = S[SPLASH]! + 1;
        cop.heat(HEAT_FROM.splash);
        emit(E_SPLASH, i);
        if (sc.bonus(F_SPRINK)) emit(E_BONUS, F_SPRINK);
      }
    }
    any = true; // the sprinklers turn while the session runs
    // The dog trots along its fence after the bike and barks when it is close.
    const gx = OFF[0]!, gz = DOG[2]! + OFF[1]!, dz = Math.abs(z - gz), want = dz < 9 && S[HOOD] === 0 ? Math.max(DOG[0]! + gx, Math.min(DOG[1]! + gx, x)) : (DOG[0]! + DOG[1]!) / 2 + gx, dx = want - DG[0]!;
    DG[0] = DG[0]! + Math.max(-4 * dt, Math.min(4 * dt, dx));
    if (DG[2]! > 0) DG[2] = Math.max(0, DG[2]! - dt);
    if (DG[3]! > 0) DG[3] = DG[3]! - dt;
    if (hypot(x - DG[0]!, z - gz) < 5.5 && DG[3]! <= 0) (DG[2] = 0.6), (DG[3] = 1.6), (S[BARKS] = S[BARKS]! + 1), cop.heat(HEAT_FROM.bark), emit(E_BARK, 0);
    return any || Math.abs(dx) > 0.01 || DG[2]! > 0;
  }
  /** Where sprinkler i points now (radians, 0 is +x, anticlockwise from above). */
  function sprinklerAim(i: number) {
    const o = i * 4;
    return SPRINK[o + 2]! + 1.15 * sin(S[SPCLK]! * 1.3 + SPRINK[o + 3]!);
  }
  // ---- the autopilot: round the hood's loop, a wheelie down each straight, the front down for the
  // corners; with the patrol after it, for the hood's escape hump at full gas ----
  function autopilot(I: Float64Array) {
    const b = bike.b, h = S[HOOD]!, cx = HC[h * 2]!, cz = HC[h * 2 + 1]!, x = b.pos[0]! - cx, z = b.pos[2]! - cz, R = endless ? RTE : RT[h]!, nw = R.length / 2;
    I[4] = 0;
    if (S[FLY]) return void (I[0] = I[1] = I[2] = I[3] = 0);
    // Wedged against something for two seconds (it has no reverse): back on the loop at its last waypoint (counted: the tests want none).
    S[STUCK] = S[PH] === RUN && (b.speed < 0 ? -b.speed : b.speed) < 0.3 ? S[STUCK]! + 1 / 60 : 0;
    if (S[STUCK]! > 2) {
      const k = (S[LEG]! - S[DIR]! + nw) % nw, px = R[k * 2]!, pz = R[k * 2 + 1]!;
      bike.reset(px + cx, pz + cz, heading(R[S[LEG]! * 2]! - px, R[S[LEG]! * 2 + 1]! - pz));
      S[STUCK] = 0; S[UNSTUCK] = S[UNSTUCK]! + 1; S[GO] = 0;
      return autopilot(I);
    }
    const flee = (cop.chasing > 0 && cop.S[NEAR]! < 24) || cop.S[STARS]! >= 3;
    let leg = S[LEG]!, dir = S[DIR]!;
    let ax: number, az: number, thru = 0;
    if (S[GO]! > 0) {
      // For the hump: past its lip, on its line.
      const i = S[GO]! - 1, E = T.HU[h]!;
      const lx = endless ? E[i * 5 + 1]! : HUMPS[i * 5]! - cx, lz = endless ? E[i * 5 + 2]! : HUMPS[i * 5 + 1]! - cz, dx = endless ? E[i * 5 + 3]! : HUMPS[i * 5 + 2]!, dz = endless ? E[i * 5 + 4]! : HUMPS[i * 5 + 3]!;
      ax = lx + dx * 6; az = lz + dz * 6;
      if (dx !== 0) az = lz; else ax = lx;
      let err = heading(ax - x, az - z) - b.yaw;
      err -= TAU * Math.floor(err / TAU + 0.5);
      const ae = Math.abs(err), v = b.speed;
      I[3] = Math.max(-1, Math.min(1, -err * 2.6));
      // Round the corner onto its street slowly, then everything it has.
      I[0] = ae < 0.45 || v < 2.5 ? 1 : 0;
      I[1] = ae > 0.45 && v > 4.5 ? 0.8 : 0;
      I[2] = bike.nose > 0.04 ? 1 : 0.4;
      if (!flee && ae > 2.2 && !endless) S[GO] = 0;
      return;
    }
    const tx = R[leg * 2]!, tz = R[leg * 2 + 1]!;
    let dist = hypot(tx - x, tz - z);
    if (dist < 2.6) {
      // At a waypoint: for an escape hump that turns off here (riding the loop the right way, the hump ahead or to the side), else on round.
      if (endless && (flee || leg + dir < 0 || leg + dir >= nw)) {
        // Endless: at the end of the street (or with the patrol on it), for the hump that way.
        S[GO] = dir > 0 ? 1 : 2;
        return autopilot(I);
      }
      if (flee) {
        const U = HU[h]!;
        for (let o = 0; o < U.length; o += 5) {
          const i = U[o]!, want = BRANCH[i * 2 + 1]!;
          if (BRANCH[i * 2] !== leg || (want !== 0 && want !== dir)) continue;
          if ((U[o + 1]! - x) * b.cy - (U[o + 2]! - z) * b.sy < -0.2 * hypot(U[o + 1]! - x, U[o + 2]! - z)) continue;
          S[GO] = i + 1;
          return autopilot(I);
        }
      }
      leg = S[LEG] = (leg + dir + nw) % nw;
      dist = hypot(R[leg * 2]! - x, R[leg * 2 + 1]! - z);
    }
    ax = R[leg * 2]!; az = R[leg * 2 + 1]!;
    // A waypoint the bike runs straight on through is no corner (on its way there, the leg after it points the same way).
    if (!flee) {
      const k = (leg + dir + nw) % nw, ox = R[k * 2]! - ax, oz = R[k * 2 + 1]! - az, ix = ax - x, iz = az - z;
      thru = ix * oz - iz * ox < 0.2 * hypot(ix, iz) * hypot(ox, oz) && ix * oz - iz * ox > -0.2 * hypot(ix, iz) * hypot(ox, oz) && ix * ox + iz * oz > 0 ? 1 : 0;
    }
    let err = heading(ax - x, az - z) - b.yaw;
    err -= TAU * Math.floor(err / TAU + 0.5);
    const v = b.speed, th = bike.nose, up = th > 0.06, ahead = dist - v * AP[6]! + (thru ? 40 : 0);
    // In a wheelie the bike steers by leaning: aim early, and drop the front well before a corner.
    I[3] = Math.max(-1, Math.min(1, -err * (up ? 3.4 : 2.4)));
    if (flee) {
      // Running: no wheelies, quick, the front down for the corners.
      I[0] = v < (ahead < 3.5 ? 4.2 : 8.5) && Math.abs(err) < 1.2 ? 1 : v < 2 ? 0.6 : 0;
      I[1] = v > 5 && ahead < 3.5 ? 0.6 : 0;
      I[2] = up ? 1 : 0.5;
      return;
    }
    // (Not for a hump, unless running: off the gas and on the brakes at one.)
    const U = T.HU[h]!;
    let lip = false;
    for (let o = 0; o < U.length; o += 5) if (v > 3 && hypot(U[o + 1]! - x, U[o + 2]! - z) < 9 && b.cy * U[o + 3]! - b.sy * U[o + 4]! > 0.5) lip = true;
    if (lip || v > 11.5 || (v > 6.5 && !thru && dist < 3 + v * 0.6)) {
      // Too quick for a wheelie, or for the corner coming (off a hump): the front down and the brakes on.
      I[0] = 0; I[1] = up ? 0.4 : 0.7; I[2] = up ? 1 : 0;
      return;
    }
    const straight = Math.abs(err) < 0.3 && ahead > 3.5, goal = bike.balance - AP[0]!, om = b.S[3]!, e = goal - th;
    if (straight && v > 2.5) {
      // Hold it just under the balance point at a steady speed: a wanted nose rate from the angle off
      // it; the gas and the weight back give rate, the weight forward and the brake take it away; the
      // gas also holds the speed (past it the bike would run into its limiter and drop the front).
      const want = Math.max(-AP[3]!, Math.min(AP[3]!, e * AP[2]!)), er = want - om, vt = AP[7]!;
      I[0] = Math.max(0, Math.min(1, AP[1]! + er * AP[4]! + (vt - v) * AP[5]!));
      I[2] = Math.max(-1, Math.min(1, -er * AP[6]!));
      I[1] = er < -AP[8]! || v > vt + 2 ? Math.min(1, (-er - AP[8]!) * AP[9]! + (v > vt + 2 ? 0.3 : 0)) : 0;
      if (I[1]! < 0) I[1] = 0;
    } else if (up) {
      I[0] = 0; I[1] = 0.3; I[2] = 1;
    } else {
      I[0] = v < (ahead < 3.5 ? 4.2 : 6.5) ? 0.7 : 0;
      I[1] = v > 5 && ahead < 3.5 ? 0.6 : 0;
      I[2] = 0.3;
    }
  }
  reset(0, 0);
  // Every number the session keeps, as bytes (rollback, a desync hash): the session, the neighbours,
  // the sprinklers, the dog, the scorer, the patrol, the ride adapter and the bike ridden.
  const u8 = (a: Float64Array | Uint32Array) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const bytes = [u8(S), u8(NB), u8(SPC), u8(DG), u8(HD), u8(sc.S), u8(cop.S), u8(cop.P), u8(cop.R), u8(bike.R), u8(bike.vel), u8(U.S), u8(U.R), u8(US), ...bike.all.map((b) => b.state)];
  if (endless) bytes.push(u8(ES), u8(HC), u8(OFF));
  return {
    S, ev, bike, sc, cop, NB, SPC, DG, bytes, unstuck: U,
    /** The ground ridden (the fixed table or the endless row), the hood kinds' centres and moves. */
    town: T, HC, OFF, endless, HD,
    /** Endless: the slot ridden, and how far it has gone along the town (world units). */
    get slot() { return ES[0]!; },
    get far() { return ES[2]!; },
    /** The stuck prompt is up. */
    get stuck() { return US[0] === 1; },
    get n() { return n; },
    clear() { n = 0; },
    step, reset, autopilot, sprinklerAim,
    /** Pick a ride (0..) and the hood to start in, before the session starts. */
    choose(i: number, hood = 0) { reset(i, hood); },
    /** Put the bike down at world (x, z) facing yaw in its hood (a test, a harness). */
    place(x: number, z: number, yaw: number) {
      const h = endless ? toSlot(slotAt(x)) : hoodAt(x, z);
      bike.reset(x, z, yaw);
      S[HOOD] = h; S[FLY] = 0; S[GO] = 0; S[VISITED] = S[VISITED]! | (1 << h);
    },
  };
}
export type CityRun = ReturnType<typeof cityRun>;
export { RIDES, NHOOD, HEAT };
