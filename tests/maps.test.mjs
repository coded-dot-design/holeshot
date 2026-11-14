// Free Ride's open maps, headless (src/modes/freeride/maps.ts and session.ts): every map builds
// the same every time, its line closes and stays on the table, its features sit on straights;
// every spawn point puts the bike down on the ground, standing; the autopilot (the ghost) rides a
// set path on every map on each of the four starters and the top bike of each class for a minute
// without falling through the ground (and with at most a slip or two); a tree is a crash; off the
// table you come back on the nearest spawn point; tricks count, and Free Ride pays for them, capped.
import test from "node:test";
import assert from "node:assert/strict";

const M = await import("../src/modes/freeride/maps.ts");
const { freeRun } = await import("../src/modes/freeride/session.ts");
const C = await import("../src/modes/race/course.ts");
const { tune } = await import("../src/model/tune.ts");
const { newBike } = await import("../src/model/profile.ts");
const { STARTERS } = await import("../src/data/roster.ts");
const { meter } = await import("../src/modes/meter.ts");
const { payout } = await import("../src/model/economy.ts");
const { PAYOUT } = await import("../src/data/economy.ts");
const { FREE_MAPS, mode } = await import("../src/modes/index.ts");

const DT = 1 / 60;
const rider = (id) => { const t = tune(newBike(id, "b1")); return { power: t.power, shape: t.shape }; };

test("maps: five Free Ride maps (the loop and four open maps), each built the same every time", () => {
  assert.deepEqual(FREE_MAPS.map((m) => m.id), ["neon-park", "dune-sea", "quarry", "forest", "night-park"]);
  assert.deepEqual(mode("freeride").maps.map((m) => m.id), FREE_MAPS.map((m) => m.id));
  for (const def of M.RIDE_MAPS) {
    const a = M.makeMap(def), b = M.makeMap(def), t0 = performance.now(), ta = a.course(), ms = performance.now() - t0;
    assert.deepEqual(Array.from(ta.h), Array.from(b.course().h), `${def.id}: same terrain`);
    assert.deepEqual(Array.from(ta.kind), Array.from(b.course().kind), `${def.id}: same paint`);
    assert.ok(ms < 400, `${def.id}: builds in ${ms.toFixed(0)} ms`);
    // The line closes, stays on the table, and never crosses itself.
    assert.ok(Math.hypot(a.TRACK[0] - a.TRACK[(a.NT - 1) * 2], a.TRACK[1] - a.TRACK[(a.NT - 1) * 2 + 1]) < 1, `${def.id}: the loop closes`);
    for (let i = 0; i < a.NT; i++) assert.ok(Math.abs(a.TRACK[i * 2]) < a.HX - 2.5 && Math.abs(a.TRACK[i * 2 + 1]) < a.HZ - 2.5, `${def.id}: point ${i} on the table`);
    for (let i = 0; i < a.NT; i += 3) for (let j = i + 40; j < a.NT; j += 3) if (a.NT - (j - i) > 40) assert.ok(Math.hypot(a.TRACK[i * 2] - a.TRACK[j * 2], a.TRACK[i * 2 + 1] - a.TRACK[j * 2 + 1]) > def.width + 3, `${def.id}: the line keeps clear of itself (${i}, ${j})`);
    // Jumps sit on straights (the heading holds over them).
    for (let k = 0; k < a.FEATURES.length; k += 2) {
      if (![M.F_DOUBLE, M.F_KICKER, M.F_GAP, M.F_STEP, M.F_TABLE, M.F_LOG].includes(a.FEATURES[k])) continue;
      const i0 = Math.round(a.FEATURES[k + 1] / (a.LAP / a.NT)), i1 = i0 + Math.ceil(M.FEATURE_LEN[a.FEATURES[k]] / M.DS);
      let dy = a.YAW[i1 % a.NT] - a.YAW[i0 % a.NT];
      dy -= 2 * Math.PI * Math.floor(dy / (2 * Math.PI) + 0.5);
      assert.ok(Math.abs(dy) < 0.05, `${def.id}: ${M.FEATURE_NAMES[a.FEATURES[k]]} on a straight (${dy.toFixed(3)})`);
    }
  }
});

test("maps: every spawn point puts the bike down on the ground, standing", () => {
  for (const def of M.RIDE_MAPS) {
    const map = M.makeMap(def), f = freeRun(map, rider("buzzline")), b = f.riders[0], I = new Float64Array(5);
    for (let k = 0; k < map.SPAWN.length; k += 3) {
      b.reset(map.SPAWN[k], map.SPAWN[k + 1], map.SPAWN[k + 2]);
      for (let i = 0; i < 90; i++) f.step(DT, I), f.clear();
      const g = f.t.height(b.pos[0], b.pos[2]);
      assert.ok(!b.crashed && b.contact[0] && b.contact[1], `${def.id}: spawn ${k / 3}: on both wheels`);
      assert.ok(b.pos[1] - g > 0.3 && b.pos[1] - g < 1, `${def.id}: spawn ${k / 3}: on the ground (${(b.pos[1] - g).toFixed(2)} over it)`);
      assert.ok(Math.abs(b.speed) < 1, `${def.id}: spawn ${k / 3}: standing (${b.speed.toFixed(2)})`);
    }
  }
});

