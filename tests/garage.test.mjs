// The garage (src/model/garage.ts, src/model/upkeep.ts): warnings come before failures (worn under
// WARN, "may fail" under FAIL.at, nothing above the line ever fails); a failure is rolled from the
// event's seed (the same event fails the same way), costs part of the payout and leaves the part dead
// until it is replaced, and the pit crew then helps at once if you can't pay; crash damage builds up
// and is fixed for credits; tyre compounds and the motor map change the wear; every action lands in
// the service log. The showroom sells all sixteen bikes (tiers 3-4 open with progress), sells a bike
// for its trade-in value (never the last), trades one in when the garage is full; cosmetics are tried
// on for free and bought once; outfits own their pieces. The new save fields fill in with defaults
// (no schema step) and a 0.1.0 bike's mods map onto the new ones. The balance: a reference player
// (tests/garage.test.mjs REF) affords the first real mod after 3-4 events and spends 15-45 % of what
// they earn on upkeep; never stuck.
import test from "node:test";
import assert from "node:assert/strict";

const P = await import("../src/model/profile.ts");
const G = await import("../src/model/garage.ts");
const U = await import("../src/model/upkeep.ts");
const { settle, apply, pitReady, pitFix } = await import("../src/model/economy.ts");
const { tune } = await import("../src/model/tune.ts");
const E = await import("../src/data/economy.ts");
const { MODELS, STARTERS } = await import("../src/data/roster.ts");
const { lookOf } = await import("../src/garage/look.ts");

const { setup, fresh, riding } = P;
const start = (starter = "buzzline", extra = {}) => ({ ...setup(fresh(), { starter, paint: "acid", number: 23, name: "kip" }), ...extra });
const withParts = (p, parts, more = {}) => ({ ...p, bikes: [{ ...riding(p), parts: { ...riding(p).parts, ...parts }, ...more }, ...p.bikes.slice(1)] });
/** The reference player's four events (a human's ride: a crash or two, mid-field), in rotation. */
const REF = [
  { mode: "race", seconds: 45, distance: 340, gas: 22, air: 4.5, wheelie: 1.5, crashes: 1, hard: 1, finished: true, place: 2 },
  { mode: "bigair", seconds: 60, distance: 560, gas: 22, air: 13, wheelie: 2, crashes: 2, hard: 1, finished: true, judges: 55, flips: 1 },
  { mode: "wheelie", seconds: 60, distance: 600, gas: 20, air: 0, wheelie: 8, crashes: 1, hard: 0, finished: true, score: 2000 },
  { mode: "freeride", seconds: 120, distance: 1100, gas: 50, air: 12, wheelie: 5, crashes: 1, hard: 1, finished: true },
];
const event = (p, s, seed) => { const b = riding(p), r = U.ride(settle(s, b), b, seed); return { p: U.after(apply(p, r), r), r }; };

test("upkeep: worn, then may fail, then failed: warnings come first, nothing above the line fails", () => {
  const p = start();
  const b = (c) => ({ ...riding(p), parts: { ...riding(p).parts, chain: c } });
  assert.equal(U.partState(b(0.5), "chain"), "ok");
  assert.equal(U.partState(b(E.WARN - 0.01), "chain"), "worn");
  assert.equal(U.partState(b(E.FAIL.at - 0.01), "chain"), "risk");
  assert.equal(U.failChance(b(E.FAIL.at), "chain"), 0, "at the line: never");
  assert.ok(U.failChance(b(0), "chain") === E.FAIL.max && U.failChance(b(0.05), "chain") < E.FAIL.max);
  // Above the line, a thousand events never fail.
  for (let s = 0; s < 1000; s++) assert.equal(U.failure(b(E.FAIL.at + 0.001), s), "");
  assert.deepEqual(U.warnings(b(0.1)).map((w) => [w[0], w[1]]), [["chain", "risk"]]);
  assert.match(U.warnings(b(0.1))[0][2], /may fail next event \(\d+%\)/);
});

