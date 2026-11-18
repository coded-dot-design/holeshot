// Endless Wheelie City's session, headless: the open world (./open.ts: roads, towns and fields that
// never end, in every direction) on the shared bike (./ride.ts), scored by ./tricks.ts, with the neon
// patrol (./cops.ts) bound to each TOWN: it spawns only inside a town's limits, its units path on
// that town's streets and stop at the limits, and riding out of town with them on you loses them
// ("LOST THEM!": the escape's points, the combo up). Every city mechanic rides along: wheelies,
// manuals, hops and stoppies, the hand drag (×10, at risk until banked, lost on a loop-out), the
// combo, crosswalk, sprinkler and grumpy-neighbour bonuses, the heat (neighbours shouting, a
// sprinkler run, a lawn ridden, the dog, a big trick), a ticket only when caught stopped or down,
// walking the bike, unstuck. No clock: how far from the start (the best is `stats.far.city`).
// `autopilot` rides the roads: a wheelie down every straight, the front down for the bends, a seeded
// pick at every junction (with the patrol on it: the road out of town). Deterministic and seeded
// (../../math.ts, never the builtin transcendentals); zero allocation per step (what it can hit is
// gathered round it into fixed arrays).
import { hypot } from "@fzlt/core/steer";
import { ride, RIDES, type RideSpec } from "./ride.ts";
import { B_CRASH, B_STOPPIE, BAIL } from "../../bike/bike.ts";
import { stunts, ST_DRAG, ST_BANK, ST_LOST, CRASH as ST_CRASH } from "../stunts.ts";
import { sin, cos } from "../../math.ts";
import { unstuck, U_AUTO, U_PROMPT } from "../unstuck.ts";
import { tricks, ON, SC, PTS, F_CROSS, F_SPRINK, F_GRUMP, BANKED, MAXCB, CB as T_CB, GAP as T_GAP } from "./tricks.ts";
import { cops, heading, C_TICKET, C_STARS, C_UNIT, C_CLEAR, STARS, NEAR } from "./cops.ts";
import {
  openWorld, openWindow, CITY_SEED, IS, TOWN_R, I_PROP, I_HOUSE, I_HOUSE2, I_TREE, I_PINE, I_ROCK, I_HAY, I_LAMP, I_SIGN, I_MAIL, I_BENCH, I_CAR, I_FENCE, I_DOG, I_SPRINK, I_CROSS, I_SILO, F_LAWN,
} from "./open.ts";
import {
  READY, RUN, CRASH, DONE, E_START, E_TRICK, E_CRASH, E_RESPAWN, E_GRUMP, E_BARK, E_SPLASH, E_BONUS, E_HOP, E_AIR, E_TICKET, E_ESCAPE, E_STARS, E_UNIT, E_CLEAR,
  E_STUCK, E_RESET, E_DRAG, E_BANKED, E_LOST, HEAT_FROM, AP, LINES, SP_REACH,
} from "./rules.ts";

/** Into a town (value 1) or out of its limits (0). */
export const E_TOWN = 24;
const TAU = 6.283185307179586, CRASH_T = 1.8, R_BIKE = 0.45, BONK_V = 5;
/** The gather: its reach round the rider, how far the rider goes before it is redone, its cap; the
 *  neighbours and sprinklers it keeps live. */
export const GR = 26, REGATHER = 6, GCAP = 200, NNB = 6, NSPK = 4;
/** A town's limits for the patrol (a little past the sign, so the line is clear). */
export const LIMIT = TOWN_R + 3;
/** Solid radii of the round props by item (0: not solid). */
const ROUND = new Float64Array(32);
ROUND[I_TREE] = 0.3; ROUND[I_PINE] = 0.3; ROUND[I_ROCK] = 0.5; ROUND[I_HAY] = 0.55; ROUND[I_LAMP] = 0.12; ROUND[I_SIGN] = 0.14; ROUND[I_MAIL] = 0.1; ROUND[I_SILO] = 1.1;

// S: the session's state, by index.
const PH = 0, CLOCK = 1, RIDE = 2, CT = 3, GRUMPS = 4, SPLASH = 5, BARKS = 6, HOPAIR = 8, WHY = 9, WALL = 10, SPCLK = 11, TOWN = 12, TI = 13, TJ = 14, STUCK = 20, UNSTUCK = 21;
/** The autopilot: its road (i, j, dir), which way along it, junctions passed, and the town count. */
const AI = 22, AJ = 23, AD = 24, AS = 25, AN = 26, TOWNS = 27;
export const S_TOWN = TOWN, S_UNSTUCK = UNSTUCK, S_TOWNS = TOWNS, S_AN = AN;

