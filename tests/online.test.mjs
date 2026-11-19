// HOLESHOT online, headless: the sync gate. The wire (input bits, the host's pick, the hello that
// carries every seat's garage bike and look: every screen tunes the same numbers); the bike's state
// is one buffer (step → save → step N → load → step N: the same bytes); the race and the jam with
// two and four people restore exactly from their bytes (a wrong guess run and undone leaves no
// trace) and one wrong input shows in the hash; two and four screens over an in-memory room link
// with latency and jitter (messages overtake) run the whole match (hello, ride, result, the next
// ride) and end byte for byte on the run with no network at all; local frames never wait; a seat
// that leaves mid-race or mid-jam (GONE: the autopilot from the frame after its last input) leaves
// the others identical to the end; and four screens with corrections allocate (almost) nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { PerformanceObserver } from "node:perf_hooks";

const B = await import("../src/bike/bike.ts");
const N = await import("../src/net.ts");
const { match, HELLO_P, RIDE, OVER, ARENA, raceTrack, jamMap, rideSeed, circuitTrack } = await import("../src/online/match.ts");
const C = await import("../src/modes/race/course.ts");
const { freeJam } = await import("../src/modes/freeride/jam.ts");
const { tune } = await import("../src/model/tune.ts");
const { fresh, setup, riding, normalize } = await import("../src/model/profile.ts");
const { STARTERS, MODELS } = await import("../src/data/roster.ts");
const { createEngine } = await import("@fzlt/core/kernel");
const { memory } = await import("@fzlt/core/presence");

const off = { hidden: false, offscreen: false, editable: false };
const eq = (a, b) => Buffer.from(a).equals(Buffer.from(b));
/** Four riders with garages of their own (different classes, mods, wear, looks). */
const PROFILES = STARTERS.map((m, i) => {
  const p = normalize(setup(fresh(), { starter: m.id, paint: ["acid", "pinkout", "gridline", "sodium"][i], number: 10 + i, name: ["Ana", "Bo", "Cy", "Dee"][i], kit: { jersey: ["lime", "pink", "cyan", "orange"][i] } }));
  const b = riding(p);
  b.parts.tyres = 0.4 + i * 0.15;
  b.parts.motor = 0.9 - i * 0.1;
  b.mods.power = i % 3;
  b.gearing = ["short", "stock", "tall", "stock"][i];
  b.dmg.bars = i * 0.1;
  return p;
});
/** Seat p's riding on frame f (its own pattern: a weave, the odd brake), the autopilot from `auto`. */
const drive = (f, p, auto = 420) => N.encode(f % 400 < 370 ? 1 : 0, f % 400 >= 370 ? 1 : 0, Math.sin(f / (29 + p * 7)) * 0.6, Math.sin(f / (23 + p * 11) + p), f > auto ? N.B_AUTO : 0);

