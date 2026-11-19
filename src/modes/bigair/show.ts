// Big Air's line and run, headless (tests/modes.test.mjs rides it with no browser). An endless
// straight (./line.ts): a roll-in deck and a long hill down for speed, then a steel kicker and a
// tabletop landing every SP units forever, all sized by the bike's own top speed so a full-gas jump
// lands on the landing's down ramp; banks either side and a stadium wall past them, so the bike never
// leaves the line and never has to turn round. The bike is ../../bike/bike.ts with the freestyle feel
// (a lighter gravity for hang time, more pitch in the air), the tricks are ./tricks.ts. The run: a
// minute from the first gas; in the air TRICK (I[4]: tap or hold) throws the next trick up the ladder
// (./tricks.ts), the stick left or right whips the bike, weight back (or forward) turns a flip (with a
// trick out too: a BACKFLIP NAC-NAC); land on the down ramp, clean, to score (the deck scores less);
// land with a trick still out, or still whipped, and it is a bail. Then five judges score it. `autopilot` rides it (the poster, the tests). Deterministic (the
// same bike, the same line) and zero allocation per step in the run's own code.
import { bike, type Bike, type BikeShape, type Power, TWO_STROKE, B_CRASH, B_LAND, BAIL } from "../../bike/bike.ts";
import { pace } from "../../model/pace.ts";
import { tricks, TRICKS, HOP, WHIPPED, T_TRICK, T_DONE, T_WHIP } from "./tricks.ts";
import { atan } from "../../math.ts";
import { PROGRESS, PROMPT_T, AUTO_T } from "../unstuck.ts";
import { FK, HW, L as LL, LSP, LX0, OUT, PF, P_DOWN, P_FLOOR, P_KICK, P_ROLL, ROLL_X, footAt, kickAt, knuckleAt, lineFor, prof, strip } from "./line.ts";

export { HW, KIND_LAND, KIND_STEEL, KIND_TRACK } from "./line.ts";
export const PICK = 0, READY = 1, RUN = 2, DONE = 3;
/** Seconds in a run. */
export const RUN_T = 60;
/** Events: [type, value]. */
export const E_START = 1, E_AIR = 2, E_TRICK = 3, E_LAND = 4, E_CRASH = 5, E_RESPAWN = 6, E_END = 7, E_FLIP = 8;
/** Unstuck: the prompt (1 up, 0 down), a reset (1 asked for, 2 automatic). The reset input is I[5] = 1. */
export const E_STUCK = 9, E_RESET = 10;
/** A trick done in the air (points pending: 0, it never got all the way out), a whip (its count in the
 *  jump, + 100 for a big one), landed still whipped (the crash follows). */
export const E_DONE = 11, E_WHIP = 12, E_WHIPPED = 13;
/** The freestyle feel: lighter gravity (hang time), more pitch from the rider in the air. */
export const GRAVITY = 14, AIR_PITCH = 13;
const RESPAWN = 1.5;
/** Where a run starts: on the roll-in deck, a little back from its edge. */
export const START_X = -5;

