// The rider's far-side limbs draw behind the bike in Chromium, at every camera yaw and in every pose.
// The rig (src/bike/rig.ts) on a bare diorama, bundled here with esbuild; for 16 yaws × two pitches ×
// the poses (seated, standing, wheelie, hand drag, walking, crashed) it draws three masks (the bike
// alone, each side's legs and arms alone) and the whole frame with the far limbs tinted a green probe
// and the near limbs a magenta one. Where a side's limbs overlap the bike (eroded 2 px for the edge),
// the frame must show ≤ 3 % far-probe pixels (the bike covers its far leg) and ≥ 60 % near-probe ones
// (the near leg is over the bike), for each case with enough overlap to judge. Thrown clear in a crash,
// the far limbs go behind the rider's own body (the near ones sort with it by depth, not judged).
// Within 12° of straight ahead or behind there is no far side: those views are not judged.
// MEDIA=<dir> saves walking, seated and standing at the owner's angles and a 16-yaw turntable, each
// also with the far limbs in the probe green.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const entry = `
import { diorama } from "@fzlt/core/diorama";
import { rig } from "./src/bike/rig.ts";
import { bike, TWO_STROKE } from "./src/bike/bike.ts";
const cv = document.getElementById("cv"), d = diorama(cv, { light: [-0.4, 1, 0.6], ambient: 0.55, maxDpr: 1 });
d.resize(480, 360, 1);
const C = { plastic: "#2f6fd8", plastic2: "#d8d8e0", seat: "#202028", frame: "#3a3a4c", tyre: "#15151c", rim: "#b8bccc", metal: "#c9cde6", pipe: "#7e86a8", plate: "#e8e8ee", ink: "#101018",
  jersey: "#2fb4d8", pants: "#e8e8ee", helmet: "#f0f0f4", stripe: "#2f6fd8", visor: "#101018", boots: "#f4f4f8", gloves: "#202028", glow: "#d0d0d8", side: "#e8e8ee", num: 7 };
const flat = { sample(_x, _z, out) { out[0] = 0; out[1] = 0; out[2] = 1; out[3] = 0; return 0; } };
const g = rig(d, "b", C, "2t", "peak"), bk = bike(flat, TWO_STROKE);
const by = (k) => d.get("b" + k);
const LIMB = [["Lth", "Lsh", "Lua", "Lfa"], ["Rth", "Rsh", "Rua", "Rfa"]].map((s) => s.map(by));
const under = (ob, roots) => { for (let p = ob; p; p = p.parent) if (roots.includes(p)) return true; return false; };
const riderParts = g.parts.filter((p) => under(p, [g.rider])), bikeParts = g.parts.filter((p) => !riderParts.includes(p));
const sideParts = LIMB.map((r) => g.parts.filter((p) => under(p, r)));
const coreParts = riderParts.filter((p) => !sideParts[0].includes(p) && !sideParts[1].includes(p));
function pose(name) {
  bk.reset(0, 0, 0);
  bk._f[0] = 0; bk._w[0] = 0; g.T.fill(0);
  let stand = 0.7;
  if (name === "seated") stand = 0;
  if (name === "wheelie") bk.rot[2] = 0.55, (bk.S[28] = 1);
  if (name === "handdrag") g.T[8] = 1, bk.rot[2] = 0.45;
  if (name === "walk") bk._w[0] = 1, (bk.spin[0] = 0.6);
  if (name === "crash") bk._f[0] = 1, bk.rider.set(bk.pos), bk.riderRot.fill(0);
  g.pose(bk, stand);
}
function view(yaw, pitch, bg) {
  Object.assign(d.cam, { yaw, pitch, dist: 4.2, tx: 0, ty: bk.pos[1] + 0.1, tz: 0, ox: 0, oy: 0, fov: 0.55 });
  cv.style.background = bg || "transparent";
}
const ctx = cv.getContext("2d", { willReadFrequently: true });
function grab(show, tint) {
  for (const p of g.parts) p.alpha = show(p) ? 1 : 0;
  for (let s = 0; s < 2; s++) for (const o of LIMB[s]) o.tint = tint ? tint[s] : null;
  d.draw();
  return ctx.getImageData(0, 0, cv.width, cv.height).data;
}
/** Which side (0 left, 1 right) is far from the eye now (the rider's +z point vs its −z point), or −1
 *  when the eye is within 12° of the bike's centre plane (straight ahead or behind: no far side). */
