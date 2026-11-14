// The Race Series in Chromium (the built dist/holeshot.mjs), at 1440 (keyboard and mouse) and 390
// (touch): SERIES shows three tiers (the Rookie Cup open, the others locked; keys 44 px or more, no
// sideways scroll); ENTER opens the championship: the next round's track from above and the
// standings; RIDE ROUND 1 races it (Space or the pad's GAS, then the autopilot) against the tier's
// rivals; the result pays the round's prize, wears the bike and shows the table after round 1 (all
// four scored); round 2 is a different track; leaving round 2 pays nothing, scores the player
// nothing and moves the championship on; a reload keeps it. Screenshots in light and dark go to
// SHOTS (a directory) when it is set. Waits on state.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const page = (theme) => `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Series</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 9, sound: false });</script></body></html>`;
const server = await serve(".", { "/": page("dark"), "/light": page("light") });
const browser = await chromium.launch(launchOptions());
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const snap = (p) => p.evaluate(() => game.getSnapshot());
const until = (p, fn, arg, what, timeout = 30000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const click = (p, sel) => p.evaluate((s) => document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(s).click(), sel);
const q = (p, fn) => p.evaluate(`(() => { const root = document.querySelector("[data-fizlet-host]").shadowRoot; return (${fn})(root); })()`);
const shot = async (p, name) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png` });

try {
  for (const [name, viewport, touch] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(server.url + "/");
    await until(p, () => window.game, null, `${name}: mounts`);
    await p.evaluate(() => game.setup({ starter: "buzzline", number: 23, name: "KIP" }));
    await click(p, "[data-go=series]");
    let s = await snap(p);
    assert.equal(s.screen, "series", `${name}: SERIES`);
    const tiers = await q(p, `(root) => { const r = (e) => e.getBoundingClientRect(); const ks = [...root.querySelectorAll(".dh-card button")]; return { n: root.querySelectorAll("[data-series-enter]").length, open: [...root.querySelectorAll("[data-series-enter]")].map((b) => !b.disabled), big: ks.every((k) => Math.min(r(k).width, r(k).height) >= 44), sideways: root.querySelector(".dh-cards").scrollWidth > innerWidth + 1 }; }`);
    assert.deepEqual(tiers, { n: 3, open: [true, false, false], big: true, sideways: false }, `${name}: three tiers, the rookie cup open, keys ≥ 44 px, no sideways scroll`);
    await shot(p, `${name}-tiers-dark`);
    await click(p, "[data-series-enter=rookie]");
    s = await snap(p);
    assert.deepEqual([s.series.tier, s.series.round, s.series.points], ["rookie", 0, [0, 0, 0, 0]], `${name}: the championship starts`);
    const map1 = await q(p, `(root) => ({ d: root.querySelector(".ds-map .tp-line").getAttribute("d"), rows: root.querySelectorAll(".ds-table tbody tr").length, me: root.querySelector(".ds-me").textContent, sideways: root.querySelector(".dh-cards").scrollWidth > innerWidth + 1, go: root.querySelector("[data-series-go]").textContent })`);
    assert.ok(map1.d.length > 200 && map1.rows === 4 && /KIP/.test(map1.me) && !map1.sideways && map1.go === "RIDE ROUND 1", `${name}: the map, the table, RIDE ROUND 1 (${JSON.stringify({ ...map1, d: map1.d.length })})`);
    await shot(p, `${name}-round1-dark`);
    // ---- round 1: by hand, then the autopilot ----
    await click(p, "[data-series-go]");
    s = await snap(p);
    assert.deepEqual([s.screen, s.mode, s.run.phase], ["event", "series", "grid"], `${name}: the gate`);
    await until(p, () => game.getSnapshot().run.phase === "run", null, `${name}: the gate drops`);
    if (!touch) {
      await p.keyboard.down("Space");
      await until(p, () => game.getSnapshot().run.speed > 3, null, `${name}: Space rides`);
      await p.keyboard.up("Space");
    } else {
      const gas = await p.evaluate(() => { const b = [...document.querySelector("[data-fizlet-host]").shadowRoot.querySelectorAll(".bui-pad button")].find((x) => /gas/i.test(x.getAttribute("aria-label") || x.title || x.textContent)), r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
      const cdp = await ctx.newCDPSession(p);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: gas[0], y: gas[1], id: 1 }] });
      await until(p, () => game.getSnapshot().run.speed > 3, null, `${name}: the pad's GAS rides`);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    await shot(p, `${name}-racing-dark`);
    const pre = await snap(p);
    await p.evaluate(() => (game.run.auto = true));
    await until(p, () => game.getSnapshot().screen === "result", null, `${name}: the round ends`, 150000);
    s = await snap(p);
    assert.ok(s.result.finished && s.result.credits >= 100 && s.credits === pre.credits + s.result.credits, `${name}: the round pays (${s.result.credits})`);
    assert.ok(/ROUND 1 · /.test(s.result.lines[0][0]), `${name}: the prize line (${s.result.lines[0][0]})`);
    assert.ok(Object.values(s.bike.parts).every((v) => v < 1), `${name}: and wears the bike`);
    assert.equal(s.series.round, 1);
    assert.equal(s.series.points.reduce((a, b) => a + b, 0), 25 + 18 + 15 + 12, `${name}: all four scored`);
    const after = await q(p, `(root) => ({ rows: root.querySelectorAll(".ds-after tbody tr").length, cap: root.querySelector(".ds-after caption").textContent, next: root.querySelector(".dh-result [data-go=series]").textContent })`);
    assert.deepEqual(after, { rows: 4, cap: "AFTER ROUND 1 OF 4", next: "ROUND 2" }, `${name}: the table after round 1`);
    await shot(p, `${name}-result-dark`);
    // ---- round 2: a new track; leaving it ----
    await click(p, ".dh-result [data-go=series]");
    const map2 = await q(p, `(root) => root.querySelector(".ds-map .tp-line").getAttribute("d")`);
    assert.notEqual(map2, map1.d, `${name}: round 2 is a different track`);
    const mine = (await snap(p)).series.points[0], cr = (await snap(p)).credits;
    await click(p, "[data-series-go]");
    await until(p, () => game.getSnapshot().run.phase === "run", null, `${name}: round 2 gate`);
    await p.evaluate(() => (game.run.auto = true));
    await until(p, () => game.getSnapshot().run.speed > 5, null, `${name}: round 2 racing`);
    await p.evaluate(() => (game.pause(), game.leave()));
    s = await snap(p);
    assert.ok(s.screen === "result" && !s.result.finished && s.result.credits === 0 && s.credits === cr, `${name}: left: no pay`);
    assert.deepEqual([s.series.round, s.series.points[0]], [2, mine], `${name}: left: the round counts, no points`);
    // ---- a reload keeps the championship ----
    await p.reload();
    await until(p, () => window.game && game.getSnapshot().screen === "menu", null, `${name}: reload`);
    assert.equal((await snap(p)).series.round, 2, `${name}: the championship kept`);
    if (SHOTS) {
      const lp = await ctx.newPage();
      await lp.goto(server.url + "/light");
      await until(lp, () => window.game, null, `${name}: light`);
      await lp.evaluate(() => game.show("series"));
      await lp.waitForTimeout(300);
      await shot(lp, `${name}-round3-light`);
      await lp.close();
    }
    assert.deepEqual(errs, [], `${name}: no page errors`);
    await ctx.close();
  }
  console.log("Holeshot series: three tiers (one open), a championship's map and table, a round by keys and touch then the autopilot, the prize and the wear, the table after the round, a new track for round 2, leaving scores nothing, a reload keeps it; 1440 and 390.");
} finally {
  await browser.close();
  await server.close();
}
