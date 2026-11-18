// Holeshot's small kit (from Fizlet's Bikes gallery pieces: Moto Track, Big Air and Wheelie City): a
// particle pool for diorama points (dirt, sparks), the engine's voice (an oscillator pair that
// follows the revs, silent until a gesture and when muted), and a gamepad read (left stick: lean
// and steer; triggers or face buttons: gas, brake, trick). Each is a brick candidate.
import type { Diorama, DioramaPoints } from "@fzlt/core/diorama";
import type { Power } from "./bike.ts";

const TAU = 6.283185307179586;

/** A pool of `cap` points with velocity and life: `puff` adds (the oldest makes room), `step` moves them. */
export function pool(d: Diorama, cap: number, color: string, layer: number) {
  const P: DioramaPoints = d.points({ cap, color, layer }), V = new Float64Array(cap * 5);
  function puff(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, r: number, a: number) {
    let j = P.n < cap ? P.n++ : -1;
    if (j < 0) {
      let lo = Infinity;
      for (let i = 0; i < cap; i++) if (V[i * 5 + 3]! < lo) (lo = V[i * 5 + 3]!), (j = i);
    }
    P.x[j] = x; P.y[j] = y; P.z[j] = z; P.r[j] = r; P.a[j] = a;
    V[j * 5] = vx; V[j * 5 + 1] = vy; V[j * 5 + 2] = vz; V[j * 5 + 3] = life; V[j * 5 + 4] = life;
  }
  /** Move them dt; `grav` pulls down, `grow` swells them, `a0` is the alpha at birth. True while any live. */
  function step(dt: number, grav: number, grow: number, a0: number, drag = 1.6) {
    let live = 0;
    for (let i = 0; i < P.n; i++) {
      const l = V[i * 5 + 3]!;
      if (l <= 0) continue;
      const nl = l - dt;
      V[i * 5 + 3] = nl;
      V[i * 5 + 1] = V[i * 5 + 1]! - grav * dt;
      P.x[i] = P.x[i]! + V[i * 5]! * dt;
      P.y[i] = P.y[i]! + V[i * 5 + 1]! * dt;
      P.z[i] = P.z[i]! + V[i * 5 + 2]! * dt;
      V[i * 5] = V[i * 5]! * (1 - drag * dt);
      V[i * 5 + 2] = V[i * 5 + 2]! * (1 - drag * dt);
      P.r[i] = P.r[i]! + grow * dt;
      P.a[i] = nl > 0 ? a0 * (nl / V[i * 5 + 4]!) : 0;
      if (nl > 0) live++;
    }
    if (!live) P.n = 0;
    return live > 0;
  }
  /** A ring of `n` puffs at (x, y, z), thrown out at `sp` (a landing, a crash). */
  function ring(rnd: () => number, x: number, y: number, z: number, n: number, sp: number, up: number, life: number, r: number, a: number) {
    for (let k = 0; k < n; k++) {
      const t = rnd() * TAU, u = 0.5 + rnd() * 0.7;
      puff(x + Math.cos(t) * 0.3, y, z + Math.sin(t) * 0.3, Math.cos(t) * sp * u, up * (0.5 + rnd()), Math.sin(t) * sp * u, life * (0.7 + rnd() * 0.6), r, a);
    }
  }
  return { P, puff, step, ring, clear: () => void (P.n = 0) };
}
export type Pool = ReturnType<typeof pool>;

/** Gear-change sound for the gas bikes (seconds, and shares): an upshift cuts the ignition for
 *  CUT seconds (the gain drops to CUT_GAIN) while the revs fall to the next gear; a downshift
 *  blips the throttle (the pitch jumps by BLIP for BLIP_T seconds, a touch louder). */
export const CUT = 0.07, CUT_GAIN = 0.18, BLIP = 1.16, BLIP_T = 0.09;
/** An electric bike's motor (one smooth whine whatever its hub's gears): the name says it. */
export const electric = (p: Power) => p.name.startsWith("E-");

