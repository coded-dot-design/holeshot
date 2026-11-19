// Big Air: a freestyle show on the player's own bike (from Fizlet's Big Air gallery piece). An
// endless straight of packed dirt in a stadium (./line.ts): a roll-in deck and a hill down for
// speed, then a big steel kicker and a tabletop landing every so often, forever, sized for your bike
// (a full-gas jump lands on the down ramp), banks and a stadium wall either side, crowd stands and
// light towers along the line; at night the steel glows with neon and the stands twinkle, by day it
// is pastel low-poly. A minute from the first gas. In the air hold
// TRICK (L or E) and the stick picks a trick (none: SKY PLANK, forward: LANTERN, back: CANNONBALL,
// side: PIXEL SPLIT); with no trick the stick pitches the bike (weight back all the way: a flip). Put
// the trick away and land on the down ramp, clean, to score; land with the trick out and it is a
// bail. At the end five judges score the run, and the judges pay.
// Bricks: the kernel, diorama, terrain, drive (`chase`), input, pad, sound. The run is ./show.ts and
// the scorer ./tricks.ts, both headless.
import { walkUi } from "../../bike/walk-ui.ts";
import { createEngine, seeded } from "@fzlt/core/kernel";
import { diorama } from "@fzlt/core/diorama";
import { terrainView, type TerrainView } from "@fzlt/core/terrain";
import { chase } from "@fzlt/core/drive";
import { controls } from "@fzlt/core/input";
import { rocker } from "../../bike/rocker.ts";
import { pad } from "@fzlt/core/pad";
import { sound } from "@fzlt/core/sound";
import { LOOP, ENDO, CASE, BAIL } from "../../bike/bike.ts";
import { meter } from "../meter.ts";
import { modeStage } from "../race/scene.ts";
import type { ModeCtx, ModeRun } from "../mode.ts";
import { rig, type Rig, type RigColors } from "../../bike/rig.ts";
import { pool, voice, gamepad, type Pool } from "../../bike/kit.ts";
import { TRICKS, CLEAN, SC, CB, PTS, LFLIPS, AIRT, BEST, FLIPS, CLEANS, CRASHES, JUMPS, SEEN } from "./tricks.ts";
import { DONE, E_CRASH, E_END, E_LAND, E_RESPAWN, E_RESET, E_STUCK, E_START, E_TRICK, READY, RUN, RUN_T, airShow } from "./show.ts";
import { BANK_W, HW, LDECK, LKH, LKL, LSP, LX0, ROLL_H, ROLL_X, SCELL, SCOLS, WALL_AT, heightAt } from "./line.ts";
import { speedo } from "../speedo.ts";
import { keysHTML, menuKeys, paintMute as paintMuteK, paintView } from "../keys.ts";

const TAU = 6.283185307179586;
type Kit = Omit<RigColors, "plastic" | "plastic2" | "jersey" | "pants" | "helmet" | "stripe" | "plate" | "ink">;
// The palettes by role: a neon night show (dark) and a pastel day (light).
const DARK = {
  night: true, light: [-0.4, 1, 0.55], amb: 0.44,
  sky0: "#05061a", sky1: "#170c38", sky2: "#3b1258", star: "#cfd8ff", grid: "#3b2a7a",
  ground: ["#0d1530", "#111b3b", "#152046"], crest: "#1a2a58", steep: "#0a1128", track: "#33244b", steel: "#5b6a9a", land: "#3d2a5a", edge: "#22e6ff", edge2: "#ff4fa8",
  plinth: "#120f26", rim: "#ff4fa8", table: "#0a0918", stand: "#1c1838", seat: "#2a2550", fans: ["#22e6ff", "#ff4fa8", "#ffd166", "#b6ff3b"], tower: "#24203f", lamp: "#fff2c2",
  ink: "#0b0a14", dust: "#7c68c4", spark: "#ffd166", shadow: "#000000", hot: "#ff4fa8", ok: "#22e6ff", meter: "#16132b",
  kit: { seat: "#14121f", frame: "#2b2a3d", tyre: "#0f0f16", rim: "#9aa0c8", metal: "#c9cde6", pipe: "#7e86a8", visor: "#0a0c16", boots: "#e9ecff", gloves: "#14121f", glow: "#ff2e88" } as Kit,
  team: { plastic: "#ff4fa8", plastic2: "#eef0ff", jersey: "#ff4fa8", pants: "#1b1a2c", helmet: "#eef0ff", stripe: "#22e6ff", plate: "#eef0ff", ink: "#0b0a14" },
};
type Pal = typeof DARK;
const LIGHT: Pal = {
  ...DARK, night: false, light: [0.6, 1, 0.45], amb: 0.54,
  sky0: "#ffd7c2", sky1: "#ffe8d6", sky2: "#fff6e8", star: "#ffffff", grid: "#ffffff",
  ground: ["#b8e2c4", "#a9d8b6", "#9ccfab"], crest: "#c6ebd0", steep: "#8dc39d", track: "#ddb184", steel: "#b9c3dc", land: "#e8c398", edge: "#fff5e6", edge2: "#ff7a59",
  plinth: "#c98f6a", rim: "#fff0dc", table: "#f0d2b4", stand: "#e9e2f5", seat: "#cfc4e6", fans: ["#13a9bb", "#ff7a59", "#f2b33d", "#7cc93a"], tower: "#8a8fb0", lamp: "#ffe9a8",
  ink: "#1b1420", dust: "#e9c39a", spark: "#fff1a8", shadow: "#5a3a2a", hot: "#ff4f6d", ok: "#13a9bb", meter: "#ffffff",
  kit: { seat: "#2a2833", frame: "#3a3a4c", tyre: "#24232b", rim: "#d9dbe6", metal: "#eceef7", pipe: "#9aa0b8", visor: "#1b1d2a", boots: "#ffffff", gloves: "#2a2833", glow: "#ff3b30" },
  team: { plastic: "#ff7a59", plastic2: "#ffffff", jersey: "#ff7a59", pants: "#2c3550", helmet: "#ffffff", stripe: "#13a9bb", plate: "#ffffff", ink: "#1b1420" },
};
const DUST = 120, SPARK = 60, FANS = 160;
/** Scenery sets along the line (one per jump: the kicker's posts, the flags, a stand, towers), moved on as you ride. */
const SETS = 4, SET_FANS = FANS / SETS;
const CRASH_NAME: Record<number, string> = { [LOOP]: "LOOPED IT!", [ENDO]: "NOSED IN!", [CASE]: "CASED IT!", [BAIL]: "BAILED!", 5: "WIPEOUT!" };
const KEYS_HINT = "In the air: L + stick for a trick · S held for a flip";

