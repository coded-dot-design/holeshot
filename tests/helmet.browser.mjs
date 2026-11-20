// The helmet's draw order in Chromium: its face shows from the front and never through the back of the
// shell. The rig (src/bike/rig.ts) on a bare diorama, bundled here with esbuild, every helmet shape, in
// five poses (standing, seated, wheelie, handstand, crashed), at 24 yaws (15° steps) × three pitches
// (low, level, from above), the camera on the head. Each case draws the shell alone (its slabs and the chin bar: a mask), then the
// whole frame with the goggle's lens and glint in a green probe and every other face part (frame,
// the dome's rim, the peak, the open face) in a magenta one. With the eye within 60° of the face,
// the lens shows (≥ 40 green px); more than 100° round from it, no green at all, and no magenta
// inside the shell's outline (eroded 2 px for its edge): a face part may stand out past the shell's
// edge, never show through it. Then a yaw sweep at the game's own cameras (the garage turntable and the
// race's chase cam): past 100° from the face no lens and no goggle frame or visor rim; the street
// dome's visor shows side-on (80–90°); the strap stays inside the shell's silhouette. Head-on, every
// shape's lens centroid sits in the middle of the helmet's height (35–75 % down: across the face
// between the peak and the chin bar, never up on the crown) and covers at least 12 % of the shell's
// head-on box; at the turntable's own camera the lens shows at every yaw up to side-on (90°); the
// strap never shows in the top 30 % of the helmet (no cap over the crown). MEDIA=<dir> saves a 24-yaw sheet of the head per pitch.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const entry = `
import { diorama } from "@fzlt/core/diorama";
import { rig, T_HANDSTAND, bandOf, strapOf } from "./src/bike/rig.ts";
import { bike, TWO_STROKE } from "./src/bike/bike.ts";
import { camOf } from "./src/garage/backdrop.ts";
import { tune } from "./src/model/tune.ts";
const cv = document.getElementById("cv"), d = diorama(cv, { light: [-0.4, 1, 0.6], ambient: 0.55, maxDpr: 1 });
const W = 360, H = 360;
d.resize(W, H, 1);
const C = { plastic: "#2f6fd8", plastic2: "#d8d8e0", seat: "#202028", frame: "#3a3a4c", tyre: "#15151c", rim: "#b8bccc", metal: "#c9cde6", pipe: "#7e86a8", plate: "#e8e8ee", ink: "#101018",
  jersey: "#2fb4d8", pants: "#e8e8ee", helmet: "#f0f0f4", stripe: "#d84f2f", visor: "#5a1f9e", boots: "#f4f4f8", gloves: "#202028", glow: "#d0d0d8", side: "#e8e8ee", num: 7 };
