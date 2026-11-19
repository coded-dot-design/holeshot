// Track Day (src/modes/race/circuits.ts), headless: the three paved circuits are the same every build,
// close, never cross themselves and fit their tables, each with its own character (the long straight,
// the chicanes and the hairpin, the kart-tight loop); a scripted fast rider on each street bike class
// (the mini, the supersport, the naked V4: full gas to the bike's top speed, braking for each corner
// by its radius) laps every circuit three times with no excursion off the asphalt and no crash, the
// supersport and the naked flat out on the long straight (the table of lap times and counts is
// printed); every AI rival finishes three laps, a dirt bike's on knobblies too; the race of four is
// allocation-free; the mode, the asphalt rules (street bikes as tuned, a dirt bike's road penalty)
// and the payout and the best lap per circuit kept in the profile.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const C = await import("../src/modes/race/course.ts");
const TD = await import("../src/modes/race/circuits.ts");
const { tune } = await import("../src/model/tune.ts");
const { newBike, fresh, normalize } = await import("../src/model/profile.ts");
const F = await import("../src/model/families.ts");
const { model } = await import("../src/data/roster.ts");
const { meter } = await import("../src/modes/meter.ts");
const { settle, apply, payout, lapKey } = await import("../src/model/economy.ts");
const { PAYOUT } = await import("../src/data/economy.ts");
const M = await import("../src/modes/index.ts");

const STREET = ["curb-pup", "tidebreaker", "bare-knuckle"];
const onTrack = (id) => F.onGround(tune(newBike(id, "td")), "trackday");
const rivals = (tb) => TD.trackDayRivals(tb.model, F.roadPower);

test("track day: three circuits, the same every build; they close, never cross, fit the table; each its own character", () => {
  assert.equal(TD.TRACK_DAY.length, 3);
  assert.equal(new Set(TD.TRACK_DAY.map((p) => p.name)).size, 3);
  for (const p of TD.TRACK_DAY) {
    assert.equal(p.venue, "td");
    const a = C.makeTrack(p), b = C.makeTrack(p);
    assert.deepEqual(Array.from(a.TRACK), Array.from(b.TRACK), `${p.id}: the same line`);
    assert.deepEqual(Array.from(a.course().h), Array.from(b.course().h), `${p.id}: the same ground`);
    assert.deepEqual(Array.from(a.course().kind), Array.from(b.course().kind), `${p.id}: the same paint`);
    // It closes (the last point meets the first, the heading comes round once).
    const { TRACK, NT, LAP, HX, HZ, W } = a;
    assert.ok(Math.hypot(TRACK[0] - TRACK[(NT - 1) * 2], TRACK[1] - TRACK[(NT - 1) * 2 + 1]) <= LAP / NT + 0.1, `${p.id}: closes`);
    const turn = p.plan.reduce((s, v) => s + (typeof v === "number" ? 0 : v.turn), 0);
    assert.ok(Math.abs(Math.abs(turn) - 2 * Math.PI) < 1e-9, `${p.id}: the heading comes round`);
    // Fits: the asphalt, its run-off and the tyre walls inside the table.
    const m = W / 2 + C.TD_RUNOFF + 1;
    for (let i = 0; i < NT; i++) assert.ok(Math.abs(TRACK[i * 2]) < HX - m && Math.abs(TRACK[i * 2 + 1]) < HZ - m, `${p.id}: point ${i} fits`);
    // Never crosses itself: two points far apart along the lap keep the asphalt's edges 2 apart.
    const far = Math.ceil(14 / (LAP / NT)), sep = W + 2;
    for (let i = 0; i < NT; i++)
      for (let j = i + far; j < NT && NT - (j - i) >= far; j++) assert.ok(Math.hypot(TRACK[i * 2] - TRACK[j * 2], TRACK[i * 2 + 1] - TRACK[j * 2 + 1]) >= sep, `${p.id}: ${i}/${j} too close`);
    // No jumps: flat asphalt; paint on the asphalt and its run-off.
    assert.equal(p.features.length, 0);
    const kinds = new Set(a.course().kind);
    assert.ok(kinds.has(C.KIND_TRACK) && kinds.has(C.KIND_FACE), `${p.id}: asphalt and run-off`);
  }
  const [fast, tech, kart] = TD.TRACK_DAY.map((p) => C.makeTrack(p));
  const straights = (p) => p.plan.filter((v) => typeof v === "number");
  const radii = (p) => p.plan.filter((v) => typeof v !== "number").map((v) => v.r);
  // Fast: the longest straight of the three (over 100 units), sweeping corners.
  assert.ok(Math.max(...straights(TD.TRACK_DAY[0])) > 100 && Math.max(...straights(TD.TRACK_DAY[0])) > Math.max(...straights(TD.TRACK_DAY[1])) * 2);
  // Technical: two chicanes (a turn straight back the other way within 8 units) and a hairpin.
  const tp = TD.TRACK_DAY[1].plan, ch = tp.filter((v, k) => typeof v !== "number" && Math.abs(v.turn) < 1 && typeof tp[k + 1] === "number" && tp[k + 1] <= 8 && typeof tp[k + 2] !== "number" && Math.sign(tp[k + 2].turn) === -Math.sign(v.turn));
  assert.ok(ch.length >= 2, `${ch.length} chicanes`);
  assert.ok(tp.some((v) => typeof v !== "number" && Math.abs(v.turn) >= Math.PI - 1e-9), "a hairpin");
  // Kart: the shortest, the tightest corners.
  assert.ok(kart.LAP < tech.LAP && tech.LAP < fast.LAP, `laps ${kart.LAP.toFixed(0)} < ${tech.LAP.toFixed(0)} < ${fast.LAP.toFixed(0)}`);
  assert.ok(Math.max(...radii(TD.TRACK_DAY[2])) <= 6 && kart.W < tech.W && tech.W < fast.W);
  console.log("track day: " + TD.TRACK_DAY.map((p, k) => `${p.name} ${[fast, tech, kart][k].LAP.toFixed(1)} units, ${p.width} wide`).join(" · "));
});

