// The throttle rocker on a touch screen (Playwright touch, 390 portrait and 844 landscape): one finger
// down at the top is gas only; slid (never lifted) to the middle it is gas and brake together; to the
// bottom, brake only; back up, gas. A second finger on the pill adds the brake while the first holds the
// gas. Icons only, each with an aria-label; the pill is at least 64 × 150 px; the first-time hint goes
// once the seam is used. Then the hand drag in Endless Wheelie City is reached and held with the
// rocker alone (one thumb: gas, the seam to feather), the HAND DRAG chip shows ×10. In Race and Big
// Air the same rocker drives the bike. MEDIA=<dir> records the 390 clip with a touch dot drawn.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const full = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title><style>#dot{position:fixed;z-index:99;inline-size:38px;block-size:38px;margin:-19px 0 0 -19px;border-radius:50%;background:#fff8;border:3px solid #fff;pointer-events:none;display:none}</style></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><div id="dot"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false }); game.setup({ starter: "sparkhound" });</script></body></html>`;
const server = await serve(".", { "/": full });
const browser = await chromium.launch(launchOptions());
const MEDIA = process.env.MEDIA;
const until = (p, fn, arg, what, timeout = 20000) => p.waitForFunction(fn, arg, { timeout, polling: 30 }).catch(() => assert.fail(`${what}: timed out`));
const pill = (p) => p.evaluate(() => { const r = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-rocker"), b = r.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, zone: r.dataset.zone ?? "0" }; });
const io = (p) => p.evaluate(() => { const s = game.run.state; return [s.gas ?? null, s.brake ?? null]; });

try {
  for (const [name, viewport] of [["390", { width: 390, height: 844 }], ["844", { width: 844, height: 390 }]]) {
    const rec = MEDIA && name === "390";
    const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true, ...(rec ? { recordVideo: { dir: MEDIA, size: viewport } } : {}) });
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(server.url + "/");
    await until(p, () => window.game && game.getSnapshot().screen !== "setup", null, `${name}: mounts`);
    await p.evaluate(() => { try { localStorage.removeItem("holeshot:rocker-seam"); } catch {} });
    await p.evaluate(() => game.start("endcity"));
    await until(p, () => game.run && game.getSnapshot().run.phase === "ready", null, `${name}: on the line`);
    const cdp = await ctx.newCDPSession(p);
    const dot = (x, y) => p.evaluate(([x, y]) => { const d = document.getElementById("dot"); d.style.display = x < 0 ? "none" : "block"; d.style.left = x + "px"; d.style.top = y + "px"; }, [x, y]);
    const touch = async (type, pts) => { await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts }); if (pts[0]) await dot(pts[0].x, pts[0].y); else await dot(-1, -1); };
    // ---- the pill: icons with words for screen readers, big enough, the hint showing ----
    const a = await p.evaluate(() => { const r = document.querySelector("[data-fizlet-host]").shadowRoot, z = [...r.querySelectorAll(".hs-rocker .hs-rz")]; return { labels: z.map((e) => e.getAttribute("aria-label")), svg: z.every((e) => !!e.querySelector("svg") && !e.textContent.trim()), hint: !r.querySelector(".hs-rhint").hidden, keys: [...r.querySelectorAll(".bui-pad button")].map((b) => ({ l: b.getAttribute("aria-label"), t: b.textContent.trim(), svg: !!b.querySelector("svg") })) }; });
    assert.deepEqual(a.labels.map((l) => l.split(":")[0]), ["Gas", "Gas and brake together", "Brake"], `${name}: zones labelled`);
    assert.ok(a.svg, `${name}: icons only`);
    assert.ok(a.keys.every((k) => k.svg && k.l), `${name}: every pad key an icon with a label: ${JSON.stringify(a.keys)}`);
    assert.ok(a.hint, `${name}: the first-time hint`);
    const r = await pill(p);
    assert.ok(r.w >= 64 && r.h >= 150 && r.x + r.w <= viewport.width && r.y + r.h <= viewport.height, `${name}: the pill ${r.w}×${r.h} at ${r.x},${r.y}`);
    const X = r.x + r.w / 2, at = (f) => r.y + r.h * f;
    // ---- one finger: top, seam, bottom, top: never lifted ----
    await touch("touchStart", [{ x: X, y: at(0.15), id: 1 }]);
    await until(p, () => game.getSnapshot().run.gas === 1 && game.getSnapshot().run.brake === 0, null, `${name}: top: gas only`);
    assert.equal((await pill(p)).zone, "1");
    await touch("touchMove", [{ x: X, y: at(0.5), id: 1 }]);
    await until(p, () => game.getSnapshot().run.gas === 1 && game.getSnapshot().run.brake === 1, null, `${name}: the seam: gas and brake`);
    assert.equal((await pill(p)).zone, "3");
    await touch("touchMove", [{ x: X, y: at(0.85), id: 1 }]);
    await until(p, () => game.getSnapshot().run.gas === 0 && game.getSnapshot().run.brake === 1, null, `${name}: bottom: brake only`);
    await touch("touchMove", [{ x: X, y: at(0.1), id: 1 }]);
    await until(p, () => game.getSnapshot().run.gas === 1 && game.getSnapshot().run.brake === 0, null, `${name}: back up: gas`);
    // ---- two fingers: the second anywhere on the pill adds the brake ----
    await touch("touchMove", [{ x: X, y: at(0.1), id: 1 }, { x: X, y: at(0.2), id: 2 }]);
    await touch("touchStart", [{ x: X, y: at(0.1), id: 1 }, { x: X, y: at(0.2), id: 2 }]);
    await until(p, () => game.getSnapshot().run.gas === 1 && game.getSnapshot().run.brake === 1, null, `${name}: two fingers: gas and brake`);
    await touch("touchEnd", [{ x: X, y: at(0.1), id: 1 }]);
    await until(p, () => game.getSnapshot().run.gas === 1 && game.getSnapshot().run.brake === 0, null, `${name}: the second finger up: gas again`);
    await touch("touchEnd", []);
    await until(p, () => game.getSnapshot().run.gas === 0 && game.getSnapshot().run.brake === 0, null, `${name}: lifted: nothing`);
    assert.ok(await p.evaluate(() => document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-rhint").hidden), `${name}: the hint goes once the seam is used`);
    // ---- the hand drag with the rocker alone: gas to lift, then the thumb rides the seam/gas line ----
    await p.evaluate(() => game.start("endcity"));
    await until(p, () => game.run && game.getSnapshot().run.phase === "ready", null, `${name}: again`);
    const r2 = await pill(p), X2 = r2.x + r2.w / 2, at2 = (f) => r2.y + r2.h * f;
    // On the line: the seam (gas and brake: the revs up, the bike held), then slide up to the gas: it pops up.
    let y = at2(0.5), dragged = false, held = 0;
    await touch("touchStart", [{ x: X2, y, id: 1 }]);
    await p.waitForTimeout(500);
    const t0 = Date.now();
    while (Date.now() - t0 < 16000) {
      const s = await p.evaluate(() => { const s = game.run.state; return { nose: s.nose, drag: s.drag }; });
      if (s.drag) { dragged = true; held++; if (held > 25) break; }
      // A thumb's feel: under the goal on the gas, over it on the seam (both: the brake feathers it).
      const want = s.nose < 1.7 ? at2(0.15) : at2(0.5);
      if (want !== y) (y = want), await touch("touchMove", [{ x: X2, y, id: 1 }]);
    }
    if (dragged) {
      const chip = await p.evaluate(() => { const c = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".wc-drag"); return c.hidden ? "" : c.textContent; });
      assert.ok(/×10/.test(chip), `${name}: the ×10 chip: ${chip}`);
      // Down from the seam to the brake: back under 12, banked.
      await touch("touchMove", [{ x: X2, y: at2(0.85), id: 1 }]);
      await p.waitForTimeout(1500);
    }
    await touch("touchEnd", []);
    assert.ok(dragged, `${name}: the hand drag reached and held with the rocker alone`);
    assert.deepEqual(errs, [], `${name}: no page errors`);
    console.log(`${name}: gas · seam (gas + brake) · brake · gas on one finger, two fingers, icons with labels, the hint; a hand drag held on the rocker alone.`);
    await ctx.close();
  }
  // ---- the same rocker in Race and Big Air ----
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  await p.goto(server.url + "/");
  await until(p, () => window.game && game.getSnapshot().screen !== "setup", null, "mounts");
  const cdp = await ctx.newCDPSession(p);
  for (const id of ["race", "bigair"]) {
    await p.evaluate((id) => game.start(id), id);
    await until(p, () => game.run && !!document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".hs-rocker"), null, `${id}: the rocker`);
    await p.waitForTimeout(500);
    const r = await pill(p);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: r.x + r.w / 2, y: r.y + r.h * 0.15, id: 1 }] });
    await until(p, () => game.getSnapshot().run.speed > 2, null, `${id}: the rocker's gas rides`, 30000);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await p.evaluate(() => game.leave());
  }
  await ctx.close();
  console.log("Rocker: one thumb slides gas → seam (both) → brake without lifting, two fingers add the brake, icons with labels, ≥ 64 × 150, the hint; the hand drag on the rocker alone; Race and Big Air ride on it; 390 and 844.");
} finally {
  await browser.close();
  await server.close();
}
