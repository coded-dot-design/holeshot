// Endless Wheelie City: an open world of roads, towns and fields that never ends, to wheelie on the
// player's own bike (from Fizlet's Wheelie City gallery piece). Long smooth roads sweep across rolling
// fields (highways every few miles, smaller roads branching off, junctions and roundabouts), towns
// strung along them (shops, a diner, a gas station, flats and a tower round the middle, houses with
// lawns, sprinklers and a dog further out, warehouses on the edge), farmland between (ploughed plots,
// crops, tree rows, fences, hay bales, the odd farmstead), kickers on the crown of the open road. No
// clock: how far from the start. Lift the front with the gas, balance it with your weight (stick or
// W/S), save it with the brake, and score wheelies and manuals, hops and stoppies; past 12 o'clock
// held, the hand drag (×10). A trick across a crosswalk, through a sprinkler or past a neighbour who
// came out to shake a fist pays a bonus. Too loud in town and the heat rises: the neon patrol (bikes,
// a cart, a drone) comes after you, inside that town's limits; caught stopped (or down) is a TICKET;
// ride out of town and you lose them. At night the lanes glow cyan and the windows warm, by day pastel.
// Bricks: the kernel, diorama, terrain (`terrainView`), drive (`chase`), input, pad, sound. The world
// is ./open.ts, the session ./roam.ts (the patrol ./cops.ts, the scorer ./tricks.ts), all headless;
// the ride is ./ride.ts on the shared bike.
import { walkUi } from "../../bike/walk-ui.ts";
import { createEngine, seeded } from "@fzlt/core/kernel";
import { diorama, type DioramaObject, type DioramaPoints } from "@fzlt/core/diorama";
import { terrainView, type TerrainView } from "@fzlt/core/terrain";
import { roadRibbons } from "./ribbons.ts";
import { chase } from "@fzlt/core/drive";
import { controls } from "@fzlt/core/input";
import { rocker } from "../../bike/rocker.ts";
import { pad } from "@fzlt/core/pad";
import { sound } from "@fzlt/core/sound";
import {
  DONE, E_AIR, E_BARK, E_BONUS, E_CRASH, E_END, E_GRUMP, E_HOP, E_RESPAWN, E_RESET, E_STUCK, E_SPLASH, E_START, E_TRICK,
  E_TICKET, E_ESCAPE, E_STARS, E_UNIT, E_CLEAR, E_DRAG, E_BANKED, E_LOST, HAND_T, DRAG_X, LINES, READY, RUN, CRASH, SP_REACH,
} from "./rules.ts";
import { openRun, E_TOWN, NNB, NSPK, S_TOWNS } from "./roam.ts";
import {
  openWindow, CITY_SEED, IS, RC, RB_R, RB_HW, FAR_WIN, FAR_CELL, FAR_STEP, KICK_L, KICK_W, NITEM, I_PROP,
  I_HOUSE, I_HOUSE2, I_SHOP, I_DINER, I_STORE, I_GAS, I_FLATS, I_TOWER, I_WARE, I_BARN, I_SILO, I_TREE, I_PINE, I_ROCK, I_HAY, I_LAMP, I_SIGN, I_MAIL, I_BENCH, I_CAR, I_FENCE, I_CONE, I_ISLE, I_SPRINK, I_DOG, I_CROSS, I_KICK,
} from "./open.ts";
import { HEAT, STARS, HOT, ESC, TIX, NEAR, MAXP, PS, P_ON, P_KIND, P_X, P_Z, P_YAW, P_FADE, U_CART, U_DRONE } from "./cops.ts";
import type { RideSpec } from "./ride.ts";
import { meter } from "../meter.ts";
import { modeStage } from "../race/scene.ts";
import type { ModeCtx, ModeRun } from "../mode.ts";
import { LOOP, ENDO, CASE, BAIL } from "../../bike/bike.ts";
import { rig, type Rig } from "../../bike/rig.ts";
import { pool, voice, gamepad, type Pool } from "../../bike/kit.ts";
import { SC, CB, ON, DIST, TIME, SWEET, PTS, KIND, BEST_W, MANUAL, STOPPIE, F_CROSS, F_SPRINK } from "./tricks.ts";

const TAU = 6.283185307179586;
// Palettes by role: a neon night (dark) and a pastel day (light); each hood has its own ground and buildings over it.
const DARK = {
  night: true, light: [-0.4, 1, 0.5], amb: 0.5,
  sky0: "#06051a", sky1: "#1c0f3e", sky2: "#3b1660", star: "#cfd8ff", moon: "#e9e4ff",
  table: "#0c0b1a", plinth: "#15132a", rim: "#22e6ff", road: "#1a1930", walk: "#2b2848", lawn: "#18373a", drive: "#2f2b4c", curb: "#22e6ff", dash: "#ffd166", zebra: "#d8dcff", bump: "#ffd166", ply: "#8a6a4a",
  walls: ["#3b3466", "#2c3f6a", "#43305e", "#2a4058", "#2b2950", "#33284a"], roofs: ["#1e1a36", "#241c3c", "#1b2340", "#2a1838", "#191830", "#2b1a3a"], trim: "#ff4fa8",
  win: "#ffd27a", win2: "#7cf6ff", door: "#141226", garage: "#272444", ghost: "#7cf6ff", beam: "#d8f6ff", awning: ["#ff4fa8", "#22e6ff"], sign: "#ff4fa8",
  trunk: "#2a2033", leaf: ["#1d5148", "#21604f", "#174039"], pole: "#3a3658", lampOn: "#fff1c2", glow: "#ffcf7a",
  cars: ["#ff4fa8", "#22e6ff", "#ffd166", "#9d7bff"], glass: "#0d1022", tyre: "#0e0e16", hub: "#8d92b4", tail: "#ff2e55", head: "#fff7d6",
  frame: ["#e8ecff", "#ff4fa8", "#ffd166"], accent: "#22e6ff", seat: "#141420", fork: "#9aa0c4",
  jacket: "#22e6ff", pants: "#2a2a3e", shoe: "#f4f1ff", helmet: "#ff4fa8", visor: "#0a0c16", skin: ["#f1c7a5", "#c98e67", "#8d5a3b", "#e8b48f"],
  robes: ["#9d7bff", "#ff8fb8", "#6fd3ff", "#ffd166", "#7ee0a8", "#ff9e6b", "#c0c6ff"], hair: ["#e7e7ef", "#3a2a22", "#8a8a96", "#c06a3a"],
  dog: "#c98e5a", dog2: "#6b4a2e", water: "#8fe8ff", dust: "#8a84b8", spark: "#ffd166", smoke: "#c9c4e8", shadow: "#000000",
  ink: "#0b0a14", paper: "#f6f3ff", good: "#22e6ff", warn: "#ffd166", bad: "#ff4f5e", line: "#22e6ff",
  // The canals, the islands' walls, the humps, the retaining walls, the plaza, the boardwalk, the sand, the sea.
  canal: "#0a2a4a", wave: "#22e6ff", isle: "#1d1a33", hump: "#ff4fa8", deck: "#2b2848", chev: "#ffd166", stone: "#3a3456", stone2: "#2c2844",
  plaza: "#2a2a4a", tile: "#3a3a66", board: "#4a3048", plank: "#5e3c58", sand: "#4a3f5e", sea: "#0b2f55", fountain: "#22e6ff",
  tower: ["#1f2446", "#261c42", "#1a2a44", "#2a1f3e"], neon: ["#ff4fa8", "#22e6ff", "#ffd166", "#9d7bff"], shack: ["#2c4a5e", "#4a2c5e", "#2c5e4e"],
  palm: ["#1f6a52", "#2a7a5a"], pine: ["#173f3a", "#1d4f44"],
  // The patrol: its body, trim and the two lights.
  unit: "#e8ecff", unit2: "#1b1d34", lite: ["#ff3fd0", "#22e6ff"], liteOff: "#2a2440",
  // Per hood: lawn, walk, road.
  hood: [["#18373a", "#2b2848", "#1a1930"], ["#1f3a2c", "#2e2a46", "#1c1a2e"], ["#232046", "#34305a", "#17162a"], ["#1d3a3e", "#2b2848", "#1a1930"]],
  // The rig's parts that are not the ride's own colours (../../bike/rig.ts).
  kit: { seat: "#14121f", frame: "#2b2a3d", tyre: "#0f0f16", rim: "#9aa0c8", metal: "#c9cde6", pipe: "#7e86a8", visor: "#0a0c16", boots: "#e9ecff", gloves: "#14121f", glow: "#22e6ff" },
};
type Pal = typeof DARK;
const LIGHT: Pal = {
  ...DARK, night: false, light: [0.6, 1, 0.45], amb: 0.58,
  sky0: "#bfe6ff", sky1: "#e4f4ff", sky2: "#fff3dc", star: "#ffffff", moon: "#fff6cc",
  table: "#c9a585", plinth: "#8a6448", rim: "#fff3dc", road: "#6b7088", walk: "#dcd6cc", lawn: "#8fd18a", drive: "#c8c0b4", curb: "#f4efe6", dash: "#fff3b0", zebra: "#ffffff", bump: "#ffd166", ply: "#d9a86c",
  walls: ["#ffd6a5", "#bde0fe", "#ffc8dd", "#caffbf", "#e9d8ff", "#ffe5b4"], roofs: ["#e76f51", "#577590", "#b5838d", "#6a994e", "#7d6b9e", "#d1495b"], trim: "#ffffff",
  win: "#e8f6ff", win2: "#d7f3ff", door: "#6d4c41", garage: "#f1ece4", ghost: "#3d5a80", beam: "#fff7c2", awning: ["#ef476f", "#ffffff"], sign: "#ef476f",
  trunk: "#8d6748", leaf: ["#52b788", "#74c69d", "#40916c"], pole: "#7b8094", lampOn: "#fff6cc", glow: "#fff6cc",
  cars: ["#ef476f", "#118ab2", "#ffd166", "#8e7dbe"], glass: "#cfe8ff", tyre: "#26262e", hub: "#d9dbe6", tail: "#e63946", head: "#fffbe6",
  frame: ["#1c2a3c", "#ef476f", "#118ab2"], accent: "#06d6a0", seat: "#26262e", fork: "#4a5468",
  jacket: "#118ab2", pants: "#33334a", shoe: "#ffffff", helmet: "#ef476f", visor: "#11131c",
  dog: "#c98e5a", dog2: "#6b4a2e", water: "#4cc9f0", dust: "#d9d2c3", spark: "#ffb703", smoke: "#ffffff", shadow: "#3a2a24",
  ink: "#1b1420", paper: "#ffffff", good: "#06a77d", warn: "#f4a261", bad: "#e63946", line: "#ffffff",
  canal: "#5fb8e0", wave: "#ffffff", isle: "#b8a58c", hump: "#ef476f", deck: "#d9cfc0", chev: "#ffffff", stone: "#c9b79c", stone2: "#a8957c",
  plaza: "#e6ddd0", tile: "#d2c6b4", board: "#c99a6b", plank: "#b0835a", sand: "#f2dca6", sea: "#4fb3e0", fountain: "#4cc9f0",
  tower: ["#bcd4e6", "#e6d3ea", "#d4e6cf", "#f0e0c8"], neon: ["#ef476f", "#118ab2", "#f4a261", "#8e7dbe"], shack: ["#9ad1d4", "#ffcad4", "#cdeac0"],
  palm: ["#52b788", "#74c69d"], pine: ["#40916c", "#2d6a4f"],
  unit: "#ffffff", unit2: "#2b3a5a", lite: ["#ff3fd0", "#118ab2"], liteOff: "#c8c8d8",
  hood: [["#8fd18a", "#dcd6cc", "#6b7088"], ["#7cc47a", "#d8d0c2", "#6f6f84"], ["#a6b8a0", "#e2dcd2", "#5f6478"], ["#9ad49a", "#e4dccc", "#6b7088"]],
  kit: { seat: "#2a2833", frame: "#3a3a4c", tyre: "#24232b", rim: "#d9dbe6", metal: "#eceef7", pipe: "#9aa0b8", visor: "#1b1d2a", boots: "#ffffff", gloves: "#2a2833", glow: "#06d6a0" },
};
// The open world's own colours over the town's: the meadow by height, the faces' kinds (asphalt,
// sidewalk, lawn, gravel, ploughed dirt, crops, a roundabout's island), the lane paint, the far ring.
const FIELD_DARK = {
  meadow: ["#14302e", "#183a34", "#1d4439", "#22503f"], kindC: ["#1b1a31", "#2b2848", "#18373a", "#3a3352", "#3a2638", "#203a2a", "#1f4a3a"],
  lane: "#22e6ff", laneY: "#ffd166", farGround: "#1d4439", crop: "#2f6a3a", hay: "#c9a05a", barn: ["#8a2c3a", "#5e2c58"], silo: "#9aa0c4", fence: "#7a7096", rock: "#3a3456",
};
const FIELD_LIGHT: typeof FIELD_DARK = {
  meadow: ["#8fcf7e", "#9ad686", "#a7dd90", "#b6e49c"], kindC: ["#6b7088", "#dcd6cc", "#7cc47a", "#cdbf9f", "#b98a5e", "#c8d36a", "#74c69d"],
  lane: "#ffffff", laneY: "#ffd166", farGround: "#9fd38a", crop: "#d8c860", hay: "#e9c46a", barn: ["#c0392b", "#9b2c2c"], silo: "#d9dbe6", fence: "#f4efe6", rock: "#a8957c",
};
type FPal = typeof FIELD_DARK;
// FX pools: dust and tyre smoke, sparks, sprinkler water (per sprinkler DROPS), splashes.
const DUST = 70, SPARK = 40, DROPS = 18, WATER = NSPK * DROPS, SPLASH = 40;
const T_CARD = 1;
/** The haze (units from the bike: what stands up fades from HAZE0, gone at HAZE1; the near ground
 *  goes into the sky's horizon colour over the same band), the far ring's bands beyond it. */
const HAZE0 = 28, HAZE1 = 42;
const BANDS = [42, 60, 60, 86, 86, 120, 120, 170, 170, 260], HAZES = [0.25, 0.34, 0.46, 0.6, 0.72, 0.84];
/** The view's gather: how far round the bike, how far it rides before the pool is placed again, the cap. */
const VR = 46, VMOVE = 5, VCAP = 520;
/** Pool sizes per item kind (what can be on screen at once). */
const POOL = new Int32Array(NITEM);
[[I_HOUSE, 20], [I_HOUSE2, 16], [I_SHOP, 10], [I_DINER, 2], [I_STORE, 5], [I_GAS, 2], [I_FLATS, 7], [I_TOWER, 5], [I_WARE, 4], [I_BARN, 3], [I_SILO, 3], [I_TREE, 44], [I_PINE, 24], [I_ROCK, 14], [I_HAY, 14], [I_LAMP, 40], [I_SIGN, 8], [I_MAIL, 18], [I_BENCH, 10], [I_CAR, 14], [I_FENCE, 28], [I_CONE, 8], [I_ISLE, 3], [I_DOG, 2], [I_KICK, 3]].forEach(([k, v]) => (POOL[k!] = v!));
/** Occlusion: a building in front of the bike fades to GHOST over OCC_T seconds. */
const GHOST = 0.1, OCC_T = 0.15;
/** Within this of a building's footprint the bike is up against it (its radius 0.45 and a margin). */
const TOUCH = 1;
const B_TOP = [0.9, 0.9, 0.15, 0.6, 0.15, 0.9, 0.15, 1.5, 0.25, 1.6, 0.5];

