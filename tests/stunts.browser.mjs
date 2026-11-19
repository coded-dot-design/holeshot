// The stunts in Chromium (the built dist/holeshot.mjs), in both endless modes (the ENDLESS grounds
// and Endless Wheelie City) at 1440 (keyboard) and 390 (touch): ridden by hand, the combo trick goes
// out (C, or on a touch screen the COMBO button that slides out of the rocker's gas side while the
// gas is held: the gas thumb slid onto it, the gas still on) with the big callout (the trick's name),
// and let go it banks its points (the callout's +points, the score up). With MEDIA set, screenshots
// of the callout go there. Waits on state.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const MEDIA = process.env.MEDIA;
const full = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false }); game.setup({ starter: "sparkhound" });</script></body></html>`;
const server = await serve(".", { "/": full });
const browser = await chromium.launch(launchOptions());
const until = (p, fn, arg, what, timeout = 30000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const callTxt = (p) => p.evaluate(() => { const c = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-call"); return c && !c.hidden ? c.textContent : ""; });
const VIEWS = [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]];

try {
  for (const [name, viewport, touch] of VIEWS) {
    const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(server.url + "/");
    await until(p, () => window.game && game.getSnapshot().screen !== "setup", null, `${name}: mounts`);
    for (const mode of ["desert", "endcity"]) {
      const tag = `${name} ${mode}`;
      await p.evaluate((m) => game.start(m), mode);
      await until(p, () => game.getSnapshot().run && game.getSnapshot().run.phase === "ready", null, `${tag}: on the start line`);
      let cdp = null, gas = null, combo = null;
      if (touch) {
        cdp = await ctx.newCDPSession(p);
        gas = await p.evaluate(() => { const r = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-rocker").getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height * 0.15]; });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: gas[0], y: gas[1], id: 1 }] });
      } else await p.keyboard.down("Space");
      await until(p, () => game.getSnapshot().run.speed > 5, null, `${tag}: rides`);
      if (touch) {
        // The COMBO button is out (the gas is held): slide the gas thumb onto it.
        await until(p, () => { const b = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-rcombo"); return b && getComputedStyle(b).opacity === "1"; }, null, `${tag}: the COMBO button slides out with the gas`);
        combo = await p.evaluate(() => { const r = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-rcombo").getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, r.right <= innerWidth && r.top >= 0]; });
        assert.ok(combo[2], `${tag}: on screen`);
        assert.ok(combo[0] < gas[0] && combo[1] < gas[1], `${tag}: up and in from the gas (10 to 12 o'clock)`);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: combo[0], y: combo[1], id: 1 }] });
      } else await p.keyboard.down("KeyC");
      await until(p, () => game.getSnapshot().run.stunt >= 0, null, `${tag}: the combo trick is out`);
      await until(p, () => { const c = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-call"); return c && !c.hidden && /SEAT TAP/.test(c.textContent); }, null, `${tag}: the callout names it`);
      const s1 = (await p.evaluate(() => game.getSnapshot().run));
      assert.ok(s1.gas > 0 || s1.speed > 4, `${tag}: the gas still on`);
      await p.waitForTimeout(700);
      if (MEDIA) await p.screenshot({ path: `${MEDIA}/${name}-${mode}-trick.png` });
      if (touch) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: gas[0], y: gas[1], id: 1 }] });
      else await p.keyboard.up("KeyC");
      await until(p, () => game.getSnapshot().run.stunt < 0 && game.getSnapshot().run.score > 0, null, `${tag}: let go, it banks`);
      await until(p, () => { const c = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-call"); return c && !c.hidden && /\+\d/.test(c.textContent); }, null, `${tag}: the callout's points`);
      const t = await callTxt(p);
      assert.ok(/SEAT TAP/.test(t) && /\+\d/.test(t), `${tag}: the callout's points (${t})`);
      if (MEDIA) await p.screenshot({ path: `${MEDIA}/${name}-${mode}-banked.png` });
      // The next press is the next trick up the ladder.
      if (!touch) {
        await p.keyboard.down("KeyC");
        await until(p, () => { const c = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-call"); return c && !c.hidden && /KNEE KNOCKER/.test(c.textContent); }, null, `${tag}: next, the knee knocker`);
        await p.keyboard.up("KeyC");
        await p.keyboard.up("Space");
      } else await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await p.evaluate(() => game.leave());
    }
    assert.deepEqual(errs, [], `${name}: no page errors`);
    await ctx.close();
    console.log(`ok ${name}: the combo trick, its callout and points in both endless modes`);
  }
} finally {
  await browser.close();
  server.close();
}