const mix = (a, b, t) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), c = (sh) => Math.round(((x >> sh) & 255) * (1 - t) + ((y >> sh) & 255) * t); return "#" + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1); };
const BAND = bandOf(C.helmet, C.stripe), STRAP = strapOf(C.helmet, BAND);
const flat = { sample(_x, _z, out) { out[0] = 0; out[1] = 0; out[2] = 1; out[3] = 0; return 0; } };
const rigs = {};
const under = (ob, id) => { for (let p = ob; p; p = p.parent) if (p.id === id) return true; return false; };
// The rig on the test's 2-stroke, or (\`model\`) on a shipped bike as the garage builds it (its tune).
function setup(helmet, model) {
  d.clear();
  const t = model && tune({ uid: "b", model, parts: { tyres: 1, chain: 1, motor: 1, susp: 1, brakes: 1 }, mods: {}, look: { paint: "acid", number: 7, graphics: "", plastics: "", plate: "" }, dmg: { bars: 0, plastics: 0 } });
  const g = t ? rig(d, "b", C, t.rig, helmet, t.model.id) : rig(d, "b", C, "2t", helmet), bk = t ? bike(flat, t.power, t.shape) : bike(flat, TWO_STROKE);
  const head = d.get("b:h"), shell = g.parts.filter((p) => p.parent === head && (p.shape === "cyl" || p.shape === "prism") && p.color === C.helmet);
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
  if (name === "garage") stand = 0.6;
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
// The yaw sweep at the game's own cameras: the garage turntable (close: the bike's preview, src/game.ts)
// and the race's chase cam (src/modes/race/scene.ts chaseO), the head seen round 360°. Every helmet
// part by its colour: the lens (the visor tint, the glint) green, the goggle frame and the dome's rim
// (the band, its side plates too) magenta, the strap blue, everything off the helmet a flat grey (so no
// bike colour reads as a probe). Returns the eye's angle from the face (degrees, 0 straight ahead, 180
// straight behind) and by yaw alone, the lens, frame and strap px, the strap px outside the shell's
// silhouette grown by 2 px, and the strap px in the top 30 % of the shell's height on screen.
// The turntable: the garage's own fixed camera (./src/garage/backdrop.ts camOf: its pitch and distance),
// aimed at the disc's centre as the garage aims it, its long lens narrowed 3× so the head fills the frame
// (the same view of it, larger).
const TT = camOf(1200, 840, 0);
const CAMS = { garage: { pitch: 0.16, dist: 3, lift: 0.96 }, race: { pitch: 0.36, dist: 9.5, lift: 0.9 }, turntable: { pitch: TT.pitch, dist: TT.dist, lift: 0, fov: TT.fov / 3 } };
const S2 = [0, 0, 0], Q2 = [0, 0, 0];
const dilate = (m) => { const o = new Uint8Array(m.length); for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { let on = 0; for (let dy = -2; dy <= 2 && !on; dy++) for (let dx = -2; dx <= 2; dx++) if (m[(y + dy) * W + x + dx]) { on = 1; break; } o[y * W + x] = on; } return o; };
window.sweep = (helmet, cam, yaw, model = "") => {
  if (now !== helmet + model) R = setup(helmet, model), (now = helmet + model);
  pose(cam === "turntable" ? "garage" : "standing");
  const c = CAMS[cam];
  d.draw();
  // The game's framing (the bike's centre, the rider's height), the picture shifted to the head so a far cam still judges it.
  Object.assign(d.cam, { yaw, pitch: c.pitch, dist: c.dist, tx: 0, ty: c.lift, tz: 0, ox: 0, oy: 0, fov: c.fov ?? 0.55 });
  d.draw();
  const M = R.head.M, hp = [0, 0, 0], ctr = [0, 0, 0];
  d.project(M[9], M[10], M[11], hp); d.project(0, c.lift, 0, ctr);
  d.cam.ox = ctr[0] - hp[0]; d.cam.oy = ctr[1] - hp[1];
  d.draw();
  d.project(M[9] + M[0] * 0.3, M[10] + M[3] * 0.3, M[11] + M[6] * 0.3, P); d.project(M[9] - M[0] * 0.3, M[10] - M[3] * 0.3, M[11] - M[6] * 0.3, Q);
  d.project(M[9] + M[2] * 0.3, M[10] + M[5] * 0.3, M[11] + M[8] * 0.3, S2); d.project(M[9] - M[2] * 0.3, M[10] - M[5] * 0.3, M[11] - M[8] * 0.3, Q2);
  const ang = (Math.atan2(Math.abs(Q2[2] - S2[2]), Q[2] - P[2]) * 180) / Math.PI;
  // The yaw from the face: the same, the face's direction and its side laid flat (the head's pitch left out).
  const fl = Math.hypot(M[0], M[6]) || 1, fx = M[0] / fl, fz = M[6] / fl;
  d.project(M[9] + fx * 0.3, M[10], M[11] + fz * 0.3, P); d.project(M[9] - fx * 0.3, M[10], M[11] - fz * 0.3, Q);
  d.project(M[9] - fz * 0.3, M[10], M[11] + fx * 0.3, S2); d.project(M[9] + fz * 0.3, M[10], M[11] - fx * 0.3, Q2);
  const yawAng = (Math.atan2(Math.abs(Q2[2] - S2[2]), Q[2] - P[2]) * 180) / Math.PI;
  const sm = grab((p) => R.shell.includes(p)), shell = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) shell[i] = sm[i * 4 + 3] > 200 ? 1 : 0;
  const grown = dilate(shell);
  // The helmet's height on screen: the shell's (its slabs and the chin bar) rows, from its top down to
  // the first empty row.
  const rows = new Uint16Array(H);
  for (let i = 0; i < W * H; i++) if (shell[i]) rows[(i / W) | 0]++;
  let top = 0;
  while (top < H - 1 && !rows[top]) top++;
  let bot = top;
  while (bot < H - 1 && rows[bot + 1]) bot++;
  const cap = top + 0.3 * (bot - top);
  const kind = (p) => (!under(p, "b:h") ? "#202020" : p.color === C.visor || (p.emissive && under(p, "b:hf")) ? "#00ff00" : p.color === BAND && p.layer < 7.3 && (under(p, "b:hf") || /:h[vg][LR]$/.test(p.parent?.id ?? "")) ? "#ff00ff" : p.color === STRAP ? "#0000ff" : null);
  const full = grab(() => true, kind);
  let lens = 0, frame = 0, strap = 0, out = 0, high = 0;
  for (let i = 0; i < W * H; i++) {
    const r = full[i * 4], gg = full[i * 4 + 1], b = full[i * 4 + 2];
    // (The probes' own pure colours, so the bike's blue or the jersey never count.)
    if (gg > 150 && r < 60 && b < 60) lens++;
    else if (r > 150 && b > 150 && gg < 60) frame++;
    else if (b > 200 && r < 30 && gg < 30) (strap++, !grown[i] && out++, (i / W) < cap && high++);
  }
  return { ang, yawAng, lens, frame, strap, out, high };
};
// Head-on (the eye straight ahead of the face, level and from a little above): where the lens sits
// in the helmet's height. The helmet's top and bottom are the shell's (its slabs and the chin bar)
// rows on screen; returns the lens px and their centroid's place down that height (0 the crown's top,
// 1 the chin's bottom) and their share of the shell's head-on bounding box.
window.front = (helmet, pitch) => {
  if (now !== helmet) R = setup(helmet), (now = helmet);
  pose("standing");
  let best = -2, by = 0;
  for (let i = 0; i < 72; i++) { const f = view((i * Math.PI) / 36, pitch); if (f > best) (best = f), (by = (i * Math.PI) / 36); }
  for (let i = -10; i <= 10; i++) { const y = by + (i * Math.PI) / 720, f = view(y, pitch); if (f > best) (best = f), (by = y); }
  view(by, pitch);
  const sm = grab((p) => R.shell.includes(p));
  let top = H, bot = -1, left = W, right = -1;
  for (let i = 0; i < W * H; i++) if (sm[i * 4 + 3] > 200) { const y = (i / W) | 0, x = i % W; top = Math.min(top, y); bot = Math.max(bot, y); left = Math.min(left, x); right = Math.max(right, x); }
  const full = grab(() => true, (p) => (R.lens.includes(p) && !p.emissive ? "#00ff00" : null));
  let n = 0, sy = 0;
  for (let i = 0; i < W * H; i++) if (full[i * 4 + 1] > 150 && full[i * 4] < 60 && full[i * 4 + 2] < 60) (n++, (sy += (i / W) | 0));
  return { facing: best, lens: n, at: n ? (sy / n - top) / Math.max(1, bot - top) : -1, area: n / Math.max(1, (bot - top + 1) * (right - left + 1)), top, bot };
};
window.sweepShot = (helmet, cam, yaw, model) => (window.sweep(helmet, cam, yaw, model), grab(() => true, () => null), cv.toDataURL("image/png"));
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
  // The yaw sweep at the garage turntable and the race cam, every 5°: past 100° from the face no lens
  // and no goggle frame or visor rim at all; the dome's visor shows side-on (80–90°); the strap stays
  // inside the shell's silhouette grown by 2 px (3 px of edge antialiasing allowed).
  let swept = 0, side = Infinity, strapOut = 0, ttLeast = Infinity;
  // (The turntable on shipped bikes of each kind, as the garage builds them: each sits the rider, and so
  // pitches the head, its own way.)
  const RUNS = [["garage", ""], ["race", ""], ...["sparkhound", "glidewire", "anvil", "curb-pup"].map((b) => ["turntable", b])];
  for (const h of HELMETS) for (const [cam, model] of RUNS) for (let i = 0; i < 72; i++) {
    const m = await p.evaluate(([h, c, y, b]) => window.sweep(h, c, y, b), [h, cam, (i * Math.PI) / 36, model]);
    const tag = `${h} ${cam} cam${model ? " on " + model : ""}, ${m.ang.toFixed(0)}° from the face (${m.yawAng.toFixed(0)}° by yaw)`;
    swept++;
    strapOut = Math.max(strapOut, m.out);
    if (m.ang > 100 && (m.lens || m.frame)) bad.push(`${tag}: from behind ${m.lens} lens px, ${m.frame} frame px show`);
    if (h === "dome" && m.ang >= 80 && m.ang <= 90) {
      side = Math.min(side, m.lens);
      if (m.lens < 40) bad.push(`${tag}: side-on the visor shows only ${m.lens} px`);
    }
    // At the turntable (the garage's pose, stand 0.6) the goggle's lens (the dome's visor) shows at every
    // yaw from straight ahead to side-on, by the face's direction or by its yaw alone (the head's pitch
    // left out): foreshortened, never gone while any of the face's side faces the eye.
    if (cam === "turntable" && (m.ang <= 90 || m.yawAng <= 90)) {
      ttLeast = Math.min(ttLeast, m.lens);
      if (m.lens < 20) bad.push(`${tag}: the lens shows only ${m.lens} px`);
    }
    // The strap runs round the head at goggle height: never in the top 30 % of the helmet (no cap over the crown).
    // (2 px of edge antialiasing allowed: the race cam's head is small.)
    if (m.high > 2) bad.push(`${tag}: ${m.high} strap px in the top 30 % of the helmet`);
    if (m.out > 3) bad.push(`${tag}: ${m.out} strap px outside the shell's silhouette`);
  }
  // Head-on, every shape: the goggle (or the dome's visor) across the face at eye height, between the
  // peak and the chin bar: the lens centroid in the middle band of the helmet's height, never in its
  // top 25 % (on the crown) nor its bottom 25 %.
  const fronts = [];
  for (const h of HELMETS) for (const pitch of [0, 0.2]) {
    const m = await p.evaluate(([h, pt]) => window.front(h, pt), [h, pitch]);
    const tag = `${h} head-on pitch ${pitch}`;
    fronts.push(`${h} ${m.at.toFixed(2)} (${(m.area * 100).toFixed(0)} %)`);
    if (m.lens < 40) bad.push(`${tag}: the lens shows only ${m.lens} px`);
    else if (m.at < 0.35 || m.at > 0.75) bad.push(`${tag}: the lens centroid at ${(m.at * 100).toFixed(0)} % down the helmet (crown ${m.top}, chin ${m.bot} px), not across the face`);
    // Big and readable, as the cover art and the portrait draw it.
    if (m.area < 0.12) bad.push(`${tag}: the lens is ${(m.area * 100).toFixed(1)} % of the helmet's head-on box (at least 12 %)`);
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
  console.log(`Helmet head-on: the lens centroid down the helmet's height (crown 0, chin 1) and its share of the head-on box: ${fronts.join(", ")}.`);
  console.log(`Helmet sweep: ${swept} views (${HELMETS.length} shapes × garage and race cams and the turntable on four bikes × 72 yaws): at the turntable the lens shows from 0 to 90° from the face (at least ${ttLeast} px); nothing of the goggle or visor past 100° from the face; the dome's visor side-on at least ${side} px; the strap at most ${strapOut} px outside the shell.`);
  console.log(`Helmet: ${HELMETS.length} shapes × ${POSES.length} poses × 24 yaws × 3 pitches: facing the eye (${front} cases) the lens shows (at least ${least} px); facing away (${back} cases) no lens and no face part through the shell.`);
} finally {
  await browser.close();
  await server.close();
}
