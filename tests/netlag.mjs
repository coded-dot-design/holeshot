// HOLESHOT online on a phone's network, measured (node tests/netlag.mjs [--net lockstep|rollback]
// [--kind race|jam] [--seconds 20] [--json]): two and four screens ride over the stand-in room server
// (tests/room-server.mjs) with its latency shim (60–150 ms round trips, ± 30 ms jitter, a 300 ms
// spike every few seconds), each screen an engine on a real 60 Hz clock. Per screen:
//   input → screen  ms from the moment this screen reads its own input for a frame to the first time
//                   it shows that frame (its sim stepped with it)
//   stalls/min      engine steps where the ride did not move (waiting for someone)
//   sim rate        ride frames shown per second (60: full speed; less: slow motion)
//   longest freeze  the most 60 Hz ticks in a row with no new ride frame on screen
//   resim           (rollback) frames re-run after a late input: per step on average, the deepest, µs
// and, at the end, every screen's state compared byte for byte (the desync check too).
// `--net lockstep` runs the race on presence's lockstep (every frame waits for every input: what a
// plain lockstep would feel like, the "before"); the default runs the match on the rollback link
// (src/online/match.ts, @fzlt/core/presence/rollback). As a gate (no --net) it asserts the rollback bars.
import assert from "node:assert/strict";
import { roomServer, CODE } from "./room-server.mjs";
const N = await import("../src/net.ts");
const { match, raceTrack, rideSeed } = await import("../src/online/match.ts");
const C = await import("../src/modes/race/course.ts");
const { tune } = await import("../src/model/tune.ts");
const { fresh, setup, riding } = await import("../src/model/profile.ts");
const { STARTERS } = await import("../src/data/roster.ts");
const { createEngine } = await import("@fzlt/core/kernel");
const { join, presence } = await import("@fzlt/core/presence");

const arg = (k, d) => {
  const i = process.argv.indexOf("--" + k);
  return i < 0 ? d : process.argv[i + 1];
};
const KIND = arg("net", "rollback"), RIDE = arg("kind", "race"), SECONDS = Number(arg("seconds", 20)), JSON_OUT = process.argv.includes("--json"), GATE = !process.argv.includes("--net");
/** Phone links: round trips per seat, jitter, spikes. */
const LAG = process.env.LAG ? JSON.parse(process.env.LAG) : { rtt: [60, 150, 100, 120], jitter: 30, spike: 300, spikeEvery: 6000, seed: 11 };
const PROFILES = STARTERS.map((m, i) => setup(fresh(), { starter: m.id, paint: "acid", number: i + 1, name: "P" + (i + 1) }));

/** Seat p's riding on frame f: the gas, the odd brake, a weave; lean and steer change every frame
 *  (a thumb on a phone never holds still), so the prediction is wrong often. */
const drive = (f, p) => N.encode(f % 400 < 370 ? 1 : 0, f % 400 >= 370 ? 1 : 0, Math.sin(f / (19 + p * 5)) * 0.5, Math.sin(f / (23 + p * 7) + p));

