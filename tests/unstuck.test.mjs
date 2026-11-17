// Unstuck in Race, Big Air and Wheelie City, headless: wedged (the bike pinned in place with the gas
// held), the prompt comes up at 2 s and the reset follows on its own at 4 s; R (the reset input)
// resets on the next step. A race reset puts the bike back on the line behind where it was, takes the
// progress back and holds it a moment: it can never gain a place or progress.
import test from "node:test";
import assert from "node:assert/strict";

const C = await import("../src/modes/race/course.ts");
const U = await import("../src/modes/unstuck.ts");
const { tune } = await import("../src/model/tune.ts");
const { newBike } = await import("../src/model/profile.ts");
const t = tune(newBike("buzzline", "b1"));

/** Step a race with the player on inputs I; `pin` holds the player's bike where it is (a trap). */
function raceTo(r, I, steps, pin = null) {
  const seen = [];
  for (let i = 0; i < steps; i++) {
    r.step(1 / 60, I, false);
    if (pin) (r.riders[0].pos[0] = pin[0]), (r.riders[0].pos[2] = pin[1]), (r.riders[0].S[5] = 0);
    for (let k = 0; k < r.n; k++) seen.push([r.ev[k * 3], r.ev[k * 3 + 1], r.ev[k * 3 + 2], i]);
    r.clear();
  }
  return seen;
}

test("race unstuck: wedged → the prompt → an automatic reset behind, no place gained", () => {
  const r = C.motoRace(5, C.makeTrack(C.MOTO_TRACK), { power: t.power, shape: t.shape }), I = new Float64Array(5);
  r.go(t.power);
  raceTo(r, I, 60 * 4);
  I[0] = 1;
  raceTo(r, I, 60 * 6);
  const b = r.riders[0];
  for (let i = 0; i < 600 && (b.crashed || b.air > 0); i++) raceTo(r, I, 1);
  const pg = r.progress(0), place = r.place(0), pin = [b.pos[0], b.pos[2]];
  // At the trap: half gas, weight forward (the front stays down).
  I[0] = 0.5; I[2] = -1;
  const ev = raceTo(r, I, 60 * 5, pin);
  const prompt = ev.find((e) => e[0] === C.E_STUCK && e[1] === 0 && e[2] === 1), reset = ev.find((e) => e[0] === C.E_RESET && e[1] === 0);
  assert.ok(prompt && reset, "the prompt and the reset");
  assert.equal(reset[2], 2, "automatic");
  const secs = (e) => e[3] / 60;
  assert.ok(secs(prompt) >= 1.9 && secs(prompt) < 2.6, `prompt at ${secs(prompt).toFixed(2)} s`);
  assert.ok(secs(reset) >= 3.9 && secs(reset) < 4.6, `reset at ${secs(reset).toFixed(2)} s`);
  assert.ok(r.progress(0) < pg, `progress taken back (${r.progress(0).toFixed(1)} < ${pg.toFixed(1)})`);
  assert.ok(r.place(0) >= place, `no place gained (${r.place(0)} vs ${place})`);
  assert.ok(!b.crashed && Math.abs(b.rel) < 0.1, "upright on the line");
});

test("race unstuck: R resets on the next step, behind; it never skips ahead", () => {
  const r = C.motoRace(6, C.makeTrack(C.MOTO_TRACK), { power: t.power, shape: t.shape }), I = new Float64Array(5);
  r.go(t.power);
  raceTo(r, I, 60 * 4);
  I[0] = 1;
  let worst = -Infinity;
  for (let k = 0; k < 8; k++) {
    raceTo(r, I, 60 * 3);
    const b = r.riders[0];
    for (let i = 0; i < 600 && (b.crashed || b.air > 0); i++) raceTo(r, I, 1);
    const pg = r.progress(0), place = r.place(0);
    I[4] = U.RESET;
    const ev = raceTo(r, I, 1);
    I[4] = 0;
    assert.ok(ev.some((e) => e[0] === C.E_RESET && e[2] === 1), "the reset (asked for)");
    worst = Math.max(worst, r.progress(0) - pg);
    assert.ok(r.place(0) >= place, "no place gained");
    // The hold: the bike stays put for the reset's cost.
    const x = b.pos[0], z = b.pos[2];
    raceTo(r, I, Math.floor(60 * (C.RESET_HOLD - 0.1)));
    assert.ok(Math.hypot(b.pos[0] - x, b.pos[2] - z) < 0.05, "held on the line");
  }
  assert.ok(worst < 0, `every reset loses progress (worst ${worst.toFixed(2)})`);
});

const A = await import("../src/modes/bigair/show.ts");

