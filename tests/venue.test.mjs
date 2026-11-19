// The venues (src/modes/race/venue.ts) and the endless Big Air line (src/modes/bigair/line.ts),
// headless. MX: every outdoor plan made MX-sized is the same every time, keeps the generator's shape
// checks, and a fast rider per bike class (full gas to the bike's top speed, braking for each turn by
// its radius, the autopilot's line) laps it with fewer excursions off the track than the plan it came
// from (the before → after table is printed). SX: the stadium tracks pass the shape checks and every
// starter finishes three laps on them. Series: MX and SX championships, old saves load as MX. Big
// Air: the line is a pure function of the bike, and 2 km at full gas on the fastest bike in the
// garage lands every jump on its landing's down ramp, with no crash.
import test from "node:test";
import assert from "node:assert/strict";

const C = await import("../src/modes/race/course.ts");
const V = await import("../src/modes/race/venue.ts");
const Gn = await import("../src/modes/race/generate.ts");
const A = await import("../src/modes/bigair/show.ts");
const Ln = await import("../src/modes/bigair/line.ts");
const Sr = await import("../src/model/series.ts");
const { tune } = await import("../src/model/tune.ts");
const { newBike, fresh } = await import("../src/model/profile.ts");
const { MODELS, STARTERS } = await import("../src/data/roster.ts");
const { onGround, paceOf } = await import("../src/model/families.ts");

/** The fastest model of each class (on the dirt as a race tunes it). */
const FAST = ["hivequeen", "bulkhead", "nightloop", "feral-coil", "tidebreaker", "bare-knuckle"];

/** A fast rider: the autopilot's steering and lean, the throttle pinned to the bike's top speed
 *  except where a turn ahead (by its radius) or a feature (the line's own speed) wants less. */
function fastLaps(plan, id) {
  const tb = onGround(tune(newBike(id, "x")), "race"), top = paceOf(tb).ups, t = C.makeTrack(plan), race = C.motoRace(7, t, { power: tb.power, shape: tb.shape });
  const I = new Float64Array(5), AP = new Float64Array(5), half = t.W / 2 + 0.5;
  race.go(tb.power);
  let off = 0, was = false, crashes = 0;
  for (let i = 0; i < 60 * 300 && race.phase !== C.DONE; i++) {
    race.autopilot(0, AP);
    const ni = race.nearIndex(0), b = race.riders[0], v = b.speed;
    let tgt = top + 1;
    for (let a = 1; a < 70; a++) {
      const j = (ni + a) % t.NT;
      if (t.TURN[j]) {
        const vt = 8.6 * Math.sqrt(t.RADIUS[j] / 5.2);
        tgt = Math.min(tgt, Math.sqrt(vt * vt + 9 * a));
      }
    }
    if (t.WANT[ni] < 14.4 && !t.INTO[ni]) tgt = Math.min(tgt, t.WANT[ni]);
    I[0] = b.air > 0 ? 0 : v < tgt ? 1 : 0;
    I[1] = b.air > 0 ? 0 : v > tgt + 0.5 ? 1 : 0;
    I[2] = AP[2]; I[3] = AP[3]; I[4] = 0;
    race.step(1 / 60, I, false);
    for (let k = 0; k < race.n; k++) if (race.ev[k * 3] === C.E_CRASH && race.ev[k * 3 + 1] === 0) crashes++;
    race.clear();
    const o = Math.abs(race.offTrack(0)) > half;
    if (o && !was) off++;
    was = o;
  }
  return { off, crashes, finished: race.finished(0) };
}

test("venue: MX plans are the same every time, bigger and wider, and keep the generator's shape checks", () => {
  const plans = [C.MOTO_TRACK, ...[0.1, 0.5, 0.9].map((d) => Gn.generateTrack(4242, d).plan)];
  for (const p of plans) {
    const m = V.mxPlan(p), t0 = C.makeTrack(p), t1 = C.makeTrack(m);
    assert.deepEqual(m, V.mxPlan(p), "pure");
    assert.equal(V.mxPlan(m), m, "an MX plan is not scaled twice");
    assert.equal(m.venue, "mx");
    assert.ok(t1.W > t0.W && t1.LAP > t0.LAP * 1.25, `${p.id}: wider (${t1.W}) and longer (${t0.LAP.toFixed(0)} → ${t1.LAP.toFixed(0)})`);
    assert.equal(Gn.checkShape(m), null, `${p.id} MX: shape`);
    assert.deepEqual(Array.from(C.makeTrack(m).course().h), Array.from(t1.course().h), "the same ground every build");
  }
  assert.equal(V.venueOf(undefined), "mx");
  assert.equal(V.venueOf("sx"), "sx");
});