test("upkeep: a failure is telegraphed, seeded, fair: half the payout, the part dead, the crew helps at once", () => {
  let p = withParts(start(), { chain: 0.02 });
  // The same seed fails the same way; across seeds, about the stated chance.
  const b = riding(p), chance = U.failChance(b, "chain");
  let n = 0;
  for (let s = 0; s < 4000; s++) n += U.failure(b, s) === "chain" ? 1 : 0;
  assert.ok(Math.abs(n / 4000 - chance) < 0.03, `${n / 4000} ≈ ${chance}`);
  assert.equal(U.failure(b, 77), U.failure(b, 77));
  const seed = [...Array(200).keys()].find((s) => U.failure(b, s) === "chain");
  const r0 = settle(REF[0], b), r = U.ride(r0, b, seed);
  assert.equal(r.fail, "chain");
  assert.equal(r.credits, r0.credits - Math.round(r0.credits * E.FAIL.pay), "towed in: half the payout");
  assert.deepEqual(r.lines.at(-1), ["CHAIN SNAPPED · TOWED IN", -Math.round(r0.credits * E.FAIL.pay)]);
  assert.ok(r.credits > 0, "still pays something");
  p = { ...U.after(apply({ ...p, credits: 0 }, r), r) };
  assert.equal(riding(p).fail, "chain");
  assert.equal(riding(p).parts.chain, 0);
  assert.equal(riding(p).log[0][1], "fail:chain");
  // Can't pay for a chain: the crew helps at once (no waiting for PIT_CREW.every).
  p = { ...p, credits: 10 };
  assert.equal(p.pit, 1);
  assert.equal(pitReady(p), true);
  const f = pitFix(p);
  assert.equal(riding(f).fail, "");
  assert.ok(riding(f).parts.chain >= E.PIT_CREW.to && E.PIT_CREW.to > E.FAIL.at, "the crew's fix is above the line");
  // A short leave (under FAIL.minSeconds) never fails.
  assert.equal(U.ride(settle({ ...REF[0], seconds: 3, finished: false }, b), b, seed).fail, "");
  // Paying for it clears the failure.
  const s = G.service({ ...p, credits: 1000 }, "chain");
  assert.ok(s.ok && riding(s.profile).fail === "" && riding(s.profile).parts.chain === 1);
});

test("upkeep: never stuck: broke and never servicing, every event still pays, the bike still rides, the crew comes", () => {
  for (const st of STARTERS) {
    let p = start(st.id), crew = 0;
    for (let e = 1; e <= 60; e++) {
      const was = p.credits, x = event(p, REF[e % 4], e * 7919);
      p = x.p;
      assert.ok(p.credits > was, `${st.id} event ${e}: pays (${x.r.credits})`);
      p = { ...p, credits: 0 }; // spends it all on paint
      if (pitReady(p)) (p = pitFix(p)), crew++;
      const t = tune(riding(p));
      assert.ok(t.power.force > 0.6 * t.model.power.force && t.power.grip > 0.6 * t.model.power.grip, "rides");
    }
    assert.ok(crew >= 3, `${st.id}: the pit crew helped ${crew} times`);
  }
});

test("upkeep: crash damage builds up and is fixed; the compound and the motor map change the wear", () => {
  let p = start("sparkhound", { credits: 5000 });
  const { p: q, r } = event(p, { ...REF[1], crashes: 3, hard: 2 }, 1);
  assert.deepEqual(r.dmg, { bars: 3 * E.DAMAGE.crash.bars, plastics: 3 * E.DAMAGE.crash.plastics + 2 * E.DAMAGE.hard.plastics });
  assert.ok(riding(q).dmg.bars > 0.3 && riding(q).dmg.plastics > 0.4);
  const look = lookOf(q).look;
  assert.ok(look.bend > 0.3 && look.cracks > 0.4 && look.plastic !== lookOf(p).look.plastic, "it looks it: bent bars, dulled plastics");
  const fx = G.repair(q, "bars");
  assert.ok(fx.ok && riding(fx.profile).dmg.bars === 0 && fx.spent === G.fixPrice(riding(q), "bars"));
  assert.equal(G.repair(fx.profile, "bars").ok, false, "nothing to fix");
  // Soft tyres wear faster than medium, hard slower; the race map cooks the battery; cells cool it.
  const w = (bk) => U.ride(settle(REF[3], bk), bk, 1).wear;
  const b = riding(p);
  assert.ok(w({ ...b, tyre: "soft" }).tyres > w(b).tyres && w({ ...b, tyre: "hard" }).tyres < w(b).tyres);
  assert.ok(w({ ...b, map: "race" }).motor > w(b).motor && w({ ...b, map: "eco" }).motor < w(b).motor);
  assert.ok(w({ ...b, mods: { ...b.mods, cells: 2 } }).motor < w(b).motor);
});

