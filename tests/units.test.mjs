// Display units (src/model/units.ts): Imperial by default (miles, mph), Metric (km, km/h) as a
// setting; display only (world units underneath). Conversions exact (1 km = 0.621371 mi); the
// setting is saved in the profile (v6), and every older save migrates to Imperial.
import test from "node:test";
import assert from "node:assert/strict";
const U = await import("../src/model/units.ts");
const P = await import("../src/model/profile.ts");
const E = await import("../src/model/economy.ts");

test("units: conversions and labels", () => {
  assert.equal(U.MI_PER_KM, 0.621371);
  assert.equal(U.far(1000), 0.621371, "1 km = 0.621371 mi");
  assert.equal(U.far(1000, "metric"), 1);
  assert.equal(U.dist(2736), "1.70 MI");
  assert.equal(U.dist(2736, "metric"), "2.74 KM");
  assert.equal(U.dist(0), "0.00 MI");
  assert.equal(U.speed(10), "36 MPH", "10 units/s = 36 km/h = 22.37 mph, ×SPEED_DISPLAY 1.6 for feel");
  assert.equal(U.speed(10, "metric"), "58 KM/H");
  assert.equal(U.SPEED_DISPLAY, 1.6);
  assert.equal(U.dist(1000), "0.62 MI", "distances are not scaled");
});

test("units: Imperial by default; Metric saved and loaded; old saves migrate to Imperial", () => {
  assert.equal(P.fresh().settings.units, "imperial");
  assert.equal(P.VERSION, 6);
  for (const v of [1, 2, 3, 4, 5]) {
    const p = P.migrate({ v, name: "KIP", credits: 10, settings: { sound: false, view: "table" } });
    assert.equal(p.settings.units, "imperial", `v${v} → Imperial`);
    assert.equal(p.settings.sound, false, "the other settings carry over");
    assert.equal(p.v, P.VERSION);
  }
  const m = P.migrate({ ...P.fresh(), settings: { sound: true, view: "chase", units: "metric" } });
  assert.equal(m.settings.units, "metric", "a v6 save keeps Metric");
  assert.equal(P.migrate({ ...P.fresh(), settings: { units: "furlongs" } }).settings.units, "imperial", "garbage → Imperial");
});

test("units: the payout's distance line follows the setting (the pay does not)", () => {
  const s = { mode: "freeride", finished: true, seconds: 60, distance: 2000, air: 0, wheelie: 0, far: 1609.344, tricks: 0, flips: 0 };
  const a = E.payout(s), b = E.payout(s, "metric");
  assert.ok(a.some(([k]) => k === "1.00 MI"), JSON.stringify(a));
  assert.ok(b.some(([k]) => k === "1.61 KM"), JSON.stringify(b));
  assert.deepEqual(a.map((l) => l[1]), b.map((l) => l[1]));
});