test("the wire: inputs survive the trip; the pick fits a byte; the hello carries the garage bike and the look", () => {
  const IN = new Float64Array(10), AUTO = new Uint8Array(2);
  N.decode(N.encode(1, 0, -1, 1, N.B_AUTO), 1, IN, AUTO);
  assert.deepEqual(Array.from(IN.slice(5)), [1, 0, -1, 1, 0]);
  assert.equal(AUTO[1], 1);
  N.decode(N.encode(0.5, 0.25, 0.3, -0.2), 0, IN, AUTO);
  assert.ok(Math.abs(IN[0] - 0.5) < 0.04 && Math.abs(IN[1] - 0.25) < 0.04 && Math.abs(IN[2] - 0.3) < 0.01 && Math.abs(IN[3] + 0.2) < 0.01 && AUTO[0] === 0);
  N.decode(N.GONE, 0, IN, AUTO);
  assert.equal(AUTO[0], 1, "a seat that left rides on the autopilot");
  assert.ok(N.encode(0, 0, 0, 0, N.B_READY) & N.B_READY);
  assert.equal(N.scoreBits(123456, true) & 0xffffff, 123456);
  assert.ok(N.scoreBits(1, true) & N.B_DONE);
  for (const k of [N.K_RACE, N.K_JAM, N.K_AIR, N.K_CITY, N.K_ENDLESS, N.K_ENDCITY, N.K_TRACKDAY]) for (const sub of [0, 2, 4]) assert.deepEqual(N.unpackMode(N.packMode(k, sub)), { kind: k, sub });
  assert.equal(N.cleanName("  zoë-7 the  great "), "ZO7 THE");
  // The hello: three bytes a frame, back together on another screen.
  for (const [i, p] of PROFILES.entries()) {
    const h = N.hello(p), back = new Uint8Array(N.HELLO);
    for (let f = 0; f < N.HELLO_FRAMES; f++) N.takeHello(back, f, N.helloBits(h, f) | (f & 1 ? N.B_READY : 0));
    assert.ok(eq(back, h), "the hello survives the frames");
    const r = N.readHello(back, i), b = riding(p), t0 = tune(b), t1 = tune(r.bike);
    assert.equal(r.name, p.name.toUpperCase().slice(0, 8));
    assert.deepEqual([r.bike.model, r.bike.gearing, r.bike.tyre, r.bike.mods, r.bike.look], [b.model, b.gearing, b.tyre, b.mods, b.look], `${b.model}: the garage choices and the look`);
    assert.deepEqual(r.profile.kit, p.kit, "the rider's kit");
    for (const k of ["force", "grip", "brake", "mass", "gyr"]) assert.ok(Math.abs(t1.power[k] - t0.power[k]) / t0.power[k] < 0.005, `${k}: the wear quantized to a byte (${t0.power[k]} → ${t1.power[k]})`);
    // Every screen (this one too) rides the hello's numbers: the same, to the bit.
    assert.deepEqual(tune(N.readHello(h, i).bike).power, t1.power);
  }
  assert.equal(N.readHello(new Uint8Array(N.HELLO), 2).name, "P3", "a hello that never came whole: a stock starter, P3");
});

test("the bike's state is one buffer: step → save → step N → load → step N gives the same bytes", () => {
  const t = tune(riding(PROFILES[1])), track = C.makeTrack(C.MOTO_TRACK), g = track.course();
  const b = B.bike(g, t.power, t.shape), copy = new Uint8Array(b.state.length);
  assert.equal(b.state.length, B.STATE_BYTES);
  b.reset(track.TRACK[8], track.TRACK[9], track.YAW[4]);
  const ride = (n, f0) => { for (let f = f0; f < f0 + n; f++) (b.set(f % 120 < 90 ? 1 : 0, f % 120 > 110 ? 1 : 0, Math.sin(f / 17), Math.sin(f / 31) * 0.5), b.step(1 / 60), b.clear()); };
  ride(240, 0);
  b.save(copy);
  ride(600, 240);
  const after = b.state.slice();
  assert.ok(!eq(after, copy), "the ride moved it");
  b.load(copy);
  ride(600, 240);
  assert.ok(eq(b.state, after), "loaded and ridden again: byte for byte");
  // Another bike on the same engine takes the copy and rides the same.
  const c = B.bike(g, t.power, t.shape);
  c.load(copy);
  for (let f = 240; f < 840; f++) (c.set(f % 120 < 90 ? 1 : 0, f % 120 > 110 ? 1 : 0, Math.sin(f / 17), Math.sin(f / 31) * 0.5), c.step(1 / 60), c.clear());
  assert.ok(eq(c.state, after), "a second bike from the copy: byte for byte");
});

