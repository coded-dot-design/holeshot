// Endless Wheelie City and the endless grounds, headless. The city is an open world (roads, towns and
// fields that never end): its chunks are pure (same seed and place, same bytes, whatever the caches
// hold), its roads continuous across every border, smooth along and level across, with no dead ends
// and never far away; its towns stand along their roads facing them; a 20 km ride along the roads in
// random directions never reaches the streamed window's edge, passes town after town and allocates
// nothing per step; the same inputs give the same bytes. The fixed Wheelie City's table is untouched
// (tests/golden.test.mjs holds its hashes). Each endless ground (the quarry, the
// woods, the night park) is pure (same seed and chunk, same bytes; its own ground, not the desert's)
// and a 10 km ride on it never reaches the window's edge. The profile keeps a best per ground and the
// city's (`stats.far.city`; v3 → v4 migration).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const O = await import("../src/modes/wheelie/open.ts");
const R = await import("../src/modes/wheelie/roam.ts");
const Wm = await import("../src/modes/desert/world.ts");
const { desertTrack, BIOMES } = await import("../src/modes/desert/track.ts");
const { freeRun } = await import("../src/modes/freeride/session.ts");
const { tune } = await import("../src/model/tune.ts");
const { newBike, migrate, fresh } = await import("../src/model/profile.ts");
const { apply, settle } = await import("../src/model/economy.ts");
const { blankStats } = await import("../src/modes/mode.ts");
const t = tune(newBike("sparkhound", "b1"));
const spec = { id: "x", name: "x", kind: "", blurb: "", bars: [3, 3, 3], power: t.power, shape: t.shape, sweet: t.sweet, hop: t.hop };

test("open world: chunks are pure: the same seed and place, the same bytes; another seed, another world", () => {
  for (const [ci, cj] of [[0, 0], [7, -3], [-120, 95], [800, 41]]) {
    assert.deepEqual(O.openChunk(O.CITY_SEED, ci, cj), O.openChunk(O.CITY_SEED, ci, cj), `chunk ${ci},${cj}`);
    // (A fresh world each time: the caches never change what the ground is.)
    const W = O.openWorld(O.CITY_SEED);
    for (let k = 0; k < 40; k++) W.heightQ(ci * 8 + k * 37.3, cj * 8 - k * 11.1);
    const bytes = new Uint8Array(new Float64Array(Array.from({ length: 50 }, (_, k) => (W.heightQ(ci * 8 + k * 0.7, cj * 8 + k * 0.3), W.HQ[0]))).buffer);
    const W2 = O.openWorld(O.CITY_SEED);
    const bytes2 = new Uint8Array(new Float64Array(Array.from({ length: 50 }, (_, k) => (W2.heightQ(ci * 8 + k * 0.7, cj * 8 + k * 0.3), W2.HQ[0]))).buffer);
    assert.deepEqual(bytes, bytes2, `cache-independent at ${ci},${cj}`);
  }
  assert.notDeepEqual(O.openChunk(1, 3, 3), O.openChunk(2, 3, 3), "another seed, another world");
});