/** A session in the open world. Inputs each step: gas, brake, lean (−1 back .. 1 forward), steer, hop. */
export function openRun(specs: RideSpec[] = RIDES, seed = 1, citySeed = CITY_SEED) {
  const W = openWorld(citySeed), win = openWindow(W), t = win.t;
  // The town patrol: hood 0 is the town the rider is in (its junction in HC, its streets in W.graph).
  const HC = new Float64Array(2), G = [W.graph];
  // SG: what was gathered round GC (the state's centre: x, z) when SGC said; scratch for a probe.
  const SG = new Float64Array(GCAP * IS), GC = new Float64Array(2), SGC = new Float64Array(3), PG = new Float64Array(64 * IS);
  let sn = 0;
  const GT = new Float64Array(3);
  function streetClear(x: number, z: number, r: number, solidOnly = false) {
    void solidOnly;
    // Covered by the gather: test it; else gather round the point (a reset's spot far back).
    const dx = x - SGC[0]!, dz = z - SGC[1]!;
    let A = SG, n = sn;
    if (dx * dx + dz * dz > (GR - 4 - r) * (GR - 4 - r)) (n = W.gather(x, z, 8 + r, PG, 64)), (A = PG);
    for (let q = 0; q < n; q++) if (hits(A, q, x, z, r + R_BIKE)) return false;
    return true;
  }
  /** Is (x, z) within r of item q's solid? */
  function hits(A: Float64Array, q: number, x: number, z: number, r: number) {
    const o = q * IS, k = A[o]!, ix = A[o + 1]!, iz = A[o + 2]!;
    if (k < I_PROP || k === I_CAR || k === I_FENCE || k === I_BENCH || k === I_DOG) {
      if (k === I_DOG) return false;
      const ux = A[o + 3]!, uz = A[o + 4]!, lx = (x - ix) * ux + (z - iz) * uz, lz = -(x - ix) * uz + (z - iz) * ux, a = A[o + 5]! / 2 + r, b = A[o + 6]! / 2 + r;
      return lx > -a && lx < a && lz > -b && lz < b;
    }
    const rr = ROUND[k]!;
    if (!rr) return false;
    const dx = x - ix, dz = z - iz;
    return dx * dx + dz * dz < (rr + r) * (rr + r);
  }
  const bike = ride(t, specs, (p: Float64Array) => streetClear(p[0]!, p[1]!, 0.05, true)), sc = tricks(), cop = cops(seed, HC, G, LIMIT);
  const U = unstuck(t, streetClear), US = new Float64Array(1);
  // ES: the start (x, z), the furthest from it (the distance).
  const ES = new Float64Array(3);
  const S = new Float64Array(28);
  const ev = new Float64Array(48);
  let n = 0;
  // Neighbours: key, timer (out while > 0), cooldown, line; their house (x, z, front x, z, depth) is read from SG.
  const NB = new Float64Array(NNB * 4), NI = new Int32Array(NNB), SPK = new Float64Array(NSPK * 2), SPI = new Int32Array(NSPK);
  // The dog: key, x along its fence (local), bark timer, cooldown; its yard's item in SG (DI).
  const DG = new Float64Array(4), DI = new Int32Array(1);
  // The stunts (../stunts.ts): the drag ladder, the whip, the combo button; HD is its drag.
  const st = stunts(sc, seed), HD = st.HD, FW = new Uint8Array(1);
  function emit(type: number, v: number) {
    if (n < 24) (ev[n * 2] = type), (ev[n * 2 + 1] = v), n++;
  }
  /** Gather round (x, z) (the state's centre) and remap the live neighbours, sprinklers and the dog. */
  function regather(x: number, z: number) {
    GC[0] = x; GC[1] = z;
    sync();
  }
  /** SG from GC (after a regather, or a rollback put GC back). */
  function sync() {
    if (SGC[2] === 1 && SGC[0] === GC[0] && SGC[1] === GC[1]) return;
    SGC[0] = GC[0]!; SGC[1] = GC[1]!; SGC[2] = 1;
    sn = W.gather(GC[0]!, GC[1]!, GR, SG, GCAP);
    // Neighbours: the houses in reach, the state kept for any already live (by key).
    let a = 0;
    for (let q = 0; q < sn && a < NNB; q++) {
      const k = SG[q * IS]!;
      if (k !== I_HOUSE && k !== I_HOUSE2) continue;
      const key = SG[q * IS + 9]!;
      let from = -1;
      for (let b = 0; b < NNB; b++) if (NB[b * 4] === key && NB[b * 4 + 1]! + NB[b * 4 + 2]! > 0) from = b;
      if (from >= a) for (let c = 0; c < 4; c++) { const v = NB[a * 4 + c]!; NB[a * 4 + c] = NB[from * 4 + c]!; NB[from * 4 + c] = v; }
      else if (from < 0) (NB[a * 4] = key), (NB[a * 4 + 1] = 0), (NB[a * 4 + 2] = 0), (NB[a * 4 + 3] = 0);
      NI[a++] = q;
    }
    for (; a < NNB; a++) (NI[a] = -1), (NB[a * 4] = -1), (NB[a * 4 + 1] = NB[a * 4 + 2] = 0);
    a = 0;
    for (let q = 0; q < sn && a < NSPK; q++) {
      if (SG[q * IS] !== I_SPRINK) continue;
      const key = SG[q * IS + 9]!;
      if (SPK[a * 2] !== key) (SPK[a * 2] = key), (SPK[a * 2 + 1] = 0);
      SPI[a++] = q;
    }
    for (; a < NSPK; a++) (SPI[a] = -1), (SPK[a * 2] = -1);
    DI[0] = -1;
    for (let q = 0; q < sn; q++) if (SG[q * IS] === I_DOG) {
      DI[0] = q;
      if (DG[0] !== SG[q * IS + 9]) (DG[0] = SG[q * IS + 9]!), (DG[1] = 0), (DG[2] = DG[3] = 0);
      break;
    }
  }
  function crashed(why: number) {
    if (S[PH] !== RUN) return;
    st.lose();
    fwd();
    S[PH] = CRASH; S[CT] = CRASH_T; S[WHY] = why;
    sc.drop();
    emit(E_CRASH, why);
  }
  function reset(which = S[RIDE]!) {
    S.fill(0);
    S[CLOCK] = 0; S[RIDE] = which; S[TOWN] = -1;
    sc.reset();
    cop.reset(seed);
    NB.fill(0); SPK.fill(0); DG.fill(0); st.reset();
    U.clear(); US[0] = 0;
    n = 0; FW[0] = 0;
    // The start: the first town's main road, heading east out of the middle (the way the world goes on).
    const e = W.edge(0, 0, 0);
    W.at(e, 14);
    const x = W.PQ[0]!, z = W.PQ[1]! , tx = W.PQ[2]!, tz = W.PQ[3]!, hw = W.EF[e * 8]!;
    const sx = x - tz * hw * 0.5, sz = z + tx * hw * 0.5;
    win.follow(sx, sz);
    bike.use(which, sx, sz, heading(tx, tz));
    // A wheelie bar caps the drags (../stunts.ts `bar`).
    st.bar(bike.spec.bar?.dragX);
    S[AI] = 0; S[AJ] = 0; S[AD] = 0; S[AS] = 1;
    ES[0] = sx; ES[1] = sz; ES[2] = 0;
    SGC[2] = 0;
    regather(sx, sz);
    towns(sx, sz);
  }
  /** The town round (x, z): in, out (LOST THEM if they were on you), or into another. */
  function towns(x: number, z: number) {
    W.townQ(x, z);
    const d = W.TQ[0]!, i = W.TQ[1]!, j = W.TQ[2]!, inT = S[TOWN]! >= 0, same = inT && S[TI] === i && S[TJ] === j;
    if (inT && (!same || d > LIMIT) && !(same && d <= LIMIT)) {
      // Out of its limits: the patrol can't follow.
      const pts = cop.escape();
      if (pts > 0) (sc.S[SC] = sc.S[SC]! + pts), (sc.S[T_CB] = Math.min(MAXCB, sc.S[T_CB]! + 1)), (sc.S[T_GAP] = 0), emit(E_ESCAPE, pts);
      S[TOWN] = -1;
      emit(E_TOWN, 0);
    }
    if (S[TOWN]! < 0 && d < TOWN_R) {
      S[TOWN] = 0; S[TI] = i; S[TJ] = j; S[TOWNS] = S[TOWNS]! + 1;
      emit(E_TOWN, 1);
    }
    if (S[TOWN]! >= 0) graphFor(S[TI]!, S[TJ]!);
  }
  /** The patrol's graph and centre for town (i, j) (rebuilt only when it changes: pure, never state). */
  function graphFor(i: number, j: number) {
    if (GT[2] === 1 && GT[0] === i && GT[1] === j) return;
    GT[0] = i; GT[1] = j; GT[2] = 1;
    W.townGraph(i, j);
    W.nodeQ(i, j);
    HC[0] = W.NQ[0]!; HC[1] = W.NQ[1]!;
  }
  /** Bump out of anything solid gathered round the rider; a hard hit is a crash. */
  function collide() {
    const p = bike.b.pos;
    for (let q = 0; q < sn; q++) {
      const o = q * IS, k = SG[o]!, ix = SG[o + 1]!, iz = SG[o + 2]!;
      const ddx = p[0]! - ix, ddz = p[2]! - iz;
      if (ddx * ddx + ddz * ddz > 100) continue;
      if (k < I_PROP || k === I_CAR || k === I_FENCE || k === I_BENCH) {
        const ux = SG[o + 3]!, uz = SG[o + 4]!, a = SG[o + 5]! / 2, b = SG[o + 6]! / 2;
        const lx = ddx * ux + ddz * uz, lz = -ddx * uz + ddz * ux;
        const qx = lx < -a ? -a : lx > a ? a : lx, qz = lz < -b ? -b : lz > b ? b : lz;
        let dx = lx - qx, dz = lz - qz;
        const dd = hypot(dx, dz);
        if (dd >= R_BIKE) continue;
        if (dd > 1e-6) (dx /= dd), (dz /= dd);
        else {
          // Inside: out the nearest face.
          const fa = a - (lx < 0 ? -lx : lx), fb = b - (lz < 0 ? -lz : lz);
          if (fa < fb) (dx = lx < 0 ? -1 : 1), (dz = 0);
          else (dx = 0), (dz = lz < 0 ? -1 : 1);
        }
        const nx = qx + dx * R_BIKE, nz = qz + dz * R_BIKE;
        if (dd <= 1e-6) {
          const ex = dx ? (dx > 0 ? a : -a) + dx * R_BIKE : lx, ez = dz ? (dz > 0 ? b : -b) + dz * R_BIKE : lz;
          p[0] = ix + ex * ux - ez * uz; p[2] = iz + ex * uz + ez * ux;
        } else (p[0] = ix + nx * ux - nz * uz), (p[2] = iz + nx * uz + nz * ux);
        hit(bike.wall(dx * ux - dz * uz, dx * uz + dz * ux, BONK_V));
        continue;
      }
      const rr = ROUND[k]!;
      if (!rr) continue;
      const dd = hypot(ddx, ddz), r = rr + R_BIKE;
      if (dd >= r || dd < 1e-6) continue;
      const dx = ddx / dd, dz = ddz / dd;
      p[0] = ix + dx * r; p[2] = iz + dz * r;
      hit(bike.wall(dx, dz, BONK_V));
    }
  }
  function hit(v: number) {
    S[WALL] = v;
  }
  /** Advance dt. `person`: a person is riding (the unstuck watch runs); `again`: the reset input (R). */
  function step(dt: number, gas: number, brake: number, lean: number, steer: number, hop: number, person = false, again = false, combo = 0) {
    const ph = S[PH]!;
    sync();
    if (person && S[PH] === RUN && !bike.b.crashed) {
      const u = U.watch(bike.b, dt, gas > 0.1 || brake > 0.1 || lean !== 0 || steer !== 0);
      if (again || u === U_AUTO) {
        const o = U.reset(bike.b);
        win.follow(o[0]!, o[1]!);
        bike.reset(o[0]!, o[1]!, o[2]!);
        regather(o[0]!, o[1]!);
        towns(o[0]!, o[1]!);
        sc.drop();
        if (US[0]) US[0] = 0;
        emit(E_RESET, again ? 1 : 2);
        return true;
      }
      const up = u === U_PROMPT ? 1 : 0;
      if (up !== US[0]) (US[0] = up), emit(E_STUCK, up);
    }
    if (ph === READY && gas > 0) (S[PH] = RUN), emit(E_START, 0);
    const live = S[PH] === RUN;
    const wasAir = bike.air, b = bike.b;
    // The window under the rider (the fallen rider's, in a crash): the ground never runs out.
    win.follow(b.crashed ? b.rider[0]! : b.pos[0]!, b.crashed ? b.rider[2]! : b.pos[2]!);
    let moving = bike.step(dt, live || ph === READY ? gas : 0, live ? brake : ph === DONE ? 0.35 : brake, ph === DONE ? (bike.nose > 0.05 ? 1 : 0) : lean, ph === DONE ? 0 : steer, live ? hop : 0, st.amount);
    for (let k = 0; k < b.n; k++) {
      const ty = b.ev[k * 2]!, v = b.ev[k * 2 + 1]!;
      if (ty === B_CRASH) crashed(v);
      else if (ty === B_STOPPIE && S[PH] === RUN && sc.stoppie(v) === BANKED) bankedNow(E_TRICK);
    }
    b.clear();
    const x = b.pos[0]!, z = b.pos[2]!, speed = b.speed < 0 ? -b.speed : b.speed;
    const gx = x - GC[0]!, gz = z - GC[1]!;
    if (gx * gx + gz * gz > REGATHER * REGATHER) regather(x, z);
    collide();
    win.follow(b.pos[0]!, b.pos[2]!);
    if (st.step(dt, b, S[PH] === RUN, steer, combo) === ST_CRASH) (b.knock(BAIL), b.clear(), crashed(BAIL));
    fwd();
    if (S[PH] !== READY) {
      const fx = x - ES[0]!, fz = z - ES[1]!, far = Math.sqrt(fx * fx + fz * fz);
      if (far > ES[2]!) ES[2] = far;
    }
    if (S[PH] === RUN) {
      S[CLOCK] = S[CLOCK]! + dt;
      if (bike.air) {
        if (!wasAir) emit(E_AIR, 0);
        S[HOPAIR] = S[HOPAIR]! + dt;
      } else if (wasAir) {
        if (sc.hop(S[HOPAIR]!, bike.nose > 0.14) === BANKED) bankedNow(E_HOP);
        S[HOPAIR] = 0;
      }
      if (sc.step(dt, bike.nose, bike.balance, bike.spec.sweet, speed, b.throttle, bike.air) === BANKED) bankedNow(E_TRICK);
      if (sc.S[ON]) {
        // A crosswalk under a trick.
        for (let q = 0; q < sn; q++) {
          const o = q * IS;
          if (SG[o] !== I_CROSS) continue;
          const dx = x - SG[o + 1]!, dz = z - SG[o + 2]!, ux = SG[o + 3]!, uz = SG[o + 4]!, lx = dx * ux + dz * uz, lz = -dx * uz + dz * ux;
          if (lx > -SG[o + 5]! / 2 && lx < SG[o + 5]! / 2 && lz > -SG[o + 6]! / 2 && lz < SG[o + 6]! / 2 && sc.bonus(F_CROSS)) emit(E_BONUS, F_CROSS);
        }
      }
    } else if (S[PH] === CRASH) {
      S[CT] = S[CT]! - dt;
      moving = true;
      if (S[CT]! <= 0) {
        S[PH] = RUN;
        bike.reset(x, z, b.yaw);
        collide();
        emit(E_RESPAWN, 0);
      }
    }
    const on = S[PH] === RUN || S[PH] === CRASH;
    towns(b.pos[0]!, b.pos[2]!);
    if (on && world(dt, x, z, speed)) moving = true;
    if (cop.step(dt, x, z, 0, false, on && S[TOWN]! >= 0, speed, S[PH] === CRASH, S[TOWN]! < 0)) moving = true;
    for (let k = 0; k < cop.n; k++) {
      const ty = cop.ev[k * 2]!, v = cop.ev[k * 2 + 1]!;
      if (ty === C_TICKET) {
        sc.drop();
        sc.S[SC] = Math.max(0, sc.S[SC]! - v);
        emit(E_TICKET, v);
      } else if (ty === C_STARS) emit(E_STARS, v);
      else if (ty === C_UNIT) emit(E_UNIT, v);
      else if (ty === C_CLEAR) emit(E_CLEAR, v);
    }
    cop.clear();
    return moving || S[PH] === RUN;
  }
  /** The stunts' drag events, into the session's (the scene's and the patrol's): a drag level, banked, lost. */
  function fwd() {
    for (let k = FW[0]!; k < st.n; k++) {
      const ty = st.ev[k * 2]!, v = st.ev[k * 2 + 1]!;
      if (ty === ST_DRAG) emit(E_DRAG, v);
      else if (ty === ST_BANK) cop.banked(v), emit(E_BANKED, v);
      else if (ty === ST_LOST) emit(E_LOST, v);
    }
    FW[0] = st.n;
  }
  function bankedNow(type: number) {
    const pts = sc.S[PTS]!;
    emit(type, type === E_TRICK ? sc.S[10]! : 0);
    cop.banked(pts);
    cop.heat(Math.min(HEAT_FROM.trickCap, pts * HEAT_FROM.perPoint));
  }
  /** Neighbours, sprinklers and the dog round the rider. True while any of them moves. */
  function world(dt: number, x: number, z: number, speed: number) {
    let any = false;
    const kind = t.kindAt(x, z), on = sc.S[ON] === 1, inTown = S[TOWN]! >= 0, loud = on || speed > 9 || kind === F_LAWN;
    if (kind === F_LAWN && inTown && S[PH] === RUN && !bike.air) cop.heat(HEAT_FROM.lawn * dt);
    for (let i = 0; i < NNB; i++) {
      const q = NI[i]!, b = i * 4;
      if (q < 0) continue;
      const o = q * IS, ux = SG[o + 3]!, uz = SG[o + 4]!, d = SG[o + 6]!, dx = x - SG[o + 1]!, dz = z - SG[o + 2]!;
      // In front of the house: its local z (towards the road) from its front out 6.9, within 3.4 across.
      const lx = dx * ux + dz * uz, lz = -dx * uz + dz * ux - d / 2, inZone = lx > -3.4 && lx < 3.4 && lz > 0 && lz < 6.9;
      if (NB[b + 2]! > 0) NB[b + 2] = NB[b + 2]! - dt;
      if (NB[b + 1]! > 0) {
        NB[b + 1] = Math.max(0, NB[b + 1]! - dt);
        any = true;
        if (inZone && on && NB[b + 1]! < 2.2 && sc.bonus(F_GRUMP)) emit(E_BONUS, F_GRUMP);
      } else if (inZone && loud && NB[b + 2]! <= 0 && S[PH] === RUN) {
        NB[b + 1] = 2.6; NB[b + 2] = 8; NB[b + 3] = (S[GRUMPS]! * 3 + i) % LINES.length;
        S[GRUMPS] = S[GRUMPS]! + 1;
        if (inTown) cop.heat(HEAT_FROM.grump);
        emit(E_GRUMP, i);
        any = true;
      }
    }
    S[SPCLK] = S[SPCLK]! + dt;
    for (let i = 0; i < NSPK; i++) {
      const q = SPI[i]!;
      if (q < 0) continue;
      const o = q * IS, dx = x - SG[o + 1]!, dz = z - SG[o + 2]!, dd = hypot(dx, dz);
      if (SPK[i * 2 + 1]! > 0) SPK[i * 2 + 1] = SPK[i * 2 + 1]! - dt;
      if (dd > SP_REACH || dd < 0.2 || SPK[i * 2 + 1]! > 0) continue;
      let da = heading(dx, dz) - sprinklerAim(i);
      da -= TAU * Math.floor(da / TAU + 0.5);
      if (Math.abs(da) < 0.45) {
        SPK[i * 2 + 1] = 1.2;
        S[SPLASH] = S[SPLASH]! + 1;
        if (inTown) cop.heat(HEAT_FROM.splash);
        emit(E_SPLASH, i);
        if (sc.bonus(F_SPRINK)) emit(E_BONUS, F_SPRINK);
      }
    }
    any = true;
    // The dog trots along its yard's front fence after the bike and barks when it is close.
    const q = DI[0]!;
    if (q >= 0) {
      const o = q * IS, ux = SG[o + 3]!, uz = SG[o + 4]!, w = SG[o + 5]! / 2 - 0.3, dx = x - SG[o + 1]!, dz = z - SG[o + 2]!, lx = dx * ux + dz * uz, lz = -dx * uz + dz * ux;
      const want = lz < 9 && lz > -4 && lx > -9 && lx < 9 ? Math.max(-w, Math.min(w, lx)) : 0, mv = want - DG[1]!;
      DG[1] = DG[1]! + Math.max(-4 * dt, Math.min(4 * dt, mv));
      if (DG[2]! > 0) DG[2] = Math.max(0, DG[2]! - dt);
      if (DG[3]! > 0) DG[3] = DG[3]! - dt;
      const yz = SG[o + 6]! / 2 - 0.2, ddx = lx - DG[1]!, ddz = lz - yz;
      if (hypot(ddx, ddz) < 5.5 && DG[3]! <= 0 && S[PH] === RUN) (DG[2] = 0.6), (DG[3] = 1.6), (S[BARKS] = S[BARKS]! + 1), inTown && cop.heat(HEAT_FROM.bark), emit(E_BARK, 0);
      if (Math.abs(mv) > 0.01 || DG[2]! > 0) any = true;
    }
    return any;
  }
  /** Where live sprinkler i points now (radians). */
  function sprinklerAim(i: number) {
    const q = SPI[i]!;
    if (q < 0) return 0;
    const look = SG[q * IS + 8]!;
    return look * 0.785 + 1.15 * sin(S[SPCLK]! * 1.3 + look);
  }

  // ---- the autopilot: along the roads, the right half of the road, a wheelie down each straight ----
  /** The nearest point on edge e to (x, z): s along it into AQ[0]. */
  const AQ = new Float64Array(4);
  function along(e: number, x: number, z: number) {
    const o = e * W.EP, P = W.PT;
    let best = 1e18, s = 0;
    for (let k = 0; k < 20; k++) {
      const px = P[o + k * 4]!, pz = P[o + k * 4 + 1]!, ex = P[o + k * 4 + 4]! - px, ez = P[o + k * 4 + 5]! - pz, L = ex * ex + ez * ez;
      let u = L > 0 ? ((x - px) * ex + (z - pz) * ez) / L : 0;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const qx = px + ex * u - x, qz = pz + ez * u - z, d2 = qx * qx + qz * qz;
      if (d2 < best) (best = d2), (s = P[o + k * 4 + 3]! + (P[o + k * 4 + 7]! - P[o + k * 4 + 3]!) * u);
    }
    AQ[0] = s; AQ[1] = Math.sqrt(best);
  }
  /** At the end of the road ridden: the next one out of that junction (never straight back; fleeing: away from the town). */
  function nextRoad(i: number, j: number) {
    W.incident(i, j);
    const m = W.IN[8]!, cur = W.edge(S[AI]!, S[AJ]!, S[AD]!), flee = cop.chasing > 0 || cop.S[STARS]! >= 3;
    let pick = -1, cnt = 0;
    for (let q = 0; q < m; q++) if (W.IN[q * 2] !== cur) cnt++;
    if (!cnt) return;
    if (flee && S[TOWN]! >= 0) {
      // The road whose far end is farthest from the town's junction.
      let bd = -1;
      for (let q = 0; q < m; q++) {
        if (W.IN[q * 2] === cur) continue;
        W.out(q, 40);
        const dx = W.PQ[0]! - HC[0]!, dz = W.PQ[1]! - HC[1]!, dd = dx * dx + dz * dz;
        if (dd > bd) (bd = dd), (pick = q);
      }
    } else {
      let r = (Math.imul(S[AN]! + 1, 0x9e3779b1) ^ Math.imul(seed, 0x85ebca6b)) >>> 8;
      r %= cnt;
      for (let q = 0; q < m; q++) {
        if (W.IN[q * 2] === cur) continue;
        if (r-- === 0) { pick = q; break; }
      }
    }
    const e = W.IN[pick * 2]!, end = W.IN[pick * 2 + 1] === 1;
    // (The slot's own record says which road it is.)
    S[AI] = W.EK[e * 3]!; S[AJ] = W.EK[e * 3 + 1]!; S[AD] = W.EK[e * 3 + 2]!;
    S[AS] = end ? -1 : 1;
    S[AN] = S[AN]! + 1;
  }
  function autopilot(I: Float64Array) {
    const b = bike.b, x = b.pos[0]!, z = b.pos[2]!;
    I[4] = 0;
    let e = W.edge(S[AI]!, S[AJ]!, S[AD]!);
    S[STUCK] = S[PH] === RUN && (b.speed < 0 ? -b.speed : b.speed) < 0.3 ? S[STUCK]! + 1 / 60 : 0;
    along(e, x, z);
    let s = AQ[0]!, L = W.EF[e * 8 + 1]!;
    const dir = S[AS]!, v = b.speed, hw = W.EF[e * 8]!;
    if (S[STUCK]! > 2 || AQ[1]! > 12) {
      // Wedged (it has no reverse) or off its road: back on the road, a little further along (counted).
      const s2 = Math.max(4, Math.min(L - 4, s + dir * 3));
      W.at(e, s2);
      const tx = W.PQ[2]! * dir, tz = W.PQ[3]! * dir, px = W.PQ[0]! - tz * hw * 0.5, pz = W.PQ[1]! + tx * hw * 0.5;
      win.follow(px, pz);
      bike.reset(px, pz, heading(tx, tz));
      regather(px, pz);
      S[STUCK] = 0; S[UNSTUCK] = S[UNSTUCK]! + 1;
      return void (I[0] = I[1] = I[2] = I[3] = 0);
    }
    const look = 5 + v * 0.55;
    if ((dir > 0 && s + look > L - 2) || (dir < 0 && s - look < 2)) {
      // Into the junction at the road's end: on to the next road.
      const si = S[AI]!, sj = S[AJ]!, sd = S[AD]!, ei = dir > 0 ? si + (sd ? 0 : 1) : si, ej = dir > 0 ? sj + (sd ? 1 : 0) : sj;
      if ((dir > 0 && s > L - 3) || (dir < 0 && s < 3)) {
        nextRoad(ei, ej);
        e = W.edge(S[AI]!, S[AJ]!, S[AD]!);
        along(e, x, z);
        s = AQ[0]!; L = W.EF[e * 8 + 1]!;
      }
    }
    const d2 = S[AS]!, hw2 = W.EF[e * 8]!, st = Math.max(0, Math.min(L, s + d2 * look));
    W.at(e, st);
    const tx = W.PQ[2]! * d2, tz = W.PQ[3]! * d2, ax = W.PQ[0]! - tz * hw2 * 0.5, az = W.PQ[1]! + tx * hw2 * 0.5;
    // The bend coming: the road's heading here against 14 on (and the junction counts as a bend).
    W.at(e, Math.max(0, Math.min(L, s + d2 * 16)));
    const bend = tx * W.PQ[2]! * d2 + tz * W.PQ[3]! * d2 < 0.95 || (d2 > 0 ? L - s : s) < 14;
    const flee = (cop.chasing > 0 && cop.S[NEAR]! < 24) || cop.S[STARS]! >= 3;
    let err = heading(ax - x, az - z) - b.yaw;
    err -= TAU * Math.floor(err / TAU + 0.5);
    const th = bike.nose, up = th > 0.06;
    I[3] = Math.max(-1, Math.min(1, -err * (up ? 3.4 : 2.4)));
    if (flee) {
      I[0] = v < (bend ? 4.5 : 8.5) && Math.abs(err) < 1.2 ? 1 : v < 2 ? 0.6 : 0;
      I[1] = v > 5.5 && bend ? 0.6 : 0;
      I[2] = up ? 1 : 0.5;
      return;
    }
    if (v > 11.5 || (v > 6.5 && bend)) {
      I[0] = 0; I[1] = up ? 0.4 : 0.7; I[2] = up ? 1 : 0;
      return;
    }
    const straight = Math.abs(err) < 0.3 && !bend, goal = bike.balance - AP[0]!, om = b.S[3]!, eb = goal - th;
    if (straight && v > 2.5) {
      const want = Math.max(-AP[3]!, Math.min(AP[3]!, eb * AP[2]!)), er = want - om, vt = AP[7]!;
      I[0] = Math.max(0, Math.min(1, AP[1]! + er * AP[4]! + (vt - v) * AP[5]!));
      I[2] = Math.max(-1, Math.min(1, -er * AP[6]!));
      I[1] = er < -AP[8]! || v > vt + 2 ? Math.min(1, (-er - AP[8]!) * AP[9]! + (v > vt + 2 ? 0.3 : 0)) : 0;
      if (I[1]! < 0) I[1] = 0;
    } else if (up) {
      I[0] = 0; I[1] = 0.3; I[2] = 1;
    } else {
      I[0] = v < (bend ? 4.5 : 6.5) ? 0.7 : 0;
      I[1] = v > 5.5 && bend ? 0.6 : 0;
      I[2] = 0.3;
    }
  }
  reset(0);
  const u8 = (a: Float64Array | Uint32Array) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const bytes = [u8(S), u8(NB), u8(SPK), u8(DG), ...st.bytes, u8(GC), u8(ES), u8(sc.S), u8(cop.S), u8(cop.P), u8(cop.R), u8(bike.R), u8(bike.vel), u8(U.S), u8(U.R), u8(US), ...bike.all.map((bb) => bb.state)];
  return {
    S, ev, bike, sc, st, cop, NB, NI, SPK, SPI, DG, DI, HD, bytes, unstuck: U, world: W, win, HC, SG, ES,
    get sn() { return sn; },
    /** How far from the start (world units), the furthest so far. */
    get far() { return ES[2]!; },
    get towns() { return S[TOWNS]!; },
    get inTown() { return S[TOWN]! >= 0; },
    get stuck() { return US[0] === 1; },
    get n() { return n; },
    clear() { n = 0; st.clear(); FW[0] = 0; },
    step, reset, autopilot, sprinklerAim, streetClear,
    choose(i: number) { reset(i); },
    /** Put the bike down at world (x, z) facing yaw (a test, a harness); the autopilot takes the nearest road. */
    place(x: number, z: number, yaw: number) {
      win.follow(x, z);
      bike.reset(x, z, yaw);
      regather(x, z);
      towns(x, z);
      W.roadQ(x, z);
      const e = W.RQ[4]!;
      if (e >= 0) {
        S[AI] = W.EK[e * 3]!; S[AJ] = W.EK[e * 3 + 1]!; S[AD] = W.EK[e * 3 + 2]!;
        S[AS] = cos(yaw) * W.RQ[7]! - sin(yaw) * W.RQ[8]! >= 0 ? 1 : -1;
      }
    },
  };
}
export type OpenRun = ReturnType<typeof openRun>;
