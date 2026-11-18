// HOLESHOT online, the endless rides together: every ENDLESS ground and Endless Wheelie City in a
// room. The wire (the pick's new kinds and the biome, END / REGROUP / HOP); the sims restore exactly
// from their bytes with two and four riders roaming apart (each its own window of the same world) and
// a wrong input shows in the hash; two and four screens over an in-memory room link with latency and
// jitter (messages overtake, corrections every few frames) ride each endless mode for minutes
// (regroups, bumps, crashes, the city's patrol) and end byte for byte on the run with no network at
// all; the shared scoreboard is the same on every screen; everyone's END ends the ride on one frame.
import test from "node:test";
import assert from "node:assert/strict";

const N = await import("../src/net.ts");
const { match, RIDE, OVER, ARENA } = await import("../src/online/match.ts");
const { freeJam } = await import("../src/modes/freeride/jam.ts");
const { cityJam } = await import("../src/modes/wheelie/jam.ts");
const { desertTrack, BIOMES } = await import("../src/modes/desert/track.ts");
const { SB_DIST, SB_POINTS, SB_N } = await import("../src/online/board.ts");
const { tune } = await import("../src/model/tune.ts");
const { fresh, setup, riding, normalize } = await import("../src/model/profile.ts");
const { STARTERS } = await import("../src/data/roster.ts");
const { createEngine } = await import("@fzlt/core/kernel");
const { memory } = await import("@fzlt/core/presence");

const off = { hidden: false, offscreen: false, editable: false };
const eq = (a, b) => Buffer.from(a).equals(Buffer.from(b));
const PROFILES = STARTERS.map((m, i) => {
  const p = normalize(setup(fresh(), { starter: m.id, paint: ["acid", "pinkout", "gridline", "sodium"][i], number: 10 + i, name: ["Ana", "Bo", "Cy", "Dee"][i], kit: { jersey: ["lime", "pink", "cyan", "orange"][i] } }));
  riding(p).mods.power = i % 3;
  return p;
});
const tuned = (P) => PROFILES.slice(0, P).map((p) => tune(riding(p)));
const spec = (x) => ({ id: x.model.id, name: x.model.name, kind: x.power.name, blurb: "", bars: [3, 3, 3], power: x.power, shape: x.shape, sweet: x.sweet, hop: x.hop });
/** Seat p on frame f: its own weave and the odd brake; a hop now and then; REGROUP once in a while
 *  (seat 0's brings everyone); the autopilot rides spells of it; END from `end`. */
const drive = (f, p, end = 1e9) => {
  const auto = (f + p * 600) % 3000 > 2100 ? N.B_AUTO : 0;
  const rg = f % 1800 >= 900 + p * 211 && f % 1800 < 904 + p * 211 ? N.B_REGROUP : 0;
  const hop = f % 97 === p * 7 ? N.B_HOP : 0;
  return N.encode(f % 400 < 360 ? 1 : 0, f % 400 >= 370 ? 1 : 0, Math.sin(f / (29 + p * 7)) * 0.6, Math.sin(f / (23 + p * 11) + p) * 0.8, auto | rg | hop | (f >= end + p * 30 ? N.B_DONE : 0));
};
const MODES = [...BIOMES.map((b, i) => [N.packMode(N.K_ENDLESS, i), `ENDLESS · ${b.name}`]), [N.packMode(N.K_ENDCITY, 0), "ENDLESS WHEELIE CITY"]];

test("the wire: the endless kinds and every biome fit the pick's byte; END, REGROUP and HOP ride the bits", () => {
  for (const k of [N.K_RACE, N.K_JAM, N.K_AIR, N.K_CITY, N.K_ENDLESS, N.K_ENDCITY]) for (const sub of [0, 1, 3, 4]) assert.deepEqual(N.unpackMode(N.packMode(k, sub)), { kind: k, sub });
  for (const [m] of MODES) assert.ok(m < 256);
  assert.equal(N.cmdOf(N.encode(1, 0, 0, 0, N.B_REGROUP | N.B_HOP)), N.C_REGROUP | N.C_HOP);
  assert.equal(N.cmdOf(N.GONE), N.C_END, "a seat that left: its ride banked, no regroup");
  assert.equal(N.cmdOf(N.encode(1, 0, 0, 0, N.B_DONE)), N.C_END);
});

