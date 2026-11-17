// Wheelie City's neon patrol, headless: the heat meter and the patrol units that come after a rider
// who stunts too loud. Comic and fictional: units with lights and a siren, no weapons; a catch is a
// TICKET (the combo and half the points at risk), never a fall.
// - Heat (0..100, five stars) rises from what the town hears (the city calls `heat(amount)`: a
//   neighbour out shouting, a sprinkler run, a lawn ridden, a big trick banked) and cools after a
//   few seconds clean, unless a unit has the rider in sight. Points banked while the heat is on are
//   "at risk" (`S[HOT]`): cool off, or escape, and they are safe.
// - Units: from one star a patrol bike, then a cart, a drone, another bike (`UNITS` by stars). They
//   spawn at a junction of the rider's hood well away from the rider (picked by the seeded roll) and
//   path on the hood's street graph (./hoods.ts `GRAPH`: all-pairs next hops) to the street the rider
//   is on, then straight at the rider; the drone flies straight. Within CATCH of a rider who is on
//   the ground: a ticket.
// - A hump into another hood loses them (`escape`): they can't follow; the units peel off, the heat
//   drops fast and the escape pays.
// Deterministic: seeded xorshift, ../../math.ts's sine, cosine and arctangent, the state in typed
// arrays (S, P, R: ready for a snapshot). Zero allocation per step.
import { GRAPH, CX, CZ, HX, HZ } from "./hoods.ts";
import { sin, cos, atan2 } from "../../math.ts";

const TAU = 6.283185307179586;
const sq = (v: number) => v * v;
/** S: heat, stars, seconds clean, grace after a ticket, points at risk, escapes, tickets, spawn timer,
 *  fast cool after an escape, seconds of this chase, points lost to tickets, escape points, nearest unit. */
export const HEAT = 0, STARS = 1, CALM = 2, GRACE = 3, HOT = 4, ESC = 5, TIX = 6, SPAWN = 7, FAST = 8, CHASE = 9, LOST = 10, BONUS = 11, NEAR = 12;
/** Patrols: state (0 off, 1 chasing, 2 peeling off), kind, x, z, yaw, speed, from node, to node, age, hood, fade, straight at the rider. */
export const MAXP = 4, PS = 12;
export const P_ON = 0, P_KIND = 1, P_X = 2, P_Z = 3, P_YAW = 4, P_V = 5, P_FROM = 6, P_TO = 7, P_AGE = 8, P_HOOD = 9, P_FADE = 10, P_DIRECT = 11;
/** Kinds: a patrol bike, a cart, a drone. */
export const U_BIKE = 0, U_CART = 1, U_DRONE = 2;
/** Events: stars changed (value: stars), a unit is out (kind), a ticket (points lost), an escape
 *  (points), lost them by cooling off (points made safe). */
export const C_STARS = 1, C_UNIT = 2, C_TICKET = 3, C_ESCAPE = 4, C_CLEAR = 5;
/** The tuning: units out by stars, their order, top speed and turn rate by kind, how close is a
 *  catch, how close sees the rider, how near goes straight for the rider, the cool-down. */
export const UNITS = [0, 1, 1, 2, 3, 4], ORDER = [U_BIKE, U_CART, U_DRONE, U_BIKE];
export const VMAX = [7.4, 6.2, 5.4], TURN = [3.8, 2.8, 4.5];
export const CATCH = 0.95, SIGHT = 10, DIRECT = 5.5, SPAWN_GAP = 1.6, COOL_AFTER = 3.5, COOL = 6, TICKET_SHARE = 0.5, GRACE_T = 5, ESCAPE_PTS = 150;

/** Heading from (dx, dz) in the bike's convention (forward is (cos, −sin)): atan2(−dz, dx), from ../../math.ts (the same bits on every engine). */
export const heading = (dx: number, dz: number) => atan2(-dz, dx);

/** The hoods' centres (x, z per hood) on the fixed table; Endless Wheelie City passes its own, moved
 *  to the slot each hood kind is in (./city.ts). */
