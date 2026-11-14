// Every mode, headless, on the player's tuned bike, for each of the four starters: the race (the
// gate holds, three laps on the autopilot, a place), Free Ride (rides the park, banks on END), Big
// Air (a minute, the judges) and Wheelie City (a minute, points): each starts on the bike tune()
// made (its power and shape), ends, and its stats settle into credits and wear. A finished race pays
// by place, wears every part, and apply() puts the credits in and the wear on the bike that rode;
// the pit crew helps a rider who can't pay; nothing is ever free of wear or a dead end. The track is
// built from a plan (the same every time; a generated track is another plan).
import test from "node:test";
import assert from "node:assert/strict";

const { tune } = await import("../src/model/tune.ts");
const { setup, fresh, riding, newBike } = await import("../src/model/profile.ts");
const { settle, apply, pitReady, pitFix, payout } = await import("../src/model/economy.ts");
const { STARTERS, MODELS } = await import("../src/data/roster.ts");
const { PAYOUT, PARTS } = await import("../src/data/economy.ts");
const { meter } = await import("../src/modes/meter.ts");
const C = await import("../src/modes/race/course.ts");
const { freeRun } = await import("../src/modes/freeride/session.ts");
const A = await import("../src/modes/bigair/show.ts");
const W = await import("../src/modes/wheelie/city.ts");

const rivals = (cls) => { const s = MODELS.filter((m) => m.cls === cls); return [s[1], s[0], s[2]].map((m) => m.power); };
function race(t, seed = 7) {
  const r = C.motoRace(seed, C.makeTrack(C.MOTO_TRACK), { power: t.power, shape: t.shape }, rivals(t.cls)), I = new Float64Array(5), m = meter("race");
  r.go(t.power);
  for (let i = 0; i < 60 * 120 && r.phase !== C.DONE; i++) {
    const ph = r.phase;
    r.step(1 / 60, I, true);
    if (ph === C.RACE) m.tick(r.riders[0], 1 / 60);
    r.clear();
  }
  return { r, stats: m.stats({ place: r.place(0), time: r.finishTime(0), finished: r.finished(0) }) };
}

test("track: built from a plan, the same every time; the loop closes; the features stand up", () => {
  const a = C.makeTrack(C.MOTO_TRACK), b = C.makeTrack(C.MOTO_TRACK);
  assert.deepEqual(Array.from(a.course().h), Array.from(b.course().h));
  assert.ok(Math.hypot(a.TRACK[0] - a.TRACK[(a.NT - 1) * 2], a.TRACK[1] - a.TRACK[(a.NT - 1) * 2 + 1]) < 1, "the loop closes");
  assert.ok(Math.max(...[...Array(300)].map((_, k) => a.profile((k / 300) * a.LAP))) > 1.3, "the triple stands up");
  const t = a.course();
  for (let i = 0; i < a.NT; i += 20) assert.notEqual(t.kindAt(a.TRACK[i * 2], a.TRACK[i * 2 + 1]), 0, `point ${i} is on the track`);
});

test("race: every starter class finishes three laps on its tuned bike, against stock rivals of its class", () => {
  for (const s of STARTERS) {
    const t = tune(newBike(s.id, "b1"));
    const { r, stats } = race(t);
    assert.equal(r.riders[0].power, t.power, `${s.name}: the player rides the tuned power`);
    assert.equal(r.phase, C.DONE, `${s.name}: finished`);
    assert.ok(stats.finished && stats.distance > 300 && stats.gas > 5 && stats.seconds > 20, `${s.name}: ${stats.distance.toFixed(0)} u, ${stats.seconds.toFixed(1)} s`);
    assert.ok(stats.place >= 0 && stats.place <= 3);
  }
});

test("race: a finished race pays by place and wears every part; apply() banks it on the bike that rode", () => {
  let p = setup(fresh(), { starter: "buzzline", paint: "acid", number: 7, name: "a" });
  const { stats } = race(tune(riding(p)));
  const res = settle({ ...stats, mode: "race" }, riding(p));
  assert.equal(res.lines[0][1], PAYOUT.race.place[stats.place], "the place pays");
  assert.ok(res.credits >= PAYOUT.race.place[3]);
  for (const k of PARTS) assert.ok(res.wear[k] > 0 && res.wear[k] < 0.2, `${k} wears ${res.wear[k]}`);
  const before = p.credits;
  p = apply(p, res);
  assert.equal(p.credits, before + res.credits);
  for (const k of PARTS) assert.ok(Math.abs(riding(p).parts[k] - (1 - res.wear[k])) < 1e-9);
  assert.equal(p.stats.events, 1);
  // The 4-stroke's engine wears slower than the 2-stroke's top end on the same ride.
  assert.ok(settle(stats, newBike("anvil", "x")).wear.motor < res.wear.motor);
  // Leaving pays nothing but still wears.
  const left = settle({ ...stats, finished: false }, riding(p));
  assert.equal(left.credits, 0);
  assert.ok(left.wear.tyres > 0);
});

