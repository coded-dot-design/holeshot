// A worker for tests/generate.test.mjs: generates each [seed, difficulty] job, checks it on its own
// terms (the test's check) and rides it again on the autopilot (checkRide), and posts the rows back.
import { parentPort, workerData } from "node:worker_threads";

const G = await import("../src/modes/race/generate.ts");
const C = await import("../src/modes/race/course.ts");
const { check } = await import("./generate.check.mjs");
const rows = [];
for (const [seed, d] of workerData) {
  const g = G.generateTrack(seed, d), p = g.plan, turns = p.plan.filter((v) => typeof v !== "number");
  rows.push({
    seed, d, tries: g.tries, fallback: g.fallback, shape: check(p, G, C), ride: G.checkRide(p),
    rights: turns.filter((t) => t.turn < 0).length, tight: turns.filter((t) => (t.r ?? p.RAD) < 4.6 || Math.abs(t.turn) > 1.9).length,
    triples: p.features.filter((_, k) => k % 3 === 0 && p.features[k] === 3).length, radius: Math.min(...turns.map((t) => t.r ?? p.RAD)),
  });
}
parentPort.postMessage(rows);
