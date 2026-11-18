// The bike families (gas dirt, electric, street) and their upgrades, headless. Every model has a
// family and a body that is its family's; the three street bikes are original, never starters,
// best on the asphalt (a dirt mode warns and rides them with less grip, travel and case line, solo
// and online alike); each family upgrade fits only its family, is the dearest thing in the shop
// (the turbo dearest of all), survives a save and the online hello, and shows on the bike. The
// pace before → after each upgrade is MEASURED on the sim (0–20, 0–30, 0–60 mph and the top, full
// gas on the flat at 60 Hz) and printed; the wheelie bar holds the mini past 12 without a loop-out,
// at the lower hand-drag multiplier.
import test from "node:test";
import assert from "node:assert/strict";

const { MODELS, CLASSES, STARTERS, model, familyOf, bodyOf } = await import("../src/data/roster.ts");
const { MODS, FAMILY_FX } = await import("../src/data/economy.ts");
const { tune } = await import("../src/model/tune.ts");
const { newBike, fresh, normalize, riding } = await import("../src/model/profile.ts");
const { fits, upgrade, buyBike } = await import("../src/model/garage.ts");
const F = await import("../src/model/families.ts");
const N = await import("../src/net.ts");
const { rigOfPower } = await import("../src/bike/bodies.ts");
const W = await import("../src/modes/wheelie/city.ts");
const O = await import("../src/modes/wheelie/roam.ts");
const R = await import("../src/modes/wheelie/ride.ts");

const UPS = ["wbar", "swap", "bore", "boost"];
const pace = F.paceOf;
const fmt = (p) => `0-20 ${p.t20?.toFixed(2) ?? "—"} s · 0-30 ${p.t30?.toFixed(2) ?? "—"} s · 0-60 ${p.t60?.toFixed(2) ?? "—"} s · top ${p.top.toFixed(1)} mph`;
const fitted = (id, up) => { const b = newBike(id, "x"); b.mods[up] = 1; return b; };

test("families: every class and model has one; bodies follow the family; street bikes are original and never starters", () => {
  for (const c of Object.values(CLASSES)) assert.ok(["gas", "electric", "street"].includes(c.family), c.id);
  const street = MODELS.filter((m) => familyOf(m) === "street");
  assert.equal(street.length, 3, "three street bikes");
  assert.deepEqual(street.map((m) => bodyOf(m)).sort(), ["mini", "naked", "sport"]);
  for (const m of MODELS) {
    const f = familyOf(m), k = bodyOf(m);
    assert.ok(f === "gas" ? k === "2t" || k === "4t" : f === "electric" ? k === "ebike" || k === "emoto" : ["mini", "sport", "naked"].includes(k), `${m.id}: ${f} / ${k}`);
    assert.equal(tune(newBike(m.id, "x")).rig, k, "tune carries the body");
    assert.equal(rigOfPower(m.power.name), k, `a rival on ${m.id} draws the same body`);
  }
  assert.equal(STARTERS.length, 4);
  assert.ok(STARTERS.every((m) => familyOf(m) !== "street"));
  // No real brand or model names (a short denylist of the ones a kid would know).
  const real = /honda|yamaha|kawasaki|suzuki|ducati|ktm|grom|ninja|panigale|duke|gsx|cbr|monster|\br1\b|\br6\b/i;
  for (const m of street) assert.ok(!real.test(m.name + " " + m.blurb + " " + m.id), m.name);
});

