// Big Air's freestyle tricks, headless: the trick ladder, the whip and the scorer (it knows nothing
// about bikes, only the air, the button, the stick and how the landing went). Controlled like the
// endless rides' stunts (../stunts.ts): in the air the TRICK button (C, the gamepad's combo button,
// the rocker's slide-out TRICK) throws the next trick up the ladder; a tap shows it, held it stays
// out for more points; let go, the rider gets back on. Tap again for the next trick (several in one
// jump: each one in the same jump is worth more). Stick left or right in the air kicks the bike into
// a whip; back to straight it counts (a longer, flatter whip is worth more). Land with a trick still
// out (the bike's own `trick` input) or still whipped and it is a bail. Each jump banks on a clean
// landing: air, the tricks, the whips and the flips (the bike's own pitch: `spin`), with the combo
// (clean landings in a row that did something) as the multiplier. The ladder climbs over the run
// while the combo lives, past the top it comes at random (seeded); a crash or a sketchy landing
// starts it again. At the end `judges(seed)` gives five scores out of 100. Deterministic, no
// allocation per step: the state is typed arrays (`bytes`).
import { WHIP_RATE, WHIP_BACK, WHIP_OUT, WHIP_IN, WHIP_SAFE } from "../stunts.ts";

/** The ladder, easiest first (freestyle words; HANDSTAND is legs straight up, a hand on the seat). */
export const TRICKS = ["SEAT GRAB", "CROSS-UP", "NAC-NAC", "HEEL CLICKER", "CAN-CAN", "SUPERMAN", "SUPERMAN SEAT GRAB", "CLIFFHANGER", "CHRIST AIR", "LAZY BOY", "HANDSTAND"];
/** Points for each: once all the way out, and per second held there (up to HOLD_CAP s). */
export const BASE = [150, 180, 240, 280, 320, 380, 440, 520, 600, 660, 740], PER = [120, 140, 170, 190, 210, 240, 270, 300, 330, 350, 380];
/** A tap keeps the trick out MIN_OUT s; it goes out at OUT_RATE and back in at IN_RATE (1/s); out
 *  means amount ≥ FULL; past HOLD_CAP s held it pays no more; each trick before it in the jump adds
 *  CHAIN_X. The combo's top (×(1 + MAXCB)). */
export const MIN_OUT = 0.3, OUT_RATE = 5, IN_RATE = 5.5, FULL = 0.85, HOLD_CAP = 2, CHAIN_X = 0.25, MAXCB = 5;
/** The whip: points per whip (× its place in the jump), plus WHIP_HOLD per second kicked out past
 *  WHIP_OUT (up to a second); BIG_WHIP s out is a big one (the callout says so). */
export const WHIP_PTS = 150, WHIP_HOLD = 300, BIG_WHIP = 0.35;
/** What `land` judged: no score (a hop), clean, sketchy, still whipped (the mode crashes the bike). */
export const HOP = 0, CLEAN = 1, SKETCHY = 2, WHIPPED = 3;
/** S: score, combo, best jump, cleans, last points, last kind, crashes, jumps, flips, tricks seen
 *  (a bit per trick), last air, top combo, last flips, whips, the last jump's top trick (−1 none),
 *  its tricks, its whips, the judges' mark for it (out of 10), tricks done. */
export const SC = 0, CB = 1, BEST = 2, CLEANS = 3, PTS = 4, KIND = 5, CRASHES = 6, JUMPS = 7, FLIPS = 8, SEEN = 9, AIRT = 10, TOP = 11, LFLIPS = 12;
export const WHIPS = 13, LTOP = 14, LTRICKS = 15, LWHIPS = 16, LMARK = 17, DONE_N = 18;
/** Events (`ev`, `n`, `clear`): a trick out (its id), a trick done (points pending, 0: it never got
 *  all the way out), a whip (its count in the jump). */
export const T_TRICK = 1, T_DONE = 2, T_WHIP = 3;

