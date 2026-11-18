// The phone controls (Playwright touch at 390×844 and 844×390; desktop at 1440 for contrast):
// - the stick is the same size in both orientations (± 10%) and fully inside the screen with a buffer;
// - no standalone pad keys in any mode (no JUMP, no TRICK key): option actions are rocker bubbles;
// - the rocker's GAS and BRAKE zones are square, the seam ~44 px, each ≥ 44 px; the pill shorter than
//   the old 216 px; a held zone presses in (no drop shadow on it);
// - Endless Wheelie City: the TRICK bubble is hidden on flat ground and out in a wheelie past 10
//   o'clock; one uninterrupted touch gas → bubble → gas keeps the gas on and fires the trick; the HOP
//   bubble is out on the ground and gas → HOP → gas hops with the gas on; seam → HOP keeps both;
//   lifting lets everything go; Big Air's TRICK bubble is out in the air;
// - the corner keys fold into one ☰ key beside PAUSE (opens a column downward, closes on a second tap
//   or a tap outside); the chip bar sits against the top edge;
// - a card over the ride (pause, the result) hides the touch controls; the result card's keys fit;
// - desktop: no ☰ key, the row of keys as before.
// Waits on state, never on time alone. MEDIA=<dir> saves screenshots.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const MEDIA = process.env.MEDIA;
const full = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false, onTheme: () => {} }); game.setup({ starter: "sparkhound" });</script></body></html>`;
const server = await serve(".", { "/": full });
const browser = await chromium.launch(launchOptions());
const until = (p, fn, arg, what, timeout = 25000) => p.waitForFunction(fn, arg, { timeout, polling: 30 }).catch(() => assert.fail(`${what}: timed out`));
const R = () => document.querySelector("[data-fizlet-host]").shadowRoot;
const box = (p, sel) => p.evaluate((sel) => { const e = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, cx: b.x + b.width / 2, cy: b.y + b.height / 2 }; }, sel);
const out = (p, slot) => p.evaluate((s) => !!document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(`.hs-bub[data-slot="${s}"].hs-out`), slot);
const snap = (p) => p.evaluate(() => game.getSnapshot().run);
const sticks = {};

try {
  for (const [name, viewport] of [["390", { width: 390, height: 844 }], ["844", { width: 844, height: 390 }]]) {
    const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(server.url + "/");
    await until(p, () => window.game && game.getSnapshot().screen !== "setup", null, `${name}: mounts`);
    const cdp = await ctx.newCDPSession(p);
    const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
    // ---- every mode: no standalone pad keys ----
    for (const mode of ["race", "desert", "bigair", "endcity"]) {
      await p.evaluate((m) => game.start(m), mode);
      await until(p, () => game.run && !!game.getSnapshot().run.phase, null, `${name} ${mode}: starts`);
      const n = await p.evaluate(() => document.querySelector("[data-fizlet-host]").shadowRoot.querySelectorAll(".bui-pad button").length);
      assert.equal(n, 0, `${name} ${mode}: no standalone pad keys (no JUMP)`);
      await p.evaluate(() => game.leave()), await until(p, () => game.getSnapshot().screen === "result", null, `${name} ${mode}: left`);
    }
    await p.evaluate(() => game.start("endcity"));
    await until(p, () => game.run && game.getSnapshot().run.phase === "ready", null, `${name}: on the line`);
    // ---- the stick: size, inside the screen with a buffer ----
    const st = await box(p, ".bui-stick");
    sticks[name] = st.w;
    assert.ok(st.x >= 4 && st.y + st.h <= viewport.height - 8 && st.y >= 0, `${name}: the stick inside the screen with a buffer: ${JSON.stringify(st)}`);
    // ---- the rocker: square zones, the seam, the height ----
    const [rk, gz, sz, bz] = [await box(p, ".hs-rocker"), await box(p, ".hs-rz-gas"), await box(p, ".hs-rz-seam"), await box(p, ".hs-rz-brake")];
    assert.ok(Math.abs(gz.h - gz.w) <= 1 && Math.abs(bz.h - bz.w) <= 1, `${name}: GAS and BRAKE square (${gz.w}×${gz.h}, ${bz.w}×${bz.h})`);
    assert.ok(sz.h >= 40 && sz.h <= 48 && gz.h >= 44 && bz.h >= 44, `${name}: the seam about its size (${sz.h}), each zone ≥ 44`);
    if (name === "390") assert.ok(rk.h <= 216 * 0.92, `${name}: the pill shorter than before (${rk.h} vs 216)`);
    assert.ok(rk.y + rk.h <= viewport.height - 8 && rk.x + rk.w <= viewport.width - 4, `${name}: the pill inside with a buffer`);
    // ---- the corner keys: ☰ beside PAUSE; the column opens down, closes on a tap outside ----
    const k0 = await p.evaluate(() => { const r = document.querySelector("[data-fizlet-host]").shadowRoot, vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden"; return { more: vis(r.querySelector(".hs-more")), pause: vis(r.querySelector(".wc-menu")), set: [...r.querySelectorAll(".hs-keyset button")].filter(vis).length, label: r.querySelector(".hs-more").getAttribute("aria-label") }; });
    assert.ok(k0.more && k0.pause && k0.set === 0 && k0.label, `${name}: ☰ and PAUSE only, closed: ${JSON.stringify(k0)}`);
    const more = await box(p, ".hs-more");
    await p.evaluate(() => document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-more").click());
    const k1 = await p.evaluate(() => { const r = document.querySelector("[data-fizlet-host]").shadowRoot; return [...r.querySelectorAll(".hs-keyset button")].filter((e) => e.getClientRects().length).map((e) => { const b = e.getBoundingClientRect(); return { l: e.getAttribute("aria-label"), x: b.x, y: b.y, svg: !!e.querySelector("svg") }; }); });
    assert.ok(k1.length >= 3 && k1.every((k) => k.l && k.svg), `${name}: the column of icon keys with labels: ${JSON.stringify(k1)}`);
    assert.ok(k1.every((k, i) => k.y > more.y + more.h - 1 && (i === 0 || k.y > k1[i - 1].y)), `${name}: opened downward, one under another`);
    assert.equal(await p.evaluate(() => document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-more").getAttribute("aria-expanded")), "true");
    const m0 = await p.evaluate(() => document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".wc-mute").getAttribute("aria-pressed"));
    await p.evaluate(() => document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".wc-mute").click());
    assert.notEqual(await p.evaluate(() => document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".wc-mute").getAttribute("aria-pressed")), m0, `${name}: a key in the column works (mute flips its pressed state)`);
    if (MEDIA) await p.screenshot({ path: `${MEDIA}/menu-open-${name}.png` });
    await p.evaluate(() => document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".wc-mute").click());
    await touch("touchStart", [{ x: viewport.width / 2, y: viewport.height / 2, id: 9 }]), await touch("touchEnd", []);
    await until(p, () => document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-more").getAttribute("aria-expanded") === "false", null, `${name}: a tap outside closes it`);
    // ---- the chip bar against the top edge ----
    const head = await box(p, ".wc-head");
    assert.ok(head.y <= 12 && head.x + head.w <= more.x, `${name}: the chips up top, clear of the keys (${JSON.stringify(head)})`);
    // ---- riding: the HOP bubble on the ground, the TRICK bubble hidden ----
    const G = [gz.cx, gz.cy], S = [sz.cx, sz.cy];
    await touch("touchStart", [{ x: G[0], y: G[1], id: 1 }]);
    await until(p, () => game.getSnapshot().run.phase === "run" && game.getSnapshot().run.speed > 4 && game.getSnapshot().run.nose < 0.3, null, `${name}: rides on the gas`);
    await until(p, () => !!document.querySelector("[data-fizlet-host]").shadowRoot.querySelector('.hs-bub[data-slot="1"].hs-out'), null, `${name}: the HOP bubble out on the ground`);
    assert.equal(await out(p, 0), false, `${name}: the TRICK bubble hidden on flat ground`);
    assert.ok(await p.evaluate(() => !!document.querySelector("[data-fizlet-host]").shadowRoot.querySelector('.hs-slime[data-slot="1"]').getAttribute("d")), `${name}: its slime tether drawn`);
    const hb = await box(p, '.hs-bub[data-slot="1"]');
    assert.ok(hb.cx < G[0] && hb.x >= 0 && hb.y >= 0, `${name}: the HOP bubble off the pill's side, on screen`);
    if (MEDIA) await p.screenshot({ path: `${MEDIA}/hop-bubble-${name}.png` });
    // gas → HOP (never lifted): the gas stays on, the bike hops (a hop needs both wheels down that
    // step, as with the L key: slide off and on again until it goes, at most four times).
    await p.evaluate(() => { window.__air = false; const f = () => { if (game.getSnapshot().run?.air) window.__air = true; if (!window.__air) requestAnimationFrame(f); }; f(); });
    for (let i = 0; i < 4 && !(await p.evaluate(() => window.__air)); i++) {
      await touch("touchMove", [{ x: G[0], y: G[1], id: 1 }]);
      await touch("touchMove", [{ x: (G[0] + hb.cx) / 2, y: (G[1] + hb.cy) / 2, id: 1 }]);
      await touch("touchMove", [{ x: hb.cx, y: hb.cy, id: 1 }]);
      await p.waitForFunction(() => window.__air, null, { timeout: 1500, polling: 30 }).catch(() => {});
    }
    assert.ok(await p.evaluate(() => window.__air), `${name}: slid onto HOP: it hops`);
    assert.equal((await snap(p)).gas, 1, `${name}: the gas on while on the HOP bubble`);
    assert.equal(await p.evaluate(() => document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-rocker").dataset.zone), "1", `${name}: the gas zone stays lit`);
    await touch("touchMove", [{ x: G[0], y: G[1], id: 1 }]);
    await until(p, () => !game.getSnapshot().run.air && game.getSnapshot().run.gas === 1, null, `${name}: back on the gas`);
    // seam → HOP: gas and brake both kept.
    await touch("touchMove", [{ x: S[0], y: S[1], id: 1 }]);
    await until(p, () => game.getSnapshot().run.gas === 1 && game.getSnapshot().run.brake === 1, null, `${name}: the seam: both`);
    if (await out(p, 1)) {
      const hb2 = await box(p, '.hs-bub[data-slot="1"]');
      await touch("touchMove", [{ x: hb2.cx, y: hb2.cy, id: 1 }]);
      await until(p, () => game.getSnapshot().run.gas === 1 && game.getSnapshot().run.brake === 1 && document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-bub.hs-on"), null, `${name}: seam → HOP keeps gas and brake`);
    }
    await touch("touchEnd", []);
    await until(p, () => game.getSnapshot().run.gas === 0 && game.getSnapshot().run.brake === 0, null, `${name}: lifted: everything lets go`);
    assert.equal(await p.evaluate(() => !!document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-bub.hs-on")), false, `${name}: no bubble held`);
    // ---- a wheelie past 10 o'clock: the TRICK bubble; gas → TRICK → gas without lifting ----
    await p.evaluate(() => game.start("endcity"));
    await until(p, () => game.run && game.getSnapshot().run.phase === "ready", null, `${name}: again`);
    await touch("touchStart", [{ x: S[0], y: S[1], id: 1 }]);
    await p.waitForTimeout(500);
    await touch("touchMove", [{ x: G[0], y: G[1], id: 1 }]);
    await until(p, () => game.getSnapshot().run.nose > 0.6, null, `${name}: the nose up past 10 o'clock`);
    await until(p, () => !!document.querySelector("[data-fizlet-host]").shadowRoot.querySelector('.hs-bub[data-slot="0"].hs-out'), null, `${name}: the TRICK bubble out in the wheelie`);
    const tb = await box(p, '.hs-bub[data-slot="0"]');
    assert.ok(tb.cx < G[0] && tb.cy < G[1] && tb.y >= 0, `${name}: TRICK up and in from the gas (10 to 11 o'clock)`);
    assert.ok(tb.cy + tb.h / 2 < hb.cy - hb.h / 2 + 4 || tb.cx + tb.w / 2 < hb.cx - hb.w / 2, `${name}: TRICK and HOP never overlap`);
    if (MEDIA) await p.screenshot({ path: `${MEDIA}/trick-bubble-${name}.png` });
    await touch("touchMove", [{ x: (G[0] + tb.cx) / 2, y: (G[1] + tb.cy) / 2, id: 1 }]);
    assert.equal((await snap(p)).gas, 1, `${name}: the gas on on the way out`);
    await touch("touchMove", [{ x: tb.cx, y: tb.cy, id: 1 }]);
    await until(p, () => game.getSnapshot().run.stunt >= 0 || game.getSnapshot().run.crashes > 0, null, `${name}: on TRICK: the trick goes out`);
    const s1 = await snap(p);
    assert.ok(s1.stunt >= 0 && s1.gas === 1, `${name}: the trick out with the gas still on (${JSON.stringify({ stunt: s1.stunt, gas: s1.gas })})`);
    if (MEDIA) await p.screenshot({ path: `${MEDIA}/trick-held-${name}.png` });
    await touch("touchMove", [{ x: G[0], y: G[1], id: 1 }]);
    await until(p, () => game.getSnapshot().run.stunt < 0 && game.getSnapshot().run.gas === 1, null, `${name}: back on the gas: the trick in, the gas on`);
    await touch("touchEnd", []);
    await until(p, () => game.getSnapshot().run.gas === 0, null, `${name}: lifted`);
    // ---- the brake pressed in: no drop shadow on it ----
    const idle = await p.evaluate(() => getComputedStyle(document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-rz-brake")).boxShadow);
    await touch("touchStart", [{ x: bz.cx, y: bz.cy, id: 1 }]);
    await until(p, () => document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-rocker").dataset.zone === "2", null, `${name}: the brake held`);
    const pressed = await p.evaluate(() => [getComputedStyle(document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-rz-brake")).boxShadow, getComputedStyle(document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-rocker")).boxShadow]);
    assert.ok(idle !== "none" && pressed[0] === "none", `${name}: the brake presses in: lip ${idle} → ${pressed[0]}`);
    await touch("touchEnd", []);
    // ---- a card over the ride hides the controls; the result card's keys fit ----
    await p.evaluate(() => game.pause());
    await until(p, () => getComputedStyle(document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".bui-pad")).visibility === "hidden", null, `${name}: the pause card hides the touch controls`);
    await p.evaluate(() => game.resume());
    await until(p, () => getComputedStyle(document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".bui-pad")).visibility === "visible", null, `${name}: back on the ride, they are back`);
    await p.evaluate(() => game.leave());
    await until(p, () => game.getSnapshot().screen === "result", null, `${name}: the result`);
    const res = await p.evaluate(() => { const r = document.querySelector("[data-fizlet-host]").shadowRoot, card = r.querySelector(".dh-result").getBoundingClientRect(); return { pad: getComputedStyle(r.querySelector(".bui-pad")).visibility, keys: [...r.querySelectorAll(".dh-result .dh-row button")].map((b) => { const k = b.getBoundingClientRect(); return k.x >= card.x - 1 && k.right <= card.right + 1 && k.right <= innerWidth && k.width >= 44; }) }; });
    assert.equal(res.pad, "hidden", `${name}: no rocker over the result card`);
    assert.ok(res.keys.length >= 3 && res.keys.every(Boolean), `${name}: every key of the result card fits: ${JSON.stringify(res.keys)}`);
    if (MEDIA) await p.screenshot({ path: `${MEDIA}/result-${name}.png` });
    // ---- Big Air: the TRICK bubble out in the air ----
    await p.evaluate(() => game.start("bigair"));
    await until(p, () => game.run && !!game.getSnapshot().run.phase, null, `${name}: Big Air`);
    assert.equal(await out(p, 0), false, `${name}: Big Air: no TRICK on the run-in`);
    await p.evaluate(() => (game.run.auto = true));
    await until(p, () => game.getSnapshot().run.air > 0.3 && !!document.querySelector("[data-fizlet-host]").shadowRoot.querySelector('.hs-bub[data-slot="0"].hs-out'), null, `${name}: Big Air: TRICK out in the air`, 40000);
    if (MEDIA) await p.screenshot({ path: `${MEDIA}/bigair-trick-${name}.png` });
    await p.evaluate(() => game.leave());
    assert.deepEqual(errs, [], `${name}: no page errors`);
    await ctx.close();
    console.log(`ok ${name}: stick, rocker, bubbles, ☰ keys, chips up top, cards clear of the controls`);
  }
  const [a, b] = [sticks["390"], sticks["844"]];
  assert.ok(Math.abs(a - b) <= a * 0.1, `the stick the same size in both orientations (${a} vs ${b})`);
  // ---- desktop: no ☰, the row as before ----
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(server.url + "/");
  await until(p, () => window.game && game.getSnapshot().screen !== "setup", null, "desktop: mounts");
  await p.evaluate(() => game.start("endcity"));
  await until(p, () => game.run && !!game.getSnapshot().run.phase, null, "desktop: starts");
  const d = await p.evaluate(() => { const r = document.querySelector("[data-fizlet-host]").shadowRoot, vis = (e) => !!e && e.getClientRects().length > 0; return { more: vis(r.querySelector(".hs-more")), keys: [...r.querySelectorAll(".wc-keys button")].filter(vis).length, pad: vis(r.querySelector(".hs-rocker")) }; });
  assert.deepEqual(d, { more: false, keys: 5, pad: false }, "desktop: no ☰, five keys in the row, no touch controls");
  await ctx.close();
  console.log(`ok: the stick ${a} px in both orientations; desktop unchanged`);
} finally {
  await browser.close();
  await server.close();
}
