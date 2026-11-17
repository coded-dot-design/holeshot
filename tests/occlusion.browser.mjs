// Endless Wheelie City in Chromium: a building between the chase camera and the bike is ghosted.
// The owner's case: the bike just out from a tall building's front (a tower or the flats in the
// first town), riding away from it, so the building fills the screen in front of the camera. Render-sampled at 1440 and 390: the bike's pixels
// (where the frame with the rider differs from the one without, buildings hidden) are compared in the
// frame as drawn with the same frame drawn solid; at least 80 % of them must read as the bike, not the
// building. The tower is ghosted (its level in the probe); ridden clear, it is solid again.
// MEDIA=<dir> also saves the before (solid) and after (ghosted) frames.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const full = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false }); game.setup({ starter: "sparkhound" });</script></body></html>`;
const server = await serve(".", { "/": full });
const browser = await chromium.launch(launchOptions());
const MEDIA = process.env.MEDIA;
if (MEDIA) mkdirSync(MEDIA, { recursive: true });
const until = (p, fn, arg, what, timeout = 20000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));

/** Draw the frame four ways, read the pixels in the bike's box, and measure. */
const measure = (p) => p.evaluate(() => {
  const r = game.run.probe, cv = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas");
  const dpr = cv.width / cv.clientWidth, b = r.bikeBox(), x0 = Math.max(0, Math.floor(b[0] * dpr)), y0 = Math.max(0, Math.floor(b[1] * dpr)), x1 = Math.min(cv.width, Math.ceil(b[2] * dpr)), y1 = Math.min(cv.height, Math.ceil(b[3] * dpr));
  const w = x1 - x0, h = y1 - y0, c2 = document.createElement("canvas");
  c2.width = cv.width; c2.height = cv.height;
  const g = c2.getContext("2d", { willReadFrequently: true });
  const grab = (xr, rider) => (r.draw(xr, rider), g.clearRect(0, 0, c2.width, c2.height), g.drawImage(cv, 0, 0), g.getImageData(x0, y0, w, h).data);
  const A = grab(2, 1), B = grab(2, 0), C = grab(1, 1), D = grab(0, 1);
  const dist = (P, Q, i) => Math.abs(P[i] - Q[i]) + Math.abs(P[i + 1] - Q[i + 1]) + Math.abs(P[i + 2] - Q[i + 2]);
  let bikePx = 0, hidden = 0, seen = 0;
  for (let i = 0; i < A.length; i += 4) {
    if (dist(A, B, i) < 40) continue; // not the bike
    bikePx++;
    if (dist(C, A, i) < 40) continue; // not covered when solid
    hidden++;
    if (dist(D, A, i) < dist(D, C, i)) seen++;
  }
  r.draw(0, 1);
  return { bikePx, hidden, seen, solidCover: bikePx ? hidden / bikePx : 0, visible: bikePx ? (bikePx - hidden + seen) / bikePx : 0, ghosts: r.ghosts() };
});
const shot = async (p, xr, file) => {
  const png = await p.evaluate((xr) => (game.run.probe.draw(xr, 1), document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas").toDataURL("image/png")), xr);
  writeFileSync(file, Buffer.from(png.split(",")[1], "base64"));
};

try {
  for (const [name, viewport, touch] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]]) {
    for (const reduced of [false, true]) {
      const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, reducedMotion: reduced ? "reduce" : "no-preference" });
      const p = await ctx.newPage(), errs = [];
      p.on("pageerror", (e) => errs.push(e.message));
      await p.goto(server.url + "/");
      await until(p, () => window.game && game.getSnapshot().screen !== "setup", null, `${name}: mounts`);
      await p.evaluate(() => game.start("endcity"));
      await until(p, () => game.run && game.getSnapshot().run.phase === "ready", null, `${name}: on the line`);
      const tower = await p.evaluate(() => game.run.probe.towers()[0]);
      assert.ok(tower != null, `${name}: a tall building in the first town`);
      // ---- the owner's case: the tower right in front of the camera, the bike beyond it ----
      if (reduced) {
        await p.evaluate(([h, b]) => game.run.probe.behind(h, b), [tower, touch ? 1.6 : 0.6]);
        // Reduced motion: no fade, the next step has it ghosted.
        await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const g = await p.evaluate(() => game.run.probe.ghosts());
        assert.ok(g.length && g.every((v, i) => i % 2 === 0 || v === 100 || v === 200), `${name} reduced: at once: ${g}`);
        await ctx.close();
        continue;
      }
      // Three cases: the camera just behind the tower (ghosted, outlined), and the camera all but touching its back wall (gone: faded out completely), and the camera inside its volume (gone; drawn solid its walls cull, so only the fade is checked).
      const M = [];
      // (How far out from the front puts the camera just behind, touching and inside: the phone's chase camera sits further back.)
      // (On the phone the higher chase camera passes over the town's towers rather than through them:
      // only the ghosted case there.)
      const CASES = touch ? [[1.6, 100, "behind", 0.5]] : [[0.6, 100, "behind", 0.5], [2.5, 200, "touching", 0.25], [4, 200, "inside", 0]];
      for (const [back, lvl, tag, cover] of CASES) {
        await p.evaluate(([h, back]) => game.run.probe.behind(h, back), [tower, back]);
        await until(p, ([h, lvl]) => { const g = game.run.probe.ghosts(), i = g.indexOf(h); return i >= 0 && i % 2 === 0 && g[i + 1] === lvl; }, [tower, lvl], `${name}: ${tag}: the tower ${lvl === 100 ? "ghosts" : "goes"}`);
        const m = await measure(p);
        assert.ok(m.bikePx > 40, `${name}: ${tag}: the bike is on screen (${m.bikePx} px)`);
        assert.ok(m.solidCover >= cover, `${name}: ${tag}: drawn solid, the tower hides the bike (${(m.solidCover * 100).toFixed(0)} % covered): the case reproduces`);
        assert.ok(m.visible >= 0.8, `${name}: ${tag}: ghosted, the bike is ${(m.visible * 100).toFixed(0)} % visible (≥ 80 %)`);
        if (MEDIA) await shot(p, 1, `${MEDIA}/occlusion-${name}-${tag}-before.png`), await shot(p, 0, `${MEDIA}/occlusion-${name}-${tag}-after.png`);
        M.push(`${tag}: ${(m.visible * 100).toFixed(0)} % visible (solid: ${(m.solidCover * 100).toFixed(0)} % covered)`);
      }
      // ---- ridden clear (the bike out on the open street, facing along it): solid again ----
      await p.evaluate((h) => game.run.probe.behind(h, 22), tower);
      await until(p, (h) => !game.run.probe.ghosts().includes(h) || game.run.probe.ghosts().indexOf(h) % 2 === 1, tower, `${name}: the tower is solid again`);
      assert.deepEqual(errs, [], `${name}: no page errors`);
      console.log(`${name}: ${M.join(" · ")}; solid again when clear.`);
      await ctx.close();
    }
  }
  console.log("Occlusion: a building between the chase camera and the bike is ghosted (≥ 80 % of the bike visible), at once with reduced motion, solid again when clear; 1440 and 390.");
} finally {
  await browser.close();
  await server.close();
}
