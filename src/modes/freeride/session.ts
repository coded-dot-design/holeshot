// Free Ride, headless: one rider on a map, no gate, no laps, no clock to beat. Ride anywhere on the
// table; a crash tumbles you, then you're back up where you fell (or on the nearest stretch of track
// if you went off the table). The session runs from the first gas until the rider ends it (END on
// the HUD) or `limit` seconds pass. Same event codes as the race (../race/course.ts) so the scene
// treats both alike. Zero allocation per step.
// The map is a race Track (the loop) or an open map (./maps.ts `makeMap`): its own ground, a ride
// line, spawn points and posts. On an open map you start on the first spawn point; a crash on or by
// the line puts you back on it just behind the feature, out in the open you get up where you fell,
// and off the table you go to the nearest spawn point; a post (a tree) is a crash. Clean landings
// of big air and flips count as tricks (Free Ride pays a little for them).
import { bike, type Bike, type BikeShape, type Power, B_CRASH, B_LAND, B_WHEELIE, STRIKE } from "../../bike/bike.ts";
import { F_GAP, F_KICKER, F_STEP, type RideMap } from "./maps.ts";
import type { Terrain } from "@fzlt/core/terrain";
import { E_CRASH, E_LAND, E_RESPAWN, E_WHEELIE, E_FINISH, GRID, RACE, DONE, type Track } from "../race/course.ts";
import { atan, cos, sin } from "../../math.ts";

/** The free-ride maps: each a track plan to roam (the loop is there to follow, never required). */
export interface FreeMap { id: string; name: string; blurb: string; track: () => Track }

/** A clean landing after this much air is a trick; a flip is this much pitch turned in the air. */
export const TRICK_AIR = 0.6, FLIP_SPIN = 5.2;
/** A trick landed (value: 1 big air, 2 a flip). */
export const E_TRICK = 10;

