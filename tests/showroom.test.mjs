// The showroom's logic: the shop catalogue's pure parts (vendor/shop/shop.js: facets, filters,
// deltas, the comparison's one line) and Holeshot's adapter (src/garage/showroom.ts: every card number
// is the game's own: roster price and tier, the tuned feel, the pace measured on the sim) and buying
// into a bay (src/model/garage.ts buyInto: the first empty bay, or a trade-in that keeps the bay).
import test from "node:test";
import assert from "node:assert/strict";

const C = await import("../vendor/shop/shop.js");
const { itemOf, paceStats } = await import("../src/garage/showroom.ts");
const { MODELS, model } = await import("../src/data/roster.ts");
const { tune } = await import("../src/model/tune.ts");
const { paceOf } = await import("../src/model/families.ts");
const { newBike, setup, fresh } = await import("../src/model/profile.ts");
const G = await import("../src/model/garage.ts");

const start = (extra = {}) => ({ ...setup(fresh(), { starter: "buzzline", paint: "acid", number: 7, name: "kip" }), ...extra });
const items = MODELS.map((m) => itemOf(m, start(), false));

test("cards: every number from the game (price, tier, Pull / Top / Light, 0–30, 0–60, top speed)", () => {
  assert.equal(items.length, 19);
  for (const [i, m] of MODELS.entries()) {
    const it = items[i], t = tune(newBike(m.id, "x")), p = paceOf(t);
    assert.equal(it.price, m.price);
    assert.equal(it.tier, m.tier);
    assert.deepEqual(it.bars.map((b) => b.v), [t.feel.pull, t.feel.top, t.feel.light]);
    assert.deepEqual([it.stats.a, it.stats.b], [p.t30, p.t60]);
    assert.equal(it.stats.top, Math.round(p.top));
  }
  // Metric: 0–50 and 0–100 km/h.
  const km = itemOf(model("forgeback"), start({ settings: { sound: true, view: "chase", units: "metric" } }), false), p = paceOf(tune(newBike("forgeback", "x")));
  assert.deepEqual([km.stats.a, km.stats.b], [p.k50, p.k100]);
  assert.equal(paceStats("metric")[2].unit, "km/h");
});

test("filters: types and brands in roster order; both narrow", () => {
  assert.equal(C.facet(items, "type").length, 5);
  const four = C.filtered(items, { type: items.find((i) => i.id === "anvil").type, brand: "" });
  assert.equal(four.length, 4);
  const one = C.filtered(items, { type: four[0].type, brand: items.find((i) => i.id === "slag-ox").brand });
  assert.deepEqual(one.map((i) => i.id), ["slag-ox"]);
  assert.equal(C.filtered(items, { type: "", brand: "" }).length, 19);
});

test("deltas: better or worse by the stat's direction; the one line names the gain", () => {
  const [t30, , top] = paceStats("imperial");
  assert.deepEqual(C.delta(t30, 0.91, 0.85), { dir: "up", text: "−0.06 s" });
  assert.deepEqual(C.delta(t30, 2.18, 2.56), { dir: "down", text: "+0.38 s" });
  assert.deepEqual(C.delta(top, 63, 64), { dir: "up", text: "+1 mph" });
  assert.equal(C.delta(top, 64, 64).dir, "same");
  const a = items.find((i) => i.id === "forgeback"), b = items.find((i) => i.id === "bare-knuckle");
  assert.equal(C.summary(a, b, paceStats("imperial")), `${b.name} gains ${b.stats.top - a.stats.top} mph over the ${a.name}.`);
  assert.equal(C.summary(b, a, paceStats("imperial")), `${b.name} gains ${b.stats.top - a.stats.top} mph over the ${a.name}.`);
  assert.match(C.summary(a, a, paceStats("imperial")), /match on every number/);
});

test("buyInto: the first empty bay; a trade-in keeps the bay; short credits and a full garage say why", () => {
  let p = start({ credits: 20000 });
  assert.deepEqual(G.baysOf(p).map((b) => !!b.bike), [true, false, false]);
  let r = G.buyInto(p, "forgeback", 1);
  assert.ok(r.ok);
  assert.deepEqual(r.profile.bikes.map((b) => b.model), ["buzzline", "forgeback"]);
  assert.equal(r.profile.ride, 1);
  assert.equal(r.profile.credits, 20000 - 4200);
  p = r.profile;
  const value = G.tradeValue(p.bikes[0]);
  r = G.buyInto(p, "sparkhound", 0);
  assert.ok(r.ok);
  assert.deepEqual(r.profile.bikes.map((b) => b.model), ["sparkhound", "forgeback"], "the new bike takes bay 1");
  assert.equal(r.profile.ride, 0);
  assert.equal(r.spent, 2000 - value);
  assert.equal(G.buyInto(start({ credits: 714 }), "forgeback", 1).why, "4,200 credits needed.");
  assert.equal(G.buyInto(start({ credits: 99999 }), "forgeback", 5).why, "No such bay.");
  const full = start({ credits: 99999, slots: 3 });
  full.bikes.push(newBike("anvil", "b2"), newBike("glidewire", "b3"));
  const t = G.buyInto(full, "forgeback", 2);
  assert.ok(t.ok, "a full garage trades into a bay");
  assert.deepEqual(t.profile.bikes.map((b) => b.model), ["buzzline", "anvil", "forgeback"]);
});
