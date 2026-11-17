// Endless Wheelie City in Chromium (the built dist/holeshot.mjs), at 1440 (keyboard) and 390 (touch):
// it starts, draws and rides (the open world streamed round it: the ground, the roads, a town);
// the pad: a stick and HOP, gas and brake on the throttle rocker; on the start line it settles; ridden by hand
// (Space, or the rocker's GAS) it never sleeps; on the autopilot the heat rises and the neon patrol comes
// (the heat chip with its stars, the hint), the run rides out of the town's limits and loses them with
// the chase framing held, and the result pays the escapes (and the tickets, if it took any) and
// settles. Waits on state.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const full = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false }); game.setup({ starter: "sparkhound" });</script></body></html>`;
const server = await serve(".", { "/": full });
const browser = await chromium.launch(launchOptions());
const snap = (p) => p.evaluate(() => game.getSnapshot());
const until = (p, fn, arg, what, timeout = 30000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const frames = (p, n = 12) => p.evaluate(async (n) => { const f = () => game.engine.stats().frames + (game.run ? game.run.engine.stats().frames : 0), a = f(); for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r)); return f() - a; }, n);
const hud = (p) => p.evaluate(() => { const r = document.querySelector("[data-fizlet-host]").shadowRoot, q = (s) => r.querySelector(s); return { heat: q(".wc-heat").hidden ? "" : q(".wc-heat span").textContent, hint: q(".wc-hint").textContent, ticket: !q(".wc-ticket").hidden }; });
const VIEWS = [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]];

try {
  for (const [name, viewport, touch] of VIEWS) {
    const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(server.url + "/");
    await until(p, () => window.game && game.getSnapshot().screen !== "setup", null, `${name}: mounts`);
    // ---- it starts, draws and rides ----
    await p.evaluate(() => game.start("endcity"));
    let s0 = (await snap(p)).run;
    assert.deepEqual([s0.phase, s0.units, s0.stars], ["ready", 0, 0], `${name}: on the start line`);
    await until(p, () => game.run.engine.paused.includes("settled"), null, `${name}: waiting, it settles`);
    assert.equal(await frames(p), 0, `${name}: no frames on the start line`);
    await p.evaluate(() => (game.run.auto = true));
    await until(p, () => game.getSnapshot().run.phase === "run" && game.getSnapshot().run.speed > 2, null, `${name}: rides`);
    await p.waitForTimeout(800);
    s0 = (await snap(p)).run;
    assert.ok(s0.objects > 500 && s0.faces > 300 && s0.tiles >= 1 && s0.inTown, `${name}: the world is drawn round it, in the first town (${s0.objects} objects, ${s0.faces} faces)`);
    await p.evaluate(() => game.leave());
    // ---- by hand: the keys or the pad (a stick and three keys, as ever) ----
    await p.evaluate(() => game.start("endcity"));
    if (touch) {
      const pad = await p.evaluate(() => { const r = document.querySelector("[data-fizlet-host]").shadowRoot, keys = [...r.querySelectorAll(".wc-pad .bui-pad-keys button")].map((b) => b.getAttribute("aria-label")); return { stick: !!r.querySelector(".wc-pad .bui-pad-stick, .wc-pad [class*=stick]"), keys }; });
      assert.ok(pad.stick && pad.keys.length === 1 && /hop/i.test(pad.keys[0]), `${name}: the pad: a stick, HOP (gas and brake on the rocker): ${JSON.stringify(pad)}`);
      const gas = await p.evaluate(() => { const r = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-rocker").getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height * 0.15]; });
      const cdp = await ctx.newCDPSession(p);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: gas[0], y: gas[1], id: 1 }] });
      await until(p, () => game.getSnapshot().run.speed > 2, null, `${name}: the pad's GAS rides`);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await p.keyboard.down("Space");
      await until(p, () => game.getSnapshot().run.speed > 2, null, `${name}: Space rides`);
      await p.keyboard.up("Space");
    }
    assert.ok((await frames(p)) > 0, `${name}: riding, it never sleeps`);
    // ---- the chase: heat, a unit out, the run out of town, LOST THEM at the limits ----
    await p.evaluate(() => (game.run.auto = true));
    await until(p, () => game.getSnapshot().run.inTown, null, `${name}: in a town`, 90000);
    await p.evaluate(() => game.run.probe.heat(70));
    await until(p, () => game.getSnapshot().run.units > 0, null, `${name}: the patrol comes`, 90000);
    let h = await hud(p);
    assert.ok(/★/.test(h.heat) && /PATROL/.test(h.hint) && /OUT OF TOWN/.test(h.hint), `${name}: the heat chip and the hint: ${JSON.stringify(h)}`);
    const before = (await snap(p)).run;
    const cam = (await snap(p)).camera;
    await until(p, (e) => game.getSnapshot().run.escapes > e, before.escapes, `${name}: rode out of town and lost them`, 120000);
    const c1 = (await snap(p)).camera;
    let s = (await snap(p)).run;
    assert.ok(!s.inTown && s.units === 0, `${name}: lost them out of town: ${JSON.stringify({ inTown: s.inTown, units: s.units, heat: s.heat })}`);
    assert.ok(Math.abs(c1.dist - cam.dist) <= cam.dist * 0.08 && c1.fov === cam.fov, `${name}: the chase framing holds (${cam.dist} → ${c1.dist})`);
    h = await hud(p);
    // ---- END banks it (Free Ride's pay with its kilometres); the summary has the escapes; it settles ----
    await p.evaluate(() => game.finish());
    await until(p, () => game.getSnapshot().screen === "result", null, `${name}: the session ends`, 30000);
    const r = (await snap(p)).result;
    assert.ok(r.finished && r.credits > 0, `${name}: pays ${r.credits}`);
    const lines = await p.evaluate(() => [...document.querySelector("[data-fizlet-host]").shadowRoot.querySelectorAll(".dh-pay li span")].map((e) => e.textContent));
    assert.ok(lines.some((l) => /KM/.test(l)), `${name}: the distance pays: ${lines.join(" · ")}`);
    const sub = await p.evaluate(() => document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".dh-result .dh-sub").textContent);
    assert.ok(/escape/.test(sub) && /town/.test(sub), `${name}: the summary says it: ${sub}`);
    await until(p, () => game.run.engine.paused.includes("settled") && game.engine.paused.includes("settled"), null, `${name}: the result settles`, 30000);
    assert.equal(await frames(p), 0, `${name}: result: no frames`);
    assert.deepEqual(errs, [], `${name}: no page errors`);
    await ctx.close();
  }
  console.log("Endless Wheelie City: starts, draws and rides the open world; the pad as ever; settles at the start; the heat, the neon patrol, riding out of town loses them with the camera held; the payout; the result settles; 1440 and 390.");
} finally {
  await browser.close();
  await server.close();
}
