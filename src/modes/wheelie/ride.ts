// Wheelie City's ride on the shared bike (../../bike/bike.ts): the gallery piece's three electric
// rides as data (kept for the tests and as defaults; in the game the player's tuned bike is the one
// ride), one bike per ride (each has its own wheel size), and the small adapter this piece needs on top: a hop (the shared bike has no
// jump of its own: brick candidate), lean as "+1 forward" like the rest of the piece, a velocity
// for the chase camera, and a bump off a wall (speed along the heading turned back). Zero
// allocation per step. Once at rest it stays parked until the rider does something.
import { bike, E_BIKE, E_MOTO, STRIKE, type Bike, type BikeGround, type BikeShape, type Power } from "../../bike/bike.ts";

/** A fat-tyre mini e-moto: low and heavy, a soft pull, slow to rotate (long, steady manuals). */
export const E_MINI: Power = {
  name: "E-MINI", mass: 0.8, gyr: 0.62, force: 11.5,
  curve: [0.95, 0.97, 1, 0.97, 0.9, 0.8, 0.68, 0.55, 0.4],
  gears: [11.5], launch: 0, rev: 30, roll: 6, up: 1.1, down: 0,
  airPitch: 5.5, grip: 1.28, brake: 18, voice: [150, 520, "triangle"],
};

/** VOLT: the shared pedal-assist e-bike with a three-speed hub and a little more assist, a touch
 *  slower to rotate: on the single speed the assist cut out at the limiter (9 u/s) mid-wheelie and
 *  gave nothing to hold a wheelie with at street speed. */
export const E_BIKE_2: Power = { ...E_BIKE, gears: [5.8, 8.8, 12], up: 0.85, down: 0.5, gyr: 0.62, force: 12 };

/** The hand drag's clock face (radians of the nose off the ground): 12 o'clock (vertical), and the
 *  hard limit about 1 o'clock (30° past): past it, it loops out. */
export const TWELVE = 1.5707963267948966, LOOP_AT = TWELVE + 0.52, PAST_BRAKE = 14;

/** One ride: what the garage says, the engine, the chassis, the sweet spot, the hop. */
export interface RideSpec {
  id: string;
  name: string;
  kind: string;
  blurb: string;
  /** The card's bars, 1..5: power, speed, balance. */
  bars: [number, number, number];
  power: Power;
  shape: BikeShape;
  /** Half the sweet spot round the balance point (radians). */
  sweet: number;
  /** Hop speed, units/s. */
  hop: number;
}

export const RIDES: RideSpec[] = [
  { id: "volt", name: "VOLT", kind: "E-BIKE", blurb: "Light and quick to lift. A wide balance point; hops high.", bars: [2, 2, 5], power: E_BIKE_2, shape: { rear: -0.6, front: 0.6, drop: 0.4, radius: 0.34 }, sweet: 0.12, hop: 6.2 },
  { id: "jolt", name: "JOLT", kind: "ELECTRIC DIRT BIKE", blurb: "Instant torque. Lifts on a whisper, loops if you get greedy.", bars: [5, 5, 2], power: E_MOTO, shape: { rear: -0.62, front: 0.64, drop: 0.42, radius: 0.33 }, sweet: 0.07, hop: 5.6 },
  { id: "stub", name: "STUBBY", kind: "FAT-TYRE MINI", blurb: "Low and heavy. Slow to lift, holds a manual for ever.", bars: [3, 3, 4], power: E_MINI, shape: { rear: -0.56, front: 0.56, drop: 0.36, radius: 0.29 }, sweet: 0.1, hop: 5 },
];

/** The rides on `ground` (one bike each, made once); `use` picks one, `step` drives it. */
export function ride(ground: BikeGround, specs: RideSpec[] = RIDES) {
  // (Past 12 o'clock, to about 1: the city's bikes loop out at LOOP_AT, not at the balance point's margin.)
  const all: Bike[] = specs.map((r) => bike(ground, r.power, { ...r.shape, loop: LOOP_AT }));
  let k = all[0]!, sp = specs[0]!;
  // R: hop timer, the speed into the last wall, seconds sat still (in a typed array: a snapshot).
  const vel = new Float64Array(3), R = new Float64Array(3);
  /** One step: gas, brake 0..1, lean −1 (back) .. 1 (forward), steer −1..1 (+ right), hop (a press). */
  function step(dt: number, gas: number, brake: number, lean: number, steer: number, hop: number) {
    // Parked: once the shared bike has come to rest (or has sat all but still for a moment: against a
    // curb or a wall its springs can creep for ever), it stays parked, not stepped, until the gas, a
    // lean or a hop, so the page can settle.
    const idle = !k.crashed && gas === 0 && hop === 0 && lean === 0;
    R[2] = idle && Math.abs(k.speed) < 0.05 && Math.abs(k.vy) < 0.05 && Math.abs(k.S[3]!) < 0.05 ? R[2]! + dt : 0;
    if (idle && (k.resting || R[2]! > 0.8)) return false;
    if (hop > 0 && R[0]! <= 0 && !k.crashed && k.contact[0] && k.contact[1]) (k.S[6] = k.S[6]! + sp.hop), (R[0] = 0.4);
    R[0] = R[0]! - dt;
    k.set(gas, brake, -lean, steer, 0);
    const moving = k.step(dt);
    // Past the balance point on the rear wheel (towards 12 o'clock and the hand drag), the rear brake
    // gets PAST_BRAKE more say (the rider's weight over the bars as well): feathered, it holds the nose
    // up there; let off, it keeps going over (it is not stable: it drifts towards the loop-out).
    if (!k.crashed && k.contact[0] && !k.contact[1] && k.rel > k.bp && brake > 0) k.S[3] = k.S[3]! - brake * PAST_BRAKE * dt;
    vel[0] = k.cy * k.speed; vel[1] = 0; vel[2] = -k.sy * k.speed;
    return moving || R[0]! > 0;
  }
  /** Bump off a wall with outward normal (nx, nz): the speed into it turned back. Returns the speed it hit at. */
  function wall(nx: number, nz: number, hard: number) {
    const into = -(vel[0]! * nx + vel[2]! * nz);
    if (into <= 0) return 0;
    // Hard: the shared bike's own crash (the frame hits it); soft: it bounces back (the shared bike
    // has no bump of its own, so the speed along the heading, S[5], turns back).
    if (into > hard && !k.crashed) k.knock(STRIKE);
    else k.S[5] = -k.S[5]! * 0.25;
    R[1] = into;
    return into;
  }
  return {
    step, wall, vel, R, all,
    /** Pick ride i, put down at (x, z) facing yaw. */
    use(i: number, x: number, z: number, yaw: number) {
      sp = specs[i]!;
      k = all[i]!;
      k.reset(x, z, yaw);
      R[0] = R[2] = 0;
    },
    reset(x: number, z: number, yaw: number) {
      k.reset(x, z, yaw);
      R[0] = R[2] = 0;
    },
    /** The shared bike being ridden. */
    get b() { return k; },
    get spec() { return sp; },
    /** The nose off the ground's slope (a wheelie is +), 0 when crashed. */
    get nose() { return k.crashed ? 0 : k.rel; },
    get balance() { return k.bp; },
    /** Speed into the last wall. */
    get bonk() { return R[1]!; },
    get air() { return !k.crashed && !k.contact[0] && !k.contact[1]; },
  };
}
export type Ride = ReturnType<typeof ride>;
