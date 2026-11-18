// The bike's parts draw in the right order in Chromium, for every bike in the roster, at every camera
// yaw, in every pose. The rig (src/bike/rig.ts) on a bare diorama, bundled here with esbuild; for each
// model (its rig kind, frame and a graphics kit in turn) × 16 yaws × two pitches × the poses (seated,
// wheelie, steered and squashed on its springs) it draws masks of the parts and the whole bike with
// probe tints, and judges, where two sets overlap on screen (eroded 2 px for the edge, ≥ 40 px):
//   fenders: each fender over its own tyre, the two drawn alone (≥ 90 % fender probe);
//   far side: the far side's parts (fork leg, swingarm arm, exhaust, number plate) under every other
//     part of the bike (≤ 3 % far probe);
//   near side: the near side's parts over the wheels, drawn alone (≥ 90 % near probe).
// Within 12° of straight ahead or behind there is no far side: those views judge the fenders only.
// MEDIA=<dir> saves a 16-yaw turntable per rig kind, with and without the probes, and the owner's views.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const entry = `
import { diorama } from "@fzlt/core/diorama";
import { rig } from "./src/bike/rig.ts";
import { bike } from "./src/bike/bike.ts";
import { MODELS, makerOf } from "./src/data/roster.ts";
import { newBike } from "./src/model/profile.ts";
import { tune } from "./src/model/tune.ts";
const cv = document.getElementById("cv"), d = diorama(cv, { light: [-0.4, 1, 0.6], ambient: 0.55, maxDpr: 1 });
d.resize(480, 360, 1);
const flat = { sample(_x, _z, out) { out[0] = 0; out[1] = 0; out[2] = 1; out[3] = 0; return 0; } };
const GFX = [undefined, "bolt", "chevron", "rally", "circuit"];
let g = null, bk = null, sets = null;
const under = (ob, roots) => { for (let p = ob; p; p = p.parent) if (roots.includes(p)) return true; return false; };
window.models = MODELS.map((m) => m.id);
/** A fresh diorama with model i on it. */
window.load = (i) => {
  d.clear();
  const m = MODELS[i], t = tune(newBike(m.id, "x")), [plastic, plastic2] = makerOf(m).colors;
  const C = { plastic, plastic2, seat: "#202028", frame: "#3a3a4c", tyre: "#15151c", rim: "#b8bccc", metal: "#c9cde6", pipe: "#7e86a8", plate: "#e8e8ee", ink: "#101018",
    jersey: "#2fb4d8", pants: "#e8e8ee", helmet: "#f0f0f4", stripe: "#2f6fd8", visor: "#101018", boots: "#f4f4f8", gloves: "#202028", glow: "#d0d0d8",
    side: "#e8e8ee", sideInk: "#101018", num: 10 + i, gfx: GFX[i % GFX.length], graphic: "#ffd23f" };
  g = rig(d, "b", C, t.rig, "peak"); bk = bike(flat, t.power, t.shape);
  const by = (k) => d.get("b" + k), bikeParts = g.parts.filter((p) => !under(p, [g.rider]));
  const side = [["armL", "fkL", "slL", "np-1s", ":exL"], ["armR", "fkR", "slR", "np1s", ":ex"]].map((r) => r.map((k) => by(k.startsWith(":") ? k : ":" + k)).filter(Boolean));
  const hub = [by(":w0"), by(":w1")], end = [by(":w0b"), by(":w1b")];
  const tyre = hub.map((h) => g.parts.find((p) => p.parent === h));
  const wheel = bikeParts.filter((p) => under(p, hub));
  // A fender: the parts on a wheel's level group that are not the wheel (the tail light aside: tiny).
  const fender = end.map((e) => bikeParts.filter((p) => p.parent === e && p.size[0] > 0.2));
  sets = { bikeParts, side, sideParts: side.map((r) => bikeParts.filter((p) => under(p, r))), tyre, wheel, fender };
  return { kind: t.rig, gfx: C.gfx ?? "none" };
};
function pose(name) {
  bk.reset(0, 0, 0);
  bk._f[0] = 0; bk._w[0] = 0; g.T.fill(0);
  let stand = 0.7;
  if (name === "seated") stand = 0;
  if (name === "wheelie") bk.rot[2] = 0.55, (bk.S[28] = 1);
  if (name === "steer") bk.S[20] = 0.5, (bk.S[7] = 0.2);
  if (name === "squash") bk.comp[0] = 0.22, bk.comp[1] = 0.25, bk.rot[2] = -0.1;
  g.pose(bk, stand);
}
function view(yaw, pitch) {
  Object.assign(d.cam, { yaw, pitch, dist: 4.2, tx: 0, ty: bk.pos[1] + 0.1, tz: 0, ox: 0, oy: 0, fov: 0.55 });
}
const ctx = cv.getContext("2d", { willReadFrequently: true });
function grab(show, tints) {
  for (const p of g.parts) p.alpha = show(p) ? 1 : 0;
  for (const [obs, c] of tints) for (const o of obs) o.tint = c;
  d.draw();
  for (const [obs] of tints) for (const o of obs) o.tint = null;
  return ctx.getImageData(0, 0, cv.width, cv.height).data;
}
/** Which side (0 left, 1 right) is far from the eye, or −1 within 12° of straight ahead or behind. */
function far() {
  const M = g.root.M, a = [0, 0, 0], b = [0, 0, 0], at = (z, o) => d.project(M[9] + M[2] * z, M[10] + M[5] * z, M[11] + M[8] * z, o);
  at(-0.3, a); at(0.3, b);
  return Math.abs(b[2] - a[2]) < 0.6 * Math.sin(0.21) ? -1 : b[2] > a[2] ? 1 : 0;
}
const W = 480, H = 360;
const erode = (m) => { const o = new Uint8Array(m.length); for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { let ok = 1; for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) if (!m[(y + dy) * W + x + dx]) { ok = 0; break; } o[y * W + x] = ok; } return o; };
const mask = (px) => { const m = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) m[i] = px[i * 4 + 3] > 200 ? 1 : 0; return m; };
const isProbe = (px, i) => px[i * 4 + 1] > 2 * px[i * 4] + 20 && px[i * 4 + 1] > 2 * px[i * 4 + 2] + 20;
/** Of the pixels where masks a and b overlap, the share showing the green probe in frame px. */
function judge(a, b, px) {
  const ov = erode(a.map((v, i) => v & b[i]));
  let n = 0, hit = 0;
  for (let i = 0; i < W * H; i++) if (ov[i]) (n++, isProbe(px, i) && hit++);
  return { n, frac: n ? hit / n : 0 };
}
const all = () => true, G = "#00ff00";
window.measure = (name, yaw, pitch) => {
  pose(name); view(yaw, pitch);
  d.draw();
  const fs = far(), S = sets, out = { fender: [], far: null, near: null };
  const inBike = (p) => S.bikeParts.includes(p);
  for (let w = 0; w < 2; w++) {
    const fm = mask(grab((p) => S.fender[w].includes(p), [])), tm = mask(grab((p) => p === S.tyre[w], []));
    out.fender.push(judge(fm, tm, grab((p) => p === S.tyre[w] || S.fender[w].includes(p), [[S.fender[w], G]])));
  }
  if (fs >= 0) {
    const fp = S.sideParts[fs], np = S.sideParts[1 - fs];
    const fm = mask(grab((p) => fp.includes(p), [])), rest = mask(grab((p) => inBike(p) && !fp.includes(p), []));
    out.far = judge(fm, rest, grab(inBike, [[S.side[fs], G]]));
    const nm = mask(grab((p) => np.includes(p), [])), wm = mask(grab((p) => S.wheel.includes(p), []));
    out.near = judge(nm, wm, grab((p) => np.includes(p) || S.wheel.includes(p), [[S.side[1 - fs], G]]));
  }
  for (const p of g.parts) p.alpha = 1;
  return out;
};
window.shot = (name, yaw, pitch, probe) => {
  pose(name); view(yaw, pitch);
  for (const p of g.parts) p.alpha = 1;
  d.draw();
  const fs = probe ? far() : -1;
  if (probe) {
    for (const f of sets.fender) for (const o of f) o.tint = "#ff00ff";
    if (fs >= 0) for (const o of sets.side[fs]) o.tint = G;
  }
  d.draw();
  for (const o of g.parts) o.tint = null;
  for (const r of sets.side) for (const o of r) o.tint = null;
  return cv.toDataURL("image/png");
};
window.ready = true;
`;
const js = (await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: "ts" }, bundle: true, format: "esm", write: false, logLevel: "warning", target: "es2022" })).outputFiles[0].text;
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Holeshot layers</title></head><body style="margin:0;background:#1a1636"><canvas id="cv" style="width:480px;height:360px"></canvas><script type="module">${js.replace(/<\/script/g, "<\\/script")}</script></body></html>`;
const server = await serve(".", { "/": page });
const browser = await chromium.launch(launchOptions());
const MEDIA = process.env.MEDIA;
if (MEDIA) mkdirSync(MEDIA, { recursive: true });
const POSES = ["seated", "wheelie", "steer", "squash"], YAWS = Array.from({ length: 16 }, (_, i) => (i * Math.PI) / 8);

