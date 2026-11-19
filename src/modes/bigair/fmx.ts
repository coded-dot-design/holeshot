// Big Air's freestyle tricks, drawn: each trick's rider pose at its peak (the rig's TRICK_POSE
// channels, ../../bike/rig.ts) and how the bike turns under it (the whip, the cross-up). The scene
// eases the rig toward the pose each frame (`ease`), so a trick goes out and comes in smoothly and
// one trick flows into the next. Cosmetic only (the run is ./show.ts and ./tricks.ts): nothing here
// changes the sim. No allocation per frame.
import { TRICK_POSE, T_GRAB, T_NAC, T_CAN, T_HEELS, T_HANDSTAND, T_BARS, T_BODY } from "../../bike/rig.ts";

const N = TRICK_POSE;
/** A pose row: [hands off, feet off, spread, back, up, twist, arms spread, tuck] + the freestyle channels. */
function row(base: number[], ex: Record<number, number> = {}) {
  const r = new Float64Array(N);
  for (let k = 0; k < base.length; k++) r[k] = base[k]!;
  for (const k in ex) r[+k] = ex[k]!;
  return r;
}
/** Each trick's pose at its peak, in ./tricks.ts TRICKS order. */
export const POSES = [
  // SEAT GRAB: up off the pegs, the right hand back on the seat, the legs a little out.
  row([0, 0.3, 0.3, 0.2, 0.35, 0, 0, 0], { [T_GRAB]: 1, [T_BODY]: -0.1 }),
  // CROSS-UP: the bars turned across, the rider leaning against it.
  row([0, 0, 0.1, 0.1, 0.3, -0.3, 0, 0], { [T_BARS]: 1, [T_BODY]: 0.15 }),
  // NAC-NAC: the right leg swung over the back to the far side.
  row([0, 0, 0.15, 0.15, 0.5, 0.2, 0, 0], { [T_NAC]: 1, [T_BODY]: 0.1 }),
  // HEEL CLICKER: both feet up over the bars, heels together, leaning back.
  row([0, 0, 0, 0.3, 0.35, 0, 0, 0], { [T_HEELS]: 1, [T_BODY]: -0.45 }),
  // CAN-CAN: the right leg kicked over the tank to the far side.
  row([0, 0, 0.2, 0.1, 0.45, 0.15, 0, 0], { [T_CAN]: 1, [T_BODY]: -0.1 }),
  // SUPERMAN: legs straight back off the pegs, the body flat, hands on the bars.
  row([0, 1, 0.08, 0.2, 0.62, 0, 0, 0], { [T_BODY]: 0.5 }),
  // SUPERMAN SEAT GRAB: the same, the right hand back on the seat.
  row([0, 1, 0.25, 0.3, 0.68, 0, 0, 0], { [T_GRAB]: 1, [T_BODY]: 0.4 }),
  // CLIFFHANGER: feet hooked under the bars, the body stretched up, both hands up.
  row([1, 0, 0, 0, 1, 0, 0.85, 0], { [T_HEELS]: 0.85, [T_BODY]: -0.95 }),
  // CHRIST AIR: standing up off the bike, the knees on the seat, arms spread wide.
  row([1, 0.4, 0.1, 0, 1, 0, 1, 0], { [T_BODY]: -0.9 }),
  // LAZY BOY: lying back on the seat, feet at the bars, hands off.
  row([1, 0, 0, 0.75, 0.1, 0, 0.4, 0], { [T_HEELS]: 0.75, [T_BODY]: -2.05 }),
  // HANDSTAND: a hand on the seat, the other on the bars, legs straight up.
  row([0, 0, 0.12, 0, 0, 0, 0, 0], { [T_GRAB]: 1, [T_HANDSTAND]: 1 }),
];
/** How each trick turns the bike: [roll, yaw] at its peak (the cross-up lays it over). */
const BIKE = new Float64Array(POSES.length * 2);
BIKE[1 * 2] = 0.5; BIKE[1 * 2 + 1] = 0.35;
/** The whip: roll and yaw per unit of whip (the bike kicked sideways and back). */
export const WHIP_ROLL = 1.05, WHIP_YAW = 0.45;

const smooth = (a: number) => a * a * (3 - 2 * a);
/** Ease `T` (the rig's pose) toward trick `id` out `amount` (−1 none: riding) by `k` (0..1 this frame). */
export function ease(T: Float64Array, id: number, amount: number, k: number) {
  const a = id >= 0 ? smooth(amount < 0 ? 0 : amount > 1 ? 1 : amount) : 0, P = id >= 0 ? POSES[id]! : null;
  for (let c = 0; c < N; c++) {
    const want = P ? P[c]! * a : 0;
    T[c] = T[c]! + (want - T[c]!) * k;
  }
}
/** The bike's roll and yaw for trick `id` out `amount` and whip `whip` (−1..1), into out[0..1]. */
export function bikeTurn(out: Float64Array, id: number, amount: number, whip: number) {
  const a = id >= 0 ? smooth(amount < 0 ? 0 : amount > 1 ? 1 : amount) : 0;
  out[0] = whip * WHIP_ROLL + (id >= 0 ? BIKE[id * 2]! * a : 0);
  out[1] = whip * WHIP_YAW + (id >= 0 ? BIKE[id * 2 + 1]! * a : 0);
}
