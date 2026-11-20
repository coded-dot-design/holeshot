// The showroom (src/garage/showroom.ts on the shop's catalogue, vendor/shop/) in
// Chromium, at 1440 (mouse) and 390 (touch): the filters (All types, All brands) narrow the cards
// and "Showing n of 19" says so; every one of the nineteen shows (no More key); a pick never changes a card's size; a card's picture puts that bike on
// the turntable (the render changes) and in the preview's title; Compare with … opens the comparison
// (price, tier, Pull / Top / Light, 0–30, 0–60, top speed, the one-line summary) and ‹ Back returns;
// short of credits the Buy key is disabled with "N more credits needed"; with enough, Buy puts the
// bike into the chosen bay (the first empty one, or a bay with a bike in it: a trade-in into that
// bay). Every key 44 px or more, no sideways scroll. The thumbnails' first draw is timed. With MEDIA
// set, screenshots (day and night) go there.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const MEDIA = process.env.MEDIA;
if (MEDIA) mkdirSync(MEDIA, { recursive: true });
const page = (theme) => `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false });</script></body></html>`;
const server = await serve(".", { "/": page("dark"), "/day": page("light") });
const browser = await chromium.launch(launchOptions());
const KIT = { helmet: "peak", helmetPaint: "white", visor: "smoke", jersey: "lime", pants: "ink", pattern: "stripe", boots: "white", gloves: "ink" };
const bike = (uid, model, number = 7) => ({ uid, model, parts: { tyres: 1, chain: 1, motor: 1, susp: 1, brakes: 1 }, look: { paint: "acid", number }, odo: 0, events: 0 });
/** The PDF's rider: 714 credits, one 2-stroke #7, three bays, past the tier 4 unlock. */
const SAVE = (o = {}) => ({ v: 7, name: "KIP", credits: 714, ride: 0, slots: 3, owned: [], pit: 0, stats: { events: 30, wins: 0, earned: 13000, best: {} }, kit: KIT, bikes: [bike("b1", "buzzline")], ...o });
const root = "document.querySelector('[data-fizlet-host]').shadowRoot";
const $ = (p, fn, arg) => p.evaluate(`((root, arg) => (${fn}))(${root}, ${JSON.stringify(arg ?? null)})`);
const click = (p, sel) => $(p, "(() => { const e = root.querySelector(arg); if (!e) throw new Error('no ' + arg); e.click(); })()", sel);
const until = (p, fn, what, timeout = 20000) => p.waitForFunction(`((root) => (${fn}))(${root})`, null, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const text = (p, sel) => $(p, "root.querySelector(arg)?.textContent.replace(/\\s+/g, ' ').trim() ?? ''", sel);
const prof = (p) => p.evaluate(() => JSON.parse(JSON.stringify(game.profile)));
const ink = (p) => $(p, "(() => { const c = root.querySelector('.dh-preview'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 64) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0; return h; })()");
const showing = (p) => text(p, ".shop-cat-foot [role=status]");
const layout = (p) => $(p, "(() => { const keys = [...root.querySelectorAll('.shop-cat button')].filter((e) => e.getClientRects().length); const small = keys.filter((k) => { const r = k.getBoundingClientRect(); return Math.min(r.width, r.height) < 43.5; }).map((k) => k.textContent.trim().slice(0, 24)); return { small, sideways: root.querySelector('.dh-cards').scrollWidth > innerWidth + 1 }; })()");
const shot = async (p, name, full = false) => {
  if (!MEDIA) return;
  await p.waitForTimeout(150);
  if (!full) return void (await p.screenshot({ path: `${MEDIA}/${name}.png` }));
  // The whole stacked screen: the viewport as tall as the cards' scroll, then back.
  const v = p.viewportSize(), h = await $(p, "root.querySelector('.dh-cards').scrollHeight");
  await p.setViewportSize({ width: v.width, height: Math.max(v.height, h) });
  await p.waitForTimeout(250);
  await p.screenshot({ path: `${MEDIA}/${name}.png` });
  await p.setViewportSize(v);
};
async function open(viewport, touch, path, save) {
  const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
  await ctx.addInitScript((s) => localStorage.setItem("holeshot:profile", s), JSON.stringify(save));
  const p = await ctx.newPage(), errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(server.url + path);
  await until(p, "window.game && game.getSnapshot().screen === 'garage'", "the saved profile loads");
  const t0 = await p.evaluate(() => performance.now());
  await click(p, "[data-gtab=showroom]");
  await until(p, "root.querySelectorAll('.shop-cat-item').length === 19", "the showroom draws its first page");
  const first = (await p.evaluate(() => performance.now())) - t0;
  await until(p, "root.querySelectorAll('.shop-cat-item img[src^=\"data:image/\"]').length === 19", "then its pictures");
  const ms = (await p.evaluate(() => performance.now())) - t0;
  return { ctx, p, errs, ms, first };
}
/** Pick a bike's card. */
async function pick(p, id) {
  await click(p, `[data-shop-pick="${id}"]`);
}

try {
  for (const [name, viewport, touch] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]]) {
    // ---- browse: filters, paging, preview, compare, the disabled buy ----
    for (const [theme, path] of [["night", "/"], ["day", "/day"]]) {
      const { ctx, p, errs, ms, first } = await open(viewport, touch, path, SAVE());
      const at = `${name} ${theme}`;
      assert.match(await showing(p), /^Showing 19 of 19 models$/, `${at}: every model on the first page`);
      assert.match(await text(p, ".shop-cat-list .shop-heading"), /Showroom\s*19 MODELS/i);
      if (theme === "night") {
        // The thumbnails: stills from the game's rig, kept (a redraw draws none again).
        const bytes = await $(p, "[...root.querySelectorAll('.shop-cat-item img')].reduce((a, i) => a + i.src.length, 0)");
        // again, with the stills kept: the difference is the four stills' first draw
        await click(p, "[data-gtab=garage]");
        await until(p, "!root.querySelector('.shop-cat')", `${name}: back to the garage`);
        const t1 = await p.evaluate(() => performance.now());
        await click(p, "[data-gtab=showroom]");
        await until(p, "root.querySelectorAll('.shop-cat-item img[src^=\"data:image/\"]').length === 19", `${name}: the showroom again`);
        const again = (await p.evaluate(() => performance.now())) - t1;
        console.log(`  ${name}: the showroom first opens in ${first.toFixed(0)} ms (the pace of all nineteen measured on the sim, then kept), all nineteen stills follow, one a frame, by ${ms.toFixed(0)} ms (≈ ${((ms - first) / 19).toFixed(0)} ms a still, ${Math.round(bytes / 19 / 1024)} KB each as a data URL); opened again ${again.toFixed(0)} ms`);
      }
      // filter by type, then by brand, then back to all
      await click(p, "[data-shop-open=type]");
      await until(p, "!!root.querySelector('.shop-menu [data-shop-set=type]')", `${at}: the types menu opens`);
      assert.equal(await $(p, "root.querySelectorAll('.shop-menu [data-shop-set=type]').length"), 6, `${at}: All types + five classes`);
      if (theme === "day" && name === "desktop") await shot(p, `${name}-${theme}-filter-open`);
      await click(p, "[data-shop-set=type][data-v='4-STROKE']");
      await until(p, "!root.querySelector('.shop-menu')", `${at}: the menu closes`);
      assert.equal(await showing(p), "Showing 4 of 19 models", `${at}: four 4-strokes`);
      assert.match(await text(p, "[data-shop-open=type]"), /4-STROKE/);
      assert.ok((await $(p, "[...root.querySelectorAll('.shop-cat-item .shop-eyebrow')].map((e) => e.textContent)")).every((t) => /4-STROKE/.test(t)), `${at}: only 4-strokes`);
      // (the brand of the one LIMEJET 4-stroke, by the names tier shown)
      const lime = await $(p, "root.querySelector('[data-shop-id=slag-ox] .shop-eyebrow').firstChild.textContent.trim()");
      await click(p, "[data-shop-open=brand]");
      await click(p, `[data-shop-set=brand][data-v="${lime}"]`);
      await until(p, "root.querySelectorAll('.shop-cat-item').length === 1", `${at}: one ${lime} 4-stroke`);
      assert.equal(await showing(p), "Showing 1 of 19 models");
      await click(p, "[data-shop-open=type]"); await click(p, "[data-shop-set=type][data-v='']");
      await click(p, "[data-shop-open=brand]"); await click(p, "[data-shop-set=brand][data-v='']");
      // every one of the nineteen shows (no More key): the filters narrow the list
      assert.equal(await showing(p), "Showing 19 of 19 models", `${at}: all again`);
      assert.equal(await $(p, "root.querySelectorAll('.shop-cat-item').length"), 19, `${at}: nineteen cards`);
      assert.equal(await $(p, "!!root.querySelector('[data-shop-more]')"), false, `${at}: no More key`);
      assert.deepEqual(await layout(p), { small: [], sideways: false }, `${at}: keys ≥ 44 px, no sideways scroll`);
      // preview: a card's picture puts it on the turntable
      await until(p, "root.querySelector('.shop-cat-stage .dh-preview')?.width > 50", `${at}: the turntable draws in the preview`);
      const i0 = await ink(p);
      await pick(p, "forgeback");
      await until(p, "root.querySelector('[data-shop-pick=forgeback]').getAttribute('aria-pressed') === 'true'", `${at}: picked`);
      const nm = (id) => text(p, `[data-shop-id="${id}"] .shop-name`), A = await nm("forgeback"), B = await nm("bare-knuckle");
      assert.ok((await text(p, ".shop-cat-pv .shop-title")).startsWith("SHOWROOM PREVIEW") && (await text(p, ".shop-cat-pv .shop-title")).endsWith(A), `${at}: the preview says which`);
      await until(p, `(() => { const c = root.querySelector('.dh-preview'); return c.width > 50; })()`, `${at}: still drawn`);
      await p.waitForFunction(`((root, a) => { const c = root.querySelector('.dh-preview'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 64) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0; return h !== a; })(${root}, ${i0})`, null, { timeout: 5000, polling: 50 }).catch(() => assert.fail(`${at}: the turntable shows the picked bike`));
      assert.match(await text(p, "[data-shop-id=forgeback] [data-shop-on]"), /On turntable/);
      // a pick never changes a card's size (the grid holds), and the picked card's ring is the Buy key's colour
      const sizes = () => $(p, "[...root.querySelectorAll('.shop-cat-item')].slice(0, 6).map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })");
      const s0 = await sizes();
      await pick(p, "bare-knuckle");
      await p.waitForTimeout(300);
      { const s1 = await sizes(); assert.deepEqual(s1, s0, `${at}: a pick keeps every card's size (${JSON.stringify([s0, s1])})`); }
      assert.equal(await $(p, "getComputedStyle(root.querySelector('.shop-cat-item[data-on] > .shop-kt')).borderTopColor"), await $(p, "getComputedStyle(root.querySelector('.dh-hkeys .dh-cr')).backgroundColor"), `${at}: the picked ring is the mint go colour (Buy, LET'S RIDE, the credits)`);
      await pick(p, "forgeback");
      assert.match(await text(p, "[data-shop-id=bare-knuckle] [data-shop-cmp]"), new RegExp(`Compare with ${A}`));
      // compare with your bike: deltas coloured better (up) or worse (down)
      assert.equal(await $(p, "root.querySelectorAll('.shop-cat-cmp .shop-stat em[data-d]').length"), 3, `${at}: three deltas`);
      // the disabled buy: 714 credits, 4,200 to pay
      assert.equal(await $(p, "root.querySelector('[data-shop-buy=forgeback]').disabled"), true, `${at}: Buy disabled when short`);
      assert.match(await text(p, "[data-shop-buy=forgeback]"), /Buy bike\s*·\s*4,200/);
      assert.equal(await text(p, ".shop-cat-cmp .shop-need"), "3,486 more credits needed", `${at}: what it needs`);
      await p.evaluate(() => window.scrollTo(0, 0));
      await $(p, "root.querySelector('.dh-cards').scrollTo(0, 0)");
      await shot(p, `${name}-${theme}-showroom`, name === "phone");
      // compare: with the Striker (the naked V4)
      await click(p, "[data-shop-id=bare-knuckle] [data-shop-cmp]");
      await until(p, "!!root.querySelector('[data-shop-back]')", `${at}: the comparison`);
      const rows = await $(p, "[...root.querySelectorAll('.shop-cat-cmpcard tbody tr')].map((r) => [...r.cells].map((c) => c.textContent.trim()))");
      assert.deepEqual(rows.map((r) => r[0]), ["Price", "Tier", "Pull", "Top", "Light", "0–30 mph", "0–60 mph", "Top speed"], `${at}: the rows`);
      assert.deepEqual(rows[0].slice(1), ["4,200 credits", "12,500 credits"]);
      assert.deepEqual(rows[1].slice(1), ["2 of 4", "4 of 4"]);
      const top = rows[7].slice(1).map((v) => parseInt(v));
      assert.equal(await text(p, ".shop-cat-sum"), `${B} gains ${top[1] - top[0]} mph over the ${A}.`, `${at}: the one line`);
      await $(p, "root.querySelector('.dh-cards').scrollTo(0, 0)");
      await shot(p, `${name}-${theme}-compare`, name === "phone");
      await click(p, "[data-shop-back]");
      await until(p, "!!root.querySelector('.shop-cat-grid')", `${at}: back to the showroom`);
      // Compare bikes (the header key): the bike on the turntable against another
      await click(p, ".shop-cat-tools [data-shop-cmp]");
      await until(p, "!!root.querySelector('.shop-cat-sum')", `${at}: Compare bikes opens it`);
      await click(p, "[data-shop-back]");
      assert.deepEqual(errs, [], `${at}: no page errors`);
      await ctx.close();
    }
    // ---- buy: into the first empty bay, then a trade-in into bay 1 ----
    {
      const { ctx, p, errs } = await open(viewport, touch, "/", SAVE({ credits: 20000, bikes: [bike("b1", "buzzline"), bike("b2", "glidewire", 12)] }));
      await pick(p, "forgeback");
      // the bay picker: a tile per bay, the first empty one picked; the full ones marked "trade in" with their bike's picture
      const tiles = () => $(p, "[...root.querySelectorAll('.shop-cat-bays [data-shop-set=slot]')].map((b) => [b.dataset.v, b.getAttribute('aria-checked'), b.textContent, !!b.querySelector('img')])");
      const T0 = await tiles();
      assert.equal(T0.length, 3, `${name}: bays 1, 2 (trade-ins) and 3 (empty)`);
      assert.deepEqual(T0.map((t) => t[1]), ["false", "false", "true"], `${name}: the first empty bay picked`);
      assert.ok(/Bay 1.*Trade in/i.test(T0[0][2]) && T0[0][3] && /Bay 3\s*Empty/.test(T0[2][2]), `${name}: trade-ins marked, the empty bay says so (${T0.map((t) => t[2])})`);
      if (name === "desktop") await shot(p, `${name}-night-bay3`);
      await click(p, "[data-shop-set=slot][data-v='2']");
      assert.equal(await $(p, "root.querySelector('[data-shop-buy=forgeback]').disabled"), false, `${name}: Buy on when affordable`);
      await click(p, "[data-shop-buy=forgeback]");
      await until(p, "game.profile.bikes.length === 3", `${name}: bought`);
      let P = await prof(p);
      assert.equal(P.bikes[2].model, "forgeback", `${name}: into bay 3`);
      assert.equal(P.ride, 2, `${name}: it rides next`);
      assert.equal(P.credits, 20000 - 4200, `${name}: paid its price`);
      // a trade-in into bay 1: the RIPPER 125 goes, the new bike takes bay 1
      await pick(p, "bare-knuckle");
      await click(p, "[data-shop-set=slot][data-v='0']");
      assert.equal(await $(p, "root.querySelector('[data-shop-set=slot][data-v=\"0\"]').getAttribute('aria-checked')"), "true", `${name}: bay 1 picked`);
      assert.match(await text(p, "[data-shop-buy=bare-knuckle]"), /Trade in/);
      const before = P.credits;
      await click(p, "[data-shop-buy=bare-knuckle]");
      await until(p, "game.profile.bikes[0].model === 'bare-knuckle'", `${name}: traded into bay 1`);
      P = await prof(p);
      assert.deepEqual(P.bikes.map((b) => b.model), ["bare-knuckle", "glidewire", "forgeback"], `${name}: the other bays keep their bikes`);
      assert.equal(P.ride, 0);
      assert.ok(P.credits > before - 12500 && P.credits < before, `${name}: the trade-in's value came off`);
      assert.deepEqual(errs, [], `${name}: no page errors`);
      await ctx.close();
    }
  }
  console.log("Holeshot showroom: filters, all nineteen shown, preview on the turntable, compare (rows and the one line), the disabled buy with credits needed, the bay picker (tiles, trade-ins marked), buy into the empty bay and a trade-in into bay 1; 1440 and 390, day and night.");
} finally {
  await browser.close();
  await server.close();
}
