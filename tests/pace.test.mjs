// Pace (src/model/pace.ts): every bike and setup's 0–20 mph, 0–30 mph and top speed, measured on the
// sim (full gas on the flat from a standstill), the numbers the garage's PACE row shows. The owner's
// brief: the torque is right, keep it; the faster bikes get a slightly higher top speed (the top gear
// stretches with the tier: TOP_STRETCH), each bike its own numbers, nothing crazy. So: every model's
// launch and top speed differ; within a class the top rises with the tier; the stretch adds at most
// 8 % at the top and leaves the gas bikes' launch (their lower gears and the torque curve) exactly as
// it was; gearing and the motor map move the numbers the way the garage says; a measure is
// deterministic. The table is printed (node --test tests/pace.test.mjs).
import test from "node:test";
import assert from "node:assert/strict";

const { pace, timeTo, paceRow, perHour } = await import("../src/model/pace.ts");
const { tune } = await import("../src/model/tune.ts");
const { newBike } = await import("../src/model/profile.ts");
const { MODELS, CLASSES, TOP_STRETCH } = await import("../src/data/roster.ts");

const mph = (ups) => perHour(ups);
const fromMph = (v) => v / perHour(1);
const stock = (id, set = {}) => tune({ ...newBike(id, "p"), ...set });
/** The same bike before the stretch (the top gear back where it was). */
const unstretched = (t) => {
  const g = Array.from(t.power.gears);
  g[g.length - 1] /= TOP_STRETCH[t.model.tier - 1];
  return { ...t, power: { ...t.power, gears: g } };
};
const row = (t) => { const p = pace(t); return { t20: timeTo(p, fromMph(20)), t30: timeTo(p, fromMph(30)), top: mph(p.top), crashed: p.crashed }; };
const f = (s) => (s === null ? "  —  " : s.toFixed(2).padStart(5));

test("pace: every bike measured, the table (stock, new)", () => {
  const lines = ["bike                         class        0–20   0–30   top mph  (before)"];
  for (const m of MODELS) {
    const t = stock(m.id), r = row(t), b = row(unstretched(t));
    assert.equal(r.crashed, false, `${m.id}: the launch rides clean`);
    lines.push(`${m.name.padEnd(28)} ${CLASSES[m.cls].name.padEnd(12)} ${f(r.t20)}  ${f(r.t30)}   ${r.top.toFixed(1).padStart(5)}   (${b.top.toFixed(1)})`);
  }
  console.log(lines.join("\n"));
});

test("pace: each model has its own numbers; within a class the top rises with the tier", () => {
  const all = MODELS.map((m) => ({ m, ...row(stock(m.id)) }));
  const tops = all.map((r) => r.top.toFixed(2)), t20 = all.map((r) => r.t20.toFixed(3));
  assert.equal(new Set(tops).size, tops.length, "sixteen top speeds");
  assert.equal(new Set(t20.map((x, i) => x + tops[i])).size, all.length, "sixteen launches");
  for (const c of Object.keys(CLASSES)) {
    const same = all.filter((r) => r.m.cls === c).sort((a, b) => a.m.tier - b.m.tier);
    for (let i = 1; i < same.length; i++) assert.ok(same[i].top > same[i - 1].top, `${c}: tier ${i + 1} tops tier ${i}`);
    for (let i = 1; i < same.length; i++) assert.ok(same[i].t20 < same[i - 1].t20, `${c}: tier ${i + 1} launches harder`);
  }
});

test("pace: the stretch is small and only at the top; the gas bikes' launch is untouched", () => {
  for (const m of MODELS) {
    const t = stock(m.id), before = unstretched(t), r = row(t), b = row(before);
    const gain = r.top / b.top;
    assert.ok(gain >= 1 - 1e-6 && gain <= 1.085, `${m.id}: top ×${gain.toFixed(3)}`);
    if (m.tier === 1) assert.equal(r.top, b.top, `${m.id}: a starter is as it was`);
    // The curve and the lower gears are the model's own (a multi-gear box: the stretch is only the top gear).
    if (t.power.gears.length > 1) assert.deepEqual(Array.from(t.power.gears).slice(0, -1), Array.from(before.power.gears).slice(0, -1));
    if (m.cls === "2t" || m.cls === "4t") assert.equal(r.t20, b.t20, `${m.id}: 0–20 mph as before (the torque is untouched)`);
  }
  // Not crazy: the fastest bike in the roster is at most 20 % over the slowest gas starter.
  const tops = MODELS.map((m) => row(stock(m.id)).top), gas = row(stock("anvil")).top;
  assert.ok(Math.max(...tops) / gas < 1.2, `fastest ${Math.max(...tops).toFixed(1)} mph vs ${gas.toFixed(1)}`);
});

test("pace: each setup has its own numbers (short gearing launches harder and tops lower; tall the other way)", () => {
  for (const id of ["buzzline", "bulkhead", "sparkhound"]) {
    const s = row(stock(id, { gearing: "short" })), n = row(stock(id)), l = row(stock(id, { gearing: "tall" }));
    assert.ok(s.t20 < n.t20 && n.t20 < l.t20, `${id}: 0–20 short ${s.t20} < stock ${n.t20} < tall ${l.t20}`);
    assert.ok(s.top < n.top && n.top < l.top, `${id}: top short ${s.top} < stock ${n.top} < tall ${l.top}`);
  }
  // A motor map on an e-bike, and the exhaust stages on a gas bike, show in the numbers too.
  const eco = row(stock("gridrat", { map: "eco" })), race = row(stock("gridrat", { map: "race" }));
  assert.ok(race.t20 < eco.t20 && race.top > eco.top);
  const s0 = row(stock("razorhive")), s2 = row(tune({ ...newBike("razorhive", "p"), mods: { power: 2, brakes: 0, weight: 0, travel: 0, cells: 0 } }));
  assert.ok(s2.t30 < s0.t30, "the exhaust pulls harder");
});

test("pace: deterministic; the garage's row in mph (default) and km/h", () => {
  const t = stock("hivequeen"), a = pace(t), b = pace({ power: { ...t.power }, shape: { ...t.shape } });
  assert.deepEqual(Array.from(a.trace), Array.from(b.trace));
  const imp = paceRow(t), met = paceRow(t, "metric");
  assert.deepEqual(imp.map((r) => r[0]), ["0–20 MPH", "0–30 MPH", "TOP"]);
  assert.deepEqual(met.map((r) => r[0]), ["0–30 KM/H", "0–50 KM/H", "TOP"]);
  assert.match(imp[2][1], /^\d+ MPH$/);
  assert.match(met[2][1], /^\d+ KM\/H$/);
  assert.match(imp[1][1], /^\d\.\d\d S$/);
  // A bike that never gets there says so (the starter e-bike tops out under 30 mph).
  assert.equal(paceRow(stock("glidewire"))[1][1], "—");
});
