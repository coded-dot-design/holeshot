// LET'S RIDE in Chromium (the built dist/holeshot.mjs): at 1440 (dark) and 390 touch (light), every
// tab, every destination on it starting the right ride (the mode, the map or ground, the venue), back
// to LET'S RIDE on the same tab; every tab's Play online opening the room card on that tab's kind
// (Race → CHALLENGE, Endless → RIDE OUT, Free Ride → JAM, Track Day → TRACK DAY with its circuit
// picker); then Track Day online for real against the stand-in room server (tests/room-server.mjs):
// a desktop hosts KNOTWORKS for two from the Track Day tab, a phone follows the link, both ride the
// same circuit in step to the flag, agree on the standings, and the circuit keeps each one's best lap.
// Waits on state, never on time.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";
import { CODE, roomServer } from "./room-server.mjs";
import { fresh, setup, normalize, STORE_KEY } from "../src/model/profile.ts";
import { STARTERS } from "../src/data/roster.ts";

const page = (theme) => `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false, onTheme: () => { const h = document.documentElement; h.dataset.theme = h.dataset.theme === "light" ? "dark" : "light"; } });</script></body></html>`;
const site = await serve(".", { "/dark": page("dark"), "/light": page("light") }), rooms = await roomServer({ max: 4 });
const browser = await chromium.launch(launchOptions());
const until = (p, fn, arg, what, timeout = 60000) => p.waitForFunction(fn, arg, { timeout, polling: 100 }).catch(async () => assert.fail(`${what}: timed out (${await p.evaluate(() => { const s = game.getSnapshot(); return JSON.stringify({ screen: s.screen, mode: s.mode, online: s.online && { phase: s.online.phase, kind: s.online.kind }, run: s.run && { phase: s.run.phase, map: s.run.map, lap: s.run.lap } }); }).catch((e) => e.message)})`));
const sr = "document.querySelector('[data-fizlet-host]').shadowRoot";
const $ = (p, fn) => p.evaluate(`((root) => (${fn}))(${sr})`);
const garage = (i, name) => {
  const p = normalize(setup(fresh(), { starter: STARTERS[i].id, paint: "acid", number: 7 + i, name, kit: { jersey: "lime" } }));
  p.credits = 500;
  p.stats.far = { ...p.stats.far, desert: 2446, city: 1014 };
  return p;
};
const open = async (path, vp, touch, g, errs) => {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  await ctx.addInitScript(([k, v]) => { try { if (!localStorage.getItem(k)) localStorage.setItem(k, v); } catch {} }, [STORE_KEY, JSON.stringify(g)]);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(path);
  await until(p, () => window.game && ["garage", "online"].includes(game.getSnapshot().screen), null, "mounts");
  return p;
};
// Each tab: [tab, its destinations: [selector, mode, map (or null), venue (or null)]], its online kind and the room's title.
const TABS = [
  ["race", [["[data-mode=race][data-venue=mx]", "race", null, "mx"], ["[data-mode=race][data-venue=sx]", "race", null, "sx"]], 0, "Challenge your friends online"],
  ["endless", [["[data-endless=desert]", "desert", "desert"], ["[data-endless=quarry]", "desert", "quarry"], ["[data-endless=forest]", "desert", "forest"], ["[data-endless=night-park]", "desert", "night-park"], ["[data-mode=endcity]", "endcity"], ["[data-mode=mashup]", "mashup"]], 4, "Ride out online"],
  ["free", [["[data-map=neon-park]", "freeride", "moto-track-mx"], ["[data-map=dune-sea]", "freeride", "dune-sea"], ["[data-map=quarry]", "freeride", "quarry"], ["[data-map=forest]", "freeride", "forest"], ["[data-map=night-park]", "freeride", "night-park"], ["[data-map=sx-floor]", "freeride", "sx-neon-dome"], ["[data-map=sx-volt-floor]", "freeride", "sx-volt-arena"], ["[data-mode=bigair]", "bigair"]], 1, "Jam with your friends online"],
  ["day", [["[data-circuit=td-meridian]", "trackday", "td-meridian"], ["[data-circuit=td-knotworks]", "trackday", "td-knotworks"], ["[data-circuit=td-bottlecap]", "trackday", "td-bottlecap"]], 6, "Track Day online"],
];
try {
  for (const [name, theme, vp, touch] of [["1440", "dark", { width: 1440, height: 900 }, false], ["390", "light", { width: 390, height: 844 }, true]]) {
    const errs = [], p = await open(`${site.url}/${theme}?rooms=${encodeURIComponent(rooms.url)}`, vp, touch, garage(0, "KIP"), errs);
    const press = async (sel) => { const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await (touch ? l.tap() : l.click()); };
    let n = 0;
    for (const [tab, dests, kind, title] of TABS) {
      // ---- every destination starts its ride; leaving lands back on LET'S RIDE on this tab ----
      for (const [sel, mode, map, venue] of dests) {
        if ((await $(p, "game.getSnapshot().screen")) !== "ride") await p.evaluate(() => game.show("ride"));
        await press(`[data-rtab=${tab}]`);
        await press(sel);
        // (A part past its limit or a street bike on the dirt asks first: RIDE ANYWAY.)
        await until(p, () => game.getSnapshot().screen === "event" || !!document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".dh-risk"), null, `${name}: ${sel} starts`);
        if (await $(p, "!!root.querySelector('.dh-risk')")) await press(".dh-risk-go");
        await until(p, ([m, mp, v]) => { const s = game.getSnapshot(); return s.screen === "event" && s.mode === m && (!mp || s.run?.map === mp) && (!v || (v === "sx") === /^sx-/.test(s.run?.map ?? "")); }, [mode, map, venue], `${name}: ${sel} → ${mode} ${map ?? ""} ${venue ?? ""}`);
        await p.evaluate(() => game.leave());
        await until(p, () => game.getSnapshot().screen === "result", null, `${name}: ${sel}: left`);
        await press(".dh-result [data-go=ride]");
        await until(p, (t) => game.getSnapshot().screen === "ride" && document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(`[data-rtab=${t}]`).getAttribute("aria-pressed") === "true", tab, `${name}: back on ${tab}`);
        n++;
      }
      // ---- Play online: the room card on the tab's kind ----
      await press(`[data-rtab=${tab}]`);
      await press(".dh-rf .ol-open");
      await until(p, (k) => game.getSnapshot().screen === "online" && document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(`.ol-room [data-olkind='${k}']`)?.getAttribute("aria-pressed") === "true", kind, `${name}: ${tab}: the room card on kind ${kind}`);
      const room = await $(p, "({ h: root.querySelector('.ol-room-h').textContent, circuits: !root.querySelector('.ol-circuits').hidden })");
      assert.deepEqual(room, { h: title, circuits: kind === 6 }, `${name}: ${tab}: ${title}`);
      await press(".ol-room .ol-head .ol-back");
      await until(p, () => game.getSnapshot().screen === "ride", null, `${name}: BACK from the room card`);
    }
    // ---- every other action the old LET'S RIDE had (owner: nothing dropped) ----
    // The series, MX and SX (its tiers, rounds and retire live on the series screen), ← LET'S RIDE back to the Race tab.
    for (const v of ["mx", "sx"]) {
      await press("[data-rtab=race]");
      await press(`[data-go=series][data-venue=${v}]`);
      await until(p, (v) => game.getSnapshot().screen === "series" && new RegExp(`^${v.toUpperCase()} `).test(document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".dh-title").textContent), v, `${name}: SERIES · ${v}`);
      assert.ok(await $(p, "root.querySelectorAll('.ds [data-series-enter]').length > 0"), `${name}: the series' tier picks`);
      await press(".ds .dh-back");
      await until(p, () => game.getSnapshot().screen === "ride" && document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("[data-rtab=race]").getAttribute("aria-pressed") === "true", null, `${name}: ← LET'S RIDE`);
    }
    // The bests: each ground's best distance, Endless Wheelie City's, a circuit with no lap yet.
    await press("[data-rtab=endless]");
    assert.deepEqual(await $(p, "['desert', 'quarry'].map((k) => root.querySelector(`[data-endless=${k}] .shop-fig b`).textContent).concat(root.querySelector('[data-mode=endcity] .shop-fig b').textContent)"), ["1.52 mi", "0.00 mi", "0.63 mi"], `${name}: the bests`);
    // The Free Ride maps' previews are drawn.
    await press("[data-rtab=free]");
    await until(p, () => [...document.querySelector("[data-fizlet-host]").shadowRoot.querySelectorAll("canvas[data-prev]")].length === 5 && [...document.querySelector("[data-fizlet-host]").shadowRoot.querySelectorAll("canvas[data-prev]")].every((c) => c.width > 30), null, `${name}: the map previews`);
    // ⚙ settings and back to LET'S RIDE (on the tab left).
    await press(".dh-ride .dh-cog");
    await until(p, () => game.getSnapshot().screen === "settings", null, `${name}: ⚙`);
    assert.match(await $(p, "root.querySelector('.dh-set .dh-back').textContent"), /Let's Ride/, `${name}: settings come back to LET'S RIDE`);
    await press(".dh-set .dh-back");
    await until(p, () => game.getSnapshot().screen === "ride" && document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("[data-rtab=free]").getAttribute("aria-pressed") === "true", null, `${name}: back on LET'S RIDE`);
    // Day / Night: the page follows, the key keeps the focus.
    const was = await p.evaluate(() => document.documentElement.dataset.theme);
    await press(".dh-ride .dh-theme");
    await until(p, (w) => document.documentElement.dataset.theme !== w && game.getSnapshot().screen === "ride", was, `${name}: the theme flips`);
    assert.deepEqual(await $(p, "[root.querySelector('.dh-theme').textContent.trim(), root.activeElement === root.querySelector('.dh-theme')]"), [was === "dark" ? "☀Day" : "☾Night", true], `${name}: Day / Night`);
    // The rider (a wide screen's header): to the rider's gear in the garage.
    if (!touch) {
      await press(".dh-ride .dh-who");
      await until(p, () => game.getSnapshot().screen === "garage" && document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("[data-look=rider]")?.getAttribute("aria-pressed") === "true", null, `${name}: Rider → the rider's gear`);
      await p.evaluate(() => game.show("ride"));
    }
    // ← Garage.
    await press(".dh-ride .dh-back");
    await until(p, () => game.getSnapshot().screen === "garage", null, `${name}: ← Garage`);
    await p.evaluate(() => game.show("ride"));
    assert.equal(await $(p, "root.querySelector('.dh-cards').scrollWidth > innerWidth + 1"), false, `${name}: no sideways scroll`);
    assert.deepEqual(errs, [], `${name}: no page errors`);
    console.log(`✓ ${name} (${theme}): ${n} destinations each start their ride; each tab's Play online opens its kind (${ms()})`);
    await p.context().close();
  }

  // ---- test credits: every Play online is off, and says why; the room card stays shut ----
  {
    const errs = [], p = await open(`${site.url}/dark?credits=inf`, { width: 1440, height: 900 }, false, garage(0, "KIP"), errs);
    await p.evaluate(() => game.show("ride"));
    for (const tab of ["race", "endless", "free", "day"]) {
      await p.locator(`[data-rtab=${tab}]`).click();
      assert.deepEqual(await $(p, "[root.querySelector('.dh-rf .ol-open').disabled, /test credits/.test(root.querySelector('.dh-rf').textContent)]"), [true, true], `test credits: ${tab}: online off`);
    }
    await p.evaluate(() => game.online());
    assert.equal(await p.evaluate(() => game.getSnapshot().screen), "ride", "test credits: the room card stays shut");
    assert.deepEqual(errs, [], "test credits: no page errors");
    await p.context().close();
  }

  // ---- Track Day online: host KNOTWORKS for two from the Track Day tab; a phone follows the link ----
  const errs = [];
  const A = await open(`${site.url}/dark?rooms=${encodeURIComponent(rooms.url)}`, { width: 1440, height: 900 }, false, garage(1, "ANA"), errs);
  await A.evaluate(() => game.show("ride"));
  await A.locator("[data-rtab=day]").click();
  await A.locator(".dh-rf .ol-open").click();
  const room = A.locator("[data-fizlet-host] .ol-room");
  await room.locator("input[name=who]").fill("ana");
  await room.locator("input[name=code]").fill(CODE.toLowerCase());
  await room.locator(".ol-host").click();
  await until(A, (s) => !eval(s).querySelector(".ol-circuits").hidden, sr, "the circuit picker shows");
  await room.locator("[data-olcircuit='1']").click();
  await room.locator("[data-olsize='2']").click();
  await until(A, (s) => /Waiting for/.test(eval(s).querySelector(".ol-wait-say").textContent), sr, "A waits in its room");
  assert.match(await $(A, "root.querySelector('.ol-t-ride').textContent"), /^TRACK DAY · KNOTWORKS$/, "the lobby says the pick");
  await A.bringToFront();
  await $(A, "root.querySelector('.ol-share').click()");
  await until(A, (s) => eval(s).querySelector(".ol-share").textContent === "Link copied", sr, "the link is copied");
  const link = (await A.evaluate(() => navigator.clipboard.readText())).replace(/^https?:\/\/[^/]+\//, `${site.url}/`);
  const B = await open(link, { width: 390, height: 844 }, true, garage(2, "BO"), errs);
  for (const p of [A, B]) await until(p, () => { const s = game.getSnapshot(); return s.online?.phase === "ride" && s.mode === "trackday" && s.run?.map === "td-knotworks"; }, null, "both on KNOTWORKS", 90000);
  for (const p of [A, B]) await p.evaluate(() => (game.auto = true));
  const s = await Promise.all([A, B].map((p) => p.evaluate(() => game.getSnapshot())));
  assert.deepEqual(s.map((x) => [x.online.players, x.online.kind, x.online.sub, x.online.desync]), [[2, 6, 1, -1], [2, 6, 1, -1]], "one room, one circuit, in step");
  for (const p of [A, B]) await until(p, () => game.getSnapshot().online?.phase === "over" && game.getSnapshot().screen === "result", null, "to the flag: the result", 300000);
  const st = await Promise.all([A, B].map((p) => p.evaluate(() => game.getSnapshot().online)));
  assert.deepEqual(st[0].standings, st[1].standings, "both agree on the standings");
  assert.deepEqual(st.map((x) => x.desync), [-1, -1], "no desync");
  for (const p of [A, B]) assert.ok((await p.evaluate(() => game.profile.stats.best["lap:td-knotworks"] ?? 0)) > 5, "the circuit keeps the best lap");
  assert.match(await $(A, "root.querySelector('.dh-result .dh-h').textContent"), /^TRACK DAY · TRACK DAY · KNOTWORKS · ONLINE$/, "the result names the ride");
  assert.match(await $(A, "root.querySelector('.dh-result').textContent"), /ONLINE BONUS ×1\.5/, "online pays ×1.5");
  assert.deepEqual(errs, [], "no page errors");
  console.log(`✓ Track Day online: KNOTWORKS for two (1440 host, 390 by the link), in step to the flag, the same standings, best laps kept, ×1.5 (${ms()})`);
} finally {
  await browser.close();
  await site.close();
  await rooms.close();
}
function ms() { return `${(performance.now() / 1000).toFixed(1)} s`; }
