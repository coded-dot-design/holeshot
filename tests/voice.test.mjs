// The engine's voice (src/bike/kit.ts) on a fake Web Audio graph (Node has none): the gas bikes
// shift (an upshift cuts the ignition for a moment, a downshift blips the revs), the electric bikes
// are one gear (the whine follows the road speed, so the e-bike's hub steps are never heard), and
// muted is silent through every shift.
import test from "node:test";
import assert from "node:assert/strict";

const { voice, CUT, CUT_GAIN, BLIP, electric } = await import("../src/bike/kit.ts");
const { MODELS } = await import("../src/data/roster.ts");
const { E_MINI } = await import("../src/modes/wheelie/ride.ts");

/** A Web Audio stand-in: each AudioParam keeps its last target. */
function fakeAudio() {
  const clock = { t: 0 };
  const param = () => ({ value: 0, target: 0, setTargetAtTime(v) { this.target = v; } });
  class Node { connect() {} start() {} }
  class AC {
    state = "running";
    get currentTime() { return clock.t; }
    createGain() { return Object.assign(new Node(), { gain: param() }); }
    createOscillator() { const o = Object.assign(new Node(), { frequency: param(), type: "sine" }); (AC.osc ??= []).push(o); return o; }
    get destination() { return {}; }
    close() {}
    resume() {}
  }
  globalThis.AudioContext = AC;
  return { clock, AC };
}
const gas = MODELS.find((m) => m.id === "buzzline").power, four = MODELS.find((m) => m.id === "anvil").power;
const ebike = MODELS.find((m) => m.id === "glidewire").power, emoto = MODELS.find((m) => m.id === "sparkhound").power;

test("voice: the classes (gas bikes shift; every electric ride is one gear)", () => {
  assert.equal(electric(gas), false);
  assert.equal(electric(four), false);
  assert.equal(electric(ebike), true);
  assert.equal(electric(emoto), true);
  assert.equal(electric(E_MINI), true);
});

/** A voice on the fake, with its gain node and first oscillator in hand. */
function rig(power) {
  const { clock, AC } = fakeAudio(), made = [], cg = AC.prototype.createGain;
  AC.osc = [];
  AC.prototype.createGain = function () { const n = cg.call(this); made.push(n); return n; };
  const v = voice();
  v.wake(power);
  AC.prototype.createGain = cg;
  return { clock, v, gain: made[0].gain, osc: AC.osc[0].frequency };
}

test("voice: a gas bike's upshift cuts the ignition, then the revs drop; a downshift blips", () => {
  const { clock, v, gain, osc } = rig(gas);
  clock.t = 1;
  v.set(0.95, 1, true, 0, 6);
  const full = gain.target, high = osc.target;
  clock.t = 1.016;
  v.set(0.62, 1, true, 1, 6.1); // up a gear: the revs fall to the next gear, the ignition cuts
  assert.ok(Math.abs(gain.target - full * CUT_GAIN) < 1e-9, `the cut: ${gain.target} vs ${full}`);
  assert.ok(osc.target < high, "the revs drop");
  clock.t = 1.016 + CUT + 0.001;
  v.set(0.64, 1, true, 1, 6.2);
  assert.ok(Math.abs(gain.target - full) < 1e-9, "back on after the cut");
  // A downshift: the pitch jumps by BLIP for a moment.
  clock.t = 2;
  v.set(0.5, 0, true, 1, 5);
  const plain = osc.target;
  clock.t = 2.016;
  v.set(0.5, 0, true, 0, 5);
  assert.ok(Math.abs(osc.target - plain * BLIP) < 1e-9, "the blip");
  // The same shift on a paused ride (not live) makes no sound and arms nothing.
  clock.t = 3;
  v.set(0.9, 1, false, 0, 6);
  v.set(0.6, 1, false, 1, 6);
  assert.equal(gain.target, 0);
});

test("voice: an electric bike is one smooth whine: its hub's gears never step the pitch", () => {
  const { clock, v, osc } = rig(ebike), o1 = { frequency: osc };
  let prev = 0;
  for (let i = 0; i <= 60; i++) {
    const s = (i / 60) * 12, gear = s < 5 ? 0 : s < 8.5 ? 1 : 2, rpm = s / [6.2, 9.4, 12.8][gear];
    clock.t = i / 60;
    v.set(rpm, 1, true, gear, s);
    const f = o1.frequency.target;
    assert.ok(f >= prev - 1e-9, `rises with the speed at ${s.toFixed(2)} u/s (gear ${gear})`);
    prev = f;
  }
  // The same speed in another gear is the same note.
  v.set(0.4, 1, true, 0, 6);
  const a = o1.frequency.target;
  v.set(0.9, 1, true, 2, 6);
  assert.equal(o1.frequency.target, a);
});

test("voice: muted is silent, shifts and all", () => {
  const { clock, v, gain } = rig(gas);
  v.on = false;
  for (let i = 0; i < 30; i++) (clock.t = i / 60), v.set(0.9, 1, true, i >> 3, i), assert.equal(gain.target, 0);
  v.on = true;
  v.set(0.5, 1, false, 2, 10);
  assert.equal(gain.target, 0, "not live (paused, crashed): silent");
});