const tuned = (n) => PROFILES.slice(0, n).map((p, i) => tune(N.readHello(N.hello(p), i).bike));
const makers = (P) => [
  [`a race (${P} people)`, () => C.motoRace(77, raceTrack(rideSeed(5, 0), 0, 0), tuned(P)[0], [], { humans: P, bikes: tuned(P) })],
  [`a jam (${P} people)`, () => freeJam(jamMap(P === 2 ? 1 : 3), tuned(P), 40)],
];
const stepSim = (s, f, P, wrong) => {
  for (let p = 0; p < P; p++) N.decode(wrong ? drive(f + 50, p) ^ 0xff00 : drive(f, p), p, s.IN, s.AUTO);
  s.stepAll ? s.stepAll(1 / 60) : s.step(1 / 60);
  s.clear();
};
for (const P of [2, 4])
  for (const [name, make] of makers(P))
    test(`${P} copies, one input stream: ${name} stays identical; a wrong input shows in the hash; a wrong guess undone leaves no trace`, () => {
      const sims = [make(), make()], bad = make(), undo = make();
      if (sims[0].go) for (const s of [...sims, bad, undo]) s.go(s.riders[0].power), s.clear();
      let first = -1;
      for (let f = 0; f < 2400; f++) {
        for (const s of sims) stepSim(s, f, P, false);
        stepSim(bad, f, P, f === 300);
        if (f % 97 === 50) {
          const keep = undo.bytes.map((v) => v.slice());
          for (let g = 0; g < 12; g++) stepSim(undo, f + g, P, true);
          undo.bytes.forEach((v, i) => v.set(keep[i]));
        }
        stepSim(undo, f, P, false);
        if (f % 30 === 29 && first < 0 && N.hashOf(bad.bytes) !== N.hashOf(sims[0].bytes)) first = f;
      }
      assert.ok(first >= 300 && first < 360, `the wrong input was caught by the hash at frame ${first}`);
      for (const s of [sims[1], undo]) s.bytes.forEach((v, i) => assert.ok(eq(v, sims[0].bytes[i]), `byte view ${i} identical`));
      assert.ok(sims[0].riders.slice(0, P).every((b) => Math.hypot(b.pos[0], b.pos[2]) > 0.1), "everyone rode");
    });

/** P screens running the whole match over an in-memory room (latency ± jitter ticks, messages may
 *  overtake), each its own engine; `until(runs)` stops it. */
function online(P, mode, { latency = 0, jitter = 0, seed = 3, input = drive, ticks = 20000, until, jam = 25, hooks = () => ({}), leave, hold } = {}) {
  const hub = memory({ peers: P, latency, jitter, seed, cap: 4096 }), L = [];
  const runs = Array.from({ length: P }, (_, s) => {
    const end = hub.ends[s], t = { send: (d) => end.send(d), listen: (f) => ((L[s] = f), end.listen(f)), close: () => end.close() };
    const e = createEngine({ seed: 1, pause: off }), r = { e, built: 0, over: [], events: 0 };
    r.m = match(e, { transport: t, seat: s, players: P, seed: 99, mode, profile: PROFILES[s], jam, input: (f) => input(f, s, r), hooks: { built: () => r.built++, events: () => r.events++, over: (_r, res, f) => r.over.push({ f, res }), ...hooks(r) } });
    if (hold) r.m.link.hold = hold;
    return r;
  });
  let told = !leave, quiet = 0;
  for (let t = 0; t < ticks && !until(runs); t++) {
    hub.tick();
    for (const [s, r] of runs.entries()) if (!(leave && s === leave.seat && r.m.link.frame >= leave.at)) r.e.advance(r.e.dt);
    // The leaver closed its tab: once its last messages are through, the room says LEAVE.
    if (!told && runs[leave.seat].m.link.frame >= leave.at && ++quiet > latency + jitter + 4) {
      told = true;
      runs[leave.seat].m.destroy();
      for (let s = 0; s < P; s++) if (s !== leave.seat) L[s](Uint8Array.of(4, leave.seat, P, 0, 0, 0, 0, 0, 0, 0, 0, 0));
    }
  }
  return { runs, hub, L, stay: runs.filter((_, s) => !leave || s !== leave.seat) };
}
/** Every screen in `runs` to the same final frame; true if their arenas then match byte for byte. */
function settle({ runs, hub }) {
  const at = Math.max(...runs.map((r) => r.m.link.frame)) + 3;
  for (const r of runs) r.m.link.hold = at;
  for (let t = 0; t < 900 && !runs.every((r) => r.m.link.final === at && r.m.link.frame === at); t++) {
    hub.tick();
    for (const r of runs) r.e.advance(r.e.dt);
  }
  return runs.every((r) => r.m.link.final === at && eq(r.m.arena, runs[0].m.arena));
}

