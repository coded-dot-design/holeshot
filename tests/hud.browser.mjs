// No empty HUD boxes (the stray yellow pill): at rest in every mode, at 1440 (keyboard) and 390
// (touch), no element of the ride's HUD that shows a box (a background or a border) and holds
// nothing (no text, no icon) is visible over the play area. Waits on state.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const full = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false }); game.setup({ starter: "sparkhound" });</script></body></html>`;
const server = await serve(".", { "/": full });
const browser = await chromium.launch(launchOptions());
const until = (p, fn, arg, what, timeout = 20000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));

try {
  for (const [name, viewport, touch] of [["1440", { width: 1440, height: 900 }, false], ["390", { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(server.url + "/");
    await until(p, () => window.game && game.getSnapshot().screen !== "setup", null, `${name}: mounts`);
    for (const mode of ["race", "freeride", "desert", "bigair", "endcity"]) {
      await p.evaluate((m) => game.start(m), mode);
      await until(p, () => game.run && !!game.getSnapshot().run.phase && game.engine && true, null, `${name} ${mode}: starts`);
      // At rest: two frames drawn after the start (the HUD written).
      await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const empty = await p.evaluate(() => {
        const root = document.querySelector("[data-fizlet-host]").shadowRoot, hud = root.querySelector(".mt-hud,.ba-hud,.wc-hud");
        const out = [];
        for (const e of hud.querySelectorAll("*")) {
          const b = e.getBoundingClientRect();
          if (b.width < 2 || b.height < 2) continue;
          const cs = getComputedStyle(e);
          if (cs.visibility === "hidden" || +cs.opacity === 0) continue;
          let o = e, gone = false;
          for (; o && o !== hud; o = o.parentElement) if (+getComputedStyle(o).opacity === 0) gone = true;
          if (gone) continue;
          const boxy = (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent") || cs.backgroundImage !== "none" || parseFloat(cs.borderTopWidth) > 0;
          if (!boxy) continue;
          if (e.textContent.trim() || e.querySelector("svg,img,canvas") || e.matches("svg,img,canvas,button")) continue;
          // A child's own empty box inside a chip that holds text (a progress ring) is part of it.
          if (e.parentElement && e.parentElement !== hud && e.parentElement.textContent.trim() && e.closest("[class*='-chip']")) continue;
          out.push(`${e.tagName.toLowerCase()}.${e.className} ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}×${Math.round(b.height)}`);
        }
        return out;
      });
      assert.deepEqual(empty, [], `${name} ${mode}: no empty HUD boxes`);
      await p.evaluate(() => game.leave());
      await until(p, () => game.getSnapshot().screen === "result", null, `${name} ${mode}: left`);
    }
    assert.deepEqual(errs, [], `${name}: no page errors`);
    await ctx.close();
    console.log(`ok ${name}: no empty HUD boxes at rest in race, free ride, endless, big air, endless wheelie city`);
  }
} finally {
  await browser.close();
  await server.close();
}
