// The garage's dock and live preview in Chromium (the built dist/holeshot.mjs): at 1440 (mouse, dark),
// 390 (touch, light) and 844×390 (touch, dark, the compact dock) the dock (the turntable, the bike's
// info, your bikes, the garage tabs) stays in view while the lists scroll under it; tapping a paint,
// a family upgrade or a showroom bike changes the turntable's render (a pixel hash) and pins a
// PREVIEW with BUY and CANCEL, the pace chips show the preview against yours, and CANCEL puts the
// same render back; at 1440, pointing at a showroom bike previews it and moving away restores it, and
// keyboard focus on a swatch announces the preview. The plinth stands out from the preview's
// background (contrast 3:1 or more, dark and light). Waits on state, never on time. MEDIA=<dir> saves
// screenshots.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const MEDIA = process.env.MEDIA;
if (MEDIA) mkdirSync(MEDIA, { recursive: true });
const page = (theme) => `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false });</script></body></html>`;
const server = await serve(".", { "/": page("dark"), "/day": page("light") });
const browser = await chromium.launch(launchOptions());
const SAVE = {
  v: 1, name: "KIP", credits: 60000, ride: 0, owned: [], pit: 0, stats: { events: 3, wins: 0, earned: 900, best: {} },
  kit: { helmet: "peak", helmetPaint: "white", visor: "smoke", jersey: "lime", pants: "ink", pattern: "stripe", boots: "white", gloves: "ink" },
  bikes: [{ uid: "b1", model: "sparkhound", parts: { tyres: 1, chain: 1, motor: 1, susp: 1, brakes: 1 }, look: { paint: "acid", number: 23 }, dmg: { bars: 0, plastics: 0 }, odo: 3000, events: 3 }],
};
const root = "document.querySelector('[data-fizlet-host]').shadowRoot";
const $ = (p, fn, arg) => p.evaluate(`((root, arg) => (${fn}))(${root}, ${JSON.stringify(arg ?? null)})`);
const click = (p, sel) => $(p, "root.querySelector(arg).click()", sel);
const until = (p, fn, what, timeout = 20000) => p.waitForFunction(`((root) => (${fn}))(${root})`, null, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const prof = (p) => p.evaluate(() => JSON.parse(JSON.stringify(game.profile)));
// The turntable's render, hashed; the preview draws on change, so wait for the hash to move (or settle).
const INK = "(() => { const c = root.querySelector('.dh-preview'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 16) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0; return h; })()";
const ink = (p) => $(p, INK);
const inkNot = (p, h, what) => until(p, `${INK} !== ${h}`, what);
const inkIs = (p, h, what) => until(p, `${INK} === ${h}`, what);
const shot = async (p, name) => MEDIA && p.screenshot({ path: `${MEDIA}/${name}.png` });
// WCAG contrast of two [r, g, b].
const lum = ([r, g, b]) => { const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

try {
  for (const [name, viewport, touch, path] of [["desktop", { width: 1440, height: 900 }, false, "/"], ["phone", { width: 390, height: 844 }, true, "/day"], ["landscape", { width: 844, height: 390 }, true, "/"]]) {
    const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) localStorage.setItem("holeshot:profile", s), sessionStorage.setItem("seeded", "1"); }, JSON.stringify(SAVE));
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(server.url + path);
    await until(p, "window.game && game.getSnapshot().screen === 'garage'", `${name}: the saved profile loads`);
    await until(p, "root.querySelector('.dh-preview').width > 50 && root.querySelector('.dh-preview').getAttribute('aria-valuenow') !== null", `${name}: the turntable draws`);
    // (The first frames settle the layout: the preview redraws once at its final size.)
    await p.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
    const ink0 = await ink(p);
    // ---- the showroom (mounted into the garage's Showroom tab); at 1440 the bike panel stays in view while the list scrolls ----
    await click(p, "[data-gtab=showroom]");
    await until(p, "root.querySelectorAll('.dh-showroom .dh-show [data-pv^=\"bike:\"]').length === 19", `${name}: the showroom lists all nineteen bikes`);
    const dock = () => $(p, "(() => { const d = root.querySelector('.dh-bikep').getBoundingClientRect(), v = root.querySelector('.dh-preview').getBoundingClientRect(); return { top: d.top, bottom: d.bottom, pv: [v.top, v.bottom, v.height], scroll: root.querySelector('.dh-cards').scrollTop, H: innerHeight }; })()");
    await $(p, "root.querySelector('.dh-cards').scrollTop = 1e6");
    await until(p, "root.querySelector('.dh-cards').scrollTop > 400", `${name}: the list scrolls`);
    const D = await dock();
    if (name === "desktop") {
      assert.ok(D.pv[0] >= 0 && D.pv[1] <= D.H && D.pv[2] >= 100, `${name}: the bike panel's turntable stays in view (${D.pv})`);
      assert.ok(await $(p, "root.querySelector('.dh-ghead').getBoundingClientRect().top >= -1"), `${name}: the header stays at the top`);
    }
    await shot(p, `${name}-1-scrolled`);
    // ---- a showroom bike: tap → PREVIEW on the turntable, BUY / CANCEL, the pace against yours ----
    await $(p, "root.querySelector('.dh-cards').scrollTop = 0");
    await inkIs(p, ink0, `${name}: the showroom tab keeps your bike on the turntable`);
    let c = (await prof(p)).credits;
    await click(p, "[data-pv='bike:anvil'] .dh-mod");
    await until(p, "!!root.querySelector('.dh-pin [data-bike=anvil]')", `${name}: the bike is pinned with its BUY`);
    await inkNot(p, ink0, `${name}: the turntable shows the showroom bike`);
    const card = await $(p, "root.querySelector(\"[data-pv='bike:anvil'] .dh-mod b\").textContent");
    assert.ok((await $(p, "root.querySelector('.dh-pvinfo').textContent")).toLowerCase().includes(card.split(" ").slice(1).join(" ").toLowerCase()) && await $(p, "!!root.querySelector('.dh-pvinfo .dh-pvtag')"), `${name}: the dock says PREVIEW and names ${card}`);
    assert.ok(await $(p, "root.querySelectorAll('.dh-pace-bay em').length") >= 2, `${name}: the pace chips show the preview against yours`);
    assert.equal((await prof(p)).credits, c, `${name}: previewing is free`);
    await shot(p, `${name}-2-showroom-preview`);
    await click(p, ".dh-pin [data-untry]");
    await until(p, "!root.querySelector('.dh-pin') && !root.querySelector('.dh-pvtag')", `${name}: CANCEL`);
    await inkIs(p, ink0, `${name}: CANCEL puts your bike back`);
    // ---- a family upgrade (the motor swap on an electric): tap the row ----
    await click(p, "[data-gtab=garage]");
    await click(p, "[data-gsub=up]");
    await click(p, "[data-pv='mod:swap']");
    await until(p, "!!root.querySelector('.lk-preview [data-mod=swap]')", `${name}: the upgrade preview with its FIT`);
    assert.match(await $(p, "root.querySelector('.lk-preview').textContent"), /Motor swap.*→/s, `${name}: the preview names it and shows before → after`);
    await inkNot(p, ink0, `${name}: the turntable shows the swap`);
    assert.ok(await $(p, "[...root.querySelectorAll('.dh-pace-bay em')].some((e) => e.dataset.d === 'up')"), `${name}: the swap's pace is better somewhere`);
    await shot(p, `${name}-3-mod-preview`);
    await click(p, "[data-gsub=cond]");
    await inkIs(p, ink0, `${name}: leaving the tab takes the swap off again`);
    // ---- a paint: tap tries it on (pinned), CANCEL restores ----
    await click(p, "[data-gtab=look]");
    await $(p, "root.querySelector(\"[data-page='1']\")?.click()"), await click(p, "[data-dress=paint][data-id=magma]");
    await until(p, "!!root.querySelector('.lk-pin [data-buytrial]')", `${name}: the paint is pinned with its BUY`);
    await inkNot(p, ink0, `${name}: the turntable wears the paint`);
    assert.match(await $(p, "root.querySelector('.lk-pin').textContent"), /Previewing Magma.*Cancel.*Buy/s);
    await shot(p, `${name}-4-paint-preview`);
    await click(p, ".lk-pin [data-untry]");
    await inkIs(p, ink0, `${name}: CANCEL takes the paint off`);
    assert.equal((await prof(p)).bikes[0].look.paint, "acid", `${name}: nothing was bought`);
    if (!touch) {
      // ---- pointing: hover a showroom card previews it; moving off restores ----
      await click(p, "[data-gtab=showroom]");
      const at = await $(p, "(() => { const r = root.querySelector('[data-pv=\"bike:razorhive\"]').getBoundingClientRect(); return { x: r.x + 40, y: r.y + 20 }; })()");
      await p.mouse.move(at.x, at.y);
      await until(p, "!!root.querySelector('.dh-pvinfo .dh-pvtag')", `${name}: pointing shows PREVIEW`);
      await inkNot(p, ink0, `${name}: pointing swaps the turntable's bike`);
      await shot(p, `${name}-5-hover`);
      await p.mouse.move(5, 5);
      await until(p, "!root.querySelector('.dh-pvinfo .dh-pvtag')", `${name}: moving off`);
      await inkIs(p, ink0, `${name}: moving off restores your bike`);
      // ---- keyboard: focus on a swatch previews it and says so ----
      await click(p, "[data-gtab=garage]");
      await click(p, "[data-gtab=look]");
      await $(p, "root.querySelector(\"[data-page='1']\")?.click()"), await $(p, "root.querySelector('[data-dress=paint][data-id=magma]').focus()");
      await until(p, "/Preview: PAINT SCHEME/.test(root.querySelector('.dh-live').textContent)", `${name}: focus announces the preview`);
      await inkNot(p, ink0, `${name}: focus previews it`);
      await $(p, "root.querySelector('.dh-letsride').focus()");
      await inkIs(p, ink0, `${name}: focus elsewhere restores`);
    }
    // ---- the plinth against the preview's background: 3:1 or more ----
    const px = await $(p, "(() => { const c = root.querySelector('.dh-preview'), g = c.getContext('2d'), at = (x, y) => [...g.getImageData(Math.round(x * c.width), Math.round(y * c.height), 1, 1).data].slice(0, 3); return { bg: at(0.03, 0.97), top: [at(0.42, 0.75), at(0.58, 0.75), at(0.5, 0.78)] }; })()");
    const worst = Math.min(...px.top.map((t) => contrast(t, px.bg)));
    assert.ok(worst >= 3, `${name} (${path === "/" ? "dark" : "light"}): plinth vs background ${worst.toFixed(2)}:1 (${JSON.stringify(px)})`);
    console.log(`  ${name}: bike panel ${Math.round(D.top)}–${Math.round(D.bottom)} of ${D.H} px, plinth contrast ${worst.toFixed(2)}:1`);
    assert.deepEqual(errs, [], `${name}: no page errors`);
    await ctx.close();
  }
  // The other theme's plinth (dark at 390, light at 1440).
  for (const [path, w, h] of [["/", 390, 844], ["/day", 1440, 900]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript((s) => localStorage.setItem("holeshot:profile", s), JSON.stringify(SAVE));
    const p = await ctx.newPage();
    await p.goto(server.url + path);
    await until(p, "window.game && game.getSnapshot().screen === 'garage'", "loads");
    await until(p, "root.querySelector('.dh-preview').getAttribute('aria-valuenow') !== null && root.querySelector('.dh-preview').width > 50", "draws");
    await until(p, "(() => { const c = root.querySelector('.dh-preview'); return c.getContext('2d').getImageData(c.width >> 1, Math.round(c.height * 0.75), 1, 1).data[3] === 255; })()", "drawn");
    const px = await $(p, "(() => { const c = root.querySelector('.dh-preview'), g = c.getContext('2d'), at = (x, y) => [...g.getImageData(Math.round(x * c.width), Math.round(y * c.height), 1, 1).data].slice(0, 3); return { bg: at(0.03, 0.97), top: [at(0.42, 0.75), at(0.58, 0.75), at(0.5, 0.78)] }; })()");
    const worst = Math.min(...px.top.map((t) => contrast(t, px.bg)));
    assert.ok(worst >= 3, `${w} ${path === "/" ? "dark" : "light"}: plinth vs background ${worst.toFixed(2)}:1`);
    console.log(`  ${w} ${path === "/" ? "dark" : "light"}: plinth contrast ${worst.toFixed(2)}:1`);
    await ctx.close();
  }
  // ---- the rider's helmet: the portrait (the racer's profile picture) beside the name and big while
  // dressing the rider, coloured and shaped live from the kit; the turntable closes in on the rider, and
  // head-on the goggle (its band, the lens, the glint) reads on the helmet, never just a blob ----
  for (const [path, w, h, theme] of [["/", 1440, 900, "dark"], ["/day", 1440, 900, "light"], ["/day", 390, 844, "light"], ["/", 390, 844, "dark"]]) {
    const name = `${w} ${theme}`, ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500 });
    await ctx.addInitScript((s) => localStorage.setItem("holeshot:profile", s), JSON.stringify(SAVE));
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(server.url + path);
    await until(p, "window.game && game.getSnapshot().screen === 'garage'", `${name}: loads`);
    assert.ok(await $(p, "!!root.querySelector('.dh-who .dh-helm[data-helmet=peak]')"), `${name}: the name chip wears the helmet portrait`);
    await click(p, "[data-gtab=look]");
    await click(p, "[data-look=rider]");
    await until(p, "!!root.querySelector('.dh-face .dh-helm[role=img]')", `${name}: RIDER KIT shows the big portrait`);
    const svg = () => $(p, "root.querySelector('.dh-face .dh-helm').outerHTML");
    let was = await svg();
    for (const [slot, id, sees] of [["helmet", "duck", "data-helmet=\"duck\""], ["helmetPaint", "gold", "#ffd166"], ["visor", "gold", "#c9922a"]]) {
      if (slot !== "helmet") await click(p, `[data-gslot=${slot}]`);
      await click(p, `[data-dress=${slot}][data-id=${id}]`);
      await until(p, `root.querySelector('.dh-face .dh-helm').outerHTML !== ${JSON.stringify(was)}`, `${name}: the portrait follows the ${slot}`);
      const now = await svg();
      if (sees) assert.ok(now.includes(sees), `${name}: the portrait shows ${slot} ${id}`);
      was = now;
      await click(p, ".lk-pin [data-untry]");
      await until(p, "!root.querySelector('.lk-pin')", `${name}: CANCEL`);
      was = await svg();
    }
    // Head-on (Home, then 90° round): inside the white helmet's box, the goggle's dark band and lens
    // (measured: 9–27 % of the box; the helmet before the goggle was 1–4 %, its edges only).
    await $(p, "root.querySelector('.dh-preview').focus()");
    await p.keyboard.press("Home");
    for (let i = 0; i < 6; i++) await p.keyboard.press("ArrowLeft");
    await until(p, "root.querySelector('.dh-preview').getAttribute('aria-valuenow') === '81'", `${name}: the turntable faces the rider head-on`);
    const face = await $(p, `(() => { const c = root.querySelector('.dh-preview'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, W = c.width, H = Math.round(c.height * 0.5);
      let x0 = W, x1 = -1, y0 = H, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200 && Math.abs(d[i] - d[i + 2]) < 24) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
      let dark = 0, n = 0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; n++; if (Math.max(d[i], d[i + 1], d[i + 2]) < 60) dark++; }
      return { box: [x0, y0, x1, y1], share: n ? dark / n : 0 }; })()`);
    assert.ok(face.box[2] > face.box[0] && face.share > 0.08, `${name}: head-on, the goggle reads on the helmet (${(face.share * 100).toFixed(1)}% of the helmet's box, ${face.box})`);
    console.log(`  ${name}: head-on goggle ${(face.share * 100).toFixed(1)}% of the helmet`);
    await p.keyboard.press("Home");
    await shot(p, `rider-${w}-${theme}`);
    assert.deepEqual(errs, [], `${name}: no page errors`);
    await ctx.close();
  }
  console.log("Holeshot garage UX: the bike panel stays in view while the showroom scrolls (1440); tap a showroom bike, an upgrade or a paint → PREVIEW on the turntable with BUY / CANCEL and the pace against yours, CANCEL restores; pointing and focus preview too; the plinth ≥ 3:1 in dark and light; the helmet portrait by the name and on RIDER KIT follows the shape, paint and visor, and head-on the goggle reads.");
} finally {
  await browser.close();
  await server.close();
}
