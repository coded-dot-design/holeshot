// The helmet's draw order in Chromium: its face shows from the front and never through the back of the
// shell. The rig (src/bike/rig.ts) on a bare diorama, bundled here with esbuild, every helmet shape, in
// five poses (standing, seated, wheelie, handstand, crashed), at 24 yaws (15° steps) × three pitches
// (low, level, from above), the camera on the head. Each case draws the shell alone (a mask), then the
// whole frame with the goggle's lens and glint in a green probe and every other face part (frame,
// chin bar, peak, its root, the open face) in a magenta one. With the eye within 60° of the face,
// the lens shows (≥ 40 green px); more than 100° round from it, no green at all, and no magenta
// inside the shell's outline (eroded 2 px for its edge): a face part may stand out past the shell's
// edge, never show through it. MEDIA=<dir> saves a 24-yaw sheet of the head per pitch.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const entry = `
import { diorama } from "@fzlt/core/diorama";
import { rig, T_HANDSTAND } from "./src/bike/rig.ts";
import { bike, TWO_STROKE } from "./src/bike/bike.ts";
const cv = document.getElementById("cv"), d = diorama(cv, { light: [-0.4, 1, 0.6], ambient: 0.55, maxDpr: 1 });
const W = 360, H = 360;
d.resize(W, H, 1);
const C = { plastic: "#2f6fd8", plastic2: "#d8d8e0", seat: "#202028", frame: "#3a3a4c", tyre: "#15151c", rim: "#b8bccc", metal: "#c9cde6", pipe: "#7e86a8", plate: "#e8e8ee", ink: "#101018",
  jersey: "#2fb4d8", pants: "#e8e8ee", helmet: "#f0f0f4", stripe: "#d84f2f", visor: "#5a1f9e", boots: "#f4f4f8", gloves: "#202028", glow: "#d0d0d8", side: "#e8e8ee", num: 7 };
const flat = { sample(_x, _z, out) { out[0] = 0; out[1] = 0; out[2] = 1; out[3] = 0; return 0; } };
const rigs = {};
const under = (ob, id) => { for (let p = ob; p; p = p.parent) if (p.id === id) return true; return false; };
function setup(helmet) {
  d.clear();
  const g = rig(d, "b", C, "2t", helmet), bk = bike(flat, TWO_STROKE);
  const head = d.get("b:h"), shell = g.parts.filter((p) => p.parent === head && p.shape === "cyl" && p.color === C.helmet);
  const face = g.parts.filter((p) => under(p, "b:hf"));
  const lens = face.filter((p) => p.color === C.visor || p.emissive);
  return { g, bk, head, shell, face, lens, rest: face.filter((p) => !lens.includes(p)) };
}
let R = null, now = "";
function pose(name) {
  const { g, bk } = R;
  bk.reset(0, 0, 0);
  bk._f[0] = 0; bk._w[0] = 0; g.T.fill(0);
  let stand = 0.7;
  if (name === "seated") stand = 0;
  if (name === "wheelie") bk.rot[2] = 0.55, (bk.S[28] = 1);
  if (name === "handstand") g.T[0] = 1, g.T[T_HANDSTAND] = 1;
  if (name === "crash") bk._f[0] = 1, bk.rider.set(bk.pos), bk.riderRot.fill(0);
  g.pose(bk, stand);
}
const ctx = cv.getContext("2d", { willReadFrequently: true });
const P = [0, 0, 0], Q = [0, 0, 0];
function view(yaw, pitch) {
  d.draw();
  const M = R.head.M;
  Object.assign(d.cam, { yaw, pitch, dist: 1.7, tx: M[9], ty: M[10] + 0.1, tz: M[11], ox: 0, oy: 0, fov: 0.55 });
  d.draw();
  // How squarely the face looks at the eye: its point ahead of the head vs behind it, in depth.
  d.project(M[9] + M[0] * 0.3, M[10] + M[3] * 0.3, M[11] + M[6] * 0.3, P);
  d.project(M[9] - M[0] * 0.3, M[10] - M[3] * 0.3, M[11] - M[6] * 0.3, Q);
  return (Q[2] - P[2]) / 0.6;
}
function grab(show, tint) {
  for (const p of R.g.parts) p.alpha = show(p) ? 1 : 0, p.tint = tint ? tint(p) : null;
  d.draw();
  const px = ctx.getImageData(0, 0, W, H).data;
  for (const p of R.g.parts) p.alpha = 1, p.tint = null;
  return px;
}
const erode = (m) => { const o = new Uint8Array(m.length); for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { let ok = 1; for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) if (!m[(y + dy) * W + x + dx]) { ok = 0; break; } o[y * W + x] = ok; } return o; };
window.measure = (helmet, name, yaw, pitch) => {
  if (now !== helmet) R = setup(helmet), (now = helmet);
  pose(name);
  const facing = view(yaw, pitch);
  const sm = grab((p) => R.shell.includes(p)), shell = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) shell[i] = sm[i * 4 + 3] > 200 ? 1 : 0;
  const inner = erode(shell);
  const full = grab(() => true, (p) => (R.lens.includes(p) ? "#00ff00" : R.rest.includes(p) ? "#ff00ff" : null));
  let green = 0, through = 0;
  for (let i = 0; i < W * H; i++) {
    const r = full[i * 4], gg = full[i * 4 + 1], b = full[i * 4 + 2];
    if (gg > 2 * r + 30 && gg > 2 * b + 30) green++;
    else if (inner[i] && r > 2 * gg + 30 && b > 2 * gg + 30) through++;
  }
  return { facing, green, through };
};
window.shot = (helmet, name, yaw, pitch) => {
  if (now !== helmet) R = setup(helmet), (now = helmet);
  pose(name); view(yaw, pitch);
  return cv.toDataURL("image/png");
};
window.ready = true;
`;
const js = (await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: "ts" }, bundle: true, format: "esm", write: false, logLevel: "warning", target: "es2022" })).outputFiles[0].text;
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Holeshot helmet</title></head><body style="margin:0;background:#1a1636"><canvas id="cv" style="width:360px;height:360px"></canvas><script type="module">${js.replace(/<\/script/g, "<\\/script")}</script></body></html>`;
const server = await serve(".", { "/": page });
const browser = await chromium.launch(launchOptions());
const MEDIA = process.env.MEDIA;
if (MEDIA) mkdirSync(MEDIA, { recursive: true });
const HELMETS = ["peak", "duck", "dome", "retro", "fin", "spike"], POSES = ["standing", "seated", "wheelie", "handstand", "crash"];
const YAWS = Array.from({ length: 24 }, (_, i) => (i * Math.PI) / 12), PITCHES = [-0.05, 0.2, 0.6];

