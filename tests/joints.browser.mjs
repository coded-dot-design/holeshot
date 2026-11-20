// The rider's elbows and knees stay joined through every trick, in Chromium. The rig
// (src/bike/rig.ts) on a bare diorama, bundled here with esbuild, on a few bikes (a 125 2-stroke, a
// 450 4-stroke, a pedal e-bike, a street bike). Frame by frame (60 a second) it drives:
//   - Wheelie City's drag ladder just past vertical, through ../src/modes/stunts.ts `pose` (the drag
//     eased as the scene eases it): the single hand drag, the double, leaned on to the fender drag,
//     back under 12 and settled;
//   - every Wheelie City combo trick (stunts COMBOS) and every Big Air freestyle trick
//     (../src/modes/bigair/fmx.ts POSES), each eased out, held, eased back in, then settled;
//   - a walking stride and a crash.
// Each frame it draws, then reads the bones' world matrices and asserts:
//   - each joint is one point: the upper arm's end is the forearm's start and the thigh's end is the
//     shin's start (gap < 0.001 model units, both sides);
//   - in the single hand drag the right hand stays on its grip;
//   - before every trick and after its recovery the hands are on the grips and the feet on the pegs
//     (< 0.001, and where they were before).
// MEDIA=<dir> saves the rear three-quarter frames the before/after sheet is made from.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const entry = `
import { diorama } from "@fzlt/core/diorama";
import { rig } from "./src/bike/rig.ts";
import { bike } from "./src/bike/bike.ts";
import { stunts, COMBOS, DOUBLE, FENDER, HAND } from "./src/modes/stunts.ts";
import { POSES } from "./src/modes/bigair/fmx.ts";
import { MODELS } from "./src/data/roster.ts";
import { newBike } from "./src/model/profile.ts";
import { tune } from "./src/model/tune.ts";
const cv = document.getElementById("cv"), d = diorama(cv, { light: [-0.4, 1, 0.6], ambient: 0.55, maxDpr: 1 });
d.resize(480, 360, 1);
const flat = { sample(_x, _z, out) { out[0] = 0; out[1] = 0; out[2] = 1; out[3] = 0; return 0; } };
const C = { plastic: "#2f6fd8", plastic2: "#d8d8e0", seat: "#202028", frame: "#3a3a4c", tyre: "#15151c", rim: "#b8bccc", metal: "#c9cde6", pipe: "#7e86a8", plate: "#e8e8ee", ink: "#101018",
  jersey: "#2fb4d8", pants: "#3a3a4c", helmet: "#f0f0f4", stripe: "#2f6fd8", visor: "#101018", boots: "#f4f4f8", gloves: "#ff3b6b", glow: "#d0d0d8", side: "#e8e8ee", num: 7 };
