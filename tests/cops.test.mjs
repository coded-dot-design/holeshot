// Wheelie City's four hoods, its humps and the neon patrol, headless: each hood loads and the
// autopilot rides it (a whole session, scoring, never wedged); every hump flies into the next hood
// and lands upright on every starter class, and a slow one only bumps the fence; the heat rises and
// the patrol spawns the same way every time from the same seed; a unit catches a rider who stops (a
// ticket: the combo and half the points at risk); a hump loses them (an escape, its points) and the
// heat falls away; the payout's escape and ticket lines, never under the floor.
import test from "node:test";
import assert from "node:assert/strict";

const W = await import("../src/modes/wheelie/city.ts");
const H = await import("../src/modes/wheelie/hoods.ts");
const C = await import("../src/modes/wheelie/cops.ts");
const { tune } = await import("../src/model/tune.ts");
const { newBike } = await import("../src/model/profile.ts");
const { payout } = await import("../src/model/economy.ts");
const { PAYOUT } = await import("../src/data/economy.ts");

const STARTERS = ["buzzline", "anvil", "glidewire", "sparkhound"];
const spec = (id) => {
  const t = tune(newBike(id, "b1"));
  return { id, name: id, kind: "", blurb: "", bars: [3, 3, 3], power: t.power, shape: t.shape, sweet: t.sweet, hop: t.hop };
};
const DT = 1 / 60;
/** One step on the autopilot; the events of that step. */
function auto(run, I) {
  run.autopilot(I);
  run.step(DT, I[0], I[1], I[2], I[3], I[4]);
  const ev = [];
  for (let k = 0; k < run.n; k++) ev.push([run.ev[k * 2], run.ev[k * 2 + 1]]);
  run.clear();
  return ev;
}
const inHood = (run) => {
  const h = run.S[W.S_HOOD], p = run.bike.b.pos;
  return Math.abs(p[0] - H.CX[h]) <= H.HX && Math.abs(p[2] - H.CZ[h]) <= H.HZ;
};

test("hoods: four layouts, each its own; the humps pair up across the canals", () => {
  assert.equal(H.HOODS.length, 4);
  assert.deepEqual(H.HOODS.map((h) => h.id), ["block", "hillcrest", "downtown", "marina"]);
  for (const h of H.HOODS) {
    assert.ok(h.houses.length / 8 >= 20 && h.home.length >= 5 && h.route.length >= 8 && h.nodes.length >= 20, `${h.id}: filled`);
    // The loop and the graph are on its streets.
    for (let o = 0; o < h.route.length; o += 2) assert.equal(W.kindAt(h.route[o] + H.CX[H.HOODS.indexOf(h)], h.route[o + 1] + H.CZ[H.HOODS.indexOf(h)]) === H.K_LAWN, false, `${h.id}: waypoint ${o / 2} on a street`);
    const k = H.HOODS.indexOf(h);
    for (let o = 0; o < h.nodes.length; o += 2) assert.ok(W.height(h.nodes[o] + H.CX[k], h.nodes[o + 1] + H.CZ[k]) < 0.05, `${h.id}: node ${o / 2} on a street`);
  }
  // Different layouts: no two hoods share their streets.
  const sig = H.HOODS.map((h) => h.roads.join(","));
  assert.equal(new Set(sig).size, 4);
  assert.equal(H.NHUMP, 8);
  for (let i = 0; i < H.NHUMP; i++) {
    const j = i ^ 1, a = H.HUMPS.slice(i * 5, i * 5 + 5), b = H.HUMPS.slice(j * 5, j * 5 + 5);
    assert.notEqual(a[4], b[4], `hump ${i}: into another hood`);
    assert.deepEqual([a[2], a[3]], [0 - b[2] + 0, 0 - b[3] + 0], `hump ${i}: faces its partner`);
    assert.ok(Math.abs((b[0] - a[0]) * a[2] + (b[1] - a[1]) * a[3] - (H.GAP + 2 * H.LIP)) < 1e-9, `hump ${i}: the canal between`);
    // A canal under the gap.
    assert.equal(W.kindAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), H.K_WATER);
  }
});