/** One step of an endless sim by hand (the match's decode and commands). */
const stepSim = (s, f, P, wrong) => {
  for (let p = 0; p < P; p++) {
    const b = wrong ? drive(f + 50, p) ^ 0xff00 : drive(f, p);
    N.decode(b, p, s.IN, s.AUTO);
    s.CMD[p] = N.cmdOf(b);
  }
  s.step(1 / 60);
  s.clear();
};
const sims = (P) => [
  ...BIOMES.map((b) => [`ENDLESS · ${b.name}`, () => freeJam(desertTrack(b.seed, b.id), tuned(P))]),
  ["ENDLESS WHEELIE CITY", () => cityJam(tuned(P).map(spec), 77)],
];
for (const P of [2, 4])
  for (const [name, make] of sims(P))
    test(`${P} riders roam apart, one input stream: ${name} stays identical; a wrong input shows in the hash; a wrong guess undone leaves no trace`, () => {
      const a = make(), b = make(), bad = make(), undo = make();
      let first = -1;
      for (let f = 0; f < 3600; f++) {
        for (const s of [a, b]) stepSim(s, f, P, false);
        stepSim(bad, f, P, f === 600);
        if (f % 97 === 50) {
          const keep = undo.bytes.map((v) => v.slice());
          for (let g = 0; g < 20; g++) stepSim(undo, f + g, P, true);
          undo.bytes.forEach((v, i) => v.set(keep[i]));
        }
        stepSim(undo, f, P, false);
        if (f % 30 === 29 && first < 0 && N.hashOf(bad.bytes) !== N.hashOf(a.bytes)) first = f;
      }
      assert.ok(first >= 600 && first < 660, `the wrong input was caught by the hash at frame ${first}`);
      for (const s of [b, undo]) s.bytes.forEach((v, i) => assert.ok(eq(v, a.bytes[i]), `byte view ${i} identical`));
      const far = a.riders.map((r) => Math.hypot(r.pos[0], r.pos[2]));
      assert.ok(far.every((d) => d > 20), `everyone rode off (${far.map((d) => d.toFixed(0))} units out)`);
      const B = a.board.B;
      assert.ok(Array.from({ length: P }, (_, p) => B[p * SB_N + SB_DIST]).every((d) => d > 100), "the board has everyone's distance");
    });

// The rollback's hardest case, by hand: every frame a guessed future (1 to 13 frames of another
// rider's stale input) is run and undone before the true frame, across regroups (a teleport and a
// regather where the guessed future already gathered), crashes and the patrol: Endless Wheelie City's
// caches (its window, its gather and the live neighbours, sprinklers and dog mapped onto it) never
// leak a guessed future into the state.
test("Endless Wheelie City, a guessed future run and undone every frame (6,000 frames, regroups and all): identical to the straight run", () => {
  const a = cityJam(tuned(2).map(spec), 99), b = cityJam(tuned(2).map(spec), 99);
  const one = (s, f, wrong) => {
    for (let p = 0; p < 2; p++) {
      const bits = wrong && p === 1 ? drive(f - 9, p) : drive(f, p);
      N.decode(bits, p, s.IN, s.AUTO);
      s.CMD[p] = N.cmdOf(bits);
    }
    s.step(1 / 60);
    s.clear();
  };
  for (let f = 0; f < 6000; f++) {
    one(a, f, false);
    const keep = b.bytes.map((v) => v.slice());
    for (let g = 0; g <= f % 13; g++) one(b, f + g, true);
    b.bytes.forEach((v, i) => v.set(keep[i]));
    one(b, f, false);
    if (f % 60 === 59) b.bytes.forEach((v, i) => assert.ok(eq(v, a.bytes[i]), `frame ${f}: byte view ${i} identical`));
  }
});

