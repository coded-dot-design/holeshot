// The gas dirt bikes' art style keeps its draw order in Chromium, at every camera yaw. The rig
// (src/bike/rig.ts, the base in src/bike/bodies.ts `dirt`) on a bare diorama, bundled here with
// esbuild; for the two models drawn past the base (YOWLER 250 2T, CRIMSON 450 FACTORY) and the base
// 2-stroke and 4-stroke (no model: a rival) × 24 yaws × two pitches × the poses (seated, standing,
// wheelie, squashed on its springs) it draws masks of part sets and frames with probe tints, and
// judges, where the sets overlap on screen (eroded 2 px for the edge, ≥ 40 px):
//   rider: the rider (torso, helmet, the near side's leg and arm) over every bike part (≥ 97 % rider
//     probe; within 12° of straight ahead or behind no limb is judged, only the torso and helmet);
//   far block: the shroud's colour block on the far side never shows through the tank (≤ 1 % probe);
//   near block: the near side's block over the tank (≥ 95 %);
//   ink: each inked shape (frame-side swingarm arms, side panel, tank and shroud, seat, front plate,
//     tail, front fender) over its own ink edge, drawn alone (≥ 97 %), and the edge showing round it.
// MEDIA=<dir> saves a 16-yaw turntable of each model, with and without the rider.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const entry = `
import { diorama } from "@fzlt/core/diorama";
import { rig } from "./src/bike/rig.ts";
import { INK } from "./src/bike/bodies.ts";
import { bike } from "./src/bike/bike.ts";
import { MODELS } from "./src/data/roster.ts";
import { paint } from "./src/data/looks.ts";
import { newBike } from "./src/model/profile.ts";
import { tune } from "./src/model/tune.ts";
const cv = document.getElementById("cv"), d = diorama(cv, { light: [-0.4, 1, 0.6], ambient: 0.55, maxDpr: 1 });
d.resize(480, 360, 1);
const flat = { sample(_x, _z, out) { out[0] = 0; out[1] = 0; out[2] = 1; out[3] = 0; return 0; } };
let g = null, bk = null, S = null;
const under = (ob, roots) => { for (let p = ob; p; p = p.parent) if (roots.includes(p)) return true; return false; };
/** A fresh diorama with bike [model id, paint, model passed to the rig or not] on it. */
window.load = ([id, pnt, withModel]) => {
  d.clear();
  const m = MODELS.find((x) => x.id === id), t = tune(newBike(m.id, "x")), pt = paint(pnt);
  const C = { plastic: pt.plastic, plastic2: pt.plastic2, seat: "#202028", frame: "#3a3a4c", tyre: "#15151c", rim: "#b8bccc", metal: "#c9cde6", pipe: "#7e86a8", plate: pt.plate, ink: pt.ink,
    jersey: "#2fb4d8", pants: "#e8e8ee", helmet: "#f0f0f4", stripe: "#2f6fd8", visor: "#101018", boots: "#f4f4f8", gloves: "#202028", glow: "#d0d0d8", side: pt.plate, sideInk: pt.ink, num: 7 };
  g = rig(d, "b", C, t.rig, "peak", withModel ? m.id : undefined); bk = bike(flat, t.power, t.shape);
  const by = (k) => d.get("b" + k), bikeParts = g.parts.filter((p) => !under(p, [g.rider]));
  const limbs = [by("Lsd"), by("Rsd")], rider = g.parts.filter((p) => under(p, [g.rider]));
  // The ink edges: a twin in INK made just before the shape it rims, on the same parent.
  const ink = [];
  for (let i = 0; i + 1 < g.parts.length; i++) { const a = g.parts[i], b = g.parts[i + 1]; if (a.color === INK && a.shape === "prism" && b.parent === a.parent && b.color !== INK) ink.push([a, b]); }
  const tank = ink.map(([, b]) => b).find((b) => b.size[1] > 0.3), tankInk = ink.find(([, b]) => b === tank)[0];
  const block = [by(":sbL"), by(":sbR")].map((s) => g.parts.filter((p) => p.parent === s));
  S = { bikeParts, rider, limbs: limbs.map((l) => rider.filter((p) => under(p, [l]))), ink, tank: [tank, tankInk], block };
  return { kind: t.rig, inked: ink.length, blocks: block.map((b) => b.length), fork: g.parts.filter((p) => p.shape === "cyl" && p.parent && /:fk[LR]$/.test(p.parent.id ?? "")).map((p) => p.color) };
};
function pose(name) {
  bk.reset(0, 0, 0);
  bk._f[0] = 0; bk._w[0] = 0; g.T.fill(0);
  let stand = 0.7;
  if (name === "seated") stand = 0;
  if (name === "wheelie") bk.rot[2] = 0.55, (bk.S[28] = 1);
  if (name === "squash") bk.comp[0] = 0.22, bk.comp[1] = 0.25, bk.rot[2] = -0.1;
  g.pose(bk, stand);
}
function view(yaw, pitch) {
  Object.assign(d.cam, { yaw, pitch, dist: 4.4, tx: 0, ty: bk.pos[1] + 0.25, tz: 0, ox: 0, oy: 0, fov: 0.55 });
}
const ctx = cv.getContext("2d", { willReadFrequently: true });
function grab(show, tints) {
  for (const p of g.parts) p.alpha = show.has(p) ? 1 : 0;
  for (const [obs, c] of tints) for (const o of obs) o.tint = c;
  d.draw();
  for (const [obs] of tints) for (const o of obs) o.tint = null;
  return ctx.getImageData(0, 0, cv.width, cv.height).data;
}
function far() {
  const M = g.root.M, a = [0, 0, 0], b = [0, 0, 0], at = (z, o) => d.project(M[9] + M[2] * z, M[10] + M[5] * z, M[11] + M[8] * z, o);
  at(-0.3, a); at(0.3, b);
  return Math.abs(b[2] - a[2]) < 0.6 * Math.sin(0.21) ? -1 : b[2] > a[2] ? 1 : 0;
}
const W = 480, H = 360;
const erode = (m) => { const o = new Uint8Array(m.length); for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { let ok = 1; for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) if (!m[(y + dy) * W + x + dx]) { ok = 0; break; } o[y * W + x] = ok; } return o; };
const mask = (px) => { const m = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) m[i] = px[i * 4 + 3] > 200 ? 1 : 0; return m; };
const isProbe = (px, i) => px[i * 4 + 1] > 2 * px[i * 4] + 20 && px[i * 4 + 1] > 2 * px[i * 4 + 2] + 20;
function judge(m, px) {
  const ov = erode(m);
  let n = 0, hit = 0;
  for (let i = 0; i < W * H; i++) if (ov[i]) (n++, isProbe(px, i) && hit++);
  return { n, frac: n ? hit / n : 0 };
}
const and = (a, b) => a.map((v, i) => v & b[i]), G = "#00ff00", set = (a) => new Set(a);
window.measure = (name, yaw, pitch) => {
  pose(name); view(yaw, pitch);
  d.draw();
  const fs = far(), out = { rider: null, far: null, near: null, ink: [], rim: 1 };
  // The rider (its far side's limbs aside) over the bike.
  const rid = S.rider.filter((p) => fs < 0 ? !S.limbs[0].includes(p) && !S.limbs[1].includes(p) : !S.limbs[fs].includes(p));
  const all = set([...S.bikeParts, ...rid]);
  out.rider = judge(and(mask(grab(set(rid), [])), mask(grab(set(S.bikeParts), []))), grab(all, [[rid, G]]));
  if (fs >= 0) {
    const tk = set(S.tank), tm = mask(grab(tk, []));
    const fb = S.block[fs], nb = S.block[1 - fs];
    out.far = judge(and(mask(grab(set(fb), [])), tm), grab(set([...S.tank, ...fb]), [[fb, G]]));
    out.near = judge(and(mask(grab(set(nb), [])), tm), grab(set([...S.tank, ...nb]), [[nb, G]]));
  }
  // Each inked shape over its own edge, and the edge round it.
  for (const [a, b] of S.ink) {
    const bm = mask(grab(set([b]), [])), px = grab(set([a, b]), [[[b], G]]);
    const r = judge(bm, px);
    let edge = 0;
    for (let i = 0; i < W * H; i++) if (px[i * 4 + 3] > 200 && !bm[i]) edge++;
    out.ink.push({ ...r, edge });
  }
  for (const p of g.parts) p.alpha = 1;
  return out;
};
window.shot = (name, yaw, pitch, rider) => {
  pose(name); view(yaw, pitch);
  for (const p of g.parts) p.alpha = rider || !S.rider.includes(p) ? 1 : 0;
  d.draw();
  for (const p of g.parts) p.alpha = 1;
  return cv.toDataURL("image/png");
};
window.ready = true;
`;
const js = (await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: "ts" }, bundle: true, format: "esm", write: false, logLevel: "warning", target: "es2022" })).outputFiles[0].text;
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Holeshot bikes</title></head><body style="margin:0;background:#1a1636"><canvas id="cv" style="width:480px;height:360px"></canvas><script type="module">${js.replace(/<\/script/g, "<\\/script")}</script></body></html>`;
const server = await serve(".", { "/": page });
const browser = await chromium.launch(launchOptions());
const MEDIA = process.env.MEDIA;
if (MEDIA) mkdirSync(MEDIA, { recursive: true });
const BIKES = [["hivequeen", "f-yamada", true], ["bulkhead", "f-hondo", true], ["buzzline", "gridline", false], ["slag-ox", "f-kawazakura", false]];
const POSES = ["seated", "standing", "wheelie", "squash"], YAWS = Array.from({ length: 24 }, (_, i) => (i * Math.PI) / 12);