try {
  const p = await browser.newPage({ viewport: { width: 520, height: 400 } }), errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(server.url + "/");
  await p.waitForFunction(() => window.ready, null, { timeout: 20000 });
  const models = await p.evaluate(() => window.models), bad = [], worst = { fender: 1, far: 0, near: 1 }, judged = { fender: 0, far: 0, near: 0 }, kinds = new Set();
  for (let i = 0; i < models.length; i++) {
    const info = await p.evaluate((k) => window.load(k), i);
    kinds.add(info.kind);
    for (const pitch of [0.3, 0.65]) for (const name of POSES) for (const yaw of YAWS) {
      const m = await p.evaluate(([n, y, pt]) => window.measure(n, y, pt), [name, yaw, pitch]);
      const tag = `${models[i]} (${info.kind}, ${info.gfx}) ${name} yaw ${yaw.toFixed(2)} pitch ${pitch}`;
      m.fender.forEach((f, w) => {
        if (f.n < 40) return;
        judged.fender++;
        worst.fender = Math.min(worst.fender, f.frac);
        if (f.frac < 0.9) bad.push(`${tag}: ${w ? "front" : "rear"} fender only ${(f.frac * 100).toFixed(1)} % over its tyre (${f.n} px)`);
      });
      if (m.far && m.far.n >= 40) {
        judged.far++;
        worst.far = Math.max(worst.far, m.far.frac);
        if (m.far.frac > 0.03) bad.push(`${tag}: far-side parts ${(m.far.frac * 100).toFixed(1)} % drawn over the bike (${m.far.n} px)`);
      }
      if (m.near && m.near.n >= 40) {
        judged.near++;
        worst.near = Math.min(worst.near, m.near.frac);
        if (m.near.frac < 0.9) bad.push(`${tag}: near-side parts only ${(m.near.frac * 100).toFixed(1)} % over the wheels (${m.near.n} px)`);
      }
    }
    if (MEDIA && [0, 4, 8, 12].includes(i)) {
      const save = async (file, name, yaw, pitch, probe) => writeFileSync(`${MEDIA}/${file}.png`, Buffer.from((await p.evaluate(([n, y, pt, pr]) => window.shot(n, y, pt, pr), [name, yaw, pitch, probe])).split(",")[1], "base64"));
      for (let k = 0; k < 16; k++) await save(`${models[i]}-turn-${k}`, "seated", YAWS[k], 0.45), await save(`${models[i]}-turn-${k}-probe`, "seated", YAWS[k], 0.45, true);
      // The owner's views: the rear wheel from behind and above (182), the front from the front quarter (183).
      await save(`${models[i]}-rear-quarter`, "seated", 3.6, 0.5); await save(`${models[i]}-front-quarter`, "standing", 0.6, 0.45);
    }
  }
  assert.deepEqual(errs, [], "no page errors");
  assert.deepEqual([...kinds].sort(), ["2t", "4t", "ebike", "emoto", "mini", "naked", "sport"], "every rig kind in the roster");
  assert.ok(judged.fender >= 500 && judged.far >= 500 && judged.near >= 200, `enough overlapping cases to judge (${JSON.stringify(judged)})`);
  assert.deepEqual(bad, [], `bike layers:\n${bad.slice(0, 40).join("\n")}${bad.length > 40 ? `\n… ${bad.length - 40} more` : ""}`);
  console.log(`Layers: ${models.length} bikes × 16 yaws × 2 pitches × ${POSES.length} poses: fenders at least ${(worst.fender * 100).toFixed(0)} % over their tyres (${judged.fender} cases), far-side parts at most ${(worst.far * 100).toFixed(1)} % over the bike (${judged.far}), near-side parts at least ${(worst.near * 100).toFixed(0)} % over the wheels (${judged.near}).`);
} finally {
  await browser.close();
  await server.close();
}