test("hoods: each loads and the autopilot rides it for a whole session (no patrol): it scores and never wedges", () => {
  for (let hood = 0; hood < 4; hood++) for (const id of STARTERS) {
    const run = W.cityRun([spec(id)], 11), I = new Float64Array(5);
    run.reset(0, hood);
    let dist = 0, out = 0, wheel = 0;
    const p0 = [...run.bike.b.pos];
    for (let i = 0; i < 60 * (W.SESSION + 5) && run.S[0] !== W.DONE; i++) {
      run.cop.S[C.GRACE] = 99; // (no heat: the hood to itself)
      const x = run.bike.b.pos[0], z = run.bike.b.pos[2];
      auto(run, I);
      dist += Math.hypot(run.bike.b.pos[0] - x, run.bike.b.pos[2] - z);
      if (!inHood(run)) out++;
      if (run.bike.nose > 0.14) wheel += DT;
    }
    const tag = `${H.HOODS[hood].id} on ${id}`;
    assert.equal(run.S[0], W.DONE, `${tag}: the session ends`);
    assert.equal(run.S[W.S_HOOD], hood, `${tag}: stays in its hood`);
    assert.equal(run.S[W.S_UNSTUCK], 0, `${tag}: never wedged`);
    assert.equal(out, 0, `${tag}: on the island`);
    assert.ok(dist > 400 && run.sc.S[0] > 0 && wheel > 1.5, `${tag}: rides ${dist.toFixed(0)} u, ${run.sc.S[0]} points, ${wheel.toFixed(1)} s up`);
    void p0;
  }
});

test("hoods: with the patrol on, the autopilot's session runs its course (chased, it runs for the humps)", () => {
  let escapes = 0, jumps = 0;
  for (let hood = 0; hood < 4; hood++) for (const id of ["glidewire", "buzzline"]) {
    const run = W.cityRun([spec(id)], 7), I = new Float64Array(5);
    run.reset(0, hood);
    for (let i = 0; i < 60 * (W.SESSION + 5) && run.S[0] !== W.DONE; i++) auto(run, I);
    assert.equal(run.S[0], W.DONE, `${hood} ${id}: ends`);
    assert.equal(run.S[W.S_UNSTUCK], 0, `${hood} ${id}: never wedged`);
    escapes += run.cop.S[C.ESC];
    jumps += run.S[W.S_JUMPS];
  }
  assert.ok(escapes >= 6 && jumps >= 8, `${escapes} escapes, ${jumps} humps over 8 sessions`);
});

/** Ride at hump i from `back` units before its lip, full gas, the front kept down; the result. */
function hump(id, i, back = 16, gas = 1) {
  const run = W.cityRun([spec(id)], 3), I = new Float64Array(5);
  run.reset(0, H.HUMPS[i * 5 + 4]);
  const lx = H.HUMPS[i * 5], lz = H.HUMPS[i * 5 + 1], dx = H.HUMPS[i * 5 + 2], dz = H.HUMPS[i * 5 + 3];
  run.place(lx - dx * back, lz - dz * back, dx > 0.5 ? 0 : dx < -0.5 ? Math.PI : dz > 0 ? -Math.PI / 2 : Math.PI / 2);
  run.S[0] = W.RUN;
  const r = { jump: -1, land: -1, crash: false, hood: -1, upright: true, maxV: 0 };
  for (let k = 0; k < 60 * 7; k++) {
    const b = run.bike.b;
    let err = Math.atan2(-((dx ? lz : b.pos[2] + dz * 5) - b.pos[2]), (dx ? b.pos[0] + dx * 5 : lx) - b.pos[0]) - b.yaw;
    err -= 2 * Math.PI * Math.floor(err / (2 * Math.PI) + 0.5);
    // (After the landing: off the gas, on the brakes.)
    const after = r.land >= 0;
    run.step(DT, after ? 0 : b.speed < 4 || gas >= 1 ? gas : 0, after ? 0.6 : 0, run.bike.nose > 0.04 ? 1 : 0.4, after ? 0 : Math.max(-1, Math.min(1, -err * 2.6)), 0);
    r.maxV = Math.max(r.maxV, b.speed);
    for (let e = 0; e < run.n; e++) {
      const t = run.ev[e * 2];
      if (t === W.E_JUMP) r.jump = k * DT;
      if (t === W.E_LAND) (r.land = k * DT), (r.hood = run.ev[e * 2 + 1]);
      if (t === W.E_CRASH) r.crash = true;
    }
    run.clear();
    if (r.land >= 0 && Math.abs(run.bike.nose) > 0.82) r.upright = false;
    if (r.land >= 0 && k * DT > r.land + 1.5) break;
  }
  r.run = run;
  return r;
}

