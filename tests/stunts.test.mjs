// The stunts (src/modes/stunts.ts), headless, in both endless modes: the drag ladder past 12 (hand →
// double → fender drag, banked under 12, lost on a loop-out), the whip in the air (counted back to
// straight, a crash landed kicked out), the combo button (an escalating ladder, then seeded random;
// held longer pays more; ×3 in the air, banked on a clean landing), the same in the ENDLESS grounds
// (freeRun) as in Endless Wheelie City (openRun); deterministic, zero allocation per step.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const ST = await import("../src/modes/stunts.ts");
const T = await import("../src/modes/wheelie/tricks.ts");
const O = await import("../src/modes/wheelie/roam.ts");
const W = await import("../src/modes/wheelie/rules.ts");
const FS = await import("../src/modes/freeride/session.ts");
const { desertTrack, DESERT_SEED } = await import("../src/modes/desert/track.ts");
const { bike, BAIL } = await import("../src/bike/bike.ts");
const { tune } = await import("../src/model/tune.ts");
const { newBike } = await import("../src/model/profile.ts");

const DT = 1 / 60;
const spec = (id) => {
  const t = tune(newBike(id, "b1"));
  return { id, name: id, kind: "", blurb: "", bars: [3, 3, 3], power: t.power, shape: t.shape, sweet: t.sweet, hop: t.hop };
};
/** Endless Wheelie City: up, held at `goal` on the rear brake for `secs`, then down (or over). */
function city(goal, out = "down", secs = 8.5) {
  const run = O.openRun([spec("sparkhound")], 3), ev = [], nose = [], AI = new Float64Array(5);
  for (let f = 0; f < 60 * 13; f++) {
    const b = run.bike.b, th = run.bike.nose, w = b.S[3], v = b.speed;
    let gas = 0, brake = 0, lean = 0;
    if (f < 50) gas = v < 4 ? 1 : 0;
    else if (f < 60 * secs) {
      const u = (goal - th) * 10 - w * 4;
      gas = u > 0 ? 1 : 0.7; brake = u < 0 ? Math.min(1, -u) : 0; lean = th > 1.3 ? 0 : -1;
    } else if (out === "down") (gas = 0), (brake = 1), (lean = 1);
    else (gas = 1), (brake = 0), (lean = -1);
    run.autopilot(AI);
    run.step(DT, gas, brake, lean, AI[3], 0);
    for (let k = 0; k < run.n; k++) ev.push([f, run.ev[k * 2], run.ev[k * 2 + 1], run.sc.S[T.SC]]);
    run.clear();
    nose.push(th);
  }
  return { run, ev, nose };
}

test("drag ladder: held on, the hand drag becomes the double hand drag (×20) and banks more", () => {
  const { ev } = city(1.75);
  const lv = ev.filter((e) => e[1] === W.E_DRAG).map((e) => e[2]);
  assert.deepEqual(lv, [ST.HAND, ST.DOUBLE], "hand, then double");
  const d1 = ev.find((e) => e[1] === W.E_DRAG && e[2] === ST.HAND), d2 = ev.find((e) => e[1] === W.E_DRAG && e[2] === ST.DOUBLE);
  assert.ok(Math.abs((d2[0] - d1[0]) / 60 - ST.DOUBLE_T) < 0.1, `double after ${ST.DOUBLE_T} s of hand drag`);
  const bank = ev.find((e) => e[1] === W.E_BANKED);
  const secs1 = ST.DOUBLE_T, secs2 = (bank[0] - d2[0]) / 60;
  assert.ok(bank[2] >= W.DRAG_RATE * (ST.DRAG_MULT[1] * secs1 + ST.DRAG_MULT[2] * secs2) * 0.95, `×10 then ×20: ${bank[2]}`);
});

test("fender drag: leaned on to about 2 o'clock the fender is on the road (×40, sparks), banked back under 12", () => {
  assert.ok(ST.FENDER_AT > ST.TWELVE + 0.5 && ST.FENDER_LOOP < ST.TWELVE + 1.1, "between half past 1 and a quarter past 2");
  const { run, ev, nose } = city(2.2);
  const f = ev.find((e) => e[1] === W.E_DRAG && e[2] === ST.FENDER), bank = ev.find((e) => e[1] === W.E_BANKED);
  assert.ok(f, "the fender drag");
  assert.ok(nose[f[0] + 1] >= ST.FENDER_AT - 0.01, `at ${nose[f[0] + 1].toFixed(2)} rad`);
  assert.ok(bank && bank[0] > f[0] + 60 * 3, "held a while, then banked");
  assert.ok(!ev.some((e) => e[1] === W.E_LOST || e[1] === W.E_CRASH), "never looped");
  assert.ok(bank[2] > 10000, `a fender drag pays (${bank[2]})`);
  assert.equal(run.st.lastLevel, ST.FENDER);
});

