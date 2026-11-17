// The Race Series (src/model/series.ts, src/data/series.ts): the Rookie Cup is open and the next tier
// opens on a top-two finish; one championship at a time; every round is a generated track, the
// same for the same championship, harder round by round and tier by tier; rivals ride better bikes
// with more nerve as the tier rises; a round's stats pay through the economy (settle → apply: prize
// by place, clean bonus, the championship bonus on the last round, more per tier; a round left pays
// nothing, scores nothing and still wears the bike); the points table after each round; the end of
// a championship records the best place and a title. A real round raced on the autopilot scores the
// rivals from the race's order. The save: v1 → v2 (the series), repaired when broken, round trip
// through the export code.
import test from "node:test";
import assert from "node:assert/strict";

const S = await import("../src/model/series.ts");
const D = await import("../src/data/series.ts");
const P = await import("../src/model/profile.ts");
const { settle, apply } = await import("../src/model/economy.ts");
const { tune } = await import("../src/model/tune.ts");
const C = await import("../src/modes/race/course.ts");
const { meter } = await import("../src/modes/meter.ts");
const { PARTS } = await import("../src/data/economy.ts");

const rider = () => P.setup(P.fresh(), { starter: "buzzline", paint: "acid", number: 7, name: "kip" });
/** A finished round's stats: the player's place, the order, a clean ride. */
const ride = (place, order, extra = {}) => ({ mode: "race", seconds: 40, distance: 360, gas: 25, air: 3, wheelie: 1, crashes: 0, hard: 0, finished: true, place, order, ...extra });
const orderFor = (place) => { const o = [place]; for (let q = 0, r = 1; r < 4; q++) if (q !== place) o.push(q), r++; return o; };
/** Ride one round through the shell's path: roundStats → settle → apply → recordRound. */
function round(p, place, extra) {
  const s = S.roundStats(p, ride(place, orderFor(place), extra)), res = settle(s, P.riding(p));
  return { p: S.recordRound(apply(p, res), s).profile, res, s };
}

test("tiers: three, rounds 4–6, prizes and bonus growing; the rookie cup open, the rest locked", () => {
  assert.deepEqual(D.TIERS.map((t) => t.id), ["rookie", "pro", "masters"]);
  for (let k = 1; k < 3; k++) {
    const a = D.TIERS[k - 1], b = D.TIERS[k];
    assert.ok(b.prize.every((v, i) => v > a.prize[i]) && b.bonus[0] > a.bonus[0] && b.clean > a.clean, `${b.id} pays more`);
    assert.ok(b.diff[0] > a.diff[1] - 1e-9 && b.rivals.nerve[0] > a.rivals.nerve[0] && b.rivals.tiers[0] >= a.rivals.tiers[0], `${b.id} is harder`);
    assert.equal(b.after, a.id);
  }
  for (const t of D.TIERS) assert.ok(t.rounds >= 4 && t.rounds <= 6);
  const p = rider();
  assert.deepEqual(D.TIERS.map((t) => S.unlocked(p.series, t.id)), [true, false, false]);
  assert.equal(S.enter(p, "pro", 1), null, "a locked tier can't be entered");
  const q = S.enter(p, "rookie", 1);
  assert.equal(q.series.run.tier, "rookie");
  assert.equal(S.enter(q, "rookie", 2), null, "one championship at a time");
  assert.equal(S.retire(q).series.run, null);
});

test("rounds: a new generated track each, the same for the same championship, harder as it goes", () => {
  const run = { tier: "rookie", seed: 99 }, a = S.roundTrack(run, 0), b = S.roundTrack(run, 1);
  assert.notDeepEqual(a.plan, b.plan, "a new track each round");
  assert.deepEqual(S.roundTrack({ tier: "rookie", seed: 99 }, 1).plan, b.plan, "the same championship rides the same tracks");
  for (const t of D.TIERS) {
    const r = { tier: t.id, seed: 5 }, ds = [...Array(t.rounds).keys()].map((k) => S.difficulty(r, k));
    assert.ok(ds.every((d, k) => !k || d > ds[k - 1]), `${t.id}: difficulty grows round by round`);
    assert.ok(Math.abs(ds[0] - t.diff[0]) < 1e-9 && Math.abs(ds[ds.length - 1] - t.diff[1]) < 1e-9);
  }
});