/** A run: the bike, its line, the trick out, the clock, the score. */
export function airShow(seed = 20261120, me: { power: Power; shape?: BikeShape } = { power: TWO_STROKE }) {
  // The line, sized for this bike's top speed (measured on the sim: ../../model/pace.ts).
  const G = new Float64Array(8);
  const size = (p: Power) => lineFor(pace({ power: p, shape: me.shape ?? {} } as Parameters<typeof pace>[0]).top, G);
  size(me.power);
  const S0 = strip(G), t = S0.t;
  const freestyle = (p: Power): Power => ({ ...p, airPitch: AIR_PITCH * (p.gyr < 0.6 ? 1.12 : 1) });
  // Lighter gravity: the landings come in slower, so the case line scales with it.
  // Walking the bike (../../bike/bike.ts `walk`): anywhere between the stadium walls, never behind the roll-in.
  const walkable = (p: Float64Array) => p[0]! > ROLL_X - 0.5 && Math.abs(p[1]!) < HW + 8;
  S0.follow(START_X);
  const b: Bike = bike(t, freestyle(me.power), { ...me.shape, caseDrop: (me.shape?.caseDrop ?? 26) * Math.sqrt(GRAVITY / 20), gravity: GRAVITY, walk: walkable });
  const sc = tricks({ seed });
  // S: phase, clock (left), started, best x, the autopilot's button (last step), its whip side, last pitch, autopilot jump count, air flag, flip planned,
  // unstuck seconds, unstuck mark, the jump the bike is on (its index), the last landing's part (FK) and x.
  const S = new Float64Array(16);
  const PH = 0, CLK = 1, FAR = 3, AB = 4, AW = 5, PP = 6, AJ = 7, AIRF = 8, FL = 9, STL = 10, MK = 11, JI = 12, LK = 13, LXX = 14;
  const ev = new Float64Array(32);
  let nev = 0;
  const emit = (type: number, v: number) => void (nev < 16 && ((ev[nev * 2] = type), (ev[nev * 2 + 1] = v), nev++));
  const IN = new Float64Array(6), LD = new Float64Array(2), G4 = new Float64Array(4);

  /** The bike at x on the line, facing on (+x), the strip slid round it. */
  function place(x: number) {
    S0.follow(x);
    b.reset(x, 0, 0);
    S[JI] = jumpOf(x);
  }
  /** The jump a point is on or before (−1 on the roll-in). */
  function jumpOf(x: number) {
    return x < G[LX0]! ? -1 : Math.floor((x - G[LX0]!) / G[LSP]!);
  }
  function reset(power?: Power) {
    if (power) b.use(freestyle(power)), size(power);
    S.fill(0);
    S[CLK] = RUN_T;
    sc.reset();
    nev = 0;
    place(START_X);
    S[MK] = START_X;
  }
  /** Where the bike comes down, as x on the line, and in how long: LD = [x, seconds] (the autopilot lands on the slope there). */
  function landing() {
    let x = b.pos[0]!, y = b.pos[1]! - 0.68, z = b.pos[2]!, vy = b.vy;
    const vx = b.cy * b.speed, vz = -b.sy * b.speed;
    let k = 0;
    for (; k < 120; k++) {
      x += vx * 0.03; z += vz * 0.03; vy -= GRAVITY * 0.03; y += vy * 0.03;
      t.sample(x, z, G4);
      if (y <= G4[0]!) break;
    }
    LD[0] = x;
    LD[1] = k * 0.03;
  }
  /** Back after a crash or a reset: on the deck of the jump before (its down ramp gives the speed back), or the roll-in. */
  function runIn() {
    const j = jumpOf(b.pos[0]! - 1);
    place(j < 1 ? START_X : knuckleAt(G, j - 1) - 2.5);
  }
  /** Unstuck: the watch and the reset input (I[5]). True if it reset. */
  function unstick(I: Float64Array, dt: number) {
    let why = I[5]! > 0 ? 1 : 0;
    if (!why) {
      const d = b.pos[0]! - S[MK]!;
      if (d > PROGRESS || d < -PROGRESS) {
        if (S[STL]! >= PROMPT_T) emit(E_STUCK, 0);
        S[MK] = b.pos[0]!;
        S[STL] = 0;
        return false;
      }
      const rel = b.rel < 0 ? -b.rel : b.rel;
      if (!(I[0]! > 0.1 || I[1]! > 0.1 || I[2] !== 0 || I[3] !== 0 || rel > 1.1)) return false;
      const was = S[STL]!;
      S[STL] = was + dt;
      if (was < PROMPT_T && S[STL]! >= PROMPT_T) emit(E_STUCK, 1);
      if (S[STL]! >= AUTO_T) why = 2;
    }
    if (!why) return false;
    runIn();
    sc.drop();
    S[MK] = b.pos[0]!;
    S[STL] = 0;
    emit(E_RESET, why);
    return true;
  }
  /** Inputs that ride the line: out = [gas, brake, lean, steer, trick held]. Full gas on the ground; in
   *  the air every other jump a back flip, and tricks up the ladder (tapped or held a little, put
   *  away in time) and on every third jump a whip. */
  function autopilot(out: Float64Array) {
    // Steer back onto the line (z = 0), heading on.
    const fx = b.cy, fz = -b.sy, ax = 6 + Math.max(0, b.speed) * 0.3, uz = -b.pos[2]!, ul = Math.sqrt(ax * ax + uz * uz);
    out[3] = Math.max(-1, Math.min(1, ((fx * uz - fz * ax) / ul) * 2.6));
    out[4] = 0;
    const p = b.pitch, rate = (p - S[PP]!) * 60;
    S[PP] = p;
    if (b.air > 0) {
      // Every other jump a back flip if the air allows it (decided at take-off); the rest a trick, held
      // through the top and put away in time for the landing.
      landing();
      prof(G, LD[0]! + 0.4);
      const slope = FK[0] === P_DOWN || FK[0] === P_FLOOR || FK[0] === 2 ? atan(PF[1]!) : -0.3;
      if (b.air < 0.02) S[FL] = (S[AJ]! & 1) === 1 && LD[1]! > (b.power.gyr < 0.6 ? 1.1 : 1.4) ? 1 : 0;
      const flip = S[FL] === 1;
      out[0] = 0;
      out[1] = 0;
      // The stick's side: a whip on every third jump with no flip, kicked out and back in time.
      const tl = LD[1]!, aj = S[AJ]!;
      out[3] = !flip && aj % 3 === 2 && b.air > 0.1 && tl > 0.75 ? (aj % 2 ? 1 : -1) : 0;
      // The button: a trick when none is out (a step off between presses), held a little, let go in time.
      let btn = 0;
      if (b.air > 0.12 && tl > 0.5) btn = sc.trick < 0 ? (S[AB] === 0 && tl > (flip ? 1 : 0.7) ? 1 : 0) : sc.held < 0.22 + 0.14 * (aj % 3) ? 1 : 0;
      S[AB] = btn;
      out[4] = btn;
      // Pull until the rotation left to stop (ω² / 2α) brings it round to the slope.
      if (flip && p + (rate > 0 ? (rate * rate) / (2 * AIR_PITCH * 0.6) : 0) < 6.283185307179586 + slope) out[2] = 1;
      else {
        // Level to the landing: pitch (less the flip) matched to the slope it meets.
        const cur = flip ? p - 6.283185307179586 : p, err = slope - (cur + rate * (flip ? 0.45 : 0.3));
        out[2] = Math.max(-1, Math.min(1, err * 3));
      }
    } else {
      // Full gas, the throttle shut only to bring a wheelie down before it loops.
      out[0] = b.rel > 0.32 ? 0 : 1;
      out[1] = 0;
      prof(G, b.pos[0]! + 0.5);
      // Up a kicker the weight goes a little back (no nose dive off the lip); elsewhere the front stays down.
      out[2] = FK[0] === P_KICK ? 0.25 : b.rel > 0.12 ? -1 : b.rel > 0.05 ? -0.4 : 0;
    }
    return out;
  }

  /** Advance dt: I = [gas, brake, lean, steer, trick held, reset]; `auto` rides it. True while anything moves. */
  function step(dt: number, I: Float64Array, auto = false) {
    const ph = S[PH]!;
    if (ph === PICK || ph === DONE) {
      b.set(0, ph === DONE ? 1 : 0, 0, 0);
      const m = b.step(dt);
      b.clear();
      return m;
    }
    if (auto) autopilot(IN), (I = IN);
    if (ph === READY && (I[0]! > 0 || I[1]! > 0)) (S[PH] = RUN), emit(E_START, 0);
    if (S[PH] === RUN) S[CLK] = Math.max(0, S[CLK]! - dt);
    if (!auto && !b.crashed && S[PH] === RUN && unstick(I, dt)) return true;
    if (b.crashed) {
      b.set(0, 0, 0, 0);
      b.step(dt);
      events();
      if (b.crashTime > RESPAWN) {
        runIn();
        sc.drop();
        if (!auto) (S[MK] = b.pos[0]!), (S[STL] = 0);
        emit(E_RESPAWN, 0);
      }
      if (S[CLK] === 0 && S[PH] === RUN) end();
      return true;
    }
    // The tricks (./tricks.ts): TRICK in the air throws the next one up the ladder, the stick's side
    // whips; the stick's weight still pitches the bike (a flip with a trick out is a combo).
    sc.step(dt, b.air > 0.08 && S[PH] === RUN, I[4]!, I[3]!);
    for (let k = 0; k < sc.n; k++) {
      const ty = sc.ev[k * 2]!, v = sc.ev[k * 2 + 1]!;
      emit(ty === T_TRICK ? E_TRICK : ty === T_DONE ? E_DONE : E_WHIP, v);
    }
    sc.clear();
    b.set(S[PH] === RUN || S[PH] === READY ? I[0]! : 0, I[1]!, I[2]!, I[3]!, sc.amount);
    const moving = b.step(dt);
    if (b.air > 0) {
      sc.spin(b.airSpin);
      S[AIRF] = 1;
    }
    events();
    S0.follow(b.pos[0]!);
    S[JI] = jumpOf(b.pos[0]!);
    if (b.pos[0]! > S[FAR]!) S[FAR] = b.pos[0]!;
    // Past the stadium wall (only a wild ride gets there) or behind the roll-in: a wipeout.
    if (!b.crashed && (Math.abs(b.pos[2]!) > OUT || b.pos[0]! < ROLL_X - 3)) b.knock(5), events();
    if (S[CLK] === 0 && S[PH] === RUN && !b.air) end();
    return moving || S[PH] === RUN;
  }
  function events() {
    for (let k = 0; k < b.n; k++) {
      const type = b.ev[k * 2]!, v = b.ev[k * 2 + 1]!;
      if (type === B_LAND && !b.crashed) {
        prof(G, b.pos[0]!);
        S[LK] = FK[0]!;
        S[LXX] = b.pos[0]!;
        const kind = sc.land(v, FK[0] === P_DOWN);
        // Still whipped: down it goes (its B_CRASH comes round this loop: the crash below).
        if (kind === WHIPPED) emit(E_WHIPPED, 0), b.knock(BAIL);
        else if (kind !== HOP) emit(E_LAND, kind), (S[AJ] = S[AJ]! + 1);
        S[AIRF] = 0;
      } else if (type === B_CRASH) sc.crash(), emit(E_CRASH, v), (S[AIRF] = 0), (S[AJ] = S[AJ]! + 1);
    }
    b.clear();
  }
  function end() {
    S[PH] = DONE;
    sc.judges(seed);
    emit(E_END, sc.JD[5]!);
  }
  /** Ready to ride on `power` (the clock starts with the first gas). */
  function go(power: Power) {
    reset(power);
    S[PH] = READY;
  }

  reset();
  void P_ROLL;
  return {
    t, b, sc, S, ev,
    /** The line's sizes (./line.ts L: k, the kicker, the deck, the down ramp, the spacing, the first kicker). */
    G,
    /** The strip the bike rides (slides, columns computed: `strip.stats`). */
    strip: S0,
    get n() { return nev; },
    clear: () => void (nev = 0),
    get phase() { return S[PH]!; },
    /** Seconds left. */
    get clock() { return S[CLK]!; },
    /** The trick out (−1 none) and how far out (0..1); the whip's angle (−1..1). */
    get trick() { return sc.trick; },
    get trickAmount() { return sc.amount; },
    get whip() { return sc.whip; },
    /** The furthest x reached (the distance down the line from the deck's edge is far − 0). */
    get far() { return S[FAR]!; },
    /** The jump the bike is on (its index; −1 on the roll-in). */
    get jump() { return S[JI]!; },
    /** The last landing: its profile part (./line.ts P_*) and x. */
    get landedOn() { return S[LK]!; },
    get landedAt() { return S[LXX]!; },
    kickAt: (j: number) => kickAt(G, j),
    knuckleAt: (j: number) => knuckleAt(G, j),
    footAt: (j: number) => footAt(G, j),
    step, reset, go, autopilot,
    names: TRICKS,
  };
}
export type AirShow = ReturnType<typeof airShow>;
void LL;
