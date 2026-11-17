// Endless Wheelie City and the endless grounds, headless. The city is the four hoods as reused slots
// in a row: slot k's kind is a pure function of k and the seed, two side by side never the same kind
// (so one built hood a kind is enough), every join lined up (the east hump of slot k and the west hump
// of slot k + 1 on the same street, the road reaching both: no gap), and a 10 km ride on the
// autopilot hops every canal with no unstuck rescue, never leaves the row, and allocates no more
// per step than the fixed table does; the same inputs give the same bytes. The fixed Wheelie
// City is untouched (tests/golden.test.mjs holds its hashes). Each endless ground (the quarry, the
// woods, the night park) is pure (same seed and chunk, same bytes; its own ground, not the desert's)
// and a 10 km ride on it never reaches the window's edge. The profile keeps a best per ground and the
// city's (`stats.far.city`; v3 → v4 migration).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const C = await import("../src/modes/wheelie/city.ts");
const H = await import("../src/modes/wheelie/hoods.ts");
const Wm = await import("../src/modes/desert/world.ts");
const { desertTrack, BIOMES } = await import("../src/modes/desert/track.ts");
const { freeRun } = await import("../src/modes/freeride/session.ts");
const { tune } = await import("../src/model/tune.ts");
const { newBike, migrate, fresh } = await import("../src/model/profile.ts");
const { apply, settle } = await import("../src/model/economy.ts");
const { blankStats } = await import("../src/modes/mode.ts");
const t = tune(newBike("sparkhound", "b1"));
const spec = { id: "x", name: "x", kind: "", blurb: "", bars: [3, 3, 3], power: t.power, shape: t.shape, sweet: t.sweet, hop: t.hop };

test("endless city: the slots: pure, neighbours never the same kind, every kind used", () => {
  const seen = new Set();
  for (let k = -400; k < 400; k++) {
    const a = C.slotKind(k), b = C.slotKind(k + 1);
    assert.ok(a >= 0 && a < 4 && a !== b, `slots ${k}, ${k + 1}: ${a}, ${b}`);
    assert.equal(a, C.slotKind(k), "pure");
    seen.add(a);
  }
  assert.equal(seen.size, 4);
  assert.notDeepEqual(Array.from({ length: 40 }, (_, k) => C.slotKind(k, 1)), Array.from({ length: 40 }, (_, k) => C.slotKind(k, 2)), "another seed, another row");
});

test("endless city: every join is seamless: road to the hump on both sides, the humps in line", () => {
  const T = C.town(true);
  for (let k = -3; k < 120; k++) {
    const x1 = (k + 1) * C.PITCH - C.PITCH / 2;
    // From the middle of slot k to the middle of slot k + 1 along the south street: road (or the
    // boardwalk) up to the hump, the ramp up, the deck to the bank, the canal, and the same back.
    for (let x = k * C.PITCH; x <= (k + 1) * C.PITCH; x += 0.25) {
      const lx = x - C.slotAt(x) * C.PITCH, ax = Math.abs(lx), kd = T.kindAt(x, C.SLOT_Z);
      if (ax <= H.HX - H.LIP - H.RAMP - H.DECK - 0.5 && ax > 3) assert.ok(kd === H.K_ROAD || kd === H.K_BOARD || kd === H.K_PLAZA, `road at x ${x.toFixed(2)} (slot ${C.slotAt(x)}, kind ${kd})`);
      if (ax > H.HX - H.DECK && ax < H.HX + H.BANK - 0.05) assert.equal(T.height(x, C.SLOT_Z), H.HUMP_H, `the deck at x ${x.toFixed(2)}`);
    }
    // The two lips face each other across the canal at the same z.
    const e = (k * C.PITCH) + H.HX - H.LIP, w = ((k + 1) * C.PITCH) - (H.HX - H.LIP);
    assert.ok(Math.abs(w - e - (C.PITCH - 2 * (H.HX - H.LIP))) < 1e-9 && x1 > e && x1 < w, `join ${k}`);
  }
});