test("fender drag: on the gas past it, it loops out and the points are lost", () => {
  const { ev, nose } = city(2.2, "over");
  const crash = ev.find((e) => e[1] === W.E_CRASH), lost = ev.find((e) => e[1] === W.E_LOST);
  assert.ok(crash && lost && lost[0] === crash[0], "looped, lost");
  assert.ok(nose[crash[0] - 1] > ST.FENDER_AT, "past the fender");
  assert.ok(!ev.some((e) => e[1] === W.E_BANKED));
});

test("wheelie bar (the mini's upgrade): it caps every drag at its ×5 and the fender never reaches the road", () => {
  const b = newBike("curb-pup", "b1");
  b.mods.wbar = 1;
  const t = tune(b), sp = { ...spec("curb-pup"), power: t.power, shape: t.shape, sweet: t.sweet, hop: t.hop, bar: t.bar };
  assert.ok(t.bar && t.bar.dragX === 5, "the bar's multiplier");
  const run = O.openRun([sp], 3), ev = [], AI = new Float64Array(5);
  assert.deepEqual([ST.HAND, ST.DOUBLE, ST.FENDER].map((l) => run.st.mult(l)), [5, 5, 5], "capped at ×5");
  let top = 0;
  for (let f = 0; f < 60 * 13; f++) {
    const k = run.bike.b, th = run.bike.nose, w = k.S[3], v = k.speed;
    let gas = 0, brake = 0, lean = 0;
    if (f < 50) gas = v < 4 ? 1 : 0;
    else if (f < 60 * 8.5) {
      // Leaned on hard (aiming past the fender line): the bar holds it short of the fender.
      const u = (2.2 - th) * 10 - w * 4;
      gas = u > 0 ? 1 : 0.7; brake = u < 0 ? Math.min(1, -u) : 0; lean = th > 1.3 ? 0 : -1;
    } else (gas = 0), (brake = 1), (lean = 1);
    run.autopilot(AI);
    run.step(DT, gas, brake, lean, AI[3], 0);
    for (let q = 0; q < run.n; q++) ev.push([f, run.ev[q * 2], run.ev[q * 2 + 1]]);
    run.clear();
    top = Math.max(top, th);
  }
  const lv = ev.filter((e) => e[1] === W.E_DRAG).map((e) => e[2]);
  assert.ok(lv.includes(ST.HAND) && !lv.includes(ST.FENDER), `drag levels ${lv}`);
  assert.ok(top < ST.FENDER_AT, `held by the bar at ${top.toFixed(2)} rad`);
  assert.ok(!ev.some((e) => e[1] === W.E_CRASH || e[1] === W.E_LOST), "never looped out");
  const bank = ev.find((e) => e[1] === W.E_BANKED);
  assert.ok(bank, "banked");
  // ×5 all the way (a stock bike: ×10, then ×20 after DOUBLE_T), plus the streak.
  const d1 = ev.find((e) => e[1] === W.E_DRAG && e[2] === ST.HAND), secs = (bank[0] - d1[0]) / 60, want = W.DRAG_RATE * 5 * secs + W.STREAK * secs * secs;
  assert.ok(Math.abs(bank[2] - want) < want * 0.05, `×5, not ×10/×20: ${bank[2]} over ${secs.toFixed(1)} s (×5: ${Math.round(want)})`);
});

/** A bare bike and the stunts on flat ground, for the whip and the combo button. */
function bare() {
  const flat = { sample(_x, _z, o) { o[0] = 0; o[1] = 0; o[2] = 1; o[3] = 0; return 0; } };
  const b = bike(flat, spec("sparkhound").power, spec("sparkhound").shape), sc = T.tricks(), st = ST.stunts(sc, 5);
  return { b, sc, st };
}
/** Throw it up (vy) and step: `steer(f)`, `combo(f)` each frame; the events. */
function fly({ b, st }, vy, steer, combo, frames = 120) {
  const ev = [];
  b.reset(0, 0, 0);
  for (let f = 0; f < 30; f++) b.set(1, 0, 0, 0), b.step(DT), b.clear(), st.step(DT, b, true, 0, 0);
  b.S[6] = vy;
  let crashed = -1;
  for (let f = 0; f < frames; f++) {
    b.set(0.4, 0, 0, 0, st.amount);
    b.step(DT);
    b.clear();
    if (st.step(DT, b, true, steer(f), combo(f)) === ST.CRASH) b.knock(BAIL), (crashed = f);
    for (let k = 0; k < st.n; k++) ev.push([f, st.ev[k * 2], st.ev[k * 2 + 1]]);
    st.clear();
    if (crashed >= 0 || b.crashed) break;
  }
  return { ev, crashed: crashed >= 0 || b.crashed };
}

