// tune(bike): wear and mods change the feel, through the numbers the sim rides. Worn tyres lose grip
// (and on the bike, a launch spins more); a new set brings it back exactly; a worn motor or battery
// pulls less (and a battery's top speed sags), a rebuild restores it; worn seals case sooner; the
// mods add pull, trade top speed for drive, and land bigger; every effect has a floor.
import test from "node:test";
import assert from "node:assert/strict";

const { tune } = await import("../src/model/tune.ts");
const { newBike, setup, fresh, riding } = await import("../src/model/profile.ts");
const { service, upgrade } = await import("../src/model/garage.ts");
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
    assert.equal(t1.power.gears.at(-1) < t0.power.gears.at(-1), e, `${id}: top speed sags only on a battery`);
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

test("tune: mods add pull, trade top speed for drive, and land bigger", () => {
  let p = { ...setup(fresh(), { starter: "buzzline", paint: "acid", number: 1, name: "a" }), credits: 99999 };
  const t0 = tune(riding(p));
  p = upgrade(p, "power").profile;
  const tp = tune(riding(p));
  assert.ok(tp.power.force > t0.power.force);
  p = upgrade(p, "gearing").profile;
  const tg = tune(riding(p));
  assert.ok(tg.power.gears.at(-1) < tp.power.gears.at(-1) && tg.power.force > tp.power.force);
  p = upgrade(p, "susp").profile;
  const ts = tune(riding(p));
  assert.ok(ts.shape.caseDrop > tg.shape.caseDrop && ts.shape.travel > tg.shape.travel);
  for (let i = 0; i < 5; i++) p = upgrade(p, "gearing").ok ? upgrade(p, "gearing").profile : p;
  assert.equal(riding(p).mods.gearing, 2, "mods stop at their top level");
});