export const FIXED_C = Float64Array.from([CX[0]!, CZ[0]!, CX[1]!, CZ[1]!, CX[2]!, CZ[2]!, CX[3]!, CZ[3]!]);
export function cops(seed = 1, HC: Float64Array = FIXED_C) {
  const S = new Float64Array(13), P = new Float64Array(MAXP * PS), R = new Uint32Array(1);
  const ev = new Float64Array(16);
  // E: the rider's street (nearest edge's ends and their distances), scratch.
  const E = new Float64Array(4);
  let n = 0;
  function emit(t: number, v: number) {
    if (n < 8) (ev[n * 2] = t), (ev[n * 2 + 1] = v), n++;
  }
  function roll() {
    let x = R[0]!;
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    R[0] = x || 0x9e3779b9;
    return R[0]! / 4294967296;
  }
  function reset(s = seed) {
    S.fill(0); P.fill(0);
    R[0] = (s ^ 0x2545f491) >>> 0 || 1;
    n = 0;
  }
  /** Add heat (a neighbour shouting, a sprinkler, a lawn, a trick). */
  function heat(v: number) {
    if (S[GRACE]! > 0 || v <= 0) return;
    S[HEAT] = Math.min(100, S[HEAT]! + v);
    S[CALM] = 0;
    stars();
  }
  function stars() {
    const s = Math.min(5, Math.floor((S[HEAT]! + 5) / 20));
    if (s !== S[STARS]) (S[STARS] = s), emit(C_STARS, s);
  }
  /** Points banked: at risk while the heat is on. */
  function banked(pts: number) {
    if (S[HEAT]! > 0) S[HOT] = S[HOT]! + pts;
  }
  const active = () => {
    let k = 0;
    for (let i = 0; i < MAXP; i++) if (P[i * PS + P_ON] === 1) k++;
    return k;
  };
  function peel() {
    for (let i = 0; i < MAXP; i++) if (P[i * PS + P_ON] === 1) (P[i * PS + P_ON] = 2), (P[i * PS + P_FADE] = 0);
  }
  /** Over a hump into another hood: they can't follow. Returns the escape's points (0: nobody was chasing). */
  function escape() {
    const chased = active() > 0;
    peel();
    S[CHASE] = 0;
    if (!chased) {
      S[HEAT] = S[HEAT]! * 0.4;
      stars();
      return 0;
    }
    const pts = ESCAPE_PTS * Math.max(1, S[STARS]!);
    S[ESC] = S[ESC]! + 1;
    S[BONUS] = S[BONUS]! + pts;
    S[HOT] = 0;
    S[HEAT] = Math.min(S[HEAT]!, 8);
    S[FAST] = 2;
    stars();
    emit(C_ESCAPE, pts);
    return pts;
  }
  function ticket() {
    const lost = Math.round(S[HOT]! * TICKET_SHARE);
    S[TIX] = S[TIX]! + 1;
    S[LOST] = S[LOST]! + lost;
    S[HOT] = 0; S[HEAT] = 0; S[GRACE] = GRACE_T; S[CHASE] = 0;
    peel();
    stars();
    emit(C_TICKET, lost);
  }
  /** The rider's street: the graph edge nearest (lx, lz) in hood h, into E (its ends and their distances). */
  function street(h: number, lx: number, lz: number) {
    const g = GRAPH[h]!, N = g.nodes, Ed = g.edges;
    let best = 1e18;
    for (let o = 0; o < Ed.length; o += 2) {
      const a = Ed[o]!, b = Ed[o + 1]!, ax = N[a * 2]!, az = N[a * 2 + 1]!, ex = N[b * 2]! - ax, ez = N[b * 2 + 1]! - az, L = ex * ex + ez * ez;
      let t = L > 0 ? ((lx - ax) * ex + (lz - az) * ez) / L : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = ax + ex * t - lx, dz = az + ez * t - lz, d = dx * dx + dz * dz;
      if (d < best) (best = d), (E[0] = a), (E[1] = b);
    }
    const a = E[0]!, b = E[1]!;
    E[2] = Math.sqrt(sq(N[a * 2]! - lx) + sq(N[a * 2 + 1]! - lz));
    E[3] = Math.sqrt(sq(N[b * 2]! - lx) + sq(N[b * 2 + 1]! - lz));
  }
  function spawn(h: number, lx: number, lz: number) {
    const k = active();
    let slot = -1;
    for (let i = 0; i < MAXP; i++) if (P[i * PS + P_ON] === 0) { slot = i; break; }
    if (slot < 0) return;
    const g = GRAPH[h]!, N = g.nodes;
    // A junction well away from the rider (the roll picks among them), else the farthest.
    let far = 0, fd = -1, cnt = 0;
    for (let i = 0; i < g.n; i++) {
      const d = Math.sqrt(sq(N[i * 2]! - lx) + sq(N[i * 2 + 1]! - lz));
      if (d > fd) (fd = d), (far = i);
      if (d > 15 && d < 60) cnt++;
    }
    let pick = far;
    if (cnt) {
      let r = Math.floor(roll() * cnt);
      for (let i = 0; i < g.n; i++) {
        const d = Math.sqrt(sq(N[i * 2]! - lx) + sq(N[i * 2 + 1]! - lz));
        if (d > 15 && d < 60 && r-- === 0) { pick = i; break; }
      }
    }
    const o = slot * PS, kind = ORDER[k]!;
    P[o + P_ON] = 1; P[o + P_KIND] = kind; P[o + P_X] = N[pick * 2]! + HC[h * 2]!; P[o + P_Z] = N[pick * 2 + 1]! + HC[h * 2 + 1]!;
    P[o + P_YAW] = heading(lx - N[pick * 2]!, lz - N[pick * 2 + 1]!); P[o + P_V] = 0;
    P[o + P_FROM] = P[o + P_TO] = pick; P[o + P_AGE] = 0; P[o + P_HOOD] = h; P[o + P_FADE] = 0; P[o + P_DIRECT] = 0;
    emit(C_UNIT, kind);
  }
  /** One step: the rider at (x, z) in hood h; `air` over a hump (out of reach); `live` while the
   *  session runs. True while anything moves. */
  function step(dt: number, x: number, z: number, h: number, air: boolean, live: boolean) {
    let moving = false;
    if (S[GRACE]! > 0) S[GRACE] = Math.max(0, S[GRACE]! - dt);
    if (S[FAST]! > 0) S[FAST] = Math.max(0, S[FAST]! - dt);
    S[CALM] = S[CALM]! + dt;
    const lx = x - HC[h * 2]!, lz = z - HC[h * 2 + 1]!;
    // The nearest unit (for the HUD, and whether the rider is in sight).
    let near = 1e9;
    for (let i = 0; i < MAXP; i++) {
      const o = i * PS;
      if (P[o + P_ON] !== 1) continue;
      const d = Math.sqrt(sq(P[o + P_X]! - x) + sq(P[o + P_Z]! - z));
      if (d < near) near = d;
    }
    S[NEAR] = near;
    if (!live) {
      if (active()) peel();
    } else {
      if (active()) S[CHASE] = S[CHASE]! + dt;
      // Cooling: a few seconds clean and out of sight; fast after an escape.
      if (S[HEAT]! > 0 && ((S[CALM]! > COOL_AFTER && near > SIGHT) || S[FAST]! > 0)) {
        S[HEAT] = Math.max(0, S[HEAT]! - (S[FAST]! > 0 ? 30 : COOL) * dt);
        if (S[HEAT] === 0) {
          if (S[HOT]! > 0 || active()) emit(C_CLEAR, S[HOT]!);
          S[HOT] = 0; S[CHASE] = 0;
          peel();
        }
        stars();
      }
      // More units as the stars climb (one at a time).
      if (S[SPAWN]! > 0) S[SPAWN] = S[SPAWN]! - dt;
      else if (!air && active() < UNITS[S[STARS]!]!) (spawn(h, lx, lz), (S[SPAWN] = SPAWN_GAP));
      if (active()) street(h, lx, lz);
    }
    for (let i = 0; i < MAXP; i++) {
      const o = i * PS, on = P[o + P_ON]!;
      if (on === 0) continue;
      moving = true;
      if (on === 1 && P[o + P_HOOD] !== h) (P[o + P_ON] = 2), (P[o + P_FADE] = 0);
      if (on === 1 && air) {
        // The rider is over the canal: it brakes at the edge (the landing decides).
        P[o + P_V] = Math.max(0, P[o + P_V]! - 8 * dt);
        continue;
      }
      if (P[o + P_ON] === 2) {
        // Peeling off: it slows to a stop with its lights going and fades.
        P[o + P_FADE] = P[o + P_FADE]! + dt;
        P[o + P_V] = Math.max(0, P[o + P_V]! - 6 * dt);
        P[o + P_X] = P[o + P_X]! + cos(P[o + P_YAW]!) * P[o + P_V]! * dt;
        P[o + P_Z] = P[o + P_Z]! - sin(P[o + P_YAW]!) * P[o + P_V]! * dt;
        if (P[o + P_FADE]! > 1.4) P[o + P_ON] = 0;
        continue;
      }
      chase(o, h, x, z, lx, lz, dt);
      if (S[GRACE] === 0 && !air && P[o + P_AGE]! > 1 && Math.sqrt(sq(P[o + P_X]! - x) + sq(P[o + P_Z]! - z)) < CATCH) {
        ticket();
        break;
      }
    }
    return moving || (live && S[HEAT]! > 0);
  }
  /** One unit after the rider: along the graph to the rider's street, then straight at the rider. */
  function chase(o: number, h: number, x: number, z: number, lx: number, lz: number, dt: number) {
    const g = GRAPH[h]!, N = g.nodes, kind = P[o + P_KIND]!, cx = HC[h * 2]!, cz = HC[h * 2 + 1]!;
    P[o + P_AGE] = P[o + P_AGE]! + dt;
    const px = P[o + P_X]!, pz = P[o + P_Z]!, d = Math.sqrt(sq(px - x) + sq(pz - z));
    let tx = x, tz = z;
    // Straight at the rider: a drone, close, or on the rider's street (from one of its ends).
    const street = P[o + P_FROM] === E[0] || P[o + P_FROM] === E[1];
    if (kind === U_DRONE || d < DIRECT || (P[o + P_DIRECT] === 1 && street)) P[o + P_DIRECT] = 1;
    else {
      if (P[o + P_DIRECT] === 1) {
        // Lost the line: back to the nearest junction.
        let b = 0, bd = 1e18;
        for (let i = 0; i < g.n; i++) {
          const dd = sq(N[i * 2]! + cx - px) + sq(N[i * 2 + 1]! + cz - pz);
          if (dd < bd) (bd = dd), (b = i);
        }
        P[o + P_DIRECT] = 0; P[o + P_FROM] = P[o + P_TO] = b;
      }
      let to = P[o + P_TO]!;
      if (sq(N[to * 2]! + cx - px) + sq(N[to * 2 + 1]! + cz - pz) < 0.8 * 0.8) {
        const from = (P[o + P_FROM] = to), a = E[0]!, b = E[1]!;
        if (from === a || from === b) P[o + P_DIRECT] = 1;
        else {
          const goal = g.D[from * g.n + a]! + E[2]! <= g.D[from * g.n + b]! + E[3]! ? a : b;
          to = P[o + P_TO] = g.NX[from * g.n + goal]!;
        }
      }
      if (P[o + P_DIRECT] !== 1) (tx = N[to * 2]! + cx), (tz = N[to * 2 + 1]! + cz);
    }
    const want = heading(tx - px, tz - pz);
    let err = want - P[o + P_YAW]!;
    err -= TAU * Math.floor(err / TAU + 0.5);
    const tr = TURN[kind]! * dt, ae = err < 0 ? -err : err;
    P[o + P_YAW] = P[o + P_YAW]! + (err > tr ? tr : err < -tr ? -tr : err);
    let vt = VMAX[kind]! * (ae > 1.2 ? 0.35 : 1 - ae * 0.45);
    if (P[o + P_DIRECT] === 1 && d < 2.5) vt = Math.min(vt, 1.2 + d * 2);
    const dv = vt - P[o + P_V]!, acc = 7 * dt;
    P[o + P_V] = P[o + P_V]! + (dv > acc ? acc : dv < -acc * 2 ? -acc * 2 : dv);
    const yaw = P[o + P_YAW]!;
    let nx = px + cos(yaw) * P[o + P_V]! * dt, nz = pz - sin(yaw) * P[o + P_V]! * dt;
    nx = Math.max(cx - HX + 0.6, Math.min(cx + HX - 0.6, nx));
    nz = Math.max(cz - HZ + 0.6, Math.min(cz + HZ - 0.6, nz));
    P[o + P_X] = nx; P[o + P_Z] = nz;
  }
  reset(seed);
  return {
    S, P, R, ev,
    get n() { return n; },
    clear() { n = 0; },
    reset, heat, banked, escape, step, active, roll,
    /** Units chasing now. */
    get chasing() { return active(); },
  };
}
export type Cops = ReturnType<typeof cops>;