test("whip: kicked out and back in the air counts (chained: each worth more), banked on a clean landing", () => {
  const r = bare();
  const { ev, crashed } = fly(r, 9, (f) => (f < 14 ? 1 : f < 24 ? 0 : f < 38 ? -1 : 0), () => 0);
  assert.ok(!crashed, "landed straight");
  const whips = ev.filter((e) => e[1] === ST.ST_WHIP);
  assert.deepEqual(whips.map((e) => e[2]), [1, 2], "two whips, chained");
  const land = ev.find((e) => e[1] === ST.ST_LANDED);
  assert.ok(land && land[2] === ST.WHIP_PTS * (1 + 2), `banked ${land?.[2]}`);
  assert.equal(r.sc.S[T.SC], land[2], "in the score");
});

test("whip: landed still kicked out, it is a crash and nothing is banked", () => {
  const r = bare();
  const { ev, crashed } = fly(r, 9, () => 1, () => 0);
  assert.ok(crashed, "whipped out");
  assert.ok(ev.some((e) => e[1] === ST.ST_WHIPCRASH));
  assert.equal(r.sc.S[T.SC], 0);
});

test("combo button: the ladder (seat tap → knee knocker → side kick → can-can), then seeded random; held longer pays more", () => {
  const ids = [], pts = [];
  const r = bare();
  r.b.reset(0, 0, 0);
  // Ride on, press the button 8 times (each held 0.5 s), on the ground.
  for (let f = 0, k = 0; f < 60 * 12; f++) {
    const t = f % 60, press = f > 60 && k < 8 && t < 30 ? 1 : 0;
    if (f > 60 && t === 59) k++;
    r.b.set(r.b.speed < 6 ? 1 : 0, 0, 0, 0, r.st.amount);
    r.b.step(DT); r.b.clear();
    r.st.step(DT, r.b, true, 0, press);
    for (let q = 0; q < r.st.n; q++) {
      if (r.st.ev[q * 2] === ST.ST_TRICK) ids.push(r.st.ev[q * 2 + 1]);
      if (r.st.ev[q * 2] === ST.ST_DONE) pts.push(r.st.ev[q * 2 + 1]);
    }
    r.st.clear();
  }
  assert.equal(ids.length, 8);
  assert.deepEqual(ids.slice(0, 4), [0, 1, 2, 3], "the ladder: " + ids.map((i) => ST.COMBOS[i]).join(", "));
  for (let i = 4; i < 8; i++) assert.notEqual(ids[i], ids[i - 1], "never the same twice running");
  assert.ok(pts.slice(0, 4).every((p, i) => i === 0 || p > pts[i - 1]), `up the ladder, each worth more: ${pts.join(", ")}`);
  // The same presses on another run: the same tricks (seeded).
  const again = bare();
  const ids2 = [];
  again.b.reset(0, 0, 0);
  for (let f = 0, k = 0; f < 60 * 12; f++) {
    const t = f % 60, press = f > 60 && k < 8 && t < 30 ? 1 : 0;
    if (f > 60 && t === 59) k++;
    again.b.set(again.b.speed < 6 ? 1 : 0, 0, 0, 0, again.st.amount);
    again.b.step(DT); again.b.clear();
    again.st.step(DT, again.b, true, 0, press);
    for (let q = 0; q < again.st.n; q++) if (again.st.ev[q * 2] === ST.ST_TRICK) ids2.push(again.st.ev[q * 2 + 1]);
    again.st.clear();
  }
  assert.deepEqual(ids2, ids);
  // Held longer: more.
  const hold = (secs) => {
    const q = bare();
    q.b.reset(0, 0, 0);
    let got = 0;
    for (let f = 0; f < 60 * 8; f++) {
      q.b.set(q.b.speed < 6 ? 1 : 0, 0, 0, 0, q.st.amount);
      q.b.step(DT); q.b.clear();
      q.st.step(DT, q.b, true, 0, f > 60 && f < 60 + secs * 60 ? 1 : 0);
      for (let k = 0; k < q.st.n; k++) if (q.st.ev[k * 2] === ST.ST_DONE) got = q.st.ev[k * 2 + 1];
      q.st.clear();
    }
    return got;
  };
  assert.ok(hold(2) > hold(0.5) * 1.5, `held 2 s ${hold(2)} vs 0.5 s ${hold(0.5)}`);
});