test("garage: mods, choices and fixes land in the service log; cosmetic try-on is free, buying owns it", () => {
  let p = start("anvil", { credits: 20000 });
  p = G.service(withParts(p, { tyres: 0.4 }), "tyres", "soft").profile;
  p = G.upgrade(p, "power").profile;
  p = G.setChoice(p, "gearing", "tall").profile;
  assert.deepEqual(riding(p).log.map((l) => l[1]), ["setup:gearing:tall", "mod:power:1", "svc:tyres:soft"]);
  assert.equal(riding(p).tyre, "soft");
  // Try-on: the look changes, the credits don't.
  const t = G.tryOn(p, "paint", "magma");
  assert.equal(riding(t).look.paint, "magma");
  assert.equal(t.credits, p.credits);
  const price = G.cosmeticPrice(p, "paint", "magma");
  assert.ok(price > 0);
  const bought = G.dress(p, "paint", "magma");
  assert.ok(bought.ok && bought.spent === price && bought.profile.owned.includes("paint:magma"));
  assert.equal(G.cosmeticPrice(G.dress(bought.profile, "paint", "acid").profile, "paint", "magma"), 0, "owned: free to switch back");
  // Graphics, plastics, plate decal, a new helmet shape and visor.
  for (const [slot, id] of [["graphics", "circuit"], ["plastics", "volt"], ["plate", "neon"], ["helmet", "spike"], ["visor", "acid"]]) {
    const r = G.dress(p, slot, id);
    assert.ok(r.ok && r.spent > 0, `${slot}:${id}`);
  }
  const l = lookOf(G.dress(G.dress(p, "graphics", "circuit").profile, "plate", "neon").profile).look;
  assert.deepEqual([l.gfx, l.side, l.num], ["circuit", "#22e6ff", 23], "the rig gets the kit and the number");
  // An outfit owns its pieces; already owned pieces come off its price.
  const o = G.dress(p, "outfit", "hornet");
  assert.ok(o.ok);
  assert.equal(o.profile.kit.jersey, "gold");
  assert.ok(o.profile.owned.includes("jersey:gold") && o.profile.owned.includes("pattern:split"));
  assert.equal(G.cosmeticPrice(o.profile, "jersey", "gold"), 0);
  assert.equal(G.dress({ ...p, credits: 0 }, "outfit", "hornet").ok, false, "costs credits");
});

test("showroom: all sixteen bikes; tiers 3-4 open with progress or credits earned", () => {
  const p = start("buzzline", { credits: 1e6 });
  assert.equal(MODELS.length, 16);
  const t3 = MODELS.find((m) => m.tier === 3), t4 = MODELS.find((m) => m.tier === 4), t2 = MODELS.find((m) => m.tier === 2);
  assert.ok(G.buyBike(p, t2.id).ok, "tier 2 is always for sale");
  assert.match(G.buyBike(p, t3.id).why, /Opens after 12 events/);
  assert.ok(G.buyBike({ ...p, stats: { ...p.stats, events: E.UNLOCK[3].events } }, t3.id).ok, "tier 3 by events");
  assert.ok(G.buyBike({ ...p, stats: { ...p.stats, earned: E.UNLOCK[3].earned } }, t3.id).ok, "tier 3 by credits earned");
  assert.equal(G.buyBike({ ...p, stats: { ...p.stats, events: E.UNLOCK[3].events } }, t4.id).ok, false);
  assert.ok(G.buyBike({ ...p, stats: { ...p.stats, events: E.UNLOCK[4].events } }, t4.id).ok, "tier 4");
  assert.ok(G.buyBike(p, t4.id, true).ok, "`all` skips the unlocks (tools)");
});