test("free ride: the park, the autopilot rides it, END banks it; pays a little, capped", () => {
  const t = tune(newBike("sparkhound", "b1")), f = freeRun(C.makeTrack(C.MOTO_TRACK), { power: t.power, shape: t.shape }), I = new Float64Array(5), m = meter("freeride");
  for (let i = 0; i < 60 * 30; i++) (f.step(1 / 60, I, true), f.phase === C.RACE && m.tick(f.riders[0], 1 / 60), f.clear());
  assert.equal(f.phase, C.RACE, "riding");
  assert.ok(m.M[1] > 100, `covered ${m.M[1].toFixed(0)} u`);
  f.finish();
  assert.equal(f.phase, C.DONE);
  const s = m.stats({ finished: true });
  const pay = payout(s).reduce((a, l) => a + l[1], 0);
  assert.ok(pay > 0 && pay <= PAYOUT.freeride.cap, `${pay} credits`);
});

test("big air: a minute on the player's bike, the judges score it", () => {
  for (const id of ["buzzline", "anvil"]) {
    const t = tune(newBike(id, "b1")), sh = A.airShow(11, { power: t.power, shape: t.shape }), I = new Float64Array(6), m = meter("bigair");
    sh.go(t.power);
    assert.equal(sh.b.power.force, t.power.force, "the tuned engine");
    for (let i = 0; i < 60 * 75 && sh.phase !== A.DONE; i++) (sh.phase === A.RUN && m.tick(sh.b, 1 / 60), sh.step(1 / 60, I, true), sh.clear());
    assert.equal(sh.phase, A.DONE, `${id}: time`);
    const judges = sh.sc.JD[5];
    assert.ok(judges > 30, `${id}: judges ${judges}`);
    const res = settle(m.stats({ finished: true, judges, flips: sh.sc.S[8] }), newBike(id, "b1"));
    assert.ok(res.credits >= PAYOUT.bigair.min && m.M[3] > 5, `${id}: ${res.credits} credits, ${m.M[3].toFixed(1)} s of air`);
  }
});

test("wheelie city: a session on the player's bike, wheelies score", () => {
  for (const id of ["glidewire", "sparkhound", "buzzline"]) {
    const t = tune(newBike(id, "b1"));
    const spec = { id, name: id, kind: "", blurb: "", bars: [3, 3, 3], power: t.power, shape: t.shape, sweet: t.sweet, hop: t.hop };
    const run = W.cityRun([spec]), I = new Float64Array(5), m = meter("wheelie");
    run.reset(0);
    assert.equal(run.bike.b.power, t.power);
    for (let i = 0; i < 60 * (W.SESSION + 10) && run.S[0] !== W.DONE; i++) {
      run.autopilot(I);
      run.step(1 / 60, I[0], I[1], I[2], I[3], I[4]);
      if (run.S[0] === W.RUN || run.S[0] === W.CRASH) m.tick(run.bike.b, 1 / 60);
      run.clear();
    }
    assert.equal(run.S[0], W.DONE, `${id}: time`);
    assert.ok(run.sc.S[0] > 0 && m.M[4] > 1, `${id}: ${run.sc.S[0]} points, ${m.M[4].toFixed(1)} s on one wheel`);
  }
});

test("economy: the pit crew helps a rider who can't pay; never a dead end", () => {
  let p = setup(fresh(), { starter: "buzzline", paint: "acid", number: 7, name: "a" });
  p = { ...p, credits: 10, pit: 3, bikes: [{ ...riding(p), parts: { tyres: 0.2, chain: 0.3, motor: 0.1, susp: 0.7, brakes: 0.9 } }] };
  assert.equal(pitReady(p), true);
  const fixed = pitFix(p);
  assert.deepEqual(riding(fixed).parts, { tyres: 0.6, chain: 0.6, motor: 0.6, susp: 0.7, brakes: 0.9 });
  assert.equal(fixed.pit, 0);
  assert.equal(pitReady({ ...p, pit: 1 }), false, "not every event");
  assert.equal(pitReady({ ...p, credits: 5000 }), false, "not when you can pay");
  // Every finished event pays something.
  for (const mode of ["race", "bigair", "wheelie", "freeride"]) assert.ok(payout({ mode, seconds: 30, distance: 100, gas: 10, air: 1, wheelie: 1, crashes: 9, hard: 0, finished: true, place: 3, judges: 0, score: 0 }).reduce((a, l) => a + l[1], 0) > 0, mode);
});