for (const [kind, name] of [[N.K_RACE, "race (PRO tier)"], [N.K_JAM, "Free Ride jam"]])
  test(`rollback over a link with latency and jitter: two and four screens, a ${name}, end byte for byte on the no-latency run`, () => {
    for (const P of [2, 4]) {
      const mode = N.packMode(kind, kind === N.K_RACE ? 1 : 2), stopAt = (runs) => runs.every((r) => r.m.link.final >= 1500);
      const base = online(P, mode, { until: stopAt });
      assert.ok(settle(base), `${P}: the no-latency screens agree`);
      const want = base.runs[0].m.arena.slice(), at = base.runs[0].m.link.final;
      for (const r of base.runs) r.e.destroy();
      for (const [latency, jitter, seed] of [[4, 3, 2], [9, 7, 3], [16, 12, 4]]) {
        const o = online(P, mode, { latency, jitter, seed, hold: at, until: (runs) => runs.every((r) => r.m.link.final === at) });
        for (const r of o.runs) {
          assert.equal(r.m.link.final, at, `${P} ${latency}±${jitter}: at the frame`);
          assert.equal(r.m.link.desync, -1, `${P} ${latency}±${jitter}: no desync`);
          assert.equal(r.built, 1, "the ride was built once");
          assert.equal(r.m.phase, RIDE, "riding");
          assert.ok(eq(r.m.arena, want), `${name}, ${P} screens, latency ${latency} ± ${jitter} ticks: byte for byte the no-latency run`);
        }
        assert.ok(o.runs.every((r) => r.m.link.corrections > 0), `corrections ran (${o.runs.map((r) => r.m.link.corrections)})`);
        // Every screen rides every seat's own garage bike, as the hellos carried it.
        for (const r of o.runs) assert.deepEqual(r.m.riders.map((x) => [x.name, x.bike.model]), PROFILES.slice(0, P).map((p) => [p.name.toUpperCase(), riding(p).model]));
        for (const r of o.runs) r.e.destroy();
      }
    }
  });

test("a whole match on four screens: the hello, a race to the flag (rivals none: four people), the result on the same frame everywhere, READY, the next ride on a new track", () => {
  const P = 4, mode = N.packMode(N.K_RACE, 0);
  const input = (f, s, r) => {
    r.m.ready = r.over.length > 0 && r.m.phase === OVER;
    return drive(f, s, 300);
  };
  const o = online(P, mode, { latency: 6, jitter: 5, ticks: 60 * 400, input, until: (runs) => runs.every((r) => r.built >= 2) });
  const [a] = o.runs;
  assert.ok(o.runs.every((r) => r.over.length === 1 && r.built === 2), `one result each, then the next ride: ${o.runs.map((r) => [r.over.length, r.built])}`);
  assert.ok(o.runs.every((r) => r.over[0].f === a.over[0].f), `the race ended on the same frame everywhere: ${o.runs.map((r) => r.over[0].f)}`);
  for (const r of o.runs) assert.deepEqual(r.over[0].res, a.over[0].res, "every screen has every seat's result");
  assert.deepEqual(a.over[0].res.map((x) => x.place).sort(), [0, 1, 2, 3], "four places");
  assert.ok(a.over[0].res.filter((x) => x.finished).length >= 1 && a.over[0].res.every((x) => x.M[1] > 100), `everyone rode (distance ${a.over[0].res.map((x) => x.M[1].toFixed(0))})`);
  assert.equal(a.m.ride.race.humans, 4, "four people, no AI");
  assert.notEqual(a.m.ride.track, null);
  assert.equal(a.m.round, 1, "the second ride");
  assert.ok(settle(o), "and byte for byte after");
  for (const r of o.runs) r.e.destroy();
});