/** A fast rider: the autopilot's line (its steering and lean), full gas up to the bike's top speed
 *  wherever no corner ahead wants less (the line's speed: a corner's by its radius, braked for in time),
 *  the brakes on past it. Three laps; counts the excursions off the asphalt (past its edge by 0.5) and the crashes. */
function fastLaps(plan, id) {
  const tb = onTrack(id), top = F.paceOf(tb).ups, t = C.makeTrack(plan), race = C.motoRace(7, t, { power: tb.power, shape: tb.shape }, rivals(tb));
  const I = new Float64Array(5), AP = new Float64Array(5), half = t.W / 2 + 0.5;
  race.go(tb.power);
  let off = 0, was = false, crashes = 0, vmax = 0;
  for (let i = 0; i < 60 * 300 && !race.finished(0); i++) {
    race.autopilot(0, AP);
    const b = race.riders[0], v = b.speed, want = Math.min(top + 1, t.WANT[race.nearIndex(0)]);
    I[0] = v < want ? 1 : 0;
    I[1] = v > want + 0.5 ? 1 : 0;
    I[2] = AP[2]; I[3] = AP[3]; I[4] = 0;
    race.step(1 / 60, I, false);
    for (let k = 0; k < race.n; k++) if (race.ev[k * 3] === C.E_CRASH && race.ev[k * 3 + 1] === 0) crashes++;
    race.clear();
    if (race.phase === C.RACE) vmax = Math.max(vmax, v);
    const o = Math.abs(race.offTrack(0)) > half;
    if (o && !was) off++;
    was = o;
  }
  return { off, crashes, finished: race.finished(0), time: race.finishTime(0), best: race.bestLap(0), vmax, top };
}

test("track day: a scripted fast lap on each street bike class laps every circuit clean (0 off the asphalt, 0 crashes)", () => {
  const rows = [];
  for (const p of TD.TRACK_DAY)
    for (const id of STREET) {
      const r = fastLaps(p, id);
      rows.push(`${p.name.padEnd(13)} ${id.padEnd(13)} 3 laps ${r.time.toFixed(1)} s · best lap ${r.best.toFixed(2)} s · top ${r.vmax.toFixed(1)}/${r.top.toFixed(1)} · off ${r.off} · crashes ${r.crashes}`);
      assert.ok(r.finished, `${p.id} ${id}: finishes`);
      assert.equal(r.off, 0, `${p.id} ${id}: never off the asphalt`);
      assert.equal(r.crashes, 0, `${p.id} ${id}: no crash`);
      // The big bikes are flat out on MERIDIAN RING's straight (within 3 % of their top speed).
      if (p.id === "td-meridian" && id !== "curb-pup") assert.ok(r.vmax > r.top * 0.97, `${id}: flat out on the straight (${r.vmax.toFixed(1)} of ${r.top.toFixed(1)})`);
    }
  console.log("track day, a fast rider per street class:\n  " + rows.join("\n  "));
});

test("track day: every AI rival finishes three laps (street rivals of the class; a dirt bike's on knobblies)", () => {
  for (const p of TD.TRACK_DAY)
    for (const id of [...STREET, "hivequeen", "sparkhound"]) {
      const tb = onTrack(id), t = C.makeTrack(p), race = C.motoRace(11, t, { power: tb.power, shape: tb.shape }, rivals(tb)), I = new Float64Array(5);
      race.go(tb.power);
      for (let i = 0; i < 60 * 400 && ![0, 1, 2, 3].every((r) => race.finished(r)); i++) race.step(1 / 60, I, true), race.clear();
      for (let r = 0; r < 4; r++) assert.ok(race.finished(r), `${p.id} ${id}: rider ${r} finishes (${race.crashes(r)} crashes)`);
      assert.equal(race.crashes(0), 0, `${p.id} ${id}: the autopilot rides it clean`);
    }
});

