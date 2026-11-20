// The turntable's backdrops against the owner's two designs (Chromium). The designs are the spec:
// tests/fixtures/backdrop/{track,sunset}.webp (1200 × 840; fixtures only, never shipped). Each scene
// (the background, src/garage/backdrop.ts, plus the carousel in the diorama, as the turntable draws
// them, with no bike) is rendered at 1200 × 840 and compared pixel by pixel: the mean colour
// difference per channel and the share of pixels within 16 on every channel, over the whole frame and
// over the carousel's box (its facets get a little more room). Then, in the game (dist/holeshot.mjs)
// at 1440 and 390, garage and showroom: the bike's tyres touch down inside the drawn disc's top, the
// turntable frame keeps its size through every pick and Day / Night, and the art keeps the disc
// whole. MEDIA=<dir> saves the renders, side by sides and difference images.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const harness = (await build({
  stdin: { contents: `import { BACKDROPS, backdropCache, camOf, fitOf, plinth } from "./src/garage/backdrop.ts"; import { diorama } from "@fzlt/core/diorama";
    window.fitOf = fitOf;
    window.render = (id, w, h) => {
      const b = BACKDROPS.find((x) => x.id === id), cv = document.createElement("canvas"), bg = backdropCache()(b, w, h, 1);
      const d = diorama(cv, { light: [-0.4, 1, 0.6], ambient: 0.55, background: () => b.sky, maxDpr: 1 });
      d.resize(w, h, 1);
      d.cluster("bd", { fixed: 0 });
      d.decal("bd", 0, (c) => c.drawImage(bg, 0, 0, w, h));
      d.cluster("pl", { fixed: 1 });
      plinth(d.add, b, "pl");
      Object.assign(d.cam, camOf(w, h, -0.15));
      d.draw();
      return cv;
    };`, resolveDir: ".", loader: "ts" },
  bundle: true, format: "esm", write: false, logLevel: "warning",
})).outputFiles[0].text;
const page = (theme) => `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false, onTheme: () => { const h = document.documentElement; h.dataset.theme = h.dataset.theme === "light" ? "dark" : "light"; } });</script><script type="module">${harness}</script></body></html>`;
const server = await serve(".", { "/": page("dark"), "/day": page("light"), "/bare": `<!doctype html><meta charset="utf-8"><body style="margin:0"><script type="module">${harness}</script></body>` });
const browser = await chromium.launch(launchOptions());
const MEDIA = process.env.MEDIA;
const root = "document.querySelector('[data-fizlet-host]').shadowRoot";
const until = (p, fn, what, timeout = 20000) => p.waitForFunction(`((root) => (${fn}))(${root})`, null, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
// Thresholds: the whole frame and the carousel's box (art x 60–1140, y 515–790).
const LIMIT = { mean: 5, within: 0.92, discMean: 8, discWithin: 0.85 };

try {
  // ---- fidelity: each scene against its design ----
  const p = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  await p.goto(server.url + "/bare");
  await p.waitForFunction(() => window.render);
  for (const id of ["track", "sunset"]) {
    const r = await p.evaluate(async (id) => {
      const W = 1200, H = 840, img = new Image();
      img.src = `/tests/fixtures/backdrop/${id}.webp`;
      await img.decode();
      const ref = document.createElement("canvas");
      (ref.width = W), (ref.height = H);
      const rc = ref.getContext("2d");
      rc.drawImage(img, 0, 0);
      const ours = window.render(id, W, H), a = ours.getContext("2d").getImageData(0, 0, W, H).data, b = rc.getImageData(0, 0, W, H).data;
      const diff = document.createElement("canvas");
      (diff.width = W), (diff.height = H);
      const dc = diff.getContext("2d"), dd = dc.createImageData(W, H);
      const all = { sum: 0, ok: 0, n: 0 }, disc = { sum: 0, ok: 0, n: 0 };
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, dr = Math.abs(a[i] - b[i]), dg = Math.abs(a[i + 1] - b[i + 1]), db = Math.abs(a[i + 2] - b[i + 2]), m = Math.max(dr, dg, db);
        for (const s of x >= 60 && x < 1140 && y >= 515 && y < 790 ? [all, disc] : [all]) (s.sum += dr + dg + db), (s.ok += m <= 16 ? 1 : 0), s.n++;
        (dd.data[i] = dd.data[i + 1] = dd.data[i + 2] = Math.min(255, m * 4)), (dd.data[i + 3] = 255);
      }
      dc.putImageData(dd, 0, 0);
      const side = document.createElement("canvas");
      (side.width = W * 2), (side.height = H);
      const sc = side.getContext("2d");
      sc.drawImage(ours, 0, 0), sc.drawImage(ref, W, 0);
      const blend = document.createElement("canvas");
      (blend.width = W), (blend.height = H);
      const bc = blend.getContext("2d");
      bc.drawImage(ours, 0, 0), (bc.globalAlpha = 0.5), bc.drawImage(ref, 0, 0);
      return { mean: all.sum / all.n / 3, within: all.ok / all.n, discMean: disc.sum / disc.n / 3, discWithin: disc.ok / disc.n, ours: ours.toDataURL(), side: side.toDataURL(), diff: diff.toDataURL(), blend: blend.toDataURL() };
    }, id);
    console.log(`  ${id}: mean ${r.mean.toFixed(2)} per channel, ${(r.within * 100).toFixed(1)} % within 16; carousel box mean ${r.discMean.toFixed(2)}, ${(r.discWithin * 100).toFixed(1)} % within 16`);
    if (MEDIA) for (const k of ["ours", "side", "diff", "blend"]) writeFileSync(`${MEDIA}/${id}-${k}.png`, Buffer.from(r[k].split(",")[1], "base64"));
    assert.ok(r.mean <= LIMIT.mean && r.within >= LIMIT.within, `${id}: close to the design (mean ${r.mean.toFixed(2)} ≤ ${LIMIT.mean}, within ${r.within.toFixed(3)} ≥ ${LIMIT.within})`);
    assert.ok(r.discMean <= LIMIT.discMean && r.discWithin >= LIMIT.discWithin, `${id}: the carousel close to the design (mean ${r.discMean.toFixed(2)}, within ${r.discWithin.toFixed(3)})`);
  }
  await p.close();

  // ---- in the game: tyres on the disc, a steady frame, garage and showroom ----
  for (const [name, viewport, touch, path] of [["1440", { width: 1440, height: 900 }, false, "/"], ["390", { width: 390, height: 844 }, true, "/day"]]) {
    const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    const q = await ctx.newPage(), errs = [];
    q.on("pageerror", (e) => errs.push(e.message));
    await q.goto(server.url + path);
    await until(q, "window.game && game.getSnapshot().screen === 'setup' || game.getSnapshot().screen === 'garage'", `${name}: loads`);
    if ((await q.evaluate(() => game.getSnapshot().screen)) === "setup") {
      await q.evaluate(`(() => { const r = ${root}; r.querySelector('input[name=name]').value = 'KIP'; r.querySelector('form').requestSubmit(); })()`);
    }
    await until(q, "game.getSnapshot().screen === 'garage' && root.querySelector('.dh-preview')?.width > 50", `${name}: the garage`);
    const press = async (sel) => { const l = q.locator(`[data-fizlet-host] >> ${sel}`).first(); await l.evaluate((e) => e.scrollIntoView({ block: "center" })); await (touch ? l.tap() : l.click()); };
    // The tyres: the lowest near-black pixels under each half of the bike lie inside the disc's top.
    const tyres = (where) => q.evaluate(`(() => { const c = ${root}.querySelector('.dh-preview'), r = c.getBoundingClientRect(), k = c.width / r.width, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
      const f = fitOf(Math.round(r.width), Math.round(r.height)), E = { cx: (596.5 * f.s + f.dx) * k, cy: (611 * f.s + f.dy) * k, a: 526.5 * f.s * k, b: 86.5 * f.s * k };
      const low = [-1, -1], at = [0, 0];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (Math.max(d[i], d[i + 1], d[i + 2]) < 48) { const h = x < E.cx ? 0 : 1; if (y > low[h]) (low[h] = y), (at[h] = x); } }
      return { E, pts: [[at[0], low[0]], [at[1], low[1]]], inside: [0, 1].map((h) => low[h] >= 0 && ((at[h] - E.cx) / E.a) ** 2 + ((low[h] - E.cy) / E.b) ** 2 <= 1) }; })()`);
    const size = () => q.evaluate(`(() => { const r = ${root}.querySelector('.dh-preview').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })()`);
    await q.waitForTimeout(300);
    const T = await tyres("garage");
    if (MEDIA) await q.locator("[data-fizlet-host] >> .dh-preview").first().screenshot({ path: `${MEDIA}/game-${name}-garage.png` });
    assert.ok(T.inside[0] && T.inside[1], `${name} garage: both tyres touch down on the disc's top (${JSON.stringify(T)})`);
    console.log(`  ${name} garage: tyres at ${JSON.stringify(T.pts)} inside the disc (${T.E.cx.toFixed(0)}, ${T.E.cy.toFixed(0)}, ${T.E.a.toFixed(0)} × ${T.E.b.toFixed(0)})`);
    const s0 = await size();
    for (const pick of ["track", "sunset", "auto"]) {
      await press("[data-gmenu=backdrop]");
      await press(`[data-backdrop=${pick}]`);
      await until(q, `game.profile.settings.backdrop === '${pick}' && !root.querySelector('[data-backdrop]')`, `${name}: pick ${pick}`);
      assert.deepEqual(await size(), s0, `${name}: the frame keeps its size on ${pick}`);
    }
    await press(".dh-theme");
    await q.waitForTimeout(200);
    assert.deepEqual(await size(), s0, `${name}: the frame keeps its size through Day / Night`);
    await press("[data-gtab=showroom]");
    await until(q, "!!root.querySelector('.shop-cat') && !!root.querySelector('.shop-cat-pv .dh-preview')", `${name}: the showroom's preview`);
    await q.waitForTimeout(300);
    const S = await tyres("showroom");
    if (MEDIA) await q.locator("[data-fizlet-host] >> .shop-cat-pv .dh-preview").first().screenshot({ path: `${MEDIA}/game-${name}-showroom.png` });
    assert.ok(S.inside[0] && S.inside[1], `${name} showroom: both tyres on the disc's top (${JSON.stringify(S)})`);
    console.log(`  ${name} showroom: tyres inside the disc`);
    assert.deepEqual(errs, [], `${name}: no page errors`);
    await ctx.close();
  }
  console.log("Holeshot backdrops: TRACK and SUNSET against the owner's designs (whole frame and carousel); tyres on the drawn disc in the garage and the showroom; the frame's size steady through the picks and Day / Night; 1440 and 390.");
} finally {
  await browser.close();
  await server.close();
}
