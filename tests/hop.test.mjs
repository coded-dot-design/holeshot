// The bunny hop on the endless grounds (../src/bike/hop.ts, the same impulse Endless Wheelie City's
// ride uses): a press (I[6]) with both wheels down lifts the shared bike by the garage's hop and it
// lands again; a landed hop banks as a ground trick; Free Ride's open maps (not endless) ignore it;
// the same inputs give the same bytes (rollback, online); no allocation per step. The online jam
// carries it on the HOP command bit.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { desertTrack, BIOMES } = await import("../src/modes/desert/track.ts");
const { freeRun, E_GROUND } = await import("../src/modes/freeride/session.ts");
const { freeJam } = await import("../src/modes/freeride/jam.ts");
const { tune } = await import("../src/model/tune.ts");
const { newBike } = await import("../src/model/profile.ts");
const M = await import("../src/modes/freeride/maps.ts");
const { HOP } = await import("../src/modes/wheelie/tricks.ts");
const t = tune(newBike("sparkhound", "b1"));
const me = { power: t.power, shape: t.shape, sweet: t.sweet, bar: t.bar, hop: t.hop };
const DT = 1 / 60;
const down = (b) => !b.crashed && b.contact[0] && b.contact[1];

/** Ride on the gas until both wheels are down at speed (a moment on flat-ish ground), up to 20 s. */
function rideIn(fr, I) {
  I.fill(0);
  I[0] = 0.6;
  for (let f = 0; f < 1200; f++) {
    fr.step(DT, I);
    fr.clear();
    const b = fr.riders[0];
    if (f > 90 && down(b) && b.speed > 3 && Math.abs(b.rel) < 0.05) return f;
  }
  return -1;
}

test("endless: a hop with both wheels down lifts the bike off the ground by the garage's hop, and it lands", () => {
  assert.ok(t.hop > 0, "the garage's bike has a hop");
  for (const B of BIOMES) {
    const fr = freeRun(desertTrack(B.seed, B.id), me, 1e9), I = new Float64Array(7), b = fr.riders[0];
    assert.ok(rideIn(fr, I) >= 0, `${B.id}: rode in`);
    const vy0 = b.S[6];
    I[6] = 1;
    fr.step(DT, I);
    I[6] = 0;
    assert.ok(b.S[6] > vy0 + t.hop * 0.5, `${B.id}: lifted (${vy0.toFixed(2)} → ${b.S[6].toFixed(2)})`);
    let up = false, landed = -1, ground = 0;
    for (let f = 0; f < 240 && landed < 0; f++) {
      fr.step(DT, I);
      for (let k = 0; k < fr.n; k++) if (fr.ev[k * 3] === E_GROUND && fr.ev[k * 3 + 2] === HOP) ground++;
      fr.clear();
      if (!b.contact[0] && !b.contact[1]) up = true;
      else if (up && down(b)) landed = f;
    }
    assert.ok(up, `${B.id}: both wheels off the ground`);
    assert.ok(landed > 0, `${B.id}: landed again`);
    assert.ok(!b.crashed, `${B.id}: rode away`);
    // (Banked a moment after the landing: let it ride on.)
    for (let f = 0; f < 120; f++) {
      fr.step(DT, I);
      for (let k = 0; k < fr.n; k++) if (fr.ev[k * 3] === E_GROUND && fr.ev[k * 3 + 2] === HOP) ground++;
      fr.clear();
    }
    assert.ok(ground > 0 && fr.sc.S[0] > 0, `${B.id}: the landed hop banked as a ground trick (HOP)`);
  }
});

