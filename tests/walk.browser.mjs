// Walking the bike in the browser (Playwright touch at 390 portrait): ride Free Ride a moment, stop,
// and the one-time hint shows ("No gas? Stick back to walk it out"); the pad's stick pulled back (no gas)
// walks the bike backwards: the WALK chip, the speed negative and slow; the rocker's gas rides on at
// once and the chip goes; the hint never comes back. Then the stick walks it in Endless Wheelie City
// too. The keys (S) walk it on a desktop (1280). MEDIA=<dir> records the 390 clip.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const full = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false }); game.setup({ starter: "sparkhound" });</script></body></html>`;
const server = await serve(".", { "/": full });
const browser = await chromium.launch(launchOptions());
const until = (p, fn, arg, what, timeout = 20000) => p.waitForFunction(fn, arg, { timeout, polling: 30 }).catch(() => assert.fail(`${what}: timed out`));
const root = 'document.querySelector("[data-fizlet-host]").shadowRoot';
const ui = (p) => p.evaluate((root) => { const r = eval(root), c = r.querySelector(".hs-walk"), h = r.querySelector(".hs-walkhint"); return { chip: !!c && !c.hidden, hint: !!h && !h.hidden, text: h ? h.textContent : "" }; }, root);
const stick = (p) => p.evaluate((root) => { const b = eval(root).querySelector(".bui-stick").getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, root);
const pill = (p) => p.evaluate((root) => { const b = eval(root).querySelector(".hs-rocker").getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height * 0.15 }; }, root);

try {
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(server.url + "/");
    await until(p, () => window.game && game.getSnapshot().screen !== "setup", null, "mounts");
    await p.evaluate(() => { try { localStorage.removeItem("holeshot:walk-hint"); } catch {} });
    const cdp = await ctx.newCDPSession(p);
    const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
    for (const id of ["freeride", "endcity"]) {
      await p.evaluate((id) => game.start(id), id);
      await until(p, () => game.run && game.getSnapshot().run.phase === "ready", null, `${id}: ready`);
      await p.waitForTimeout(300);
      const g = await pill(p);
      // Ride a moment on the rocker's gas, then let go and brake to a stop.
      await touch("touchStart", [{ x: g.x, y: g.y, id: 2 }]);
      await until(p, () => game.getSnapshot().run.speed > 3, null, `${id}: rides`, 30000);
      await touch("touchMove", [{ x: g.x, y: g.y + 120, id: 2 }]);
      await until(p, () => Math.abs(game.getSnapshot().run.speed) < 0.3, null, `${id}: stopped`, 30000);
      await touch("touchEnd", []);
      if (id === "freeride") {
        await until(p, (root) => { const h = eval(root).querySelector(".hs-walkhint"); return h && !h.hidden; }, root, "the one-time hint");
        assert.equal((await ui(p)).text, "No gas? Stick back to walk it out");
      }
      // The left stick: a drag down from the left half (back), no gas.
      const k0 = await stick(p);
      await touch("touchStart", [{ x: k0.x, y: k0.y, id: 1 }]);
      for (let k = 1; k <= 6; k++) await touch("touchMove", [{ x: k0.x, y: k0.y + k * 8, id: 1 }]);
      await until(p, () => game.getSnapshot().run.walking === true, null, `${id}: the stick back walks it`);
      await p.waitForTimeout(700);
      const s = await p.evaluate(() => game.getSnapshot().run);
      if (s.speed !== undefined) assert.ok(s.speed < -0.5 && s.speed > -1.6, `${id}: backwards, slowly: ${s.speed}`);
      const u = await ui(p);
      assert.ok(u.chip && !u.hint, `${id}: the WALK chip, the hint gone`);
      // The rocker's gas: riding again at once.
      await touch("touchStart", [{ x: k0.x, y: k0.y + 48, id: 1 }, { x: g.x, y: g.y, id: 2 }]);
      await until(p, () => game.getSnapshot().run.walking === false, null, `${id}: the gas rides on`);
      await touch("touchEnd", []);
      assert.ok(!(await ui(p)).chip, `${id}: the chip goes`);
      await p.evaluate(() => game.leave());
    }
    assert.deepEqual(errs, [], "no page errors");
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p = await ctx.newPage();
    await p.goto(server.url + "/");
    await until(p, () => window.game && game.getSnapshot().screen !== "setup", null, "1280: mounts");
    await p.evaluate(() => game.start("freeride"));
    await until(p, () => game.run && game.getSnapshot().run.phase === "ready", null, "1280: ready");
    await p.locator(".dh").first().focus().catch(() => {});
    await p.keyboard.down("s");
    await until(p, () => game.getSnapshot().run.walking === true, null, "1280: S walks it");
    await p.waitForTimeout(600);
    assert.ok((await p.evaluate(() => game.getSnapshot().run.speed)) < -0.5, "1280: backwards");
    await p.keyboard.up("s");
    await until(p, () => game.getSnapshot().run.walking === false, null, "1280: let go, it stops");
    await ctx.close();
  }
  console.log("Walk: the one-time touch hint; the left stick back walks it backwards (WALK chip), the gas rides on, in Free Ride and Endless Wheelie City at 390; S walks it at 1280.");
} finally {
  await browser.close();
  await server.close();
}
