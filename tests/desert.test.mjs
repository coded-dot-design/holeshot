// Endless Desert and Unstuck, headless. The ground is a pure function of the seed and the place
// (same seed and chunk, same bytes; another seed, other sand), the window the bike rides only ever
// copies it (a height read through the window equals the pure height, wherever the window has been),
// a 10 km ride on the autopilot never reaches the window's edge (the rider is always at least 24
// units from it, more than the haze's full line) and allocates nothing per step after warm-up.
// Unstuck: a bike driven into a wall with the gas held gets the prompt, then resets on its own;
// the reset lands upright on the ground, behind the trap (never within 2 units of it), and the bike
// rides off at once (more than 2 units in a second on the gas). R (the reset input) resets on the
// next step. The profile keeps the best distance (v2 → v3 migration; apply keeps the best).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const Wm = await import("../src/modes/desert/world.ts");
const { desertTrack } = await import("../src/modes/desert/track.ts");
const { freeRun, E_RESET, E_STUCK } = await import("../src/modes/freeride/session.ts");
const U = await import("../src/modes/unstuck.ts");
const B = await import("../src/bike/bike.ts");
const { tune } = await import("../src/model/tune.ts");
const { newBike, migrate, fresh, VERSION } = await import("../src/model/profile.ts");
const { apply, settle } = await import("../src/model/economy.ts");
const { blankStats } = await import("../src/modes/mode.ts");
const t = tune(newBike("buzzline", "b1"));

test("desert: chunk content is a pure function of seed and chunk", () => {
  for (const [ci, cj] of [[0, 0], [12, -7], [-300, 410], [1250, 3]]) {
    assert.deepEqual(Wm.chunkBytes(2611, ci, cj), Wm.chunkBytes(2611, ci, cj), `chunk ${ci},${cj}`);
    assert.notDeepEqual(Wm.chunkBytes(2611, ci, cj), Wm.chunkBytes(2612, ci, cj), `another seed, other sand at ${ci},${cj}`);
  }
});

test("desert: the window reads the pure ground wherever it has been", () => {
  const w = Wm.world(2611), G = new Float64Array(4);
  for (const [x, z] of [[0, 0], [5000, -1200], [37, 18], [-80, 9999]]) {
    w.follow(x, z);
    for (let k = 0; k < 40; k++) {
      // On a vertex the window's height is the pure height exactly.
      const vx = (Math.floor(x / Wm.CELL) + (k % 9) - 4) * Wm.CELL, vz = (Math.floor(z / Wm.CELL) + ((k * 7) % 11) - 5) * Wm.CELL;
      w.t.sample(vx, vz, G);
      assert.equal(G[0], Wm.heightAt(2611, vx, vz), `vertex ${vx},${vz}`);
    }
  }
});

test("desert: the far ring is the same ground, coarser, out past 250 units", () => {
  const f = Wm.world(2611, Wm.FAR_WIN, Wm.FAR_CELL, Wm.FAR_STEP), G = new Float64Array(4);
  for (const [x, z] of [[0, 0], [5000, -1200], [-80, 9999]]) {
    f.follow(x, z);
    const half = (Wm.FAR_WIN * Wm.FAR_CELL) / 2;
    assert.ok(x - f.t.x0 > 250 && f.t.x0 + 2 * half - x > 250 && z - f.t.z0 > 250 && f.t.z0 + 2 * half - z > 250, "250 units every way");
    for (let k = 0; k < 20; k++) {
      const vx = (Math.floor(x / Wm.FAR_CELL) + (k % 7) * 9 - 27) * Wm.FAR_CELL, vz = (Math.floor(z / Wm.FAR_CELL) + ((k * 5) % 9) * 7 - 28) * Wm.FAR_CELL;
      f.t.sample(vx, vz, G);
      assert.equal(G[0], Wm.heightAt(2611, vx, vz), `far vertex ${vx},${vz}`);
    }
  }
});

test("desert: 10 km on the autopilot: no edge, no allocation per step", async () => {
  const tr = desertTrack(), f = freeRun(tr, { power: t.power, shape: t.shape }, 1e9), I = new Float64Array(5), w = tr.world;
  I[0] = 1;
  f.step(1 / 60, I, false);
  const WO = new Float64Array(1).fill(Infinity);
  let steps = 0;
  const ride = (n) => {
    for (let i = 0; i < n; i++) {
      f.step(1 / 60, I, true);
      f.clear();
      const b = f.riders[0], src = b.crashed ? b.rider : b.pos;
      const m = Math.min(src[0] - w.t.x0, w.t.x0 + Wm.WIN * Wm.CELL - src[0], src[2] - w.t.z0, w.t.z0 + Wm.WIN * Wm.CELL - src[2]);
      if (m < WO[0]) WO[0] = m;
    }
    steps += n;
  };
  while (f.distance < 10000 && steps < 60 * 1500) ride(600);
  assert.ok(f.distance >= 10000, `rode ${f.distance.toFixed(0)} units`);
  assert.ok(WO[0] >= 24, `the rider stays ${WO[0].toFixed(1)} units inside the window (haze full at 35 from the bike, from the camera's side ≥ 24)`);
  assert.ok(w.stats[0] > 1000, `the window slid ${w.stats[0]} times`);
  const n = await minorGCs(() => ride(3000), 5);
  assert.ok(n <= 1, `${n} young-generation GCs over 3,000 steps`);
});

