// The garage's dock and live preview in Chromium (the built dist/holeshot.mjs): at 1440 (mouse, dark),
// 390 (touch, light) and 844×390 (touch, dark, the compact dock) the dock (the turntable, the bike's
// info, your bikes, the garage tabs) stays in view while the lists scroll under it; tapping a paint,
// a family upgrade or a showroom bike changes the turntable's render (a pixel hash) and pins a
// PREVIEW with BUY and CANCEL, the pace chips show the preview against yours, and CANCEL puts the
// same render back; at 1440, pointing at a showroom bike previews it and moving away restores it, and
// keyboard focus on a swatch announces the preview. The plinth stands out from the preview's
// background (3:1 or more by night; by day, TRACK's orange on green, by hue). Waits on state, never on time. MEDIA=<dir> saves
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
// The plinth stands out: 3:1 or more by night (SUNSET's violet on the dark floor); by day TRACK's
// orange disc on the green field is the owner's design (about 1.1:1 in luminance), so there the hue
// carries it: 120 or more apart in summed RGB (measured about 220).
const stands = (t, bg, dark) => (dark ? contrast(t, bg) >= 3 : Math.abs(t[0] - bg[0]) + Math.abs(t[1] - bg[1]) + Math.abs(t[2] - bg[2]) >= 120);
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
    await until(p, "root.querySelectorAll('.dh-showroom .shop-cat-item').length === 19", `${name}: the showroom lists all nineteen bikes`);
    const dock = () => $(p, "(() => { const d = root.querySelector('.shop-cat-pv').getBoundingClientRect(), v = root.querySelector('.dh-preview').getBoundingClientRect(); return { top: d.top, bottom: d.bottom, pv: [v.top, v.bottom, v.height], scroll: (() => { const l = root.querySelector('.dh-showroom .shop-cat-list'); return l && getComputedStyle(l).overflowY === 'auto' ? l : root.querySelector('.dh-cards'); })().scrollTop, H: innerHeight }; })()");
    // (The list scrolls: inside its own panel on a desktop, the page on a phone.)
    await $(p, "(() => { const l = root.querySelector('.dh-showroom .shop-cat-list'); return l && getComputedStyle(l).overflowY === 'auto' ? l : root.querySelector('.dh-cards'); })().scrollTop = 1e6");
    await until(p, "(() => { const l = root.querySelector('.dh-showroom .shop-cat-list'); return l && getComputedStyle(l).overflowY === 'auto' ? l : root.querySelector('.dh-cards'); })().scrollTop > 400", `${name}: the list scrolls`);
    const D = await dock();
    if (name === "desktop") {
      assert.ok(D.pv[0] >= 0 && D.pv[1] <= D.H && D.pv[2] >= 100, `${name}: the preview's turntable stays in view (${D.pv})`);
      assert.ok(await $(p, "root.querySelector('.dh-ghead').getBoundingClientRect().top >= -1"), `${name}: the header stays at the top`);
    }
    await shot(p, `${name}-1-scrolled`);
    // ---- a showroom bike: tap its picture → on the turntable in the showroom's preview, the pace
    // against yours; back to the garage puts your bike back ----
    await $(p, "root.querySelector('.dh-cards').scrollTop = 0");
    let c = (await prof(p)).credits;
    await click(p, "[data-gtab=showroom]");
    await click(p, "[data-shop-pick=razorhive]");
    await until(p, "root.querySelector('[data-shop-pick=razorhive]').getAttribute('aria-pressed') === 'true'", `${name}: the bike is on the turntable`);
    await inkNot(p, ink0, `${name}: the turntable shows the showroom bike`);
    const card = await $(p, "root.querySelector('[data-shop-id=razorhive] .shop-name').textContent");
    assert.ok((await $(p, "root.querySelector('.shop-cat-pv .shop-title').textContent")).includes(card), `${name}: the preview names ${card}`);
    assert.equal(await $(p, "root.querySelectorAll('.shop-cat-cmp .shop-stat em').length"), 3, `${name}: the pace tiles show it against yours`);
    assert.equal((await prof(p)).credits, c, `${name}: previewing is free`);
    await shot(p, `${name}-2-showroom-preview`);
    await click(p, "[data-gtab=garage]");
    await inkIs(p, ink0, `${name}: the garage puts your bike back`);
    // ---- a family upgrade (the motor swap on an electric): tap the row ----
    await click(p, "[data-gtab=garage]");
    await click(p, "[data-gsub=up]");
    await click(p, "[data-pv='mod:swap']");
    await until(p, "!!root.querySelector('.shop-preview [data-mod=swap]')", `${name}: the upgrade preview with its FIT`);
    assert.match(await $(p, "root.querySelector('.shop-preview').textContent"), /Motor swap.*→/s, `${name}: the preview names it and shows before → after`);
    await inkNot(p, ink0, `${name}: the turntable shows the swap`);
    assert.ok(await $(p, "[...root.querySelectorAll('.dh-pace-bay em')].some((e) => e.dataset.d === 'up')"), `${name}: the swap's pace is better somewhere`);
    await shot(p, `${name}-3-mod-preview`);
    await click(p, "[data-gsub=cond]");
    await inkIs(p, ink0, `${name}: leaving the tab takes the swap off again`);
    // ---- a paint: tap tries it on (pinned), CANCEL restores ----
    await click(p, "[data-gtab=look]");
    await $(p, "root.querySelector(\"[data-page='1']\")?.click()"), await click(p, "[data-dress=paint][data-id=magma]");
    await until(p, "!!root.querySelector('.shop-pin [data-buytrial]')", `${name}: the paint is pinned with its BUY`);
    await inkNot(p, ink0, `${name}: the turntable wears the paint`);
    assert.match(await $(p, "root.querySelector('.shop-pin').textContent"), /Previewing Magma.*Cancel.*Buy/s);
    await shot(p, `${name}-4-paint-preview`);
    await click(p, ".shop-pin [data-untry]");
    await inkIs(p, ink0, `${name}: CANCEL takes the paint off`);
    assert.equal((await prof(p)).bikes[0].look.paint, "acid", `${name}: nothing was bought`);
    if (!touch) {
      // ---- pointing: hover an upgrade previews it; moving off restores ----
      await click(p, "[data-gtab=bike]");
      await click(p, "[data-gsub=up]");
      const at = await $(p, "(() => { const e = root.querySelector('[data-pv=\"mod:swap\"]'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + 40, y: r.y + 20 }; })()");
      await p.mouse.move(at.x, at.y);
      await until(p, "!!root.querySelector('.dh-pvinfo .dh-pvtag')", `${name}: pointing shows PREVIEW`);
      await inkNot(p, ink0, `${name}: pointing swaps the turntable's bike`);
      await shot(p, `${name}-5-hover`);
      await p.mouse.move(5, 5);
      await until(p, "!root.querySelector('.dh-pvinfo .dh-pvtag')", `${name}: moving off`);
      await inkIs(p, ink0, `${name}: moving off restores your bike`);
      await $(p, "root.querySelector('.dh-cards').scrollTop = 0");
      // ---- keyboard: focus on a swatch previews it and says so ----
      await click(p, "[data-gtab=garage]");
      await click(p, "[data-gtab=look]");
      await $(p, "root.querySelector(\"[data-page='1']\")?.click()"), await $(p, "root.querySelector('[data-dress=paint][data-id=magma]').focus()");
      await until(p, "/Preview: PAINT SCHEME/.test(root.querySelector('.dh-live').textContent)", `${name}: focus announces the preview`);
      await inkNot(p, ink0, `${name}: focus previews it`);
      await $(p, "root.querySelector('.dh-letsride').focus()");
      await inkIs(p, ink0, `${name}: focus elsewhere restores`);
    }
    // ---- the plinth against the preview's background (`stands`) ----
    const px = await $(p, "(() => { const c = root.querySelector('.dh-preview'), g = c.getContext('2d'), at = (x, y) => [...g.getImageData(Math.round(x * c.width), Math.round(y * c.height), 1, 1).data].slice(0, 3); return { bg: at(0.03, 0.97), top: [at(0.42, 0.75), at(0.58, 0.75), at(0.5, 0.78)] }; })()");
    const worst = Math.min(...px.top.map((t) => contrast(t, px.bg)));
    assert.ok(px.top.every((t) => stands(t, px.bg, path === "/")), `${name} (${path === "/" ? "dark" : "light"}): plinth vs background ${worst.toFixed(2)}:1 (${JSON.stringify(px)})`);
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
    assert.ok(px.top.every((t) => stands(t, px.bg, path === "/")), `${w} ${path === "/" ? "dark" : "light"}: plinth vs background ${worst.toFixed(2)}:1 (${JSON.stringify(px)})`);
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
    // (The portrait lives on the header's Rider key, and follows what you try on; no block in the bike panel.)
    assert.equal(await $(p, "root.querySelector('.dh-face')"), null, `${name}: no portrait block in the bike panel`);
    const svg = () => $(p, "root.querySelector('.dh-who .dh-helm').outerHTML");
    let was = await svg();
    for (const [slot, id, sees] of [["helmet", "duck", "data-helmet=\"duck\""], ["helmetPaint", "gold", "#ffd166"], ["visor", "gold", "#c9922a"]]) {
      if (slot !== "helmet") await click(p, `[data-gslot=${slot}]`);
      await click(p, `[data-dress=${slot}][data-id=${id}]`);
      await until(p, `root.querySelector('.dh-who .dh-helm').outerHTML !== ${JSON.stringify(was)}`, `${name}: the portrait follows the ${slot}`);
      const now = await svg();
      if (sees) assert.ok(now.includes(sees), `${name}: the portrait shows ${slot} ${id}`);
      was = now;
      await click(p, ".shop-pin [data-untry]");
      await until(p, "!root.querySelector('.shop-pin')", `${name}: CANCEL`);
      was = await svg();
    }
    // Head-on (Home, then 90° round): inside the white helmet's box, the goggle's dark band and lens
    // (measured: 9–27 % of the box; the helmet before the goggle was 1–4 %, its edges only). The white
    // is neutral or a little blue, in the middle third, where the head-on rider stands (TRACK's cream
    // track edges, off to the sides and yellower, stay out of the helmet's box).
    await $(p, "root.querySelector('.dh-preview').focus()");
    await p.keyboard.press("Home");
    for (let i = 0; i < 6; i++) await p.keyboard.press("ArrowLeft");
    await until(p, "root.querySelector('.dh-preview').getAttribute('aria-valuenow') === '81'", `${name}: the turntable faces the rider head-on`);
    const face = await $(p, `(() => { const c = root.querySelector('.dh-preview'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, W = c.width, H = Math.round(c.height * 0.5);
      let x0 = W, x1 = -1, y0 = H, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = Math.round(W / 3); x < (2 * W) / 3; x++) { const i = (y * W + x) * 4; if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200 && d[i + 2] - d[i] > -10 && d[i + 2] - d[i] < 24) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
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
  // ---- the turntable's frame is locked: its box and the pace tiles' box stay put (0.5 px) across backdrop
  // toggles, bike switches, every tab (Paint & Kit's Bike, Rider gear, Outfits; Parts & Mods'), pointing at a
  // scheme, a helmet or an upgrade, a pinned preview, and showroom picks; 1440 and 390 ----
  for (const [w, h, touch] of [[1440, 900, false], [390, 844, true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((s) => localStorage.setItem("holeshot:profile", s), JSON.stringify({ ...SAVE, slots: 3, bikes: [...SAVE.bikes, { ...SAVE.bikes[0], uid: "b2", model: "anvil", look: { paint: "pinkout", number: 8 } }] }));
    const p = await ctx.newPage();
    await p.goto(server.url + "/");
    await until(p, "window.game && game.getSnapshot().screen === 'garage' && root.querySelector('.dh-preview').width > 50", `${w}: loads`);
    const box = (sel) => $(p, `(() => { const r = root.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.width, r.height, r.left, r.top + (root.querySelector('.dh-cards').scrollTop || 0)]; })()`);
    const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 0.5);
    // (The turntable's box on screen: on a phone it is pinned under the header, so the page's scroll never moves it.)
    const turn = () => $(p, "(() => { const r = root.querySelector('.dh-bikep .shop-turn').getBoundingClientRect(); return [r.width, r.height, r.left, r.top]; })()");
    const T0 = await turn(), S0 = await box(".dh-pace-bay");
    const check = async (what) => {
      await p.waitForTimeout(60);
      const T = await turn(), S = await box(".dh-pace-bay");
      assert.ok(same(T, T0), `${w}: ${what}: the turntable stays put (${T0} → ${T})`);
      assert.ok(same(S, S0), `${w}: ${what}: the pace tiles stay put (${S0} → ${S})`);
    };
    const hover = async (sel) => { if (touch) await $(p, `root.querySelector(${JSON.stringify(sel)}).focus()`); else { await $(p, `root.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'center' })`); await p.locator(sel).first().hover(); } };
    for (const b of ["track", "sunset", "auto"]) await click(p, "[data-gmenu=backdrop]"), await until(p, "!!root.querySelector('[data-backdrop]')", "backdrop picker open"), await check("backdrop picker open"), await click(p, `[data-backdrop=${b}]`), await until(p, "!root.querySelector('[data-backdrop]')", "backdrop picker folded"), await check(`backdrop ${b}`);
    await click(p, "[data-turn='1']"), await until(p, "game.profile.ride === 1", "bike 2"), await check("‹ › bike switch");
    await click(p, "[data-turn='1']"), await until(p, "game.profile.ride === 0", "bike 1"), await check("‹ › back");
    for (const s of ["tune", "up", "log", "cond"]) await click(p, `[data-gsub=${s}]`), await check(`Parts & Mods › ${s}`);
    await click(p, "[data-gsub=up]");
    await hover("[data-pv^='mod:']"), await check("pointing at an upgrade");
    await click(p, "[data-pv^='mod:']"), await until(p, "!!root.querySelector('.dh-pvtag')", "upgrade preview"), await check("a pinned upgrade preview");
    await click(p, "[data-gtab=look]"), await check("Paint & Kit › Bike");
    await hover("[data-dress=paint]:not([data-eq])"), await check("pointing at a scheme");
    await click(p, "[data-dress=paint]:not([data-eq])"), await until(p, "!!root.querySelector('.dh-pvtag')", "scheme preview"), await check("a pinned scheme (PREVIEW over the turntable)");
    assert.equal(await $(p, "getComputedStyle(root.querySelector('.dh-bayline')).position"), "absolute", `${w}: the PREVIEW tag is an overlay`);
    await click(p, "[data-untry]");
    await click(p, "[data-look=rider]"), await check("Paint & Kit › Rider gear");
    await hover("[data-dress=helmet]:not([data-eq])"), await check("pointing at a helmet");
    await click(p, "[data-look=outfit]"), await check("Paint & Kit › Outfits");
    await click(p, "[data-gtab=bike]"), await check("back to Parts & Mods");
    // The showroom: the very same turntable, in the same place and size as the garage's (owner, 2026-11-20),
    // across its picks, a comparison, a destination and back to the garage.
    await click(p, "[data-gtab=showroom]");
    await until(p, "root.querySelectorAll('.shop-cat-item').length === 19 && root.querySelector('.dh-srside .shop-cat-pv') && root.querySelector('.dh-bikep .shop-turn .dh-preview')", `${w}: showroom`);
    const onTurn = async (what) => { await p.waitForTimeout(60); const F = await turn(); assert.ok(same(F, T0), `${w}: ${what}: the turntable is the garage's, unmoved (${T0} → ${F})`); };
    await onTurn("Showroom tab");
    for (const id of ["forgeback", "bare-knuckle", "glidewire", "nectar-burn"]) await click(p, `[data-shop-pick="${id}"]`), await onTurn(`showroom pick ${id}`);
    await click(p, "[data-shop-cmp]"), await onTurn("showroom compare");
    await click(p, "[data-shop-back]");
    await click(p, "[data-shop-set=slot]:not([aria-checked=true])"), await onTurn("showroom destination");
    await click(p, "[data-gtab=garage]"), await onTurn("back to the garage");
    await ctx.close();
  }
  console.log("Holeshot garage UX: the turntable's frame and the pace tiles locked (0.5 px) across backdrops, bikes, every tab, pointing and pinned previews, showroom picks, compare and destination; the garage and the showroom share one turntable box (1440, 390); the bike panel stays in view while the showroom scrolls (its preview) (1440); a showroom bike on the turntable with its pace against yours; an upgrade or a paint → PREVIEW with BUY / CANCEL, CANCEL restores; pointing and focus preview too; the plinth stands out (3:1 by night, its hue by day); the helmet portrait by the name and on RIDER KIT follows the shape, paint and visor, and head-on the goggle reads.");
} finally {
  await browser.close();
  await server.close();
}