test("endless city: 10 km on the autopilot: every canal hopped, no rescue, no allocation per step", async () => {
  const run = C.cityRun([spec], 5, true), I = new Float64Array(5);
  let steps = 0, offStreet = 0;
  const ride = (n) => {
    for (let i = 0; i < n; i++) {
      run.autopilot(I);
      run.step(1 / 60, I[0], I[1], I[2], I[3], I[4]);
      run.clear();
      const z = run.bike.b.pos[2];
      if (z < -H.HZ || z > H.HZ) offStreet++;
    }
    steps += n;
  };
  while (run.far < 10000 && steps < 60 * 1200) ride(600);
  assert.ok(run.far >= 10000, `rode ${run.far.toFixed(0)} units`);
  assert.ok(run.slot >= 90, `${run.slot} slots on`);
  assert.equal(run.S[C.S_JUMPS], run.slot, "one hump a slot");
  assert.equal(run.S[C.S_UNSTUCK], 0, "never wedged");
  assert.equal(offStreet, 0, "never off the row");
  // (The town's ground boxes a few doubles a step on the fixed table too: Wheelie City's own alloc
  // test allows 5 GCs a session. The endless row adds nothing to that: no more than the fixed table.)
  const n = await minorGCs(() => ride(3000), 5);
  const fx = C.cityRun([spec], 5), J = new Float64Array(5);
  const fixed = await minorGCs(() => { for (let i = 0; i < 3000; i++) { fx.autopilot(J); fx.step(1 / 60, J[0], J[1], J[2], J[3], J[4]); fx.clear(); if (fx.S[0] === C.DONE) fx.reset(0); } }, 5);
  assert.ok(n <= Math.max(1, fixed), `${n} young-generation GCs over 3,000 steps (the fixed table: ${fixed})`);
});

test("endless city: deterministic: the same inputs, the same bytes", () => {
  const go = () => {
    const run = C.cityRun([spec], 9, true), I = new Float64Array(5);
    for (let f = 0; f < 60 * 120; f++) (run.autopilot(I), run.step(1 / 60, I[0], I[1], I[2], I[3], I[4]), run.clear());
    return Buffer.concat(run.bytes.map((b) => Buffer.from(b))).toString("base64");
  };
  assert.equal(go(), go());
});

test("endless grounds: pure, each its own, and 10 km with no edge", () => {
  for (const b of BIOMES.slice(1)) {
    for (const [ci, cj] of [[0, 0], [40, -7], [-300, 410], [1250, 3]]) {
      assert.deepEqual(Wm.chunkBytes(b.seed, ci, cj, 8, b.bi), Wm.chunkBytes(b.seed, ci, cj, 8, b.bi), `${b.id} chunk ${ci},${cj}`);
      assert.notDeepEqual(Wm.chunkBytes(b.seed, ci, cj, 8, b.bi), Wm.chunkBytes(b.seed, ci, cj, 8, 0), `${b.id}: not the desert's ground`);
    }
    const tr = desertTrack(undefined, b.id), f = freeRun(tr, { power: t.power, shape: t.shape }, 1e9), I = new Float64Array(5), w = tr.world;
    assert.equal(w.biome, b.bi);
    I[0] = 1;
    f.step(1 / 60, I, false);
    let m = Infinity, steps = 0;
    while (f.distance < 10000 && steps < 60 * 1500) {
      for (let i = 0; i < 600; i++) {
        f.step(1 / 60, I, true);
        f.clear();
        const r = f.riders[0], src = r.crashed ? r.rider : r.pos;
        m = Math.min(m, src[0] - w.t.x0, w.t.x0 + Wm.WIN * Wm.CELL - src[0], src[2] - w.t.z0, w.t.z0 + Wm.WIN * Wm.CELL - src[2]);
      }
      steps += 600;
    }
    assert.ok(f.distance >= 10000, `${b.id}: rode ${f.distance.toFixed(0)} units`);
    assert.ok(m >= 24, `${b.id}: the rider stays ${m.toFixed(1)} units inside the window`);
  }
});

test("profile: a best per endless ground and the city's (v3 → v4), apply keeps the best", () => {
  const v3 = { ...fresh(), v: 3, stats: { events: 2, wins: 0, earned: 10, best: {}, far: { desert: 4100 } } };
  const p = migrate(v3);
  assert.deepEqual([p.v, p.stats.far.desert, p.stats.far.city, p.stats.far.forest], [4, 4100, 0, 0]);
  const b = newBike("buzzline", "b1");
  let q = { ...p, bikes: [b] };
  q = apply(q, settle({ ...blankStats("endcity"), finished: true, seconds: 60, distance: 2400, far: 2400, farKey: "city" }, b));
  q = apply(q, settle({ ...blankStats("desert"), finished: true, seconds: 60, distance: 900, far: 900, farKey: "forest" }, q.bikes[0]));
  q = apply(q, settle({ ...blankStats("endcity"), finished: true, seconds: 60, distance: 800, far: 800, farKey: "city" }, q.bikes[0]));
  assert.deepEqual([q.stats.far.city, q.stats.far.forest, q.stats.far.desert], [2400, 900, 4100]);
});