test("humps: every hump flies the canal into the next hood and lands upright, on every starter class", () => {
  for (const id of STARTERS) for (let i = 0; i < H.NHUMP; i++) {
    const r = hump(id, i), want = H.HUMPS[(i ^ 1) * 5 + 4];
    assert.ok(r.jump > 0 && r.land > r.jump && r.land - r.jump < 1.6, `${id} hump ${i}: flies (${r.jump.toFixed(2)} → ${r.land.toFixed(2)})`);
    assert.equal(r.hood, want, `${id} hump ${i}: into ${H.HOODS[want].id}`);
    assert.equal(r.crash, false, `${id} hump ${i}: no crash`);
    assert.ok(r.upright && !r.run.bike.b.crashed && inHood(r.run), `${id} hump ${i}: upright, on the far island`);
  }
});

test("humps: too slow, it only bumps the fence at the top (no flight, no crash)", () => {
  // Rolling in at a walking pace: the gas off once it is moving.
  for (let i = 0; i < H.NHUMP; i += 3) {
    const r = hump("anvil", i, 6, 0.5);
    assert.ok(r.maxV < W.FLY_V, `hump ${i}: slow (${r.maxV.toFixed(1)})`);
    assert.equal(r.jump, -1, `hump ${i}: no flight`);
    assert.equal(r.run.S[W.S_HOOD], H.HUMPS[i * 5 + 4], `hump ${i}: still home`);
    assert.equal(r.crash, false, `hump ${i}: a bump, no crash`);
  }
});

/** A session on the autopilot: the patrol's story (stars, units and where they spawned, tickets, escapes). */
function story(seed, hood = 0, steps = 60 * 60) {
  const run = W.cityRun([spec("sparkhound")], seed), I = new Float64Array(5), log = [];
  run.reset(0, hood);
  for (let i = 0; i < steps && run.S[0] !== W.DONE; i++) {
    for (const [t, v] of auto(run, I)) if (t === W.E_STARS || t === W.E_UNIT || t === W.E_TICKET || t === W.E_ESCAPE) log.push([i, t, v, t === W.E_UNIT ? [...run.cop.P].filter((_, k) => k % C.PS === C.P_X || k % C.PS === C.P_Z).map((v) => v.toFixed(3)).join() : ""].join(":"));
  }
  return { log, P: [...run.cop.P], S: [...run.cop.S], pos: [...run.bike.b.pos] };
}

test("cops: the heat rises from the noise and the patrol spawns, the same way every time from the same seed", () => {
  const a = story(21), b = story(21);
  assert.deepEqual(a, b, "same seed, same chase");
  assert.ok(a.log.some((l) => l.split(":")[1] === String(W.E_STARS)), "the heat rises");
  const spawns = a.log.filter((l) => l.split(":")[1] === String(W.E_UNIT));
  assert.ok(spawns.length >= 2, `units out (${spawns.length})`);
  // Another seed rolls other junctions.
  const c = story(22);
  assert.notDeepEqual(c.log.filter((l) => l.split(":")[1] === String(W.E_UNIT)), spawns, "another seed, another spawn");
  // The first unit waits for a star: nothing out with no heat.
  const run = W.cityRun([spec("sparkhound")], 1);
  run.reset(0, 0);
  run.S[0] = W.RUN;
  for (let i = 0; i < 300; i++) run.step(DT, 0, 0, 0, 0, 0), run.clear();
  assert.equal(run.cop.chasing, 0);
  run.cop.heat(C.UNITS.indexOf(1) * 20);
  for (let i = 0; i < 60; i++) run.step(DT, 0, 0, 0, 0, 0), run.clear();
  assert.equal(run.cop.chasing, 1, "one star: one unit");
});

