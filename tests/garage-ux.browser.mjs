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
    await until(p, "window.game && game.getSnapshot().screen === 'menu'", `${name}: the saved profile loads`);
    await click(p, "[data-go=garage]");
    await until(p, "root.querySelector('.dh-preview').width > 50 && root.querySelector('.dh-preview').getAttribute('aria-valuenow') !== null", `${name}: the turntable draws`);
    const ink0 = await ink(p);
    // ---- the dock stays in view while the showroom's list scrolls under it ----
    await click(p, "[data-gtab=showroom]");
    await until(p, "root.querySelectorAll('.dh-show [data-pv^=\"bike:\"]').length === 19", `${name}: the showroom lists all nineteen bikes`);
    const dock = () => $(p, "(() => { const d = root.querySelector('.dh-dock').getBoundingClientRect(), v = root.querySelector('.dh-preview').getBoundingClientRect(), s = root.querySelector('[data-gtab=showroom]').getBoundingClientRect(), l = root.querySelector('.dh-classes').getBoundingClientRect(); return { top: d.top, bottom: d.bottom, pv: [v.top, v.bottom, v.height], seg: [s.top, s.bottom], list: l.top, scroll: root.querySelector('.dh-cards').scrollTop, H: innerHeight }; })()");
    await $(p, "root.querySelector('.dh-cards').scrollTop = 1e6");
    await until(p, "root.querySelector('.dh-cards').scrollTop > 400", `${name}: the list scrolls`);
    const D = await dock();
    assert.ok(D.top >= -1 && D.top <= 2, `${name}: the dock is pinned to the top (${D.top})`);
    assert.ok(D.pv[0] >= 0 && D.pv[1] <= D.H && D.pv[2] >= 100, `${name}: the whole turntable is in view (${D.pv})`);
    assert.ok(D.seg[0] >= 0 && D.seg[1] <= D.bottom + 1, `${name}: the garage tabs are in the dock`);
    assert.ok(D.list < D.top, `${name}: the list went under the dock`);
    assert.ok(D.bottom <= D.H * (name === "landscape" ? 0.62 : 0.58), `${name}: the dock leaves room for the list (${Math.round(D.bottom)} of ${D.H})`);
    await shot(p, `${name}-1-dock-scrolled`);
    // ---- a showroom bike: tap → PREVIEW on the turntable, BUY / CANCEL, the pace against yours ----
    await $(p, "root.querySelector('.dh-cards').scrollTop = 0");
    await inkIs(p, ink0, `${name}: the showroom tab keeps your bike on the turntable`);
    let c = (await prof(p)).credits;
    await click(p, "[data-pv='bike:anvil'] .dh-mod");
    await until(p, "!!root.querySelector('.dh-pin [data-bike=anvil]')", `${name}: the bike is pinned with its BUY`);
    await inkNot(p, ink0, `${name}: the turntable shows the showroom bike`);
    const card = await $(p, "root.querySelector(\"[data-pv='bike:anvil'] .dh-mod b\").textContent");
    assert.ok((await $(p, "root.querySelector('.dh-pvinfo').textContent")).includes(card) && await $(p, "!!root.querySelector('.dh-pvinfo .dh-pvtag')"), `${name}: the dock says PREVIEW and names ${card}`);
    assert.ok(await $(p, "root.querySelectorAll('.dh-pace-bay em').length") >= 2, `${name}: the pace chips show the preview against yours`);
    assert.equal((await prof(p)).credits, c, `${name}: previewing is free`);
    await shot(p, `${name}-2-showroom-preview`);
    await click(p, ".dh-pin [data-untry]");
    await until(p, "!root.querySelector('.dh-pin') && !root.querySelector('.dh-pvtag')", `${name}: CANCEL`);
    await inkIs(p, ink0, `${name}: CANCEL puts your bike back`);
    // ---- a family upgrade (the motor swap on an electric): tap the row ----
    await click(p, "[data-gtab=bike]");
    await click(p, "[data-pv='mod:swap'] .dh-mod");
    await until(p, "!!root.querySelector('.dh-pin [data-mod=swap]')", `${name}: the upgrade is pinned with its FIT`);
    await inkNot(p, ink0, `${name}: the turntable shows the swap`);
    assert.ok(await $(p, "[...root.querySelectorAll('.dh-pace-bay em')].some((e) => e.dataset.d === 'up')"), `${name}: the swap's pace is better somewhere`);
    await shot(p, `${name}-3-mod-preview`);
    await click(p, ".dh-pin [data-untry]");
    await inkIs(p, ink0, `${name}: CANCEL takes the swap off again`);
    // ---- a paint: tap tries it on (pinned), CANCEL restores ----
    await click(p, "[data-gtab=look]");
    await click(p, "[data-dress=paint][data-id=magma]");
    await until(p, "!!root.querySelector('.dh-pin [data-buytrial]')", `${name}: the paint is pinned with its BUY`);
    await inkNot(p, ink0, `${name}: the turntable wears the paint`);
    assert.match(await $(p, "root.querySelector('.dh-pin').textContent"), /PREVIEW.*PAINT SCHEME.*BUY.*CANCEL/s);
    await shot(p, `${name}-4-paint-preview`);
    await click(p, ".dh-pin [data-untry]");
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
      await click(p, "[data-gtab=look]");
      await $(p, "root.querySelector('[data-dress=paint][data-id=magma]').focus()");
      await until(p, "/Preview: PAINT SCHEME/.test(root.querySelector('.dh-live').textContent)", `${name}: focus announces the preview`);
      await inkNot(p, ink0, `${name}: focus previews it`);
      await $(p, "root.querySelector('[data-go=garage]').focus()");
      await inkIs(p, ink0, `${name}: focus elsewhere restores`);
    }
    // ---- the plinth against the preview's background: 3:1 or more ----
    const px = await $(p, "(() => { const c = root.querySelector('.dh-preview'), g = c.getContext('2d'), at = (x, y) => [...g.getImageData(Math.round(x * c.width), Math.round(y * c.height), 1, 1).data].slice(0, 3); return { bg: at(0.03, 0.97), top: [at(0.42, 0.75), at(0.58, 0.75), at(0.5, 0.78)] }; })()");
    const worst = Math.min(...px.top.map((t) => contrast(t, px.bg)));
    assert.ok(worst >= 3, `${name} (${path === "/" ? "dark" : "light"}): plinth vs background ${worst.toFixed(2)}:1 (${JSON.stringify(px)})`);
    console.log(`  ${name}: dock bottom ${Math.round(D.bottom)} of ${D.H} px, plinth contrast ${worst.toFixed(2)}:1`);
    assert.deepEqual(errs, [], `${name}: no page errors`);
    await ctx.close();
  }
  // The other theme's plinth (dark at 390, light at 1440).
  for (const [path, w, h] of [["/", 390, 844], ["/day", 1440, 900]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript((s) => localStorage.setItem("holeshot:profile", s), JSON.stringify(SAVE));
    const p = await ctx.newPage();
    await p.goto(server.url + path);
    await until(p, "window.game && game.getSnapshot().screen === 'menu'", "loads");
    await click(p, "[data-go=garage]");
    await until(p, "root.querySelector('.dh-preview').getAttribute('aria-valuenow') !== null && root.querySelector('.dh-preview').width > 50", "draws");
    await until(p, "(() => { const c = root.querySelector('.dh-preview'); return c.getContext('2d').getImageData(c.width >> 1, Math.round(c.height * 0.75), 1, 1).data[3] === 255; })()", "drawn");
    const px = await $(p, "(() => { const c = root.querySelector('.dh-preview'), g = c.getContext('2d'), at = (x, y) => [...g.getImageData(Math.round(x * c.width), Math.round(y * c.height), 1, 1).data].slice(0, 3); return { bg: at(0.03, 0.97), top: [at(0.42, 0.75), at(0.58, 0.75), at(0.5, 0.78)] }; })()");
    const worst = Math.min(...px.top.map((t) => contrast(t, px.bg)));
    assert.ok(worst >= 3, `${w} ${path === "/" ? "dark" : "light"}: plinth vs background ${worst.toFixed(2)}:1`);
    console.log(`  ${w} ${path === "/" ? "dark" : "light"}: plinth contrast ${worst.toFixed(2)}:1`);
    await ctx.close();
  }
  console.log("Holeshot garage UX: the dock stays in view while the lists scroll (1440, 390, 844×390); tap a showroom bike, an upgrade or a paint → PREVIEW on the turntable with BUY / CANCEL and the pace against yours, CANCEL restores; pointing and focus preview too; the plinth ≥ 3:1 in dark and light.");
} finally {
  await browser.close();
  await server.close();
}
