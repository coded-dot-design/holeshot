// Free Ride, headless: one rider on a map, no gate, no laps, no clock to beat. Ride anywhere on the
// table; a crash tumbles you, then you're back up where you fell (or on the nearest stretch of track
// if you went off the table). The session runs from the first gas until the rider ends it (END on
// the HUD) or `limit` seconds pass. Same event codes as the race (../race/course.ts) so the scene
// treats both alike. Zero allocation per step.
import { bike, type Bike, type BikeShape, type Power, B_CRASH, B_LAND, B_WHEELIE, STRIKE } from "../../bike/bike.ts";
import { E_CRASH, E_LAND, E_RESPAWN, E_WHEELIE, E_FINISH, GRID, RACE, DONE, type Track } from "../race/course.ts";

/** The free-ride maps: each a track plan to roam (the loop is there to follow, never required). */
export interface FreeMap { id: string; name: string; blurb: string; track: () => Track }

export function freeRun(track: Track, me: { power: Power; shape?: BikeShape }, limit = 600) {
  const { HX, HZ, NT, TRACK, YAW, NR, near, WANT, FK, PF, prof, sAt } = track;
  const t = track.course();
  const b: Bike = bike(t, me.power, me.shape);
  const riders = [b];
  // S: phase, clock, started, near index, fall x, fall z, fall yaw, off the table.
  const S = new Float64Array(8);
  const ev = new Float64Array(48);
  let nev = 0;
  const emit = (type: number, r: number, v: number) => void (nev < 16 && ((ev[nev * 3] = type), (ev[nev * 3 + 1] = r), (ev[nev * 3 + 2] = v), nev++));
  const RESPAWN = 1.4;

  function reset() {
    S.fill(0);
    nev = 0;
    const i = 4;
    b.reset(TRACK[i * 2]!, TRACK[i * 2 + 1]!, YAW[i]!);
    S[3] = i;
    S[0] = GRID;
  }
  function events() {
    for (let k = 0; k < b.n; k++) {
      const type = b.ev[k * 2]!, v = b.ev[k * 2 + 1]!;
      if (type === B_CRASH) (S[4] = b.pos[0]!), (S[5] = b.pos[2]!), (S[6] = b.yaw), emit(E_CRASH, 0, v);
      else if (type === B_LAND) emit(E_LAND, 0, v);
      else if (type === B_WHEELIE) emit(E_WHEELIE, 0, v);
    }
    b.clear();
  }
  /** Advance dt: I = [gas, brake, lean (+ back), steer]. `auto` rides the loop. */
  function step(dt: number, I: Float64Array, auto = false) {
    const ph = S[0]!;
    if (ph === DONE) {
      b.set(0, 1, 0, 0);
      const m = b.step(dt);
      b.clear();
      return m;
    }
    if (auto) I = autopilot(IN);
    if (ph === GRID && (I[0]! > 0 || I[1]! > 0 || I[2] !== 0 || I[3] !== 0)) (S[0] = RACE), (S[2] = 1);
    if (S[0] === RACE) S[1] = S[1]! + dt;
    if (b.crashed) {
      b.set(0, 0, 0, 0);
      b.step(dt);
      events();
      if (b.crashTime > RESPAWN) {
        if (S[7]) {
          near(S[4]!, S[5]!);
          const i = NR[1]!;
          b.reset(TRACK[i * 2]!, TRACK[i * 2 + 1]!, YAW[i]!);
          S[3] = i;
        } else b.reset(S[4]!, S[5]!, S[6]!);
        S[7] = 0;
        emit(E_RESPAWN, 0, 0);
      }
      return true;
    }
    b.set(I[0]!, I[1]!, I[2]!, I[3]!, 0);
    const moving = b.step(dt);
    events();
    near(b.pos[0]!, b.pos[2]!, S[3]!, 8);
    S[3] = NR[1]!;
    if (Math.abs(b.pos[0]!) > HX - 0.3 || Math.abs(b.pos[2]!) > HZ - 0.3) (S[4] = b.pos[0]!), (S[5] = b.pos[2]!), (S[7] = 1), b.knock(STRIKE), b.clear(), emit(E_CRASH, 0, 9);
    if (S[0] === RACE && S[1]! >= limit) finish();
    return moving || S[0] === RACE;
  }
  function finish() {
    if (S[0] === DONE) return;
    S[0] = DONE;
    emit(E_FINISH, 0, 0);
  }
  const IN = new Float64Array(5), G4 = new Float64Array(4), PP = new Float64Array(2);
  /** Rides the loop (the hero, the tests): look ahead along the line, the loop's speeds, level in the air. */
  function autopilot(out: Float64Array) {
    const i = S[3]!, sp = b.speed, k = (i + ((4 + Math.max(0, sp) * 0.22) | 0)) % NT;
    const fx = b.cy, fz = -b.sy, ux = TRACK[k * 2]! - b.pos[0]!, uz = TRACK[k * 2 + 1]! - b.pos[2]!, ul = Math.sqrt(ux * ux + uz * uz) || 1;
    out[3] = Math.max(-1, Math.min(1, ((fx * uz - fz * ux) / ul) * 2.6));
    out[4] = 0;
    const p = b.pitch, rate = (p - PP[0]!) * 60;
    PP[0] = p;
    if (b.air > 0) {
      // Where it comes down: the flight stepped on to the ground, then level to the slope there.
      let x = b.pos[0]!, y = b.pos[1]! - 0.7, z = b.pos[2]!, vy = b.vy;
      const vx = b.cy * b.speed, vz = -b.sy * b.speed;
      for (let q = 0; q < 60; q++) {
        x += vx * 0.03; z += vz * 0.03; vy -= 20 * 0.03; y += vy * 0.03;
        t.sample(x, z, G4);
        if (y <= G4[0]!) break;
      }
      near(x, z, i, 30);
      const s = sAt(NR[1]! + NR[2]!);
      prof(s + 0.3);
      const hi = PF[0]!;
      prof(s - 0.3);
      out[2] = Math.max(-1, Math.min(1, (Math.atan((hi - PF[0]!) / 0.6) - (p + rate * 0.25)) * 3.2));
      out[0] = out[1] = 0;
    } else {
      const want = WANT[i]! * 0.94;
      out[0] = sp < want ? 1 : sp < want + 0.8 ? 0.35 : 0;
      out[1] = sp > want + 2 ? 0.8 : 0;
      out[2] = b.rel > 0.12 ? -1 : b.rel > 0.05 ? -0.4 : 0;
    }
    void FK;
    return out;
  }
  reset();
  return {
    t, track, riders, S, ev,
    get n() { return nev; },
    clear: () => void (nev = 0),
    get phase() { return S[0]!; },
    get clock() { return S[1]!; },
    nearIndex: () => S[3]!,
    step, reset, finish, autopilot,
  };
}
export type FreeRun = ReturnType<typeof freeRun>;