async function ride(P, room) {
  const rooms = await roomServer({ max: 4, lag: LAG });
  const off = { hidden: false, offscreen: false, editable: false }, ac = new AbortController();
  const mode = N.packMode(RIDE === "jam" ? N.K_JAM : N.K_RACE, 1);
  const seats = await Promise.all(
    Array.from({ length: P }, async (_, i) => {
      await new Promise((ok) => setTimeout(ok, i * 40));
      return N.joinRoom(rooms.url, room, P, CODE, { want: P, mode, signal: ac.signal, retry: 0 });
    }),
  );
  const screens = seats.map((s) => {
    const e = createEngine({ seed: 1, pause: off });
    const m = { slot: s.slot, e, sampled: new Float64Array(1 << 16), lat: [], freeze: 0, still: 0 };
    if (KIND === "lockstep") {
      // presence's lockstep (input delay 2: input() fills frame f + 2): every frame waits for every input.
      const t = tune(riding(PROFILES[0])), tuned = PROFILES.slice(0, P).map((p) => tune(riding(p)));
      const sim = C.motoRace(s.seed, raceTrack(rideSeed(s.seed, 0), 1, 0), t, [], { humans: P, bikes: tuned });
      sim.go(t.power);
      let k = 0;
      const ls = presence(e, {
        transport: s.transport, slot: s.slot, players: P,
        input: () => ((m.sampled[k + 2] = performance.now()), drive(k++, s.slot)),
        step: (_e, inp, fr) => {
          for (let p = 0; p < P; p++) N.decode(inp[p], p, sim.IN, sim.AUTO);
          sim.stepAll(1 / 60);
          sim.clear();
          if (m.sampled[fr] > 0) m.lat.push(performance.now() - m.sampled[fr]), (m.sampled[fr] = 0);
        },
        hash: () => N.hashOf(sim.bytes),
      });
      m.bytes = () => sim.bytes;
      m.frame = () => ls.frame;
      m.stalls = () => ls.stalls;
      m.desync = () => ls.desync;
      m.stop = () => ls.destroy();
    } else {
      const mt = match(e, {
        transport: s.transport, seat: s.slot, players: P, seed: s.seed, mode, profile: PROFILES[s.slot],
        input: (fr) => ((m.sampled[fr] = performance.now()), drive(fr, s.slot)),
        hooks: { events: () => {} },
      });
      // The first time a frame runs on this screen (live) with its own input: the input is on screen.
      let shown = 0;
      // A system added after the link's runs after it each engine step.
      e.add({ step() {
        for (; shown < mt.link.frame; shown++) if (m.sampled[shown] > 0) m.lat.push(performance.now() - m.sampled[shown]), (m.sampled[shown] = 0);
      } });
      m.mt = mt;
      m.rb = mt.link;
      m.bytes = () => [mt.arena];
      m.frame = () => mt.link.frame;
      m.stalls = () => mt.link.stalls;
      m.desync = () => mt.link.desync;
      m.stop = () => mt.destroy();
    }
    return m;
  });
  // One clock for every screen at 60 Hz (a phone's rAF), each screen's engine advanced by the real time.
  const t0 = performance.now(), end = t0 + SECONDS * 1000;
  let warm = true;
  const warmAt = t0 + 3000;
  await new Promise((done) => {
    let next = t0;
    const tick = () => {
      const now = performance.now();
      if (warm && now >= warmAt) {
        warm = false;
        for (const m of screens) (m.lat.length = 0), (m.st0 = m.stalls()), (m.f0 = m.frame()), (m.t0 = now), (m.freeze = 0), (m.still = 0), (m.rs0 = m.rb ? m.rb.resims : 0), (m.rt0 = m.rb ? m.rb.resimTotal : 0), (m.w0 = m.rb ? m.rb.waits : 0), (m.steps0 = m.rb ? m.rb.steps : 0);
      }
      for (const m of screens) {
        const before = m.frame(), dt = now - (m.at ?? now - 16.7);
        m.e.advance(Math.min(0.1, dt / 1000));
        m.at = now;
        if (dt < 12) continue;
        if (m.frame() !== before) (m.freeze = Math.max(m.freeze, m.still ?? 0)), (m.still = 0);
        else m.still = (m.still ?? 0) + 1;
      }
      if (now >= end) return done();
      next = Math.max(next + 1000 / 60, performance.now());
      setTimeout(tick, Math.max(0, next - performance.now()));
    };
    tick();
  });
  const now = performance.now();
  const out = screens.map((m) => {
    const lat = m.lat.slice().sort((a, b) => a - b), q = (x) => lat[Math.min(lat.length - 1, Math.floor(lat.length * x))] ?? NaN, mins = (now - m.t0) / 60000;
    const r = { seat: m.slot, rtt: LAG.rtt[m.slot % LAG.rtt.length], inputP50: +q(0.5).toFixed(0), inputP95: +q(0.95).toFixed(0), stallsPerMin: +((m.stalls() - m.st0) / mins).toFixed(0), simRate: +((m.frame() - m.f0) / ((now - m.t0) / 1000)).toFixed(1), freezeFrames: Math.max(m.freeze, m.still), desync: m.desync() };
    if (m.rb) Object.assign(r, { resimPerStep: +((m.rb.resims - m.rs0) / Math.max(1, m.rb.steps - m.steps0)).toFixed(2), resimDeepest: m.rb.deepest, resimUsPerFrame: +(((m.rb.resimTotal - m.rt0) / Math.max(1, m.rb.resims - m.rs0)) * 1000).toFixed(0), resimMsMax: +m.rb.resimMs.toFixed(2), delay: m.rb.delay, waitsPerMin: +((m.rb.waits - m.w0) / mins).toFixed(0) });
    return r;
  });
  const same = await settle(screens);
  for (const m of screens) m.stop(), m.e.destroy();
  ac.abort();
  rooms.close();
  return { P, screens: out, same };
}

/** Every screen stops at one frame; once it is final everywhere, compare the states byte for byte. */
async function settle(screens) {
  if (!screens[0].rb) return null;
  const at = Math.max(...screens.map((m) => m.rb.frame)) + 4;
  for (const m of screens) m.rb.hold = at;
  for (let i = 0; i < 600 && !screens.every((m) => m.rb.final === at && m.rb.frame === at); i++) {
    await new Promise((ok) => setTimeout(ok, 16));
    for (const m of screens) m.e.advance(1 / 60);
  }
  const a = screens[0];
  return screens.every((m) => m.rb.final === at && m.bytes().every((v, i) => Buffer.from(v).equals(Buffer.from(a.bytes()[i]))));
}

const results = [];
for (const [P, room] of [[2, 3], [4, 5]]) results.push(await ride(P, room));
if (JSON_OUT) console.log(JSON.stringify({ kind: KIND, ride: RIDE, seconds: SECONDS, lag: LAG, results }, null, 1));
else
  for (const r of results) {
    console.log(`HOLESHOT online, ${KIND}, ${RIDE}, ${r.P} screens, ${SECONDS} s on phone links (RTT ${LAG.rtt.slice(0, r.P).join("/")} ms ± ${LAG.jitter}, ${LAG.spike} ms spikes):`);
    console.table(r.screens);
    if (r.same !== null) console.log(`  every screen's confirmed state identical, byte for byte: ${r.same}`);
  }
if (GATE)
  for (const r of results) {
    assert.ok(r.same, `${r.P} screens: identical state`);
    for (const s of r.screens) {
      assert.equal(s.desync, -1, "no desync");
      assert.ok(s.inputP95 <= 55, `seat ${s.seat}: input → screen p95 ${s.inputP95} ms`);
      assert.ok(s.simRate >= 57, `seat ${s.seat}: full speed (${s.simRate} frames/s)`);
      assert.ok(s.freezeFrames <= 3, `seat ${s.seat}: no visible freeze (${s.freezeFrames} ticks in a row)`);
    }
  }
