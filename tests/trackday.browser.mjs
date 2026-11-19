// Track Day in Chromium (the built dist/holeshot.mjs), at 1440 (dark) and 390 touch (light): on a
// street bike, LET'S RIDE's TRACK DAY group shows the three circuits; a circuit's tile starts Track
// Day on it (the grid, the start lights' countdown, then the race on the autopilot: places and laps
// move, the asphalt drawn); the first lap completed is kept as the circuit's best (the tile says
// BEST LAP after the ride) and the result pays. Waits on state, never on time.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const SAVE = JSON.stringify({ v: 7, name: "KIP", credits: 30000, ride: 0, owned: [], pit: 0, stats: { events: 40, wins: 10, earned: 40000, best: {}, far: {} },
  kit: { helmet: "peak", helmetPaint: "white", visor: "smoke", jersey: "lime", pants: "ink", pattern: "stripe", boots: "white", gloves: "ink" },
  bikes: [{ uid: "b1", model: "tidebreaker", parts: { tyres: 1, chain: 1, motor: 1, susp: 1, brakes: 1 }, look: { paint: "", number: 4 }, odo: 3000, events: 40 }] });
const page = (theme) => `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false });</script></body></html>`;
const server = await serve(".", { "/dark": page("dark"), "/light": page("light") });
const browser = await chromium.launch(launchOptions());
const until = (p, fn, arg, what, timeout = 120000) => p.waitForFunction(fn, arg, { timeout, polling: 100 }).catch(() => assert.fail(`${what}: timed out`));
const root = "document.querySelector('[data-fizlet-host]').shadowRoot";
try {
  for (const [name, theme, viewport, touch, map] of [["1440", "dark", { width: 1440, height: 900 }, false, "td-meridian"], ["390", "light", { width: 390, height: 844 }, true, "td-bottlecap"]]) {
    const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((s) => localStorage.setItem("holeshot:profile", s), SAVE);
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(server.url + "/" + theme);
    await until(p, () => window.game && game.getSnapshot().screen !== "setup", null, `${name}: mounts`);
    await p.evaluate(() => game.show("ride"));
    const tiles = await p.evaluate(`[...${root}.querySelectorAll('[data-grp=day] button')].map((b) => [b.dataset.circuit, b.disabled, b.querySelector('b').textContent])`);
    assert.deepEqual(tiles, [["td-meridian", false, "MERIDIAN RING"], ["td-knotworks", false, "KNOTWORKS"], ["td-bottlecap", false, "BOTTLECAP"]], `${name}: the circuits`);
    await p.evaluate(`${root}.querySelector('[data-circuit=${map}]').click()`);
    await until(p, (m) => game.getSnapshot().mode === "trackday" && game.getSnapshot().run?.map === m && game.getSnapshot().run.phase === "grid", map, `${name}: ${map} on the grid`);
    await p.evaluate(() => (game.auto = true));
    await until(p, () => game.getSnapshot().run.phase === "run", null, `${name}: lights out`);
    await until(p, () => game.getSnapshot().run.lap >= 2, null, `${name}: a lap done`, 240000);
    const s = await p.evaluate(() => game.getSnapshot().run);
    assert.ok(s.faces > 300 && s.crashes === 0 && s.place >= 0 && s.place <= 3, `${name}: drawn, riding, placed ${JSON.stringify({ faces: s.faces, crashes: s.crashes, place: s.place })}`);
    await p.evaluate(() => game.finish());
    await until(p, () => game.getSnapshot().screen === "result", null, `${name}: the result`);
    const best = await p.evaluate((m) => game.profile.stats.best["lap:" + m], map);
    assert.ok(best > 5 && best < 60, `${name}: the best lap kept (${best})`);
    await p.evaluate(() => game.show("ride"));
    const meta = await p.evaluate(`${root}.querySelector('[data-circuit=${map}] em').textContent`);
    assert.match(meta, /^BEST LAP \d:\d\d\.\d$/, `${name}: the tile shows it`);
    assert.deepEqual(errs, [], `${name}: no page errors`);
    console.log(`✓ ${name} (${theme}): ${map} from its tile, lights out, a lap, best lap ${best.toFixed(2)} s kept and shown (${meta}), ${s.faces} faces`);
    await ctx.close();
  }
} finally {
  await browser.close();
  await server.close();
}
