// Test credits in Chromium (the built dist/holeshot.mjs), at 1440 and 390: from a saved profile,
// ?credits=inf shows ◈ ∞ and the TEST CREDITS ∞ chip; the showroom sells every bike (tier 3-4 too)
// and each one is bought in turn, every mod on it maxed, a ride banked, and the credits never move;
// ONLINE is off; the export code is the saved profile's; ?money=inf does the same; and the saved
// profile is byte for byte what it was. Then the same device without the param: the real credits,
// no chip, the locks back, ONLINE on, and a purchase costs and saves as before.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const page = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false });</script></body></html>`;
const server = await serve(".", { "/": page });
const browser = await chromium.launch(launchOptions());
const SAVE = JSON.stringify({
  v: 5, name: "KIP", credits: 6000, ride: 0, owned: [], pit: 0, stats: { events: 3, wins: 0, earned: 900, best: {}, far: {} },
  kit: { helmet: "peak", helmetPaint: "white", visor: "smoke", jersey: "lime", pants: "ink", pattern: "stripe", boots: "white", gloves: "ink" },
  bikes: [{ uid: "b1", model: "sparkhound", parts: { tyres: 1, chain: 1, motor: 1, susp: 1, brakes: 1 }, look: { paint: "acid", number: 23 }, odo: 3000, events: 3 }],
});
const KEY = "holeshot:profile";
const root = "document.querySelector('[data-fizlet-host]').shadowRoot";
const $ = (p, fn, arg) => p.evaluate(`((root, arg) => (${fn}))(${root}, ${JSON.stringify(arg ?? null)})`);
const click = (p, sel) => $(p, "root.querySelector(arg).click()", sel);
const until = (p, fn, what, timeout = 20000) => p.waitForFunction(`((root) => (${fn}))(${root})`, null, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const saved = (p) => p.evaluate((k) => localStorage.getItem(k), KEY);
const snap = (p) => p.evaluate(() => game.getSnapshot());
const MAX = 9_999_999;

try {
  for (const [name, viewport, touch] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript(([k, s]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, s); }, [KEY, SAVE]);
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    // ---- the real profile first: its export code ----
    await p.goto(server.url + "/");
    await until(p, "window.game && game.getSnapshot().screen === 'garage'", `${name}: the saved profile loads`);
    const realCode = await p.evaluate(() => game.exportCode());
    assert.equal(await saved(p), SAVE, `${name}: loading writes nothing`);

    // ---- with ?credits=inf ----
    for (const q of ["?credits=inf", "?money=inf"]) {
      await p.goto(server.url + "/" + q);
      await until(p, "window.game && game.getSnapshot().screen === 'garage'", `${name} ${q}: loads`);
      assert.equal((await snap(p)).testCredits, true);
      assert.equal((await snap(p)).credits, MAX);
      assert.equal(await $(p, "root.querySelector('.dh-cr').textContent.trim()"), "◈ ∞", `${name} ${q}: ∞ credits`);
      assert.equal(await $(p, "root.querySelector('.dh-test').textContent.trim()"), "TEST CREDITS ∞", `${name} ${q}: the chip`);
      // The showroom: every bike for sale, each bought in turn (a full garage trades in), every mod maxed.
      await until(p, "game.getSnapshot().screen === 'garage'", `${name}: garage`);
      await click(p, "[data-gtab=showroom]");
      assert.equal(await $(p, "root.querySelectorAll('[data-locked]').length"), 0, `${name}: nothing locked`);
      const ids = await $(p, "[...new Set([...root.querySelectorAll('[data-bike]')].map((b) => b.dataset.bike))]");
      assert.ok(ids.length >= 16, `${name}: every model listed (${ids.length})`);
      for (const id of ids) {
        await click(p, `[data-bike="${id}"]`);
        const s = await snap(p);
        assert.equal(s.bike.model, id, `${name}: bought ${id}`);
        assert.equal(s.credits, MAX, `${name}: buying ${id} cost nothing`);
        assert.equal(await $(p, "root.querySelector('.dh-cr').textContent.trim()"), "◈ ∞");
      }
      await click(p, "[data-gtab=bike]");
      for (let i = 0; i < 12; i++) {
        const any = await $(p, "(() => { const b = root.querySelector('[data-mod]:not([disabled])'); if (b) b.click(); return !!b; })()");
        if (!any) break;
      }
      assert.equal(await $(p, "root.querySelectorAll('[data-mod]:not([disabled])').length"), 0, `${name}: every mod maxed`);
      assert.equal((await snap(p)).credits, MAX, `${name}: mods cost nothing`);
      // ONLINE is off.
      await click(p, "[data-go=ride]");
      assert.equal(await $(p, "root.querySelector('.ol-open').disabled"), true, `${name}: ONLINE is off`);
      await p.evaluate(() => game.online());
      assert.equal((await snap(p)).screen, "ride", `${name}: the room card stays shut`);
      // A ride banks, and still nothing is saved.
      await p.evaluate(() => game.start("freeride"));
      // (The last bike bought is a street bike: on the dirt it asks first. RIDE ANYWAY.)
      assert.match(await $(p, "root.querySelector('.dh-risk')?.textContent ?? ''"), /Street bike on dirt\? It won't perform well\./, `${name}: the street bike's warning`);
      await click(p, ".dh-risk-go");
      await until(p, "game.getSnapshot().screen === 'event'", `${name}: ride`);
      await p.waitForTimeout(400);
      await p.evaluate(() => game.finish());
      await until(p, "game.getSnapshot().screen === 'result'", `${name}: result`);
      assert.equal((await snap(p)).credits, MAX);
      assert.equal(await p.evaluate(() => game.exportCode()), realCode, `${name}: the export code is the saved profile's`);
      assert.equal(await saved(p), SAVE, `${name} ${q}: the saved profile is byte for byte as it was`);
    }

    // ---- without the param: as before ----
    await p.goto(server.url + "/");
    await until(p, "window.game && game.getSnapshot().screen === 'garage'", `${name}: loads again`);
    const s0 = await snap(p);
    assert.equal(s0.testCredits, false);
    assert.equal(s0.credits, 6000, `${name}: the real credits`);
    assert.equal(s0.bikes, 1);
    assert.equal(s0.bike.model, "sparkhound");
    assert.equal(await $(p, "root.querySelector('.dh-test')"), null, `${name}: no chip`);
    assert.equal(await $(p, "root.querySelector('.dh-cr').textContent.trim()"), "◈ 6,000");
    assert.equal(await p.evaluate(() => game.exportCode()), realCode);
    await click(p, "[data-go=ride]");
    assert.equal(await $(p, "root.querySelector('.ol-open').disabled"), false, `${name}: ONLINE on`);
    await click(p, "[data-go=garage]");
    await click(p, "[data-gtab=showroom]");
    assert.ok(await $(p, "root.querySelectorAll('[data-locked]').length") > 0, `${name}: tier 3-4 locked again`);
    await click(p, "[data-gtab=bike]");
    await click(p, "[data-mod=power]");
    assert.equal((await snap(p)).credits, 5250, `${name}: stage 1 costs 750`);
    assert.equal(JSON.parse(await saved(p)).credits, 5250, `${name}: and is saved`);
    assert.deepEqual(errs, [], `${name}: no page errors`);
    await ctx.close();
    console.log(`ok ${name}: test credits (every bike bought, mods maxed, saved profile untouched), and without the param as before`);
  }
} finally {
  await browser.close();
  await server.close();
}