// Track Day together (K_TRACKDAY): the race's sim on the host's road circuit, the empty places to
// street-bike rivals; deterministic over a link with latency and jitter, to the flag and on to the next.
test("Track Day online: each circuit, two and three screens with latency end byte for byte on the no-latency run; a race to the flag, the result on the same frame, the next ride on the same circuit", () => {
  for (const [sub, P] of [[0, 2], [1, 3], [2, 2]]) {
    const mode = N.packMode(N.K_TRACKDAY, sub), stopAt = (runs) => runs.every((r) => r.m.link.final >= 1200);
    const base = online(P, mode, { until: stopAt });
    assert.ok(settle(base), `${sub}/${P}: the no-latency screens agree`);
    const want = base.runs[0].m.arena.slice(), at = base.runs[0].m.link.final, ride = base.runs[0].m.ride;
    assert.equal(ride.track, circuitTrack(sub), `${sub}: the host's circuit`);
    assert.equal(ride.track.venue, "td", "a road circuit");
    assert.equal(ride.race.riders.length, 4, "the grid is full");
    assert.equal(ride.ai.length, 4 - P, "street-bike rivals in the empty places");
    for (const r of base.runs) r.e.destroy();
    const o = online(P, mode, { latency: 9, jitter: 7, seed: 3, hold: at, until: (runs) => runs.every((r) => r.m.link.final === at) });
    for (const r of o.runs) {
      assert.equal(r.m.link.desync, -1, "no desync");
      assert.ok(eq(r.m.arena, want), `Track Day ${sub}, ${P} screens, latency 9 ± 7: byte for byte the no-latency run`);
    }
    assert.ok(o.runs.every((r) => r.m.link.corrections > 0), "corrections ran");
    for (const r of o.runs) r.e.destroy();
  }
  const P = 2, input = (f, s, r) => ((r.m.ready = r.over.length > 0 && r.m.phase === OVER), drive(f, s, 200));
  const o = online(P, N.packMode(N.K_TRACKDAY, 2), { latency: 6, jitter: 5, ticks: 60 * 400, input, until: (runs) => runs.every((r) => r.built >= 2) });
  const [a] = o.runs;
  assert.ok(o.runs.every((r) => r.over.length === 1 && r.built === 2 && r.over[0].f === a.over[0].f), "one result each, on the same frame, then the next ride");
  for (const r of o.runs) assert.deepEqual(r.over[0].res, a.over[0].res, "every screen has every seat's result");
  assert.ok(a.over[0].res.every((x) => x.bestLap > 0), `laps timed (${a.over[0].res.map((x) => x.bestLap.toFixed(1))})`);
  assert.equal(a.m.ride.track, circuitTrack(2), "the next ride on the same circuit");
  assert.ok(settle(o), "and byte for byte after");
  for (const r of o.runs) r.e.destroy();
});

test("score runs (Big Air, Wheelie City): each seat's score rides its bits; the result when everyone is done", () => {
  for (const kind of [N.K_AIR, N.K_CITY]) {
    const P = 3, scores = [4200, 9100, 600];
    const input = (f, s) => N.scoreBits(Math.min(scores[s], f * 7), f > 1400 + s * 40);
    const o = online(P, N.packMode(kind, 0), { latency: 5, jitter: 4, input, until: (runs) => runs.every((r) => r.over.length) });
    for (const r of o.runs) assert.deepEqual(r.over[0].res.map((x) => [x.points, x.place, x.finished]), [[4200, 1, true], [9100, 0, true], [600, 2, true]]);
    assert.ok(o.runs.every((r) => r.over[0].f === o.runs[0].over[0].f && r.m.ride.score), "on the same frame");
    for (const r of o.runs) r.e.destroy();
  }
});

for (const [kind, name] of [[N.K_RACE, "race"], [N.K_JAM, "jam"]])
  test(`four seats, one leaves mid-${name}: the autopilot rides its bike, the other three stay identical to the end`, () => {
    const P = 4, input = (f, s) => drive(f, s, 500), at = 900;
    const o = online(P, N.packMode(kind, 0), { latency: 3, jitter: 2, input, leave: { seat: 3, at }, ticks: 60 * 300, until: (runs) => runs.slice(0, 3).every((r) => r.over.length) });
    const [a, b, c] = o.stay;
    for (const r of o.stay) assert.equal(r.m.link.left, 1 << 3, "the others know seat 3 left");
    assert.ok(a.m.link.leftAt(3) > at && [b, c].every((r) => r.m.link.leftAt(3) === a.m.link.leftAt(3)), `the autopilot took over on the same frame: ${o.stay.map((r) => r.m.link.leftAt(3))}`);
    assert.ok(o.stay.every((r) => r.over.length === 1 && r.over[0].f === a.over[0].f), "the ride ended on the same frame on the three");
    for (const r of [b, c]) assert.deepEqual(r.over[0].res, a.over[0].res);
    assert.ok(a.over[0].res[3].M[1] > a.over[0].res[3].M[1] * 0 + 50, "the leaver's bike rode on");
    const s = { runs: o.stay, hub: o.hub };
    assert.ok(settle(s), "every byte identical");
    assert.deepEqual(o.stay.map((r) => r.m.link.desync), [-1, -1, -1], "no desync");
    for (const r of o.runs) r.e.destroy();
  });

