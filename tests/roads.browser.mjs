// Endless Wheelie City in Chromium: the road edges are clean lines, not stair-steps. The owner's
// case: the asphalt, gravel and sidewalk were coloured onto the ground's triangles, so their edges
// zigzagged along the grid (worst far off, where the ground is drawn coarser). The road surfaces are
// ribbons along the roads' true curves now. On a straight and on the most curved open road near the
// start, at 1440 and 390, the bike sits on the road facing along it; the frame is drawn bare (no
// objects, no paint) and, at points along both edges from just ahead of the bike out into the haze,
// the drawn edge is found across the edge (where the colour turns from the asphalt's to the
// shoulder's, sub-pixel) and set against where the road's true edge lands on screen. Near (under 15
// units from the eye) and far, none may be off by more than 1.5 px.
// DIST=<url path> measures another build (the one before, for the compare); REPORT=1 only prints.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const DIST = process.env.DIST || "/dist", REPORT = !!process.env.REPORT, TOL = 1.5;
const full = `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "${DIST}/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false }); game.setup({ starter: "sparkhound" });</script></body></html>`;
const server = await serve(".", { "/": full });
const browser = await chromium.launch(launchOptions());
const until = (p, fn, arg, what, timeout = 20000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));

/** The roads to test: open roads (no town, no roundabout at either end) near the start, the straightest
 *  and the most curved stretch (heading change over 12 units), as [i, j, dir, s, hw, L]. */
const pick = (p) => p.evaluate(() => {
  const r = game.run.probe, cand = [];
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) for (let d = 0; d < 2; d++) {
    const a = r.road(i, j, d, 0);
    if (!a) continue;
    const L = a[3], hw = a[4], n0 = r.node(i, j), n1 = r.node(i + (d ? 0 : 1), j + (d ? 1 : 0));
    if (n0[2] || n1[2] || n0[3] || n1[3]) continue;
    for (let s = 24; s < L - 60; s += 6) {
      let turn = 0;
      for (let q = 0; q < 36; q += 12) {
        let da = r.road(i, j, d, s + q + 12)[2] - r.road(i, j, d, s + q)[2];
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        turn += Math.abs(da);
      }
      cand.push([turn, i, j, d, s, hw, L]);
    }
  }
  cand.sort((a, b) => a[0] - b[0]);
  return [["straight", ...cand[0].slice(1)], ["curved", ...cand[cand.length - 1].slice(1)], [cand[0][0], cand[cand.length - 1][0]]];
});

/** Place the bike on road (i, j, dir) at s facing along it (`lat` units across from its middle), draw
 *  bare, measure both edges from behind the bike out into the haze. */