test("rivals: named, plated, on bikes of the player's class that get better with the tier", () => {
  const rv = (id) => S.rivals({ tier: id, seed: 77 }, "2t", 7);
  const rk = rv("rookie"), ms = rv("masters");
  assert.equal(new Set([...rk.map((r) => r.number), 7]).size, 4, "plates unique and not the player's");
  assert.ok(rk.every((r) => r.bike.cls === "2t" && D.RIVAL_NAMES.includes(r.name)));
  const pull = (rs) => rs.reduce((a, r) => a + r.bike.power.force, 0);
  assert.ok(pull(ms) > pull(rv("pro")) && pull(rv("pro")) > pull(rk), "more power with the tier");
  assert.deepEqual(rv("pro").map((r) => r.name), S.rivals({ tier: "pro", seed: 77 }, "4t").map((r) => r.name), "names follow the seed");
});

test("a championship: points after every round, prizes through the economy, the bonus at the end, the next tier opens", () => {
  let p = S.enter(rider(), "rookie", 11);
  const T = D.tier("rookie"), credits0 = p.credits;
  let paid = 0;
  const places = [0, 1, 0, 0];
  places.forEach((pl, k) => {
    const before = P.riding(p).parts.tyres, r = round(p, pl);
    p = r.p;
    paid += r.res.credits;
    assert.equal(r.res.lines[0][1], T.prize[pl], `round ${k + 1}: the place pays`);
    assert.ok(r.res.lines.some((l) => l[0] === "CLEAN ROUND"), "a clean round pays its bonus");
    assert.ok(P.riding(p).parts.tyres < before, "every round wears the bike");
    if (k < 3) assert.deepEqual([p.series.run.round, p.series.run.points[0]], [k + 1, places.slice(0, k + 1).reduce((a, x) => a + D.POINTS[x], 0)], "the points table");
    else assert.ok(r.res.lines.some((l) => /CHAMPION/.test(l[0]) && l[1] === T.bonus[0]), "the champion's bonus on the last round");
  });
  assert.equal(p.credits, credits0 + paid, "every credit went through apply()");
  assert.equal(p.series.run, null, "the championship is over");
  assert.deepEqual([p.series.best.rookie, p.series.titles, p.series.last.points[0]], [0, 1, 25 * 3 + 18]);
  assert.equal(S.unlocked(p.series, "pro"), true, "the Pro Circuit opens");
  assert.equal(S.unlocked(p.series, "masters"), false);
  // A higher tier's round pays more for the same place.
  const pro = S.enter(p, "pro", 3), a = round(pro, 1).res.credits, b = round(S.enter(rider(), "rookie", 3), 1).res.credits;
  assert.ok(a > b, `pro ${a} > rookie ${b}`);
});

test("a round left: no points, no pay, the wear still counts; the rivals close up and score", () => {
  let p = S.enter(rider(), "rookie", 4);
  const before = P.riding(p).parts.tyres, s = S.roundStats(p, ride(1, [1, 3, 0, 2], { finished: false })), res = settle(s, P.riding(p));
  assert.equal(res.credits, 0);
  p = S.recordRound(apply(p, res), s).profile;
  assert.deepEqual(p.series.run.points, [0, D.POINTS[2], D.POINTS[0], D.POINTS[1]], "the rivals score in their order");
  assert.ok(P.riding(p).parts.tyres < before);
  // Last in a championship: never a bonus for 4th, never unlocks.
  let q = S.enter(rider(), "rookie", 8);
  for (let k = 0; k < 4; k++) q = round(q, 3).p;
  assert.equal(q.series.best.rookie, 3);
  assert.equal(S.unlocked(q.series, "pro"), false);
});

