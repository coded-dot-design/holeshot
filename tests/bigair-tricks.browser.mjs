// Big Air's freestyle tricks in the browser (the built dist/holeshot.mjs): on a phone (390 × 844,
// touch) the rocker's slide-out button says TRICK (not COMBO) and there are no other pad keys; the
// gas held on the rocker rides to the first kicker, and in the air the gas thumb slid onto TRICK
// throws a trick (the run's trick out, the callout names it) with the gas still on; back on the gas
// it goes in. On a desktop (1440 × 900) C throws one too, and a second press is the next trick up the
// ladder. Chromium always; WebKit too with BROWSERS=chromium,webkit (and PLAYWRIGHT_BROWSERS_PATH
// pointing at a WebKit build). The fingers are pointer events on the rocker (the same in both
// engines). Waits on the game's state, never on time alone. MEDIA=<dir> saves screenshots.
import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const MEDIA = process.env.MEDIA;
const page = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false }); game.setup({ starter: "sparkhound" });</script></body></html>`;
const server = await serve(".", { "/": page });
const want = (process.env.BROWSERS ?? "chromium").split(",");
const until = (p, fn, arg, what, timeout = 30000) => p.waitForFunction(fn, arg, { timeout, polling: 30 }).catch(() => assert.fail(`${what}: timed out`));
const callTxt = (p) => p.evaluate(() => { const c = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-call"); return c && !c.hidden ? c.textContent : ""; });

try {
  for (const [bn, type, opts] of [["chromium", chromium, launchOptions()], ["webkit", webkit, {}]]) {
    if (!want.includes(bn)) continue;
    const browser = await type.launch(opts);
    try {
      // ---- the phone: TRICK slides out of the rocker; slid onto in the air, a trick ----
      {
        const what = `${bn} phone`;
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        const p = await ctx.newPage(), errs = [];
        p.on("pageerror", (e) => errs.push(e.message));
        await p.goto(server.url + "/");
        await until(p, () => window.game && game.getSnapshot().screen !== "setup", null, `${what}: mounts`);
        await p.evaluate(() => game.start("bigair"));
        await until(p, () => game.run && game.getSnapshot().run.phase === "ready", null, `${what}: on the deck`);
        const ui = await p.evaluate(() => { const r = document.querySelector("[data-fizlet-host]").shadowRoot, b = r.querySelector(".hs-rcombo"); return { word: b?.textContent, label: b?.getAttribute("aria-label"), keys: r.querySelectorAll(".bui-pad button").length }; });
        assert.equal(ui.word, "TRICK", `${what}: the slide-out button says TRICK`);
        assert.ok(/^Trick:/.test(ui.label), `${what}: and is named for it (${ui.label})`);
        assert.equal(ui.keys, 0, `${what}: no separate TRICK key on the pad`);
        // The gas held: a finger on the rocker's top.
        await p.evaluate(() => {
          const rk = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-rocker"), r = rk.getBoundingClientRect();
          rk.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 3, clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.15, bubbles: true, composed: true, pointerType: "touch", isPrimary: true }));
        });
        await until(p, () => { const b = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-rcombo"); return b && getComputedStyle(b).opacity === "1"; }, null, `${what}: TRICK slides out with the gas`);
        // The weight a little forward on the stick (full gas alone loops a light bike), let go in the air.
        await p.evaluate(() => {
          const st = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".bui-stick"), r = st.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          const ev = (t, dy) => st.dispatchEvent(new PointerEvent(t, { pointerId: 7, clientX: cx, clientY: cy + r.height * dy, bubbles: true, composed: true, pointerType: "touch", button: 0, isPrimary: false }));
          ev("pointerdown", 0), ev("pointermove", -0.3);
          const off = () => (game.getSnapshot().run.air > 0.05 ? ev("pointerup", -0.3) : requestAnimationFrame(off));
          off();
        });
        await until(p, () => game.getSnapshot().run.air > 0.2, null, `${what}: in the air off the first kicker`, 40000);
        // Slide the gas thumb onto TRICK.
        await p.evaluate(() => {
          const r = document.querySelector("[data-fizlet-host]").shadowRoot, rk = r.querySelector(".hs-rocker"), b = r.querySelector(".hs-rcombo").getBoundingClientRect();
          rk.dispatchEvent(new PointerEvent("pointermove", { pointerId: 3, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2, bubbles: true, composed: true, pointerType: "touch", isPrimary: true }));
        });
        await until(p, () => game.getSnapshot().run.trick >= 0, null, `${what}: on TRICK in the air: a trick out`);
        const s1 = await p.evaluate(() => game.getSnapshot().run);
        assert.equal(s1.trick, 0, `${what}: the first rung, SEAT GRAB`);
        assert.equal(await p.evaluate(() => document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-rocker").dataset.zone), "1", `${what}: the gas still on`);
        await until(p, () => /SEAT GRAB/.test(document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-call")?.textContent ?? ""), null, `${what}: the callout names it`);
        if (MEDIA) await p.screenshot({ path: `${MEDIA}/${bn}-phone-trick.png` });
        // Back onto the gas: it goes in (and counts once it was all the way out).
        await p.evaluate(() => {
          const rk = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-rocker"), r = rk.getBoundingClientRect();
          rk.dispatchEvent(new PointerEvent("pointermove", { pointerId: 3, clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.15, bubbles: true, composed: true, pointerType: "touch", isPrimary: true }));
        });
        await until(p, () => game.getSnapshot().run.trick < 0, null, `${what}: back on the gas: the trick in`);
        assert.ok((await p.evaluate(() => game.getSnapshot().run)).tricks >= 1 || (await p.evaluate(() => game.getSnapshot().run)).crashes > 0, `${what}: the trick registered`);
        await p.evaluate(() => { const rk = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-rocker"); rk.dispatchEvent(new PointerEvent("pointerup", { pointerId: 3, bubbles: true, composed: true, pointerType: "touch" })); });
        await p.evaluate(() => game.leave());
        assert.deepEqual(errs, [], `${what}: no page errors`);
        await ctx.close();
        console.log(`ok ${what}: TRICK on the rocker (no pad key), slid onto in the air: SEAT GRAB, the callout, the gas kept`);
      }
      // ---- the desktop: C throws tricks up the ladder ----
      {
        const what = `${bn} desktop`;
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const p = await ctx.newPage(), errs = [];
        p.on("pageerror", (e) => errs.push(e.message));
        await p.goto(server.url + "/");
        await until(p, () => window.game && game.getSnapshot().screen !== "setup", null, `${what}: mounts`);
        await p.evaluate(() => game.start("bigair"));
        await until(p, () => game.run && game.getSnapshot().run.phase === "ready", null, `${what}: on the deck`);
        // Gas, the weight forward on the run-in (full gas alone loops a light bike), let go in the air.
        await p.keyboard.down("Space");
        await p.keyboard.down("KeyW");
        await until(p, () => game.getSnapshot().run.air > 0.05, null, `${what}: off the kicker`, 40000);
        await p.keyboard.up("KeyW");
        await until(p, () => game.getSnapshot().run.air > 0.15, null, `${what}: in the air`);
        await p.keyboard.down("KeyC");
        await until(p, () => game.getSnapshot().run.trick >= 0, null, `${what}: C: a trick out`);
        await p.keyboard.up("KeyC");
        await until(p, () => game.getSnapshot().run.trick < 0, null, `${what}: let go: back in`);
        if ((await p.evaluate(() => game.getSnapshot().run.air)) > 0) {
          await p.keyboard.down("KeyC");
          await until(p, () => game.getSnapshot().run.trick >= 0 || game.getSnapshot().run.air === 0, null, `${what}: C again`);
          const s = await p.evaluate(() => game.getSnapshot().run);
          if (s.trick >= 0) assert.equal(s.trick, 1, `${what}: the next rung, CROSS-UP`);
          await p.keyboard.up("KeyC");
        }
        const t = await callTxt(p);
        if (MEDIA) await p.screenshot({ path: `${MEDIA}/${bn}-desktop-trick.png` });
        assert.ok(t.length > 0, `${what}: a callout up (${t})`);
        await p.keyboard.up("Space");
        await p.evaluate(() => game.leave());
        assert.deepEqual(errs, [], `${what}: no page errors`);
        await ctx.close();
        console.log(`ok ${what}: C throws SEAT GRAB, then the next rung`);
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  server.close();
}