const measure = (p, road, lat) => p.evaluate(([i, j, d, s0, hw, L, lat]) => {
  const r = game.run.probe, a = r.road(i, j, d, s0), cv = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas");
  const yaw = a[2], tx = Math.cos(yaw), tz = -Math.sin(yaw);
  r.spot(a[0] - tz * lat * hw, a[1] + tx * lat * hw, yaw);
  r.draw(2, 0, 1);
  const dpr = cv.width / cv.clientWidth, W = cv.width, H = cv.height, c2 = document.createElement("canvas");
  c2.width = W; c2.height = H;
  const g = c2.getContext("2d", { willReadFrequently: true });
  g.drawImage(cv, 0, 0);
  const px = g.getImageData(0, 0, W, H).data;
  // A bilinear sample at CSS (x, y) into C.
  const C = [0, 0, 0];
  const at = (x, y) => {
    const fx = x * dpr - 0.5, fy = y * dpr - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), u = fx - x0, v = fy - y0;
    for (let c = 0; c < 3; c++) {
      const p00 = px[(y0 * W + x0) * 4 + c], p10 = px[(y0 * W + x0 + 1) * 4 + c], p01 = px[((y0 + 1) * W + x0) * 4 + c], p11 = px[((y0 + 1) * W + x0 + 1) * 4 + c];
      C[c] = p00 * (1 - u) * (1 - v) + p10 * u * (1 - v) + p01 * (1 - u) * v + p11 * u * v;
    }
    return C;
  };
  const on = (q) => q && q[2] > 1 && q[0] > 4 && q[1] > 4 && q[0] < W / dpr - 4 && q[1] < H / dpr - 4;
  const out = [];
  for (let ds = -16; ds <= 44; ds += 1) for (const side of [-1, 1]) {
    const s = s0 + ds;
    if (s > L - 20 || s < 20) continue;
    const e = r.across(i, j, d, s, side * hw);
    if (!on(e)) continue;
    // The colours either side, deep in each strip (asphalt 0.6 in, the shoulder's middle).
    const qa = r.across(i, j, d, s, side * (hw - 0.6)), qs = r.across(i, j, d, s, side * (hw + 0.55));
    if (!on(qa) || !on(qs)) continue;
    const A = at(qa[0], qa[1]).slice(), S = at(qs[0], qs[1]).slice(), dx = S[0] - A[0], dy = S[1] - A[1], dz = S[2] - A[2], n2 = dx * dx + dy * dy + dz * dz;
    if (n2 < 900) continue;
    // Across the edge, inside out: where the colour is half way from the asphalt's to the shoulder's.
    const N = 72, U = 0.45;
    let prev = 0, hit = null, pq = null, ok = true;
    for (let k = 0; k <= N && ok; k++) {
      const u = -U + (2 * U * k) / N, q = r.across(i, j, d, s, side * (hw + u));
      if (!on(q)) { ok = false; break; }
      const c = at(q[0], q[1]), f = ((c[0] - A[0]) * dx + (c[1] - A[1]) * dy + (c[2] - A[2]) * dz) / n2;
      if (k > 0 && prev < 0.5 && f >= 0.5) {
        const w = (0.5 - prev) / (f - prev);
        hit = [pq[0] + (q[0] - pq[0]) * w, pq[1] + (q[1] - pq[1]) * w];
        break;
      }
      prev = f; pq = q;
    }
    if (!ok) continue;
    // Not found within ±U units: off by at least that much (the old grid's zigzag can be).
    const lo = r.across(i, j, d, s, side * (hw - U)), hi = r.across(i, j, d, s, side * (hw + U));
    const span = Math.hypot(hi[0] - lo[0], hi[1] - lo[1]) / 2;
    const dev = hit ? Math.hypot(hit[0] - e[0], hit[1] - e[1]) : span;
    out.push([e[2], dev, side, ds, e[0], e[1]]);
  }
  r.draw(0, 1);
  return out;
}, [...road, lat]);

const fails = [];
try {
  for (const [name, viewport, touch] of [["1440", { width: 1440, height: 900 }, false], ["390", { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, colorScheme: "light" });
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(server.url + "/");
    await until(p, () => window.game && game.getSnapshot().screen !== "setup", null, `${name}: mounts`);
    await p.evaluate(() => game.start("endcity"));
    await until(p, () => game.run && game.getSnapshot().run.phase === "ready", null, `${name}: on the line`);
    const [straight, curved, turns] = await pick(p);
    for (const [kind, ...road] of [straight, curved]) {
      const pts = [];
      for (const lat of [0, -0.7, 0.7]) pts.push(...(await measure(p, road, lat)));
      for (const band of ["near", "far"]) {
        const sel = pts.filter((q) => (band === "near" ? q[0] < 15 : q[0] >= 15));
        const devs = sel.map((q) => q[1]).sort((a, b) => a - b), max = devs.length ? devs[devs.length - 1] : NaN, mean = devs.reduce((a, b) => a + b, 0) / (devs.length || 1);
        console.log(`  ${name} ${kind} road (turn ${(kind === "straight" ? turns[0] : turns[1]).toFixed(2)} rad over 36 u) ${band}: ${sel.length} edge points, off by mean ${mean.toFixed(2)} px, max ${max.toFixed(2)} px`);
        if (process.env.DEBUG) console.log(JSON.stringify(sel.filter((q) => q[1] > TOL)));
        if (sel.length < 6) fails.push(`${name} ${kind} ${band}: only ${sel.length} edge points measured`);
        else if (max > TOL) fails.push(`${name} ${kind} ${band}: an edge is off by ${max.toFixed(2)} px (> ${TOL})`);
      }
    }
    assert.deepEqual(errs, [], `${name}: no page errors`);
    await ctx.close();
  }
  if (REPORT) console.log(fails.length ? `would fail:\n  ${fails.join("\n  ")}` : "all within tolerance");
  else assert.deepEqual(fails, [], "road edges are clean lines");
  console.log("roads: the road edges are clean lines along the road at 1440 and 390, near and far");
} finally {
  await browser.close();
  server.close();
}
