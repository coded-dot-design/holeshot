// tune(bike): wear and mods change the feel, through the numbers the sim rides. Worn tyres lose grip
// (and on the bike, a launch spins more); a new set brings it back exactly; a worn motor or battery
// pulls less (and a battery's top speed sags), a rebuild restores it; worn seals case sooner; the
// mods add pull, trade top speed for drive, and land bigger; every effect has a floor. Every garage
// choice is one line in tune() and a test here, on the numbers and, where it is cheap, on the ride:
// exhaust or controller stages, gearing, springs, the long travel kit, brakes, weight saving, the
// battery pack and motor map, tyre compounds, a tired top end, a stretched chain, cooked seals, and
// crash damage (bent bars, cracked plastics).
import test from "node:test";
import assert from "node:assert/strict";

const { tune } = await import("../src/model/tune.ts");
const { newBike, setup, fresh, riding } = await import("../src/model/profile.ts");
const { service, upgrade, setChoice } = await import("../src/model/garage.ts");
const B = await import("../src/bike/bike.ts");
const flat = { sample(x, z, o) { o[0] = 0; o[1] = 0; o[2] = 1; o[3] = 0; return 0; } };
const worn = (b, part, v) => ({ ...b, parts: { ...b.parts, [part]: v } });
/** Seconds of full gas on the flat; the distance covered and the most slip. */
function launch(t, secs = 2.5) {
  const b = B.bike(flat, t.power, t.shape);
  b.reset(0, 0, 0);
  let slip = 0;
  for (let i = 0; i < secs * 60; i++) b.set(1, 0, -0.6, 0), b.step(1 / 60), (slip = Math.max(slip, b.slip)), b.clear();
  return { x: b.pos[0], slip, crashed: b.crashed };
}

test("tune: stock is the model's own numbers", () => {
  for (const id of ["buzzline", "anvil", "glidewire", "sparkhound"]) {
    const t = tune(newBike(id, "b1"));
    assert.equal(t.power.grip, t.model.power.grip);
    assert.equal(t.power.force, t.model.power.force);
    assert.deepEqual(Array.from(t.power.gears), Array.from(t.model.power.gears));
  }
});

test("tune: worn tyres → less grip (and a launch spins more); a new set restores it", () => {
  let p = setup(fresh(), { starter: "anvil", paint: "acid", number: 1, name: "a" });
  const fresh1 = tune(riding(p));
  p = { ...p, credits: 1000, bikes: [worn(riding(p), "tyres", 0.05)] };
  const bald = tune(riding(p));
  assert.ok(bald.power.grip < fresh1.power.grip * 0.8, `grip ${fresh1.power.grip} → ${bald.power.grip.toFixed(3)}`);
  assert.ok(bald.feel.grip < fresh1.feel.grip);
  assert.ok(launch(bald).slip > launch(fresh1).slip, "bald tyres spin up more on a launch");
  const r = service(p, "tyres");
  assert.ok(r.ok);
  assert.deepEqual(tune(riding(r.profile)).power, fresh1.power, "a new set: exactly as new");
  assert.equal(r.profile.credits, 1000 - r.spent);
});

test("tune: a worn motor pulls less (a battery sags its top speed too); a rebuild restores it", () => {
  for (const id of ["buzzline", "anvil", "sparkhound"]) {
    const nb = newBike(id, "b1"), t0 = tune(nb), t1 = tune(worn(nb, "motor", 0));
    assert.ok(t1.power.force < t0.power.force * 0.8, `${id}: force ${t0.power.force} → ${t1.power.force.toFixed(2)}`);
    assert.ok(launch(t1).x < launch(t0).x, `${id}: a slower launch`);
    const e = t0.cls === "emoto" || t0.cls === "ebike";
    // A tired top end loses top speed too; a battery's voltage sags further.
    const sag = t1.power.gears.at(-1) / t0.power.gears.at(-1);
    assert.ok(sag < 1 && (e ? sag < 0.9 : sag > 0.9), `${id}: top speed × ${sag.toFixed(3)}`);
    let p = { ...setup(fresh(), { starter: id, paint: "acid", number: 1, name: "a" }) };
    p = { ...p, credits: 5000, bikes: [worn(riding(p), "motor", 0.1)] };
    assert.deepEqual(tune(riding(service(p, "motor").profile)).power, t0.power, `${id}: rebuilt`);
  }
});