function far() {
  const M = g.rider.M, a = [0, 0, 0], b = [0, 0, 0], at = (z, o) => d.project(M[9] + M[2] * z, M[10] + M[5] * z, M[11] + M[8] * z, o);
  at(-0.3, a); at(0.3, b);
  return Math.abs(b[2] - a[2]) < 0.6 * Math.sin(0.21) ? -1 : b[2] > a[2] ? 1 : 0;
}
const W = 480, H = 360;
const erode = (m) => { const o = new Uint8Array(m.length); for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { let ok = 1; for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) if (!m[(y + dy) * W + x + dx]) { ok = 0; break; } o[y * W + x] = ok; } return o; };
const mask = (px) => { const m = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) m[i] = px[i * 4 + 3] > 200 ? 1 : 0; return m; };
window.measure = (name, yaw, pitch) => {
  pose(name); view(yaw, pitch);
  d.draw(); // the matrices far() reads
  const fs = far();
  if (fs < 0) return { far: { n: 0, frac: 0 }, near: { n: 0, frac: 0 } };
  // Thrown clear in a crash the rider is on its own: the far limbs go behind its own body instead.
  const crash = name === "crash", core = crash ? coreParts : bikeParts;
  const body = mask(grab((p) => core.includes(p)));
  const limb = [0, 1].map((s) => mask(grab((p) => sideParts[s].includes(p))));
  const full = grab((p) => !crash || riderParts.includes(p), fs ? ["#ff00ff", "#00ff00"] : ["#00ff00", "#ff00ff"]);
  for (const p of g.parts) p.alpha = 1;
  for (const r of LIMB) for (const o of r) o.tint = null;
  const out = {};
  for (const s of [0, 1]) {
    const isFar = s === fs, ov = erode(body.map((v, i) => v & limb[s][i]));
    let n = 0, hit = 0;
    for (let i = 0; i < W * H; i++) {
      if (!ov[i]) continue;
      n++;
      const r = full[i * 4], gg = full[i * 4 + 1], b = full[i * 4 + 2];
      if (isFar ? gg > 2 * r + 20 && gg > 2 * b + 20 : r > 2 * gg + 20 && b > 2 * gg + 20) hit++;
    }
    out[isFar ? "far" : "near"] = { n, frac: n ? hit / n : 0 };
  }
  return out;
};
window.shot = (name, yaw, pitch, probe) => {
  pose(name); view(yaw, pitch);
  for (const p of g.parts) p.alpha = 1;
  d.draw();
  const fs = probe ? far() : -1;
  for (let s = 0; s < 2; s++) for (const o of LIMB[s]) o.tint = s === fs ? "#00ff00" : null;
  d.draw();
  for (const r of LIMB) for (const o of r) o.tint = null;
  return cv.toDataURL("image/png");
};
window.ready = true;
`;
const js = (await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: "ts" }, bundle: true, format: "esm", write: false, logLevel: "warning", target: "es2022" })).outputFiles[0].text;
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Holeshot legs</title></head><body style="margin:0;background:#1a1636"><canvas id="cv" style="width:480px;height:360px"></canvas><script type="module">${js.replace(/<\/script/g, "<\\/script")}</script></body></html>`;
const server = await serve(".", { "/": page });
const browser = await chromium.launch(launchOptions());
const MEDIA = process.env.MEDIA;
if (MEDIA) mkdirSync(MEDIA, { recursive: true });
const POSES = ["seated", "standing", "wheelie", "handdrag", "walk", "crash"], YAWS = Array.from({ length: 16 }, (_, i) => (i * Math.PI) / 8);

try {
  const p = await browser.newPage({ viewport: { width: 520, height: 400 } }), errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(server.url + "/");
  await p.waitForFunction(() => window.ready, null, { timeout: 20000 });
  const bad = [], worst = { far: 0, near: 1 };
  let judged = 0;
  for (const pitch of [0.3, 0.65]) for (const name of POSES) for (const yaw of YAWS) {
    const m = await p.evaluate(([n, y, pt]) => window.measure(n, y, pt), [name, yaw, pitch]);
    const tag = `${name} yaw ${yaw.toFixed(2)} pitch ${pitch}`;
    if (m.far.n >= 60) {
      judged++;
      worst.far = Math.max(worst.far, m.far.frac);
      if (m.far.frac > 0.03) bad.push(`${tag}: far limbs ${(m.far.frac * 100).toFixed(1)} % drawn over the bike (${m.far.n} px)`);
    }
    if (m.near.n >= 60 && name !== "crash") {
      worst.near = Math.min(worst.near, m.near.frac);
      if (m.near.frac < 0.6) bad.push(`${tag}: near limbs only ${(m.near.frac * 100).toFixed(1)} % over the bike (${m.near.n} px)`);
    }
  }
  if (MEDIA) {
    const save = async (file, name, yaw, pitch, probe) => writeFileSync(`${MEDIA}/${file}.png`, Buffer.from((await p.evaluate(([n, y, pt, pr]) => window.shot(n, y, pt, pr), [name, yaw, pitch, probe])).split(",")[1], "base64"));
    for (const [n, y, pt] of [["walk", 4.3, 0.45], ["walk", 2.0, 0.45], ["seated", 1.1, 0.6], ["seated", 3.9, 0.5], ["standing", 2.2, 0.55]]) await save(`${n}-${y}`, n, y, pt), await save(`${n}-${y}-probe`, n, y, pt, true);
    for (let i = 0; i < 16; i++) await save(`turn-${i}`, "seated", YAWS[i], 0.45), await save(`turn-${i}-probe`, "seated", YAWS[i], 0.45, true);
  }
  assert.deepEqual(errs, [], "no page errors");
  assert.ok(judged >= 60, `enough overlapping cases to judge (${judged})`);
  assert.deepEqual(bad, [], `far limbs behind the bike, near limbs over it:\n${bad.join("\n")}`);
  console.log(`Legs: ${judged} cases (16 yaws × 2 pitches × ${POSES.length} poses with overlap): far limbs at most ${(worst.far * 100).toFixed(1)} % drawn over the bike, near limbs at least ${(worst.near * 100).toFixed(0)} % over it.`);
} finally {
  await browser.close();
  await server.close();
}
