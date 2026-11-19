// The Endless Mashup, headless: one endless world whose biome changes by region (../src/modes/mashup/
// field.ts composing Endless Wheelie City's open world with the endless grounds). The field is pure
// (same seed and place, same bytes), its regions are over a kilometre across and cycle as you ride
// out; across every border the ground and the roads are continuous (no edge, no gap: the road runs
// on as a trail); towns and the patrol live only in city regions; a 20 km ride out crosses at least
// three biomes, never leaves the streamed ground and allocates nothing per step; the same inputs
// give the same bytes. Endless Wheelie City without the field is untouched (tests/golden.test.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const F = await import("../src/modes/mashup/field.ts");
const O = await import("../src/modes/wheelie/open.ts");
const R = await import("../src/modes/wheelie/roam.ts");
const C = await import("../src/modes/wheelie/cops.ts");
const { tune } = await import("../src/model/tune.ts");
const { newBike, fresh, migrate } = await import("../src/model/profile.ts");
const { MODES } = await import("../src/modes/index.ts");
const t = tune(newBike("sparkhound", "b1"));
const spec = { id: "x", name: "x", kind: "", blurb: "", bars: [3, 3, 3], power: t.power, shape: t.shape, sweet: t.sweet, hop: t.hop };
const mashWorld = () => { const f = F.field(O.CITY_SEED); return { f, W: O.openWorld(O.CITY_SEED, f) }; };

/** Heights and kinds of a chunk of the mashup's ground as bytes. */
function chunk(W, ci, cj, CH = 16) {
  const out = new Float64Array((CH + 1) * (CH + 1) * 2);
  for (let j = 0; j <= CH; j++) for (let i = 0; i <= CH; i++) {
    const x = (ci * CH + i) * O.CELL, z = (cj * CH + j) * O.CELL, k = j * (CH + 1) + i;
    W.heightQ(x, z); out[k * 2] = W.HQ[0]; W.kindQ(x, z); out[k * 2 + 1] = W.HQ[1];
  }
  return Buffer.from(out.buffer).toString("base64");
}

test("mashup: the biome field is pure: the same seed and place, the same biome, weights and ground bytes", () => {
  const a = mashWorld(), b = mashWorld();
  for (let k = 0; k < 400; k++) {
    const x = (k * 7919) % 40000 - 20000 + k * 0.37, z = (k * 104729) % 40000 - 20000 - k * 0.11;
    a.f.X[0] = x; a.f.X[1] = z; a.f.at();
    b.f.X[0] = x; b.f.X[1] = z; b.f.at();
    assert.deepEqual(Buffer.from(a.f.X.buffer), Buffer.from(b.f.X.buffer), `field at ${x},${z}`);
  }
  // Whatever the caches hold (a world that has been elsewhere first), the same chunk bytes.
  for (let k = 0; k < 60; k++) b.W.heightQ(k * 311.7 - 9000, 4000 - k * 97.1);
  for (const [ci, cj] of [[0, 0], [60, 4], [-140, 90], [400, -230], [1250, 3]]) assert.equal(chunk(a.W, ci, cj), chunk(b.W, ci, cj), `chunk ${ci},${cj}`);
  assert.equal(F.biomeAt(a.f, 0, 0), F.M_CITY, "the start is in the city");
});

test("mashup: regions over a kilometre across; riding out one way cycles city, dunes, mountains, city, quarry, park", () => {
  const { f } = mashWorld();
  // Every region holds a disc 1 km across round its site: each site is 1,000 or more from every
  // other biome's (its border, the bisector, 500 or more away).
  let near = 1e9;
  for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
    f.site(i, j);
    const ax = f.N[0], az = f.N[1];
    for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) {
      if (F.biomeOf(i + q, j + r) === F.biomeOf(i, j)) continue;
      f.site(i + q, j + r);
      near = Math.min(near, Math.hypot(f.N[0] - ax, f.N[1] - az));
    }
  }
  assert.ok(near >= 1000, `the closest two sites of different biomes are ${near.toFixed(0)} apart`);
  const runs = [];
  let last = -1, from = 0;
  for (let x = 0; x <= 60000; x += 10) {
    const b = F.biomeAt(f, x, 0);
    if (b !== last) (last >= 0 && runs.push([last, x - from])), (last = b), (from = x);
  }
  const names = runs.map((r) => F.MASH[r[0]].id);
  assert.deepEqual(names.slice(0, 6), ["city", "dunes", "peaks", "city", "quarry", "park"], names.join(" → "));
  assert.ok(new Set(names).size === F.NBIOME, "every biome");
  for (const [b, len] of runs.slice(1)) assert.ok(len >= 1000, `${F.MASH[b].id}: ${len} m across on the way out`);
  // Inside a region the field is all that biome (weight 1) well before its border.
  f.X[0] = 0; f.X[1] = 0; f.at();
  assert.equal(f.X[2], 1, "all city at the start");
  assert.ok(f.X[6] > 1200, `the start is ${(f.X[6] / 2).toFixed(0)} m from a border`);
});