test("open world: roads are continuous across chunk and lattice borders, smooth and level across, and never dead-end", () => {
  const W = O.openWorld(O.CITY_SEED);
  let samples = 0, worstGap = 0, worstStep = 0, worstCross = 0;
  for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) for (let dir = 0; dir < 2; dir++) {
    const e = W.edge(i, j, dir);
    if (e < 0) continue;
    const L = W.EF[e * 8 + 1], hw = W.EF[e * 8];
    let px = NaN, pz = NaN, py = NaN;
    for (let s = 0; s <= L; s += 0.5) {
      W.at(e, s);
      const x = W.PQ[0], z = W.PQ[1];
      // On the road: the ground's own query finds a road here, and its height is the road's.
      W.roadQ(x, z);
      assert.ok(W.RQ[0] <= 1e-6 || W.RQ[3] === 1, `edge ${i},${j},${dir} at ${s.toFixed(1)}: on a road (${W.RQ[0].toFixed(3)})`);
      W.heightQ(x, z);
      const y = W.HQ[0] - (W.RQ[9] || 0), isle = W.RQ[3] === 1;
      // (A roundabout's island is a curb's height up: skipped.)
      if (isle) { px = NaN; continue; }
      if (px === px) worstGap = Math.max(worstGap, Math.hypot(x - px, z - pz)), worstStep = Math.max(worstStep, Math.abs(y - py) / Math.hypot(x - px, z - pz || 1));
      // Level across: the road's height a lane either side.
      const tx = W.PQ[2], tz = W.PQ[3];
      W.heightQ(x - tz * hw * 0.6, z + tx * hw * 0.6); const a = W.HQ[0];
      W.heightQ(x + tz * hw * 0.6, z - tx * hw * 0.6); const b = W.HQ[0];
      W.roadQ(x, z);
      if (!W.RQ[9] && W.RQ[3] !== 1) worstCross = Math.max(worstCross, Math.abs(a - b));
      px = x; pz = z; py = y; samples++;
    }
  }
  assert.ok(samples > 20000, `${samples} samples`);
  assert.ok(worstGap < 0.6, `continuous (largest step along a road ${worstGap.toFixed(3)} for 0.5)`);
  assert.ok(worstStep < 0.2, `smooth: the steepest grade along a road ${(worstStep * 100).toFixed(1)} %`);
  assert.ok(worstCross < 0.08, `level across (worst ${worstCross.toFixed(3)})`);
  // Every junction has at least two roads out of it (east and west always): no dead ends.
  for (let j = -30; j <= 30; j++) for (let i = -30; i <= 30; i++) {
    W.incident(i, j);
    assert.ok(W.IN[8] >= 2, `junction ${i},${j}: ${W.IN[8]} roads`);
  }
  // And a road is never far: from any point the nearest is within half a lattice cell or so.
  let far = 0;
  for (let k = 0; k < 4000; k++) {
    const x = Math.sin(k * 12.9898) * 43758.5453 % 1 * 6000, z = Math.sin(k * 78.233) * 12345.6789 % 1 * 6000;
    // (The true distance to the nearest road's middle: every road round it, sampled.)
    let best = Infinity;
    const ci = Math.floor(x / O.RC), cj = Math.floor(z / O.RC);
    for (let dir = 0; dir < 2; dir++) for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
      const e = W.edge(i, j, dir);
      if (e < 0) continue;
      for (let q = 0; q <= O.NS; q++) best = Math.min(best, Math.hypot(W.PT[e * W.EP + q * 4] - x, W.PT[e * W.EP + q * 4 + 1] - z));
    }
    far = Math.max(far, best);
  }
  assert.ok(far < O.RC * 0.75, `the farthest from a road: ${far.toFixed(1)} units`);
});

test("open world: towns stand along their roads (lots facing the street, clear of every road), with a gas station, houses, lamps and a sign", () => {
  const W = O.openWorld(O.CITY_SEED), G = new Float64Array(600 * O.IS);
  let towns = 0, buildings = 0, gas = 0, houses = 0;
  for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
    if (!W.isTown(i, j)) continue;
    towns++;
    W.nodeQ(i, j);
    const cx = W.NQ[0], cz = W.NQ[1], n = W.gather(cx, cz, O.TOWN_R + 4, G, 600);
    let here = 0;
    for (let q = 0; q < n; q++) {
      const o = q * O.IS, k = G[o];
      if (k >= O.I_PROP) continue;
      const x = G[o + 1], z = G[o + 2];
      if (Math.hypot(x - cx, z - cz) > O.TOWN_R + 2) continue;
      here++; buildings++;
      if (k === O.I_GAS) gas++;
      if (k === O.I_HOUSE || k === O.I_HOUSE2) houses++;
      // Along a road: its front a few units from the nearest road, never on one.
      W.roadQ(x, z);
      const ex = W.RQ[0];
      assert.ok(ex > G[o + 6] / 2 - 0.5 && ex < G[o + 6] / 2 + 6, `town ${i},${j}: building ${k} ${ex.toFixed(1)} from its road`);
      // It faces the road: its front (−uz, ux) points at it.
      const fx = -G[o + 4], fz = G[o + 3];
      W.roadQ(x + fx * (G[o + 6] / 2 + 3), z + fz * (G[o + 6] / 2 + 3));
      assert.ok(W.RQ[0] < ex, `town ${i},${j}: building ${k} faces its road`);
    }
    assert.ok(here >= 6, `town ${i},${j}: ${here} buildings`);
  }
  assert.ok(towns >= 20 && buildings > towns * 10, `${towns} towns, ${buildings} buildings`);
  assert.ok(gas >= towns / 3 && houses > buildings / 4, `${gas} gas stations, ${houses} houses`);
});