test("maps: the ghost rides a set path round every map on every class, never through the ground", () => {
  const bikes = [...STARTERS.map((s) => s.id), "hivequeen", "bulkhead", "nightloop", "gridrat"];
  for (const def of M.RIDE_MAPS) {
    const map = M.makeMap(def);
    let crashes = 0;
    for (const id of bikes) {
      const f = freeRun(map, rider(id)), b = f.riders[0], I = new Float64Array(5);
      let prog = 0, last = 0, low = 9;
      for (let i = 0; i < 60 * 60; i++) {
        f.step(DT, I, true);
        for (let k = 0; k < f.n; k++) if (f.ev[k * 3] === C.E_CRASH) crashes++;
        f.clear();
        if (!b.crashed) low = Math.min(low, b.pos[1] - f.t.height(b.pos[0], b.pos[2]));
        const s = map.sAt(f.nearIndex());
        let ds = s - last;
        ds -= map.LAP * Math.floor(ds / map.LAP + 0.5);
        (prog += ds), (last = s);
      }
      assert.ok(low > 0.05, `${def.id}/${id}: never through the ground (lowest ${low.toFixed(2)})`);
      assert.ok(prog > map.LAP * 2, `${def.id}/${id}: ${(prog / map.LAP).toFixed(1)} laps of the line in a minute`);
    }
    assert.ok(crashes <= 2, `${def.id}: ${crashes} crashes over ${bikes.length} minutes of riding`);
  }
});

test("maps: a tree is a crash; off the table you're back on the nearest spawn point", () => {
  const forest = M.makeMap(M.FOREST), f = freeRun(forest, rider("anvil")), b = f.riders[0], I = new Float64Array(5);
  assert.ok(forest.NP > 40, `${forest.NP} trees`);
  // Ride straight at a tree.
  const tx = forest.POSTS[0], tz = forest.POSTS[1];
  b.reset(tx - 4, tz, 0);
  I[0] = 1;
  let hit = false;
  for (let i = 0; i < 180 && !hit; i++) {
    f.step(DT, I);
    for (let k = 0; k < f.n; k++) if (f.ev[k * 3] === C.E_CRASH && f.ev[k * 3 + 2] === 6) hit = true;
    f.clear();
    if (b.crashed && !hit) break;
  }
  assert.ok(hit, "the tree stops it");
  // Off the table: the nearest spawn point.
  const park = M.makeMap(M.NIGHT_PARK), g = freeRun(park, rider("buzzline")), c = g.riders[0];
  c.reset(park.HX - 1.5, park.HZ - 2, 0);
  I[0] = 1;
  for (let i = 0; i < 60 * 4; i++) (g.step(DT, i < 60 ? I : new Float64Array(5)), g.clear());
  let best = Infinity, bk = 0;
  for (let k = 0; k < park.SPAWN.length; k += 3) { const d = Math.hypot(park.SPAWN[k] - (park.HX - 1.5), park.SPAWN[k + 1] - (park.HZ - 2)); if (d < best) (best = d), (bk = k); }
  assert.ok(!c.crashed && Math.hypot(c.pos[0] - park.SPAWN[bk], c.pos[2] - park.SPAWN[bk + 1]) < 3, `back on spawn ${bk / 3}`);
});

test("maps: tricks count, and Free Ride pays a little for them, capped", () => {
  const park = M.makeMap(M.NIGHT_PARK), f = freeRun(park, rider("sparkhound")), I = new Float64Array(5), m = meter("freeride");
  for (let i = 0; i < 60 * 90; i++) (f.step(DT, I, true), f.phase === C.RACE && m.tick(f.riders[0], DT), f.clear());
  assert.ok(f.tricks >= 3, `${f.tricks} tricks`);
  f.finish();
  const s = m.stats({ finished: true, tricks: f.tricks, flips: f.flips }), sum = payout(s).reduce((a, l) => a + l[1], 0);
  assert.ok(sum > 0 && sum <= PAYOUT.freeride.cap, `${sum} credits`);
  const short = payout({ ...s, seconds: 20, air: 2, wheelie: 0, tricks: 3, flips: 1 });
  assert.deepEqual(short.slice(2).map((l) => l[1]), [2 * PAYOUT.freeride.perTrick, PAYOUT.freeride.perFlip], short.map((l) => l.join(" ")).join(", "));
  assert.ok(payout({ ...s, seconds: 9999, air: 999, tricks: 99, flips: 50 }).reduce((a, l) => a + l[1], 0) === PAYOUT.freeride.cap, "capped");
});