test("venue: the fast bikes ride MX with fewer excursions off the track than today's tracks (before → after per class)", () => {
  const plans = [C.MOTO_TRACK, ...[0.1, 0.5, 0.9].map((d) => Gn.generateTrack(4242, d).plan)];
  const rows = [];
  let before = 0, after = 0;
  for (const id of FAST) {
    let b = 0, a = 0, bc = 0, ac = 0;
    for (const p of plans) {
      const r0 = fastLaps(p, id), r1 = fastLaps(V.mxPlan(p), id);
      (b += r0.off), (a += r1.off), (bc += r0.crashes), (ac += r1.crashes);
    }
    rows.push(`${id.padEnd(13)} off the track ${b} → ${a} · crashes ${bc} → ${ac}`);
    (before += b), (after += a);
    assert.ok(a <= b, `${id}: no more excursions on MX (${b} → ${a})`);
  }
  console.log("MX, a fast rider on four tracks (NEON LOOP + generated at 0.1, 0.5, 0.9), per class:\n  " + rows.join("\n  "));
  assert.ok(after * 3 < before, `MX cuts the excursions (${before} → ${after})`);
});

test("venue: SX tracks are tight, pass the shape checks, and every starter finishes three laps", () => {
  assert.ok(V.SX_TRACKS.length >= 2);
  const laps = [];
  for (const p of V.SX_TRACKS) {
    assert.equal(p.venue, "sx");
    assert.equal(Gn.checkShape(p), null, `${p.id}: shape`);
    const t = C.makeTrack(p), mx = C.makeTrack(V.mxPlan(Gn.generateTrack(4242, 0.5).plan));
    const rmax = Math.max(...Array.from(t.RADIUS)), rmin = Math.min(...Array.from(mx.RADIUS).filter((r) => r > 0));
    assert.ok(t.W < mx.W && rmax < rmin, `${p.id}: narrower (${t.W} vs ${mx.W}) and every turn tighter (${rmax} vs MX's tightest ${rmin.toFixed(1)})`);
    const kinds = new Set(p.features.filter((_, k) => k % 3 === 0));
    assert.ok(kinds.has(C.F_TRIPLE) && kinds.has(C.F_WHOOPS), `${p.id}: a triple and whoops`);
    for (const m of STARTERS) {
      // Rivals of the rider's class, as a race picks them (src/modes/index.ts rivalsFor).
      const same = MODELS.filter((x) => x.cls === m.cls).sort((x, y) => x.tier - y.tier), riv = [same[1] ?? same[0], same[0], same[2] ?? same[0]].map((x) => x.power);
      const tb = tune(newBike(m.id, "s")), race = C.motoRace(7, t, { power: tb.power, shape: tb.shape }, riv), I = new Float64Array(5);
      race.go(tb.power);
      for (let i = 0; i < 60 * 240 && !race.finished(0); i++) race.step(1 / 60, I, true), race.clear();
      assert.ok(race.finished(0), `${p.id}: ${m.id} finishes three laps (${race.crashes(0)} crashes)`);
      if (m.id === "buzzline") assert.equal(race.crashes(0), 0, `${p.id}: the 2-stroke starter rides it clean`);
      laps.push(`${p.id} ${m.id}: ${race.finishTime(0).toFixed(1)} s, ${race.crashes(0)} crashes`);
    }
  }
  assert.ok(V.SX_TRACKS.some((p) => p.features.filter((_, k) => k % 3 === 0 && p.features[k] === C.F_DOUBLE).length >= 2), "a rhythm section");
  console.log("SX, each starter on the autopilot (three laps):\n  " + laps.join("\n  "));
});

