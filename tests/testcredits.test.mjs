// Test credits (src/model/testcredits.ts): ?credits=inf or ?money=inf turns them on (nothing else
// does); topUp holds the session's copy at TEST_CREDITS without touching the profile it was given;
// with it every bike in the roster can be bought in turn (a full garage trades in), and the credits
// never go down.
import test from "node:test";
import assert from "node:assert/strict";

const T = await import("../src/model/testcredits.ts");
const P = await import("../src/model/profile.ts");
const { MODELS, STARTERS } = await import("../src/data/roster.ts");
const { GARAGE_SLOTS } = await import("../src/data/economy.ts");
const G = await import("../src/model/garage.ts");

test("the param: credits=inf or money=inf, nothing else", () => {
  for (const q of ["?credits=inf", "?money=inf", "?credits=INF", "?mode=race&money=infinite", "?credits=%E2%88%9E"]) assert.equal(T.testCredits(q), true, q);
  for (const q of ["", "?credits=", "?credits=1000", "?money=lots", "?inf", "?mode=online&room=2"]) assert.equal(T.testCredits(q), false, q);
  assert.equal(T.testCredits(new URLSearchParams("credits=inf")), true);
});

test("topUp: a new object at TEST_CREDITS, the original untouched", () => {
  const p = P.setup(P.fresh(), { starter: STARTERS[0].id, paint: "gridline", number: 7, name: "KIP" }), before = JSON.stringify(p);
  const t = T.topUp(p);
  assert.equal(t.credits, T.TEST_CREDITS);
  assert.notEqual(t, p);
  assert.equal(JSON.stringify(p), before);
  assert.equal(P.normalize(t).credits, T.TEST_CREDITS, "normalize keeps it (the profile's own cap)");
});

test("every bike can be bought with test credits, and buying never costs", () => {
  let p = T.topUp(P.setup(P.fresh(), { starter: STARTERS[0].id, paint: "gridline", number: 7, name: "KIP" }));
  for (const m of MODELS) {
    const full = p.bikes.length >= GARAGE_SLOTS, r = G.buyBike(p, m.id, true, full ? p.ride : undefined);
    assert.ok(r.ok, `${m.id}: ${r.ok ? "" : r.why}`);
    p = T.topUp(r.profile);
    assert.equal(p.credits, T.TEST_CREDITS);
    assert.equal(P.riding(p).model, m.id);
    for (const k of ["power", "brakes", "weight", "travel", "cells"]) while (G.modPrice(P.riding(p), k)) { const u = G.upgrade(p, k); assert.ok(u.ok, `${m.id} ${k}`); p = T.topUp(u.profile); }
  }
});