test("combo button in the air: ×3, pending until a clean landing; still out at the landing it is a bail", () => {
  const r = bare();
  const a = fly(r, 9, () => 0, (f) => (f < 25 ? 1 : 0));
  assert.ok(!a.crashed, "tucked back in time");
  const done = a.ev.find((e) => e[1] === ST.ST_DONE), land = a.ev.find((e) => e[1] === ST.ST_LANDED);
  assert.ok(done && land && land[0] > done[0] && land[2] >= done[2], "pending, then banked on the landing");
  const r2 = bare();
  const b = fly(r2, 9, () => 0, () => 1);
  assert.ok(b.crashed, "landed still out: a bail");
  assert.equal(r2.sc.S[T.SC], 0);
});

/** The ENDLESS grounds: up and held at `goal` past 12, then down. */
function endless(goal, biome = "desert") {
  const tr = desertTrack(DESERT_SEED, biome), t = tune(newBike("sparkhound", "b1"));
  const fr = FS.freeRun(tr, { power: t.power, shape: t.shape, sweet: t.sweet }, 1e9), I = new Float64Array(6), ev = [];
  for (let f = 0; f < 60 * 12; f++) {
    const b = fr.riders[0], th = b.crashed ? 0 : b.rel, w = b.S[3], v = b.speed;
    I.fill(0);
    if (f < 50) I[0] = v < 4 ? 1 : 0;
    else if (f < 60 * 8.5) {
      const u = (goal - th) * 10 - w * 4;
      I[0] = u > 0 ? 1 : 0.7; I[1] = u < 0 ? Math.min(1, -u) : 0; I[2] = th > 1.3 ? 0 : 1;
    } else (I[1] = 1), (I[2] = -1);
    fr.step(DT, I);
    for (let k = 0; k < fr.n; k++) ev.push([f, fr.ev[k * 3], fr.ev[k * 3 + 2]]);
    fr.clear();
  }
  return { fr, ev };
}

test("ENDLESS grounds: the same tricks as the city: ground tricks banked, the hand drag past 12, the score", () => {
  // (The dunes roll under the rider: the crude rider here loops one, then holds a hand drag.)
  const { fr, ev } = endless(1.75);
  assert.ok(ev.some((e) => e[1] === FS.E_GROUND), "a ground trick banked");
  const lv = ev.filter((e) => e[1] === FS.E_DRAG).map((e) => e[2]);
  assert.ok(lv.includes(ST.HAND), `drags: ${lv}`);
  const bank = ev.find((e) => e[1] === FS.E_BANKED);
  assert.ok(bank && bank[2] > 200, `banked ${bank?.[2]}`);
  assert.ok(fr.sc.S[T.SC] >= bank[2], `in the score (${fr.sc.S[T.SC]})`);
});

test("stunts: deterministic in both endless modes, and no allocation per step", async () => {
  const hash = (bytes) => Buffer.concat(bytes.map((x) => Buffer.from(x))).toString("base64");
  assert.equal(hash(city(2.2).run.bytes), hash(city(2.2).run.bytes));
  assert.equal(hash(endless(1.75).fr.bytes), hash(endless(1.75).fr.bytes));
  const tr = desertTrack(DESERT_SEED, "desert"), t = tune(newBike("sparkhound", "b1"));
  const fr = FS.freeRun(tr, { power: t.power, shape: t.shape, sweet: t.sweet }, 1e9), I = new Float64Array(6);
  for (let f = 0; f < 120; f++) (I[0] = 1), fr.step(DT, I), fr.clear();
  const n = await minorGCs(() => {
    for (let f = 0; f < 60 * 10; f++) {
      const b = fr.riders[0], th = b.crashed ? 0 : b.rel, u = (1.75 - th) * 10 - b.S[3] * 4;
      I[0] = u > 0 ? 1 : 0.7; I[1] = u < 0 ? Math.min(1, -u) : 0; I[2] = th > 1.3 ? 0 : 1; I[3] = f % 90 < 20 ? 1 : 0; I[5] = f % 120 < 40 ? 1 : 0;
      fr.step(DT, I);
      fr.clear();
    }
  }, 5);
  assert.ok(n <= 2, `${n} young-generation GCs`);
});