const UPPER = 0.29, FORE = 0.29, THIGH = 0.4, SHIN = 0.42;
let g = null, bk = null, st = null, LIMB = null;
window.models = () => ["buzzline", "slag-ox", "glidewire", MODELS.find((m) => m.cls === "street").id];
window.load = (id) => {
  d.clear();
  const m = MODELS.find((x) => x.id === id), t = tune(newBike(m.id, "x"));
  g = rig(d, "b", C, t.rig, "peak", m.id); bk = bike(flat, t.power, t.shape);
  st = stunts({ S: new Float64Array(64) });
  const by = (k) => d.get("b" + k);
  LIMB = [0, 1].map((s) => ["ua", "fa", "th", "sh"].map((k) => by((s ? "R" : "L") + k)));
  return { id, rig: t.rig, name: m.name };
};
/** Bike state: on its rear wheel at pitch p (both the drawn pitch and the sim's), or level. */
function setBike(p, walk = 0, crash = 0) {
  bk.reset(0, 0, 0);
  bk._f[0] = crash; bk._w[0] = walk;
  bk.rot[2] = p; bk.S[2] = p; bk.S[28] = p > 0.3 ? 1 : 0;
  if (crash) bk.rider.set(bk.pos), bk.riderRot.fill(0);
}
const end = (o, len, out) => { const M = o.M; out[0] = M[9] + M[0] * len; out[1] = M[10] + M[3] * len; out[2] = M[11] + M[6] * len; return out; };
const at = (o, out) => { out[0] = o.M[9]; out[1] = o.M[10]; out[2] = o.M[11]; return out; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const A = [0, 0, 0], B = [0, 0, 0];
/** Into the bike's frame (the root's matrix: rotation rows, then the origin). */
function local(p) {
  const M = g.root.M, x = p[0] - M[9], y = p[1] - M[10], z = p[2] - M[11];
  return [M[0] * x + M[3] * y + M[6] * z, M[1] * x + M[4] * y + M[7] * z, M[2] * x + M[5] * y + M[8] * z];
}
/** After a pose and a draw: the four joint gaps [L elbow, L knee, R elbow, R knee], the hands and feet in the bike's frame. */
function read() {
  const gap = [], hands = [], feet = [];
  for (const [ua, fa, th, sh] of LIMB) {
    gap.push(dist(end(ua, UPPER, A), at(fa, B)), dist(end(th, THIGH, A), at(sh, B)));
    hands.push(local(end(fa, FORE, A))); feet.push(local(end(sh, SHIN, A)));
  }
  return { gap, hands, feet };
}
const R = { worst: [0, 0, 0, 0], where: ["", "", "", ""], grip: 0, gripWhere: "", back: 0, backWhere: "", frames: 0, bad: [] };
function check(tag, f) {
  d.draw();
  const r = read();
  R.frames++;
  for (let k = 0; k < 4; k++) if (r.gap[k] > R.worst[k]) (R.worst[k] = r.gap[k]), (R.where[k] = tag + " f" + f);
  return r;
}
const sm = (u) => u * u * (3 - 2 * u);
const cmp = (a, b) => Math.max(...a.map((p, i) => dist(p, b[i])));
/** The grips and the pegs in the bike's frame (the rig's GRIP and PEG; the hands ±0.2 across, the feet ±0.15). */
const GRIPS = [[0.42, 0.33, -0.2], [0.42, 0.33, 0.2]], PEGS = [[-0.06, -0.33, -0.15], [-0.06, -0.33, 0.15]];
function backCheck(tag, base, r) {
  const e = Math.max(cmp(r.hands, base.hands), cmp(r.feet, base.feet), cmp(base.hands, GRIPS), cmp(base.feet, PEGS));
  if (e > R.back) (R.back = e), (R.backWhere = tag);
}
/** A trick: eased out over 0.3 s, held 0.6 s, back in over 0.3 s, settled 0.3 s; set(a) writes T. */
function trick(tag, p, stand, set) {
  setBike(p); g.T.fill(0); g.pose(bk, stand);
  const base = check(tag + " base", 0);
  const N = [18, 36, 18, 18];
  let f = 0;
  for (let ph = 0; ph < 4; ph++) for (let i = 1; i <= N[ph]; i++, f++) {
    const a = ph === 0 ? sm(i / N[0]) : ph === 1 ? 1 : ph === 2 ? 1 - sm(i / N[2]) : 0;
    setBike(p); g.T.fill(0); set(a);
    g.pose(bk, stand);
    check(tag, f);
  }
  backCheck(tag, base, read());
}
/** The drag ladder as Wheelie City plays it: HAND for 1.6 s, DOUBLE 1.2 s, FENDER 1 s, banked, settled 1.2 s. */
function ladder(tag, stand, frames) {
  const P = 1.68, FP = 2.05, dt = 1 / 60;
  setBike(P); g.T.fill(0); st.HD.fill(0); st.CO.fill(0); st.CO[1] = -1;
  st.pose(g.T, 0); g.pose(bk, stand);
  const base = check(tag + " base", 0);
  const plan = [[HAND, 96, P], [DOUBLE, 72, P], [FENDER, 60, FP], [0, 72, P]];
  let drag = 0, f = 0;
  for (const [lv, n, p] of plan) for (let i = 0; i < n; i++, f++) {
    const dg = lv ? 1 : 0;
    drag += (dg - drag) * Math.min(1, dt * 10);
    st.HD[1] = lv;
    setBike(p); g.T.fill(0); st.pose(g.T, drag); g.pose(bk, stand, dt);
    const r = check(tag + " " + ["settle", "hand", "double", "fender"][lv], f);
    if (frames && frames[f]) frames[f](r);
    if (lv === HAND) {
      // The right hand on its grip: where it was before the drag.
      const e = dist(r.hands[1], GRIPS[1]);
      if (e > R.grip) (R.grip = e), (R.gripWhere = tag + " f" + f);
    }
  }
  backCheck(tag, base, read());
}
window.run = () => {
  R.worst = [0, 0, 0, 0]; R.where = ["", "", "", ""]; R.grip = 0; R.back = 0; R.frames = 0;
  ladder("drag", 0.7);
  COMBOS.forEach((name, id) => trick("wheelie " + name, 1.2, 0.7, (a) => { st.HD.fill(0); st.CO[1] = id; st.CO[5] = a; st.pose(g.T, 0); }));
  const BA = ["SEAT GRAB", "CROSS-UP", "NAC-NAC", "HEEL CLICKER", "CAN-CAN", "SUPERMAN", "SUPERMAN SEAT GRAB", "CLIFFHANGER", "CHRIST AIR", "LAZY BOY", "HANDSTAND"];
  POSES.forEach((row, k) => trick("bigair " + BA[k], 0.15, 0.9, (a) => { for (let c = 0; c < row.length; c++) g.T[c] = row[c] * a; }));
  // Walking (a stride) and a crash.
  for (let f = 0; f < 60; f++) { setBike(0, 1); bk.spin[0] = f * 0.08; g.T.fill(0); g.pose(bk, 0.7); check("walk", f); }
  setBike(0, 0, 1); g.T.fill(0); g.pose(bk, 0.7); check("crash", 0);
  setBike(0); g.pose(bk, 0.7); d.draw();
  return { worst: R.worst, where: R.where, grip: R.grip, gripWhere: R.gripWhere, back: R.back, backWhere: R.backWhere, frames: R.frames };
};
/** The rear three-quarter camera (behind the bike, off its left side, a little above). */
function rear() {
  const M = g.rider.M;
  Object.assign(d.cam, { yaw: -0.75, pitch: 0.3, dist: 5.4, tx: M[9], ty: M[10] + 0.1, tz: M[11], ox: 0, oy: 0, fov: 0.55 });
  d.draw();
  return cv.toDataURL("image/png");
}
/** The sheet's frames: the drag's entry (left hand just off, the double starting) and full extension,
 *  Christ Air and Nac-Nac held. */
window.shots = () => {
  const out = {}, fr = {};
  fr[30] = () => (out.dragEntry = rear());
  fr[110] = () => (out.doubleEntry = rear());
  fr[220] = () => (out.dragFull = rear());
  ladder("shots", 0.7, fr);
  for (const [name, k] of [["christ", 8], ["nac", 2]]) {
    setBike(0.15); g.T.fill(0);
    for (let c = 0; c < POSES[k].length; c++) g.T[c] = POSES[k][c];
    g.pose(bk, 0.9); out[name] = rear();
  }
  return out;
};
window.ready = true;
`;
const js = (await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: "ts" }, bundle: true, format: "esm", write: false, logLevel: "warning", target: "es2022" })).outputFiles[0].text;
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Holeshot joints</title></head><body style="margin:0;background:#1a1636"><canvas id="cv" style="width:480px;height:360px"></canvas><script type="module">${js.replace(/<\/script/g, "<\\/script")}</script></body></html>`;
const server = await serve(".", { "/": page });
const browser = await chromium.launch(launchOptions());
const MEDIA = process.env.MEDIA;
if (MEDIA) mkdirSync(MEDIA, { recursive: true });
const EPS = 1e-3;

try {
  const p = await browser.newPage({ viewport: { width: 520, height: 400 } }), errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(server.url + "/");
  await p.waitForFunction(() => window.ready, null, { timeout: 20000 });
  const bad = [], all = { gap: [0, 0, 0, 0], grip: 0, back: 0, frames: 0 };
  const JOINT = ["left elbow", "left knee", "right elbow", "right knee"];
  for (const id of await p.evaluate(() => window.models())) {
    const m = await p.evaluate((x) => window.load(x), id);
    const r = await p.evaluate(() => window.run());
    all.frames += r.frames;
    for (let k = 0; k < 4; k++) {
      all.gap[k] = Math.max(all.gap[k], r.worst[k]);
      if (r.worst[k] >= EPS) bad.push(`${m.name} (${m.rig}): ${JOINT[k]} gap ${r.worst[k].toFixed(4)} at ${r.where[k]}`);
    }
    all.grip = Math.max(all.grip, r.grip); all.back = Math.max(all.back, r.back);
    if (r.grip >= EPS) bad.push(`${m.name}: the right hand off its grip in the single hand drag by ${r.grip.toFixed(4)} (${r.gripWhere})`);
    if (r.back >= EPS) bad.push(`${m.name}: hands/feet not back on the bars and pegs after ${r.backWhere} (${r.back.toFixed(4)})`);
    if (MEDIA && id === "buzzline") {
      const s = await p.evaluate(() => window.shots());
      for (const [k, v] of Object.entries(s)) writeFileSync(`${MEDIA}/${k}.png`, Buffer.from(v.split(",")[1], "base64"));
    }
  }
  assert.deepEqual(errs, [], "no page errors");
  console.log(`Joints: ${all.frames} frames on 4 bikes: max gap elbow L ${all.gap[0].toExponential(1)} R ${all.gap[2].toExponential(1)}, knee L ${all.gap[1].toExponential(1)} R ${all.gap[3].toExponential(1)}; right hand off its grip in the single drag ${all.grip.toExponential(1)}; hands/feet off the bars/pegs after recovery ${all.back.toExponential(1)} (all < ${EPS}).`);
  assert.deepEqual(bad, [], `joints joined, hands and feet home:\n${bad.join("\n")}`);
} finally {
  await browser.close();
  await server.close();
}