test("endless: no hop in the air or before the last one's timer runs out; Free Ride's open maps ignore it", () => {
  const fr = freeRun(desertTrack(BIOMES[0].seed, BIOMES[0].id), me, 1e9), I = new Float64Array(7), b = fr.riders[0];
  rideIn(fr, I);
  I[6] = 1;
  fr.step(DT, I);
  const vy = b.S[6];
  fr.step(DT, I);
  assert.ok(b.S[6] < vy + 0.5, "held: one hop, not two");
  // An open Free Ride map: I[6] does nothing (not an endless ground).
  const a = freeRun(M.makeMap(M.QUARRY), me), c = freeRun(M.makeMap(M.QUARRY), me), IA = new Float64Array(7), IC = new Float64Array(7);
  for (let f = 0; f < 600; f++) {
    IA[0] = IC[0] = 0.6;
    IC[6] = f % 40 === 0 ? 1 : 0;
    a.step(DT, IA), c.step(DT, IC), a.clear(), c.clear();
  }
  assert.deepEqual(Buffer.concat(a.bytes.map((x) => Buffer.from(x))), Buffer.concat(c.bytes.map((x) => Buffer.from(x))), "open map: the same bytes with or without the hop");
});

/** Two minutes on the endless desert with a hop every 1.5 s: the state's bytes. */
const hopRide = (fr, I) => {
  for (let f = 0; f < 60 * 120; f++) {
    I[0] = f % 600 < 540 ? 0.8 : 0;
    I[1] = f % 600 >= 560 ? 1 : 0;
    I[2] = Math.sin(f / 47) * 0.3;
    I[3] = Math.sin(f / 31) * 0.5;
    I[6] = f % 90 === 0 ? 1 : 0;
    fr.step(DT, I);
    fr.clear();
  }
};
test("endless: hops are deterministic: the same inputs, the same bytes", () => {
  const go = () => {
    const fr = freeRun(desertTrack(BIOMES[0].seed, BIOMES[0].id), me, 1e9), I = new Float64Array(7);
    hopRide(fr, I);
    return Buffer.concat(fr.bytes.map((b) => Buffer.from(b))).toString("base64");
  };
  const a = go();
  assert.equal(a, go());
  // (And the hops did something: the same ride without them ends elsewhere.)
  const fr = freeRun(desertTrack(BIOMES[0].seed, BIOMES[0].id), { ...me, hop: 0 }, 1e9);
  hopRide(fr, new Float64Array(7));
  assert.notEqual(a, Buffer.concat(fr.bytes.map((b) => Buffer.from(b))).toString("base64"));
});

test("endless jam: the HOP command bit hops that seat's rider, the same on every screen", () => {
  const go = (hop) => {
    const tr = desertTrack(BIOMES[0].seed, BIOMES[0].id), jam = freeJam(tr, [me, me]);
    const IV = jam.IN, lifts = [0, 0];
    for (let f = 0; f < 60 * 20; f++) {
      for (let r = 0; r < 2; r++) (IV[r * 5] = 0.7), (IV[r * 5 + 2] = 0), (IV[r * 5 + 3] = r ? 0.2 : -0.2);
      const b = jam.runs[1].riders[0], vy = b.S[6];
      jam.CMD[0] = 0;
      jam.CMD[1] = hop && f % 60 === 30 ? 4 : 0;
      jam.step(DT);
      jam.clear();
      if (b.S[6] > vy + me.hop * 0.5) lifts[1]++;
    }
    return { lifts, bytes: Buffer.concat(jam.bytes.map((b) => Buffer.from(b))).toString("base64") };
  };
  const a = go(true), b = go(true), c = go(false);
  assert.equal(a.bytes, b.bytes, "same bits, same bytes");
  assert.ok(a.lifts[1] > 0, `seat 1 hopped (${a.lifts[1]} times)`);
  assert.notEqual(a.bytes, c.bytes, "the hop changed the ride");
});

test("endless: hopping allocates nothing per step", async () => {
  const fr = freeRun(desertTrack(BIOMES[1].seed, BIOMES[1].id), me, 1e9), I = new Float64Array(7);
  const work = () => hopRide(fr, I);
  work();
  // (As the desert's own 10 km test: the streamed window may cost one scavenge; per-step garbage costs dozens.)
  const n = await minorGCs(work, 5);
  assert.ok(n <= 1, `${n} young-generation GCs over 7,200 steps with 80 hops`);
});
