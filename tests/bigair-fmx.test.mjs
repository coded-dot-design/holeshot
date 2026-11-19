// Big Air's freestyle tricks (src/modes/bigair/tricks.ts, ridden through show.ts): the TRICK button's
// ladder in one jump (tap for the next, hold for more), the whip banked when straightened and a
// crash when landed kicked out, a trick still out at the landing is a bail, the combo across jumps,
// and the whole run deterministic (zero allocation per step is tests/alloc.test.mjs's Big Air run,
// which now throws tricks and whips on the autopilot).
import test from "node:test";
import assert from "node:assert/strict";
const T = await import("../src/modes/bigair/tricks.ts");
const A = await import("../src/modes/bigair/show.ts");
const { tune } = await import("../src/model/tune.ts");
const { newBike } = await import("../src/model/profile.ts");
const { BAIL } = await import("../src/bike/bike.ts");

const dt = 1 / 60;
/** `secs` in the air with the button and the stick as given. */
const air = (sc, secs, button = 0, steer = 0) => { for (let t = 0; t < secs - 1e-9; t += dt) sc.step(dt, true, button, steer); };
const events = (sc) => { const out = []; for (let k = 0; k < sc.n; k++) out.push([sc.ev[k * 2], sc.ev[k * 2 + 1]]); sc.clear(); return out; };

test("big air fmx: taps climb the ladder in one jump, each worth more; a clean landing banks them", () => {
  const sc = T.tricks({ seed: 3 });
  air(sc, 0.2);
  const ids = [];
  for (let i = 0; i < 3; i++) {
    air(sc, dt, 1); // a tap
    ids.push(sc.trick);
    air(sc, 0.6, 0); // out its minimum, then back in
    assert.equal(sc.trick, -1, "back in after a tap");
  }
  assert.deepEqual(ids, [0, 1, 2], "SEAT GRAB, CROSS-UP, NAC-NAC");
  assert.deepEqual(ids.map((i) => T.TRICKS[i]), ["SEAT GRAB", "CROSS-UP", "NAC-NAC"]);
  const done = events(sc).filter((e) => e[0] === T.T_DONE).map((e) => e[1]);
  assert.equal(done.length, 3);
  // Each tap reached all the way out: its base, and the chain bonus grows (×1, ×1.25, ×1.5).
  assert.ok(done[0] >= T.BASE[0] && done[1] > T.BASE[1] * 1.25 - 1 && done[2] > T.BASE[2] * 1.5 - 1, JSON.stringify(done));
  assert.equal(sc.land(0.05, true), T.CLEAN);
  assert.equal(sc.S[T.LTRICKS], 3);
  assert.equal(sc.S[T.LTOP], 2, "the jump's top trick: NAC-NAC");
  assert.ok(sc.S[T.PTS] > done[0] + done[1] + done[2], `banked ${sc.S[T.PTS]}`);
  assert.ok(sc.S[T.LMARK] > 5 && sc.S[T.LMARK] <= 9.9, `the judges' mark ${sc.S[T.LMARK]}`);
  // The ladder goes on from there on the next jump.
  air(sc, 0.2), air(sc, dt, 1);
  assert.equal(T.TRICKS[sc.trick], "HEEL CLICKER");
});

test("big air fmx: held longer is worth more; past the top of the ladder it comes at random, seeded", () => {
  const pts = [];
  for (const hold of [0, 0.5, 1.2]) {
    const sc = T.tricks();
    air(sc, 0.1), air(sc, dt, 1), air(sc, hold, 1), air(sc, 0.5, 0);
    pts.push(events(sc).find((e) => e[0] === T.T_DONE)[1]);
  }
  assert.ok(pts[0] < pts[1] && pts[1] < pts[2], JSON.stringify(pts));
  const seq = (seed) => {
    const sc = T.tricks({ seed }), out = [];
    for (let i = 0; i < 20; i++) air(sc, dt, 1), out.push(sc.trick), air(sc, 0.6, 0);
    return out;
  };
  const a = seq(7);
  assert.deepEqual(a.slice(0, T.TRICKS.length), T.TRICKS.map((_, i) => i), "the whole ladder in order");
  assert.deepEqual(a, seq(7), "the same seed, the same tricks");
  for (let i = T.TRICKS.length; i < a.length; i++) assert.ok(a[i] >= 4 && a[i] !== a[i - 1], `random past the top: ${a.slice(T.TRICKS.length)}`);
});