test("mashup: transitions are continuous: heights across every border, and the roads run on through them (no edge, no gap)", () => {
  const { f, W } = mashWorld();
  let borders = 0, worst = 0, roads = 0, worstRoad = 0, gaps = 0, band = 0;
  for (let L = 0; L < 10; L++) {
    const z = -8000 + L * 1777;
    let last = F.biomeAt(f, -8000, z);
    for (let x = -8000; x < 8000; x += 1) {
      const b = F.biomeAt(f, x + 1, z);
      if (b === last) continue;
      last = b;
      borders++;
      // Right across the border, finely: no step in the ground.
      let prev = W.height(x, z);
      for (let u = 0.001; u <= 1; u += 0.001) {
        const h = W.height(x + u, z), d = Math.abs(h - prev);
        prev = h;
        if (d > worst) worst = d;
      }
    }
  }
  assert.ok(borders >= 40, `${borders} borders crossed`);
  assert.ok(worst < 0.01, `the ground's largest step across a border: ${worst.toFixed(4)} per mm`);
  // Every road whose ends lie in different biomes, along its middle: always a road (asphalt or trail), never a step.
  for (let i = -20; i <= 20; i++) for (let j = -20; j <= 20; j++) for (let dir = 0; dir < 2; dir++) {
    W.nodeQ(i, j);
    const ax = W.NQ[0], az = W.NQ[1];
    W.nodeQ(i + (dir ? 0 : 1), j + (dir ? 1 : 0));
    if (F.biomeAt(f, ax, az) === F.biomeAt(f, W.NQ[0], W.NQ[1])) continue;
    const e = W.edge(i, j, dir);
    if (e < 0) continue;
    roads++;
    const L = W.EF[e * 8 + 1];
    W.at(e, 0);
    let prev = W.height(W.PQ[0], W.PQ[1]);
    for (let s = 0.05; s <= L; s += 0.05) {
      W.at(e, s);
      const x = W.PQ[0], z = W.PQ[1];
      W.heightQ(x, z);
      const h = W.HQ[0], d = Math.abs(h - prev);
      prev = h;
      f.X[0] = x; f.X[1] = z; f.at();
      if (f.X[2] > 0 && f.X[2] < 1) band++;
      if (d > worstRoad) worstRoad = d;
      W.kindQ(x, z);
      if (W.RQ[3] !== 1 && !(W.RQ[0] <= 0 && (W.HQ[1] === O.F_ROAD || W.HQ[1] === O.F_TRAIL))) gaps++;
    }
  }
  assert.ok(roads >= 20 && band > 1000, `${roads} roads across a border (${band} samples in a band)`);
  assert.ok(worstRoad < 0.2, `the road's largest step along it: ${worstRoad.toFixed(3)} per 5 cm`);
  assert.equal(gaps, 0, "the road is never lost along the way");
});

test("mashup: towns, roundabouts and kickers only in city regions; the wild scenery thins out across a border", () => {
  const { f, W } = mashWorld();
  let towns = 0;
  for (let i = -80; i <= 80; i++) for (let j = -80; j <= 80; j++) {
    if (!W.isTown(i, j) && !W.isRound(i, j)) continue;
    W.nodeQ(i, j);
    f.X[0] = W.NQ[0]; f.X[1] = W.NQ[1]; f.at();
    assert.equal(f.X[2], 1, `junction ${i},${j} is in the city`);
    if (W.isTown(i, j)) towns++, assert.ok(f.X[6] >= 2 * (O.TOWN_R + 80), `town ${i},${j} is deep in the city`);
  }
  assert.ok(towns > 300, `${towns} towns`);
  // A gather out in the dunes: cactus and rocks, no houses; in town: houses, no cactus.
  const G = new Float64Array(600 * O.IS), kinds = (x, z) => { const n = W.gather(x, z, 46, G, 600), s = new Set(); for (let q = 0; q < n; q++) s.add(G[q * O.IS]); return s; };
  let dunes = null;
  for (let x = 1200; x < 2400 && !dunes; x += 40) if (F.biomeAt(f, x, 0) === F.M_DUNES && (f.X[0] = x, f.X[1] = 0, f.at(), f.X[6] > 400)) dunes = x;
  const wild = kinds(dunes, 0), town = kinds(60, 60);
  assert.ok(wild.has(O.I_CACTUS) || wild.has(O.I_ROCK), "the dunes have their cactus and rocks");
  assert.ok(!wild.has(O.I_HOUSE) && !wild.has(O.I_LAMP + 100), "no houses in the dunes");
  assert.ok(town.has(O.I_HOUSE) || town.has(O.I_HOUSE2), "houses in town");
  assert.ok(!town.has(O.I_CACTUS), "no cactus in town");
});

