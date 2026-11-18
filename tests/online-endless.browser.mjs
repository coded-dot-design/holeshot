// HOLESHOT online, the endless rides together, in Chromium (the built dist/holeshot.mjs) against the
// stand-in fizlet-rooms server (tests/room-server.mjs, with its phone-link latency shim): for every
// ENDLESS ground and Endless Wheelie City a desktop (1440) hosts a room for two through the room
// card (ENDLESS → the ground, or ENDLESS WHEELIE CITY) and a phone (390, touch) follows the link.
// Both land on the same endless world (the same mode, the same ground), ride it on the autopilot,
// see the same session scoreboard (both rows), stay in step (no desync); the phone's REGROUP (G)
// brings it to the host; END on both banks the ride, and both agree on the standings. Waits on state,
// never on time. Screenshots of each ride (both screens) go to HS_SHOTS=<dir> when it is set.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";
import { CODE, roomServer } from "./room-server.mjs";
import { fresh, setup, riding, normalize, STORE_KEY } from "../src/model/profile.ts";
import { STARTERS } from "../src/data/roster.ts";
import { BIOMES } from "../src/modes/desert/track.ts";

const full = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), sound: false });</script></body></html>`;
const site = await serve(".", { "/": full }), rooms = await roomServer({ max: 4, lag: { rtt: [60, 150], jitter: 30, spike: 300, spikeEvery: 5000, seed: 5 } });
const browser = await chromium.launch(launchOptions());
const errors = [], t0 = Date.now(), SHOTS = process.env.HS_SHOTS;
const until = (p, fn, arg, what, timeout = 60000) => p.waitForFunction(fn, arg, { timeout, polling: 100 }).catch(async () => assert.fail(`${what}: timed out (${await p.evaluate(() => { const s = game.getSnapshot(); return JSON.stringify({ screen: s.screen, mode: s.mode, online: s.online, run: s.run && { phase: s.run.phase, clock: s.run.clock, x: s.run.x, z: s.run.z } }); }).catch((e) => e.message)})`));
const snap = (p) => p.evaluate(() => game.getSnapshot());
const sr = "document.querySelector('[data-fizlet-host]').shadowRoot";
const click = (p, s) => p.evaluate(([sr, s]) => eval(sr).querySelector(s)?.click(), [sr, s]);
const ms = () => `${((Date.now() - t0) / 1000).toFixed(1)} s`;
const garage = (i, name) => {
  const p = normalize(setup(fresh(), { starter: STARTERS[i].id, paint: ["acid", "pinkout", "gridline", "sodium"][i], number: 7 + i, name, kit: { jersey: ["lime", "pink", "cyan", "orange"][i] } }));
  p.credits = 500;
  return p;
};
try {
  const open = async (path, vp, touch, name, g) => {
    const ctx = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch });
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
    await ctx.addInitScript(([k, v]) => { try { if (!localStorage.getItem(k)) localStorage.setItem(k, v); } catch {} }, [STORE_KEY, JSON.stringify(g)]);
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
    await p.goto(path.startsWith("http") ? path : `${site.url}${path}?rooms=${encodeURIComponent(rooms.url)}`);
    await until(p, () => window.game && ["menu", "online"].includes(game.getSnapshot().screen), null, `${name} mounts`);
    return p;
  };
  const RIDES = [...BIOMES.map((b, i) => ({ kind: 4, sub: i, mode: "desert", ground: b.id, name: b.name })), { kind: 5, sub: 0, mode: "endcity", ground: "city", name: "ENDLESS WHEELIE CITY" }];
  for (const [n, R] of RIDES.entries()) {
    const A = await open("/", { width: 1440, height: 900 }, false, "A", garage(n % 4, "ANA")), B0 = garage((n + 1) % 4, "BO");
    await click(A, "[data-go=ride]");
    await click(A, ".ol-open");
    const room = A.locator("[data-fizlet-host] .ol-room");
    await room.locator("input[name=who]").fill("ana");
    await room.locator("input[name=code]").fill(CODE.toLowerCase());
    await room.locator(".ol-host").click();
    await room.locator(`[data-olkind='${R.kind}']`).click();
    if (R.kind === 4) {
      await until(A, (sr) => !eval(sr).querySelector(".ol-biomes").hidden, sr, "the ground picker shows");
      await room.locator(`[data-olbiome='${R.sub}']`).click();
    }
    const blurb = await A.evaluate((sr) => eval(sr).querySelector(".ol-kind-sub").textContent, sr);
    assert.match(blurb, /regroup/i, "the pick says how to find each other");
    await room.locator("[data-olsize='2']").click();
    await until(A, (sr) => /Waiting for/.test(eval(sr).querySelector(".ol-wait-say").textContent), sr, "A waits in its room");
    await A.bringToFront();
    await click(A, ".ol-share");
    await until(A, (sr) => eval(sr).querySelector(".ol-share").textContent === "LINK COPIED", sr, "the link is copied");
    const link = (await A.evaluate(() => navigator.clipboard.readText())).replace(/^https?:\/\/[^/]+\//, `${site.url}/`);
    const B = await open(link, { width: 390, height: 844 }, true, "B", B0);
    for (const p of [A, B]) await until(p, (m) => game.getSnapshot().online?.phase === "ride" && game.getSnapshot().mode === m, R.mode, `${R.name}: both ride it`);
    for (const p of [A, B]) await p.evaluate(() => (game.auto = true));
    await Promise.all([A, B].map((p) => until(p, () => game.getSnapshot().run.phase === "run" && Math.hypot(game.getSnapshot().run.x, game.getSnapshot().run.z) > 25, null, `${R.name}: riding out`)));
    const s = await Promise.all([A, B].map(snap));
    assert.deepEqual(s.map((x) => [x.online.players, x.online.kind, x.online.sub, x.online.desync]), [[2, R.kind, R.sub, -1], [2, R.kind, R.sub, -1]], `${R.name}: one room, one ground, in step`);
    if (R.kind === 4) assert.deepEqual(s.map((x) => x.run.map), [R.ground, R.ground], "the same ground on both screens");
    for (const p of [A, B]) await until(p, (sr) => eval(sr).querySelectorAll(".ol-board li").length === 2, sr, "the session scoreboard shows both riders");
    if (SHOTS) for (const [k, p] of [A, B].entries()) await p.screenshot({ path: `${SHOTS}/endless-${R.ground}-${k ? "390" : "1440"}.png` });
    // The phone rides off on its own (gas, hard right) until it is well away from the host, then
    // REGROUP (G) brings it back to the host (both screens agree it is by the host).
    await B.evaluate(() => (game.auto = false));
    await B.keyboard.down("Space");
    await B.keyboard.down("KeyD");
    await until(B, () => { const [a, b] = game.getSnapshot().online.pos; return Math.hypot(a[0] - b[0], a[1] - b[1]) > 30; }, null, `${R.name}: the phone rides away from the host`, 90000);
    const apart = await B.evaluate(() => { const [a, b] = game.getSnapshot().online.pos; return Math.hypot(a[0] - b[0], a[1] - b[1]); });
    await B.keyboard.up("KeyD");
    await B.keyboard.up("Space");
    if (SHOTS) await B.screenshot({ path: `${SHOTS}/endless-${R.ground}-apart-390.png` });
    await B.keyboard.press("KeyG");
    await until(B, () => { const o = game.getSnapshot().online, [a, b] = o.pos; return o.desync < 0 && Math.hypot(a[0] - b[0], a[1] - b[1]) <= 15; }, null, `${R.name}: REGROUP brings the phone to the host`);
    await until(A, () => { const [a, b] = game.getSnapshot().online.pos; return Math.hypot(a[0] - b[0], a[1] - b[1]) <= 25; }, null, `${R.name}: the host's screen sees it too`);
    const d = await B.evaluate(() => { const [a, b] = game.getSnapshot().online.pos; return Math.hypot(a[0] - b[0], a[1] - b[1]); });
    assert.ok(d <= 25, `${R.name}: REGROUP brought the phone to the host (${d.toFixed(1)} units apart, each screen's own rider)`);
    if (SHOTS) await B.screenshot({ path: `${SHOTS}/endless-${R.ground}-regroup-390.png` });
    // END on both: the ride banks on the same frame everywhere; both agree on the standings.
    for (const p of [A, B]) await p.keyboard.press("KeyE");
    await Promise.all([A, B].map((p) => until(p, () => game.getSnapshot().screen === "result" && game.getSnapshot().online?.phase === "over", null, `${R.name}: the result`)));
    const r = await Promise.all([A, B].map(snap));
    assert.deepEqual(r[0].online.standings, r[1].online.standings, "both agree on the standings");
    assert.ok(r.every((x) => x.online.desync === -1), "no desync");
    if (SHOTS) await B.screenshot({ path: `${SHOTS}/endless-${R.ground}-result-390.png` });
    console.log(`✓ ${R.name}: hosted at 1440, joined by link at 390, rode together in step, both on the board, REGROUP (${apart.toFixed(0)} → ${d.toFixed(1)} apart), END on both: standings ${r[0].online.standings} on both (${ms()})`);
    for (const p of [A, B]) await p.evaluate(() => game.leave()), await p.context().close();
  }
  assert.deepEqual(errors, [], "no page errors");
  console.log(`HOLESHOT online endless (every ground, Endless Wheelie City): green in ${ms()}`);
} catch (e) {
  if (errors.length) console.error("page errors:", errors);
  throw e;
} finally {
  await browser.close();
  rooms.close();
  await site.close();
}
