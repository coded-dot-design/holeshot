// Stunts, headless: the tricks every endless mode scores on top of the ground tricks
// (./wheelie/tricks.ts: wheelies, manuals, hops, stoppies and their combo), the same in the ENDLESS
// grounds and Endless Wheelie City:
// - The drag ladder past 12 o'clock on the rear wheel: held past 12 HAND_T s the rider drops a hand
//   to the road (HAND DRAG ×10); held DOUBLE_T s more, both hands (DOUBLE HAND DRAG ×20); leaned on
//   to about 2 o'clock (FENDER_AT) the rear fender is on the road, throwing sparks (FENDER DRAG ×40,
//   the bike's loop-out is just past it at FENDER_LOOP). The points are at risk until the nose comes
//   back under 12 (banked) and gone on a loop-out (lost).
// - The whip: left or right in the air kicks the bike sideways; back to straight it counts (chain
//   them: each whip in a jump is worth more). Landing still kicked out is a crash.
// - The combo button: named rider tricks, held for points (the longer held, the more). Each press in
//   a chain does the next, more advanced trick; after the fourth they come at random (seeded). On the
//   ground it pays ×1, in a wheelie ×2, in the air ×3 (banked on a clean landing; still out at the
//   landing it is a bail: the bike's own `trick` input).
// Its own event ring (`ev`, `n`, `clear`); the mode forwards what it needs. Deterministic, zero
// allocation per step; the state is typed arrays (`bytes`).
import type { Bike } from "../bike/bike.ts";
import { SC, CB, GAP, COUNT, TOP, ON, MAXCB, type Tricks } from "./wheelie/tricks.ts";
import { HAND_T, DRAG_RATE, DRAG_X, STREAK } from "./wheelie/rules.ts";

/** The clock face (radians of the nose off the ground): 12 o'clock is vertical; the fender is on the
 *  road from FENDER_AT (about half past 1) and it loops out past FENDER_LOOP (about a quarter past 2). */
export const TWELVE = 1.5707963267948966, FENDER_AT = TWELVE + 0.68, FENDER_LOOP = TWELVE + 0.98;
/** The double hand drag: after DOUBLE_T s of hand drag, ×DOUBLE_X; the fender drag ×FENDER_X. */
export const DOUBLE_T = 1.5, DOUBLE_X = 20, FENDER_X = 40;
/** The fender on the road: how hard it props the bike up (rad/s² per radian past FENDER_AT), how much
 *  speed it scrubs (1/s). The rear brake past the balance point (the rider's weight over the bars). */
export const FENDER_K = 70, FENDER_SCRUB = 0.35, PAST_BRAKE = 14;
/** The whip: how fast it kicks out and comes back (1/s), out past WHIP_OUT counts once back under
 *  WHIP_IN, landed past WHIP_SAFE is a crash; points per whip (× its place in the jump's chain). */
export const WHIP_RATE = 4, WHIP_BACK = 5, WHIP_OUT = 0.7, WHIP_IN = 0.2, WHIP_SAFE = 0.3, WHIP_PTS = 150;
/** Drag levels. */
export const HAND = 1, DOUBLE = 2, FENDER = 3;
export const DRAG_NAME = ["", "HAND DRAG", "DOUBLE HAND DRAG", "FENDER DRAG"], DRAG_MULT = [0, DRAG_X, DOUBLE_X, FENDER_X];

/** The combo button's tricks (original names; the riding terms are common words), easiest first. */
export const COMBOS = ["SEAT TAP", "KNEE KNOCKER", "SIDE KICK", "CAN-CAN", "NAC-NAC", "HEEL CLICKER", "SKY DIVER", "STARFISH"];
/** Points for each: on the way out, and per second held (up to HOLD_CAP s). */
const BASE = [120, 160, 200, 260, 320, 380, 450, 520], PER = [80, 100, 120, 150, 180, 210, 250, 280];
export const HOLD_CAP = 4, MIN_HOLD = 0.2, CHAIN_GAP = 3, LADDER = 4, MIN_SPEED = 3;
/** Where a combo trick was done: its pay ×. */
export const ON_GROUND = 0, IN_WHEELIE = 1, IN_AIR = 2;
const WHERE_X = [1, 2, 3];
/** Each trick's rider pose (rig TRICK_POSE order: hands off, feet off, spread, back, up off the seat,
 *  twist, arms spread, tuck). */
