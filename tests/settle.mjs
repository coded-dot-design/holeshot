// Holeshot's settle guard (Chromium, dist/holeshot.mjs): on the menus nothing runs (no frames, no
// audio before a gesture); mid-race, with nobody touching anything, the event never sleeps (the
// rivals race, the clock keeps pace with the wall clock); scrolled off screen it pauses; the result
// card over a finished event settles; Endless Wheelie City sleeps on its start line and settles when it ends; after Recall no frame runs; the landing hero's race ends and
// the hero sleeps. Waits on state.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const fixture = readFileSync("tests/fixtures/page.html", "utf8").replace("<p>After it.</p>", '<p>After it.</p><div style="height:3000px"></div>');
const withGame = (o) => fixture.replace("</body>", `<script>const A = window.AudioContext; window.AudioContext = class extends A { constructor(...a) { super(...a); window.audio = (window.audio || 0) + 1; } };</script><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("board"), seed: 4, ...${JSON.stringify(o)} });</script></body>`);
const server = await serve(".", { "/": withGame({}), "/hero": withGame({ attract: true }) });
const browser = await chromium.launch(launchOptions());
const until = (p, fn, arg, what, timeout = 30000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
// Frames over n animation frames, of the shell's engine and the running event's.
const frames = (p, n = 12) => p.evaluate(async (n) => { const f = () => game.engine.stats().frames + (game.run ? game.run.engine.stats().frames : 0), a = f(); for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r)); return f() - a; }, n);

