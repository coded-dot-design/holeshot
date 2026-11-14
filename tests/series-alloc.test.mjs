// Zero allocation per step on a generated track (a process of its own, node --expose-gc): a series
// round of four stays as bounded as the fixed track's race (tests/alloc.test.mjs), with the meter.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const C = await import("../src/modes/race/course.ts");
const S = await import("../src/model/series.ts");
const { tune } = await import("../src/model/tune.ts");
const { newBike } = await import("../src/model/profile.ts");
const { meter } = await import("../src/modes/meter.ts");
const t = tune(newBike("buzzline", "b1"));

test("alloc: a series round of four on a generated track stays bounded", async () => {
  const run = { tier: "masters", seed: 9 }, riv = S.rivals(run, "2t");
  const r = C.motoRace(5, C.makeTrack(S.roundTrack(run, 2)), { power: t.power, shape: t.shape }, riv.map((x) => x.bike.power), { nerve: [0.96, 1] }), I = new Float64Array(5), m = meter("race");
  const work = () => {
    r.go(t.power);
    for (let i = 0; i < 60 * 50 && r.phase !== C.DONE; i++) (r.step(1 / 60, I, true), m.tick(r.riders[0], 1 / 60), r.clear());
  };
  work(), work();
  const n = await minorGCs(work, 5);
  assert.ok(n <= 5, `${n} young-generation GCs over a round of four`);
});