const POSE = [
  0, 0, 0, 0, 0.75, 0, 0, 0.1,
  0, 0, 0.15, 0, 0.35, 0, 0, 0.85,
  0, 0.1, 0.85, 0, 0.3, 0, 0, 0,
  0, 0.35, 0.6, 0, 0.45, 0.2, 0, 0,
  0, 0.6, 0.65, 0.1, 0.5, 0.35, 0, 0,
  0.25, 0, 0.3, 0, 0.5, 0, 0.3, 1,
  0, 1, 0.1, 0.55, 0.4, 0, 0, 0,
  1, 0.5, 1, 0, 0.55, 0, 1, 0,
];

/** Events: a drag level reached (value: HAND, DOUBLE, FENDER), banked (points; `lastLevel`), lost
 *  (points); a combo trick out (its id), done (points: banked on the ground, pending in the air), a
 *  whip (its count in the jump), the air's tricks banked on a clean landing (points), landed whipped. */
export const ST_DRAG = 1, ST_BANK = 2, ST_LOST = 3, ST_TRICK = 4, ST_DONE = 5, ST_WHIP = 6, ST_LANDED = 7, ST_WHIPCRASH = 8;
/** `step` returns CRASH when the bike landed still whipped (the mode knocks it over). */
export const OK = 0, CRASH = 1;

/** Past 12 on the rear wheel, after the bike's step: the rear brake past the balance point has
 *  PAST_BRAKE more say (feathered it holds the nose up there; let off, it keeps going over: it is not
 *  stable, it drifts towards the loop-out), and from FENDER_AT the fender props it (stiff, not a stand:
 *  on the gas it still goes over) and scrubs speed. True while the fender is on the road. */
export function assist(b: Bike, brake: number, dt: number) {
  if (b.crashed || !b.contact[0] || b.contact[1]) return false;
  const rel = b.rel;
  if (rel > b.bp && brake > 0) b.S[3] = b.S[3]! - brake * PAST_BRAKE * dt;
  if (rel <= FENDER_AT) return false;
  const w = b.S[3]!;
  b.S[3] = w - (FENDER_K * (rel - FENDER_AT) + (w > 0 ? 2 * w : 0)) * dt;
  b.S[5] = b.S[5]! * (1 - FENDER_SCRUB * dt);
  return true;
}