test("venue: Series has an MX and an SX championship; a save from before venues loads as MX", () => {
  let p = fresh();
  const old = Sr.normSeries({ best: { rookie: 1 }, titles: 2, run: { tier: "pro", seed: 9, round: 1, points: [25, 18, 15, 12], results: [[0, 1, 2, 3]] } });
  assert.equal(old.run.venue, "mx", "an old run is MX");
  assert.deepEqual(old.best, { rookie: 1 });
  assert.deepEqual(old.bestSx, {}, "SX starts empty");
  assert.ok(Sr.unlocked(old, "pro", "mx") && !Sr.unlocked(old, "pro", "sx"), "unlocks are per venue");
  p = { ...p, credits: 1e6 };
  const sx = Sr.enter(p, "rookie", 77, "sx"), mx = Sr.enter(p, "rookie", 77);
  assert.equal(sx.series.run.venue, "sx");
  assert.equal(mx.series.run.venue, "mx");
  const a = Sr.roundTrack(sx.series.run, 0), b = Sr.roundTrack(sx.series.run, 1), c = Sr.roundTrack(mx.series.run, 0);
  assert.equal(a.venue, "sx");
  assert.notEqual(a.name, b.name, "SX rounds alternate the stadium tracks");
  assert.equal(c.venue, "mx");
  assert.deepEqual(Sr.roundTrack(mx.series.run, 0), c, "the same round, the same track");
});

test("big air: the line is a pure function of the bike; sized by top speed", () => {
  const G1 = Ln.lineFor(17.5, new Float64Array(8)), G2 = Ln.lineFor(25, new Float64Array(8));
  assert.ok(Math.abs(G1[Ln.LK] - 1) < 1e-9 && G2[Ln.LK] > 2, "k = (top / V0)²");
  assert.ok(G2[Ln.LSP] > G1[Ln.LSP] && G2[Ln.LDOWN] > G1[Ln.LDOWN], "a faster bike gets longer jumps");
  const h = (G) => Array.from({ length: 400 }, (_, i) => Ln.heightAt(G, i * 7.3 - 20, ((i * 13) % 31) - 15));
  assert.deepEqual(h(G2), h(Ln.lineFor(25, new Float64Array(8))), "the same ground every time");
  // The banks rise either side: off the dirt is uphill.
  assert.ok(Ln.heightAt(G1, 200, Ln.HW + 2.4) > Ln.heightAt(G1, 200, 0) + 1.5);
});

test("big air: 2 km at full gas on every bike (the fastest included) lands every jump on its down ramp, no crash", () => {
  const top = MODELS.map((m) => [m.id, paceOf(tune(newBike(m.id, "x"))).ups]).sort((a, b) => b[1] - a[1]);
  const rows = [];
  for (const [id] of top) {
    const t = tune(newBike(id, "x")), sh = A.airShow(3, { power: t.power, shape: t.shape }), I = new Float64Array(6), out = new Float64Array(6);
    sh.go(t.power);
    sh.S[1] = 1e9; // the clock out of the way: ride the distance
    let jumps = 0, down = 0, crashes = 0, pend = -1;
    for (let f = 0; f < 60 * 400 && sh.b.pos[0] < 2000; f++) {
      const air0 = sh.b.air > 0;
      // Full gas (shut only to stop a loop-out, as the autopilot does), the autopilot's lean to level the landing, no tricks.
      sh.autopilot(out);
      I[0] = out[0]; I[1] = 0; I[2] = out[2]; I[3] = out[3]; I[4] = 0; I[5] = 0;
      sh.step(1 / 60, I, false);
      if (!air0 && sh.b.air > 0) {
        Ln.prof(sh.G, sh.b.pos[0] - 0.3);
        if (Ln.FK[0] === Ln.P_KICK) pend = Ln.FK[1];
      }
      for (let k = 0; k < sh.n; k++) {
        const ty = sh.ev[k * 2];
        if (ty === A.E_CRASH) crashes++, (pend = -1);
        if (ty === A.E_LAND && pend >= 0) jumps++, (down += sh.landedOn === Ln.P_DOWN ? 1 : 0), (pend = -1);
      }
      sh.clear();
    }
    rows.push(`${id.padEnd(13)} k ${sh.G[Ln.LK].toFixed(2)} · ${jumps} jumps · ${down} on the down ramp · ${crashes} crashes`);
    assert.ok(sh.b.pos[0] >= 2000, `${id}: rode 2 km`);
    assert.equal(crashes, 0, `${id}: no crash`);
    assert.ok(jumps >= 20 && down === jumps, `${id}: every jump on the down ramp (${down}/${jumps})`);
  }
  console.log("Big Air, 2 km at full gas, fastest first:\n  " + rows.join("\n  "));
});
