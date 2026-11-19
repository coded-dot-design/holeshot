// The bunny hop as a stick flick on every endless ride (../src/bike/flick.ts): on a phone (390 × 844,
// touch), the gas held on the rocker, a quick pull back on the pad's stick then a push forward (about
// 120 ms apart) hops the bike on the Endless Desert: the flick counts and both wheels leave the
// ground; a slow hold back then forward does not hop; L hops. The same flick on Endless Wheelie City still
// hops. Chromium always; WebKit too with BROWSERS=chromium,webkit (and PLAYWRIGHT_BROWSERS_PATH
// pointing at a WebKit build). Waits on the game's state, never on time alone (the flick's own
// 120 ms and the slow hold's 600 ms are the input being tested).
import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const page = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false }); game.setup({ starter: "sparkhound" });</script></body></html>`;
const server = await serve(".", { "/": page });
const want = (process.env.BROWSERS ?? "chromium").split(",");
const until = (p, fn, arg, what, timeout = 20000) => p.waitForFunction(fn, arg, { timeout, polling: 30 }).catch(() => assert.fail(`${what}: timed out`));

try {
  for (const [bn, type, opts] of [["chromium", chromium, launchOptions()], ["webkit", webkit, {}]]) {
    if (!want.includes(bn)) continue;
    const browser = await type.launch(opts);
    try {
      for (const mode of ["desert", "endcity"]) {
        const what = `${bn} ${mode}`;
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        const p = await ctx.newPage(), errs = [];
        p.on("pageerror", (e) => errs.push(e.message));
        await p.goto(server.url + "/");
        await until(p, () => window.game && game.getSnapshot().screen !== "setup", null, `${what}: mounts`);
        await p.evaluate((m) => game.start(m), mode);
        await until(p, () => game.run && game.getSnapshot().run.phase === "ready", null, `${what}: on the line`);
        // The gas held on the rocker (a finger on its top), and the stick's finger helpers.
        await p.evaluate(() => {
          const sr = document.querySelector("[data-fizlet-host]").shadowRoot, rk = sr.querySelector(".hs-rocker"), rr = rk.getBoundingClientRect();
          rk.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 3, clientX: rr.left + rr.width / 2, clientY: rr.top + rr.height * 0.15, bubbles: true, composed: true, pointerType: "touch", isPrimary: false }));
          const st = sr.querySelector(".bui-stick"), r = st.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          const ev = (t, dy) => st.dispatchEvent(new PointerEvent(t, { pointerId: 7, clientX: cx, clientY: cy + r.height * dy, bubbles: true, composed: true, pointerType: "touch", button: 0, isPrimary: true }));
          const wait = (ms) => new Promise((f) => setTimeout(f, ms));
          const s = () => game.getSnapshot().run;
          // Both wheels down and level (the flick only starts there).
          const grounded = async () => { for (let i = 0; i < 600; i++) { const x = s(); if ((x.down ?? !x.air) && Math.abs(x.nose ?? (x.upright ? 0 : 1)) < 0.08 && x.speed > 2) return true; await wait(16); } return false; };
          window.__flick = async (gap) => {
            if (!(await grounded())) return { grounded: false };
            const f0 = s().flicks;
            ev("pointerdown", 0); ev("pointermove", 0.45); await wait(gap); ev("pointermove", -0.45);
            // Watched for 0.8 s of ride: the flick's count and whether both wheels left the ground.
            let up = false;
            for (let i = 0; i < 50; i++) { const x = s(); if (x.air === true || x.air > 0) up = true; await wait(16); }
            ev("pointermove", 0); ev("pointerup", 0);
            return { grounded: true, flicks: s().flicks - f0, up };
          };
        });
        await until(p, () => game.getSnapshot().run.phase === "run" && game.getSnapshot().run.speed > 3, null, `${what}: rolling on the gas`);
        assert.equal(await p.evaluate(() => game.getSnapshot().run.gas), 1, `${what}: the rocker holds the gas`);
        // Slow: back, held 600 ms (leaning, not a flick), then forward: no hop.
        const slow = await p.evaluate(() => window.__flick(600));
        assert.ok(slow.grounded, `${what}: found level ground for the slow lean`);
        assert.equal(slow.flicks, 0, `${what}: a slow back-then-forward does not hop`);
        // Fast: back, about 120 ms, forward: a hop (a try or two: the ground under the wheels is the desert's).
        let fast = null;
        for (let k = 0; k < 4 && !(fast && fast.flicks === 1 && fast.up); k++) fast = await p.evaluate(() => window.__flick(120));
        assert.ok(fast.grounded, `${what}: found level ground for the flick`);
        assert.equal(fast.flicks, 1, `${what}: the quick flick hops`);
        assert.ok(fast.up, `${what}: both wheels left the ground`);
        // L hops too (the keyboard's hop, as in Endless Wheelie City).
        let keyUp = false;
        for (let k = 0; k < 4 && !keyUp; k++) {
          await until(p, () => { const x = game.getSnapshot().run; return (x.down ?? !x.air) && x.speed > 2; }, null, `${what}: level for L`);
          await p.keyboard.down("KeyL");
          keyUp = await p.waitForFunction(() => { const a = game.getSnapshot().run.air; return a === true || a > 0; }, null, { timeout: 800, polling: 16 }).then(() => true, () => false);
          await p.keyboard.up("KeyL");
        }
        assert.ok(keyUp, `${what}: L hops`);
        assert.deepEqual(errs, [], `${what}: no page errors`);
        console.log(`ok   ${what}: slow lean no hop; flick hops (both wheels off)`);
        await ctx.close();
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}
