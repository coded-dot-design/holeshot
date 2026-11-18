// The hand drag (Endless Wheelie City), headless: the city's bikes go past 12 o'clock (vertical) and
// loop out only past about 2 (LOOP_AT: just past the fender drag, ../src/modes/stunts.ts); held past 12 for HAND_T seconds the rider drops a hand to the
// road (E_DRAG) and it earns ×DRAG_X while it drags; back under 12 it banks (E_BANKED: the points in
// the score); looped out the drag's points are lost (E_LOST, the score untouched); the same inputs give
// the same bytes; no allocation per step.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const W = await import("../src/modes/wheelie/city.ts");
const O = await import("../src/modes/wheelie/roam.ts");
const R = await import("../src/modes/wheelie/ride.ts");
const T = await import("../src/modes/wheelie/tricks.ts");
const { tune } = await import("../src/model/tune.ts");
const { newBike } = await import("../src/model/profile.ts");

const DT = 1 / 60;
const spec = (id) => {
  const t = tune(newBike(id, "b1"));
  return { id, name: id, kind: "", blurb: "", bars: [3, 3, 3], power: t.power, shape: t.shape, sweet: t.sweet, hop: t.hop };
};
/** A rider: up with the gas and the weight back, held at `goal` with the rear brake (feathered), then
 *  `out` decides the end: "down" brings it back under 12, "over" lets go of the brake (it loops). */
function ride(out, goal = 1.75, secs = 8.5, id = "sparkhound") {
  const run = O.openRun([spec(id)], 3), ev = [], nose = [], AI = new Float64Array(5);
  for (let f = 0; f < 60 * 14; f++) {
    const b = run.bike.b, th = run.bike.nose, w = b.S[3], v = b.speed;
    let gas = 0, brake = 0, lean = 0;
    if (f < 50) gas = v < 4 ? 1 : 0;
    else if (f < 60 * secs) {
      const u = (goal - th) * 10 - w * 4;
      gas = u > 0 ? 1 : 0.7; brake = u < 0 ? Math.min(1, -u) : 0; lean = th > 1.3 ? 0 : -1;
    } else if (out === "down") (gas = 0), (brake = 1), (lean = 1);
    else (gas = 1), (brake = 0), (lean = -1);
    // (Steered along the road by the autopilot's line: the open world's roads bend.)
    run.autopilot(AI);
    run.step(DT, gas, brake, lean, AI[3], 0);
    for (let k = 0; k < run.n; k++) ev.push([f, run.ev[k * 2], run.ev[k * 2 + 1], run.sc.S[T.SC]]);
    run.clear();
    nose.push(th);
  }
  return { run, ev, nose };
}

test("hand drag: past 12 is reachable; past the hard limit (about 2 o'clock) it loops out", () => {
  assert.ok(R.LOOP_AT > R.TWELVE + 0.9 && R.LOOP_AT < R.TWELVE + 1.1, "the limit: about 60° past vertical (past the fender drag)");
  const { ev, nose } = ride("over");
  const top = Math.max(...nose);
  assert.ok(top > R.TWELVE + 0.2, `past 12 (${top.toFixed(2)} rad)`);
  const crash = ev.find((e) => e[1] === W.E_CRASH);
  assert.ok(crash, "let go: it loops out");
  assert.ok(nose[crash[0]] >= R.LOOP_AT - 0.08, `at the limit (the last step before) (${nose[crash[0]].toFixed(2)})`);
});

test("hand drag: held past 12 for HAND_T it starts (×10, the pop); back under 12 it banks, the points kept", () => {
  const { run, ev, nose } = ride("down");
  const drag = ev.find((e) => e[1] === W.E_DRAG), bank = ev.find((e) => e[1] === W.E_BANKED);
  assert.ok(drag, "the hand drag starts");
  // It started once the nose had been past 12 for HAND_T seconds without a break.
  let past = 0;
  for (let f = drag[0]; f >= 0 && nose[f] > R.TWELVE; f--) past++;
  assert.ok(past / 60 >= W.HAND_T - 0.05 && past / 60 <= W.HAND_T + 0.1, `held ${(past / 60).toFixed(2)} s past 12`);
  assert.ok(bank && bank[0] > drag[0], "banked when it came down");
  const secs = (bank[0] - drag[0]) / 60;
  assert.ok(bank[2] >= W.DRAG_RATE * W.DRAG_X * secs * 0.95, `×${W.DRAG_X}: ${bank[2]} points for ${secs.toFixed(1)} s`);
  assert.ok(!ev.some((e) => e[1] === W.E_LOST || e[1] === W.E_CRASH), "never looped");
  assert.ok(bank[3] >= bank[2], `the points are in the score (${bank[3]})`);
  assert.deepEqual([...run.HD.subarray(0, 4)], [0, 0, 0, 0], "done");
});

test("hand drag: looped out mid-drag, its points are lost (E_LOST), the score untouched", () => {
  const { run, ev } = ride("over");
  const drag = ev.find((e) => e[1] === W.E_DRAG), lost = ev.find((e) => e[1] === W.E_LOST);
  assert.ok(drag && lost && lost[0] > drag[0], "dragging, then looped out");
  assert.ok(lost[2] > 500, `the pending points are gone (${lost[2]})`);
  assert.ok(!ev.some((e) => e[1] === W.E_BANKED), "nothing banked");
  assert.ok(lost[3] < lost[2], `the score did not get them (${lost[3]})`);
  assert.deepEqual([...run.HD.subarray(0, 4)], [0, 0, 0, 0]);
});

test("hand drag: deterministic, and no allocation per step", async () => {
  const a = ride("down"), b = ride("down");
  assert.equal(Buffer.concat(a.run.bytes.map((x) => Buffer.from(x))).toString("base64"), Buffer.concat(b.run.bytes.map((x) => Buffer.from(x))).toString("base64"));
  const run = O.openRun([spec("sparkhound")], 3);
  const n = await minorGCs(() => {
    for (let f = 0; f < 60 * 12; f++) {
      const bk = run.bike.b, th = run.bike.nose, u = (1.75 - th) * 10 - bk.S[3] * 4;
      run.step(DT, f < 50 ? 1 : u > 0 ? 1 : 0.7, f < 50 ? 0 : u < 0 ? Math.min(1, -u) : 0, f < 50 ? 0 : th > 1.3 ? 0 : -1, 0, 0);
      run.clear();
    }
  }, 5);
  assert.ok(n <= 2, `${n} young-generation GCs`);
});
