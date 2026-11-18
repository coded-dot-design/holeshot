// The stunts in Chromium (the built dist/holeshot.mjs), in both endless modes (the ENDLESS grounds
// and Endless Wheelie City) at 1440 (keyboard) and 390 (touch): ridden by hand, the combo trick goes
// out (C, or on a touch screen the TRICK bubble that pops out of the rocker in a wheelie: the gas
// thumb slid onto it without lifting, the gas still on) with the big callout (the trick's name),
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
      let cdp = null, gas = null, combo = null, seam = null;
      if (touch) {
        cdp = await ctx.newCDPSession(p);
        gas = await p.evaluate(() => { const r = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-rocker").getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height * 0.15]; });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: gas[0], y: gas[1], id: 1 }] });
      } else await p.keyboard.down("Space");
      await until(p, () => game.getSnapshot().run.speed > 5, null, `${tag}: rides`);
      if (touch) {
        // The TRICK bubble pops out of the rocker only when a trick is on: lift the nose past 10 o'clock
        // (a second finger pulls the stick back), then slide the gas thumb onto it (the gas stays on).
        const stick = await p.evaluate(() => { const r = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".bui-stick").getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, r.height]; });
        assert.equal(await p.evaluate(() => !!document.querySelector("[data-fizlet-host]").shadowRoot.querySelector('.hs-bub[data-slot="0"].hs-out')), false, `${tag}: no TRICK bubble on flat ground`);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: gas[0], y: gas[1], id: 1 }, { x: stick[0], y: stick[1], id: 2 }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: gas[0], y: gas[1], id: 1 }, { x: stick[0], y: stick[1] + stick[2] * 0.45, id: 2 }] });
        await until(p, () => !!document.querySelector("[data-fizlet-host]").shadowRoot.querySelector('.hs-bub[data-slot="0"].hs-out'), null, `${tag}: the TRICK bubble pops out in the wheelie`);
        combo = await p.evaluate(() => { const r = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector('.hs-bub[data-slot="0"]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, r.right <= innerWidth && r.top >= 0]; });
        assert.ok(combo[2], `${tag}: on screen`);
        assert.ok(combo[0] < gas[0] && combo[1] < gas[1], `${tag}: up and in from the gas (10 to 11 o'clock)`);
        // The thumb rolls onto the seam (gas and the feathering brake: the wheelie held), then out onto
        // the bubble: both stay on while it is there.
        seam = await p.evaluate(() => { const r = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-rz-seam").getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: seam[0], y: seam[1], id: 1 }, { x: stick[0], y: stick[1], id: 2 }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: combo[0], y: combo[1], id: 1 }, { x: stick[0], y: stick[1], id: 2 }] });
        await until(p, () => game.getSnapshot().run.stunt >= 0, null, `${tag}: on the bubble, the trick goes out`);
        const both = await p.evaluate(() => [game.getSnapshot().run.gas, game.getSnapshot().run.brake]);
        assert.ok(both[0] > 0 && both[1] > 0, `${tag}: seam → bubble keeps gas and brake (${both})`);
        // The stick back to the middle (the nose down again); the thumb stays on the bubble.
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: combo[0], y: combo[1], id: 1 }, { x: stick[0], y: stick[1], id: 2 }] });
        // The stick finger up (CDP's touchEnd names the points that lift); the thumb stays on the bubble.
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [{ x: stick[0], y: stick[1], id: 2 }] });
      } else await p.keyboard.down("KeyC");
      await until(p, () => game.getSnapshot().run.stunt >= 0, null, `${tag}: the combo trick is out`);
      await until(p, () => { const c = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-call"); return c && !c.hidden && /SEAT TAP/.test(c.textContent); }, null, `${tag}: the callout names it`);
      const s1 = (await p.evaluate(() => game.getSnapshot().run));
      assert.ok(s1.gas > 0 || s1.speed > 4, `${tag}: the gas still on`);
      await p.waitForTimeout(touch ? 400 : 700);
      if (MEDIA) await p.screenshot({ path: `${MEDIA}/${name}-${mode}-trick.png` });
      // Back onto the seam (the wheelie still fed and feathered): the trick comes in.
      if (touch) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: seam[0], y: seam[1], id: 1 }] });
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