export function stunts(sc: Tricks, seed = 1) {
  // HD: the drag: seconds past 12 (charging), level now (0 none), points pending, seconds dragging,
  // seconds at the hand drag, top level, the last banked one's top level, the fender on the road (0/1).
  const HD = new Float64Array(8);
  // WH: the whip: angle (−1..1, + right), out (−1, 0, 1), whips this jump, the air's pending points, in the air (0/1).
  const WH = new Float64Array(5);
  // CO: the combo button: the input last step, the trick out (−1 none), seconds held, the chain's
  // count, seconds since the last trick, how far out (0..1), the last trick's points and where.
  const CO = new Float64Array(8);
  const RNG = new Uint32Array(1);
  // BAR: a wheelie bar's drag multiplier (0: no bar). It caps every drag level's multiplier, and with
  // it the fender never reaches the road (the bar holds the nose short of it): ../model/tune.ts `bar`.
  const BAR = new Float64Array(1);
  /** A drag level's multiplier on this bike (capped by a wheelie bar). */
  const mult = (lv: number) => (BAR[0]! > 0 ? Math.min(DRAG_MULT[lv]!, BAR[0]!) : DRAG_MULT[lv]!);
  const ev = new Float64Array(32), NE = new Uint8Array(1);
  const S = sc.S;
  const emit = (type: number, v: number) => void (NE[0]! < 16 && ((ev[NE[0]! * 2] = type), (ev[NE[0]! * 2 + 1] = v), (NE[0] = NE[0]! + 1)));
  function reset() {
    HD.fill(0); WH.fill(0); CO.fill(0); CO[1] = -1;
    RNG[0] = (seed * 2654435761) >>> 0 || 1;
    NE[0] = 0;
  }
  reset();
  /** Into the score with the combo (banking a trick bumps it). */
  function bank(pts: number) {
    if (S[GAP]! <= 2.5 && S[COUNT]! > 0) S[CB] = Math.min(MAXCB, S[CB]! + 1);
    S[SC] = S[SC]! + pts;
    S[TOP] = Math.max(S[TOP]!, S[CB]!);
    S[COUNT] = S[COUNT]! + 1;
    S[GAP] = 0;
  }
  /** One step, after the bike's: `live` the session is on; `steer` the stick (the whip in the air);
   *  `combo` the combo button (0/1). Returns CRASH if it landed whipped. */
  function step(dt: number, b: Bike, live: boolean, steer: number, combo: number) {
    const air = !b.crashed && !b.contact[0] && !b.contact[1];
    let out = OK;
    if (!live || b.crashed) {
      CO[0] = combo;
      return OK;
    }
    HD[7] = !air && !BAR[0] && b.contact[0] === 1 && b.contact[1] === 0 && b.rel > FENDER_AT ? 1 : 0;
    drag(dt, b, air);
    // The whip.
    const was = WH[4] === 1;
    if (air) {
      const st = steer > 0.3 ? 1 : steer < -0.3 ? -1 : 0, a = WH[0]!;
      if (st) WH[0] = Math.max(-1, Math.min(1, a + st * WHIP_RATE * dt));
      else WH[0] = a > 0 ? Math.max(0, a - WHIP_BACK * dt) : Math.min(0, a + WHIP_BACK * dt);
      const w = WH[0]!, aw = w < 0 ? -w : w;
      if (aw >= WHIP_OUT) WH[1] = w > 0 ? 1 : -1;
      else if (aw <= WHIP_IN && WH[1] !== 0) (WH[1] = 0), (WH[2] = WH[2]! + 1), (WH[3] = WH[3]! + WHIP_PTS * WH[2]!), emit(ST_WHIP, WH[2]!);
      WH[4] = 1;
    } else {
      if (was) {
        const w = WH[0]!;
        if ((w < 0 ? -w : w) > WHIP_SAFE) (out = CRASH), emit(ST_WHIPCRASH, 0);
        else {
          // A combo trick still out: the bike's trick input bails it; tucked back in time, it counts.
          if (CO[1]! >= 0 && CO[5]! < 0.35) done(IN_AIR);
          if (WH[3]! > 0) {
            const pts = Math.round(WH[3]!) * (1 + S[CB]!);
            bank(pts);
            emit(ST_LANDED, pts);
          }
        }
        WH[2] = WH[3] = 0; WH[1] = 0;
      }
      WH[0] = WH[0]! * Math.max(0, 1 - 10 * dt);
      WH[4] = 0;
    }
    // The combo button.
    CO[4] = CO[4]! + dt;
    if (CO[4]! > CHAIN_GAP && CO[1]! < 0) CO[3] = 0;
    const press = combo > 0 && CO[0]! === 0, speed = b.speed < 0 ? -b.speed : b.speed;
    CO[0] = combo;
    if (press && CO[1]! < 0 && HD[1] === 0 && (air || speed > MIN_SPEED)) {
      const n = CO[3]!;
      let id = n;
      if (n >= LADDER) {
        RNG[0] = (Math.imul(RNG[0]!, 1664525) + 1013904223) >>> 0;
        id = RNG[0]! % COMBOS.length;
        if (id === CO[6]) id = (id + 1 + (RNG[0]! >>> 16) % (COMBOS.length - 1)) % COMBOS.length;
      }
      CO[1] = id; CO[2] = 0; CO[6] = id;
      emit(ST_TRICK, id);
    }
    if (CO[1]! >= 0) {
      if (combo > 0) CO[2] = CO[2]! + dt;
      CO[5] = Math.min(1, CO[5]! + (combo > 0 ? 6 : -6) * dt);
      if (combo <= 0 && CO[5]! <= 0) {
        CO[5] = 0;
        done(air ? IN_AIR : S[ON] ? IN_WHEELIE : ON_GROUND);
      }
    }
    return out;
  }
  /** The combo trick ends: its points (pending in the air, else banked). */
  function done(where: number) {
    const id = CO[1]!, held = CO[2]!;
    CO[1] = -1; CO[5] = 0;
    if (held < MIN_HOLD) return void emit(ST_DONE, 0);
    const pts = Math.round((BASE[id]! + PER[id]! * Math.min(HOLD_CAP, held)) * (1 + 0.25 * Math.min(8, CO[3]!)) * WHERE_X[where]!);
    CO[3] = CO[3]! + 1; CO[4] = 0; CO[7] = pts;
    if (where === IN_AIR && WH[4] === 1) (WH[3] = WH[3]! + pts), emit(ST_DONE, pts);
    else {
      const p = pts * (1 + S[CB]!);
      bank(p);
      CO[7] = p;
      emit(ST_DONE, p);
    }
  }
  /** The drag ladder. */
  function drag(dt: number, b: Bike, air: boolean) {
    const nose = b.rel, past = !air && b.contact[0] === 1 && b.contact[1] === 0 && nose > TWELVE;
    if (past) {
      HD[0] = HD[0]! + dt;
      let lv = HD[1]!;
      if (nose >= FENDER_AT && !BAR[0]) lv = FENDER;
      else if (lv === FENDER) lv = HD[4]! >= DOUBLE_T ? DOUBLE : HAND;
      else if (!lv && HD[0]! >= HAND_T) (lv = HAND), (HD[3] = 0), (HD[4] = 0);
      if (lv && lv !== FENDER) {
        HD[4] = HD[4]! + dt;
        if (HD[4]! >= DOUBLE_T) lv = DOUBLE;
      }
      HD[1] = lv;
      if (lv > HD[5]!) (HD[5] = lv), emit(ST_DRAG, lv);
      if (lv) (HD[3] = HD[3]! + dt), (HD[2] = HD[2]! + DRAG_RATE * mult(lv) * (1 + S[CB]!) * dt);
      return;
    }
    if (HD[1]) {
      const pts = Math.round(HD[2]! + STREAK * HD[3]! * HD[3]!);
      S[SC] = S[SC]! + pts;
      S[CB] = Math.min(MAXCB, S[CB]! + 1);
      S[TOP] = Math.max(S[TOP]!, S[CB]!);
      S[GAP] = 0;
      HD[6] = HD[5]!;
      HD.fill(0, 0, 6);
      emit(ST_BANK, pts);
      return;
    }
    HD[0] = 0;
  }
  /** A crash (any): the drag's and the air's points are lost, the combo trick and the chain are gone. */
  function lose() {
    const p = HD[1] || HD[2]! > 0 ? Math.round(HD[2]!) : 0;
    if (p > 0 || HD[1]) emit(ST_LOST, p);
    HD.fill(0, 0, 6); HD[7] = 0;
    WH[0] = WH[1] = WH[2] = WH[3] = WH[4] = 0;
    CO[1] = -1; CO[2] = CO[3] = CO[5] = 0;
  }
  /** The rider's pose for the rig (`T`, rig TRICK_POSE): the combo trick out, the drag (`drag` 0..1,
   *  eased by the scene; both hands at the double and the fender drag). */
  function pose(T: Float64Array, drag: number) {
    const id = CO[1]!, a = CO[5]!;
    for (let k = 0; k < 8; k++) T[k] = id >= 0 ? POSE[id * 8 + k]! * a : 0;
    T[8] = drag;
    if (T.length > 9) T[9] = HD[1]! >= DOUBLE ? drag : 0;
    if (HD[1] === FENDER) T[3] = Math.max(T[3]!, 0.6 * drag);
  }
  return {
    HD, WH, CO, ev, reset, step, lose, pose, mult,
    /** The bike's wheelie bar (its drag multiplier, `tuned.bar.dragX`), or none (0 / null). */
    bar(dragX: number | null | undefined) { BAR[0] = dragX ?? 0; },
    bytes: [HD, WH, CO, RNG, NE].map((x) => new Uint8Array(x.buffer, x.byteOffset, x.byteLength)),
    get n() { return NE[0]!; },
    clear() { NE[0] = 0; },
    /** The combo trick out (−1 none) and how far (0..1: the bike's trick input). */
    get trick() { return CO[1]!; },
    get amount() { return CO[5]!; },
    /** The whip's angle (−1..1). */
    get whip() { return WH[0]!; },
    /** The fender on the road (sparks). */
    get fender() { return HD[7] === 1; },
    /** The last banked drag's top level. */
    get lastLevel() { return HD[6]!; },
  };
}
export type Stunts = ReturnType<typeof stunts>;