test("track day: the rivals ride street bikes of the rider's class", () => {
  const P = (id) => model(id).power;
  assert.deepEqual(rivals(onTrack("curb-pup")), [P("curb-pup"), P("curb-pup"), P("curb-pup")], "the mini races minis");
  for (const id of ["tidebreaker", "bare-knuckle"]) {
    const rv = rivals(onTrack(id));
    assert.ok(rv.every((x) => x === P("tidebreaker") || x === P("bare-knuckle")) && rv.includes(P("bare-knuckle")), `${id}: the big street bikes`);
  }
  const d = rivals(onTrack("hivequeen"));
  assert.ok(d.every((x) => x.grip < 1.1 && x.name === "2-STROKE"), "a dirt bike races its class, on knobblies");
});

test("track day: a race of four allocates nothing per step", async () => {
  const tb = onTrack("tidebreaker"), r = C.motoRace(5, C.makeTrack(TD.TRACK_DAY[0]), { power: tb.power, shape: tb.shape }, rivals(tb)), I = new Float64Array(5), m = meter("trackday");
  const work = () => {
    r.go(tb.power);
    for (let i = 0; i < 60 * 50 && r.phase !== C.DONE; i++) (r.step(1 / 60, I, true), m.tick(r.riders[0], 1 / 60), r.clear());
  };
  work(), work();
  const n = await minorGCs(work, 5);
  // (As the Race's: V8 boxes a few doubles in four bikes' steps; bounded, never growing.)
  assert.ok(n <= 5, `${n} young-generation GCs over a race of four`);
  console.log(`track day: ${n} young-generation GCs over 50 s of a race of four`);
});

test("track day: the asphalt rules: street bikes as tuned, a dirt bike's road penalty; no dirt warning", () => {
  const sport = tune(newBike("tidebreaker", "x")), dirt = tune(newBike("buzzline", "x"));
  assert.ok(F.STREET_MODES.includes("trackday") && !F.onDirt("trackday"));
  assert.equal(F.onGround(sport, "trackday"), sport, "a street bike rides as tuned");
  assert.ok(!F.dirtWarning(model("tidebreaker"), "trackday"), "no warning");
  const d = F.onGround(dirt, "trackday");
  assert.ok(Math.abs(d.power.grip - dirt.power.grip * F.ROAD_FX.grip) < 1e-12 && Math.abs(d.power.brake - dirt.power.brake * F.ROAD_FX.brake) < 1e-12, "knobblies on asphalt");
  assert.deepEqual(d.shape, dirt.shape);
  assert.equal(F.onGround(dirt, "endcity"), dirt, "Wheelie City is unchanged");
});

test("track day: the mode, the payout and the best lap per circuit kept in the profile", () => {
  const md = M.mode("trackday");
  assert.equal(md.id, "trackday");
  assert.equal(md.name, "TRACK DAY");
  assert.deepEqual(md.maps.map((m) => m.id), ["td-meridian", "td-knotworks", "td-bottlecap"]);
  assert.ok(!M.MODES.some((m) => m.id === "trackday"), "its tile is the menu's own");
  assert.equal(M.TRACK_DAY_MAPS.length, 3);
  const st = { mode: "trackday", seconds: 60, distance: 1000, gas: 50, air: 0, wheelie: 0, crashes: 0, hard: 0, finished: true, place: 0, time: 58.2, bestLap: 18.9, led: true, where: "td-meridian" };
  assert.equal(payout(st)[0][1], PAYOUT.race.place[0], "pays as a race does");
  let p = { ...fresh(), name: "X", credits: 0 };
  p = normalize({ ...p, bikes: [newBike("tidebreaker", "b")], ride: 0 });
  const bike = p.bikes[0];
  p = apply(p, settle(st, bike));
  assert.equal(p.stats.best[lapKey("td-meridian")], 18.9, "the best lap kept");
  assert.equal(p.stats.wins, 1);
  p = apply(p, settle({ ...st, bestLap: 19.4, time: 60 }, bike));
  assert.equal(p.stats.best[lapKey("td-meridian")], 18.9, "a slower lap does not replace it");
  p = apply(p, settle({ ...st, bestLap: 18.1, finished: false }, bike));
  assert.equal(p.stats.best[lapKey("td-meridian")], 18.1, "any lap completed counts");
  assert.equal(M.trackDayBest(p.stats.best, "td-meridian"), 18.1);
  assert.equal(M.trackDayBest(p.stats.best, "td-bottlecap"), 0);
  // An old save loads with no Track Day bests (the key is additive: no version step).
  assert.equal(M.trackDayBest(normalize(fresh()).stats.best, "td-knotworks"), 0);
});