export function mountAir(ctx: ModeCtx): ModeRun {
  const stage = modeStage(ctx.host, "ba");
  const engine = createEngine({ root: stage, settle: 0.5, seed: ctx.seed });
  const L = engine.ledger, sig = { signal: engine.signal };
  let P: Pal = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;
  const m = meter("bigair");

  // ---- the page ----
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "ba-play";
  play.setAttribute("aria-label", "Big Air: Space or J for gas, K or Shift to brake, W and S (or up and down) shift your weight (in the air: pitch, all the way back for a flip), A and D steer; in the air hold L or E for a trick, the stick picks which. V changes the view, M mutes, P or Escape pauses");
  const hud = L.add(document.createElement("div"));
  hud.className = "ba-hud";
  hud.innerHTML = `<div class="ba-head"><p class="ba-top"><b class="ba-chip ba-score"><span>0</span><i>×1</i></b><b class="ba-chip ba-time"><span>1:00</span></b><b class="ba-chip ba-ride"><span>#${ctx.number} ${ctx.bike.model.name}</span></b></p><p class="ba-hint"></p></div><p class="ba-toast" hidden></p><p class="ba-live" aria-live="polite"></p><p class="ba-keys">${keysHTML("ba", { reset: "Back to the run-in (R)", theme: !!ctx.theme })}</p>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement;
  const toastEl = hud.children[1] as HTMLElement, live = hud.children[2] as HTMLElement, keysEl = hud.children[3] as HTMLElement;
  const scoreEl = top.children[0]!.firstChild as HTMLElement, comboEl = top.children[0]!.lastChild as HTMLElement, timeEl = top.children[1]!.firstChild as HTMLElement;
  // The speed, next to the clock (Big Air has no distance).
  const speedW = speedo(top.children[1]!, "ba", ctx.units);
  const viewK = keysEl.querySelector(".ba-view") as HTMLButtonElement, muteK = keysEl.querySelector(".ba-mute") as HTMLButtonElement;
  // Unstuck: the prompt (the race scene's sticker, ../race/scene.css).
  const stuckEl = document.createElement("p");
  stuckEl.className = "ba-stuck";
  stuckEl.hidden = true;
  stuckEl.textContent = "STUCK? Hold R / tap ↺ to reset";
  hud.append(stuckEl);
  let resetQ = 0;
  stage.append(canvas, play, hud);
  if (ctx.attract) hud.hidden = true;
  const snd = sound(engine, { cues: { start: "ready", trick: "click", clean: "power", sketchy: "click", crash: "boom", end: "win" }, volume: 0.1, on: ctx.sound && !ctx.attract });
  const vox = voice();
  vox.on = snd.on;
  const c = controls(engine, { keys: { left: [], right: [], fwd: [], back: [], gas: [], brake: [], trick: [], reset: [] }, target: play });
  const GAS = c.id("gas"), BRAKE = c.id("brake"), LEFT = c.id("left"), RIGHT = c.id("right"), FWD = c.id("fwd"), BACK = c.id("back"), TRICK = c.id("trick"), RESETK = c.id("reset");
  const ICON_TRICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3 7 7 .6-5.4 4.6 1.7 7.3L12 17.6 5.7 21.5l1.7-7.3L2 9.6 9 9z" fill="currentColor"/></svg>';
  const thePad = pad(engine, c, {
    scheme: "stick",
    // Gas and brake on the throttle rocker (../../bike/rocker.ts); TRICK an icon key beside it.
    actions: [
      { intent: "trick", label: "", icon: ICON_TRICK, name: "Trick (L)", key: "L", role: "flag", hold: true },
    ],
    host: stage,
  });
  thePad.el.classList.add("ba-pad");
  const rock = rocker(c, thePad.el, { reduced: ctx.reduced, signal: engine.signal });
  // Walking the bike: the WALK chip, and on a touch screen the one-time "stick back" hint.
  const coarse = matchMedia("(pointer: coarse)"), walkHud = walkUi(hud, () => coarse.matches && !ctx.attract);
  if (ctx.attract) thePad.el.hidden = true;
  const paintMute = () => paintMuteK(muteK, snd.on);
  paintMute();
  const toggle = () => {
    snd.on = vox.on = !snd.on;
    paintMute();
  };

  // ---- the run and the diorama ----
  const show = airShow(ctx.seed, { power: ctx.bike.power, shape: ctx.bike.shape }), t = show.t, me = show.b, sc = show.sc;
  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => P.table, overlay: drawOverlay, get shadowColor() { return P.shadow; } });
  let tv: TerrainView, dust: Pool, spark: Pool, fans: Pool, g: Rig;
  const G = show.G;
  const rnd = seeded(ctx.seed);
  let sky: CanvasGradient | null = null;
  const STARS = new Float32Array(120);
  for (let i = 0; i < 120; i++) STARS[i] = rnd();
  // The crowd: where each fan's light sits (x, y, z), its colour slot.
  const FAN = new Float64Array(FANS * 3);
  /** The scenery: its pieces (each its own root), each one's x from its set's kicker and its set; the jump each set stands at. */
  const PIECES: ReturnType<typeof dio.add>[] = [], PIECE_X: number[] = [], PIECE_Q: number[] = [], SETJ = new Int32Array(SETS).fill(-99);

  function buildScene() {
    dio.clear();
    dio.setLight(P.light, P.amb);
    dio.cluster("sky", { fixed: -10 });
    dio.cluster("table", { fixed: -5 });
    dio.decal("sky", 0, paintSky);
    tv = terrainView(dio, t, {
      bands: [[0.55, P.ground[0]!], [1.4, P.ground[1]!], [2.6, P.ground[2]!], [99, P.crest]], steep: 0.6, steepColor: P.steep, kinds: [P.track, P.steel, P.land],
      light: P.light, ambient: P.amb, lod: [22, 40], shadows: 2, shadowColor: P.shadow, split: "adaptive",
    });
    dio.decal("terrain", 1, paintLines);
    // One scenery set per jump, all alike (every jump is the same shape), positions relative to its
    // kicker's start: the kicker's posts and neon lights at the lip, flags at the knuckle, a crowd
    // stand on the far side's outfield, a light tower each side.
    SETJ.fill(-99);
    const kx = G[LX0]!, lipX = G[LKL]!, knX = G[LKL]! + G[LDECK]!, sp = G[LSP]!, hAt = (dx: number, z: number) => heightAt(G, kx + dx, z);
    const standZ = WALL_AT - 1.6, standY = hAt(sp * 0.5, standZ), standL = Math.min(sp * 0.8, 34);
    // Each piece is its own root (its own depth-sorted cluster, so the bike draws in front of or
    // behind it right); PIECE holds each one's x from its set's kicker.
    PIECES.length = 0;
    PIECE_X.length = 0;
    const put = (q: number, rel: number, def: Parameters<typeof dio.add>[0]) => {
      const o = dio.add({ ...def, cluster: `s${q}_${PIECES.length}` });
      PIECES.push(o), PIECE_X.push(rel), PIECE_Q.push(q);
      return o;
    };
    PIECE_Q.length = 0;
    for (let q = 0; q < SETS; q++) {
      for (const side of [-1, 1]) {
        const z = side * (HW + 0.12), y = hAt(lipX, z), pid = `kp${q}${side}`;
        put(q, lipX, { id: pid, shape: "cyl", sides: 6, size: [0.18, G[LKH]! + 0.4, 0.18], pos: [0, y - G[LKH]! + 0.1, z], color: P.tower, pick: false });
        dio.add({ size: [0.26, 0.26, 0.26], on: pid, color: side > 0 ? P.edge : P.edge2, emissive: true, pick: false });
        const fz = side * (HW + 0.6), fy = hAt(knX, fz), fid = `fl${q}${side}`;
        put(q, knX, { id: fid, shape: "cyl", sides: 5, size: [0.08, 3.2, 0.08], pos: [0, fy, fz], color: P.tower, pick: false });
        dio.add({ shape: "wedge", size: [0.7, 0.45, 0.04], pos: [0.35, -0.5, 0], on: fid, color: side > 0 ? P.edge : P.edge2, emissive: P.night, pick: false });
        // A light tower on the outfield, between this jump and the next.
        const tz = side * (HW + BANK_W + 2.2), tx = sp * 0.62 + side * 3, tid = `tw${q}${side}`;
        put(q, tx, { id: tid, shape: "cyl", sides: 6, size: [0.3, 5.4, 0.3], pos: [0, hAt(tx, tz) - 0.1, tz], color: P.tower, pick: false });
        dio.add({ size: [1.3, 0.5, 0.25], rot: [0, Math.PI / 2, 0], on: tid, color: P.tower, pick: false });
        dio.add({ size: [1.1, 0.34, 0.27], pos: [0, 0.08, 0], rot: [0, Math.PI / 2, 0], on: tid, color: P.lamp, emissive: true, pick: false, layer: 9 });
      }
      // The crowd stand: three stepped rows on the far outfield, across the line from the chase camera (one piece), the fans' lights over them.
      const sid = `st${q}`;
      put(q, sp * 0.5, { id: sid, size: [standL, 0.45, 1.1], pos: [0, standY - 0.2, standZ], color: P.stand, pick: false, layer: 1 });
      for (let k = 1; k < 3; k++) dio.add({ size: [standL, 0.45 + k * 0.45, 1.1], pos: [0, -0.45, k * 0.9], on: sid, color: k & 1 ? P.seat : P.stand, pick: false, layer: 1 + k });
      for (let k = 0; k < 3; k++) dio.add({ size: [standL, 0.08, 0.3], pos: [0, k * 0.45, -0.4 + k * 0.9], on: sid, color: P.fans[k]!, emissive: P.night, pick: false, layer: 4 + k });
    }
    for (let i = 0; i < FANS; i++) {
      const row = i % 3, n = i % SET_FANS;
      // Relative to its set's kicker (placeSets adds the set's place).
      FAN[i * 3] = sp * 0.5 - standL * 0.46 + ((n / 3) | 0) * ((standL * 0.92) / (SET_FANS / 3));
      FAN[i * 3 + 1] = standY + 0.45 + row * 0.45;
      FAN[i * 3 + 2] = standZ - 0.4 + row * 0.9;
    }
    // The roll-in's start deck: a gantry over it.
    for (const side of [-1, 1]) dio.add({ size: [0.3, 4.2, 0.3], pos: [ROLL_X + 1.5, ROLL_H - 0.1, side * (HW + 0.4)], color: P.tower, pick: false });
    dio.add({ size: [0.5, 0.9, HW * 2 + 1.1], pos: [ROLL_X + 1.5, ROLL_H + 3.6, 0], color: P.rim, emissive: P.night, pick: false });
    g = rig(dio, "rider", { ...P.kit, ...ctx.look }, ctx.bike.rig, ctx.helmet);
    dust = pool(dio, DUST, P.dust, 4);
    spark = pool(dio, SPARK, P.spark, 6);
    fans = pool(dio, FANS, P.fans[0]!, 7);
    fans.P.n = FANS;
    for (let i = 0; i < FANS; i++) (fans.P.x[i] = FAN[i * 3]!), (fans.P.y[i] = FAN[i * 3 + 1]!), (fans.P.z[i] = FAN[i * 3 + 2]!), (fans.P.r[i] = 0.07), (fans.P.a[i] = P.night ? 0.8 : 0.9);
    sky = null;
    placeSets();
    pose();
  }

  // ---- state ----
  const I = new Float64Array(6), GP = new Float64Array(7), tmp = new Float64Array(3), tmp2 = new Float64Array(3);
  const PD = new Float64Array(6);
  PD[5] = -1;
  const V = new Float64Array(8);
  V[0] = V[1] = 1;
  let view = 1, auto = !!ctx.auto || !!ctx.attract, dirty = true, hudDirty = true, shake = 0, toastT = 0, endAt = -1, emitK = 0, cheer = 0, paused = false, ended = false, chaseSet = false;
  const was = new Float64Array(8).fill(-1);
  const TABLE = { yaw: 0, pitch: 0.78, dist: 40, tx: 0, ty: 0, tz: 0.6, ox: 0, oy: 0, fov: 0.62 };
  // Fixed for the event (no zoom; set once from the stage shape at the start).
  const chaseO = { dist: 11, pitch: 0.3, lift: 1.2, ahead: 0.35, rate: 3.2, turn: 2.4, side: 0.72, snap: !!ctx.reduced };
  const VEL = new Float64Array(3), CTP = new Float64Array(3), target = { pos: CTP, yaw: 0, vel: VEL };
  // Resizes are debounced; only a new width refits the framing (height-only is the mobile URL bar).
  let rzT: ReturnType<typeof setTimeout> | 0 = 0;
  const ro = new ResizeObserver(() => {
    if (rzT) clearTimeout(rzT);
    rzT = setTimeout(() => ((rzT = 0), (V[0] = 1), engine.wake()), V[5] ? 150 : 0);
  });
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  addEventListener("gamepadconnected", () => ((V[6] = 1), engine.wake()), sig);
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect(), vox.close(), rzT && clearTimeout(rzT)), { once: true });

  /** The scenery sets on the jumps round the bike (one behind, the one it is on, two ahead); a set
   *  that falls behind moves on ahead, and its fans with it. */
  function placeSets() {
    const j0 = Math.max(0, show.jump) - 1;
    for (let q = 0; q < SETS; q++) {
      // Set q stands at the jump in j0 .. j0 + 3 that is q mod SETS.
      const j = j0 + ((((q - j0) % SETS) + SETS) % SETS);
      if (SETJ[q] === j) continue;
      SETJ[q] = j;
      const x = G[LX0]! + j * G[LSP]!;
      for (let n = 0; n < PIECES.length; n++) if (PIECE_Q[n] === q) PIECES[n]!.pos[0] = x + PIECE_X[n]!;
      for (let n = q * SET_FANS; n < (q + 1) * SET_FANS; n++) fans.P.x[n] = FAN[n * 3]! + x;
    }
  }
  /** The rider's trick pose from the trick out and how far (see rig's TRICK_POSE). */
  function pose() {
    const T = g.T, a = show.trickAmount, id = show.trick;
    T.fill(0);
    if (id === 0) (T[1] = a), (T[3] = 0.55 * a), (T[4] = 0.35 * a);
    else if (id === 1) (T[0] = a), (T[6] = 1), (T[4] = 0.5 * a);
    else if (id === 2) (T[2] = a), (T[1] = 0.25 * a), (T[4] = 0.45 * a);
    else if (id === 3) (T[7] = a), (T[4] = 0.15 * a);
    g.pose(me, me.air > 0 || Math.abs(me.speed) > 4 ? 0.9 : 0.4);
    walkHud.update(me);
    const x = me.pos[0]!, z = me.pos[2]!, inside = x > t.x0 && x < t.x0 + SCOLS * SCELL, lift = inside ? me.pos[1]! - t.height(x, z) : 9;
    tv.shadow(0, x, z, 1.0, inside ? Math.max(0, 0.38 - lift * 0.06) : 0);
  }

  function stepFx(dt: number) {
    let any = false;
    if (!me.crashed && me.contact[0]) {
      emitK += me.dust * 55 * dt;
      while (emitK >= 1) {
        emitK -= 1;
        dust.puff(me.wheel[0]! + (rnd() - 0.5) * 0.3, me.wheel[1]! - 0.25, me.wheel[2]! + (rnd() - 0.5) * 0.3, -me.cy * me.speed * 0.12 + (rnd() - 0.5), 0.4 + rnd() * 0.6, me.sy * me.speed * 0.12 + (rnd() - 0.5), 0.6 + rnd() * 0.5, 0.11, 0.4);
      }
    }
    if (dust.step(dt, -0.4, 0.22, 0.32)) any = true;
    if (spark.step(dt, 12, -0.05, 1)) any = true;
    // The crowd: lights bob and flash after a big landing.
    if (cheer > 0) {
      cheer = Math.max(0, cheer - dt);
      for (let i = 0; i < FANS; i++) (fans.P.y[i] = FAN[i * 3 + 1]! + (Math.sin(engine.time * 18 + i * 1.7) > 0.3 ? 0.08 * cheer : 0)), (fans.P.a[i] = 0.5 + 0.5 * (Math.sin(engine.time * 9 + i) > 0 ? 1 : 0.4));
      any = true;
    }
    return any;
  }

  function events() {
    for (let k = 0; k < show.n; k++) {
      const type = show.ev[k * 2]!, val = show.ev[k * 2 + 1]!;
      hudDirty = true;
      if (type === E_START) engine.events.emit("start"), toast("GO! 1:00 ON THE CLOCK", "go"), say("Go");
      else if (type === E_TRICK) engine.events.emit("trick"), toast(TRICKS[val]!, "trick");
      else if (type === E_LAND) {
        const S = sc.S, clean = val === CLEAN, flips = S[LFLIPS]!;
        engine.events.emit(clean ? "clean" : "sketchy");
        const what = flips ? (flips > 1 ? `${flips}× BACKFLIP` : me.airSpin < 0 ? "FRONTFLIP" : "BACKFLIP") + " · " : "";
        toast(`${what}+${S[PTS]!.toLocaleString("en-US")}${clean ? (S[CB]! > 1 ? ` · COMBO ×${S[CB]}` : " · CLEAN") : " · SKETCHY"}`, clean ? "clean" : "meh");
        if (S[PTS]! > 600) cheer = 1.6;
        say(`${what}${S[PTS]} points`);
        dust.ring(rnd, me.pos[0]!, me.pos[1]! - 0.6, me.pos[2]!, clean ? 10 : 16, 2.4, 1, 0.8, 0.2, 0.55);
      } else if (type === E_CRASH) {
        shake = ctx.reduced ? 0 : 0.5;
        engine.events.emit("crash");
        toast(CRASH_NAME[val] || "WIPEOUT!", "bad");
        say(CRASH_NAME[val] || "Wipeout");
        for (let q = 0; q < 24; q++) {
          const a = rnd() * TAU, u = 0.4 + rnd();
          spark.puff(me.pos[0]!, me.pos[1]!, me.pos[2]!, Math.cos(a) * 4 * u, 2 + rnd() * 4, Math.sin(a) * 4 * u, 0.5 + rnd() * 0.5, 0.07, 1);
        }
        dust.ring(rnd, me.pos[0]!, me.pos[1]! - 0.4, me.pos[2]!, 18, 3, 1.2, 1, 0.24, 0.6);
      } else if (type === E_RESPAWN) {
        CTP.set(me.pos);
        chase(dio.cam, target, { ...chaseO, snap: view === 1 }, 1 / 60);
      } else if (type === E_STUCK) stuckEl.hidden = !val;
      else if (type === E_RESET) {
        stuckEl.hidden = true;
        CTP.set(me.pos);
        chase(dio.cam, target, { ...chaseO, snap: true }, 1 / 60);
        toast(val === 2 ? "UNSTUCK · BACK TO THE RUN-IN" : "BACK TO THE RUN-IN", "go");
      } else if (type === E_END) {
        engine.events.emit("end");
        toast("TIME!", "go");
        endAt = engine.time + 1.4;
        engine.busy(1.5);
      }
    }
    show.clear();
  }
  function toast(text: string, kind: string) {
    toastEl.textContent = text;
    toastEl.className = "ba-toast ba-" + kind;
    toastEl.hidden = false;
    toastT = 1.5;
  }
  let said = "";
  function say(s: string) {
    if (s === said) s += " ";
    live.textContent = said = s;
  }
  function hudWrite() {
    const S = sc.S, ph = show.phase;
    if (was[0] !== S[SC]) (was[0] = S[SC]!), (scoreEl.textContent = S[SC]!.toLocaleString("en-US"));
    if (was[1] !== S[CB]) (was[1] = S[CB]!), (comboEl.textContent = "×" + (1 + S[CB]!)), comboEl.classList.toggle("ba-hot", S[CB]! > 0);
    speedW(me.speed);
    const secs = Math.ceil(show.clock);
    if (was[2] !== secs) (was[2] = secs), (timeEl.textContent = `${(secs / 60) | 0}:${("" + (secs % 60)).padStart(2, "0")}`), timeEl.parentElement!.classList.toggle("ba-low", secs <= 10 && ph === RUN);
    const touch = !!thePad.el.offsetParent;
    const hint = ph === READY ? (touch ? "Hold GAS to start the clock" : "Space to go · " + KEYS_HINT) : ph === RUN && show.clock > RUN_T - 8 ? (touch ? "In the air: TRICK + stick · stick back for a flip" : KEYS_HINT) : "";
    if (hintEl.textContent !== hint) hintEl.textContent = hint;
  }
  function stats() {
    const S = sc.S;
    let seen = 0;
    for (let i = 0; i < TRICKS.length; i++) seen += (S[SEEN]! >> i) & 1;
    return m.stats({ finished: show.phase === DONE, judges: show.phase === DONE ? sc.JD[5]! : 0, flips: S[FLIPS]!, score: S[SC]!, where: "arena", summary: `${S[SC]!.toLocaleString("en-US")} pts · best jump ${S[BEST]!.toLocaleString("en-US")} · ${seen}/${TRICKS.length} tricks · ${S[FLIPS]} ${S[FLIPS] === 1 ? "flip" : "flips"} · ${S[CLEANS]}/${S[JUMPS]} clean` });
  }
  function end() {
    endAt = -1;
    if (ended || ctx.attract) return;
    ended = true;
    setView(0);
    ctx.end(stats());
  }

  function frameTable() {
    // The side view: high over the near bank, the line running across the screen, following the bike.
    const W = dio.width, H = dio.height, tall = H / W > 0.75;
    TABLE.yaw = tall ? -0.5 : -0.28;
    TABLE.pitch = tall ? 0.72 : 0.5;
    TABLE.dist = tall ? 44 : 36;
    TABLE.ty = 1;
    TABLE.tz = 0;
    TABLE.ox = TABLE.oy = 0;
    TABLE.tx = me.pos[0]! + 8;
    if (!chaseSet) (chaseSet = true), (chaseO.dist = tall ? 12.5 : 11), (chaseO.pitch = tall ? 0.42 : 0.3);
  }
  function stepCam(dt: number) {
    const cam = dio.cam;
    if (!me.crashed) target.yaw = me.yaw;
    const src = me.crashed ? me.rider : me.pos;
    CTP[0] = src[0]!;
    CTP[1] = Math.max(-1, src[1]! * 0.85);
    CTP[2] = Math.max(-HW - 8, Math.min(HW + 8, src[2]!));
    VEL[0] = me.cy * me.speed; VEL[1] = 0; VEL[2] = -me.sy * me.speed;
    if (view) {
      const m = chase(cam, target, chaseO, dt), k = 1 - Math.exp(-4 * dt);
      cam.ox -= cam.ox * k;
      cam.oy -= cam.oy * k;
      return m || Math.abs(cam.ox) + Math.abs(cam.oy) > 0.2;
    }
    const k = ctx.reduced ? 1 : 1 - Math.exp(-2.6 * dt);
    TABLE.tx = src[0]! + 8;
    let moving = false;
    for (const key of ["yaw", "pitch", "dist", "tx", "ty", "tz", "ox", "oy"] as const) {
      let d = TABLE[key] - cam[key];
      if (key === "yaw") d -= TAU * Math.floor(d / TAU + 0.5);
      if (Math.abs(d) > 1e-3) (cam[key] += d * k), (moving = true);
      else cam[key] = TABLE[key];
    }
    return moving;
  }
  function setView(n: number) {
    view = n;
    paintView(viewK, !n);
    dirty = true;
    engine.busy(2.5);
    engine.wake();
  }

  function paintSky(ctx: CanvasRenderingContext2D) {
    const W = dio.width, H = dio.height;
    if (!sky) {
      sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, P.sky0);
      sky.addColorStop(0.6, P.sky1);
      sky.addColorStop(1, P.sky2);
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    if (P.night) {
      ctx.fillStyle = P.star;
      for (let i = 0; i < 120; i += 3) {
        ctx.globalAlpha = 0.2 + STARS[i + 2]! * 0.6;
        ctx.fillRect(STARS[i]! * W, STARS[i + 1]! * H * 0.55, 1.5, 1.5);
      }
      // Two searchlights sweeping the night.
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 2; k++) {
        const a = Math.sin(engine.time * 0.4 + k * 2.1) * 0.5 + (k ? 0.35 : -0.35), x = W * (k ? 0.8 : 0.2);
        ctx.fillStyle = k ? P.edge : P.edge2;
        ctx.globalAlpha = 0.08;
        ctx.beginPath();
        ctx.moveTo(x, H * 0.62);
        ctx.lineTo(x + Math.sin(a - 0.06) * H, H * 0.62 - Math.cos(a - 0.06) * H);
        ctx.lineTo(x + Math.sin(a + 0.06) * H, H * 0.62 - Math.cos(a + 0.06) * H);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.7;
      for (let k = 0; k < 3; k++) {
        const x = W * (0.15 + k * 0.33), y = H * (0.12 + (k & 1) * 0.07), r = Math.min(W, H) * 0.045;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.arc(x + r * 1.1, y + r * 0.2, r * 0.8, 0, TAU);
        ctx.arc(x - r, y + r * 0.3, r * 0.7, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
  /** The line's neon edges, along both sides from behind the bike to far ahead, just over the dirt. */
  function paintLines(ctx: CanvasRenderingContext2D) {
    ctx.lineCap = "round";
    const f = dio.focal(), x0 = Math.max(ROLL_X, t.x0 + 1), x1 = t.x0 + SCOLS * SCELL - 1;
    for (let side = 0; side < 2; side++) {
      ctx.strokeStyle = side ? P.edge : P.edge2;
      const z = (side ? 1 : -1) * (HW + 0.05);
      let pen = false;
      for (let x = Math.ceil(x0); x <= x1; x += 1) {
        if (!dio.project(x, t.height(x, z) + 0.04, z, tmp) || tmp[2]! < 0.5) { pen = false; continue; }
        if (pen) {
          ctx.lineWidth = Math.max(1, (f * 0.16) / tmp[2]!);
          ctx.beginPath();
          ctx.moveTo(tmp2[0]!, tmp2[1]!);
          ctx.lineTo(tmp[0]!, tmp[1]!);
          ctx.stroke();
        }
        tmp2[0] = tmp[0]!; tmp2[1] = tmp[1]!; tmp2[2] = tmp[2]!;
        pen = true;
      }
    }
  }
  /** The jump sticker: air time, the trick out and its hold, the flip so far (a dial). */
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    if (show.phase !== RUN || !(me.air > 0.12) || me.crashed) return;
    const W = dio.width, H = dio.height, s = Math.max(0.8, Math.min(1.2, W / 720)), w = 176 * s, h = 52 * s, x = 10, y = H - V[4]! - h - 6;
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 3, w, h, 8);
    ctx.fill();
    ctx.fillStyle = P.meter;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
    // The flip dial: the pitch turned this jump, a full turn round the ring.
    const cx = x + h / 2, cy = y + h / 2, r = h * 0.32, turned = me.airSpin;
    ctx.lineWidth = 5 * s;
    ctx.strokeStyle = P.night ? "#2a2545" : "#e8e4f0";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = Math.abs(turned) > TAU - 0.8 ? P.hot : P.ok;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 - Math.max(-TAU, Math.min(TAU, turned)), turned > 0);
    ctx.stroke();
    ctx.fillStyle = P.night ? "#e9e6ff" : "#1b1420";
    ctx.font = `900 ${Math.round(11 * s)}px ui-rounded, system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const id = show.trick;
    ctx.fillText(id >= 0 ? TRICKS[id]! : `AIR ${me.air.toFixed(1)}s`, x + h + 2, y + h * 0.36);
    // The trick's hold: how long it has been all the way out this jump.
    if (id >= 0) {
      const held = sc.J[id]!, bw = w - h - 12 * s;
      ctx.fillStyle = P.night ? "#2a2545" : "#e8e4f0";
      ctx.fillRect(x + h + 2, y + h * 0.62, bw, 8 * s);
      ctx.fillStyle = show.trickAmount > 0.85 ? P.hot : P.ok;
      ctx.fillRect(x + h + 2, y + h * 0.62, bw * Math.min(1, held / 1.2), 8 * s);
    } else ctx.fillText(Math.abs(turned) > 1 ? `${((Math.abs(turned) / TAU) * 360) | 0}°` : "", x + h + 2, y + h * 0.7);
  }

  engine.add({
    read() {
      if (V[1]) {
        V[1] = 0;
        const next = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;
        if (next !== P) (P = next), buildScene(), (dirty = true);
      }
      if (V[0]) {
        V[0] = 0;
        const sr = stage.getBoundingClientRect(), hr = head.getBoundingClientRect(), cr = getComputedStyle(canvas).position === "absolute" ? canvas.getBoundingClientRect() : sr;
        dio.resize(cr.width || 1, cr.height || 1, Math.min(2, devicePixelRatio || 1));
        sky = null;
        if (Math.abs((cr.width || 1) - V[7]!) > 1) {
          V[7] = cr.width || 1;
          V[3] = Math.max(8, hr.bottom - sr.top + 8);
          V[4] = 10;
          // A phone in landscape: the stick sits over the canvas; the tach sticker goes above it.
          const sk = thePad.el.offsetParent ? thePad.el.querySelector(".bui-stick")?.getBoundingClientRect() : null;
          if (sk && sk.height && sk.top < cr.bottom) V[4] = Math.max(10, cr.bottom - sk.top + 4);
          frameTable();
          if (!view) Object.assign(dio.cam, TABLE);
        }
        hudDirty = dirty = true;
      }
      if (V[6] && !gamepad(GP)) GP.fill(0);
    },
    step(e, dt) {
      if (endAt > 0 && e.time >= endAt) end();
      const drag = PD[0] ? Math.max(40, dio.width * 0.12) : 1;
      I[0] = c.down(GAS) || PD[0] ? 1 : GP[2]! > 0.2 ? GP[2]! : 0;
      I[1] = c.down(BRAKE) || GP[3]! > 0.2 ? 1 : 0;
      I[2] = (+c.down(BACK) - +c.down(FWD)) || (c.stick.active ? c.stick.y : 0) || GP[1]! || (PD[0] ? Math.max(-1, Math.min(1, (PD[4]! - PD[2]!) / drag)) : 0);
      I[3] = (+c.down(RIGHT) - +c.down(LEFT)) || (c.stick.active ? c.stick.x : 0) || GP[0]! || (PD[0] ? Math.max(-1, Math.min(1, (PD[3]! - PD[1]!) / drag)) : 0);
      I[4] = c.down(TRICK) || GP[4]! > 0.5 ? 1 : 0;
      I[5] = resetQ || c.down(RESETK) || GP[6]! > 0.5 ? 1 : 0;
      resetQ = 0;
      if (paused || ended) I.fill(0);
      const ph = show.phase;
      let moving = show.step(dt, I, auto);
      if (ph === RUN) m.tick(me, dt);
      if (endAt > 0) moving = true;
      if (show.n) events(), (moving = true);
      if (stepFx(dt)) moving = true;
      if (stepCam(dt)) moving = true;
      placeSets();
      if (shake > 0) (shake = Math.max(0, shake - dt)), (moving = true);
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true), toastT === 0 && (toastEl.hidden = true);
      if (moving) e.busy(), (dirty = true), (hudDirty = true);
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      vox.set(me.rpm, me.throttle, (show.phase === RUN || show.phase === READY) && !me.crashed && !paused && !ended, me.gear, me.speed);
      if (!dirty) return;
      dirty = false;
      pose();
      const cam = dio.cam, k = shake * shake * 10, sx = Math.sin(engine.time * 71) * k, sy = Math.cos(engine.time * 53) * k * 0.7;
      (cam.ox += sx), (cam.oy += sy);
      dio.draw();
      (cam.ox -= sx), (cam.oy -= sy), (V[5] = 1);
    },
  });

  const MAP: Record<string, string> = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "fwd", KeyW: "fwd", ArrowDown: "back", KeyS: "back", Space: "gas", KeyJ: "gas", KeyK: "brake", ShiftLeft: "brake", ShiftRight: "brake", KeyL: "trick", KeyE: "trick", KeyR: "reset" };
  const wake = () => vox.wake(me.power);
  const src = (e: Event) => (e.composedPath?.()[0] ?? e.target) as Element | null;
  window.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || ctx.attract || paused || src(e)?.closest?.("input,textarea,select")) return;
    if (e.code === "KeyM") return void (e.preventDefault(), toggle());
    if (e.code === "KeyV") return void (e.preventDefault(), setView(view ? 0 : 1));
    const k = MAP[e.code];
    if (!k || src(e)?.closest?.(".bui-pad") || ended) return;
    e.preventDefault();
    auto = false;
    wake();
    if (!e.repeat) c.press(k);
    engine.wake();
  }, sig);
  window.addEventListener("keyup", (e) => {
    const k = MAP[e.code];
    if (k) c.press(k, false);
  }, sig);
  play.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    play.focus({ preventScroll: true });
    if (ended || paused || ctx.attract) return;
    play.setPointerCapture(e.pointerId);
    auto = false;
    wake();
    (PD[0] = 1), (PD[1] = PD[3] = e.offsetX), (PD[2] = PD[4] = e.offsetY), (PD[5] = e.pointerId);
    engine.wake();
  }, sig);
  play.addEventListener("pointermove", (e) => void (e.pointerId === PD[5] && ((PD[3] = e.offsetX), (PD[4] = e.offsetY))), sig);
  const up = (e: PointerEvent) => void (e.pointerId === PD[5] && ((PD[0] = 0), (PD[5] = -1)));
  play.addEventListener("pointerup", up, sig);
  play.addEventListener("pointercancel", up, sig);
  muteK.addEventListener("click", toggle, sig);
  viewK.addEventListener("click", () => setView(view ? 0 : 1), sig);
  keysEl.querySelector(".ba-menu")!.addEventListener("click", () => ctx.menu(), sig);
  menuKeys(keysEl, engine.signal);
  keysEl.querySelector(".ba-reset")!.addEventListener("click", () => ((resetQ = 1), (auto = false), engine.wake()), sig);
  keysEl.querySelector(".ba-theme")?.addEventListener("click", () => ctx.theme?.(), sig);
  thePad.el.addEventListener("pointerdown", () => ((auto = false), wake(), engine.wake()), sig);

  buildScene();
  show.go(ctx.bike.power);
  vox.use(me.power);
  setView(1);
  CTP.set(me.pos);
  target.yaw = me.yaw;
  chase(dio.cam, target, { ...chaseO, snap: true });
  engine.busy(2);
  engine.start();
  if (!ctx.attract) play.focus({ preventScroll: true });
  return {
    engine,
    get auto() {
      return auto;
    },
    set auto(on: boolean) {
      auto = on;
      engine.wake();
    },
    get state() {
      const S = sc.S, ph = show.phase;
      return { phase: ph === READY ? "ready" : ph === RUN ? "run" : ph === DONE ? "done" : "idle", speed: me.speed, walking: me.walking, clock: show.clock, score: S[SC]!, combo: S[CB]!, trick: show.trick, air: me.air, crashes: S[CRASHES]!, jumps: S[JUMPS]!, view: view ? "chase" : "arena", judges: sc.JD[5]!, ended, x: me.pos[0]!, z: me.pos[2]!, far: show.far, jump: show.jump, k: G[0]!, landedOn: show.landedOn, faces: tv.stats.faces, slides: show.strip.stats[0]! };
    },
    get camera() {
      return { dist: view ? dio.cam.dist : chaseO.dist, fov: dio.cam.fov, view: view ? "chase" : "table" };
    },
    finish() {
      if (ended) return;
      if (show.phase !== DONE) show.S[1] = 0, show.S[0] = RUN;
      engine.wake();
    },
    stats,
    pause(on: boolean) {
      if (paused === on || ended) return;
      paused = on;
      PD[0] = 0;
      if (on) rock.release();
      if (on) engine.stop();
      else engine.start();
    },
    destroy: () => engine.destroy(),
  };
}