test("mashup: a 20 km ride out crosses three biomes and more, never leaves the streamed ground, the patrol only in the city, no allocation per step", async () => {
  const f = F.field(O.CITY_SEED), run = R.openRun([spec], 3, O.CITY_SEED, f), I = new Float64Array(5), w = run.win.t;
  const seen = new Set([run.biome]);
  let m = Infinity, steps = 0, copWild = 0, chased = 0;
  const ride = (n) => {
    for (let i = 0; i < n; i++) {
      run.autopilot(I);
      // Scripted: at every junction it keeps to the long east–west road, heading east (the way out).
      const S = run.S;
      if (S[24] !== 0 || S[25] !== 1) {
        const ai = S[22], aj = S[23], ad = S[24], as = S[25];
        S[22] = as > 0 ? ai : ai + (ad ? 0 : 1); S[23] = as > 0 ? aj : aj + (ad ? 1 : 0); S[24] = 0; S[25] = 1;
      }
      run.step(1 / 60, I[0], I[1], I[2], I[3], I[4]);
      for (let q = 0; q < run.n; q++) if (run.ev[q * 2] === R.E_BIOME) seen.add(run.ev[q * 2 + 1]);
      run.clear();
      const b = run.bike.b, src = b.crashed ? b.rider : b.pos;
      m = Math.min(m, src[0] - w.x0, w.x0 + O.WIN * O.CELL - src[0], src[2] - w.z0, w.z0 + O.WIN * O.CELL - src[2]);
      // Every patrol unit on its town's streets, in the city.
      for (let u = 0; u < C.MAXP; u++) {
        const o = u * C.PS;
        if (run.cop.P[o + C.P_ON] !== 1) continue;
        chased++;
        f.X[0] = run.cop.P[o + C.P_X]; f.X[1] = run.cop.P[o + C.P_Z]; f.at();
        if (f.X[2] < 1) copWild++;
      }
    }
    steps += n;
  };
  while (run.far < 20000 && steps < 60 * 60 * 60) ride(600);
  assert.ok(run.far >= 20000, `${run.far.toFixed(0)} units out`);
  assert.ok(seen.size >= 3, `biomes: ${[...seen].map((b) => F.MASH[b].id).join(", ")}`);
  assert.ok(m >= 24, `the rider stays ${m.toFixed(1)} units inside the window (never its edge)`);
  assert.ok(run.towns >= 3, `${run.towns} towns on the way`);
  assert.equal(copWild, 0, `the patrol never out of the city (${chased} unit-steps seen)`);
  const n = await minorGCs(() => ride(3000), 5);
  assert.ok(n <= 1, `${n} young-generation GCs over 3,000 steps`);
});

test("mashup: deterministic: the same inputs, the same bytes", () => {
  const go = () => {
    const run = R.openRun([spec], 9, O.CITY_SEED, F.field(O.CITY_SEED)), I = new Float64Array(5);
    for (let k = 0; k < 60 * 120; k++) (run.autopilot(I), run.step(1 / 60, I[0], I[1], I[2], I[3], I[4]), run.clear());
    return Buffer.concat(run.bytes.map((b) => Buffer.from(b))).toString("base64");
  };
  assert.equal(go(), go());
});

test("mashup: the mode is listed (id mashup) and keeps its own best (stats.far.mashup, additive: no version step)", () => {
  const md = MODES.find((x) => x.id === "mashup");
  assert.ok(md && md.name === "ENDLESS MASHUP");
  assert.equal(fresh().stats.far.mashup, 0);
  const old = fresh();
  delete old.stats.far.mashup;
  assert.equal(migrate(JSON.parse(JSON.stringify(old))).stats.far.mashup, 0, "an older save gets it at 0");
});