test("families: street bikes rule the asphalt and struggle on the dirt (the warning, the same tune online)", () => {
  const sport = model("tidebreaker"), t = tune(newBike(sport.id, "x"));
  assert.ok(F.dirtWarning(sport, "race") && F.dirtWarning(sport, "desert") && F.dirtWarning(sport, "series"), "dirt modes warn");
  assert.ok(!F.dirtWarning(sport, "endcity") && !F.dirtWarning(sport, "wheelie"), "the city does not");
  assert.ok(!F.dirtWarning(model("buzzline"), "race"), "a dirt bike never warns");
  assert.equal(F.DIRT_LINE, "Street bike on dirt? It won't perform well.");
  assert.equal(F.onGround(t, "endcity"), t, "as tuned on the asphalt");
  const d = F.onGround(t, "race");
  assert.ok(d.power.grip < t.power.grip * 0.8 && d.shape.travel < t.shape.travel && d.shape.caseDrop < t.shape.caseDrop, "less grip, travel, case line");
  const dirt = tune(newBike("buzzline", "x"));
  assert.equal(F.onGround(dirt, "race"), dirt, "dirt bikes untouched");
  // Street rubber grips the road better than any dirt bike's knobblies; short springs case sooner.
  for (const m of MODELS.filter((x) => familyOf(x) === "street")) {
    const s = tune(newBike(m.id, "x"));
    assert.ok(s.power.grip > 1.25 && s.shape.caseDrop < 22, m.id);
  }
});

test("upgrades: one per family, fits only there, the dearest things in the shop (the turbo most of all)", () => {
  const fitOf = { wbar: (m) => bodyOf(m) === "mini", swap: (m) => familyOf(m) === "electric", bore: (m) => familyOf(m) === "gas", boost: (m) => familyOf(m) === "street" };
  for (const up of UPS) for (const m of MODELS) assert.equal(fits(newBike(m.id, "x"), up), fitOf[up](m), `${up} on ${m.id}`);
  const others = Object.entries(MODS).filter(([k]) => !UPS.includes(k)).flatMap(([, v]) => v.price);
  for (const up of UPS) assert.ok(MODS[up].price[1] > 2 * Math.max(...others), `${up} is late-game (${MODS[up].price[1]})`);
  assert.ok(MODS.boost.price[1] > Math.max(...UPS.filter((u) => u !== "boost").map((u) => MODS[u].price[1])) && MODS.boost.price[1] > Math.max(...MODELS.map((m) => m.price)), "the turbo: dearer than any bike");
  // Bought on the right bike, refused on the wrong one; the save keeps it, a misfit is dropped.
  let p = { ...fresh(), credits: 1e6 };
  p = buyBike(p, "tidebreaker", true).profile;
  assert.equal(upgrade(p, "bore").ok, false);
  const r = upgrade(p, "boost");
  assert.ok(r.ok && r.spent === MODS.boost.price[1] && riding(r.profile).mods.boost === 1);
  assert.equal(normalize(JSON.parse(JSON.stringify(r.profile))).bikes.at(-1).mods.boost, 1, "saved");
  const bad = JSON.parse(JSON.stringify(r.profile));
  bad.bikes.at(-1).mods.bore = 1;
  assert.equal(normalize(bad).bikes.at(-1).mods.bore, 0, "a misfit comes off");
  // Online: the hello carries each upgrade bit, so every screen tunes the very same bike.
  for (const [id, up] of [["curb-pup", "wbar"], ["sparkhound", "swap"], ["hivequeen", "bore"], ["bare-knuckle", "boost"]]) {
    const q = { ...fresh(), name: "AB", bikes: [fitted(id, up)], ride: 0 };
    const back = N.readHello(N.hello(q), 0).bike;
    assert.equal(back.mods[up], 1, `${up} over the wire`);
    assert.deepEqual(tune(back).power, tune(q.bikes[0]).power, `${id}: identical tune`);
    assert.equal(tune(back).up, up, "and it shows");
  }
});