export function tricks(o: { minAir?: number; clean?: number; seed?: number } = {}) {
  const minAir = o.minAir ?? 0.35, clean = o.clean ?? 0.3, seed = o.seed ?? 1;
  const S = new Float64Array(20);
  // J, this jump: air, turned, trick points, whip points, tricks used (bits), tricks, whips, the top trick (+1).
  const J = new Float64Array(8);
  const JA = 0, JT = 1, JP = 2, JW = 3, JU = 4, JN = 5, JK = 6, JB = 7;
  // CO, the button: input last step, the trick out (−1 none), how far out (0..1), seconds since its
  // press, seconds all the way out, the ladder's place, the last trick's id.
  const CO = new Float64Array(7);
  // WH, the whip: angle (−1..1, + right), out (−1, 0, 1), seconds out this whip.
  const WH = new Float64Array(3);
  const RNG = new Uint32Array(1), JD = new Float64Array(8);
  const ev = new Float64Array(16), NE = new Uint8Array(1);
  const emit = (type: number, v: number) => void (NE[0]! < 8 && ((ev[NE[0]! * 2] = type), (ev[NE[0]! * 2 + 1] = v), (NE[0] = NE[0]! + 1)));

  /** The trick out ends: its points pend on the jump (or it never got all the way out: nothing). */
  function done() {
    const id = CO[1]!, full = CO[4]!;
    CO[1] = -1; CO[2] = CO[3] = CO[4] = 0;
    if (full <= 0) return void emit(T_DONE, 0);
    const pts = Math.round((BASE[id]! + PER[id]! * Math.min(HOLD_CAP, full)) * (1 + CHAIN_X * J[JN]!));
    J[JP] = J[JP]! + pts;
    J[JN] = J[JN]! + 1;
    J[JU] = J[JU]! | (1 << id);
    if (id + 1 > J[JB]!) J[JB] = id + 1;
    CO[5] = CO[5]! + 1;
    S[DONE_N] = S[DONE_N]! + 1;
    emit(T_DONE, pts);
  }
  /** The next trick up the ladder (past the top: at random, never the same twice running). */
  function next() {
    const n = CO[5]!;
    if (n < TRICKS.length) return n;
    RNG[0] = (Math.imul(RNG[0]!, 1664525) + 1013904223) >>> 0;
    let id = 4 + (RNG[0]! % (TRICKS.length - 4));
    if (id === CO[6]) id = 4 + ((id - 4 + 1 + ((RNG[0]! >>> 16) % (TRICKS.length - 5))) % (TRICKS.length - 4));
    return id;
  }
  function reset1() {
    J.fill(0);
    WH.fill(0);
  }
  const api = {
    S, J, JD, ev,
    /** One step: airborne (and riding), the button (0/1), the stick's steer (−1..1). */
    step(dt: number, air: boolean, button: number, steer: number) {
      const press = button > 0 && CO[0] === 0;
      CO[0] = button;
      if (!air) {
        // On the ground: nothing goes out; one still out (a landing that did not bail) goes in.
        if (CO[1]! >= 0) done();
        WH[0] = WH[0]! * Math.max(0, 1 - 10 * dt);
        return;
      }
      J[JA] = J[JA]! + dt;
      if (press) {
        if (CO[1]! >= 0) done();
        const id = next();
        CO[1] = id; CO[6] = id;
        emit(T_TRICK, id);
      }
      if (CO[1]! >= 0) {
        CO[3] = CO[3]! + dt;
        const hold = button > 0 || CO[3]! < MIN_OUT;
        CO[2] = hold ? Math.min(1, CO[2]! + OUT_RATE * dt) : Math.max(0, CO[2]! - IN_RATE * dt);
        if (CO[2]! >= FULL) CO[4] = CO[4]! + dt;
        if (!hold && CO[2]! <= 0) done();
      }
      // The whip.
      const st = steer > 0.3 ? 1 : steer < -0.3 ? -1 : 0, a = WH[0]!;
      if (st) WH[0] = Math.max(-1, Math.min(1, a + st * WHIP_RATE * dt));
      else WH[0] = a > 0 ? Math.max(0, a - WHIP_BACK * dt) : Math.min(0, a + WHIP_BACK * dt);
      const w = WH[0]!, aw = w < 0 ? -w : w;
      if (aw >= WHIP_OUT) (WH[1] = w > 0 ? 1 : -1), (WH[2] = WH[2]! + dt);
      else if (aw <= WHIP_IN && WH[1] !== 0) {
        J[JK] = J[JK]! + 1;
        J[JW] = J[JW]! + Math.round((WHIP_PTS + WHIP_HOLD * Math.min(1, WH[2]!)) * J[JK]!);
        S[WHIPS] = S[WHIPS]! + 1;
        emit(T_WHIP, J[JK]! + (WH[2]! >= BIG_WHIP ? 100 : 0));
        WH[1] = 0; WH[2] = 0;
      }
    },
    /** The pitch turned since take-off (radians, + back). */
    spin(rad: number) {
      J[JT] = rad;
    },
    /** Back on the ground `err` radians off the slope, on a down ramp or not: HOP, CLEAN, SKETCHY, or
     *  WHIPPED (still kicked out: nothing scores; the mode crashes the bike, then `crash`). */
    land(err: number, ramp: boolean) {
      const air = J[JA]!, turned = J[JT]!, flips = Math.round((turned < 0 ? -turned : turned) / 6.283185307179586 - 0.12);
      const w = WH[0]!;
      if ((w < 0 ? -w : w) > WHIP_SAFE) return WHIPPED;
      // A trick on its way in (the bike bails one still out): it counts.
      if (CO[1]! >= 0) done();
      S[AIRT] = air;
      S[LFLIPS] = flips;
      if (air < minAir) return reset1(), HOP;
      const used = J[JN]!, whips = J[JK]!;
      let pts = Math.round(air * 80) + J[JP]! + J[JW]! + flips * 650;
      if (used > 1) pts = Math.round(pts * 1.25);
      if ((used || whips) && flips) pts = Math.round(pts * 1.3);
      if (used && whips) pts = Math.round(pts * 1.2);
      const ok = err <= clean, did = used > 0 || whips > 0 || flips > 0;
      pts = Math.round(pts * (ok ? 1 : 0.55) * (ramp ? 1.15 : 0.8) * (1 + (ok && did ? S[CB]! : 0)));
      S[SC] = S[SC]! + pts;
      S[PTS] = pts;
      S[KIND] = ok ? CLEAN : SKETCHY;
      S[BEST] = Math.max(S[BEST]!, pts);
      S[JUMPS] = S[JUMPS]! + 1;
      S[FLIPS] = S[FLIPS]! + flips;
      S[SEEN] = S[SEEN]! | J[JU]!;
      S[LTOP] = J[JB]! - 1;
      S[LTRICKS] = used;
      S[LWHIPS] = whips;
      // The judges' mark for this jump, out of 10: what was in it, cleanly.
      const kinds = (used > 0 ? 1 : 0) + (whips > 0 ? 1 : 0) + (flips > 0 ? 1 : 0);
      S[LMARK] = ok ? Math.round(Math.min(99, 52 + kinds * 7 + used * 3 + J[JB]! * 1.5 + (ramp ? 4 : 0) + Math.min(14, (air - minAir) * 6))) / 10 : 0;
      if (ok) (S[CLEANS] = S[CLEANS]! + 1), did && (S[CB] = Math.min(MAXCB, S[CB]! + 1)), (S[TOP] = Math.max(S[TOP]!, S[CB]!));
      else (S[CB] = 0), (CO[5] = 0);
      reset1();
      return S[KIND]!;
    },
    /** It went down: the jump scores nothing, the trick is gone, the combo and the ladder too. */
    crash() {
      S[CB] = 0;
      S[PTS] = 0;
      S[LMARK] = 0;
      S[CRASHES] = S[CRASHES]! + 1;
      CO[1] = -1; CO[2] = CO[3] = CO[4] = CO[5] = 0;
      reset1();
    },
    /** A reset (back to the run-in): the trick and the whip in, the jump forgotten. */
    drop() {
      CO[1] = -1; CO[2] = CO[3] = CO[4] = 0;
      reset1();
    },
    /** Five judges out of 100, each a little their own (seeded): score, variety, clean riding, the big one. */
    judges(seed: number) {
      let seen = 0;
      for (let i = 0; i < TRICKS.length; i++) seen += (S[SEEN]! >> i) & 1;
      const jumps = S[JUMPS]! || 1, base = 30 + Math.min(36, S[SC]! / 900) + seen * 1.6 + Math.min(6, S[WHIPS]!) * 0.6 + (S[CLEANS]! / jumps) * 8 + Math.min(6, S[FLIPS]! * 2) - S[CRASHES]! * 3;
      let r = seed >>> 0, sum = 0;
      for (let k = 0; k < 5; k++) {
        r = (Math.imul(r ^ (r >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0;
        const v = Math.max(10, Math.min(99.5, base + ((r / 4294967296) * 5 - 2.5)));
        JD[k] = Math.round(v * 10) / 10;
        sum += JD[k]!;
      }
      JD[5] = Math.round((sum / 5) * 10) / 10;
      return JD;
    },
    /** A new run. */
    reset() {
      S.fill(0);
      S[LTOP] = -1;
      CO.fill(0); CO[1] = -1; CO[6] = -1;
      RNG[0] = (seed * 2654435761) >>> 0 || 1;
      NE[0] = 0;
      reset1();
    },
    get n() { return NE[0]!; },
    clear() { NE[0] = 0; },
    /** The trick out (−1 none) and how far out (0..1: the bike's trick input). */
    get trick() { return CO[1]!; },
    get amount() { return CO[2]!; },
    /** Seconds it has been all the way out. */
    get held() { return CO[4]!; },
    /** The whip's angle (−1..1, + right). */
    get whip() { return WH[0]!; },
    /** The last trick thrown (its id). */
    get last() { return CO[6]!; },
    /** The next trick's place on the ladder. */
    get ladder() { return CO[5]!; },
    /** Every byte of the state (the golden hashes, a rollback). */
    bytes: [S, J, CO, WH, RNG, NE].map((x) => new Uint8Array(x.buffer, x.byteOffset, x.byteLength)),
  };
  api.reset();
  return api;
}
export type Tricks = ReturnType<typeof tricks>;