try {
  const p = await browser.newPage({ viewport: { width: 520, height: 400 } }), errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(server.url + "/");
  await p.waitForFunction(() => window.ready, null, { timeout: 20000 });
  const bad = [], worst = { rider: 1, far: 0, near: 1, ink: 1 }, judged = { rider: 0, far: 0, near: 0, ink: 0 };
  for (const b of BIKES) {
    const info = await p.evaluate((k) => window.load(k), b);
    const tag0 = `${b[0]}${b[2] ? "" : " (base)"} ${info.kind}`;
    assert.equal(info.inked, 8, `${tag0}: eight inked shapes (two swingarm arms, side panel, tank, seat, plate, tail, front fender) — ${info.inked}`);
    assert.deepEqual(info.blocks, [1, 1], `${tag0}: a colour block on each shroud`);
    assert.equal(new Set(info.fork).size, 1, `${tag0}: both upper fork tubes one colour`);
    if (b[0] === "bulkhead") assert.equal(info.fork[0], "#e2a62a", "the factory bike's forks are gold");
    else assert.notEqual(info.fork[0], "#e2a62a", `${tag0}: forks not gold`);
    for (const pitch of [0.2, 0.6]) for (const name of POSES) for (const yaw of YAWS) {
      const m = await p.evaluate(([n, y, pt]) => window.measure(n, y, pt), [name, yaw, pitch]);
      const tag = `${tag0} ${name} yaw ${yaw.toFixed(2)} pitch ${pitch}`;
      if (m.rider.n >= 40) {
        judged.rider++; worst.rider = Math.min(worst.rider, m.rider.frac);
        if (m.rider.frac < 0.97) bad.push(`${tag}: rider only ${(m.rider.frac * 100).toFixed(1)} % over the bike (${m.rider.n} px)`);
      }
      if (m.far && m.far.n >= 40) {
        judged.far++; worst.far = Math.max(worst.far, m.far.frac);
        if (m.far.frac > 0.01) bad.push(`${tag}: far shroud block ${(m.far.frac * 100).toFixed(1)} % through the tank (${m.far.n} px)`);
      }
      if (m.near && m.near.n >= 40) {
        judged.near++; worst.near = Math.min(worst.near, m.near.frac);
        if (m.near.frac < 0.95) bad.push(`${tag}: near shroud block only ${(m.near.frac * 100).toFixed(1)} % over the tank (${m.near.n} px)`);
      }
      m.ink.forEach((k, i) => {
        if (k.n < 40) return;
        judged.ink++; worst.ink = Math.min(worst.ink, k.frac);
        if (k.frac < 0.97) bad.push(`${tag}: inked shape ${i} only ${(k.frac * 100).toFixed(1)} % over its edge (${k.n} px)`);
        if (k.edge < 8) bad.push(`${tag}: inked shape ${i} shows no edge (${k.edge} px)`);
      });
    }
    if (MEDIA && b[2]) {
      for (let k = 0; k < 16; k++) for (const r of [0, 1]) {
        const png = await p.evaluate(([y, rr]) => window.shot("standing", y, 0.35, rr), [(k * Math.PI) / 8, r]);
        writeFileSync(`${MEDIA}/${b[0]}-turn-${k}${r ? "-rider" : ""}.png`, Buffer.from(png.split(",")[1], "base64"));
      }
    }
  }
  assert.deepEqual(errs, [], "no page errors");
  assert.ok(judged.rider >= 500 && judged.far >= 200 && judged.near >= 200 && judged.ink >= 1500, `enough overlapping cases to judge (${JSON.stringify(judged)})`);
  assert.deepEqual(bad, [], `bike art draw order:\n${bad.slice(0, 40).join("\n")}${bad.length > 40 ? `\n… ${bad.length - 40} more` : ""}`);
  console.log(`Bikes: ${BIKES.length} gas bikes × 24 yaws × 2 pitches × ${POSES.length} poses: rider at least ${(worst.rider * 100).toFixed(1)} % over the bike (${judged.rider} cases), far shroud block at most ${(worst.far * 100).toFixed(1)} % through the tank (${judged.far}), near block at least ${(worst.near * 100).toFixed(0)} % over it (${judged.near}), inked shapes at least ${(worst.ink * 100).toFixed(1)} % over their edges (${judged.ink}).`);
} finally {
  await browser.close();
  await server.close();
}