function online(P, mode, { latency = 0, jitter = 0, seed = 3, input = drive, ticks = 1e6, until, hold } = {}) {
  const hub = memory({ peers: P, latency, jitter, seed, cap: 4096 });
  const runs = Array.from({ length: P }, (_, s) => {
    const end = hub.ends[s], t = { send: (d) => end.send(d), listen: (f) => end.listen(f), close: () => end.close() };
    const e = createEngine({ seed: 1, pause: off }), r = { e, built: 0, over: [] };
    r.m = match(e, { transport: t, seat: s, players: P, seed: 99, mode, profile: PROFILES[s], input: (f) => input(f, s, r), hooks: { built: () => r.built++, over: (_r, res, f) => r.over.push({ f, res }) } });
    if (hold) r.m.link.hold = hold;
    return r;
  });
  for (let t = 0; t < ticks && !until(runs); t++) {
    hub.tick();
    for (const r of runs) r.e.advance(r.e.dt);
  }
  return { runs, hub };
}
// Minutes ridden: three for two screens, ninety seconds for four by default (four screens with
// corrections every few frames cost minutes of CPU each); ENDLESS_MINUTES=<n> rides n for both.
const MINS = { 2: Number(process.env.ENDLESS_MINUTES ?? 3), 4: Number(process.env.ENDLESS_MINUTES ?? 1.5) };
for (const [mode, name] of MODES)
  test(`${name} online: two and four screens ride ${MINS[2]} and ${MINS[4]} minutes with latency and jitter, byte for byte the no-latency run; everyone's END ends it on one frame`, () => {
    for (const P of [2, 4]) {
      const MIN = MINS[P], FRAMES = Math.round(MIN * 3600);
      const t0 = performance.now(), input = (f, s) => drive(f, s, FRAMES);
      const base = online(P, mode, { input, until: (runs) => runs.every((r) => r.over.length) });
      const at = base.runs[0].over[0].f, res = base.runs[0].over[0].res;
      assert.ok(base.runs.every((r) => r.over[0].f === at && JSON.stringify(r.over[0].res) === JSON.stringify(res)), "the same result on the same frame");
      assert.ok(at > FRAMES && at < FRAMES + 400, `ended after everyone's END (frame ${at})`);
      for (const r of base.runs) r.m.link.hold = at + 30;
      for (let t = 0; t < 400; t++) (base.hub.tick(), base.runs.forEach((r) => r.e.advance(r.e.dt)));
      const want = base.runs[0].m.arena.slice();
      assert.ok(base.runs.every((r) => r.m.link.final === at + 30 && eq(r.m.arena, want)), "the no-latency screens agree");
      for (const r of base.runs) r.e.destroy();
      const sum = res.map((x) => `${x.far.toFixed(0)}m ${x.points}pts`).join(", ");
      for (const [latency, jitter, seed] of [[6, 5, 2], [14, 10, 4]]) {
        const o = online(P, mode, { latency, jitter, seed, input, hold: at + 30, until: (runs) => runs.every((r) => r.m.link.final === at + 30) });
        for (const r of o.runs) {
          assert.equal(r.m.link.desync, -1, `${P} ${latency}±${jitter}: no desync`);
          assert.equal(r.m.phase, OVER);
          assert.equal(r.over[0].f, at, "the ride ended on the same frame");
          assert.deepEqual(r.over[0].res, res, "every seat's result, the same");
          assert.ok(eq(r.m.arena, want), `${name}, ${P} screens, ${latency} ± ${jitter}: byte for byte the no-latency run`);
        }
        assert.ok(o.runs.every((r) => r.m.link.corrections > 50), `corrections ran (${o.runs.map((r) => r.m.link.corrections)})`);
        for (const r of o.runs) r.e.destroy();
      }
      assert.ok(res.every((x) => x.far > 60 * MIN && x.M[1] > 150 * MIN), `everyone rode (${sum})`);
      console.log(`  ${name}, ${P} screens, ${MIN} min: ${sum} · ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    }
  });

test("the arena holds an endless ride of four with room", () => {
  const sum = (s) => s.bytes.reduce((n, v) => n + v.length, 0) + 4 * 72 + 64;
  const d = freeJam(desertTrack(BIOMES[0].seed, "desert"), tuned(4)), c = cityJam(tuned(4).map(spec), 1);
  assert.ok(sum(d) < ARENA && sum(c) < ARENA, `endless ${sum(d)} B, city ${sum(c)} B of ${ARENA}`);
  console.log(`HOLESHOT online: an endless ride of four is ${sum(d)} B (a ground), ${sum(c)} B (Endless Wheelie City); arena ${ARENA} B.`);
  void SB_POINTS, void RIDE;
});