// A flat floor; at x = 0 the bike is wedged (held where it is, as scenery or a lip would hold it:
// the race gate's hold), the gas pinned.
const wall = { sample(x, z, o) { o[0] = 0; o[1] = 0; o[2] = 1; o[3] = 0; return 0; } };
test("unstuck: wedged: the prompt, then an automatic reset behind the trap that rides off", () => {
  const b = B.bike(wall, t.power, t.shape), u = U.unstuck(wall, () => true);
  b.reset(-40, 0.3, 0);
  let saw = 0, auto = 0, i = 0;
  for (; i < 60 * 20 && !auto; i++) {
    // Full gas on the run in; at the trap, half gas, weight forward (the front stays down).
    b.set(b.pos[0] > -1 ? 0.5 : 1, 0, b.pos[0] > -1 ? -1 : 0, 0, 0);
    const hx = b.pos[0];
    b.step(1 / 60);
    if (b.pos[0] > 0) (b.pos[0] = Math.max(0, hx)), (b.S[5] = 0);
    b.clear();
    const r = u.watch(b, 1 / 60, true);
    if (r === U.U_PROMPT) saw = saw || i;
    if (r === U.U_AUTO) auto = i;
  }
  assert.ok(saw > 0 && auto > saw, `prompt at step ${saw}, auto reset at ${auto}`);
  const stuckX = b.pos[0];
  assert.ok(stuckX > -2 && stuckX < 0.5, `wedged at the wall (x ${stuckX.toFixed(2)})`);
  const o = u.reset(b);
  assert.ok(o[0] < stuckX - 2, `lands behind the trap (${o[0].toFixed(1)} vs ${stuckX.toFixed(1)})`);
  assert.ok(!b.crashed && Math.abs(b.rel) < 0.05 && b.contact[0] && b.contact[1], "upright, on both wheels");
  const x0 = b.pos[0];
  for (let k = 0; k < 60; k++) (b.set(1, 0, 0, 0, 0), b.step(1 / 60), b.clear());
  assert.ok(b.pos[0] - x0 > 2, `rides off: ${(b.pos[0] - x0).toFixed(2)} units in a second`);
});

test("unstuck: R resets the desert rider to the last good place, behind, upright", () => {
  const tr = desertTrack(), f = freeRun(tr, { power: t.power, shape: t.shape }, 1e9), I = new Float64Array(5);
  I[0] = 1;
  f.step(1 / 60, I, false);
  for (let i = 0; i < 60 * 12; i++) (f.step(1 / 60, I, true), f.clear());
  const b = f.riders[0];
  // Wait for a moment on the wheels (a reset mid-crash is the crash's own respawn).
  for (let i = 0; i < 600 && (b.crashed || b.air > 0); i++) (f.step(1 / 60, I, true), f.clear());
  const x = b.pos[0], z = b.pos[2];
  I[4] = U.RESET;
  f.step(1 / 60, I, false);
  let reset = 0;
  for (let k = 0; k < f.n; k++) if (f.ev[k * 3] === E_RESET) reset = f.ev[k * 3 + 2];
  assert.equal(reset, 1, "the reset event (asked for)");
  const d = Math.hypot(b.pos[0] - x, b.pos[2] - z);
  assert.ok(d >= 2 && d < 40, `moved back ${d.toFixed(1)} units`);
  assert.ok(!b.crashed && Math.abs(b.rel) < 0.05 && b.speed === 0, "upright and still");
  void E_STUCK;
});

test("profile: best distance (v2 → v3) and apply keeps the best", () => {
  assert.equal(VERSION, 3);
  const v2 = { ...fresh(), v: 2, stats: { events: 4, wins: 1, earned: 900, best: { "race:moto": 80 } } };
  delete v2.stats.far;
  const p = migrate(v2);
  assert.deepEqual([p.v, p.stats.far.desert, p.stats.best["race:moto"], p.stats.events], [3, 0, 80, 4]);
  const ride = (far) => ({ ...blankStats("desert"), finished: true, seconds: 60, distance: far, far });
  const b = newBike("buzzline", "b1");
  let q = { ...p, bikes: [b] };
  q = apply(q, settle(ride(3200), b));
  assert.equal(q.stats.far.desert, 3200);
  q = apply(q, settle(ride(1500), q.bikes[0]));
  assert.equal(q.stats.far.desert, 3200, "a shorter ride keeps the best");
  assert.ok(settle(ride(3200), b).lines.some((l) => l[0] === "3.20 KM"), "the distance pays a line");
});