test("tune: worn seals case sooner and damp less; worn brakes stop later; floors hold", () => {
  const nb = newBike("anvil", "b1"), t0 = tune(nb), s = tune(worn(nb, "susp", 0)), br = tune(worn(nb, "brakes", 0));
  assert.ok(s.shape.caseDrop < t0.shape.caseDrop && s.shape.damp < t0.shape.damp);
  assert.ok(br.power.brake < t0.power.brake);
  const dead = tune({ ...nb, parts: { tyres: 0, chain: 0, motor: 0, susp: 0, brakes: 0 } });
  assert.ok(dead.power.force > t0.power.force * 0.6 && dead.power.grip > t0.power.grip * 0.65, "a wrecked bike still rides");
  assert.equal(launch(dead).crashed, false);
});

const rich = (starter) => ({ ...setup(fresh(), { starter, paint: "acid", number: 1, name: "a" }), credits: 1e6 });
/** Top speed after `secs` of full gas on the flat. */
function vmax(t, secs = 12) {
  const b = B.bike(flat, t.power, t.shape);
  b.reset(0, 0, 0);
  for (let i = 0; i < secs * 60; i++) b.set(1, 0, 0.2, 0), b.step(1 / 60), b.clear();
  return b.speed;
}
/** Metres to stop from full speed on the flat. */
function stop(t) {
  const b = B.bike(flat, t.power, t.shape);
  b.reset(0, 0, 0);
  for (let i = 0; i < 600; i++) b.set(1, 0, 0.2, 0), b.step(1 / 60), b.clear();
  const x0 = b.pos[0];
  for (let i = 0; i < 600 && b.speed > 0.3; i++) b.set(0, 1, 0.3, 0), b.step(1 / 60), b.clear();
  return b.pos[0] - x0;
}

test("tune: exhaust (or controller) stages 1-3 each add pull, most of it up top", () => {
  for (const id of ["buzzline", "sparkhound"]) {
    let p = rich(id), prev = tune(riding(p));
    for (let lv = 1; lv <= 3; lv++) {
      p = upgrade(p, "power").profile;
      const t = tune(riding(p));
      assert.ok(t.power.force > prev.power.force && t.power.curve.at(-1) / prev.power.curve.at(-1) > t.power.curve[0] / prev.power.curve[0], `${id} stage ${lv}`);
      prev = t;
    }
    assert.equal(upgrade(p, "power").ok, false, "stage 3 is the top");
    assert.ok(launch(prev).x > launch(tune(riding(rich(id)))).x, `${id}: stage 3 launches further`);
  }
});

test("tune: gearing short / stock / tall trades launch for top speed (felt on the flat)", () => {
  let p = rich("anvil");
  const stock = tune(riding(p));
  p = setChoice(p, "gearing", "short").profile;
  const short = tune(riding(p));
  p = setChoice(p, "gearing", "tall").profile;
  const tall = tune(riding(p));
  assert.ok(short.power.force > stock.power.force && short.power.gears.at(-1) < stock.power.gears.at(-1));
  assert.ok(tall.power.force < stock.power.force && tall.power.gears.at(-1) > stock.power.gears.at(-1));
  assert.ok(vmax(tall) > vmax(short), `top speed tall ${vmax(tall).toFixed(2)} > short ${vmax(short).toFixed(2)}`);
  assert.ok(launch(short, 1).x > launch(tall, 1).x, "short launches harder");
  // Bought once per bike: switching back to an owned choice is free.
  const c = p.credits;
  p = setChoice(p, "gearing", "short").profile;
  assert.equal(p.credits, c, "owned: free to switch back");
});