try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto(server.url + "/");
  await until(p, () => window.game, null, "mounts");
  await p.evaluate(() => game.setup({ starter: "buzzline" }));
  await until(p, () => game.engine.paused.includes("settled"), null, "the menu settles");
  assert.equal(await frames(p), 0, "menu: no frames");
  assert.equal(await p.evaluate(() => window.audio || 0), 0, "no audio before a gesture");
  await p.evaluate(() => game.start("race"));
  await until(p, () => game.getSnapshot().run.phase === "run", null, "the gate drops");
  const a = await p.evaluate(() => ({ t: game.run.state.clock, w: performance.now() }));
  await until(p, (a) => performance.now() - a.w > 2000, a, "two seconds pass");
  const b = await p.evaluate(() => ({ t: game.run.state.clock, w: performance.now(), paused: game.run.engine.paused.slice() }));
  const rate = (b.t - a.t) / ((b.w - a.w) / 1000);
  assert.ok(rate > 0.3, `mid-race the clock keeps pace with nobody touching anything: ${rate.toFixed(2)}×`);
  assert.deepEqual(b.paused, [], "never asleep mid-race");
  await p.evaluate(() => scrollTo(0, 3000));
  await until(p, () => game.run.engine.paused.includes("offscreen"), null, "off screen it pauses");
  assert.equal(await frames(p), 0, "off screen: no frames");
  await p.evaluate(() => scrollTo(0, 0));
  await p.evaluate(() => (game.run.auto = true));
  await until(p, () => game.getSnapshot().screen === "result", null, "the race ends", 120000);
  await until(p, () => game.run.engine.paused.includes("settled") && game.engine.paused.includes("settled"), null, "the result settles", 30000);
  assert.equal(await frames(p), 0, "result: no frames");
  // Free Ride on an open map: waiting at the spawn it sleeps; riding it never does; banked, it settles.
  for (const id of ["dune-sea", "quarry", "forest", "night-park"]) {
    await p.evaluate((id) => game.start("freeride", { map: id }), id);
    await until(p, () => game.getSnapshot().run.phase === "ready" && game.run.engine.paused.includes("settled"), null, `${id}: at the spawn it settles`);
    assert.equal(await frames(p), 0, `${id}: waiting: no frames`);
    await p.evaluate(() => (game.run.auto = true));
    await until(p, () => game.getSnapshot().run.phase === "run" && game.run.state.clock > 1, null, `${id}: rides`);
    const f0 = await p.evaluate(() => ({ t: game.run.state.clock, w: performance.now() }));
    await until(p, (a) => performance.now() - a.w > 1500, f0, "a second and a half");
    const f1 = await p.evaluate(() => ({ t: game.run.state.clock, w: performance.now(), paused: game.run.engine.paused.slice() }));
    assert.ok((f1.t - f0.t) / ((f1.w - f0.w) / 1000) > 0.3 && !f1.paused.length, `${id}: riding never sleeps`);
    await p.evaluate(() => game.finish());
    await until(p, () => game.getSnapshot().screen === "result" && game.run.engine.paused.includes("settled") && game.engine.paused.includes("settled"), null, `${id}: banked, it settles`);
    assert.equal(await frames(p), 0, `${id}: result: no frames`);
  }
  // Endless Wheelie City: on the start line it sleeps; riding, the patrol out or not, it never does; ended, it settles.
  {
    const id = "endcity";
    await p.evaluate((id) => game.start(id), id);
    await until(p, () => game.getSnapshot().run.phase === "ready" && game.run.engine.paused.includes("settled"), null, `${id}: on the start line it settles`);
    assert.equal(await frames(p), 0, `${id}: waiting: no frames`);
    await p.evaluate(() => (game.run.auto = true));
    await until(p, () => game.getSnapshot().run.phase === "run" && game.run.state.far > 5, null, `${id}: rides`);
    const w0 = await p.evaluate(() => ({ t: game.run.state.far, w: performance.now() }));
    await until(p, (a) => performance.now() - a.w > 1500, w0, "a second and a half");
    const w1 = await p.evaluate(() => ({ t: game.run.state.far, w: performance.now(), paused: game.run.engine.paused.slice() }));
    assert.ok(w1.t > w0.t && !w1.paused.length, `${id}: riding never sleeps`);
    await p.evaluate(() => game.finish());
    await until(p, () => game.getSnapshot().screen === "result" && game.run.engine.paused.includes("settled") && game.engine.paused.includes("settled"), null, `${id}: ended, it settles`);
    assert.equal(await frames(p), 0, `${id}: result: no frames`);
  }
  await p.evaluate(() => game.destroy());
  assert.equal(await frames(p), 0, "after Recall: no frames");
  await p.close();

  // The series: its screen (a track map, the table) is still; a round races, then its result settles.
  {
    const r = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await r.goto(server.url + "/");
    await until(r, () => window.game, null, "series: mounts");
    await r.evaluate(() => (game.setup({ starter: "sparkhound" }), game.show("series")));
    await r.evaluate(() => document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("[data-series-enter=rookie]").click());
    await until(r, () => game.getSnapshot().series && game.engine.paused.includes("settled"), null, "the series screen settles");
    assert.equal(await frames(r), 0, "series screen: no frames");
    await r.evaluate(() => game.start("series", { auto: true }));
    await until(r, () => game.getSnapshot().run.phase === "run", null, "series: the gate drops");
    assert.ok((await frames(r)) > 0, "a round never sleeps");
    await until(r, () => game.getSnapshot().screen === "result", null, "series: the round ends", 150000);
    await until(r, () => game.run.engine.paused.includes("settled") && game.engine.paused.includes("settled"), null, "series: the result settles", 30000);
    assert.equal(await frames(r), 0, "series result: no frames");
    await r.close();
  }

  const q = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await q.goto(server.url + "/hero");
  await until(q, () => window.game?.run && game.run.state.speed > 3, null, "the hero races");
  await until(q, () => game.run.engine.paused.includes("settled"), null, "after its race the hero settles", 150000);
  assert.equal(await frames(q), 0, "the hero sleeps");
  await q.close();
  console.log("Holeshot: settle guard green (the menus, the series screen and the hero sleep, a race or a series round never does, off screen pauses, the result settles, quiet after Recall).");
} finally {
  await browser.close();
  await server.close();
}
