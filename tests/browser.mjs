// Dirt Hop in Chromium (the built dist/dirt-hop.mjs), at 1440 (keyboard and mouse) and 390 (touch):
// a new rider gets the first-run setup (a starter of each class, paint, jersey, name, number; every
// key 44 px or more), picks a bike with clicks and lands in the garage with the bike drawn; RIDE →
// RACE starts the gate on that bike; the keys (Space) or the pad's GAS ride it; P or ❚❚ pauses (the
// clock holds) and RESUME goes on; the autopilot finishes the race and the result pays and wears the
// bike; NEW SET in the garage buys tyres; Free Ride (END banks it), Big Air and Wheelie City each
// start and end on the same bike and pay; leaving mid-event pays nothing and still wears; a reload
// keeps the garage; the export code moves it to a fresh device. The camera: fixed chase framing,
// and at 390 a phone's URL bar coming and going (height-only resizes) never refits it; a double tap
// on the play surface never zooms the page (visualViewport.scale stays 1). Reduced motion still
// plays; dropped onto a page (no host) Escape gives the page back byte for byte. Waits on state.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";
import { START_CREDITS } from "../src/data/economy.ts";

const fixture = readFileSync("tests/fixtures/page.html", "utf8");
const full = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dirt Hop</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createDirtHop } from "/dist/dirt-hop.mjs"; window.game = createDirtHop({ host: document.getElementById("game"), seed: 5, sound: false });</script></body></html>`;
const dropIn = fixture.replace("</body>", `<script type="module">import { createDirtHop } from "/dist/dirt-hop.mjs"; window.game = createDirtHop({ seed: 2, sound: false });</script></body>`);
const server = await serve(".", { "/": full, "/drop": dropIn, "/plain": fixture });
const browser = await chromium.launch(launchOptions());
const snap = (p) => p.evaluate(() => game.getSnapshot());
const until = (p, fn, arg, what, timeout = 30000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const click = (p, sel, i = 0) => p.evaluate(([s, i]) => document.querySelector("[data-fizlet-host]").shadowRoot.querySelectorAll(s)[i].click(), [sel, i]);
const VIEWS = [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]];

try {
  for (const [name, viewport, touch] of VIEWS) {
    const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(server.url + "/");
    await until(p, () => window.game, null, `${name}: mounts`);
    // ---- first run ----
    const setup = await p.evaluate(() => {
      const root = document.querySelector("[data-fizlet-host]").shadowRoot, r = (e) => e.getBoundingClientRect();
      const keys = [...root.querySelectorAll(".dh-pick>span, .dh-sw>span, .dh-go, .dh-field input")].filter((e) => e.offsetParent || e.getClientRects().length);
      return { screen: game.getSnapshot().screen, starters: root.querySelectorAll("input[name=starter]").length, big: keys.every((k) => Math.min(r(k).width, r(k).height) >= 44), sideways: root.querySelector(".dh-cards").scrollWidth > innerWidth + 1 };
    });
    assert.deepEqual(setup, { screen: "setup", starters: 4, big: true, sideways: false }, `${name}: the setup, four starters, keys ≥ 44 px, no sideways scroll`);
    await p.evaluate(() => {
      const root = document.querySelector("[data-fizlet-host]").shadowRoot;
      root.querySelector("input[value=sparkhound]").click();
      root.querySelector("input[name=paint][value=acid]").click();
      root.querySelector("input[name=name]").value = "kip";
      root.querySelector("input[name=number]").value = "23";
      root.querySelector(".dh-go").click();
    });
    await until(p, () => game.getSnapshot().screen === "garage", null, `${name}: to the garage`);
    let s = await snap(p);
    assert.deepEqual([s.bike.model, s.bike.number, s.credits, s.bikes], ["sparkhound", 23, START_CREDITS, 1], `${name}: one starter, its number, the start credits`);
    await until(p, () => { const c = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".dh-preview"), d = c.getContext("2d").getImageData(c.width >> 1, c.height >> 1, 1, 1).data; return c.width > 50 && d[3] === 255; }, null, `${name}: the garage draws the bike`);
    // ---- a race, by hand then on the autopilot ----
    await click(p, "[data-go=ride]");
    await click(p, "[data-mode=race]");
    s = await snap(p);
    assert.deepEqual([s.screen, s.mode, s.run.phase], ["event", "race", "grid"], `${name}: RACE: the gate`);
    await until(p, () => game.getSnapshot().run.phase === "run", null, `${name}: the gate drops`);
    if (!touch) {
      await p.keyboard.down("Space");
      await until(p, () => game.getSnapshot().run.speed > 3, null, `${name}: Space rides`);
      await p.keyboard.up("Space");
      await p.keyboard.press("KeyP");
    } else {
      const gas = await p.evaluate(() => { const b = [...document.querySelector("[data-fizlet-host]").shadowRoot.querySelectorAll(".bui-pad button")].find((x) => /gas/i.test(x.getAttribute("aria-label") || x.title || x.textContent)), r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
      const cdp = await ctx.newCDPSession(p);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: gas[0], y: gas[1], id: 1 }] });
      await until(p, () => game.getSnapshot().run.speed > 3, null, `${name}: the pad's GAS rides`);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await click(p, ".mt-menu");
    }
    await until(p, () => game.getSnapshot().status === "paused", null, `${name}: paused`);
    const c0 = (await snap(p)).run.clock;
    await p.waitForTimeout(400);
    assert.equal((await snap(p)).run.clock, c0, `${name}: the clock holds while paused`);
    await click(p, ".dh-resume");
    await until(p, () => game.getSnapshot().status === "running", null, `${name}: resumed`);
    const cam0 = (await snap(p)).camera;
    await p.evaluate(() => (game.run.auto = true));
    await until(p, () => game.getSnapshot().screen === "result", null, `${name}: the autopilot finishes the race`, 120000);
    s = await snap(p);
    assert.ok(s.result.finished && s.result.credits >= 130 && s.credits === START_CREDITS + s.result.credits, `${name}: the race pays (${s.result.credits})`);
    assert.ok(Object.values(s.bike.parts).every((v) => v < 1), `${name}: and wears every part`);
    // ---- the garage: new tyres ----
    await click(p, ".dh-result [data-go=garage]");
    const before = await snap(p);
    await click(p, "[data-service=tyres]");
    s = await snap(p);
    assert.equal(s.bike.parts.tyres, 1, `${name}: NEW SET`);
    assert.ok(s.credits < before.credits, `${name}: paid for`);
    // ---- the other modes, each on the same bike ----
    for (const id of ["freeride", "bigair", "wheelie"]) {
      const pre = await snap(p);
      await p.evaluate((id) => game.start(id, { auto: true }), id);
      await until(p, () => game.getSnapshot().run && game.getSnapshot().run.speed > 2, null, `${name}: ${id} rides`);
      // The chase framing holds: no zoom with speed or air (within 8 %).
      const d0 = (await snap(p)).camera.dist;
      await p.waitForTimeout(1500);
      const d1 = (await snap(p)).camera.dist;
      assert.ok(Math.abs(d1 - d0) <= d0 * 0.08, `${name}: ${id}: the chase distance holds (${d0.toFixed(2)} → ${d1.toFixed(2)})`);
      if (id === "freeride") await until(p, () => game.run.state.clock > 6, null, `${name}: free riding`), await click(p, ".mt-end");
      else await p.evaluate(() => game.finish());
      await until(p, () => game.getSnapshot().screen === "result", null, `${name}: ${id} ends`, 60000);
      s = await snap(p);
      assert.ok(s.result.finished && s.result.credits > 0, `${name}: ${id} pays (${s.result.credits})`);
      assert.equal(s.bike.model, "sparkhound", `${name}: ${id} on the player's bike`);
      assert.ok(s.bike.parts.tyres < pre.bike.parts.tyres, `${name}: ${id} wears it`);
    }
    // ---- Free Ride's maps: RIDE → FREE RIDE opens the picker; each open map rides, holds its camera, banks and pays ----
    await click(p, ".dh-result [data-go=ride]");
    await click(p, "[data-mode=freeride]");
    const pick = await p.evaluate(() => {
      const root = document.querySelector("[data-fizlet-host]").shadowRoot, keys = [...root.querySelectorAll(".dh-mapk")];
      return { screen: game.getSnapshot().screen, maps: keys.map((k) => k.dataset.map), big: keys.every((k) => Math.min(k.getBoundingClientRect().width, k.getBoundingClientRect().height) >= 44), sideways: root.querySelector(".dh-cards").scrollWidth > innerWidth + 1 };
    });
    assert.deepEqual(pick, { screen: "maps", maps: ["neon-park", "dune-sea", "quarry", "forest", "night-park"], big: true, sideways: false }, `${name}: the map picker`);
    await until(p, () => [...document.querySelector("[data-fizlet-host]").shadowRoot.querySelectorAll(".dh-mapv")].every((c) => c.width > 30 && c.getContext("2d").getImageData(c.width >> 1, c.height >> 1, 1, 1).data[3] === 255), null, `${name}: every map's preview is drawn`);
    await click(p, "[data-map=forest]");
    s = await snap(p);
    assert.deepEqual([s.screen, s.mode, s.run.map, s.run.phase], ["event", "freeride", "forest", "ready"], `${name}: a map key starts it`);
    assert.equal(await p.evaluate(() => document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".mt-pos span").textContent), "FOREST ENDURO", `${name}: the HUD names the map`);
    await p.evaluate(() => game.leave());
    for (const id of ["dune-sea", "quarry", "forest", "night-park"]) {
      const pre = await snap(p);
      await p.evaluate((id) => game.start("freeride", { map: id, auto: true }), id);
      await until(p, () => game.getSnapshot().run.speed > 2, null, `${name}: ${id} rides`);
      const d0 = (await snap(p)).camera.dist;
      await until(p, () => game.run.state.clock > 5, null, `${name}: ${id}: five seconds`);
      const d1 = (await snap(p)).camera.dist;
      assert.ok(Math.abs(d1 - d0) <= d0 * 0.08, `${name}: ${id}: the chase distance holds (${d0.toFixed(2)} → ${d1.toFixed(2)})`);
      if (touch && id === "night-park")
        for (const h of [780, 844, 760, 844]) {
          await p.setViewportSize({ width: 390, height: h });
          await p.waitForTimeout(260);
          const c = (await snap(p)).camera;
          assert.ok(Math.abs(c.dist - d0) <= d0 * 0.08, `${name}: ${id}: height ${h}: the chase framing holds (${c.dist} vs ${d0})`);
        }
      if (touch) await p.setViewportSize(viewport);
      await click(p, ".mt-end");
      await until(p, () => game.getSnapshot().screen === "result", null, `${name}: ${id}: END banks it`);
      s = await snap(p);
      assert.ok(s.result.finished && s.result.credits > 0 && s.credits === pre.credits + s.result.credits, `${name}: ${id} pays (${s.result.credits})`);
      assert.ok(s.bike.parts.tyres < pre.bike.parts.tyres, `${name}: ${id} wears the bike`);
    }
    // ---- leaving mid-event ----
    const pre = await snap(p);
    await p.evaluate(() => game.start("race", { auto: true }));
    await until(p, () => game.getSnapshot().run.phase === "run" && game.getSnapshot().run.speed > 4, null, `${name}: racing`);
    await p.evaluate(() => (game.pause(), game.leave()));
    s = await snap(p);
    assert.ok(s.screen === "result" && !s.result.finished && s.result.credits === 0 && s.credits === pre.credits, `${name}: left: no pay`);
    assert.ok(s.bike.parts.tyres < pre.bike.parts.tyres, `${name}: left: the wear still counts`);
    // ---- the camera: fixed framing; URL-bar resizes don't refit it; no page zoom ----
    if (touch) {
      await p.evaluate(() => game.start("race"));
      await until(p, () => game.getSnapshot().run.phase === "run", null, `${name}: racing again`);
      await p.evaluate(() => (game.run.auto = true));
      const cam = (await snap(p)).camera;
      for (const h of [780, 844, 760, 844, 790]) {
        await p.setViewportSize({ width: 390, height: h });
        await p.waitForTimeout(260);
        const c = (await snap(p)).camera;
        assert.ok(Math.abs(c.dist - cam.dist) <= cam.dist * 0.08 && c.fov === cam.fov, `${name}: height ${h}: the chase framing holds (${c.dist} vs ${cam.dist})`);
      }
      await p.setViewportSize(viewport);
      const box = await p.evaluate(() => { const r = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".mt-play").getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 3]; });
      await p.touchscreen.tap(box[0], box[1]);
      await p.touchscreen.tap(box[0], box[1]);
      await p.waitForTimeout(400);
      const z = await p.evaluate(() => ({ scale: visualViewport.scale, ta: getComputedStyle(document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".mt-play")).touchAction, cv: getComputedStyle(document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".dh-mode canvas")).touchAction }));
      assert.deepEqual(z, { scale: 1, ta: "none", cv: "none" }, `${name}: no pinch or double-tap zoom on the play surface`);
      await p.evaluate(() => game.leave());
    } else assert.ok(cam0.dist > 8 && cam0.dist < 13, `${name}: the chase distance (${cam0.dist})`);
    // ---- a reload keeps the garage; the code moves it ----
    const code = await p.evaluate(() => game.exportCode());
    const credits = (await snap(p)).credits;
    await p.reload();
    await until(p, () => window.game && game.getSnapshot().screen === "menu", null, `${name}: reload: the menu (no setup)`);
    assert.equal((await snap(p)).credits, credits, `${name}: reload keeps the credits`);
    const other = await browser.newContext({ viewport });
    const q = await other.newPage();
    await q.goto(server.url + "/");
    await until(q, () => window.game && game.getSnapshot().screen === "setup", null, `${name}: a fresh device`);
    await q.evaluate((c) => game.importCode(c), code);
    assert.equal((await snap(q)).credits, credits, `${name}: the code moves the garage`);
    await other.close();
    assert.deepEqual(errs, [], `${name}: no page errors`);
    await ctx.close();
  }

  // Reduced motion still plays.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
    const p = await ctx.newPage();
    await p.goto(server.url + "/");
    await until(p, () => window.game, null, "reduced: mounts");
    await p.evaluate(() => (game.setup({ starter: "anvil" }), game.start("bigair", { auto: true })));
    await until(p, () => game.getSnapshot().run.speed > 3, null, "reduced motion: Big Air rides");
    await ctx.close();
  }
  // Dropped onto a page: Escape (off an event) gives the page back byte for byte; no frames after.
  {
    const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await p.goto(server.url + "/plain");
    const html = await p.evaluate(() => document.documentElement.outerHTML);
    await p.goto(server.url + "/drop");
    await until(p, () => window.game && game.getSnapshot().screen === "setup", null, "drop-in: mounts over the page");
    await p.keyboard.press("Escape");
    await until(p, () => game.getSnapshot().status === "destroyed", null, "Escape: Recall");
    const after = await p.evaluate(() => { document.querySelectorAll("script[type=module]").forEach((s) => s.remove()); return document.documentElement.outerHTML; });
    assert.equal(after, html.replace(/<script type="module">[\s\S]*?<\/script>/g, ""), "the page comes back byte for byte");
    await p.close();
  }
  console.log("Dirt Hop: setup, garage, a race by keys and touch, pause, the payout and the wear, tyres, Free Ride, Big Air, Wheelie City on the same bike, the map picker and each open map (rides, holds its camera, banks, pays), leaving, reload and the export code, a fixed camera through URL-bar resizes, no page zoom, reduced motion, Recall; 1440 and 390.");
} finally {
  await browser.close();
  await server.close();
}