export function freeRun(track: Track | RideMap, me: { power: Power; shape?: BikeShape }, limit = 600, ground?: Terrain) {
  const { HX, HZ, NT, TRACK, YAW, NR, near, WANT, FK, PF, prof, sAt } = track;
  const map = "isMap" in track ? track : null;
  const t = ground ?? (map ? map.terrain : track.course());
  const SP = map ? map.SPAWN : null, POSTS = map ? map.POSTS : null, NP = map ? map.NP : 0, HALF = map ? map.def.width / 2 : 0;
  const b: Bike = bike(t, me.power, me.shape);
  const riders = [b];
  // S: phase, clock, started, near index, fall x, fall z, fall yaw, off the table, tricks, flips,
  // seconds still since the end.
  const S = new Float64Array(11);
  const ev = new Float64Array(48);
  // NE: the event count (in a typed array: it is state, and the state is bytes).
  const NE = new Uint32Array(1);
  const emit = (type: number, r: number, v: number) => void (NE[0]! < 16 && ((ev[NE[0]! * 3] = type), (ev[NE[0]! * 3 + 1] = r), (ev[NE[0]! * 3 + 2] = v), (NE[0] = NE[0]! + 1)));
  const RESPAWN = 1.4, STILL = 0.6, G4 = new Float64Array(4);

  function reset() {
    S.fill(0);
    PP.fill(0);
    NE[0] = 0;
    if (SP) {
      b.reset(SP[0]!, SP[1]!, SP[2]!);
      near(SP[0]!, SP[1]!);
      S[3] = NR[1]!;
    } else {
      const i = 4;
      b.reset(TRACK[i * 2]!, TRACK[i * 2 + 1]!, YAW[i]!);
      S[3] = i;
    }
    S[0] = GRID;
  }
  /** Back up after a crash on an open map: off the table, the nearest spawn point; on or by the
   *  line (or on a face too steep to stand on), the line just behind the feature; else where it fell. */
  function respawnMap() {
    const x = S[4]!, z = S[5]!;
    if (S[7]) {
      let best = 0, bd = Infinity;
      for (let k = 0; k < SP!.length; k += 3) {
        const d = (SP![k]! - x) * (SP![k]! - x) + (SP![k + 1]! - z) * (SP![k + 1]! - z);
        if (d < bd) (bd = d), (best = k);
      }
      b.reset(SP![best]!, SP![best + 1]!, SP![best + 2]!);
      near(SP![best]!, SP![best + 1]!);
      S[3] = NR[1]!;
      return;
    }
    near(x, z);
    t.sample(x, z, G4);
    if (NR[0]! > HALF + 2.2 && G4[2]! > 0.9 && !postAt(x, z, 0.6)) return void b.reset(x, z, S[6]!);
    // Back along the line until the next 14 units are clear (a run-up to the feature).
    let i = NR[1]!;
    for (let k = 0; k < 80 && clearAhead(i) === 0; k++) i = (i - 1 + NT) % NT;
    b.reset(TRACK[i * 2]!, TRACK[i * 2 + 1]!, YAW[i]!);
    S[3] = i;
  }
  /** 1 when the line is flat from point i for the next 14 units (a run-up). */
  function clearAhead(i: number) {
    for (let a = 0; a <= 28; a += 2) if ((prof(sAt(i + a)), PF[0]! > 0.02)) return 0;
    return 1;
  }
  /** A post within r of (x, z). */
  function postAt(x: number, z: number, r: number) {
    for (let p = 0; p < NP; p++) {
      const dx = POSTS![p * 3]! - x, dz = POSTS![p * 3 + 1]! - z, q = POSTS![p * 3 + 2]! + r;
      if (dx * dx + dz * dz < q * q) return true;
    }
    return false;
  }
  function events() {
    let landed = 0;
    for (let k = 0; k < b.n; k++) {
      const type = b.ev[k * 2]!, v = b.ev[k * 2 + 1]!;
      if (type === B_CRASH) (S[4] = b.pos[0]!), (S[5] = b.pos[2]!), (S[6] = b.yaw), emit(E_CRASH, 0, v);
      else if (type === B_LAND) emit(E_LAND, 0, v), (landed = 1);
      else if (type === B_WHEELIE) emit(E_WHEELIE, 0, v);
    }
    b.clear();
    // A trick: big air or a flip, landed clean (still up after the landing).
    if (landed && !b.crashed && S[0] === RACE) {
      const spin = b.airSpin < 0 ? -b.airSpin : b.airSpin;
      if (spin > FLIP_SPIN) (S[9] = S[9]! + 1), (S[8] = S[8]! + 1), emit(E_TRICK, 0, 2);
      else if (b.landAir > TRICK_AIR && b.landErr < 0.3) (S[8] = S[8]! + 1), emit(E_TRICK, 0, 1);
    }
  }
  /** Advance dt: I = [gas, brake, lean (+ back), steer]. `auto` rides the loop. */
  function step(dt: number, I: Float64Array, auto = false) {
    const ph = S[0]!;
    if (ph === DONE) {
      // Banked: brake to a stop. Held still a moment, it rests (on a slope the springs would
      // shiver for ever, so the bike is no longer stepped: the scene settles).
      if (S[10]! >= STILL) return false;
      b.set(0, 1, 0, 0);
      const m = b.step(dt);
      b.clear();
      const still = b.crashed ? b.crashTime > 2.5 : b.air === 0 && (b.speed < 0 ? -b.speed : b.speed) < 0.3;
      S[10] = still ? S[10]! + dt : 0;
      return m && S[10]! < STILL;
    }
    if (auto) I = autopilot(IN);
    if (ph === GRID && (I[0]! > 0 || I[1]! > 0 || I[2] !== 0 || I[3] !== 0)) (S[0] = RACE), (S[2] = 1);
    if (S[0] === RACE) S[1] = S[1]! + dt;
    if (b.crashed) {
      b.set(0, 0, 0, 0);
      b.step(dt);
      events();
      if (b.crashTime > RESPAWN) {
        if (map) respawnMap();
        else if (S[7]) {
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
    else if (NP && !b.crashed && postAt(b.pos[0]!, b.pos[2]!, 0.28)) (S[4] = b.pos[0]!), (S[5] = b.pos[2]!), (S[6] = b.yaw), b.knock(STRIKE), b.clear(), emit(E_CRASH, 0, 6);
    if (S[0] === RACE && S[1]! >= limit) finish();
    return moving || S[0] === RACE;
  }
  function finish() {
    if (S[0] === DONE) return;
    S[0] = DONE;
    emit(E_FINISH, 0, 0);
  }
  const IN = new Float64Array(5), PP = new Float64Array(2);
  /** The big jump (kicker, gap, step-down) at point q of the line, or 0. */
  function big(q: number) {
    prof(sAt(q));
    const f = FK[0]!;
    return f === F_KICKER || f === F_GAP || f === F_STEP ? f : 0;
  }
  /** Rides the loop (the hero, the tests): look ahead along the line, the loop's speeds, level in the air. */
  function autopilot(out: Float64Array) {
    const i = S[3]!, sp = b.speed, k = (i + (((map ? 6 : 4) + Math.max(0, sp) * (map ? 0.34 : 0.22)) | 0)) % NT;
    // An open map: too slow for a big jump ahead, it rides round it on the open ground beside the
    // line (toward the middle of the table), and back on the line past it.
    let lane = 0;
    if (map) {
      const ahead = big(i + 7), here = big(i) || big(i + 3);
      if (!PP[1] && ahead && !here && b.air === 0 && sp < (ahead === F_STEP ? 8.8 : ahead === F_GAP ? 10.6 : 11.6)) PP[1] = 1;
      if (PP[1] && !ahead && !here) PP[1] = 0;
      if (PP[1]) {
        const nx = sin(YAW[k]!), nz = cos(YAW[k]!), x = TRACK[k * 2]!, z = TRACK[k * 2 + 1]!;
        lane = (x + nx) * (x + nx) + (z + nz) * (z + nz) < (x - nx) * (x - nx) + (z - nz) * (z - nz) ? HALF + 2.2 : -HALF - 2.2;
      }
    }
    const tx = TRACK[k * 2]! + sin(YAW[k]!) * lane, tz = TRACK[k * 2 + 1]! + cos(YAW[k]!) * lane;
    const fx = b.cy, fz = -b.sy, ux = tx - b.pos[0]!, uz = tz - b.pos[2]!, ul = Math.sqrt(ux * ux + uz * uz) || 1;
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
      let slope: number;
      if (map) {
        // An open map: the line's surface (its floor and the feature) where it comes down.
        near(x, z, i, 30);
        const s = sAt(NR[1]! + NR[2]!);
        slope = atan((map.heightAt(s + 0.3) - map.heightAt(s - 0.3)) / 0.6);
      } else {
        near(x, z, i, 30);
        const s = sAt(NR[1]! + NR[2]!);
        prof(s + 0.3);
        const hi = PF[0]!;
        prof(s - 0.3);
        slope = atan((hi - PF[0]!) / 0.6);
      }
      out[2] = Math.max(-1, Math.min(1, (slope - (p + rate * 0.25)) * 3.2));
      out[0] = out[1] = 0;
    } else {
      const want = WANT[i]! * (map ? 1 : 0.94);
      out[0] = sp < want ? 1 : sp < want + 0.8 ? 0.35 : 0;
      out[1] = sp > want + (map ? 0.8 : 2) ? 0.8 : 0;
      out[2] = b.rel > 0.12 ? -1 : b.rel > 0.05 ? -0.4 : map && b.rel < -0.12 ? 1 : map && b.rel < -0.05 ? 0.4 : 0;
    }
    void FK;
    return out;
  }
  reset();
  return {
    t, track, riders, S, ev,
    /** The whole state as bytes (rollback, the desync hash). */
    bytes: [S, PP, NE, b.state].map((a) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength)),
    get n() { return NE[0]!; },
    clear: () => void (NE[0] = 0),
    get phase() { return S[0]!; },
    get clock() { return S[1]!; },
    /** Tricks landed (big air and flips), and the flips among them. */
    get tricks() { return S[8]!; },
    get flips() { return S[9]!; },
    nearIndex: () => S[3]!,
    step, reset, finish, autopilot,
  };
}
export type FreeRun = ReturnType<typeof freeRun>;