test("cops: heat cools once the rider is clean and out of sight", () => {
  const cop = C.cops(5);
  cop.heat(30);
  assert.equal(cop.S[C.STARS], 1);
  // Far from the units' streets (no rider move), 3.5 s clean, then 6 a second.
  let t = 0;
  while (cop.S[C.HEAT] > 0 && t < 30) (cop.S[C.GRACE] = 0), cop.step(DT, -9999, -9999, 0, true, true), cop.clear(), (t += DT);
  assert.ok(t > C.COOL_AFTER + 30 / C.COOL - 0.2 && t < C.COOL_AFTER + 30 / C.COOL + 0.3, `cooled in ${t.toFixed(2)} s`);
});

test("cops: a unit catches a rider who stops: TICKET (the combo and half the points at risk), then a grace", () => {
  for (let hood = 0; hood < 4; hood++) {
    const run = W.cityRun([spec("glidewire")], 9 + hood), h = H.HOODS[hood];
    run.reset(0, hood);
    run.S[0] = W.RUN;
    // A rider parked on the loop's first corner with points at risk and a combo going.
    run.place(h.route[0] + H.CX[hood], h.route[1] + H.CZ[hood], 0);
    run.cop.heat(45);
    run.cop.banked(600);
    run.sc.S[0] = 2000; run.sc.S[1] = 3;
    let ticket = -1, lost = 0;
    for (let i = 0; i < 60 * 40 && ticket < 0; i++) {
      run.step(DT, 0, 0, 0, 0, 0);
      for (let k = 0; k < run.n; k++) if (run.ev[k * 2] === W.E_TICKET) (ticket = i * DT), (lost = run.ev[k * 2 + 1]);
      run.clear();
    }
    assert.ok(ticket > 0, `${h.id}: caught (${ticket.toFixed(1)} s)`);
    assert.equal(lost, 300, `${h.id}: half the points at risk`);
    assert.deepEqual([run.sc.S[0], run.sc.S[1], run.cop.S[C.TIX], run.cop.S[C.HEAT], run.cop.S[C.HOT]], [1700, 0, 1, 0, 0], `${h.id}: the score, the combo, the ticket, the heat`);
    // The units peel off; for a few seconds nothing heats up.
    run.cop.heat(50);
    assert.equal(run.cop.S[C.HEAT], 0, `${h.id}: grace`);
    for (let i = 0; i < 120; i++) run.step(DT, 0, 0, 0, 0, 0), run.clear();
    assert.equal(run.cop.chasing, 0, `${h.id}: they leave`);
  }
});

