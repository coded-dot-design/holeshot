// Display units in Chromium (the built dist/holeshot.mjs), at 1440 and 390: a new rider sees miles
// (the Endless Wheelie City HUD chip "0.00 MI", the endless bests in MI); SETTINGS → UNITS switches
// to Metric (KM on the chip and the bests), saved: a reload keeps it. Under ?money=inf the switch
// shows but is not saved (as every setting there): a reload without it is still Metric, and one
// with it switched back to Imperial leaves the saved Metric alone.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const page = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false });</script></body></html>`;
const server = await serve(".", { "/": page });
const browser = await chromium.launch(launchOptions());
const root = "document.querySelector('[data-fizlet-host]').shadowRoot";
const $ = (p, fn, arg) => p.evaluate(`((root, arg) => (${fn}))(${root}, ${JSON.stringify(arg ?? null)})`);
const click = (p, sel) => $(p, "root.querySelector(arg).click()", sel);
const until = (p, fn, what, timeout = 20000) => p.waitForFunction(`((root) => (${fn}))(${root})`, null, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const units = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("holeshot:profile") || "{}").settings?.units);
/** The Endless Wheelie City HUD chip, then back to the menu. */
async function chip(p, name) {
  await p.evaluate(() => game.start("endcity"));
  await until(p, "game.run && game.getSnapshot().run.phase === 'ready'", `${name}: on the line`);
  const t = await $(p, "root.querySelector('.wc-time').textContent.trim()");
  await p.evaluate(() => game.run.finish());
  return t;
}
const settings = async (p, name) => {
  await click(p, "[data-go=settings]");
  await until(p, "game.getSnapshot().screen === 'settings'", `${name}: settings`);
  return $(p, "root.querySelector('.dh-units').textContent.trim()");
};

try {
  for (const [name, viewport, touch] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(server.url + "/");
    await until(p, "window.game && game.getSnapshot().screen !== undefined", `${name}: mounts`);
    await p.evaluate(() => game.setup({ starter: "sparkhound" }));
    await until(p, "game.getSnapshot().screen === 'garage'", `${name}: menu`);
    assert.equal(await chip(p, name), "0.00 MI", `${name}: Imperial by default`);
    await p.goto(server.url + "/");
    await until(p, "window.game && game.getSnapshot().screen === 'garage'", `${name}: reload`);
    assert.equal(await settings(p, name), "UNITS MI · MPH");
    await click(p, ".dh-units");
    assert.equal(await $(p, "root.querySelector('.dh-units').textContent.trim()"), "UNITS KM · KM/H", `${name}: switched`);
    assert.equal(await units(p), "metric", `${name}: saved`);
    await p.goto(server.url + "/");
    await until(p, "window.game && game.getSnapshot().screen === 'garage'", `${name}: reload`);
    assert.equal(await chip(p, name), "0.00 KM", `${name}: Metric kept after a reload`);
    // ?money=inf: the switch shows, nothing is saved.
    await p.goto(server.url + "/?money=inf");
    await until(p, "window.game && game.getSnapshot().screen === 'garage'", `${name}: test credits`);
    assert.equal(await settings(p, name), "UNITS KM · KM/H");
    await click(p, ".dh-units");
    assert.equal(await $(p, "root.querySelector('.dh-units').textContent.trim()"), "UNITS MI · MPH");
    assert.equal(await units(p), "metric", `${name}: test credits: not saved`);
    assert.deepEqual(errs, [], `${name}: no page errors`);
    await ctx.close();
  }
  console.log("units.browser: ok");
} finally {
  await browser.close();
  await server.close();
}