/** The engine's voice: two oscillators through one gain, pitch from the revs, louder on the gas.
 *  A gas bike shifts (`gear` changes): a short cut on the way up, a blip on the way down. An
 *  electric bike is one gear: its whine follows the road speed over its top speed, so a hub's gear
 *  steps are never heard. Muted (`on` false) it is silent, shifts and all.
 *  Nothing is made until `wake()` from a gesture; `set()` each frame is a few AudioParam writes. */
export function voice() {
  let ac: AudioContext | null = null, g: GainNode | null = null, o1: OscillatorNode | null = null, o2: OscillatorNode | null = null, on = true;
  let lo = 90, hi = 320, e = false, top = 15, last = -1, cutEnd = 0, blipEnd = 0;
  function wake(p: Power) {
    if (!ac) {
      const A = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
      if (!A) return;
      ac = new A();
      g = ac.createGain();
      g.gain.value = 0;
      g.connect(ac.destination);
      o1 = ac.createOscillator();
      o2 = ac.createOscillator();
      o1.connect(g);
      o2.connect(g);
      o1.start();
      o2.start();
    }
    use(p);
    if (ac.state === "suspended") void ac.resume();
  }
  function use(p: Power) {
    [lo, hi] = p.voice;
    e = electric(p);
    top = p.gears[p.gears.length - 1]! || 15;
    last = -1;
    if (o1 && o2) (o1.type = p.voice[2]), (o2.type = p.voice[2] === "sine" ? "triangle" : "square");
  }
  /** Revs 0..1, throttle 0..1, `live` false fades it out (paused, crashed, the card); the gear
   *  (0 first) and the speed (units/s) for the shifts and the electric whine. */
  function set(rpm: number, thr: number, live: boolean, gear = 0, v = 0) {
    if (!ac || !g || !o1 || !o2) return;
    const t = ac.currentTime;
    if (!e && live && last >= 0 && gear !== last) {
      if (gear > last) cutEnd = t + CUT;
      else blipEnd = t + BLIP_T;
    }
    last = live ? gear : -1;
    const av = v < 0 ? -v : v, x = e ? Math.min(1.05, (av / top) * 0.9 + thr * 0.1) : Math.max(0, Math.min(1.05, rpm));
    const cut = t < cutEnd, blip = t < blipEnd, f = (lo + (hi - lo) * x) * (blip ? BLIP : 1);
    o1.frequency.setTargetAtTime(f, t, blip ? 0.012 : 0.03);
    o2.frequency.setTargetAtTime(f * 0.5 + 3, t, blip ? 0.012 : 0.03);
    const gain = on && live ? (0.018 + thr * 0.035) * (cut ? CUT_GAIN : blip ? 1.25 : 1) : 0;
    g.gain.setTargetAtTime(gain, t, cut ? 0.008 : 0.05);
  }
  return {
    wake, use, set,
    get on() { return on; },
    set on(v: boolean) { on = v; },
    close() {
      if (ac) void ac.close();
      ac = null;
    },
  };
}
export type Voice = ReturnType<typeof voice>;

/** The first gamepad into out = [stick x, stick y, gas, brake, trick, start, back/select]; false with none. Only
 *  polled once a pad has said hello (`gamepadconnected`), so pages without one never call it. */
export function gamepad(out: Float64Array) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : null;
  if (!pads) return false;
  for (let i = 0; i < pads.length; i++) {
    const p = pads[i];
    if (!p || !p.connected) continue;
    const ax = p.axes, b = p.buttons, v = (k: number) => (b[k] ? b[k]!.value || (b[k]!.pressed ? 1 : 0) : 0);
    const dz = (a: number) => (a > 0.15 ? (a - 0.15) / 0.85 : a < -0.15 ? (a + 0.15) / 0.85 : 0);
    out[0] = dz(ax[0] ?? 0);
    out[1] = dz(ax[1] ?? 0);
    out[2] = Math.max(v(7), v(0));
    out[3] = Math.max(v(6), v(1));
    out[4] = Math.max(v(2), v(3), v(5));
    out[5] = v(9);
    if (out.length > 6) out[6] = v(8);
    return true;
  }
  return false;
}