test("cops: jumping a hump loses them: an escape (its points, banked), the units peel off, the heat falls away", () => {
  for (let i = 0; i < H.NHUMP; i++) {
    const run = W.cityRun([spec("sparkhound")], 4), I = new Float64Array(5);
    const hood = H.HUMPS[i * 5 + 4], lx = H.HUMPS[i * 5], lz = H.HUMPS[i * 5 + 1], dx = H.HUMPS[i * 5 + 2], dz = H.HUMPS[i * 5 + 3];
    run.reset(0, hood);
    run.place(lx - dx * 18, lz - dz * 18, dx > 0.5 ? 0 : dx < -0.5 ? Math.PI : dz > 0 ? -Math.PI / 2 : Math.PI / 2);
    run.S[0] = W.RUN;
    run.cop.heat(65);
    run.cop.banked(400);
    run.sc.S[0] = 1000;
    // Two units out, then the run for the hump.
    for (let k = 0; k < 60 * 4 && run.cop.chasing < 2; k++) (run.cop.S[C.CALM] = 0), run.step(DT, 0, 0, 0, 0, 0), run.clear();
    assert.ok(run.cop.chasing >= 2, `hump ${i}: chased (${run.cop.chasing})`);
    let esc = -1, land = -1, stars = 0;
    for (let k = 0; k < 60 * 6 && land < 0; k++) {
      const b = run.bike.b;
      let err = Math.atan2(-((dx ? lz : b.pos[2] + dz * 5) - b.pos[2]), (dx ? b.pos[0] + dx * 5 : lx) - b.pos[0]) - b.yaw;
      err -= 2 * Math.PI * Math.floor(err / (2 * Math.PI) + 0.5);
      const pre = run.cop.S[C.STARS];
      run.step(DT, 1, 0, run.bike.nose > 0.04 ? 1 : 0.4, Math.max(-1, Math.min(1, -err * 2.6)), 0);
      for (let e = 0; e < run.n; e++) {
        if (run.ev[e * 2] === W.E_ESCAPE) (esc = run.ev[e * 2 + 1]), (stars = pre);
        if (run.ev[e * 2] === W.E_LAND) land = k;
      }
      run.clear();
    }
    void I;
    assert.ok(land > 0, `hump ${i}: over`);
    assert.equal(esc, C.ESCAPE_PTS * Math.max(1, stars), `hump ${i}: the escape's points`);
    assert.equal(run.sc.S[0], 1000 + esc, `hump ${i}: banked into the score`);
    assert.deepEqual([run.cop.S[C.ESC], run.cop.S[C.HOT], run.cop.chasing, run.cop.S[C.TIX]], [1, 0, 0, 0], `hump ${i}: escaped, nothing at risk, nobody after it`);
    assert.ok(run.cop.S[C.HEAT] <= 8, `hump ${i}: the heat drops`);
    for (let k = 0; k < 60; k++) run.step(DT, 0, 0.5, 0, 0, 0), run.clear();
    assert.equal(run.cop.S[C.HEAT], 0, `hump ${i}: and is gone in a second`);
    for (let k = 0; k < 120; k++) run.step(DT, 0, 0.5, 0, 0, 0), run.clear();
    assert.ok(run.cop.P.every((v, k) => k % C.PS !== C.P_ON || v === 0), `hump ${i}: the units are gone`);
  }
});

test("payout: escapes pay, tickets cost a little, a session never pays under the floor", () => {
  const P = PAYOUT.wheelie, base = { mode: "wheelie", seconds: 90, distance: 600, gas: 30, air: 2, wheelie: 9, crashes: 1, hard: 0, finished: true, score: 2000 };
  const sum = (L) => L.reduce((a, l) => a + l[1], 0);
  const plain = payout(base), more = payout({ ...base, escapes: 2, tickets: 1 });
  assert.deepEqual(more.slice(plain.length), [["2 ESCAPES", 2 * P.escape], ["1 TICKET", -P.ticket]]);
  assert.equal(sum(more), sum(plain) + 2 * P.escape - P.ticket);
  const broke = payout({ ...base, score: 0, tickets: 9 });
  assert.equal(sum(broke), P.floor, "the floor");
  assert.equal(payout({ ...base, finished: false, escapes: 3 }).reduce((a, l) => a + l[1], 0), 0, "leaving pays nothing");
});

test("snapshot: the session's bytes are the whole of it: restored mid-chase, it rides on the same", () => {
  const run = W.cityRun([spec("sparkhound")], 21), I = new Float64Array(5);
  run.reset(0, 0);
  for (let i = 0; i < 60 * 30; i++) auto(run, I);
  assert.ok(run.cop.S[C.HEAT] > 0 || run.cop.chasing > 0 || run.cop.S[C.ESC] > 0, "mid-chase");
  const save = run.bytes.map((b) => b.slice());
  const ride = () => { const out = []; for (let i = 0; i < 60 * 20; i++) out.push(...auto(run, I).map((e) => e.join(":"))); return { out, b: run.bytes.map((b) => [...b].join()) }; };
  const a = ride();
  run.bytes.forEach((b, k) => b.set(save[k]));
  const b = ride();
  assert.deepEqual(b, a);
  assert.ok(a.out.length > 10, "and something happened");
});