/** Endless Wheelie City: the open world, no clock, how far. */
export function mountCity(ctx: ModeCtx): ModeRun {
  const stage = modeStage(ctx.host, "wc");
  const engine = createEngine({ root: stage, settle: 0.5, seed: ctx.seed });
  const m = meter("endcity");
  const SPEC: RideSpec = { id: ctx.bike.model.id, name: ctx.bike.model.name, kind: ctx.bike.power.name, blurb: "", bars: [3, 3, 3], power: ctx.bike.power, shape: ctx.bike.shape, sweet: ctx.bike.sweet, hop: ctx.bike.hop };
  const L = engine.ledger, sig = { signal: engine.signal };
  let P: Pal = document.documentElement.dataset.theme === "light" ? LIGHT : DARK, F: FPal = P.night ? FIELD_DARK : FIELD_LIGHT;
  const best = ctx.best ?? 0;

  // ---- the page: the canvas, the play surface (pointer + keyboard focus), the stickers, the cards, the pad ----
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "wc-play";
  play.setAttribute("aria-label", "Endless Wheelie City: Space or J for gas, K or Shift to brake, W and S (or up and down) lean forward and back, A and D (or left and right) steer, L hops. V changes the view, M mutes, P or Escape pauses");
  const hud = L.add(document.createElement("div"));
  hud.className = "wc-hud";
  hud.innerHTML = `<div class="wc-head"><p class="wc-top"><b class="wc-chip wc-time"><span>0.00 KM</span></b><b class="wc-chip wc-score"><span>0</span><i>×1</i></b><b class="wc-chip wc-heat" hidden aria-label="Heat"><span></span><i hidden></i></b><b class="wc-chip wc-trick" hidden><span></span></b><b class="wc-chip wc-drag" hidden aria-label="Hand drag"><i class="wc-ring" aria-hidden="true"></i><span></span></b></p><p class="wc-hint"></p></div><p class="wc-toast" hidden></p><div class="wc-ticket" hidden><b>TICKET!</b><p>NEON PATROL · NOISE NOTICE</p><p class="wc-tline"></p></div><p class="wc-live" aria-live="polite"></p><p class="wc-keys"><button type="button" class="wc-key wc-end" aria-label="End the ride and bank it (E)">END</button><button type="button" class="wc-key wc-reset" aria-label="Reset to the last good spot (R)">↺</button><button type="button" class="wc-key wc-view" aria-label="Camera view (V)">VIEW</button><button type="button" class="wc-key wc-mute" aria-label="Mute (M)" aria-pressed="true">♪</button><button type="button" class="wc-key wc-menu" aria-label="Pause (P)">❚❚</button></p>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement;
  const toastEl = hud.children[1] as HTMLElement, ticketEl = hud.children[2] as HTMLElement, live = hud.children[3] as HTMLElement, keysEl = hud.children[4] as HTMLElement;
  const timeEl = top.children[0]!.firstChild as HTMLElement, scoreEl = top.children[1]!.firstChild as HTMLElement, comboEl = top.children[1]!.lastChild as HTMLElement;
  const heatChip = top.children[2] as HTMLElement, heatEl = heatChip.firstChild as HTMLElement, riskEl = heatChip.lastChild as HTMLElement;
  const trickChip = top.children[3] as HTMLElement, trickEl = trickChip.firstChild as HTMLElement;
  const dragChip = top.children[4] as HTMLElement, dragRing = dragChip.firstChild as HTMLElement, dragEl = dragChip.lastChild as HTMLElement;
  const tlineEl = ticketEl.lastChild as HTMLElement;
  const viewK = keysEl.querySelector(".wc-view") as HTMLButtonElement, muteK = keysEl.querySelector(".wc-mute") as HTMLButtonElement;
  const stuckEl = document.createElement("p");
  stuckEl.className = "wc-stuck";
  stuckEl.hidden = true;
  stuckEl.textContent = "STUCK? Hold R / tap ↺ to reset";
  hud.append(stuckEl);
  let resetQ = 0;
  stage.append(canvas, play, hud);
  if (ctx.attract) hud.hidden = true;
  const snd = sound(engine, {
    cues: { start: "ready", trick: "power", hop: "click", crash: "boom", respawn: "ready", grump: "hurt", bark: "bark", splash: "splash", bonus: "click", end: "win", siren: "siren", ticket: "ticket", escape: "win", town: "click" },
    notes: {
      bark: [[520, 300, 0.07, 0, "square", 0.08], [560, 320, 0.07, 0.11, "square", 0.07]],
      splash: [[1800, 700, 0.12, 0, "sine", 0.05]],
      siren: [[620, 940, 0.3, 0, "triangle", 0.045], [940, 620, 0.3, 0.32, "triangle", 0.045]],
      ticket: [[330, 330, 0.08, 0, "square", 0.08], [247, 247, 0.16, 0.1, "square", 0.08]],
    },
    volume: 0.1,
    on: ctx.sound && !ctx.attract,
  });
  const c = controls(engine, { keys: { left: [], right: [], fwd: [], back: [], gas: [], brake: [], hop: [], reset: [] }, target: play });
  const GAS = c.id("gas"), BRAKE = c.id("brake"), HOPK = c.id("hop"), RESETK = c.id("reset");
  const ICON_HOP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 5 12h4v6h6v-6h4z" fill="currentColor"/></svg>';
  const thePad = pad(engine, c, { scheme: "stick", actions: [{ intent: "hop", label: "", icon: ICON_HOP, name: "Hop (L)", key: "L", role: "aim" }], host: stage });
  thePad.el.classList.add("wc-pad");
  const rock = rocker(c, thePad.el, { reduced: ctx.reduced, signal: engine.signal });
  const coarse = matchMedia("(pointer: coarse)"), walkHud = walkUi(hud, () => coarse.matches && !ctx.attract);
  if (ctx.attract) thePad.el.hidden = true;
  const vox = voice();
  vox.on = snd.on;
  engine.signal.addEventListener("abort", () => vox.close(), { once: true });
  const toggle = () => {
    snd.on = !snd.on;
    vox.on = snd.on;
    paintMute();
  };
  const paintMute = () => (muteK.textContent = snd.on ? "♪" : "×", muteK.setAttribute("aria-pressed", "" + snd.on));
  paintMute();

  // ---- the run and the diorama ----
  const run = openRun([SPEC], ctx.seed >>> 0 || 1, CITY_SEED), bike = run.bike, S = run.S, sc = run.sc.S, cop = run.cop, Wd = run.world, t = run.win.t;
  const hgt = (x: number, z: number) => t.height(x, z);
  // The far ring: the same ground on a coarse window (the view's: never the bike's).
  const FR = openWindow(Wd, FAR_WIN, FAR_CELL, FAR_STEP, false);
  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => P.sky2, overlay: drawOverlay, get shadowColor() { return P.shadow; }, maxVerts: 196608, maxFaces: 16384 });
  let tv: TerrainView;
  // The road surfaces: ribbons along the roads' true curves (the ground under them drawn as what lies round them).
  const rib = roadRibbons(Wd, t, dio);
  const rigs: Rig[] = [];
  const nbs: DioramaObject[] = [], arms: DioramaObject[] = [], sprHeads: DioramaObject[] = [];
  const units: DioramaObject[] = [], kinds: DioramaObject[] = [], lites: DioramaObject[] = [];
  let dog: DioramaObject, dogTail: DioramaObject, dust: Pool, spark: Pool, water: DioramaPoints, splash: Pool;
  const rnd = seeded(ctx.seed);
  let sky: CanvasGradient | null = null;
  const STARS_BG = new Float32Array(90);
  for (let i = 0; i < 90; i++) STARS_BG[i] = rnd();
  const BW = new Float64Array(NNB + 1);
  // The pool: per item kind its objects (PO), where each kind's run starts in OBJ, the view's gather (VG).
  const OBJ: DioramaObject[] = [], P0 = new Int32Array(NITEM + 1), VG = new Float64Array(VCAP * IS), VC = new Float64Array(3);
  /** Per pool object: its item record (from VG, copied: x, z, ux, uz, w, d, h, kind, key) while placed. */
  const OI = new Float64Array(2048 * 9), ON_ = new Uint8Array(2048);
  let vn = 0;
  const CROSS = new Float64Array(16 * 5);
  let ncross = 0;

  function buildScene() {
    dio.clear();
    rigs.length = nbs.length = arms.length = sprHeads.length = units.length = kinds.length = lites.length = OBJ.length = 0;
    F = P.night ? FIELD_DARK : FIELD_LIGHT;
    dio.setLight(P.light, P.amb);
    dio.cluster("sky", { fixed: -10 });
    dio.decal("sky", 0, paintSky);
    tv = terrainView(dio, run.win.view, {
      bands: [[0.9, F.meadow[0]!], [2.2, F.meadow[1]!], [3.6, F.meadow[2]!], [99, F.meadow[3]!]], steep: 0.6, steepColor: F.meadow[0]!, kinds: F.kindC,
      light: P.light, ambient: P.amb, lod: [14, 26], shadows: 1, shadowColor: P.shadow, split: "adaptive",
    });
    rib.colors(F.kindC, P.light, P.amb);
    dio.decal("terrain", 0.5, paintRibbons);
    dio.decal("terrain", 1, paintRoads);
    dio.decal("terrain", 1.5, paintPools);
    dio.decal("terrain", 1.8, paintShadow);
    dio.decal("terrain", 2, paintFog);
    dio.decal("terrain", 3, paintFar);
    FOG.g = null;
    HZC.length = CRC.length = 0;
    for (let k = 0; k <= BANDS.length / 2; k++) HZC.push(mix(F.farGround, P.sky2, HAZES[k]!)), CRC.push(mix(F.meadow[3]!, P.sky2, HAZES[k]! * 0.85));
    // The pool, kind by kind (every object hidden until placed).
    for (let k = 0; k < NITEM; k++) {
      P0[k] = OBJ.length;
      for (let q = 0; q < POOL[k]!; q++) OBJ.push(make(k, OBJ.length));
    }
    P0[NITEM] = OBJ.length;
    ON_.fill(0);
    // Sprinkler heads (the live ones), the dog, the neighbours.
    for (let i = 0; i < NSPK; i++) sprHeads.push(dio.add({ shape: "cyl", sides: 6, size: [0.16, 0.14, 0.16], pos: [0, -50, 0], color: P.hub, pick: false, hidden: true }));
    dog = dio.add({ id: "dog", shape: "group", size: [0.6, 0, 0.3], pos: [0, -50, 0], pick: false, hidden: true });
    dio.add({ size: [0.56, 0.26, 0.26], pos: [0, 0.18, 0], on: "dog", color: P.dog, pick: false });
    for (const lx of [-0.2, 0.2]) for (const lz of [-0.09, 0.09]) dio.add({ size: [0.07, 0.2, 0.07], pos: [lx, 0, lz], on: "dog", color: P.dog2, pick: false });
    dio.add({ size: [0.26, 0.24, 0.24], pos: [0.36, 0.3, 0], on: "dog", color: P.dog, pick: false });
    dio.add({ size: [0.12, 0.1, 0.16], pos: [0.52, 0.34, 0], on: "dog", color: P.dog2, pick: false });
    for (const ez of [-0.09, 0.09]) dio.add({ size: [0.06, 0.12, 0.08], pos: [0.32, 0.54, ez], on: "dog", color: P.dog2, pick: false });
    dogTail = dio.add({ size: [0.24, 0.06, 0.06], pos: [-0.36, 0.38, 0], rot: [0, 0, 0.7], on: "dog", color: P.dog2, pick: false });
    for (let i = 0; i < NNB; i++) {
      const id = "nb" + i, look = i % 7;
      const nb = dio.add({ id, shape: "group", size: [0.4, 0, 0.3], pos: [0, -50, 0], alpha: 0, pick: false });
      const pp = (size: number[], pos: number[], color: string, on = id, rot?: number[]) => dio.add({ size, pos, rot, on, color, pick: false });
      pp([0.16, 0.42, 0.26], [0, 0, 0], P.pants);
      pp([0.24, 0.5, 0.36], [0, 0.42, 0], P.robes[look]!);
      pp([0.22, 0.24, 0.22], [0, 0.92, 0], P.skin[look % 4]!);
      if (look % 3 === 0) pp([0.4, 0.04, 0.4], [0, 1.16, 0], P.awning[1]!), pp([0.22, 0.1, 0.22], [0, 1.18, 0], P.awning[1]!);
      else pp([0.24, 0.08, 0.24], [0, 1.16, 0], P.hair[look % 4]!);
      pp([0.04, 0.05, 0.16], [0.11, 1.04, 0], P.ink);
      const arm = dio.add({ id: id + "a", shape: "group", size: [0.1, 0, 0.1], pos: [0, 0.86, 0.2], on: id, pick: false });
      pp([0.09, 0.42, 0.09], [0, 0, 0], P.robes[look]!, id + "a");
      pp([0.13, 0.13, 0.13], [0, 0.42, 0], P.skin[look % 4]!, id + "a");
      pp([0.09, 0.36, 0.09], [0.0, 0.48, -0.2], P.robes[look]!, id, [0, 0, 0]);
      nbs.push(nb);
      arms.push(arm);
    }
    patrols();
    rigs.push(rig(dio, "bike0", { ...P.kit, ...ctx.look }, ctx.bike.rig, ctx.helmet));
    dust = pool(dio, DUST, P.smoke, 4);
    spark = pool(dio, SPARK, P.spark, 6);
    water = dio.points({ cap: WATER, color: P.water, layer: 6 });
    splash = pool(dio, SPLASH, P.water, 6);
    sky = null;
    VC[2] = 0;
    stream();
    fade(bike.b.pos[0]!, bike.b.pos[2]!);
    pose();
  }
  /** One pool object of item kind k (hidden; `place` puts it down). Fronts face local +z (the road). */
  function make(k: number, n: number): DioramaObject {
    const id = "o" + n, hide = { pos: [0, -50, 0], pick: false, hidden: true, alpha: 0 };
    const part = (size: number[], pos: number[], color: string, emissive = false, o2: { shape?: "box" | "wedge" | "cyl"; rot?: number[]; sides?: number; top?: number; layer?: number } = {}) =>
      dio.add({ shape: o2.shape ?? "box", size, pos, rot: o2.rot, sides: o2.sides, top: o2.top, on: id, color, emissive, pick: false, layer: o2.layer ?? 6 });
    if (k < I_PROP) {
      const w = BWv(k), d = BDv(k), ht = BHv(k), fz = d / 2 + 0.01, look = n % 6;
      const wall = k === I_TOWER ? P.tower[n % 4]! : k === I_BARN ? F.barn[n & 1]! : k === I_SILO ? F.silo : k === I_WARE ? P.stone2 : P.walls[look]!, roof = P.roofs[look]!;
      const o = dio.add({ id, size: k === I_SILO ? [w, ht, d] : [w, ht, d], shape: k === I_SILO ? "cyl" : "box", sides: 10, color: wall, ...hide });
      if (k === I_SILO) return part([w * 1.02, 0.6, d * 1.02], [0, 0, 0], F.silo, false, { shape: "cyl", sides: 10, top: 0.2 }), o;
      if (k === I_HOUSE || k === I_HOUSE2 || k === I_BARN) {
        for (const s2 of [-1, 1]) dio.add({ shape: "wedge", size: [d / 2 + 0.25, k === I_BARN ? 1.4 : 0.85, w + 0.3], pos: [0, 0, s2 * (d / 4 + 0.06)], rot: [0, s2 < 0 ? Math.PI / 2 : -Math.PI / 2, 0], on: id, color: k === I_BARN ? P.paper : roof, pick: false, layer: 5 });
        if (k === I_BARN) part([1.6, 1.8, 0.04], [0, -ht, fz], P.paper), part([1.3, 1.5, 0.05], [0, -ht, fz + 0.01], F.barn[(n + 1) & 1]!);
        else {
          part([0.56, 1.0, 0.04], [-0.5, -ht, fz], P.door);
          part([0.7, 0.5, 0.04], [0.8, -ht + 0.85, fz], P.win, P.night);
          part([0.5, 0.42, 0.04], [-0.5, -ht + 1.3, fz], P.win2, P.night);
          part([w + 0.02, 0.06, 0.04], [0, -0.06, fz], P.trim, P.night);
        }
      } else if (k === I_FLATS) {
        part([w + 0.2, 0.14, d + 0.2], [0, 0, 0], P.roofs[4]!);
        for (let fl = 0; fl < 3; fl++) for (let q = 0; q < 4; q++) part([0.55, 0.6, 0.04], [-1.5 + q, -ht + 0.9 + fl * 1.15, fz], (fl + q) % 3 ? P.win : P.win2, P.night && (fl + q) % 4 !== 1);
        part([0.8, 0.8, 0.04], [0, -ht, fz], P.door);
      } else if (k === I_TOWER) {
        const neon = P.neon[n % 4]!;
        for (let fl = 0.7; fl < ht - 0.6; fl += 1.05) part([w - 0.6, 0.34, 0.04], [0, -ht + fl, fz], ((fl * 3) | 0) % 3 ? P.win : P.win2, P.night);
        part([0.14, ht * 0.7, 0.14], [w / 2 - 0.1, -ht * 0.85, fz + 0.06], neon, true);
        part([w + 0.12, 0.16, d + 0.12], [0, 0, 0], P.roofs[4]!);
        part([0.08, 1.2, 0.08], [-w / 4, 0.16, 0], P.pole, false, { shape: "cyl", sides: 5 });
        part([0.18, 0.18, 0.18], [-w / 4, 1.3, 0], neon, true);
        part([0.9, 0.7, 0.04], [0, -ht, fz], P.door);
      } else if (k === I_GAS) {
        // A gas station: the kiosk, a canopy on posts out front over two pumps, a sign.
        part([w + 0.1, 0.1, d + 0.1], [0, 0, 0], P.roofs[5]!);
        part([w - 1.2, 0.8, 0.04], [-0.3, -ht + 0.3, fz], P.win, P.night);
        part([0.6, 1.0, 0.04], [w / 2 - 0.6, -ht, fz], P.door);
        for (const px of [-1.6, 1.6]) part([0.14, 2.6, 0.14], [px, -ht, d / 2 + 3.2], P.pole);
        part([4.4, 0.24, 2.8], [0, -ht + 2.6, d / 2 + 2.4], P.awning[0]!, P.night);
        for (const px of [-0.9, 0.9]) part([0.4, 0.9, 0.3], [px, -ht, d / 2 + 2.4], P.paper), part([0.3, 0.2, 0.04], [px, -ht + 0.6, d / 2 + 2.56], P.neon[1]!, true);
        part([0.16, 3.4, 0.16], [-w / 2 - 0.4, -ht, d / 2 + 0.6], P.pole);
        part([1.2, 0.8, 0.12], [-w / 2 - 0.4, -ht + 3.4, d / 2 + 0.6], P.sign, true);
      } else if (k === I_WARE) {
        part([w + 0.1, 0.12, d + 0.1], [0, 0, 0], P.roofs[1]!);
        for (let q = 0; q < 3; q++) part([1.8, 2.0, 0.04], [-w / 2 + 1.6 + q * 2.6, -ht, fz], P.garage);
        part([w - 0.4, 0.1, 0.04], [0, -0.4, fz], P.trim, P.night);
      } else {
        // A shop, the store, the diner: a flat roof, a big window, a door, an awning, a neon strip.
        part([w + 0.14, 0.1, d + 0.14], [0, 0, 0], P.roofs[(n % 3) + 1]!);
        part([w - 1.4, 0.9, 0.04], [-0.4, -ht + 0.3, fz], P.win, P.night);
        part([0.6, 1.05, 0.04], [w / 2 - 0.5, -ht, fz], P.door);
        for (let q = 0; q < 5; q++) dio.add({ size: [w / 5, 0.05, 0.6], pos: [-w / 2 + (q + 0.5) * (w / 5), -ht + 1.4, d / 2 + 0.28], rot: [-0.35, 0, 0], color: P.awning[(q + n) & 1]!, on: id, pick: false, layer: 7 });
        part([w - 0.6, 0.28, 0.05], [0, -0.34, fz + 0.02], k === I_DINER ? P.neon[0]! : k === I_STORE ? P.sign : P.neon[n % 4]!, true);
        if (k === I_DINER) part([w + 0.3, 0.16, 0.2], [0, -ht + 2.0, fz + 0.05], P.neon[1]!, true);
      }
      return o;
    }
    switch (k) {
      case I_TREE: {
        const o = dio.add({ id, shape: "cyl", sides: 6, size: [0.24, 0.8, 0.24], color: P.trunk, ...hide });
        part([1.7, 1.6, 1.7], [0, -0.05, 0], P.leaf[n % 3]!, false, { shape: "cyl", sides: 7, top: 0 });
        part([1.2, 1.2, 1.2], [0, -0.7, 0], P.leaf[(n + 1) % 3]!, false, { shape: "cyl", sides: 7, top: 0 });
        return o;
      }
      case I_PINE: {
        const o = dio.add({ id, shape: "cyl", sides: 6, size: [0.2, 0.5, 0.2], color: P.trunk, ...hide });
        for (let q = 0; q < 3; q++) part([1.5 - q * 0.38, 1.0, 1.5 - q * 0.38], [0, -0.1 + q * 0.6, 0], P.pine[q & 1]!, false, { shape: "cyl", sides: 7, top: 0 });
        return o;
      }
      case I_ROCK: return dio.add({ id, shape: "cyl", sides: 5, top: 0.5, size: [1.1, 0.6, 0.9], color: F.rock, ...hide });
      case I_HAY: return dio.add({ id, shape: "cyl", sides: 10, size: [1.1, 1.1, 0.9], rot: [Math.PI / 2, 0, 0], color: F.hay, ...hide });
      case I_LAMP: {
        const o = dio.add({ id, shape: "cyl", sides: 6, size: [0.12, 2.8, 0.12], color: P.pole, ...hide });
        part([0.7, 0.08, 0.1], [0, -0.1, 0.3], P.pole);
        part([0.36, 0.14, 0.36], [0, -0.16, 0.6], P.lampOn, true);
        return o;
      }
      case I_SIGN: {
        const o = dio.add({ id, size: [0.12, 1.6, 0.12], color: P.pole, ...hide });
        part([1.6, 0.8, 0.08], [0, 0, 0], P.good, P.night);
        part([1.3, 0.12, 0.09], [0, -0.45, 0], P.paper);
        return o;
      }
      case I_MAIL: {
        const o = dio.add({ id, size: [0.08, 0.8, 0.08], color: P.pole, ...hide });
        part([0.26, 0.24, 0.42], [0, 0, 0], P.cars[n % 4]!);
        return o;
      }
      case I_BENCH: {
        const o = dio.add({ id, size: [1.2, 0.3, 0.4], color: P.trunk, ...hide });
        part([1.2, 0.4, 0.06], [0, 0, -0.18], P.trunk);
        return o;
      }
      case I_CAR: {
        const o = dio.add({ id, shape: "group", size: [2.3, 0, 1.1], ...hide });
        const col = P.cars[n % 4]!;
        part([2.3, 0.42, 1.1], [0, 0.16, 0], col);
        part([1.15, 0.36, 0.95], [-0.15, 0.58, 0], col);
        part([1.17, 0.24, 0.97], [-0.15, 0.64, 0], P.glass);
        for (const wx of [-0.72, 0.72]) for (const wz of [-0.48, 0.48]) part([0.4, 0.16, 0.4], [wx, 0.2, wz], P.tyre, false, { shape: "cyl", sides: 10, rot: [Math.PI / 2, 0, 0] });
        for (const wz of [-0.35, 0.35]) part([0.04, 0.1, 0.2], [1.15, 0.42, wz], P.head, true), part([0.04, 0.1, 0.2], [-1.15, 0.42, wz], P.tail, true);
        return o;
      }
      case I_FENCE: {
        const o = dio.add({ id, shape: "group", size: [8.6, 0, 0.1], ...hide });
        for (let q = 0; q < 5; q++) part([0.1, 0.6, 0.1], [-4.2 + q * 2.1, 0, 0], F.fence);
        part([8.6, 0.07, 0.06], [0, 0.42, 0], F.fence);
        part([8.6, 0.07, 0.06], [0, 0.2, 0], F.fence);
        return o;
      }
      case I_CONE: {
        const o = dio.add({ id, shape: "cyl", sides: 6, top: 0, size: [0.34, 0.55, 0.34], color: P.warn, ...hide });
        part([0.26, 0.08, 0.26], [0, -0.3, 0], P.paper);
        return o;
      }
      case I_ISLE: {
        // A roundabout's island: a curb ring, a lawn, a tree and a neon post.
        const o = dio.add({ id, shape: "cyl", sides: 18, size: [1, 0.16, 1], color: P.curb, emissive: P.night, ...hide });
        part([0.94, 0.03, 0.94], [0, 0, 0], F.kindC[6]!, false, { shape: "cyl", sides: 18 });
        part([0.08, 0.3, 0.08], [0, 0, 0], P.trunk, false, { shape: "cyl", sides: 6 });
        part([0.3, 0.3, 0.3], [0, 0.3, 0], P.leaf[0]!, false, { shape: "cyl", sides: 7, top: 0 });
        return o;
      }
      case I_DOG: {
        // The dog's yard: a picket fence on three sides (the house is the fourth).
        const o = dio.add({ id, shape: "group", size: [2.8, 0, 2.2], ...hide });
        part([2.8, 0.5, 0.06], [0, 0, 1.1], P.paper);
        for (const sx of [-1.4, 1.4]) part([0.06, 0.5, 2.2], [sx, 0, 0], P.paper);
        return o;
      }
      case I_KICK: {
        const o = dio.add({ id, shape: "group", size: [KICK_L, 0, KICK_W * 2], ...hide });
        part([KICK_W * 2, 0.06, 0.14], [KICK_L / 2 - 0.05, 0.74, 0], P.chev, true);
        part([KICK_W * 2, 0.04, 0.1], [-KICK_L / 2 + 0.6, 0.18, 0], P.chev, true);
        return o;
      }
      default: return dio.add({ id, size: [0.1, 0.1, 0.1], color: P.pole, ...hide });
    }
  }
  const BWv = (k: number) => [3.4, 4.2, 5, 6.4, 6, 4.4, 5.2, 4.4, 8.5, 5.6, 2.2][k]!, BDv = (k: number) => [3, 3.4, 3.6, 4.2, 4.4, 3.4, 3.8, 4.4, 6.5, 4.4, 2.2][k]!, BHv = (k: number) => [1.9, 2.3, 2.2, 2.1, 2.5, 2.4, 3.9, 8.5, 3.4, 3, 5.2][k]!;
  const UC = new Int32Array(NITEM);
  /** Place the pool on what is round (x, z) (when the bike has gone VMOVE since the last time). */
  function stream() {
    const x = bike.b.pos[0]!, z = bike.b.pos[2]!, dx = x - VC[0]!, dz = z - VC[1]!;
    if (VC[2] === 1 && dx * dx + dz * dz < VMOVE * VMOVE) return false;
    VC[0] = x; VC[1] = z; VC[2] = 1;
    vn = Wd.gather(x, z, VR, VG, VCAP);
    UC.fill(0);
    ncross = 0;
    for (let q = 0; q < vn; q++) {
      const o = q * IS, k = VG[o]!;
      if (k === I_CROSS) {
        if (ncross < 16) for (let a = 0; a < 5; a++) CROSS[ncross * 5 + a] = VG[o + 1 + a]!;
        if (ncross < 16) ncross++;
        continue;
      }
      if (k === I_SPRINK || UC[k]! >= POOL[k]!) continue;
      const i = P0[k]! + UC[k]!;
      UC[k] = UC[k]! + 1;
      const ob = OBJ[i]!, ux = VG[o + 3]!, uz = VG[o + 4]!;
      ob.pos[0] = VG[o + 1]!; ob.pos[1] = VG[o + 10]! - (k < I_PROP ? 0.3 : 0.05); ob.pos[2] = VG[o + 2]!;
      ob.rot[1] = Math.atan2(-uz, ux);
      if (k < I_PROP && k !== I_SILO) ob.size[1] = BHv(k) + 0.3;
      if (k === I_ISLE) (ob.size[0] = ob.size[2] = VG[o + 5]! * 2), (ob.pos[1] = VG[o + 10]!);
      if (k === I_KICK) ob.pos[1] = VG[o + 10]!;
      ob.hidden = false;
      const r = i * 9;
      // A slot that takes another item starts it unghosted (the fade is that item's own).
      if (!ON_[i] || OI[r + 8] !== VG[o + 9] || OI[r + 7] !== k) GH[i] = 0;
      ON_[i] = 1;
      OI[r] = VG[o + 1]!; OI[r + 1] = VG[o + 2]!; OI[r + 2] = ux; OI[r + 3] = uz; OI[r + 4] = VG[o + 5]!; OI[r + 5] = VG[o + 6]!; OI[r + 6] = VG[o + 7]!; OI[r + 7] = k; OI[r + 8] = VG[o + 9]!;
    }
    for (let k = 0; k < NITEM; k++) for (let q = UC[k]!; q < POOL[k]!; q++) {
      const i = P0[k]! + q;
      // Let go: diorama's `hidden` hides only the object itself, never its parts (a canopy, a roof,
      // windows), so alpha 0 takes the whole of it out (alpha multiplies down), and it goes back
      // to the hide spot: nothing of it is left standing where it was.
      if (ON_[i]) (ON_[i] = 0), (OBJ[i]!.hidden = true), (OBJ[i]!.alpha = 0), (OBJ[i]!.pos[0] = 0), (OBJ[i]!.pos[1] = -50), (OBJ[i]!.pos[2] = 0), (GH[i] = 0);
    }
    return true;
  }
  /** What stands up fades out into the haze (HAZE0 .. HAZE1 from the bike); towers and signs carry further. */
  function fade(x: number, z: number) {
    for (let i = 0; i < OBJ.length; i++) {
      if (!ON_[i]) continue;
      const o = OBJ[i]!, dx = o.pos[0]! - x, dz = o.pos[2]! - z, dd = Math.sqrt(dx * dx + dz * dz), k = OI[i * 9 + 7]!, far = k === I_TOWER || k === I_SILO ? 10 : k === I_ISLE || k === I_KICK ? 4 : 0;
      o.alpha = dd < HAZE0 + far ? 1 : dd > HAZE1 + far ? 0 : 1 - (dd - HAZE0 - far) / (HAZE1 - HAZE0);
    }
  }
  function patrols() {
    for (let i = 0; i < MAXP; i++) {
      const id = "pu" + i;
      units.push(dio.add({ id, shape: "group", size: [1, 0, 0.5], pos: [0, 0, 0], alpha: 0, pick: false }));
      for (let kd = 0; kd < 3; kd++) {
        const kid = `${id}k${kd}`;
        kinds.push(dio.add({ id: kid, shape: "group", size: [1, 0, 0.5], pos: [0, 0, 0], on: id, alpha: 0, pick: false }));
        const p = (size: number[], pos: number[], color: string, o2: { shape?: "box" | "cyl" | "wedge"; rot?: number[]; emissive?: boolean; sides?: number } = {}) => dio.add({ shape: o2.shape || "box", size, pos, rot: o2.rot, sides: o2.sides, on: kid, color, emissive: o2.emissive, pick: false });
        let lh = 0;
        if (kd === 0) {
          for (const wx of [-0.55, 0.55]) p([0.56, 0.14, 0.56], [wx, 0.0, 0], P.tyre, { shape: "cyl", sides: 10, rot: [Math.PI / 2, 0, 0] });
          p([1.1, 0.34, 0.32], [0, 0.26, 0], P.unit); p([1.12, 0.08, 0.34], [0, 0.42, 0], P.unit2);
          p([0.3, 0.5, 0.36], [-0.12, 0.6, 0], P.unit2); p([0.3, 0.28, 0.3], [-0.08, 1.1, 0], P.unit);
          lh = 1.2;
        } else if (kd === U_CART) {
          for (const wx of [-0.6, 0.6]) for (const wz of [-0.42, 0.42]) p([0.34, 0.14, 0.34], [wx, 0.0, wz], P.tyre, { shape: "cyl", sides: 10, rot: [Math.PI / 2, 0, 0] });
          p([1.6, 0.4, 0.9], [0, 0.14, 0], P.unit); p([1.62, 0.1, 0.92], [0, 0.34, 0], P.unit2);
          for (const wx of [-0.7, 0.55]) for (const wz of [-0.4, 0.4]) p([0.06, 0.7, 0.06], [wx, 0.54, wz], P.pole);
          p([1.6, 0.06, 1.0], [-0.08, 1.24, 0], P.unit);
          lh = 1.3;
        } else {
          p([0.7, 0.18, 0.7], [0, 0, 0], P.unit); p([0.72, 0.05, 0.72], [0, 0.18, 0], P.unit2);
          for (const rx of [-0.5, 0.5]) for (const rz of [-0.5, 0.5]) p([0.5, 0.03, 0.5], [rx, 0.14, rz], P.pole, { shape: "cyl", sides: 8 });
          p([1.0, 0.04, 1.0], [0, 0.09, 0], P.neon[1]!, { shape: "cyl", sides: 8, emissive: true });
          p([0.12, 0.1, 0.3], [0.38, 0.02, 0], P.neon[0]!, { emissive: true });
          lh = -0.1;
        }
        for (const s of [-1, 1]) lites.push(p([0.26, 0.12, 0.22], [kd === 2 ? 0 : -0.15, lh, s * 0.16], P.lite[(s + 1) >> 1]!, { emissive: true }));
      }
    }
  }
  // ---- occlusion: a building between the chase camera and the bike is ghosted ----
  // Each step, rays from the camera's eye to five points on the rider's silhouette are tested against
  // the boxes of the buildings placed (a box-vs-box broadphase first). A building a ray passes through
  // fades to GHOST (and is outlined); one the eye is inside, or nearly touching, fades out completely.
  // Fades take OCC_T seconds (reduced motion: at once). Render only; no allocation (fixed arrays).
  const GH = new Float64Array(2048);
  const OP = new Float64Array(18), BOX = new Float64Array(6), PJ = new Float64Array(3), OCN = new Float64Array(16);
  /** Pool object i's box (world, as placed: the turned footprint's bounds): x0, y0, z0, x1, y1, z1. */
  function boxOf(i: number, m: number) {
    const r = i * 9, k = OI[r + 7]!, ux = OI[r + 2]! < 0 ? -OI[r + 2]! : OI[r + 2]!, uz = OI[r + 3]! < 0 ? -OI[r + 3]! : OI[r + 3]!, a = OI[r + 4]! / 2 + 0.3, b = OI[r + 5]! / 2 + 0.3 + (k === I_GAS ? 0 : 0);
    const hx = ux * a + uz * b, hz = uz * a + ux * b, o = OBJ[i]!;
    BOX[0] = o.pos[0]! - hx - m; BOX[3] = o.pos[0]! + hx + m;
    BOX[2] = o.pos[2]! - hz - m; BOX[5] = o.pos[2]! + hz + m;
    BOX[1] = o.pos[1]! + 0.3 - m; BOX[4] = o.pos[1]! + 0.3 + OI[r + 6]! + B_TOP[k]! + m;
  }
  function crosses(i: number) {
    let t0 = 0, t1 = 1;
    for (let a = 0; a < 3; a++) {
      const p = OP[a]!, dd = OP[i * 3 + a]! - p, lo = BOX[a]!, hi = BOX[a + 3]!;
      if (Math.abs(dd) < 1e-9) { if (p < lo || p > hi) return false; continue; }
      let u = (lo - p) / dd, v = (hi - p) / dd;
      if (u > v) { const q = u; u = v; v = q; }
      if (u > t0) t0 = u;
      if (v < t1) t1 = v;
      if (t0 > t1) return false;
    }
    return true;
  }
  /** Is (x, z) within reach of pool object i's footprint (the bike's radius and a little)? */
  function touching(i: number, x: number, z: number) {
    const r = i * 9, ux = OI[r + 2]!, uz = OI[r + 3]!, dx = x - OI[r]!, dz = z - OI[r + 1]!, lx = dx * ux + dz * uz, lz = -dx * uz + dz * ux, a = OI[r + 4]! / 2 + TOUCH, b = OI[r + 5]! / 2 + TOUCH;
    return lx > -a && lx < a && lz > -b && lz < b;
  }
  let XR = 0, BARE = 0;
  function occlude(dt: number) {
    const cm = dio.cam, d = bike.b, cp = Math.cos(cm.pitch), sp = Math.sin(cm.pitch), cy = Math.cos(cm.yaw), sy = Math.sin(cm.yaw);
    OP[0] = cm.tx + cm.dist * sy * cp; OP[1] = cm.ty + cm.dist * sp; OP[2] = cm.tz + cm.dist * cy * cp;
    const gy = hgt(d.pos[0]!, d.pos[2]!), bx = d.pos[0]!, by = Math.max(gy, d.pos[1]!), bz = d.pos[2]!, rx = cy * 0.95, rz = -sy * 0.95;
    OP[3] = bx; OP[4] = by + 0.35; OP[5] = bz;
    OP[6] = bx; OP[7] = by + 1.65; OP[8] = bz;
    OP[9] = bx + rx; OP[10] = by + 0.8; OP[11] = bz + rz;
    OP[12] = bx - rx; OP[13] = by + 0.8; OP[14] = bz - rz;
    OP[15] = bx; OP[16] = by + 1.0; OP[17] = bz;
    let x0 = OP[0]!, x1 = x0, z0 = OP[2]!, z1 = z0;
    for (let i = 1; i < 6; i++) (x0 = Math.min(x0, OP[i * 3]!)), (x1 = Math.max(x1, OP[i * 3]!)), (z0 = Math.min(z0, OP[i * 3 + 2]!)), (z1 = Math.max(z1, OP[i * 3 + 2]!));
    const k = ctx.reduced ? 2 : dt / OCC_T;
    let busy = false;
    const n = P0[I_PROP]!;
    for (let i = 0; i < n; i++) {
      const o = OBJ[i]!;
      if (!ON_[i]) continue;
      let tt = 0;
      if (view) {
        boxOf(i, 0);
        if (BOX[3]! >= x0 && BOX[0]! <= x1 && BOX[5]! >= z0 && BOX[2]! <= z1) {
          for (let q = 1; q < 6 && !tt; q++) if (crosses(q)) tt = 1;
          if (tt) {
            boxOf(i, 1.2);
            if (OP[0]! > BOX[0]! && OP[0]! < BOX[3]! && OP[1]! > BOX[1]! && OP[1]! < BOX[4]! && OP[2]! > BOX[2]! && OP[2]! < BOX[5]!) tt = 2;
          }
        }
      }
      // The bike up against it (it can hit it): never gone, at most ghosted and outlined, so what
      // stops the bike is always seen (the eye inside it would have it vanish: stuck on nothing).
      if (tt === 2 && touching(i, bx, bz)) tt = 1;
      if (XR === 2) o.alpha = 0;
      const g = GH[i]!;
      if (g !== tt) {
        GH[i] = g < tt ? Math.min(tt, g + k) : Math.max(tt, g - k);
        busy = true;
      }
      const gh = GH[i]!;
      if (gh > 0 && view) {
        const f = gh <= 1 ? 1 - gh * (1 - GHOST) : GHOST * (2 - gh);
        o.alpha *= XR === 1 ? 1 : f;
      }
    }
    if (busy) dirty = true;
    return busy;
  }
  function paintBeams(c2: CanvasRenderingContext2D) {
    if (cop.S[STARS]! < 3 || S[0] !== RUN) return;
    const Pt = cop.P, b = bike.b.pos;
    c2.fillStyle = P.beam;
    for (let i = 0; i < MAXP; i++) {
      const o = i * PS, u = units[i]!;
      if (Pt[o + P_ON] !== 1 || Pt[o + P_KIND] !== U_DRONE || u.alpha < 0.5) continue;
      if (!dio.project(u.pos[0]!, u.pos[1]! - 0.1, u.pos[2]!, PJ)) continue;
      const sx = PJ[0]!, sy = PJ[1]!;
      const ax = b[0]! * 0.8 + u.pos[0]! * 0.2, az = b[2]! * 0.8 + u.pos[2]! * 0.2, gy = hgt(ax, az);
      let ok = 0;
      for (let q = 0; q < 4; q++) {
        const a = (q * Math.PI) / 2 + engine.time * 0.6;
        if (dio.project(ax + Math.cos(a) * 1.5, gy + 0.02, az + Math.sin(a) * 1.5, PJ)) (OCN[q * 2] = PJ[0]!), (OCN[q * 2 + 1] = PJ[1]!), ok++;
      }
      if (ok < 4) continue;
      c2.globalAlpha = 0.16 + 0.05 * Math.sin(engine.time * 9 + i);
      c2.beginPath();
      c2.moveTo(sx, sy);
      for (let q = 0; q < 4; q++) c2.lineTo(OCN[q * 2]!, OCN[q * 2 + 1]!);
      c2.closePath();
      c2.fill();
    }
    c2.globalAlpha = 1;
  }
  function paintGhosts(c2: CanvasRenderingContext2D) {
    const n = P0[I_PROP]!;
    for (let i = 0; i < n; i++) {
      const g = GH[i]!;
      if (g < 0.02 || !ON_[i]) continue;
      boxOf(i, -0.45);
      let ok = 0;
      for (let q = 0; q < 8; q++) {
        if (dio.project(q & 1 ? BOX[3]! : BOX[0]!, q & 2 ? BOX[4]! : BOX[1]!, q & 4 ? BOX[5]! : BOX[2]!, PJ)) (OCN[q * 2] = PJ[0]!), (OCN[q * 2 + 1] = PJ[1]!), (ok |= 1 << q);
      }
      c2.globalAlpha = (g <= 1 ? g : 2 - g) * 0.7;
      c2.strokeStyle = P.ghost;
      c2.lineWidth = 1.5;
      c2.beginPath();
      for (let q = 0; q < 8; q++) for (let a = 1; a < 8; a <<= 1) {
        const r = q | a;
        if (r === q || !(ok & (1 << q)) || !(ok & (1 << r))) continue;
        c2.moveTo(OCN[q * 2]!, OCN[q * 2 + 1]!);
        c2.lineTo(OCN[r * 2]!, OCN[r * 2 + 1]!);
      }
      c2.stroke();
    }
    c2.globalAlpha = 1;
  }
  // ---- state ----
  const I = new Float64Array(5), tmp = new Float64Array(3), tmp2 = new Float64Array(3);
  const V = new Float64Array(8);
  V[0] = V[1] = 1;
  let view = 1, auto = !!ctx.auto || !!ctx.attract, dirty = true, hudDirty = true, shake = 0, toastT = 0, ticketT = 0, sirenT = 0, emitK = 0, crashT = 0, barkT = 0, crashes = 0, spin = 0, paused = false, ended = false;
  const TT = new Float64Array(4), TF = new Uint8Array(4);
  const was = new Float64Array(10).fill(-1);
  const DRAGA = new Float64Array(1);
  const stars = (x: number, y: number, z: number) => spark.ring(rnd, x, y, z, 18, 2.5, 6, 1.1, 0.09, 1);
  /** The map view: high over the bike, the world all round. */
  const TABLE = { yaw: 0, pitch: 1.05, dist: 70, tx: 0, ty: 0, tz: 0, ox: 0, oy: 0, fov: 0.62 };
  const chaseO = { dist: 10.5, pitch: 0.36, lift: 0.8, ahead: 0.35, side: 0.8, rate: 3.4, turn: 2.4, snap: !!ctx.reduced };
  const CTP = new Float64Array(3), target = { pos: CTP, yaw: 0, vel: bike.vel };
  let rzT: ReturnType<typeof setTimeout> | 0 = 0;
  const ro = new ResizeObserver(() => {
    if (rzT) clearTimeout(rzT);
    rzT = setTimeout(() => ((rzT = 0), (V[0] = 1), engine.wake()), V[5] ? 150 : 0);
  });
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect(), rzT && clearTimeout(rzT)), { once: true });
  addEventListener("gamepadconnected", () => ((V[6] = 1), engine.wake()), sig);
  function later(sec: number, what: number) {
    for (let k = 0; k < 4; k++) if (!TF[k]) return void ((TT[k] = engine.time + sec), (TF[k] = what), engine.busy(sec + 0.05));
  }

  function pose() {
    const d = bike.b;
    rigs[0]!.T[8] = DRAGA[0]!;
    rigs[0]!.pose(d, ctx.bike.cls === "ebike" ? 0.3 : 0.7);
    walkHud.update(d);
    const SG = run.SG;
    // The dog: along its yard's front fence; a hop when it barks.
    const dq = run.DI[0]!;
    dog.hidden = dq < 0;
    if (dq >= 0) {
      const o = dq * IS, ux = SG[o + 3]!, uz = SG[o + 4]!, fd = SG[o + 6]! / 2 - 0.2, lx = run.DG[1]!;
      dog.pos[0] = SG[o + 1]! + ux * lx - uz * fd; dog.pos[2] = SG[o + 2]! + uz * lx + ux * fd;
      dog.pos[1] = SG[o + 10]! + (run.DG[2]! > 0 ? Math.abs(Math.sin(run.DG[2]! * 10)) * 0.12 : 0);
      const fx = d.pos[0]! - dog.pos[0]!, fz = d.pos[2]! - dog.pos[2]!;
      dog.rot[1] = fx * ux + fz * uz > 0.3 ? Math.atan2(-uz, ux) : fx * ux + fz * uz < -0.3 ? Math.atan2(uz, -ux) : dog.rot[1]!;
      dogTail.rot[2] = 0.7 + Math.sin(engine.time * 16) * (S[0] === RUN ? 0.4 : 0);
    }
    // Neighbours: out of the door, a fist shaken, back in.
    for (let i = 0; i < NNB; i++) {
      const tt = run.NB[i * 4 + 1]!, nb = nbs[i]!, q = run.NI[i]!;
      nb.alpha = tt > 0 && q >= 0 ? 1 : 0;
      if (tt <= 0 || q < 0) continue;
      const o = q * IS, ux = SG[o + 3]!, uz = SG[o + 4]!, dd = SG[o + 6]! / 2, out = tt > 2.25 ? (2.6 - tt) / 0.35 : tt < 0.35 ? tt / 0.35 : 1, f = dd + out * 0.75;
      nb.pos[0] = SG[o + 1]! - uz * f - ux * 0.5; nb.pos[2] = SG[o + 2]! + ux * f - uz * 0.5;
      nb.pos[1] = SG[o + 10]!;
      nb.rot[1] = Math.atan2(-uz, ux) - Math.PI / 2;
      arms[i]!.rot[2] = -0.35 + Math.sin(tt * 22) * 0.3;
    }
    for (let i = 0; i < NSPK; i++) {
      const q = run.SPI[i]!, h = sprHeads[i]!;
      h.hidden = q < 0;
      if (q < 0) continue;
      h.pos[0] = SG[q * IS + 1]!; h.pos[1] = SG[q * IS + 10]!; h.pos[2] = SG[q * IS + 2]!;
      h.rot[1] = run.sprinklerAim(i);
    }
    const Pt = cop.P, flash = ((engine.time * 5) | 0) & 1;
    for (let i = 0; i < MAXP; i++) {
      const o = i * PS, on = Pt[o + P_ON]!, u = units[i]!;
      u.alpha = on ? (on === 2 ? Math.max(0, 1 - Pt[o + P_FADE]! / 1.4) : 1) : 0;
      if (!on) continue;
      const kd = Pt[o + P_KIND]!;
      for (let q = 0; q < 3; q++) kinds[i * 3 + q]!.alpha = q === kd ? 1 : 0;
      u.pos[0] = Pt[o + P_X]!; u.pos[2] = Pt[o + P_Z]!;
      u.pos[1] = hgt(u.pos[0]!, u.pos[2]!) + (kd === U_DRONE ? 2.3 + Math.sin(engine.time * 3 + i) * 0.15 : 0.2);
      u.rot[1] = Pt[o + P_YAW]!;
      for (let s = 0; s < 2; s++) {
        const li = lites[(i * 3 + kd) * 2 + s]!;
        li.color = (s ^ flash) === 1 ? P.lite[s]! : P.liteOff;
      }
    }
  }

  // ---- FX ----
  function stepFx(dt: number) {
    const d = bike.b, v = bike.vel, ph = S[0]!;
    if (ph === RUN && !bike.air) {
      const k = d.throttle * (bike.nose > 0.1 ? 1 : Math.max(0, 1 - d.speed / 3)) + d.dust * 0.3, w = d.wheel;
      emitK += k * 28 * dt;
      while (emitK >= 1) {
        emitK -= 1;
        dust.puff(w[0]! + (rnd() - 0.5) * 0.2, w[1]! - 0.2, w[2]! + (rnd() - 0.5) * 0.2, -v[0]! * 0.2 + (rnd() - 0.5) * 0.6, 0.4 + rnd() * 0.5, -v[2]! * 0.2 + (rnd() - 0.5) * 0.6, 0.6 + rnd() * 0.4, 0.1, 0.45);
      }
    }
    const on = ph === RUN || ph === CRASH, SG = run.SG;
    water.n = on ? WATER : 0;
    if (on) {
      spin += dt;
      for (let i = 0; i < NSPK; i++) {
        const q = run.SPI[i]!, a = run.sprinklerAim(i), ca = Math.cos(a), sa = Math.sin(a), x0 = q >= 0 ? SG[q * IS + 1]! : 0, z0 = q >= 0 ? SG[q * IS + 2]! : 0, y0 = q >= 0 ? SG[q * IS + 10]! : 0;
        for (let k = 0; k < DROPS; k++) {
          const u = ((k / DROPS + spin * 0.9) % 1), j = i * DROPS + k, rr = u * SP_REACH;
          water.x[j] = x0 + ca * rr;
          water.z[j] = z0 - sa * rr;
          water.y[j] = y0 + 0.15 + u * (1 - u) * 2.4;
          water.r[j] = 0.035 + u * 0.03;
          water.a[j] = q >= 0 ? 0.85 - u * 0.5 : 0;
        }
      }
    }
    const dg = run.HD[1]! && ph === RUN ? 1 : 0, was0 = DRAGA[0]!;
    DRAGA[0] = ctx.reduced ? dg : was0 + (dg - was0) * Math.min(1, dt * 10);
    if (dg) {
      const w = d.wheel, sy = Math.sin(d.yaw), cy = Math.cos(d.yaw);
      for (let q = 0; q < 2; q++) spark.puff(w[0]! - sy * 0.45 + (rnd() - 0.5) * 0.2, w[1]! - 0.25, w[2]! - cy * 0.45 + (rnd() - 0.5) * 0.2, -v[0]! * 0.4 + (rnd() - 0.5) * 2, 1 + rnd() * 2, -v[2]! * 0.4 + (rnd() - 0.5) * 2, 0.25 + rnd() * 0.3, 0.04, 1);
    }
    let any = dust.step(dt, -0.3, 0.3, 0.45) || dg === 1 || Math.abs(DRAGA[0]! - dg) > 0.01;
    if (spark.step(dt, 14, -0.05, 1)) any = true;
    if (splash.step(dt, 9, -0.02, 0.9)) any = true;
    return any || on;
  }

  // ---- events: stickers, sound, FX ----
  const TRICK = ["", "WHEELIE", "MANUAL", "HOP", "STOPPIE"];
  const UNIT = ["PATROL BIKE", "PATROL CART", "PATROL DRONE"];
  function events() {
    const d = bike.b;
    for (let k = 0; k < run.n; k++) {
      const type = run.ev[k * 2]!, val = run.ev[k * 2 + 1]!;
      hudDirty = true;
      if (type === E_START) setView(1), engine.events.emit("start"), toast("GO! THE WORLD NEVER ENDS", "go"), say("Go: the world never ends");
      else if (type === E_TRICK) {
        engine.events.emit("trick");
        const kind = sc[KIND]!, bonus = sc[16]!;
        if (kind === STOPPIE) toast(`STOPPIE +${sc[PTS]!.toLocaleString("en-US")}${sc[CB]! > 0 ? ` ×${1 + sc[CB]!}` : ""}`, "meh");
        else toast(`${TRICK[kind]} ${sc[DIST]!.toFixed(1)} m · ${sc[TIME]!.toFixed(1)}s${sc[SWEET]! > 0.3 ? ` · SWEET ${sc[SWEET]!.toFixed(1)}s` : ""}${bonus ? " · BONUS" : ""} +${sc[PTS]!.toLocaleString("en-US")}${sc[CB]! > 0 ? ` ×${1 + sc[CB]!}` : ""}`, kind === MANUAL ? "clean" : "go");
        say(`${TRICK[kind]}, ${sc[PTS]} points`);
      } else if (type === E_HOP) {
        engine.events.emit("hop");
        toast(`HOP +${sc[PTS]}${sc[CB]! > 0 ? ` ×${1 + sc[CB]!}` : ""}`, "meh");
        dust.ring(rnd, d.pos[0]!, d.pos[1]! - 0.4, d.pos[2]!, 6, 1.4, 1.5, 0.7, 0.16, 0.6);
      } else if (type === E_AIR) {
        // (the landing says it)
      } else if (type === E_CRASH) {
        engine.events.emit("crash");
        crashes++;
        crashT = 0;
        shake = 0.45;
        spark.ring(rnd, d.pos[0]!, d.pos[1]!, d.pos[2]!, 22, 4, 4, 0.7, 0.06, 1);
        dust.ring(rnd, d.pos[0]!, d.pos[1]! - 0.3, d.pos[2]!, 12, 2, 1.5, 0.8, 0.2, 0.6);
        const what = val === LOOP ? "LOOPED OUT!" : val === ENDO ? "OVER THE BARS!" : val === CASE ? "CASED IT!" : val === BAIL ? "BAILED!" : "BONK!";
        toast(what, "bad");
        say(what);
      } else if (type === E_RESPAWN) engine.events.emit("respawn");
      else if (type === E_STUCK) stuckEl.hidden = !val;
      else if (type === E_RESET) {
        stuckEl.hidden = true;
        toast(val === 2 ? "UNSTUCK · BACK ON THE ROAD" : "RESET", "go");
      } else if (type === E_GRUMP) {
        engine.events.emit("grump");
        const c2 = canvas.getContext("2d")!;
        c2.font = BFONT;
        BW[val] = c2.measureText(LINES[run.NB[val * 4 + 3]!]!).width;
      } else if (type === E_BARK) {
        engine.events.emit("bark");
        barkT = 0.7;
        const c2 = canvas.getContext("2d")!;
        c2.font = BFONT;
        BW[NNB] = c2.measureText("WOOF!").width;
      } else if (type === E_SPLASH) {
        engine.events.emit("splash");
        splash.ring(rnd, d.pos[0]!, d.pos[1]! + 0.4, d.pos[2]!, 14, 2.2, 3, 0.6, 0.05, 0.9);
      } else if (type === E_BONUS) {
        engine.events.emit("bonus");
        toast(val === F_CROSS ? "CROSSWALK WHEELIE!" : val === F_SPRINK ? "SPRINKLER RUN!" : "GRUMPY BONUS!", "meh");
      } else if (type === E_TOWN) {
        engine.events.emit("town");
        if (val) {
          const name = Wd.townName(S[13]!, S[14]!);
          toast(`ENTERING ${name}`, "clean");
          say(`Entering ${name}`);
        } else if (!toastEl.hidden && /LOST/.test(toastEl.textContent ?? "")) void 0;
        else toast("OPEN ROAD", "clean");
      } else if (type === E_ESCAPE) {
        engine.events.emit("escape");
        toast(`LOST THEM! +${val.toLocaleString("en-US")} · COMBO ×${1 + sc[CB]!}`, "go");
        say(`Lost them: ${val} points, combo up`);
      } else if (type === E_DRAG) {
        engine.events.emit("cheer");
        shake = 0.15;
        spark.ring(rnd, d.wheel[0]!, d.wheel[1]! - 0.3, d.wheel[2]!, 26, 3.5, 4.5, 0.8, 0.07, 1);
        stars(d.pos[0]!, d.pos[1]! + 1.2, d.pos[2]!);
        toast(`HAND DRAG! ×${DRAG_X}`, "go");
        say(`Hand drag! Times ${DRAG_X}. Bring it back under twelve to bank it`);
      } else if (type === E_BANKED) {
        engine.events.emit("cheer");
        stars(d.pos[0]!, d.pos[1]! + 1.2, d.pos[2]!);
        toast(`BANKED! +${val.toLocaleString("en-US")}`, "go");
        say(`Banked ${val} points`);
      } else if (type === E_LOST) {
        toast(`LOOPED OUT — LOST ${val.toLocaleString("en-US")}`, "bad");
        say(`Looped out. ${val} points lost`);
      } else if (type === E_TICKET) {
        engine.events.emit("ticket");
        shake = 0.3;
        tlineEl.textContent = `${val > 0 ? `−${val.toLocaleString("en-US")} PTS · ` : ""}COMBO GONE`;
        ticketEl.hidden = false;
        ticketT = 2.4;
        toastEl.hidden = true;
        say(`Ticket. ${val} points lost, combo gone`);
      } else if (type === E_STARS) {
        if (val > 0 && cop.chasing === 0) toast(`HEAT ${"★".repeat(val)}`, "meh");
      } else if (type === E_UNIT) {
        sirenT = 0;
        toast(`${UNIT[val]} ON YOUR TAIL!`, "bad");
        say(`${UNIT[val]} on your tail. Keep riding: they only ticket you stopped. Ride out of town to lose them`);
      } else if (type === E_CLEAR) {
        if (val > 0) toast(`COOLED OFF · ${val.toLocaleString("en-US")} SAFE`, "clean");
        say("Cooled off");
      } else if (type === E_END) {
        engine.events.emit("end");
        later(1.2, T_CARD);
        say("Time");
      }
    }
    run.clear();
  }
  function toast(text: string, kind: string) {
    toastEl.textContent = text;
    toastEl.className = "wc-toast wc-" + kind;
    toastEl.hidden = false;
    toastT = 1.8;
  }
  let said = "";
  function say(s: string) {
    if (s === said) s += " ";
    live.textContent = said = s;
  }
  function hudWrite() {
    const ph = S[0]!, cm = Math.floor(run.far / 10);
    if (was[0] !== cm) (was[0] = cm), (timeEl.textContent = `${(cm / 100).toFixed(2)} KM`), timeEl.parentElement!.classList.toggle("wc-hot", run.far > best && best > 0);
    const s = sc[SC]!;
    if (was[1] !== s) (was[1] = s), (scoreEl.textContent = s.toLocaleString("en-US"));
    const cb = sc[CB]!;
    if (was[2] !== cb) (was[2] = cb), (comboEl.textContent = "×" + (1 + cb)), comboEl.classList.toggle("wc-hot", cb > 0);
    const on = sc[ON] === 1 && ph === RUN, mm = on ? Math.floor(sc[DIST]! * 10) : -1;
    if (was[3] !== mm) {
      was[3] = mm;
      trickChip.hidden = !on;
      if (on) trickEl.textContent = `${run.sc.S[6]! < sc[TIME]! * 0.3 ? "MANUAL" : "WHEELIE"} ${(mm / 10).toFixed(1)} m`;
    }
    const st = cop.S[STARS]!, ht = Math.ceil(cop.S[HEAT]! / 5), risk = Math.round(cop.S[HOT]!), chased = cop.chasing > 0 ? 1 : 0;
    if (was[5] !== st * 1000 + ht * 2 + chased) {
      was[5] = st * 1000 + ht * 2 + chased;
      heatChip.hidden = ht === 0;
      heatEl.textContent = "★".repeat(st) + "☆".repeat(5 - st);
      heatChip.classList.toggle("wc-hot", chased === 1);
      heatChip.setAttribute("aria-label", `Heat: ${st} of 5 stars`);
    }
    const HDv = run.HD, dk = HDv[1] ? 1000 + Math.floor(HDv[2]! / 10) : HDv[0]! > 0 ? Math.min(99, Math.floor((HDv[0]! / HAND_T) * 100)) : -1;
    if (was[7] !== dk) {
      was[7] = dk;
      dragChip.hidden = dk < 0;
      dragChip.classList.toggle("wc-dragging", dk >= 1000);
      if (dk >= 1000) dragEl.textContent = `HAND DRAG ×${DRAG_X} · ${Math.round(HDv[2]!).toLocaleString("en-US")} AT RISK`;
      else if (dk >= 0) (dragEl.textContent = "PAST 12 · HOLD IT"), dragRing.style.setProperty("--p", dk + "%");
    }
    if (was[6] !== risk) (was[6] = risk), (riskEl.hidden = risk <= 0), (riskEl.textContent = `AT RISK ${risk.toLocaleString("en-US")}`);
    const g = chased, rideN = S[2]!;
    if (was[4] !== ph * 10 + g + rideN * 100) {
      was[4] = ph * 10 + g + rideN * 100;
      const touch = !!thePad.el.offsetParent;
      hintEl.textContent = ph === READY ? `BEST ${(best / 1000).toFixed(2)} KM · ${touch ? "hold ⚡: the world never ends · END banks it" : "Space to ride: the world never ends · END (or E) banks it"}` : g && ph === RUN ? "NEON PATROL ON YOU · KEEP RIDING (STOP AND IT'S A TICKET) · RIDE OUT OF TOWN TO LOSE THEM" : "";
    }
  }
  function stats() {
    const esc = cop.S[ESC]!, tix = cop.S[TIX]!, tw = S[S_TOWNS]!;
    return m.stats({ finished: true, score: sc[SC]!, where: "city", farKey: "city", far: run.far, escapes: esc, tickets: tix, summary: `${(run.far / 1000).toFixed(2)} KM out · ${tw} ${tw === 1 ? "town" : "towns"} · longest wheelie ${sc[BEST_W]!.toFixed(1)} m · ${esc} ${esc === 1 ? "escape" : "escapes"} · ${tix} ${tix === 1 ? "ticket" : "tickets"}` });
  }
  function end() {
    if (ended || ctx.attract) return;
    ended = true;
    S[0] = DONE;
    setView(0);
    say(`${(run.far / 1000).toFixed(2)} kilometres`);
    ctx.end(stats());
  }

  // ---- camera: the chase view (a three-quarter view of the bike), or the map view high over it ----
  function frameTable() {
    const Wd2 = dio.width, H = dio.height, tall = H / Wd2 > 0.75;
    chaseO.dist = tall ? 12.5 : 10.5;
    chaseO.pitch = tall ? 0.46 : 0.36;
  }
  function stepCam(dt: number) {
    const cam = dio.cam, d = bike.b;
    target.yaw = d.yaw;
    CTP[0] = d.pos[0]!; CTP[1] = d.pos[1]!; CTP[2] = d.pos[2]!;
    if (view) {
      const mv = chase(cam, target, chaseO, dt), k = 1 - Math.exp(-4 * dt);
      cam.ox -= cam.ox * k;
      cam.oy -= cam.oy * k;
      return mv || Math.abs(cam.ox) + Math.abs(cam.oy) > 0.2;
    }
    TABLE.tx = d.pos[0]!; TABLE.ty = hgt(d.pos[0]!, d.pos[2]!); TABLE.tz = d.pos[2]!; TABLE.yaw = cam.yaw;
    const k = ctx.reduced ? 1 : 1 - Math.exp(-2.6 * dt);
    let moving = false;
    for (const key of ["pitch", "dist", "tx", "ty", "tz", "ox", "oy"] as const) {
      const dd = TABLE[key] - cam[key];
      if (Math.abs(dd) > 1e-3) (cam[key] += dd * k), (moving = true);
      else cam[key] = TABLE[key];
    }
    return moving;
  }
  function setView(n: number) {
    view = n;
    viewK.textContent = n ? "VIEW · CHASE" : "VIEW · MAP";
    dirty = true;
    engine.busy(2.5);
    engine.wake();
  }

  // ---- drawing extras ----
  function paintSky(c2: CanvasRenderingContext2D) {
    const Wd2 = dio.width, H = dio.height;
    if (!sky) {
      sky = c2.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, P.sky0);
      sky.addColorStop(0.6, P.sky1);
      sky.addColorStop(1, P.sky2);
    }
    c2.fillStyle = sky;
    c2.fillRect(0, 0, Wd2, H);
    if (P.night) {
      c2.fillStyle = P.star;
      for (let i = 0; i < 90; i += 3) {
        c2.globalAlpha = 0.25 + STARS_BG[i + 2]! * 0.6;
        c2.fillRect(STARS_BG[i]! * Wd2, STARS_BG[i + 1]! * H * 0.6, 1.5, 1.5);
      }
      c2.globalAlpha = 1;
    }
    const r = Math.min(Wd2, H) * 0.08;
    c2.fillStyle = P.moon;
    c2.beginPath();
    c2.arc(Wd2 * 0.2, H * 0.17, r, 0, TAU);
    c2.fill();
    if (P.night) {
      c2.fillStyle = P.sky0;
      c2.beginPath();
      c2.arc(Wd2 * 0.2 + r * 0.42, H * 0.17 - r * 0.2, r * 0.86, 0, TAU);
      c2.fill();
    }
  }
  /** The horizon's screen y (the eye's level, straight ahead). */
  function horizon() {
    const cm = dio.cam, f = dio.height / 2 / Math.tan(cm.fov / 2);
    return dio.height / 2 + cm.oy - f * Math.tan(cm.pitch);
  }
  /** The haze over the far ground: the far ring's first colour from the horizon down to where the
   *  ground HAZE0 units ahead meets the screen (solid above HAZE1). */
  const FOG = { g: null as CanvasGradient | null, y0: 0, y1: 0, c: "" };
  const HZC: string[] = [], CRC: string[] = [];
  function paintFog(c2: CanvasRenderingContext2D) {
    const cm = dio.cam, d = bike.b, x = d.pos[0]!, z = d.pos[2]!, fx = -Math.sin(cm.yaw), fz = -Math.cos(cm.yaw), y = hgt(x, z);
    const ok1 = dio.project(x + fx * HAZE1, y, z + fz * HAZE1, tmp), ok0 = dio.project(x + fx * HAZE0, y, z + fz * HAZE0, tmp2);
    const yh = horizon(), y1 = ok1 ? Math.max(yh, tmp[1]!) : yh + 4, y0 = ok0 ? Math.max(y1 + 8, tmp2[1]!) : y1 + 40;
    const topY = yh - dio.height * 0.1, col = HZC[0]!;
    if (!FOG.g || FOG.c !== col || Math.abs(FOG.y0 - y0) > 3 || Math.abs(FOG.y1 - y1) > 3) {
      const span = y0 - topY || 1;
      FOG.g = c2.createLinearGradient(0, topY, 0, y0);
      FOG.g.addColorStop(0, col + "00");
      FOG.g.addColorStop(Math.max(0.01, (yh - topY) / span), col);
      FOG.g.addColorStop(Math.min(0.98, Math.max(0.02, (y1 - topY) / span)), col);
      FOG.g.addColorStop(1, col + "00");
      FOG.y0 = y0; FOG.y1 = y1; FOG.c = col;
    }
    c2.fillStyle = FOG.g;
    c2.fillRect(0, topY, dio.width, FOG.y0 - topY);
  }
  // The far ring: rolling ridgelines layered to the horizon (hazier the further), each drawn only above
  // the near ground's silhouette, so the world reads as going on in every direction.
  const COLS = 200, NBD = BANDS.length / 2, FCX = new Float64Array(COLS), SIL = new Float64Array(COLS), RID = new Float64Array(COLS * NBD), PT = new Float64Array(3);
  function paintFar(c2: CanvasRenderingContext2D) {
    const cm = dio.cam, cp = Math.cos(cm.pitch), sy = Math.sin(cm.yaw), cy = Math.cos(cm.yaw);
    const ex = cm.tx + cm.dist * sy * cp, ez = cm.tz + cm.dist * cy * cp;
    const fx = -sy, fz = -cy, rx = cy, rz = -sy, f = dio.height / 2 / Math.tan(cm.fov / 2), mid = dio.width / 2 + cm.ox;
    const n = Math.min(COLS, Math.max(24, Math.ceil(dio.width / 14) + 1)), span = ((dio.width / 2 + 24) / f) * cp, H = dio.height;
    const x0 = t.x0, z0 = t.z0, x1 = x0 + t.cols * t.cell, z1 = z0 + t.rows * t.cell;
    for (let i = 0; i < n; i++) {
      const u = -span + (2 * span * i) / (n - 1), l = Math.sqrt(1 + u * u), dx = (fx + rx * u) / l, dz = (fz + rz * u) / l;
      FCX[i] = mid + (u * f) / cp;
      let topY = H + 2;
      for (let r = 1.5; r < BANDS[0]! + 12; r += 0.8 + r * 0.07) {
        const px = ex + dx * r, pz = ez + dz * r;
        if (px <= x0 || pz <= z0 || px >= x1 || pz >= z1) break;
        if (dio.project(px, t.height(px, pz), pz, PT) && PT[2]! > 0.5 && PT[1]! < topY) topY = PT[1]!;
      }
      SIL[i] = topY;
      for (let b = 0; b < NBD; b++) {
        const r0 = BANDS[b * 2]!, r1 = BANDS[b * 2 + 1]!, st = (r1 - r0) / 6;
        let y = H + 2;
        for (let r = r0; r <= r1 + 0.01; r += st) {
          const px = ex + dx * r, pz = ez + dz * r;
          if (dio.project(px, FR.t.height(px, pz), pz, PT) && PT[1]! < y) y = PT[1]!;
        }
        RID[b * COLS + i] = y;
      }
    }
    c2.lineJoin = "round";
    c2.lineWidth = Math.max(1.2, dio.width / 700);
    for (let b = NBD - 1; b >= 0; b--) {
      c2.beginPath();
      for (let i = 0; i < n; i++) {
        const y = Math.min(RID[b * COLS + i]!, SIL[i]!);
        i ? c2.lineTo(FCX[i]!, y) : c2.moveTo(FCX[i]!, y);
      }
      for (let i = n - 1; i >= 0; i--) c2.lineTo(FCX[i]!, SIL[i]!);
      c2.closePath();
      c2.fillStyle = HZC[b + 1]!;
      c2.fill();
      c2.beginPath();
      let pen = false;
      for (let i = 0; i < n; i++) {
        const y = RID[b * COLS + i]!;
        if (y >= SIL[i]! - 0.5) { pen = false; continue; }
        if (pen) c2.lineTo(FCX[i]!, y);
        else c2.moveTo(FCX[i]!, y), (pen = true);
      }
      c2.strokeStyle = CRC[b + 1]!;
      c2.stroke();
    }
  }
  /** The road ribbons round the bike, out past the haze (the window's edge clips them, as it does the ground). */
  function paintRibbons(c2: CanvasRenderingContext2D) {
    const d = bike.b;
    rib.at[0] = d.pos[0]!; rib.at[1] = d.pos[2]!; rib.at[2] = 48;
    rib.paint(c2);
  }
  /** The lane paint on the roads round the bike: the edge lines, the dashes down the middle (a double
   *  line on a highway), the roundabouts' rings and the crosswalks' zebras; faded by distance. */
  const RREACH = 40;
  function paintRoads(c2: CanvasRenderingContext2D) {
    if (BARE) return;
    const d = bike.b, x = d.pos[0]!, z = d.pos[2]!, ci = Math.floor(x / RC), cj = Math.floor(z / RC), EF = Wd.EF;
    c2.lineCap = "butt";
    if (P.night) c2.globalCompositeOperation = "lighter";
    for (let pass = 0; pass < 2; pass++) {
      c2.strokeStyle = pass ? F.laneY : F.lane;
      c2.lineWidth = Math.max(1, dio.width / (pass ? 900 : 1100));
      c2.globalAlpha = P.night ? 0.85 : 0.9;
      c2.beginPath();
      for (let dir = 0; dir < 2; dir++) for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
        const e = Wd.edge(i, j, dir);
        if (e < 0) continue;
        const f = e * 8;
        if (x + RREACH < EF[f + 2]! || x - RREACH > EF[f + 4]! || z + RREACH < EF[f + 3]! || z - RREACH > EF[f + 5]!) continue;
        const L = EF[f + 1]!, hw = EF[f]!, hi = hw > 4;
        // The ends inside a roundabout's ring are not painted.
        const a0 = Wd.isRound(i, j) ? RB_R + RB_HW : 4, a1 = Wd.isRound(i + (dir ? 0 : 1), j + (dir ? 1 : 0)) ? RB_R + RB_HW : 4;
        for (let side = pass ? (hi ? -1 : 0) : -1; side <= (pass ? (hi ? 1 : 0) : 1); side += pass ? 2 : 2) {
          const off = pass ? side * 0.12 : side * (hw - 0.3);
          let pen = false;
          for (let s = a0; s <= L - a1; s += pass && !hi ? 1 : 1.5) {
            // Dashes: 2 on, 2 off (a solid double on a highway).
            if (pass && !hi && ((s / 2) | 0) & 1) { pen = false; continue; }
            Wd.at(e, s);
            const px = Wd.PQ[0]! - Wd.PQ[3]! * off, pz = Wd.PQ[1]! + Wd.PQ[2]! * off, ddx = px - x, ddz = pz - z;
            if (ddx * ddx + ddz * ddz > RREACH * RREACH) { pen = false; continue; }
            if (!dio.project(px, t.height(px, pz) + 0.03, pz, tmp) || tmp[2]! < 0.6) { pen = false; continue; }
            if (pen) c2.lineTo(tmp[0]!, tmp[1]!);
            else c2.moveTo(tmp[0]!, tmp[1]!), (pen = true);
          }
          if (!pass && side === -1) side = -1;
        }
      }
      c2.stroke();
    }
    // Roundabouts: the inner and outer edge lines.
    c2.strokeStyle = F.lane;
    c2.beginPath();
    for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
      if (!Wd.isRound(i, j)) continue;
      Wd.nodeQ(i, j);
      const nx = Wd.NQ[0]!, nz = Wd.NQ[1]!;
      if ((nx - x) * (nx - x) + (nz - z) * (nz - z) > RREACH * RREACH) continue;
      for (const r of [RB_R - RB_HW + 0.3, RB_R + RB_HW - 0.3]) {
        let pen = false;
        for (let q = 0; q <= 48; q++) {
          const a = (q * TAU) / 48, px = nx + Math.cos(a) * r, pz = nz + Math.sin(a) * r;
          if (!dio.project(px, t.height(px, pz) + 0.03, pz, tmp) || tmp[2]! < 0.6) { pen = false; continue; }
          if (pen) c2.lineTo(tmp[0]!, tmp[1]!);
          else c2.moveTo(tmp[0]!, tmp[1]!), (pen = true);
        }
      }
    }
    c2.stroke();
    c2.globalCompositeOperation = "source-over";
    // Crosswalks: zebra bars across the road.
    c2.fillStyle = P.zebra;
    c2.globalAlpha = 0.9;
    for (let q = 0; q < ncross; q++) {
      const o = q * 5, cx = CROSS[o]!, cz = CROSS[o + 1]!, ux = CROSS[o + 2]!, uz = CROSS[o + 3]!, w = CROSS[o + 4]!, wd = (CROSS[o + 4]! ? 1 : 1) * 0;
      void w; void wd;
      const half = 2.9;
      if ((cx - x) * (cx - x) + (cz - z) * (cz - z) > RREACH * RREACH) continue;
      for (let b2 = -3; b2 <= 3; b2++) {
        const v = b2 * (half / 3.5), ax = cx - uz * v, az = cz + ux * v;
        let ok = 0;
        for (let c3 = 0; c3 < 4; c3++) {
          const su = c3 & 1 ? 1 : -1, sv = c3 & 2 ? 0.25 : -0.25, px = ax + ux * su - uz * sv, pz = az + uz * su + ux * sv;
          if (dio.project(px, t.height(px, pz) + 0.03, pz, tmp) && tmp[2]! > 0.6) (OCN[c3 * 2] = tmp[0]!), (OCN[c3 * 2 + 1] = tmp[1]!), ok++;
        }
        if (ok < 4) continue;
        c2.beginPath();
        c2.moveTo(OCN[0]!, OCN[1]!); c2.lineTo(OCN[2]!, OCN[3]!); c2.lineTo(OCN[6]!, OCN[7]!); c2.lineTo(OCN[4]!, OCN[5]!);
        c2.closePath();
        c2.fill();
      }
    }
    c2.globalAlpha = 1;
  }
  /** Pools of light under the streetlamps (night only) and the patrol's lights on the road. */
  function paintPools(c2: CanvasRenderingContext2D) {
    if (!P.night || BARE) return;
    c2.globalCompositeOperation = "lighter";
    c2.fillStyle = P.glow;
    const f = dio.focal();
    for (let i = P0[I_LAMP]!; i < P0[I_LAMP + 1]!; i++) {
      if (!ON_[i]) continue;
      const o = OBJ[i]!, r9 = i * 9, ux = OI[r9 + 2]!, uz = OI[r9 + 3]!, lx = o.pos[0]! - uz * -0.6, lz = o.pos[2]! + ux * -0.6;
      void lx; void lz;
      if (o.alpha < 0.05 || !dio.project(o.pos[0]!, o.pos[1]! + 0.1, o.pos[2]!, tmp) || tmp[2]! < 0.5) continue;
      const r = (f * 2.4) / tmp[2]!;
      c2.globalAlpha = 0.09 * o.alpha;
      c2.beginPath();
      c2.ellipse(tmp[0]!, tmp[1]!, r, r * 0.5, 0, 0, TAU);
      c2.fill();
    }
    const Pt = cop.P, flash = ((engine.time * 5) | 0) & 1;
    for (let i = 0; i < MAXP; i++) {
      const o = i * PS;
      if (Pt[o + P_ON] !== 1 || !dio.project(Pt[o + P_X]!, hgt(Pt[o + P_X]!, Pt[o + P_Z]!) + 0.05, Pt[o + P_Z]!, tmp) || tmp[2]! < 0.5) continue;
      const r = (f * 2.6) / tmp[2]!;
      c2.fillStyle = P.lite[flash]!;
      c2.globalAlpha = 0.16;
      c2.beginPath();
      c2.ellipse(tmp[0]!, tmp[1]!, r, r * 0.5, 0, 0, TAU);
      c2.fill();
    }
    c2.globalAlpha = 1;
    c2.globalCompositeOperation = "source-over";
  }
  function paintShadow(c2: CanvasRenderingContext2D) {
    if (BARE) return;
    const d = bike.b, x = d.pos[0]!, z = d.pos[2]!, gy = hgt(x, z), lift = Math.max(0, d.pos[1]! - gy - d.drop - d.radius - 0.3);
    if (!dio.project(x, gy + 0.01, z, tmp) || tmp[2]! < 0.5) return;
    const f = dio.focal(), r = (f * 0.85) / tmp[2]!;
    c2.fillStyle = P.shadow;
    c2.globalAlpha = Math.max(0.08, 0.32 - lift * 0.15);
    c2.beginPath();
    c2.ellipse(tmp[0]!, tmp[1]!, r, r * 0.4, 0, 0, TAU);
    c2.fill();
    c2.globalAlpha = 1;
  }
  const BFONT = "900 13px ui-rounded, system-ui, sans-serif";
  function bubble(c2: CanvasRenderingContext2D, x: number, y: number, z: number, text: string, w: number, fill: string) {
    if (!dio.project(x, y, z, tmp) || tmp[2]! < 0.5 || tmp[0]! < 0 || tmp[0]! > dio.width) return;
    const bw = w + 18, bh = 24, bx = Math.max(bw / 2 + 6, Math.min(dio.width - bw / 2 - 6, tmp[0]!)), by = tmp[1]! - 10, tx = tmp[0]!;
    if (by - bh < V[3]! - 6) return;
    c2.fillStyle = P.ink;
    c2.beginPath();
    c2.roundRect(bx - bw / 2 + 3, by - bh + 3, bw, bh, 8);
    c2.fill();
    c2.fillStyle = fill;
    c2.strokeStyle = P.ink;
    c2.lineWidth = 2;
    c2.beginPath();
    c2.roundRect(bx - bw / 2, by - bh, bw, bh, 8);
    const px = Math.max(bx - bw / 2 + 10, Math.min(bx + bw / 2 - 10, tx));
    c2.moveTo(px - 5, by);
    c2.lineTo(px - 2, by + 8);
    c2.lineTo(px + 5, by);
    c2.fill();
    c2.stroke();
    c2.fillStyle = P.ink;
    c2.font = BFONT;
    c2.textAlign = "center";
    c2.textBaseline = "middle";
    c2.fillText(text, bx, by - bh / 2 + 0.5);
  }
  function drawOverlay(c2: CanvasRenderingContext2D) {
    paintGhosts(c2);
    paintBeams(c2);
    for (let i = 0; i < NNB; i++) {
      const tt = run.NB[i * 4 + 1]!;
      if (tt <= 0 || tt > 2.3 || run.NI[i]! < 0) continue;
      const nb = nbs[i]!;
      bubble(c2, nb.pos[0]!, nb.pos[1]! + 1.5, nb.pos[2]!, LINES[run.NB[i * 4 + 3]!]!, BW[i]!, P.paper);
    }
    if (barkT > 0 && !dog.hidden) bubble(c2, dog.pos[0]!, dog.pos[1]! + 0.7, dog.pos[2]!, "WOOF!", BW[NNB]!, P.warn);
    const nose = bike.nose, ph = S[0]!;
    if ((ph !== RUN && ph !== READY) || nose < 0.03) return;
    const d = bike.b;
    if (!dio.project(d.pos[0]!, d.pos[1]! + 1.55, d.pos[2]!, tmp) || tmp[2]! < 0.5) return;
    const sp = bike.spec, lim = bike.balance + 0.62, cx = tmp[0]!, cy = tmp[1]! - 18, r = 26;
    if (cy - r < V[3]! - 4) return;
    const ang = (a: number) => Math.PI + (Math.min(lim, Math.max(0, a)) / lim) * Math.PI;
    c2.lineCap = "butt";
    c2.fillStyle = P.ink;
    c2.globalAlpha = 0.55;
    c2.beginPath();
    c2.arc(cx, cy, r + 7, Math.PI, TAU);
    c2.closePath();
    c2.fill();
    c2.globalAlpha = 1;
    c2.lineWidth = 7;
    c2.strokeStyle = P.paper;
    c2.beginPath();
    c2.arc(cx, cy, r, Math.PI, ang(bike.balance - sp.sweet));
    c2.stroke();
    c2.strokeStyle = P.good;
    c2.beginPath();
    c2.arc(cx, cy, r, ang(bike.balance - sp.sweet), ang(bike.balance + sp.sweet));
    c2.stroke();
    c2.strokeStyle = P.bad;
    c2.beginPath();
    c2.arc(cx, cy, r, ang(bike.balance + sp.sweet), TAU);
    c2.stroke();
    const a = ang(nose);
    c2.strokeStyle = P.warn;
    c2.lineWidth = 3;
    c2.lineCap = "round";
    c2.beginPath();
    c2.moveTo(cx, cy);
    c2.lineTo(cx + Math.cos(a) * (r + 4), cy + Math.sin(a) * (r + 4));
    c2.stroke();
  }

  // ---- the loop ----
  const GP = new Float64Array(7);
  /** Each frame: the far ring follows, the pool streams, what stands up fades into the haze. */
  function world() {
    const x = bike.b.pos[0]!, z = bike.b.pos[2]!;
    FR.follow(x, z);
    stream();
    fade(x, z);
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
        FOG.g = null;
        if (Math.abs((cr.width || 1) - V[7]!) > 1) {
          V[7] = cr.width || 1;
          V[3] = Math.max(8, hr.bottom - sr.top + 8);
          V[4] = 10;
          frameTable();
        }
        hudDirty = dirty = true;
      }
      if (V[6] && !gamepad(GP)) GP.fill(0);
      if (V[6] && (GP[0] || GP[1] || GP[2] || GP[3] || GP[4])) auto = false;
    },
    step(e, dt) {
      if (TF[0] && e.time >= TT[0]!) (TF[0] = 0), end();
      if (auto) run.autopilot(I);
      else {
        const stick = c.stick.active;
        I[0] = Math.max(c.down(GAS) ? 1 : 0, GP[2]!);
        I[1] = Math.max(c.down(BRAKE) ? 1 : 0, GP[3]!);
        I[2] = -GP[1]! || (stick ? -c.stick.y : c.axis("back", "fwd"));
        I[3] = GP[0]! || (stick ? c.stick.x : c.axis("left", "right"));
        I[4] = c.hit(HOPK) || GP[4]! > 0.5 ? 1 : 0;
      }
      if (paused || ended) I[0] = I[1] = I[2] = I[3] = I[4] = 0;
      const ph = S[0]!;
      const again = !auto && !paused && !ended && (resetQ === 1 || c.hit(RESETK) || GP[6]! > 0.5);
      resetQ = 0;
      let moving = run.step(dt, I[0]!, I[1]!, I[2]!, I[3]!, I[4]!, !auto && !paused && !ended, again);
      if (ph === RUN || ph === CRASH) m.tick(bike.b, dt);
      if (TF[0]) moving = true;
      if (run.n) events(), (moving = true);
      world();
      if (S[0] === CRASH) crashT += dt;
      if (cop.chasing > 0 && S[0] !== DONE) {
        sirenT -= dt;
        if (sirenT <= 0) (sirenT = 0.7), engine.events.emit("siren");
        moving = true;
      }
      if (stepFx(dt)) moving = true;
      if (stepCam(dt)) moving = true;
      if (occlude(dt)) moving = true;
      if (shake > 0) (shake = Math.max(0, shake - dt)), (moving = true);
      if (barkT > 0) (barkT = Math.max(0, barkT - dt)), (moving = true);
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true), toastT === 0 && (toastEl.hidden = true);
      if (ticketT > 0) (ticketT = Math.max(0, ticketT - dt)), (moving = true), ticketT === 0 && (ticketEl.hidden = true);
      if (moving) e.busy(), (dirty = true), (hudDirty = true);
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      if (!dirty) return;
      dirty = false;
      pose();
      const cam = dio.cam, k = shake * shake * 10, sx = Math.sin(engine.time * 71) * k, sy = Math.cos(engine.time * 53) * k * 0.7;
      (cam.ox += sx), (cam.oy += sy);
      dio.draw();
      vox.set(bike.b.rpm, bike.b.throttle, S[0] === RUN && snd.on && !paused);
      (cam.ox -= sx), (cam.oy -= sy), (V[5] = 1);
    },
  });

  // ---- input ----
  const MAP: Record<string, string> = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "fwd", KeyW: "fwd", ArrowDown: "back", KeyS: "back", Space: "gas", KeyJ: "gas", KeyK: "brake", ShiftLeft: "brake", ShiftRight: "brake", KeyL: "hop", KeyR: "reset" };
  const wake = () => vox.wake(SPEC.power);
  stage.addEventListener("pointerdown", wake, sig);
  const src = (e: Event) => (e.composedPath?.()[0] ?? e.target) as Element | null;
  window.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || ctx.attract || paused || src(e)?.closest?.("input,textarea,select")) return;
    wake();
    if (e.code === "KeyM") return void (e.preventDefault(), toggle());
    if (e.code === "KeyV") return void (e.preventDefault(), setView(view ? 0 : 1));
    if (e.code === "KeyE" && S[0] !== READY) return void (e.preventDefault(), end());
    const k = MAP[e.code];
    if (!k || src(e)?.closest?.(".bui-pad")) return;
    e.preventDefault();
    if (ended) return;
    auto = false;
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
    c.press("gas");
    engine.wake();
  }, sig);
  const up = () => c.press("gas", false);
  play.addEventListener("pointerup", up, sig);
  play.addEventListener("pointercancel", up, sig);
  muteK.addEventListener("click", toggle, sig);
  viewK.addEventListener("click", () => setView(view ? 0 : 1), sig);
  keysEl.querySelector(".wc-menu")!.addEventListener("click", () => ctx.menu(), sig);
  keysEl.querySelector(".wc-end")?.addEventListener("click", () => end(), sig);
  keysEl.querySelector(".wc-reset")!.addEventListener("click", () => ((resetQ = 1), (auto = false), engine.wake()), sig);
  thePad.el.addEventListener("pointerdown", () => ((auto = false), engine.wake()), sig);

  run.reset(0);
  buildScene();
  vox.use(SPEC.power);
  setView(1);
  target.yaw = bike.b.yaw;
  CTP.set(bike.b.pos);
  chase(dio.cam, target, { ...chaseO, snap: true });
  engine.busy(2);
  engine.start();
  if (!ctx.attract) play.focus({ preventScroll: true });
  /** Snap the chase camera behind the bike, stream and draw (a probe). */
  const snapCam = () => {
    CTP[0] = bike.b.pos[0]!; CTP[1] = bike.b.pos[1]!; CTP[2] = bike.b.pos[2]!; target.yaw = bike.b.yaw;
    chase(dio.cam, target, { ...chaseO, snap: true });
    world();
    dirty = true;
    engine.busy(1);
    engine.wake();
  };
  return {
    engine,
    get auto() { return auto; },
    set auto(on: boolean) { auto = on; engine.wake(); },
    get state() {
      const ph = S[0]!;
      return {
        phase: ph === READY ? "ready" : ph === RUN || ph === CRASH ? "run" : ph === DONE ? "done" : "idle", walking: bike.b.walking, clock: S[1]!, score: sc[SC]!, combo: sc[CB]!, trick: sc[ON] === 1, nose: bike.nose, view: view ? "chase" : "map", speed: bike.b.speed, crashes, grumps: S[4]!, best: sc[BEST_W]!, ended,
        gas: I[0]!, brake: I[1]!, drag: run.HD[1]!, hold: run.HD[0]!,
        far: run.far, endless: true, towns: S[S_TOWNS]!, inTown: run.inTown, near: cop.S[NEAR]!, heat: cop.S[HEAT]!, stars: cop.S[STARS]!, units: cop.chasing, risk: cop.S[HOT]!, escapes: cop.S[ESC]!, tickets: cop.S[TIX]!, x: bike.b.pos[0]!, z: bike.b.pos[2]!, objects: dio.stats.objects, faces: dio.stats.faces, ground: tv.stats.faces, ribbons: rib.stats.quads, tiles: run.win.stats[0]!,
      };
    },
    get camera() { return { dist: view ? dio.cam.dist : chaseO.dist, fov: dio.cam.fov, view: view ? "chase" : "map" }; },
    finish() { if (!ended) end(); },
    stats,
    pause(on: boolean) {
      if (paused === on || ended) return;
      paused = on;
      c.press("gas", false), rock.release();
      if (on) engine.stop();
      else engine.start();
    },
    destroy: () => engine.destroy(),
    probe: {
      /** Put the bike `back` units out from building `key`'s front, facing away from it along the
       *  chase camera's line: the building stands between the camera and the bike. Returns [x, z]. */
      behind(key: number, back = 4) {
        let i = -1;
        for (let q = 0; q < P0[I_PROP]!; q++) if (ON_[q] && OI[q * 9 + 8] === key) i = q;
        if (i < 0) return null;
        const r = i * 9, ux = OI[r + 2]!, uz = OI[r + 3]!, fx = -uz, fz = ux, yaw = Math.atan2(-fz, fx), cy = yaw - Math.PI / 2 + chaseO.side, cx2 = Math.sin(cy), cz2 = Math.cos(cy);
        const dot = -(cx2 * fx + cz2 * fz), s = (OI[r + 5]! / 2 + back) / Math.max(0.3, dot);
        const x = OI[r]! - cx2 * s, z = OI[r + 1]! - cz2 * s;
        run.place(x, z, yaw);
        snapCam();
        return [x, z];
      },
      /** Put the bike at world (x, z) facing yaw, the chase camera snapped behind it; returns the faces
       *  drawn, faces dropped, and for a grid of ground points round and ahead of the bike their screen places. */
      spot(x: number, z: number, yaw: number) {
        run.place(x, z, yaw);
        snapCam();
        dio.draw();
        const out: number[] = [], fx = Math.cos(yaw), fz = -Math.sin(yaw);
        for (let a = -2; a <= 8; a += 1) for (let s = -3; s <= 3; s += 1.5) {
          if (Math.abs(a) < 1.6 && Math.abs(s) < 1.6) continue;
          const px = x + fx * a - fz * s, pz = z + fz * a + fx * s;
          if (!run.streetClear(px, pz, 1.2)) continue;
          if (dio.project(px, t.height(px, pz), pz, PJ) && PJ[0]! > 2 && PJ[1]! > 2 && PJ[0]! < dio.width - 2 && PJ[1]! < dio.height - 2) out.push(PJ[0]!, PJ[1]!);
        }
        return { faces: dio.stats.faces, dropped: dio.stats.dropped, pts: out };
      },
      /** Draw now: xr 2 hides the buildings; rider 0 the rider; bare 1 every placed object and the
       *  paint on the ground too (the bare ground and its road ribbons, for the edge test). */
      draw(xr = 0, rider = 1, bare = 0) {
        XR = xr;
        BARE = bare;
        world();
        occlude(0);
        pose();
        if (bare) for (let i = 0; i < OBJ.length; i++) OBJ[i]!.alpha = 0;
        rigs[0]!.root.alpha = rider;
        dio.draw();
        rigs[0]!.root.alpha = 1;
        XR = BARE = 0;
        dirty = true;
        return dio.cam.dist;
      },
      bikeBox() {
        const b = bike.b.pos, out = [1e9, 1e9, -1e9, -1e9], gy = hgt(b[0]!, b[2]!);
        for (let q = 0; q < 8; q++) if (dio.project(b[0]! + (q & 1 ? 1 : -1), Math.max(gy, b[1]!) + (q & 2 ? 1.9 : 0), b[2]! + (q & 4 ? 1 : -1), PJ)) (out[0] = Math.min(out[0]!, PJ[0]!)), (out[1] = Math.min(out[1]!, PJ[1]!)), (out[2] = Math.max(out[2]!, PJ[0]!)), (out[3] = Math.max(out[3]!, PJ[1]!));
        return out;
      },
      /** The pool against the world, as of now (the ride audit): [strays, strays on screen, outlines
       *  without their building, placed objects off their record, solids within `near` of the bike
       *  that are not placed, one item placed twice, buildings the bike is up against that are gone]. A stray is a pool object not placed
       *  whose parts would still draw (diorama's `hidden` hides only the object itself). */
      audit(near = 12) {
        const out = new Int32Array(7), x = bike.b.pos[0]!, z = bike.b.pos[2]!;
        for (let i = 0; i < OBJ.length; i++) {
          const o = OBJ[i]!, r = i * 9;
          if (!ON_[i]) {
            if (o.alpha > 0.01) {
              out[0] = out[0]! + 1;
              if (dio.project(o.pos[0]!, o.pos[1]!, o.pos[2]!, PJ) && PJ[0]! > 0 && PJ[1]! > 0 && PJ[0]! < dio.width && PJ[1]! < dio.height) out[1] = out[1]! + 1;
            }
            if (GH[i]! > 0.02) out[2] = out[2]! + 1;
            continue;
          }
          if (o.hidden || Math.abs(o.pos[0]! - OI[r]!) > 1e-6 || Math.abs(o.pos[2]! - OI[r + 1]!) > 1e-6 || (OI[r + 7]! < I_PROP && OI[r + 7] !== I_SILO && (Math.abs(o.size[0]! - OI[r + 4]!) > 1e-6 || Math.abs(o.size[2]! - OI[r + 5]!) > 1e-6))) out[3] = out[3]! + 1;
          for (let j = i + 1; j < OBJ.length; j++) if (ON_[j] && OI[j * 9 + 7] === OI[r + 7] && Math.abs(OI[j * 9]! - OI[r]!) < 1e-6 && Math.abs(OI[j * 9 + 1]! - OI[r + 1]!) < 1e-6) out[5] = out[5]! + 1;
          if (i < P0[I_PROP]! && GH[i]! > 1.05 && touching(i, x, z)) out[6] = out[6]! + 1;
        }
        const A = run.SG;
        for (let q = 0; q < run.sn; q++) {
          const o = q * IS, k = A[o]!, dx = A[o + 1]! - x, dz = A[o + 2]! - z;
          if (dx * dx + dz * dz > near * near) continue;
          if (!(k < I_PROP || k === I_CAR || k === I_FENCE || k === I_BENCH || k === I_TREE || k === I_PINE || k === I_ROCK || k === I_HAY || k === I_LAMP || k === I_SIGN || k === I_MAIL)) continue;
          let seen = false;
          for (let i = P0[k]!; i < P0[k + 1]! && !seen; i++) if (ON_[i] && OI[i * 9 + 8] === A[o + 9] && Math.abs(OI[i * 9]! - A[o + 1]!) < 1e-6 && Math.abs(OI[i * 9 + 1]! - A[o + 2]!) < 1e-6) seen = true;
          if (!seen) out[4] = out[4]! + 1;
        }
        return Array.from(out);
      },
      /** Each placed building in front of the eye, as last drawn: [key, its drawn height on screen (from
       *  the matrix it was drawn with), the height its world record gives at its depth (px)]. */
      heights() {
        const out: number[] = [];
        for (let i = 0; i < P0[I_PROP]!; i++) {
          const o = OBJ[i]!, r = i * 9, m = o.M, k = OI[r + 7]!;
          if (!ON_[i] || o.alpha < 0.05 || k === I_SILO) continue;
          if (!dio.project(m[9]!, m[10]!, m[11]!, PJ) || PJ[2]! < 2) continue;
          const y0 = PJ[1]!, x0 = PJ[0]!, z0 = PJ[2]!;
          if (x0 < 0 || x0 > dio.width || y0 < 0 || y0 > dio.height) continue;
          const h = o.size[1]!;
          if (!dio.project(m[9]! + m[1]! * h, m[10]! + m[4]! * h, m[11]! + m[7]! * h, PJ)) continue;
          const drawn = Math.hypot(PJ[0]! - x0, PJ[1]! - y0);
          // The record: at (x, z) on its ground, BH + 0.3 tall (0.3 sunk), seen at its depth.
          if (!dio.project(OI[r]!, o.pos[1]!, OI[r + 1]!, PJ)) continue;
          const yb = PJ[1]!, xb = PJ[0]!;
          if (!dio.project(OI[r]!, o.pos[1]! + BHv(k) + 0.3, OI[r + 1]!, PJ)) continue;
          out.push(OI[r + 8]!, drawn, Math.hypot(PJ[0]! - xb, PJ[1]! - yb));
        }
        return out;
      },
      /** Step the ride n times by dt without drawing (a long autopilot ride in a test), as the loop does. */
      tick(n: number, dt = 1 / 60) {
        for (let q = 0; q < n; q++) {
          if (auto) run.autopilot(I);
          run.step(dt, I[0]!, I[1]!, I[2]!, I[3]!, I[4]!, false, false);
          if (run.n) events();
          world();
          stepCam(dt);
          occlude(dt);
        }
        dirty = true;
      },
      /** Draw now with every pool object that is not placed forced out (alpha 0), then as it is: for the stray test. */
      bareStrays(on: number) {
        for (let i = 0; i < OBJ.length; i++) if (!ON_[i] && on) OBJ[i]!.alpha = 0;
        dio.draw();
        dirty = true;
      },
      /** Buildings ghosted now: [key, level ×100] pairs (level 1 ghosted, 2 gone). */
      ghosts() {
        const out: number[] = [];
        for (let i = 0; i < P0[I_PROP]!; i++) if (ON_[i] && GH[i]! > 0.01) out.push(OI[i * 9 + 8]!, Math.round(GH[i]! * 100));
        return out;
      },
      heat(v: number) {
        cop.heat(v);
        engine.wake();
        return cop.S[HEAT]!;
      },
      /** The tall buildings placed now (towers and flats: keys), nearest first, for scripting a ride past one. */
      towers() {
        const out: [number, number][] = [], x = bike.b.pos[0]!, z = bike.b.pos[2]!;
        for (let i = 0; i < P0[I_PROP]!; i++) if (ON_[i] && (OI[i * 9 + 7] === I_TOWER || OI[i * 9 + 7] === I_FLATS)) out.push([OI[i * 9 + 8]!, (OI[i * 9]! - x) ** 2 + (OI[i * 9 + 1]! - z) ** 2]);
        return out.sort((a, b) => a[1] - b[1]).map((a) => a[0]);
      },
      /** The world: the start town's junction, the nearest town to (x, z), a road point (edge i, j, dir at s). */
      node(i: number, j: number) { Wd.nodeQ(i, j); return [Wd.NQ[0]!, Wd.NQ[1]!, Wd.isTown(i, j) ? 1 : 0, Wd.isRound(i, j) ? 1 : 0]; },
      road(i: number, j: number, dir: number, s: number) { const e = Wd.edge(i, j, dir); if (e < 0) return null; Wd.at(e, Math.min(s, Wd.EF[e * 8 + 1]!)); return [Wd.PQ[0]!, Wd.PQ[1]!, Math.atan2(-Wd.PQ[3]!, Wd.PQ[2]!), Wd.EF[e * 8 + 1]!, Wd.EF[e * 8]!]; },
      /** Where on screen the point `across` units from road (i, j, dir)'s middle at s lands (on the
       *  ground the bike rides: the window's height there), as of the last draw: [x, y, depth], or null. */
      across(i: number, j: number, dir: number, s: number, across: number) {
        const e = Wd.edge(i, j, dir);
        if (e < 0) return null;
        Wd.at(e, s);
        const x = Wd.PQ[0]! - Wd.PQ[3]! * across, z = Wd.PQ[1]! + Wd.PQ[2]! * across;
        return dio.project(x, t.height(x, z), z, PJ) ? [PJ[0]!, PJ[1]!, PJ[2]!] : null;
      },

    },
  };
}

/** a → b by t, as "#rrggbb" (theme changes only). */
function mix(a: string, b: string, t: number) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  let o = 0;
  for (let s = 16; s >= 0; s -= 8) o |= Math.round(((A >> s) & 255) + (((B >> s) & 255) - ((A >> s) & 255)) * t) << s;
  return "#" + o.toString(16).padStart(6, "0");
}