try {
  const p = await browser.newPage({ viewport: { width: 400, height: 400 } }), errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(server.url + "/");
  await p.waitForFunction(() => window.ready, null, { timeout: 20000 });
  const bad = [];
  let front = 0, back = 0, least = Infinity;
  for (const h of HELMETS) for (const name of POSES) for (const pitch of PITCHES) for (const yaw of YAWS) {
    const m = await p.evaluate(([h, n, y, pt]) => window.measure(h, n, y, pt), [h, name, yaw, pitch]);
    const tag = `${h} ${name} yaw ${((yaw * 180) / Math.PI).toFixed(0)}° pitch ${pitch}`;
    // Upside down (a handstand, a tumble) the lens can hide under the peak or the bike: judge the front
    // only riding upright.
    if (m.facing > 0.5 && (name === "standing" || name === "seated" || name === "wheelie")) {
      front++;
      least = Math.min(least, m.green);
      if (m.green < 40) bad.push(`${tag}: facing the eye (${m.facing.toFixed(2)}), the lens shows only ${m.green} px`);
    }
    if (m.facing < -0.17) {
      back++;
      if (m.green) bad.push(`${tag}: facing away (${m.facing.toFixed(2)}), ${m.green} lens px show`);
      if (m.through) bad.push(`${tag}: facing away (${m.facing.toFixed(2)}), ${m.through} face px through the shell`);
    }
  }
  if (MEDIA) {
    const sheet = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    // Every pose at four yaws (the head and what is round it: torso, arms, bike), one row a pose.
    const poses = [];
    for (const name of POSES) for (const yaw of [0.3, Math.PI / 2, 2.6, -1.9]) poses.push(await p.evaluate(([n, y]) => window.shot("peak", n, y, 0.3), [name, yaw]));
    await sheet.setContent(`<body style="margin:0;display:grid;grid-template-columns:repeat(4,240px);background:#000">${poses.map((src) => `<img width=240 height=240 src="${src}">`).join("")}</body>`);
    await sheet.setViewportSize({ width: 960, height: 1200 });
    await sheet.screenshot({ path: `${MEDIA}/poses.png` });
    await sheet.setViewportSize({ width: 1440, height: 960 });
    for (const pitch of PITCHES) for (const h of ["peak", "dome", "retro"]) {
      const imgs = [];
      for (const yaw of YAWS) imgs.push(await p.evaluate(([h, y, pt]) => window.shot(h, "standing", y, pt), [h, yaw, pitch]));
      await sheet.setContent(`<body style="margin:0;display:grid;grid-template-columns:repeat(6,240px);background:#000;font:12px sans-serif;color:#fff">${imgs.map((src, i) => `<figure style="margin:0;position:relative"><img width=240 height=240 src="${src}"><figcaption style="position:absolute;left:4px;top:2px">${i * 15}°</figcaption></figure>`).join("")}</body>`);
      await sheet.screenshot({ path: `${MEDIA}/sweep-${h}-pitch${pitch}.png` });
    }
  }
  assert.deepEqual(errs, [], "no page errors");
  assert.ok(front >= 100 && back >= 300, `enough cases judged (${front} facing, ${back} away)`);
  assert.deepEqual(bad, [], `the helmet's face, front and back:\n${bad.join("\n")}`);
  console.log(`Helmet: ${HELMETS.length} shapes × ${POSES.length} poses × 24 yaws × 3 pitches: facing the eye (${front} cases) the lens shows (at least ${least} px); facing away (${back} cases) no lens and no face part through the shell.`);
} finally {
  await browser.close();
  await server.close();
}