test("showroom: sell for the trade-in value (never the last bike); trade one in when the garage is full", () => {
  let p = start("anvil", { credits: 30000 });
  assert.equal(G.sell(p, 0).ok, false, "never the last bike");
  p = G.buyBike(p, "forgeback").profile;
  p = G.buyBike(p, "razorhive").profile;
  assert.equal(p.bikes.length, E.GARAGE_SLOTS);
  assert.match(G.buyBike(p, "glidewire").why, /trade one in/);
  // Trade-in: worse condition, damage, less; mods add a share of their price.
  const b0 = p.bikes[0], v0 = G.tradeValue(b0);
  assert.ok(v0 > 0 && v0 < MODELS.find((m) => m.id === "anvil").price);
  assert.ok(G.tradeValue({ ...b0, parts: { ...b0.parts, motor: 0.1 } }) < v0);
  assert.ok(G.tradeValue({ ...b0, dmg: { bars: 1, plastics: 1 } }) < v0);
  assert.ok(G.tradeValue({ ...b0, mods: { ...b0.mods, power: 2 } }) > v0);
  const c = p.credits, tr = G.buyBike({ ...p, ride: 0 }, "glidewire", false, 0);
  assert.ok(tr.ok);
  assert.equal(tr.profile.credits, c - Math.max(0, MODELS.find((m) => m.id === "glidewire").price - v0));
  assert.equal(tr.profile.bikes.length, E.GARAGE_SLOTS);
  assert.deepEqual(tr.profile.bikes.map((b) => b.model), ["forgeback", "razorhive", "glidewire"]);
  assert.equal(riding(tr.profile).model, "glidewire", "the new bike rides next");
  const s = G.sell(tr.profile, 1);
  assert.ok(s.ok && s.profile.bikes.length === 2 && s.profile.credits === tr.profile.credits + G.tradeValue(tr.profile.bikes[1]));
  assert.equal(riding(s.profile).model, "glidewire", "the riding bike stays the riding bike");
});

test("save: the garage's fields fill in with defaults (no schema step) and go round the export code", () => {
  const old = { v: 1, name: "kip", credits: 900, bikes: [{ uid: "b1", model: "buzzline", parts: { tyres: 0.5 }, mods: { power: 1, gearing: 2, susp: 2 }, look: { paint: "acid", number: 9 } }] };
  const p = P.migrate(old), b = p.bikes[0];
  assert.deepEqual([b.mods.power, b.gearing, b.mods.travel, b.spring, b.tyre, b.map], [1, "short", 1, "stiff", "med", "std"], "a 0.1.0 bike's mods map on");
  assert.deepEqual(b.setups.sort(), ["gearing:short", "spring:stiff"], "what it had counts as bought");
  assert.deepEqual([b.dmg, b.fail, b.log, b.look.graphics, b.look.plastics, b.look.plate], [{ bars: 0, plastics: 0 }, "", [], "none", "scheme", "scheme"]);
  // Bad values are clamped or dropped.
  const bad = P.normalize({ ...p, bikes: [{ ...b, tyre: "slick", gearing: "rocket", setups: ["gearing:tall", "nope", 3], dmg: { bars: 7, plastics: -1 }, fail: "wing", log: [[2, "svc:chain", 90], "x", [1]], look: { ...b.look, graphics: "skulls" } }] }).bikes[0];
  assert.deepEqual([bad.tyre, bad.gearing, bad.setups.includes("gearing:tall"), bad.setups.includes("nope"), bad.dmg, bad.fail, bad.log, bad.look.graphics], ["med", "stock", true, false, { bars: 1, plastics: 0 }, "", [[2, "svc:chain", 90]], "none"]);
  // A worked garage goes round the code.
  let q = start("sparkhound", { credits: 9000 });
  q = G.setChoice(G.upgrade(q, "cells").profile, "map", "race").profile;
  q = G.dress(q, "graphics", "bolt").profile;
  q = event(q, { ...REF[0], crashes: 2 }, 3).p;
  const back = P.importCode(P.exportCode(q));
  assert.deepEqual(back.profile, P.normalize(q));
  assert.equal(P.VERSION, 1, "no version bump from the garage");
});

