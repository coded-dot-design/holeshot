// Zero allocation per step (young-generation GCs, node --expose-gc), in a process of its own: one
// bike's ride, and each mode's sim with the ride meter ticking: Free Ride, Big Air and Endless Wheelie City
// on one bike measure none, nor does Wheelie City's patrol; a race of four and a Wheelie City session stay bounded (V8 boxes a few
// doubles in the bike's step there: four instances in a race; the city's walls and kerbs knocking
// it about; two or three scavenges a session, measured; bounded so it cannot grow).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const B = await import("../src/bike/bike.ts");
const { tune } = await import("../src/model/tune.ts");
const { newBike } = await import("../src/model/profile.ts");
const { meter } = await import("../src/modes/meter.ts");
const C = await import("../src/modes/race/course.ts");
const { freeRun } = await import("../src/modes/freeride/session.ts");
const A = await import("../src/modes/bigair/show.ts");
const W = await import("../src/modes/wheelie/city.ts");
const flat = { sample(x, z, o) { o[0] = 0; o[1] = 0; o[2] = 1; o[3] = 0; return 0; } };
const t = tune(newBike("buzzline", "b1"));
const measure = async (work) => (work(), work(), minorGCs(work, 5));

test("alloc: one bike walked about (stopped, the lean held: the push, the probe), 6,000 steps", async () => {
  const b = B.bike(flat, t.power, { ...t.shape, walk: (p) => p[0] * p[0] + p[1] * p[1] < 400 });
  const n = await measure(() => {
    b.reset(0, 0, 0);
    for (let i = 0; i < 6000; i++) (b.set(i % 600 > 500 ? 1 : 0, 0, i % 200 < 100 ? 1 : -1, Math.sin(i * 0.02)), b.step(1 / 60), b.clear());
  });
  assert.ok(n <= 1, `${n} young-generation GCs`);
});

test("alloc: one bike, 6,000 steps", async () => {
  const b = B.bike(flat, t.power, t.shape);
  const n = await measure(() => {
    b.reset(0, 0, 0);
    for (let i = 0; i < 6000; i++) (b.set(i % 90 < 60 ? 1 : 0, i % 90 > 80 ? 1 : 0, Math.sin(i * 0.05), Math.sin(i * 0.02)), b.step(1 / 60), b.clear());
  });
  assert.ok(n <= 1, `${n} young-generation GCs`);
});

test("alloc: Free Ride with the meter, 3,000 steps", async () => {
  const f = freeRun(C.makeTrack(C.MOTO_TRACK), { power: t.power, shape: t.shape }), I = new Float64Array(5), m = meter("freeride");
  const n = await measure(() => {
    f.reset();
    for (let i = 0; i < 3000; i++) (f.step(1 / 60, I, true), m.tick(f.riders[0], 1 / 60), f.clear());
  });
  assert.ok(n <= 1, `${n} young-generation GCs`);
});

test("alloc: Free Ride on each open map with the meter, 3,000 steps", async () => {
  const M = await import("../src/modes/freeride/maps.ts");
  for (const def of M.RIDE_MAPS) {
    const f = freeRun(M.makeMap(def), { power: t.power, shape: t.shape }), I = new Float64Array(5), m = meter("freeride");
    const n = await measure(() => {
      f.reset();
      for (let i = 0; i < 3000; i++) (f.step(1 / 60, I, true), m.tick(f.riders[0], 1 / 60), f.clear());
    });
    assert.ok(n <= 1, `${def.id}: ${n} young-generation GCs`);
  }
});

test("alloc: Big Air, a whole run", async () => {
  const sh = A.airShow(3, { power: t.power, shape: t.shape }), I = new Float64Array(6), m = meter("bigair");
  const n = await measure(() => {
    sh.go(t.power);
    for (let i = 0; i < 60 * 62 && sh.phase !== A.DONE; i++) (sh.step(1 / 60, I, true), m.tick(sh.b, 1 / 60), sh.clear());
  });
  assert.ok(n <= 1, `${n} young-generation GCs`);
});

test("alloc: Endless Wheelie City, a minute and a half", async () => {
  const { openRun } = await import("../src/modes/wheelie/roam.ts");
  const run = openRun([{ id: "x", name: "x", kind: "", blurb: "", bars: [3, 3, 3], power: t.power, shape: t.shape, sweet: t.sweet, hop: t.hop }], 1), I = new Float64Array(5), m = meter("endcity");
  const n = await measure(() => {
    run.reset(0);
    for (let i = 0; i < 60 * 92; i++) (run.autopilot(I), run.step(1 / 60, I[0], I[1], I[2], I[3], I[4]), m.tick(run.bike.b, 1 / 60), run.clear());
  });
  assert.ok(n <= 5, `${n} young-generation GCs over a session`);
});

test("alloc: Wheelie City's patrol (heat, spawns, the chase on the street graph, tickets), 20,000 steps", async () => {
  const { TIX } = await import("../src/modes/wheelie/cops.ts");
  const cop = W.fixedCops(3), X = new Float64Array(1);
  const n = await measure(() => {
    cop.reset(3);
    for (let i = 0; i < 20000; i++) {
      if (i % 500 === 0) cop.heat(70);
      X[0] = -53 + (i % 1200 < 600 ? (i % 600) / 15 : 40 - (i % 600) / 15);
      cop.step(1 / 60, X[0], i % 2000 < 1000 ? -9.5 : -26.5, 0, false, true);
      cop.clear();
    }
  });
  assert.ok(cop.S[TIX] > 5, "it chases and catches");
  assert.ok(n <= 1, `${n} young-generation GCs`);
});

test("alloc: a race of four stays bounded", async () => {
  const r = C.motoRace(5, C.makeTrack(C.MOTO_TRACK), { power: t.power, shape: t.shape }), I = new Float64Array(5), m = meter("race");
  const n = await measure(() => {
    r.go(t.power);
    for (let i = 0; i < 60 * 50 && r.phase !== C.DONE; i++) (r.step(1 / 60, I, true), m.tick(r.riders[0], 1 / 60), r.clear());
  });
  assert.ok(n <= 5, `${n} young-generation GCs over a race of four`);
});
