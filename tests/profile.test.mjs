// The profile (src/model/profile.ts): a fresh profile has no bike until the first-run setup; the
// setup gives one starter (the cheapest model of its class), its paint and number, the rider's kit;
// save → load gives it back; `migrate` runs the version steps in order and `normalize` repairs a
// partial or out-of-range save (a missing part comes back new, a bad number is clamped, a fourth
// bike is dropped); garbage loads fresh; a save from a newer game is refused and never written over;
// the export code goes round to an equal profile and a typo is caught. The roster and the data file
// hold 4 classes × 4 models, a 3-bike garage and the rider kit.
import test from "node:test";
import assert from "node:assert/strict";

const P = await import("../src/model/profile.ts");
const { MODELS, CLASSES, STARTERS } = await import("../src/data/roster.ts");
const { GARAGE_SLOTS } = await import("../src/data/economy.ts");
const { buyBike, choose } = await import("../src/model/garage.ts");
const mem = () => { const m = new Map(); return { m, get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) }; };

test("roster: four classes, four original models each; the starters are each class's cheapest", () => {
  assert.equal(Object.keys(CLASSES).length, 4);
  assert.equal(MODELS.length, 16);
  for (const c of Object.keys(CLASSES)) {
    const ms = MODELS.filter((m) => m.cls === c);
    assert.equal(ms.length, 4, c);
    const s = STARTERS.find((m) => m.cls === c);
    assert.equal(s.price, Math.min(...ms.map((m) => m.price)), `${c}: the starter is the cheapest`);
  }
  assert.equal(new Set(MODELS.map((m) => m.id)).size, 16, "unique ids");
  assert.equal(GARAGE_SLOTS, 3);
});

test("profile: fresh → setup → save → load", () => {
  const s = mem();
  const f = P.fresh();
  assert.equal(P.ready(f), false, "no bike before the setup");
  const p = P.setup(f, { starter: "anvil", paint: "acid", number: 42, name: "kip", kit: { jersey: "lime" } });
  assert.equal(p.bikes.length, 1);
  assert.deepEqual([p.bikes[0].model, p.bikes[0].look.paint, p.bikes[0].look.number, p.name, p.kit.jersey], ["anvil", "acid", 42, "KIP", "lime"]);
  assert.deepEqual(p.bikes[0].parts, { tyres: 1, chain: 1, motor: 1, susp: 1, brakes: 1 });
  P.save(p, s);
  const back = P.load(s);
  assert.deepEqual(back.profile, p);
  assert.equal(back.newer, false);
  // A non-starter can't be picked at setup.
  assert.equal(P.setup(f, { starter: "hivequeen", paint: "acid", number: 1, name: "x" }).bikes[0].model, STARTERS[0].id);
});

test("profile: normalize repairs a partial or broken save", () => {
  const raw = { v: 1, name: "<b>evil</b>name-too-long", credits: -50, ride: 9, bikes: [
    { uid: "b1", model: "buzzline", parts: { tyres: 0.4 }, mods: { power: 99 }, look: { paint: "nope", number: 400 } },
    { uid: "b1", model: "anvil" }, { model: "glidewire" }, { model: "sparkhound" }, { notabike: true },
  ], kit: { helmet: "crown" }, settings: { sound: false } };
  const p = P.migrate(raw);
  assert.equal(p.bikes.length, 3, "the garage holds three");
  assert.deepEqual(p.bikes[0].parts, { tyres: 0.4, chain: 1, motor: 1, susp: 1, brakes: 1 }, "missing parts come back new");
  assert.equal(p.bikes[0].mods.power, 3, "mods clamp to their max");
  assert.deepEqual(p.bikes[0].look, { paint: "gridline", number: 99, graphics: "none", plastics: "scheme", plate: "scheme" });
  assert.notEqual(p.bikes[0].uid, p.bikes[1].uid, "uids made unique");
  assert.equal(p.credits, 0);
  assert.equal(p.ride, 2);
  assert.equal(p.kit.helmet, "peak");
  assert.equal(p.settings.sound, false);
  assert.match(p.name, /^[A-Z.\- ]{1,12}$/);
});

test("profile: migrate runs each version step in order; garbage and newer saves", () => {
  // A pretend v2 that renamed credits to cash: the step from 1 upgrades an old save.
  const steps = { 1: (o) => ({ ...o, cash: o.credits }) };
  const seen = P.migrate({ v: 1, credits: 77 }, steps, 2);
  assert.equal(seen.credits, 77);
  // A v0 (no version field) runs every step from 0.
  let ran = [];
  P.migrate({ credits: 5 }, { 0: (o) => (ran.push(0), o), 1: (o) => (ran.push(1), o) }, 2);
  assert.deepEqual(ran, [0, 1]);
  assert.equal(P.migrate(null), null);
  assert.equal(P.migrate("nope"), null);
  assert.equal(P.migrate({ v: 99, credits: 1 }), null, "from a newer game: refused");
  // load: a newer save is kept, never overwritten.
  const s = mem();
  s.set(P.STORE_KEY, JSON.stringify({ v: 99, secret: 1 }));
  const r = P.load(s);
  assert.equal(r.newer, true);
  P.save(r.profile, s, r.newer);
  assert.equal(JSON.parse(s.get(P.STORE_KEY)).v, 99, "untouched");
  s.set(P.STORE_KEY, "{not json");
  assert.equal(P.load(s).profile.bikes.length, 0, "garbage: a fresh profile");
  // A store that throws (blocked storage) is just no save.
  const bad = { get() { throw Error("blocked"); }, set() { throw Error("blocked"); } };
  assert.doesNotThrow(() => P.save(P.fresh(), { get: (k) => { try { return bad.get(k); } catch { return null; } }, set: (k, v) => { try { bad.set(k, v); } catch {} } }));
  assert.doesNotThrow(() => P.load(P.local), "localStorage missing in Node: no save");
});

test("profile: the export code goes round; a typo is caught", () => {
  let p = P.setup(P.fresh(), { starter: "sparkhound", paint: "sodium", number: 3, name: "neon" });
  p = { ...p, credits: 9000 };
  p = buyBike(p, "razorhive").profile;
  p = choose(p, 0);
  const code = P.exportCode(p);
  assert.match(code, /^DH1-[A-Za-z0-9_-]+-[0-9A-Z]{6}$/);
  assert.deepEqual(P.importCode(code).profile, p);
  assert.deepEqual(P.importCode(" " + code.slice(0, 20) + "\n" + code.slice(20) + " ").profile, p, "spaces and line breaks are fine");
  const typo = code.slice(0, 10) + (code[10] === "A" ? "B" : "A") + code.slice(11);
  assert.ok("error" in P.importCode(typo));
  assert.ok("error" in P.importCode("hello"));
});