test("open world: a 20 km ride along the roads in random directions never leaves the streamed ground; towns come and go; no allocation per step", async () => {
  const run = R.openRun([spec], 5), I = new Float64Array(5), w = run.win.t;
  let odo = 0, px = run.bike.b.pos[0], pz = run.bike.b.pos[2], m = Infinity, steps = 0, offRoad = 0;
  const ride = (n) => {
    for (let i = 0; i < n; i++) {
      run.autopilot(I);
      run.step(1 / 60, I[0], I[1], I[2], I[3], I[4]);
      run.clear();
      const b = run.bike.b, src = b.crashed ? b.rider : b.pos, x = b.pos[0], z = b.pos[2];
      odo += Math.hypot(x - px, z - pz); px = x; pz = z;
      m = Math.min(m, src[0] - w.x0, w.x0 + O.WIN * O.CELL - src[0], src[2] - w.z0, w.z0 + O.WIN * O.CELL - src[2]);
      run.world.roadQ(x, z);
      if (run.world.RQ[0] > 3) offRoad++;
    }
    steps += n;
  };
  while (odo < 20000 && steps < 60 * 60 * 40) ride(600);
  assert.ok(odo >= 20000, `rode ${odo.toFixed(0)} units`);
  assert.ok(m >= 24, `the rider stays ${m.toFixed(1)} units inside the window (never its edge)`);
  assert.ok(run.far > 1000, `${run.far.toFixed(0)} units out from the start`);
  assert.ok(run.towns >= 15 && run.S[R.S_AN] >= 60, `${run.towns} towns, ${run.S[R.S_AN]} junctions`);
  assert.ok(offRoad < steps * 0.03, `on the road (${offRoad} of ${steps} steps off it)`);
  assert.ok(run.S[R.S_UNSTUCK] <= 3, `${run.S[R.S_UNSTUCK]} rescues`);
  assert.ok(run.sc.S[0] > 5000, `it scores (${run.sc.S[0]})`);
  const n = await minorGCs(() => ride(3000), 5);
  assert.ok(n <= 1, `${n} young-generation GCs over 3,000 steps`);
});

test("open world session: deterministic: the same inputs, the same bytes", () => {
  const go = () => {
    const run = R.openRun([spec], 9), I = new Float64Array(5);
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
  assert.deepEqual([p.v, p.stats.far.desert, p.stats.far.city, p.stats.far.forest], [5, 4100, 0, 0]);
  const b = newBike("buzzline", "b1");
  let q = { ...p, bikes: [b] };
  q = apply(q, settle({ ...blankStats("endcity"), finished: true, seconds: 60, distance: 2400, far: 2400, farKey: "city" }, b));
  q = apply(q, settle({ ...blankStats("desert"), finished: true, seconds: 60, distance: 900, far: 900, farKey: "forest" }, q.bikes[0]));
  q = apply(q, settle({ ...blankStats("endcity"), finished: true, seconds: 60, distance: 800, far: 800, farKey: "city" }, q.bikes[0]));
  assert.deepEqual([q.stats.far.city, q.stats.far.forest, q.stats.far.desert], [2400, 900, 4100]);
});

test("profile: the fixed Wheelie City's save (v4 → v5): its best score carries into Endless Wheelie City's when higher; the old key stays", () => {
  const v4 = (best) => ({ ...fresh(), v: 4, stats: { events: 9, wins: 1, earned: 500, best, far: { ...fresh().stats.far, city: 1300 } } });
  let p = migrate(v4({ "wheelie:city": 4200, "bigair:arena": 71 }));
  assert.deepEqual([p.v, p.stats.best["endcity:city"], p.stats.best["wheelie:city"], p.stats.best["bigair:arena"], p.stats.far.city, p.stats.events], [5, 4200, 4200, 71, 1300, 9]);
  p = migrate(v4({ "wheelie:city": 4200, "endcity:city": 9000 }));
  assert.equal(p.stats.best["endcity:city"], 9000, "a higher endless best is kept");
  p = migrate(v4({}));
  assert.equal(p.stats.best["endcity:city"], undefined, "nothing to carry");
  // And the game still settles an Endless Wheelie City ride on the migrated profile (its best goes up).
  const b = newBike("buzzline", "b1");
  const q = apply({ ...migrate(v4({ "wheelie:city": 4200 })), bikes: [b] }, settle({ ...blankStats("endcity"), finished: true, seconds: 60, distance: 900, far: 900, farKey: "city", where: "city", score: 5000 }, b));
  assert.equal(q.stats.best["endcity:city"], 5000);
});