test("a real round: raced on the autopilot on a generated track, the order scores all four", () => {
  let p = S.enter(rider(), "rookie", 21);
  const run = p.series.run, plan = S.roundTrack(run, 0), t = tune(P.riding(p)), riv = S.rivals(run, t.cls, 7);
  const race = C.motoRace(S.roundSeed(run, 0), C.makeTrack(plan), { power: t.power, shape: t.shape }, riv.map((r) => r.bike.power), { nerve: D.tier("rookie").rivals.nerve });
  const I = new Float64Array(5), m = meter("race");
  race.go(t.power);
  for (let i = 0; i < 60 * 150 && race.phase !== C.DONE; i++) (race.phase === C.RACE && m.tick(race.riders[0], 1 / 60), race.step(1 / 60, I, true), race.clear());
  assert.equal(race.phase, C.DONE, "the round ends");
  const stats = m.stats({ place: race.place(0), finished: race.finished(0), order: [0, 1, 2, 3].map((r) => race.place(r)) });
  assert.deepEqual([...stats.order].sort(), [0, 1, 2, 3]);
  const s = S.roundStats(p, stats), res = settle(s, P.riding(p));
  assert.equal(s.mode, "series");
  assert.ok(res.credits >= D.tier("rookie").prize[3]);
  for (const k of PARTS) assert.ok(res.wear[k] > 0, `${k} wears`);
  p = S.recordRound(apply(p, res), s).profile;
  assert.equal(p.series.run.points.reduce((a, b) => a + b, 0), D.POINTS.reduce((a, b) => a + b, 0), "all four scored");
});

test("save: v1 → v2 adds the series (three wins open the Pro Circuit); broken series repaired; the code round-trips", () => {
  assert.equal(P.VERSION, 3);
  const v1 = { v: 1, name: "OLD", credits: 900, bikes: [{ uid: "b1", model: "anvil" }], stats: { events: 9, wins: 4, earned: 3000, best: { "race:moto-track": 41.2 } } };
  const p = P.migrate(v1);
  assert.deepEqual(p.series, { best: { rookie: 1 }, titles: 0, run: null, last: null });
  assert.equal(S.unlocked(p.series, "pro"), true);
  assert.deepEqual([p.credits, p.bikes[0].model, p.stats.best["race:moto-track"]], [900, "anvil", 41.2], "the rest kept");
  assert.deepEqual(P.migrate({ ...v1, stats: { wins: 1 } }).series.best, {});
  // A v1 export code (DH1-…) still loads.
  const body = Buffer.from(JSON.stringify(v1)).toString("base64url");
  let h = 0x811c9dc5;
  for (let i = 0; i < body.length; i++) h = Math.imul(h ^ body.charCodeAt(i), 0x01000193) >>> 0;
  const code = `DH1-${body}-${h.toString(36).padStart(7, "0").slice(-6).toUpperCase()}`;
  assert.equal(P.importCode(code).profile.series.best.rookie, 1);
  // Broken: unknown tier, bad numbers, a round past the end.
  const bad = P.normalize({ ...p, series: { best: { rookie: 9, nope: 0 }, titles: -3, run: { tier: "pro", seed: "x", round: 99, points: [5, "a"], results: [[0, 1, 2, 3], "no"] }, last: { tier: "nope" } } });
  assert.deepEqual(bad.series.best, { rookie: 3 });
  assert.equal(bad.series.titles, 0);
  assert.deepEqual([bad.series.run.round, bad.series.run.points, bad.series.run.results.length], [4, [5, 0, 0, 0], 4]);
  assert.equal(bad.series.last, null);
  // Mid-championship: save → load and the export code keep it.
  let q = S.enter(rider(), "rookie", 5);
  q = round(q, 2).p;
  assert.deepEqual(P.importCode(P.exportCode(q)).profile.series, q.series);
  assert.match(P.exportCode(q), /^HS3-/);
});
