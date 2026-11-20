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
/** A 2D context that draws nothing, one for every ribbon test (two of them would make the painter's
 *  calls into it polymorphic, and the doubles it passes would be boxed: a test artifact, not the game's). */
const c2 = { fillStyle: "", beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {} };
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

test("alloc: Endless Wheelie City's road ribbons, 600 frames along a ride", async () => {
  const { openRun } = await import("../src/modes/wheelie/roam.ts");
  const { roadRibbons } = await import("../src/modes/wheelie/ribbons.ts");
  const run = openRun([{ id: "x", name: "x", kind: "", blurb: "", bars: [3, 3, 3], power: t.power, shape: t.shape, sweet: t.sweet, hop: t.hop }], 1), I = new Float64Array(5);
  // A chase camera 9 units back from the bike, looking along +x (the diorama's camera), and a 2D context that draws nothing.
  const view = { width: 1440, height: 900, cam: { yaw: -Math.PI / 2, pitch: 0.45, dist: 9, tx: 0, ty: 0, tz: 0, fov: 0.9, ox: 0, oy: 0 } };
  const rib = roadRibbons(run.world, run.win.t, view);
  rib.colors(["#6b7088", "#dcd6cc", "#7cc47a", "#cdbf9f", "#b98a5e", "#c8d36a", "#74c69d"], [0.6, 1, 0.45], 0.58);
  // The ride first (its own allocation is the session test's), then the frames along it, measured.
  const P = new Float64Array(600 * 3);
  run.reset(0);
  for (let i = 0; i < 600; i++) {
    run.autopilot(I); run.step(1 / 60, I[0], I[1], I[2], I[3], I[4]); run.clear();
    const b = run.bike.b.pos;
    P[i * 3] = b[0]; P[i * 3 + 1] = b[1]; P[i * 3 + 2] = b[2];
  }
  let quads = 0;
  const n = await measure(() => {
    for (let i = 0; i < 600; i++) {
      const x = P[i * 3], z = P[i * 3 + 2];
      run.win.follow(x, z);
      view.cam.tx = x; view.cam.ty = P[i * 3 + 1]; view.cam.tz = z;
      rib.at[0] = x; rib.at[1] = z; rib.at[2] = 48;
      rib.paint(c2);
      quads += rib.stats.quads;
    }
  });
  assert.ok(quads > 0, "the ribbons drew");
  assert.ok(n <= 1, `${n} young-generation GCs over 600 frames`);
});

test("alloc: Track Day's line ribbons (run-off, asphalt, run-off; cut where the ground hides them), 600 frames round a circuit", async () => {
  const { ribbons, lineRibbon } = await import("../src/modes/ribbons.ts");
  const { circuit } = await import("../src/modes/race/circuits.ts");
  const tr = C.makeTrack(circuit("td-knotworks")), ter = tr.course(), P = tr.TRACK, n = tr.NT, hw = tr.W / 2, off = hw + C.TD_RUNOFF;
  const view = { width: 1440, height: 900, cam: { yaw: 0, pitch: 0.36, dist: 9.5, tx: 0, ty: 0, tz: 0, fov: 0.9, ox: 0, oy: 0 } };
  const R = ribbons(ter, view, 2, 48, 4096), L = lineRibbon(R, P, n, [-off, -hw, hw, off], [0, 1, 0], () => 0);
  R.colors(["#c4beb2", "#555766"], [-0.4, 1, 0.5], 0.5);
  // The camera's places round the lap first (the frames are what is measured).
  const CP = new Float64Array(600 * 4);
  for (let f = 0; f < 600; f++) {
    const i = (f * 3) % n, j = (i + 1) % n, dx = P[j * 2] - P[i * 2], dz = P[j * 2 + 1] - P[i * 2 + 1];
    CP[f * 4] = P[i * 2]; CP[f * 4 + 1] = ter.height(P[i * 2], P[i * 2 + 1]) + 0.9; CP[f * 4 + 2] = P[i * 2 + 1]; CP[f * 4 + 3] = Math.atan2(-dx, -dz);
  }
  let quads = 0;
  const n2 = await measure(() => {
    for (let f = 0; f < 600; f++) {
      view.cam.tx = CP[f * 4]; view.cam.ty = CP[f * 4 + 1]; view.cam.tz = CP[f * 4 + 2]; view.cam.yaw = CP[f * 4 + 3];
      R.begin(); L.paint(); R.flush(c2);
      quads += R.stats.quads;
    }
  });
  assert.ok(quads > 0, "the ribbons drew");
  assert.ok(n2 <= 1, `${n2} young-generation GCs over 600 frames`);
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