test("balance: the reference player affords the first real mod after 3-4 events; upkeep is felt, not punishing", () => {
  const cheapest = Math.min(...Object.values(E.MODS).map((m) => m.price[1]));
  assert.ok(cheapest > E.START_CREDITS, "no real mod on day one");
  for (const st of STARTERS) {
    for (const shift of [0, 1, 2, 3]) {
      let p = start(st.id), earned = 0, upkeep = 0, first = 0;
      for (let e = 1; e <= 32; e++) {
        const x = event(p, REF[(e - 1 + shift) % 4], e * 7919);
        (p = x.p), (earned += x.r.credits);
        // Services anything under 40 %, then buys stage 1 of the exhaust (or controller) when it can.
        for (const k of E.PARTS) if (riding(p).parts[k] < 0.4) { const s = G.service(p, k); if (s.ok) (p = s.profile), (upkeep += s.spent); }
        if (!first && p.credits >= G.modPrice(riding(p), "power")) (first = e), (p = G.upgrade(p, "power").profile);
      }
      assert.ok(first >= 3 && first <= 4, `${st.id} (order ${shift}): first mod after ${first} events`);
      const share = upkeep / earned;
      assert.ok(share >= 0.15 && share <= 0.45, `${st.id}: upkeep ${(share * 100).toFixed(0)} % of ${earned}`);
      for (const k of E.PARTS) assert.ok(riding(p).parts[k] >= E.WARN, `${st.id}: a servicing player never rides a worn ${k}`);
    }
  }
});

test("roster: six original makers, each a nod and none the real thing; a new bike comes in its maker's colours", async () => {
  const { MAKERS, makerOf } = await import("../src/data/roster.ts");
  const { PAINTS } = await import("../src/data/looks.ts");
  assert.deepEqual(Object.values(MAKERS).map((m) => m.name), ["YAMADA", "HONDO", "KAWAZAKURA", "STARKWOLF", "SURGE-ON", "MAKFOX"]);
  // No real maker names or model codes, as words, anywhere a player reads.
  const text = [...Object.values(MAKERS).flatMap((m) => [m.name, m.motto]), ...MODELS.flatMap((m) => [m.name, m.blurb])].join(" ").toUpperCase();
  for (const w of ["YAMAHA", "HONDA", "KAWASAKI", "BETA", "STARK", "VARG", "SUR-RON", "SURRON", "ULTRA BEE", "MAC FOX", "MACFOX", "YZ", "CRF", "KX", "RR"]) assert.ok(!new RegExp(`(^|[^A-Z])${w}([^A-Z]|$)`).test(text), w);
  assert.equal(MODELS.find((m) => m.id === "hivequeen").name, "YX-250 2T");
  // The YX-250 has the class's sharpest 2-stroke hit.
  const twos = MODELS.filter((m) => m.cls === "2t");
  assert.equal(Math.max(...twos.map((m) => m.power.curve[6] * m.power.force)), MODELS.find((m) => m.id === "hivequeen").power.force * MODELS.find((m) => m.id === "hivequeen").power.curve[6]);
  for (const m of MODELS) assert.ok(PAINTS.some((x) => x.id === "f-" + m.maker && x.plastic === makerOf(m).colors[0]), `${m.id}: factory paint`);
  const b = G.buyBike(start("anvil", { credits: 9000 }), "glidewire");
  assert.ok(b.ok && riding(b.profile).look.paint === "f-makfox" && b.profile.owned.includes("paint:f-makfox") && riding(b.profile).look.number === 23);
});