test("the arena holds every ride with room: a race of four and a jam of four", () => {
  const sum = (s) => s.bytes.reduce((n, v) => n + v.length, 0) + 4 * 72 + 64;
  const r = C.motoRace(1, raceTrack(rideSeed(1, 0), 2, 0), tuned(4)[0], [], { humans: 4, bikes: tuned(4) }), j = freeJam(jamMap(4), tuned(4));
  assert.ok(sum(r) < ARENA && sum(j) < ARENA, `race ${sum(r)} B, jam ${sum(j)} B of ${ARENA}`);
  console.log(`HOLESHOT online: a ride's state is ${sum(r)} B (race of four), ${sum(j)} B (jam of four); arena ${ARENA} B.`);
});

// Four screens in one process (four engines, four races of four bikes, one in-memory link with latency
// and jitter, every seat's steer changing every frame so guesses miss and frames run again): the
// rollback and the match (snapshots, corrections, the arena copies, decode, the hash every 30 frames)
// add no garbage of their own; the bar is the bikes' (tests/alloc.test.mjs: a race of four boxes a
// few doubles).
test("four screens with rollback allocate (almost) nothing (12,000 ticks × 4, corrections every few frames)", async () => {
  const P = 4, o = online(P, N.packMode(N.K_RACE, 1), { latency: 5, jitter: 3, seed: 2, input: (f, s) => drive(f, s, 1e9), until: (runs) => runs.every((r) => r.m.link.final > 2000) });
  let minor = 0;
  const obs = new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.detail?.kind === 1) minor++; });
  globalThis.gc?.();
  const c0 = o.runs.map((r) => r.m.link.resims);
  obs.observe({ entryTypes: ["gc"] });
  for (let i = 0; i < 12000; i++) (o.hub.tick(), o.runs.forEach((r) => r.e.advance(r.e.dt)));
  await new Promise((ok) => setTimeout(ok, 50));
  obs.disconnect();
  const resims = o.runs.map((r, i) => r.m.link.resims - c0[i]);
  console.log(`HOLESHOT online: ${minor} young GCs over 12,000 ticks of four screens with rollback (${resims.join(" / ")} frames run again).`);
  assert.ok(o.runs.every((r) => r.m.link.desync < 0), "no desync");
  assert.ok(resims.every((n) => n > 6000), `corrections ran: ${resims}`);
  // The bar: the same number of race frames stepped with no rollback at all (the bikes' own boxing).
  const frames = 12000 * P + resims.reduce((a, b) => a + b, 0), bare = C.motoRace(3, raceTrack(rideSeed(99, 0), 1, 0), tuned(4)[0], [], { humans: 4, bikes: tuned(4) });
  bare.go(bare.riders[0].power);
  let base = 0;
  const obs2 = new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.detail?.kind === 1) base++; });
  globalThis.gc?.();
  obs2.observe({ entryTypes: ["gc"] });
  for (let f = 0; f < frames; f++) {
    stepSim(bare, f, 4, false);
    if (bare.phase === C.DONE) bare.go(bare.riders[0].power), bare.clear();
  }
  await new Promise((ok) => setTimeout(ok, 50));
  obs2.disconnect();
  console.log(`  the same ${frames.toLocaleString("en-US")} race frames with no rollback: ${base} young GCs.`);
  assert.ok(minor <= base * 1.5 + 6, `young GCs: ${minor} with rollback, ${base} without`);
  for (const r of o.runs) r.e.destroy();
});
