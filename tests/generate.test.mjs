// The track generator (src/modes/race/generate.ts): a seed and a difficulty give the same TrackPlan
// every time, and every track it gives is valid, checked here on its own terms over 500 seeds at
// each of three difficulties (the Rookie Cup's easiest, the middle, the Neon Masters' hardest): the
// loop closes, no two stretches come within GEN.sep of each other, the loop fits its table with a
// margin, every feature sits inside a straight and none overlaps the next, the core sections are
// there (the gate, a rhythm section or the whoops, a double or a triple, a tabletop or a step, the
// finish jump last before the line), and a race on the autopilot finishes clean (the reference
// 2-stroke three laps with no crash; the other starter classes two laps or more). Harder tracks have
// more of what makes them hard (tight turns, rights, hairpins, triples). The seeds run in worker
// threads (one per core). GEN_SEEDS=<n> runs fewer (a quick local loop); CI runs all 500.
import test from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import { availableParallelism } from "node:os";

const G = await import("../src/modes/race/generate.ts");
const C = await import("../src/modes/race/course.ts");
const SEEDS = +(process.env.GEN_SEEDS || 500), LEVELS = [0, 0.5, 1];

test("generator: the same seed, the same track; a different seed, a different one", () => {
  const a = G.generateTrack(42, 0.5), b = G.generateTrack(42, 0.5), c = G.generateTrack(43, 0.5);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.plan.plan, c.plan.plan);
  const t = C.makeTrack(a.plan);
  assert.deepEqual(Array.from(t.course().h), Array.from(C.makeTrack(b.plan).course().h), "the same dirt");
});

test("course: turns of any angle either way; features give the lap back past their end", () => {
  // A Turn of 90° left at RAD is the fixed track's -1, point for point.
  const t = C.makeTrack({ ...C.MOTO_TRACK, plan: C.MOTO_TRACK.plan.map((v, i) => (i === 1 ? { turn: Math.PI / 2, r: 5.2, berm: 0.75 } : v)) });
  assert.deepEqual(Array.from(t.TRACK), Array.from(C.makeTrack(C.MOTO_TRACK).TRACK));
  // A generated track with a right turn marks it -1 (its berm goes on its left) and still closes.
  let g = null;
  for (let s = 1; !g && s < 200; s++) { const p = G.generateTrack(s, 1).plan; if (p.plan.some((v) => typeof v !== "number" && v.turn < 0)) g = p; }
  assert.ok(g, "a right turn within 200 seeds at difficulty 1");
  const r = C.makeTrack(g);
  assert.ok(Array.from(r.TURN).includes(-1) && Array.from(r.TURN).includes(1));
  // Two doubles in a row both stand up (the second used to be hidden by the first).
  const two = C.makeTrack({ ...C.MOTO_TRACK, features: [1, 0, 6, 1, 0, 17.8] });
  const peak = (s0) => Math.max(...[...Array(40)].map((_, k) => two.profile(s0 + (k / 40) * 6.8)));
  assert.ok(peak(6) > 0.7 && peak(17.8) > 0.7, "both doubles");
});

test(`generator: ${SEEDS} seeds at each of ${LEVELS.join(", ")}: every track valid and ridden clean`, { timeout: 900_000 }, async () => {
  const jobs = LEVELS.flatMap((d) => [...Array(SEEDS).keys()].map((s) => [s * 7919 + 13, d]));
  const W = Math.max(1, Math.min(8, availableParallelism())), per = Math.ceil(jobs.length / W);
  const url = new URL("./generate.worker.mjs", import.meta.url);
  const parts = await Promise.all([...Array(W).keys()].map((w) => new Promise((res, rej) => {
    const wk = new Worker(url, { workerData: jobs.slice(w * per, (w + 1) * per) });
    wk.once("message", res), wk.once("error", rej);
  })));
  const rows = parts.flat();
  assert.equal(rows.length, jobs.length);
  const stats = {};
  for (const r of rows) {
    assert.equal(r.fallback, false, `seed ${r.seed} at ${r.d}: fell back`);
    assert.equal(r.shape, "", `seed ${r.seed} at ${r.d}: ${r.shape}`);
    assert.equal(r.ride, null, `seed ${r.seed} at ${r.d}: ${r.ride}`);
    const s = (stats[r.d] ??= { n: 0, tries: 0, rights: 0, tight: 0, triples: 0, radius: 0, maxTries: 0 });
    s.n++, (s.tries += r.tries), (s.rights += r.rights), (s.tight += r.tight), (s.triples += r.triples), (s.radius += r.radius), (s.maxTries = Math.max(s.maxTries, r.tries));
  }
  const avg = (d, k) => stats[d][k] / stats[d].n;
  for (const d of LEVELS) console.log(`  difficulty ${d}: ${stats[d].n} tracks, ${avg(d, "tries").toFixed(1)} drafts each (max ${stats[d].maxTries}), ${avg(d, "rights").toFixed(2)} rights, ${avg(d, "tight").toFixed(2)} tight turns, ${avg(d, "triples").toFixed(2)} triples, tightest radius ${avg(d, "radius").toFixed(2)}`);
  assert.ok(avg(1, "rights") > avg(0, "rights") && avg(1, "tight") > avg(0, "tight") && avg(1, "radius") < avg(0, "radius"), "harder: more rights, more tight turns, tighter radii");
  assert.ok(avg(1, "triples") > avg(0, "triples"), "harder: more triples");
});