test("upgrades: pace before → after, measured (0–20 / 0–30 / 0–60 mph, top)", () => {
  const rows = [["curb-pup", "wbar"], ["glidewire", "swap"], ["sparkhound", "swap"], ["feral-coil", "swap"], ["forgeback", "bore"], ["hivequeen", "bore"], ["slag-ox", "bore"], ["bulkhead", "bore"], ["curb-pup", "boost"], ["tidebreaker", "boost"], ["bare-knuckle", "boost"]];
  const out = [];
  for (const [id, up] of rows) {
    const a = pace(tune(newBike(id, "x"))), b = pace(tune(fitted(id, up)));
    out.push(`${model(id).name.padEnd(18)} ${MODS[up].name.padEnd(13)} ${fmt(a)}  →  ${fmt(b)}`);
    if (up === "wbar") {
      // The bar changes the wheelie, not the pace.
      assert.ok(Math.abs(a.top - b.top) < 0.1, `${id}: the wheelie bar leaves the top speed`);
      continue;
    }
    assert.ok(b.top > a.top * 1.02, `${id} ${up}: top ${a.top.toFixed(1)} → ${b.top.toFixed(1)}`);
    assert.ok(b.t20 < a.t20, `${id} ${up}: 0-20 ${a.t20} → ${b.t20}`);
    if (a.t30 !== null) assert.ok(b.t30 !== null && b.t30 < a.t30, `${id} ${up}: 0-30 ${a.t30} → ${b.t30}`);
  }
  // Stock street bikes, for the table: the big two are the fastest bikes in the game.
  for (const m of MODELS.filter((x) => familyOf(x) === "street")) out.push(`${m.name.padEnd(18)} ${"STOCK".padEnd(13)} ${fmt(pace(tune(newBike(m.id, "x"))))}`);
  console.log("\n  " + out.join("\n  "));
  const dirtTop = Math.max(...MODELS.filter((x) => familyOf(x) !== "street").map((m) => pace(tune(newBike(m.id, "x"))).top));
  assert.ok(pace(tune(newBike("tidebreaker", "x"))).top > dirtTop, "a supersport outruns every dirt bike on the flat");
  // A big bore deepens the note (the voice's pitch: the hook the sound code reads).
  const v0 = tune(newBike("hivequeen", "x")), v1 = tune(fitted("hivequeen", "bore"));
  assert.ok(v1.power.voice[0] < v0.power.voice[0] && v1.power.voice[1] < v0.power.voice[1] && v1.sound.deep > 0);
  assert.ok(tune(fitted("tidebreaker", "boost")).sound.whistle > 0, "the turbo's whistle hook");
});

test("wheelie bar: the mini holds past 12 on its bar (no loop-out), the hand drag pays ×5", () => {
  const spec = (b) => { const t = tune(b); return { id: "m", name: "m", kind: "", blurb: "", bars: [3, 3, 3], power: t.power, shape: t.shape, sweet: t.sweet, hop: t.hop, bar: t.bar }; };
  // The greedy rider: up and over, gas pinned, weight back (it loops out without the bar).
  const ride = (b) => {
    const run = O.openRun([spec(b)], 3), ev = [], AI = new Float64Array(5);
    let top = 0;
    for (let f = 0; f < 60 * 12; f++) {
      const th = run.bike.nose, v = run.bike.b.speed;
      const gas = f < 50 ? (v < 4 ? 1 : 0) : 1, lean = f < 50 ? 0 : -1;
      run.autopilot(AI);
      run.step(1 / 60, gas, 0, lean, AI[3], 0);
      for (let k = 0; k < run.n; k++) ev.push([f, run.ev[k * 2], run.ev[k * 2 + 1]]);
      run.clear();
      top = Math.max(top, th);
    }
    return { ev, top, run };
  };
  const plain = ride(newBike("curb-pup", "x"));
  assert.ok(plain.ev.some((e) => e[1] === W.E_CRASH), "no bar: it loops out");
  const barred = ride(fitted("curb-pup", "wbar"));
  assert.ok(!barred.ev.some((e) => e[1] === W.E_CRASH), "on the bar: it never loops");
  assert.ok(barred.top > R.TWELVE && barred.top < FAMILY_FX.wbar.at + 0.03, `held past 12 at the bar (${barred.top.toFixed(2)})`);
  assert.ok(barred.ev.some((e) => e[1] === W.E_DRAG), "the hand drag starts on the bar");
  const t = tune(fitted("curb-pup", "wbar")), t0 = tune(newBike("curb-pup", "x"));
  assert.ok(t.bar && t.bar.dragX < W.DRAG_X && t.sweet > t0.sweet * 1.4, "the trade: a wider window, a lower multiplier");
  assert.equal(t0.bar, null);
  // Deterministic: the same ride, the same bytes.
  const again = ride(fitted("curb-pup", "wbar"));
  assert.equal(Buffer.concat(barred.run.bytes.map((x) => Buffer.from(x))).toString("base64"), Buffer.concat(again.run.bytes.map((x) => Buffer.from(x))).toString("base64"));
});