test("big air fmx: a whip straightened in time counts (a longer one more); landed kicked out it is a crash", () => {
  const whip = (out) => {
    const sc = T.tricks();
    air(sc, 0.1), air(sc, out, 0, 1), air(sc, 0.5, 0, 0);
    const w = events(sc).filter((e) => e[0] === T.T_WHIP);
    assert.equal(w.length, 1, "one whip");
    return [sc.land(0.05, true), sc.S[T.PTS], w[0][1]];
  };
  const [k1, p1, e1] = whip(0.3), [k2, p2, e2] = whip(0.9);
  assert.equal(k1, T.CLEAN);
  assert.equal(k2, T.CLEAN);
  assert.ok(p2 > p1, `a longer whip is worth more: ${p1} vs ${p2}`);
  assert.ok(e1 < 100 && e2 >= 100, "the long one is a BIG WHIP");
  const sc = T.tricks();
  air(sc, 0.1), air(sc, 0.5, 0, -1);
  assert.ok(sc.whip < -0.9);
  assert.equal(sc.land(0.05, true), T.WHIPPED, "landed still kicked out");
  assert.equal(sc.S[T.SC], 0);
});

test("big air fmx: the combo builds across clean jumps that did something, a sketchy landing ends it", () => {
  const sc = T.tricks(), jump = (err) => (air(sc, 0.5), air(sc, dt, 1), air(sc, 0.5, 0), sc.land(err, true), sc.S[T.PTS]);
  const p1 = jump(0.05), p2 = jump(0.05), p3 = jump(0.05);
  assert.equal(sc.S[T.CB], 3);
  assert.ok(p2 > p1 * 1.5 && p3 > p2, `×(1 + combo): ${p1}, ${p2}, ${p3}`);
  jump(0.5);
  assert.equal(sc.S[T.KIND], T.SKETCHY);
  assert.equal(sc.S[T.CB], 0, "a sketchy landing ends the combo");
  assert.equal(sc.ladder, 0, "and starts the ladder again");
});

/** A show on a bike, the autopilot riding until it is high in the air. */
function intoAir(seed = 4) {
  const t = tune(newBike("buzzline", "b1")), sh = A.airShow(seed, { power: t.power, shape: t.shape }), I = new Float64Array(6), evs = [];
  sh.go(t.power);
  const step = (auto) => { sh.step(dt, I, auto); for (let k = 0; k < sh.n; k++) evs.push([sh.ev[k * 2], sh.ev[k * 2 + 1]]); sh.clear(); };
  // Ride with the autopilot's line, then take over once the bike is in the air.
  for (let i = 0; i < 60 * 30 && !(sh.b.air > 0.25 && sh.phase === A.RUN); i++) step(true);
  assert.ok(sh.b.air > 0.25, "in the air");
  return { sh, I, evs, step };
}

test("big air fmx: a trick held out through the landing is a bail", () => {
  const { sh, I, evs, step } = intoAir();
  // The autopilot's weight (a level landing), the button held through the landing.
  for (let i = 0; i < 60 * 4 && !sh.b.crashed; i++) sh.autopilot(I), (I[3] = 0), (I[4] = 1), step(false);
  assert.ok(sh.b.crashed, "it bailed");
  assert.ok(evs.some((e) => e[0] === A.E_CRASH && e[1] === BAIL), "a BAIL");
  assert.equal(sh.sc.S[T.CRASHES], 1);
});

test("big air fmx: whipped at the landing in the show: WHIPPED, then the crash", () => {
  const { sh, I, evs, step } = intoAir(6);
  // The autopilot's weight (a level landing), the stick held right, no trick.
  for (let i = 0; i < 60 * 6 && !sh.b.crashed; i++) sh.autopilot(I), (I[3] = 1), (I[4] = 0), step(false);
  assert.ok(evs.some((e) => e[0] === A.E_WHIP) === false, "never straightened: no whip counted");
  assert.ok(evs.some((e) => e[0] === A.E_WHIPPED), "landed whipped");
  assert.ok(sh.b.crashed && sh.sc.S[T.CRASHES] === 1, "down");
});

test("big air fmx: the autopilot's run throws tricks, whips and flips, and is the same every time", () => {
  const run = () => {
    const t = tune(newBike("sparkhound", "b1")), sh = A.airShow(9, { power: t.power, shape: t.shape }), I = new Float64Array(6);
    sh.go(t.power);
    for (let i = 0; i < 60 * 75 && sh.phase !== A.DONE; i++) sh.step(dt, I, true), sh.clear();
    return { S: [...sh.sc.S], bytes: sh.sc.bytes.map((b) => [...b].join(",")).join("|"), judges: sh.sc.JD[5] };
  };
  const a = run(), b = run();
  assert.deepEqual(a, b, "deterministic");
  assert.ok(a.S[T.DONE_N] >= 10 && a.S[T.WHIPS] >= 2 && a.S[T.FLIPS] >= 1, `tricks ${a.S[T.DONE_N]}, whips ${a.S[T.WHIPS]}, flips ${a.S[T.FLIPS]}`);
  assert.equal(a.S[T.CRASHES], 0, "the autopilot lands them all");
  assert.ok(a.judges > 50, `judges ${a.judges}`);
});