test("tune: springs soft / stock / stiff and the long travel kit", () => {
  let p = rich("buzzline");
  const stock = tune(riding(p));
  const soft = tune(riding(setChoice(p, "spring", "soft").profile)), stiff = tune(riding(setChoice(p, "spring", "stiff").profile));
  assert.ok(soft.power.grip > stock.power.grip && soft.shape.caseDrop < stock.shape.caseDrop && soft.shape.damp < stock.shape.damp, "soft: grip, cases sooner");
  assert.ok(stiff.power.grip < stock.power.grip && stiff.shape.caseDrop > stock.shape.caseDrop, "stiff: holds big landings, less grip");
  p = upgrade(p, "travel").profile;
  const lt = tune(riding(p));
  assert.ok(lt.shape.travel > stock.shape.travel * 1.1 && lt.shape.caseDrop > stock.shape.caseDrop && lt.power.gyr > stock.power.gyr, "long travel: soaks it, a touch lazier");
  assert.equal(upgrade(p, "travel").ok, false, "one kit");
});

test("tune: brakes and weight saving", () => {
  let p = rich("anvil");
  const t0 = tune(riding(p));
  p = upgrade(upgrade(p, "brakes").profile, "brakes").profile;
  const tb = tune(riding(p));
  assert.ok(tb.power.brake > t0.power.brake * 1.2 && stop(tb) < stop(t0), `stops in ${stop(tb).toFixed(1)} vs ${stop(t0).toFixed(1)}`);
  assert.ok(stop(tune(worn(riding(rich("anvil")), "brakes", 0))) > stop(t0), "worn brakes stop later");
  p = upgrade(upgrade(p, "weight").profile, "weight").profile;
  const tw = tune(riding(p));
  assert.ok(tw.power.mass < t0.power.mass && tw.power.gyr < t0.power.gyr && tw.feel.light > t0.feel.light);
});

test("tune: battery pack and motor map fit electrics only; cells hold the top speed as it wears", () => {
  assert.equal(upgrade(rich("buzzline"), "cells").ok, false, "no battery pack on a 2-stroke");
  assert.equal(setChoice(rich("anvil"), "map", "race").ok, false, "no motor map on a 4-stroke");
  let p = rich("sparkhound");
  const worn0 = tune(worn(riding(p), "motor", 0.2));
  p = upgrade(upgrade(p, "cells").profile, "cells").profile;
  const cells = tune(worn(riding(p), "motor", 0.2));
  assert.ok(cells.power.gears.at(-1) > worn0.power.gears.at(-1) && cells.power.mass > worn0.power.mass, "holds voltage, heavier");
  const race = tune(riding(setChoice(p, "map", "race").profile)), eco = tune(riding(setChoice(p, "map", "eco").profile)), std = tune(riding(p));
  assert.ok(race.power.force > std.power.force && eco.power.force < std.power.force);
});

test("tune: tyre compounds: soft grips, hard slides (and wear: tests/garage.test.mjs)", () => {
  const p = rich("anvil");
  const med = tune(riding(p)), soft = tune(riding(service(p, "tyres", "soft").profile)), hard = tune(riding(service(p, "tyres", "hard").profile));
  assert.ok(soft.power.grip > med.power.grip && hard.power.grip < med.power.grip);
  // On a fresh set neither spins on the flat; part-worn, the hard compound lets go first.
  assert.ok(launch(tune(worn(riding(service(p, "tyres", "hard").profile), "tyres", 0.1))).slip > launch(tune(worn(riding(service(p, "tyres", "soft").profile), "tyres", 0.1))).slip, "hard tyres spin up more on a launch");
});

test("tune: wear: a stretched chain wastes power, cooked seals bottom out", () => {
  const nb = newBike("anvil", "b1"), t0 = tune(nb), ch = tune(worn(nb, "chain", 0)), su = tune(worn(nb, "susp", 0));
  assert.ok(ch.power.force < t0.power.force && launch(ch).x < launch(t0).x, "chain");
  assert.ok(su.shape.travel < t0.shape.travel * 0.85, "less travel: it bottoms out");
});

test("tune: crash damage: bent bars pitch less in the air, cracked plastics flap", () => {
  const nb = newBike("buzzline", "b1"), t0 = tune(nb), d = tune({ ...nb, dmg: { bars: 1, plastics: 1 } });
  assert.ok(d.power.airPitch < t0.power.airPitch && d.sweet < t0.sweet, "bars");
  assert.ok(d.power.gears.at(-1) < t0.power.gears.at(-1) && d.power.gears.at(-1) > t0.power.gears.at(-1) * 0.95, "plastics: a hair of top speed");
});