test("big air unstuck: wedged → the prompt → back to the run-in of the jump; R does it at once", () => {
  const sh = A.airShow(3, { power: t.power, shape: t.shape }), I = new Float64Array(6), b = sh.b;
  sh.go(t.power);
  const run = (n, pin = null) => {
    const seen = [];
    for (let i = 0; i < n; i++) {
      sh.step(1 / 60, I, false);
      if (pin) (b.pos[0] = pin[0]), (b.pos[2] = pin[1]), (b.S[5] = 0);
      for (let k = 0; k < sh.n; k++) seen.push([sh.ev[k * 2], sh.ev[k * 2 + 1], i]);
      sh.clear();
    }
    return seen;
  };
  I[0] = 1;
  run(60 * 3);
  for (let i = 0; i < 600 && (b.crashed || b.air > 0); i++) run(1);
  I[0] = 0.5; I[2] = -1;
  const ev = run(60 * 5, [b.pos[0], b.pos[2]]);
  const prompt = ev.find((e) => e[0] === A.E_STUCK && e[1] === 1), reset = ev.find((e) => e[0] === A.E_RESET);
  assert.ok(prompt && reset && reset[1] === 2, "the prompt, then the automatic reset");
  assert.ok(prompt[2] / 60 >= 1.9 && reset[2] / 60 >= 3.9 && reset[2] / 60 < 4.6, `prompt ${(prompt[2] / 60).toFixed(2)} s, reset ${(reset[2] / 60).toFixed(2)} s`);
  const runIns = A.KICK.map((k) => (((k - 10.5) % A.LAP) + A.LAP) % A.LAP);
  const at = A.sAt(sh.nearIndex());
  assert.ok(runIns.some((s) => Math.abs(s - at) < 0.6), `on a run-in (${at.toFixed(1)} of ${runIns.map((s) => s.toFixed(1))})`);
  assert.ok(!b.crashed && Math.abs(b.rel) < 0.05, "upright");
  I[0] = 1; I[2] = 0;
  run(60 * 2);
  for (let i = 0; i < 600 && b.crashed; i++) run(1);
  I[5] = 1;
  const ev2 = run(1);
  I[5] = 0;
  assert.ok(ev2.some((e) => e[0] === A.E_RESET && e[1] === 1), "R resets");
});

const Wc = await import("../src/modes/wheelie/city.ts");

test("endless wheelie city unstuck: wedged → the prompt → back to the last good spot on the street; R too", () => {
  const run = Wc.cityRun(undefined, 1, true), I = new Float64Array(5), b = () => run.bike.b;
  let hold = false;
  const go = (n, person, pin = null, again = false) => {
    const seen = [];
    for (let i = 0; i < n; i++) {
      if (!pin && !hold) run.autopilot(I);
      run.step(1 / 60, I[0], I[1], I[2], I[3], I[4], person, again && i === 0);
      for (let k = 0; k < run.n; k++) seen.push([run.ev[k * 2], run.ev[k * 2 + 1], i]);
      run.clear();
      // The trap holds it until the reset.
      if (seen.some((e) => e[0] === Wc.E_RESET)) pin = null;
      if (pin) (b().pos[0] = pin[0]), (b().pos[2] = pin[1]), (b().S[5] = 0);
    }
    return seen;
  };
  go(60 * 12, true);
  for (let i = 0; i < 600 && (b().crashed || run.bike.air || run.S[Wc.S_FLY]); i++) go(1, true);
  const pin = [b().pos[0], b().pos[2]];
  I.fill(0); I[0] = 0.5; I[2] = 1;
  hold = true;
  const ev = go(60 * 5, true, pin);
  hold = false;
  const prompt = ev.find((e) => e[0] === Wc.E_STUCK && e[1] === 1), reset = ev.find((e) => e[0] === Wc.E_RESET);
  assert.ok(prompt && reset && reset[1] === 2, "the prompt, then the automatic reset");
  assert.ok(prompt[2] / 60 >= 1.9 && reset[2] / 60 >= 3.9 && reset[2] / 60 < 4.6, `prompt ${(prompt[2] / 60).toFixed(2)} s, reset ${(reset[2] / 60).toFixed(2)} s`);
  const x = b().pos[0], z = b().pos[2];
  assert.ok(Math.hypot(x - pin[0], z - pin[1]) >= 2, "never back into the trap");
  assert.ok(run.town.streetClear(x, z, 0.4), "on the street, clear");
  assert.ok(!b().crashed && Math.abs(b().rel) < 0.05, "upright");
  go(60 * 3, true);
  for (let i = 0; i < 600 && (b().crashed || run.bike.air || run.S[Wc.S_FLY]); i++) go(1, true);
  const ev2 = go(1, true, null, true);
  assert.ok(ev2.some((e) => e[0] === Wc.E_RESET && e[1] === 1), "R resets");
});
