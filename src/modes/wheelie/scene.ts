// Wheelie City: four tabletop neighbourhoods to wheelie, on the player's own bike (from Fizlet's
// Wheelie City gallery piece). THE BLOCK (the suburb strip: houses with lawns and driveways, the flats
// and the corner store, the dog's yard), HILLCREST (cul-de-sacs and turning circles, houses perched on
// retaining walls under a ridge), DOWNTOWN (neon towers round a plaza with a fountain) and NEON MARINA
// (a boardwalk over the sand, beach shacks, palms, the sea): islands on the table with canals between
// them, linked by humps: hit one at speed and you fly into the next hood. Ninety seconds from the first
// touch of the gas: lift the front with the gas, balance it with your weight (stick or W/S), save it
// with the brake, and score wheelies and manuals (distance, time, and the time held at the balance
// point), hops and stoppies. A trick across a crosswalk, through a sprinkler or past a neighbour who
// came out to shake a fist pays a bonus. Too loud and the heat rises: the neon patrol (bikes, a cart, a
// drone, lights and a siren) comes after you; caught is a TICKET (the combo and half the points at
// risk); a hump loses them and pays. At night the curbs glow cyan and the windows warm, by day pastel.
// Bricks: the kernel, diorama, drive (`chase`), input, pad, sound. The town and the session are
// ./city.ts (the layouts ./hoods.ts, the patrol ./cops.ts), the scorer ./tricks.ts, all headless; the
// ride is ./ride.ts on the shared bike.
import { createEngine, seeded } from "@fzlt/core/kernel";
import { diorama, type DioramaObject, type DioramaObjectDef, type DioramaPoints } from "@fzlt/core/diorama";
import { chase } from "@fzlt/core/drive";
import { controls } from "@fzlt/core/input";
import { pad } from "@fzlt/core/pad";
import { sound } from "@fzlt/core/sound";
import {
  CARS, CAR_L, CAR_W, CROSS, DOG, DONE, E_AIR, E_BARK, E_BONUS, E_CRASH, E_END, E_GRUMP, E_HOP, E_RESPAWN, E_RESET, E_STUCK, E_SPLASH, E_START, E_TRICK,
  E_JUMP, E_LAND, E_TICKET, E_ESCAPE, E_STARS, E_UNIT, E_CLEAR, S_HOOD, S_FLY, S_JUMPS,
  FENCE, HOUSES, LAMPS, LINES, NCARS, NEIGH, NH, NN, NSP, READY, RUN, CRASH, SPRINK, SP_REACH, TREES, cityRun, height,
  CITY_SEED, PITCH, slotAt, slotKind,
} from "./city.ts";
import { HOODS, HOOD_NAMES, CX, CZ, HX, HZ, CURB, GAP, BANK, W, RAMP, DECK, LIP, HUMP_H, HUMP_W, K_PLAZA, K_BOARD, L_FLATS, L_STORE, L_TOWER, L_SHOP, L_SHACK, NHOOD } from "./hoods.ts";
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
// FX pools: dust and tyre smoke, sparks, sprinkler water (per sprinkler DROPS), splashes.
const DUST = 70, SPARK = 40, DROPS = 18, WATER = NSP * DROPS, SPLASH = 40;
const T_CARD = 1;
/** Endless: the haze (units from the bike: what stands up fades from HAZE0, gone at HAZE1; the ground under the fog band). */
const HAZE0 = 24, HAZE1 = 38;
/** Occlusion: a building in front of the bike fades to GHOST over OCC_T seconds. */
const GHOST = 0.16, OCC_T = 0.15;
/** Start hoods by map id (the RIDE menu starts on THE BLOCK; a harness can start elsewhere). */
const HOOD_IDS = HOODS.map((h) => h.id);

/** Endless Wheelie City: the four hoods as slots in a row, no clock, how far. (The fixed table's
 *  ninety-second Wheelie City is gone; its four hoods are what the row reuses.) */
export function mountCity(ctx: ModeCtx): ModeRun {
  const stage = modeStage(ctx.host, "wc");
  const engine = createEngine({ root: stage, settle: 0.5, seed: ctx.seed });
  const m = meter("endcity");
  // The one ride: the player's bike, tuned (its balance window and hop from tune()).
  const SPEC: RideSpec = { id: ctx.bike.model.id, name: ctx.bike.model.name, kind: ctx.bike.power.name, blurb: "", bars: [3, 3, 3], power: ctx.bike.power, shape: ctx.bike.shape, sweet: ctx.bike.sweet, hop: ctx.bike.hop };
  const L = engine.ledger, sig = { signal: engine.signal };
  let P: Pal = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;
  const startHood = Math.max(0, HOOD_IDS.indexOf(ctx.map ?? "")), best = ctx.best ?? 0;

  // ---- the page: the canvas, the play surface (pointer + keyboard focus), the stickers, the cards, the pad ----
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "wc-play";
  play.setAttribute("aria-label", "Wheelie City: Space or J for gas, K or Shift to brake, W and S (or up and down) lean forward and back, A and D (or left and right) steer, L hops. V changes the view, M mutes, P or Escape pauses");
  const hud = L.add(document.createElement("div"));
  hud.className = "wc-hud";
  hud.innerHTML = `<div class="wc-head"><p class="wc-top"><b class="wc-chip wc-time"><span>1:30</span></b><b class="wc-chip wc-score"><span>0</span><i>×1</i></b><b class="wc-chip wc-heat" hidden aria-label="Heat"><span></span><i hidden></i></b><b class="wc-chip wc-trick" hidden><span></span></b></p><p class="wc-hint"></p></div><p class="wc-toast" hidden></p><div class="wc-ticket" hidden><b>TICKET!</b><p>NEON PATROL · NOISE NOTICE</p><p class="wc-tline"></p></div><p class="wc-live" aria-live="polite"></p><p class="wc-keys"><button type="button" class="wc-key wc-end" aria-label="End the ride and bank it (E)">END</button><button type="button" class="wc-key wc-reset" aria-label="Reset to the last good spot (R)">↺</button><button type="button" class="wc-key wc-view" aria-label="Camera view (V)">VIEW</button><button type="button" class="wc-key wc-mute" aria-label="Mute (M)" aria-pressed="true">♪</button><button type="button" class="wc-key wc-menu" aria-label="Pause (P)">❚❚</button></p>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement;
  const toastEl = hud.children[1] as HTMLElement, ticketEl = hud.children[2] as HTMLElement, live = hud.children[3] as HTMLElement, keysEl = hud.children[4] as HTMLElement;
  const timeEl = top.children[0]!.firstChild as HTMLElement, scoreEl = top.children[1]!.firstChild as HTMLElement, comboEl = top.children[1]!.lastChild as HTMLElement;
  const heatChip = top.children[2] as HTMLElement, heatEl = heatChip.firstChild as HTMLElement, riskEl = heatChip.lastChild as HTMLElement;
  const trickChip = top.children[3] as HTMLElement, trickEl = trickChip.firstChild as HTMLElement;
  const tlineEl = ticketEl.lastChild as HTMLElement;
  const viewK = keysEl.querySelector(".wc-view") as HTMLButtonElement, muteK = keysEl.querySelector(".wc-mute") as HTMLButtonElement;
  // Unstuck: the prompt sticker.
  const stuckEl = document.createElement("p");
  stuckEl.className = "wc-stuck";
  stuckEl.hidden = true;
  stuckEl.textContent = "STUCK? Hold R / tap ↺ to reset";
  hud.append(stuckEl);
  let resetQ = 0;
  stage.append(canvas, play, hud);
  if (ctx.attract) hud.hidden = true;
  const snd = sound(engine, {
    cues: { start: "ready", trick: "power", hop: "click", crash: "boom", respawn: "ready", grump: "hurt", bark: "bark", splash: "splash", bonus: "click", end: "win", siren: "siren", ticket: "ticket", escape: "win", jump: "jump" },
    notes: {
      bark: [[520, 300, 0.07, 0, "square", 0.08], [560, 320, 0.07, 0.11, "square", 0.07]],
      splash: [[1800, 700, 0.12, 0, "sine", 0.05]],
      // The patrol's two-tone (a comic whoop, not a real siren), the ticket's stamp, the hump.
      siren: [[620, 940, 0.3, 0, "triangle", 0.045], [940, 620, 0.3, 0.32, "triangle", 0.045]],
      ticket: [[330, 330, 0.08, 0, "square", 0.08], [247, 247, 0.16, 0.1, "square", 0.08]],
      jump: [[300, 900, 0.22, 0, "sawtooth", 0.04]],
    },
    volume: 0.1,
    on: ctx.sound && !ctx.attract,
  });
  const c = controls(engine, { keys: { left: [], right: [], fwd: [], back: [], gas: [], brake: [], hop: [], reset: [] }, target: play });
  const GAS = c.id("gas"), BRAKE = c.id("brake"), HOPK = c.id("hop"), RESETK = c.id("reset");
  const ICON_GAS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor"/></svg>';
  const ICON_BRAKE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>';
  const ICON_HOP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 5 12h4v6h6v-6h4z" fill="currentColor"/></svg>';
  const thePad = pad(engine, c, {
    scheme: "stick",
    actions: [
      { intent: "gas", label: "", icon: ICON_GAS, name: "Gas (Space or J)", key: "J", role: "go", hold: true },
      { intent: "brake", label: "", icon: ICON_BRAKE, name: "Brake (K)", key: "K", role: "attack", hold: true },
      { intent: "hop", label: "", icon: ICON_HOP, name: "Hop (L)", key: "L", role: "aim" },
    ],
    host: stage,
  });
  thePad.el.classList.add("wc-pad");
  if (ctx.attract) thePad.el.hidden = true;
  // The motor's whine (../../bike/kit.ts): nothing is made until a gesture.
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
  const run = cityRun([SPEC], ctx.seed >>> 0 || 1, true, CITY_SEED), bike = run.bike, S = run.S, sc = run.sc.S, cop = run.cop, hgt = run.town.height;
  // Endless: each hood kind is built once at its fixed-table place and moved to the slot it shows in
  // (VO: its move, x and z per kind: what the per-frame drawing adds to the world lists).
  const VO = new Float64Array(8);
  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => P.sky2, overlay: drawOverlay, get shadowColor() { return P.shadow; }, maxVerts: 196608, maxFaces: 16384 });
  const rigs: Rig[] = [];
  const nbs: DioramaObject[] = [], arms: DioramaObject[] = [], sprHeads: DioramaObject[] = [];
  /** Per hood: its root objects (shown or hidden as the rider nears it), and those not on the ground (faded by distance, endless). */
  const HR: DioramaObject[][] = [[], [], [], []], UP: DioramaObject[][] = [[], [], [], []];
  /** Each hood's humps (world, on the fixed table): x, z, dir x, dir z (endless: both ends of the south street). */
  const HL: number[][] = [[], [], [], []];
  for (let k = 0; k < NHOOD; k++) {
    const U = run.town.HU[k]!;
    for (let o = 0; o < U.length; o += 5) HL[k]!.push(U[o + 1]! + CX[k]!, U[o + 2]! + CZ[k]!, U[o + 3]!, U[o + 4]!);
  }
  // Patrol units: per slot the group and each kind's group, and the two lights of each kind.
  const units: DioramaObject[] = [], kinds: DioramaObject[] = [], lites: DioramaObject[] = [];
  let dog: DioramaObject, dogTail: DioramaObject, dust: Pool, spark: Pool, water: DioramaPoints, splash: Pool;
  const rnd = seeded(ctx.seed);
  let sky: CanvasGradient | null = null;
  const STARS_BG = new Float32Array(90);
  for (let i = 0; i < 90; i++) STARS_BG[i] = rnd();
  // Bubble text widths, measured when a bubble appears (never in a frame): per neighbour, the dog.
  const BW = new Float64Array(NN + 1);
  /** Which hoods are drawn (bits), and each sprinkler's and neighbour's hood. */
  let vis = 0;
  const SPH = new Uint8Array(NSP), NBH = new Uint8Array(NN);
  for (let i = 0; i < NSP; i++) SPH[i] = (SPRINK[i * 4 + 1]! < 0 ? 0 : 2) + (SPRINK[i * 4]! < 0 ? 0 : 1);
  for (let i = 0; i < NN; i++) NBH[i] = W.hood[NEIGH[i * 8]!]!;
  /** The corner store's building (THE BLOCK's sign). */
  const STORE = (() => { for (let h = 0; h < NH; h++) if (HOUSES[h * 8 + 6] === L_STORE) return h; return 0; })();

  function buildScene() {
    dio.clear();
    rigs.length = nbs.length = arms.length = sprHeads.length = units.length = kinds.length = lites.length = 0;
    for (const a of HR) a.length = 0;
    for (const a of UP) a.length = 0;
    VO.fill(0);
    dio.setLight(P.light, P.amb);
    dio.cluster("sky", { fixed: -10 });
    dio.cluster("ground", { fixed: -5 });
    dio.decal("sky", 0, paintSky);
    let hk = -1;
    const keep = (o: DioramaObject, flat = false) => (hk >= 0 && (HR[hk]!.push(o), flat || UP[hk]!.push(o)), o);
    const add = (d: DioramaObjectDef) => (d.on ? dio.add(d) : keep(dio.add(d), d.cluster === "ground"));
    const G = (size: number[], pos: number[], color: string, layer: number, emissive = false) => keep(dio.add({ size, pos, color, cluster: "ground", layer, emissive, pick: false }), true);
    for (let k = 0; k < NHOOD; k++) {
      hk = k;
      const hd = HOODS[k]!, cx = CX[k]!, cz = CZ[k]!, [lawn, walk, road] = P.hood[k]!;
      // The island's water: half the canal each side along the row, a wide band to the north and south (in tiles).
      const ax = HX + GAP / 2, az = HZ + 40;
      for (let x = -ax; x < ax - 0.01; x += 10.6) for (let z = -az; z < az - 0.01; z += 9) {
        const x1 = Math.min(ax, x + 10.6), z1 = Math.min(az, z + 9);
        if (x > -HX - BANK && x1 < HX + BANK && z > -HZ - BANK && z1 < HZ + BANK) continue;
        G([x1 - x, 0.02, z1 - z], [cx + (x + x1) / 2, -0.55, cz + (z + z1) / 2], P.canal, 2.5);
      }
      // The island: its wall down to the water, the lawn on top; the blocks' sidewalks; the roads, circles, drives and surfaces.
      // (The island's wall in lengths, like the canal tiles; its top is the bank.)
      for (let a = -(HX + BANK); a < HX + BANK - 0.01; a += 7) for (const sz of [-1, 1]) G([Math.min(7, HX + BANK - a), CURB + 0.55, 0.1], [cx + a + Math.min(7, HX + BANK - a) / 2, -0.55, cz + sz * (HZ + BANK - 0.05)], P.isle, 3);
      for (let a = -(HZ + BANK); a < HZ + BANK - 0.01; a += 7) for (const sx of [-1, 1]) G([0.1, CURB + 0.55, Math.min(7, HZ + BANK - a)], [cx + sx * (HX + BANK - 0.05), -0.55, cz + a + Math.min(7, HZ + BANK - a) / 2], P.isle, 3);
      G([(HX + BANK) * 2, 0.01, (HZ + BANK) * 2], [cx, CURB - 0.01, cz], P.isle, 3);
      G([HX * 2, 0.01, HZ * 2], [cx, CURB, cz], lawn!, 3.2);
      const B = hd.blocks;
      for (let o = 0; o < B.length; o += 4) {
        const x0 = B[o]! + cx, z0 = B[o + 1]! + cz, x1 = B[o + 2]! + cx, z1 = B[o + 3]! + cz;
        for (const [a, b, cc, d] of [[x0, z0, x1, z0 + 1], [x0, z1 - 1, x1, z1], [x0, z0, x0 + 1, z1], [x1 - 1, z0, x1, z1]]) G([cc! - a!, CURB + 0.01, d! - b!], [(a! + cc!) / 2, 0, (b! + d!) / 2], walk!, 4);
      }
      // The outer sidewalks along the hood's edges.
      G([HX * 2, CURB + 0.01, 1.2], [cx, 0, cz - HZ + 2.9], walk!, 4); G([HX * 2, CURB + 0.01, 1.2], [cx, 0, cz + HZ - 2.9], walk!, 4);
      const R = [...hd.roads, HX - 2, 6.5, HX, 10.5, -HX, 6.5, -HX + 2, 10.5];
      for (let o = 0; o < R.length; o += 4) G([R[o + 2]! - R[o]!, 0.01, R[o + 3]! - R[o + 1]!], [(R[o]! + R[o + 2]!) / 2 + cx, -0.01, (R[o + 1]! + R[o + 3]!) / 2 + cz], road!, 5);
      for (let o = 0; o < hd.rings.length; o += 3) keep(dio.add({ shape: "cyl", sides: 18, size: [hd.rings[o + 2]! * 2, 0.01, hd.rings[o + 2]! * 2], pos: [hd.rings[o]! + cx, -0.01, hd.rings[o + 1]! + cz], color: road!, cluster: "ground", layer: 5, pick: false }));
      const F = hd.surf;
      for (let o = 0; o < F.length; o += 5) {
        const x0 = F[o]! + cx, z0 = F[o + 1]! + cz, x1 = F[o + 2]! + cx, z1 = F[o + 3]! + cz, kd = F[o + 4]!;
        G([x1 - x0, 0.012, z1 - z0], [(x0 + x1) / 2, -0.005, (z0 + z1) / 2], kd === K_PLAZA ? P.plaza : kd === K_BOARD ? P.board : P.sand, 5.5);
        if (kd === K_PLAZA) for (let x = x0 + 1.5; x < x1 - 0.5; x += 3) G([0.06, 0.012, z1 - z0], [x, 0, (z0 + z1) / 2], P.tile, 5.6);
        if (kd === K_BOARD) for (let z = z0 + 0.5; z < z1; z += 0.8) G([x1 - x0, 0.012, 0.07], [(x0 + x1) / 2, 0, z], P.plank, 5.6);
      }
      for (let o = 0; o < hd.drives.length; o += 4) {
        const D = hd.drives;
        G([D[o + 2]! - D[o]!, 0.03, D[o + 3]! - D[o + 1]!], [(D[o]! + D[o + 2]!) / 2 + cx, CURB, (D[o + 1]! + D[o + 3]!) / 2 + cz], P.drive, 6);
      }
      // Dashes down the middle of each street (not across another street, nor at a hump).
      for (let o = 0; o < R.length; o += 4) {
        const w = R[o + 2]! - R[o]!, d = R[o + 3]! - R[o + 1]!, along = w > d;
        if (Math.min(w, d) < 3.5 || Math.max(w, d) < 10) continue;
        const mx = (R[o]! + R[o + 2]!) / 2, mz = (R[o + 1]! + R[o + 3]!) / 2;
        for (let s = (along ? R[o]! : R[o + 1]!) + 1.6; s < (along ? R[o + 2]! : R[o + 3]!) - 1.2; s += 2.2) {
          const x = along ? s : mx, z = along ? mz : s;
          let cross = false;
          for (let q = 0; q < R.length && !cross; q += 4) if (q !== o && (R[q + 2]! - R[q]! > R[q + 3]! - R[q + 1]!) !== along && x > R[q]! - 0.6 && x < R[q + 2]! + 0.6 && z > R[q + 1]! - 0.6 && z < R[q + 3]! + 0.6) cross = true;
          for (let q = 0; q < F.length && !cross; q += 5) if (x > F[q]! && x < F[q + 2]! && z > F[q + 1]! && z < F[q + 3]!) cross = true;
          if (!cross) G(along ? [1, 0.01, 0.12] : [0.12, 0.01, 1], [x + cx, 0.002, z + cz], P.dash, 7, P.night);
        }
      }
      for (let o = 0; o < hd.bumps.length; o += 5) { const U = hd.bumps; keep(dio.add({ size: [U[o + 3]! * 1.4, U[o + 4]!, U[o + 2]! - U[o + 1]!], pos: [U[o]! + cx, 0, (U[o + 1]! + U[o + 2]!) / 2 + cz], color: P.bump, cluster: "ground", layer: 8, pick: false })); }
      for (let o = 0; o < hd.kicks.length; o += 5) { const K = hd.kicks; keep(dio.add({ shape: "wedge", size: [K[o + 3]! - K[o + 1]!, K[o + 4]!, K[o + 2]! - K[o]!], pos: [(K[o]! + K[o + 2]!) / 2 + cx, 0, (K[o + 1]! + K[o + 3]!) / 2 + cz], rot: [0, Math.PI / 2, 0], color: P.ply, cluster: "ground", layer: 8, pick: false })); }
      // Terraces (stone walls), water (the sea, the berths) and planters.
      const T = hd.terr;
      for (let o = 0; o < T.length; o += 6) {
        const x0 = T[o]! + cx, z0 = T[o + 1]! + cz, x1 = T[o + 2]! + cx, z1 = T[o + 3]! + cz, ht = T[o + 4]!, kd = T[o + 5]!;
        if (kd === 1) G([x1 - x0, 0.02, z1 - z0], [(x0 + x1) / 2, CURB - 0.06, (z0 + z1) / 2], P.sea, 4.5);
        else {
          const id = `tr${k}_${o}`;
          add({ id, size: [x1 - x0, ht, z1 - z0], pos: [(x0 + x1) / 2, CURB, (z0 + z1) / 2], color: kd === 2 ? P.stone2 : P.stone, pick: false });
          dio.add({ size: [x1 - x0 - 0.2, 0.04, z1 - z0 - 0.2], pos: [0, 0, 0], on: id, color: kd === 2 ? P.leaf[1]! : lawn!, pick: false });
          if (kd === 0) dio.add({ size: [x1 - x0 + 0.02, 0.06, 0.04], pos: [0, -0.1, (z1 - z0) / 2], on: id, color: P.trim, emissive: P.night, pick: false });
          if (kd === 2) dio.add({ shape: "cyl", sides: 7, top: 0, size: [1.1, 1.2, 1.1], pos: [0, 0, 0], on: id, color: P.leaf[0]!, pick: false });
        }
      }
      // The fountain, the lifeguard towers.
      for (let o = 0; o < hd.posts.length; o += 4) {
        const Pp = hd.posts, x = Pp[o]! + cx, z = Pp[o + 1]! + cz, r = Pp[o + 2]!, id = `po${k}_${o}`;
        if (Pp[o + 3] === 0) {
          add({ id, shape: "cyl", sides: 16, size: [r * 2, 0.45, r * 2], pos: [x, 0, z], color: P.stone, pick: false });
          dio.add({ shape: "cyl", sides: 16, size: [r * 1.7, 0.03, r * 1.7], pos: [0, -0.06, 0], on: id, color: P.fountain, emissive: true, pick: false });
          dio.add({ shape: "cyl", sides: 8, size: [0.5, 0.9, 0.5], pos: [0, 0, 0], on: id, color: P.stone2, pick: false });
          dio.add({ shape: "cyl", sides: 8, top: 0.2, size: [0.9, 0.5, 0.9], pos: [0, 0.9, 0], on: id, color: P.fountain, emissive: P.night, pick: false });
        } else {
          add({ id, size: [0.9, 1.2, 0.9], pos: [x, 0, z], color: P.trunk, pick: false, mask: 3 });
          for (const lx of [-0.4, 0.4]) for (const lz of [-0.4, 0.4]) dio.add({ size: [0.08, 1.2, 0.08], pos: [lx, -1.2, lz], on: id, color: P.paper, pick: false });
          dio.add({ size: [1.0, 0.7, 1.0], pos: [0, 0, 0], on: id, color: P.awning[0]!, pick: false });
          dio.add({ shape: "wedge", size: [1.2, 0.3, 1.2], pos: [0, 0.7, 0], color: P.paper, on: id, pick: false });
        }
      }
      // The humps: a ramp, the deck to the lip, neon chevrons, a gantry over it.
      for (let i = 0; i < HL[k]!.length / 4; i++) {
        const lx = HL[k]![i * 4]!, lz = HL[k]![i * 4 + 1]!, dx = HL[k]![i * 4 + 2]!, dz = HL[k]![i * 4 + 3]!, rot = dx > 0.5 ? Math.PI : dx < -0.5 ? 0 : dz > 0 ? Math.PI / 2 : -Math.PI / 2;
        const rc = RAMP / 2 + DECK, dl = DECK + LIP + BANK, dc = (LIP + BANK - DECK) / 2;
        keep(dio.add({ shape: "wedge", size: [RAMP, HUMP_H, HUMP_W * 2], pos: [lx - dx * rc, 0, lz - dz * rc], rot: [0, rot, 0], color: P.hump, cluster: "ground", layer: 8, pick: false }));
        keep(dio.add({ size: dx ? [dl, HUMP_H, HUMP_W * 2] : [HUMP_W * 2, HUMP_H, dl], pos: [lx + dx * dc, 0, lz + dz * dc], color: P.deck, cluster: "ground", layer: 8, pick: false }));
        for (let s = 0; s < 3; s++) {
          const u = -(RAMP + DECK) + 0.5 + s * 0.85, ht = (HUMP_H * (u + RAMP + DECK)) / RAMP + 0.01;
          keep(dio.add({ size: dx ? [0.18, 0.01, HUMP_W * 1.4] : [HUMP_W * 1.4, 0.01, 0.18], pos: [lx + dx * u, ht, lz + dz * u], color: P.chev, emissive: true, cluster: "ground", layer: 8.5, pick: false }));
        }
        // (The gantry stands over the foot of the ramp, well clear of a flight.)
        const gid = `gy${k}_${i}`, gx = lx - dx * (RAMP + DECK + 0.4), gz = lz - dz * (RAMP + DECK + 0.4);
        for (const sd of [-1, 1]) keep(dio.add({ id: gid + sd, size: [0.16, 3.2, 0.16], pos: [gx + dz * sd * (HUMP_W + 0.4), CURB, gz + dx * sd * (HUMP_W + 0.4)], color: P.pole, pick: false }));
        keep(dio.add({ size: dx ? [0.16, 0.36, HUMP_W * 2 + 0.96] : [HUMP_W * 2 + 0.96, 0.36, 0.16], pos: [gx, CURB + 3.2, gz], color: P.hump, emissive: true, pick: false }));
      }
      // The fence round the island (a gap at each hump).
      fence(k);
    }
    hk = -1;
    // Crosswalks.
    for (let o = 0; o < CROSS.length; o += 4) {
      hk = (CROSS[o + 1]! < 0 ? 0 : 2) + (CROSS[o]! < 0 ? 0 : 1);
      const x0 = CROSS[o]!, z0 = CROSS[o + 1]!, x1 = CROSS[o + 2]!, z1 = CROSS[o + 3]!, along = x1 - x0 > z1 - z0;
      for (let q = 0; q < 6; q++) {
        const u = (q + 0.5) / 6;
        if (along) G([(x1 - x0) / 10, 0.01, z1 - z0], [x0 + (x1 - x0) * u, 0.003, (z0 + z1) / 2], P.zebra, 7);
        else G([x1 - x0, 0.01, (z1 - z0) / 10], [(x0 + x1) / 2, 0.003, z0 + (z1 - z0) * u], P.zebra, 7);
      }
    }
    hk = -1;
    dio.decal("ground", 9, paintLines);
    dio.decal("ground", 9.5, paintShadow);
    dio.decal("ground", 9.8, paintFog);
    buildings();
    // Parked cars: body, cabin, glass, wheels, lights.
    for (let q = 0; q < NCARS; q++) {
      const o = q * 4, id = "car" + q, col = P.cars[CARS[o + 3]!]!;
      hk = (CARS[o + 1]! < 0 ? 0 : 2) + (CARS[o]! < 0 ? 0 : 1);
      add({ id, shape: "group", size: [CAR_L, 0, CAR_W], pos: [CARS[o]!, height(CARS[o]!, CARS[o + 1]!) > 0.06 ? CURB : 0, CARS[o + 1]!], rot: [0, CARS[o + 2]!, 0], pick: false });
      const p = (size: number[], pos: number[], color: string, o2: { shape?: "box" | "wedge" | "cyl"; rot?: number[]; emissive?: boolean; sides?: number } = {}) => dio.add({ shape: o2.shape || "box", size, pos, rot: o2.rot, sides: o2.sides, on: id, color, emissive: o2.emissive, pick: false });
      p([CAR_L, 0.42, CAR_W], [0, 0.16, 0], col);
      p([CAR_L * 0.5, 0.36, CAR_W * 0.86], [-0.15, 0.58, 0], col);
      p([CAR_L * 0.5 + 0.02, 0.24, CAR_W * 0.88], [-0.15, 0.64, 0], P.glass);
      for (const wx of [-0.72, 0.72]) for (const wz of [-0.48, 0.48]) p([0.4, 0.16, 0.4], [wx, 0.2, wz], P.tyre, { shape: "cyl", sides: 10, rot: [Math.PI / 2, 0, 0] });
      for (const wz of [-0.35, 0.35]) p([0.04, 0.1, 0.2], [CAR_L / 2, 0.42, wz], P.head, { emissive: true }), p([0.04, 0.1, 0.2], [-CAR_L / 2, 0.42, wz], P.tail, { emissive: true });
    }
    // Trees (round in the suburb, pines on the hill, planted downtown, palms by the sea) and streetlights.
    for (let q = 0; q < TREES.length; q += 2) {
      const id = "t" + q, s = 0.85 + ((q * 7) % 5) * 0.08, x = TREES[q]!, z = TREES[q + 1]!;
      hk = W.treeHood[q / 2]!;
      const y = height(x, z) > 0.06 ? CURB : 0;
      if (hk === 1) {
        add({ id, shape: "cyl", sides: 6, size: [0.2, 0.5 * s, 0.2], pos: [x, y, z], color: P.trunk, pick: false });
        for (let t = 0; t < 3; t++) dio.add({ shape: "cyl", sides: 7, top: 0, size: [(1.4 - t * 0.35) * s, 0.9 * s, (1.4 - t * 0.35) * s], pos: [0, -0.1 + t * 0.55 * s, 0], on: id, color: P.pine[t & 1]!, pick: false });
      } else if (hk === 3) {
        add({ id, shape: "cyl", sides: 6, top: 0.7, size: [0.2, 2.1 * s, 0.2], pos: [x, y, z], rot: [0, 0, 0.12], color: P.trunk, pick: false });
        for (let t = 0; t < 5; t++) dio.add({ size: [1.3 * s, 0.05, 0.32], pos: [0, -0.05, 0], rot: [0, (t * TAU) / 5, -0.35], on: id, color: P.palm[t & 1]!, pick: false });
      } else if (hk === 2) {
        add({ id, size: [0.7, 0.35, 0.7], pos: [x, y, z], color: P.stone, pick: false });
        dio.add({ shape: "cyl", sides: 7, top: 0, size: [1.0, 1.4, 1.0], pos: [0, 0, 0], on: id, color: P.leaf[q % 3]!, pick: false });
      } else {
        add({ id, shape: "cyl", sides: 6, size: [0.24, 0.7 * s, 0.24], pos: [x, y, z], color: P.trunk, pick: false });
        dio.add({ shape: "cyl", sides: 7, top: 0, size: [1.5 * s, 1.5 * s, 1.5 * s], pos: [0, -0.05, 0], on: id, color: P.leaf[q % 3]!, pick: false });
        dio.add({ shape: "cyl", sides: 7, top: 0, size: [1.1 * s, 1.1 * s, 1.1 * s], pos: [0, -0.6 * s, 0], on: id, color: P.leaf[(q + 1) % 3]!, pick: false });
      }
    }
    for (let q = 0; q < LAMPS.length; q += 2) {
      const id = "l" + q;
      hk = W.lampHood[q / 2]!;
      add({ id, shape: "cyl", sides: 6, size: [0.12, 2.6, 0.12], pos: [LAMPS[q]!, height(LAMPS[q]!, LAMPS[q + 1]!) > 0.06 ? CURB : 0, LAMPS[q + 1]!], color: P.pole, pick: false });
      dio.add({ shape: "cyl", sides: 6, size: [0.36, 0.14, 0.36], pos: [0, 0, 0], on: id, color: P.lampOn, emissive: true, pick: false });
    }
    dio.decal("ground", 9.2, paintPools);
    // The dog's fence and the dog (THE BLOCK).
    hk = 0;
    const fh = 0.5, fx0 = FENCE[0]!, fz0 = FENCE[1]!, fx1 = FENCE[2]!, fz1 = FENCE[3]!;
    for (let x = fx0; x <= fx1 + 0.01; x += 0.4) add({ size: [0.08, fh, 0.08], pos: [x, CURB, fz1], color: P.paper, pick: false });
    for (let z = fz0 + 0.4; z < fz1; z += 0.4) for (const x of [fx0, fx1]) add({ size: [0.08, fh, 0.08], pos: [x, CURB, z], color: P.paper, pick: false });
    add({ size: [fx1 - fx0, 0.06, 0.06], pos: [(fx0 + fx1) / 2, CURB + fh - 0.12, fz1], color: P.paper, pick: false });
    dog = add({ id: "dog", shape: "group", size: [0.6, 0, 0.3], pos: [run.DG[0]!, CURB, DOG[2]!], pick: false });
    dio.add({ size: [0.56, 0.26, 0.26], pos: [0, 0.18, 0], on: "dog", color: P.dog, pick: false });
    for (const lx of [-0.2, 0.2]) for (const lz of [-0.09, 0.09]) dio.add({ size: [0.07, 0.2, 0.07], pos: [lx, 0, lz], on: "dog", color: P.dog2, pick: false });
    dio.add({ size: [0.26, 0.24, 0.24], pos: [0.36, 0.3, 0], on: "dog", color: P.dog, pick: false });
    dio.add({ size: [0.12, 0.1, 0.16], pos: [0.52, 0.34, 0], on: "dog", color: P.dog2, pick: false });
    for (const ez of [-0.09, 0.09]) dio.add({ size: [0.06, 0.12, 0.08], pos: [0.32, 0.54, ez], on: "dog", color: P.dog2, pick: false });
    dogTail = dio.add({ size: [0.24, 0.06, 0.06], pos: [-0.36, 0.38, 0], rot: [0, 0, 0.7], on: "dog", color: P.dog2, pick: false });
    // Sprinkler heads (the showers on the sand).
    for (let i = 0; i < NSP; i++) {
      hk = SPH[i]!;
      sprHeads.push(add({ shape: "cyl", sides: 6, size: [0.16, hk === 3 ? 1.6 : 0.14, 0.16], pos: [SPRINK[i * 4]!, height(SPRINK[i * 4]!, SPRINK[i * 4 + 1]!) > 0.06 ? CURB : 0, SPRINK[i * 4 + 1]!], color: P.hub, pick: false }));
    }
    // Neighbours: a body, legs, a head (hair or a hat), one arm up with a fist that shakes.
    for (let i = 0; i < NN; i++) {
      const id = "nb" + i, look = i % 7;
      hk = NBH[i]!;
      const nb = add({ id, shape: "group", size: [0.4, 0, 0.3], pos: [NEIGH[i * 8 + 1]!, CURB, NEIGH[i * 8 + 2]!], rot: [0, NEIGH[i * 8 + 3]! < 0 ? Math.PI / 2 : -Math.PI / 2, 0], alpha: 0, pick: false });
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
    hk = -1;
    patrols();
    // The ride: the player's bike and rider (../../bike/rig.ts), in the profile's colours.
    rigs.push(rig(dio, "bike0", { ...P.kit, ...ctx.look }, ctx.bike.rig, ctx.helmet));
    dust = pool(dio, DUST, P.smoke, 4);
    spark = pool(dio, SPARK, P.spark, 6);
    water = dio.points({ cap: WATER, color: P.water, layer: 6 });
    splash = pool(dio, SPLASH, P.water, 6);
    sky = null;
    vis = 0;
    show();
    pose();
    function fence(k: number) {
      // Rails on posts along the island's four edges, broken by the humps.
      const cx = CX[k]!, cz = CZ[k]!, rail = (x0: number, z0: number, x1: number, z1: number) => {
        const len = Math.hypot(x1 - x0, z1 - z0);
        if (len < 0.3) return;
        keep(dio.add({ size: x1 - x0 > z1 - z0 ? [len, 0.08, 0.08] : [0.08, 0.08, len], pos: [(x0 + x1) / 2, CURB + 0.45, (z0 + z1) / 2], color: P.line, emissive: P.night, pick: false }));
      };
      const gaps = (ax: number, x0: number, x1: number, fixed: number) => {
        // Along axis ax (0: x), from x0 to x1 at the other coordinate `fixed`, with the humps' bands cut out.
        let a = x0;
        for (let i = 0; i < HL[k]!.length / 4; i++) {
          const hx = HL[k]![i * 4]!, hz = HL[k]![i * 4 + 1]!, on = ax ? Math.abs(hx - fixed) < 1 : Math.abs(hz - fixed) < 1;
          if (!on) continue;
          const c0 = (ax ? hz : hx) - HUMP_W - 0.2, c1 = (ax ? hz : hx) + HUMP_W + 0.2;
          ax ? rail(fixed, a, fixed, c0) : rail(a, fixed, c0, fixed);
          a = c1;
        }
        ax ? rail(fixed, a, fixed, x1) : rail(a, fixed, x1, fixed);
      };
      const ex = HX + 0.05, ez = HZ + 0.05;
      gaps(0, cx - ex, cx + ex, cz - ez); gaps(0, cx - ex, cx + ex, cz + ez); gaps(1, cz - ez, cz + ez, cx - ex); gaps(1, cz - ez, cz + ez, cx + ex);
    }
    function buildings() {
      // Houses: walls, a roof (a prism ridge), windows, a door; the flats and the store; towers, shops, beach shacks; a stone terrace under a perched one.
      for (let h = 0; h < NH; h++) {
        const o = h * 8, x = HOUSES[o]!, z = HOUSES[o + 1]!, w = HOUSES[o + 2]!, d = HOUSES[o + 3]!, ht = HOUSES[o + 4]!, f = HOUSES[o + 5]!, look = HOUSES[o + 6]!, base = HOUSES[o + 7]!, id = "h" + h;
        hk = W.hood[h]!;
        let y = CURB;
        if (base > 0) {
          add({ id: id + "b", size: [w + 1.0, base, d + 0.9], pos: [x, CURB, z], color: P.stone, pick: false });
          dio.add({ size: [w + 0.9, 0.03, d + 0.8], pos: [0, 0, 0], on: id + "b", color: P.hood[hk]![0]!, pick: false });
          y += base;
        }
        const wall = look === L_TOWER ? P.tower[h % 4]! : look === L_SHACK ? P.shack[h % 3]! : P.walls[look % 6]!, roof = P.roofs[look % 6]!;
        HO[h] = add({ id, size: [w, ht, d], pos: [x, y, z], color: wall, pick: false });
        HB[h] = base > 0 ? dio.get(id + "b") ?? null : null;
        const fz = (f * d) / 2 + f * 0.01, part = (size: number[], pos: number[], color: string, emissive = false) => dio.add({ size, pos, color, on: id, emissive, pick: false, layer: 6 });
        if (look < 4) {
          for (const s2 of [-1, 1]) dio.add({ shape: "wedge", size: [d / 2 + 0.25, 0.85, w + 0.3], pos: [0, 0, s2 * (d / 4 + 0.06)], rot: [0, s2 < 0 ? Math.PI / 2 : -Math.PI / 2, 0], on: id, color: roof, pick: false, layer: 5 });
          part([0.56, 1.0, 0.04], [-0.5, -ht, fz], P.door);
          part([0.7, 0.5, 0.04], [0.7, -ht + 0.85, fz], P.win, P.night);
          part([0.5, 0.42, 0.04], [-0.5, -ht + 1.3, fz], P.win2, P.night);
          part([w + 0.02, 0.06, 0.04], [0, -0.06, fz], P.trim, P.night);
        } else if (look === L_FLATS) {
          part([w + 0.2, 0.14, d + 0.2], [0, 0, 0], P.roofs[4]!);
          for (let fl = 0; fl < 3; fl++) for (let q = 0; q < 4; q++) part([0.55, 0.6, 0.04], [-1.5 + q, -ht + 0.9 + fl * 1.15, fz], (fl + q) % 3 ? P.win : P.win2, P.night && (fl + q) % 4 !== 1);
          part([0.8, 0.8, 0.04], [0, -ht, fz], P.door);
        } else if (look === L_STORE) {
          part([w + 0.16, 0.12, d + 0.16], [0, 0, 0], P.roofs[5]!);
          part([2.0, 0.9, 0.04], [-0.5, -ht + 0.35, fz], P.win, P.night);
          part([0.6, 1.1, 0.04], [1.2, -ht, fz], P.door);
          for (let q = 0; q < 6; q++) dio.add({ size: [w / 6, 0.06, 0.8], pos: [-w / 2 + (q + 0.5) * (w / 6), -ht + 1.55, f * (d / 2 + 0.38)], rot: [f * -0.35, 0, 0], color: P.awning[q & 1]!, on: id, pick: false, layer: 7 });
          part([2.4, 0.42, 0.06], [0, -0.42, fz + f * 0.02], P.sign, true);
          dio.decal(id, 9, paintSign);
        } else if (look === L_TOWER) {
          // A tower: a band of lit windows a floor, a neon strip up one corner, a rim and a mast on the roof.
          const neon = P.neon[h % 4]!;
          for (let fl = 0.7; fl < ht - 0.6; fl += 1.05) part([w - 0.6, 0.34, 0.04], [0, -ht + fl, fz], ((fl * 3) | 0) % 3 ? P.win : P.win2, P.night);
          part([0.14, ht * 0.7, 0.14], [w / 2 - 0.1, -ht * 0.85, fz + f * 0.06], neon, true);
          part([w + 0.12, 0.16, d + 0.12], [0, 0, 0], P.roofs[4]!);
          dio.add({ shape: "cyl", sides: 5, size: [0.08, 1.2, 0.08], pos: [-w / 4, 0.16, 0], on: id, color: P.pole, pick: false });
          part([0.18, 0.18, 0.18], [-w / 4, 1.3, 0], neon, true);
          part([0.9, 0.7, 0.04], [0, -ht, fz], P.door);
        } else if (look === L_SHOP) {
          part([w + 0.14, 0.1, d + 0.14], [0, 0, 0], P.roofs[(h % 3) + 1]!);
          part([w - 1.0, 0.8, 0.04], [-0.3, -ht + 0.3, fz], P.win, P.night);
          part([0.55, 1.0, 0.04], [w / 2 - 0.45, -ht, fz], P.door);
          for (let q = 0; q < 5; q++) dio.add({ size: [w / 5, 0.05, 0.6], pos: [-w / 2 + (q + 0.5) * (w / 5), -ht + 1.3, f * (d / 2 + 0.28)], rot: [f * -0.35, 0, 0], color: P.awning[(q + h) & 1]!, on: id, pick: false, layer: 7 });
          part([w - 0.6, 0.26, 0.05], [0, -0.32, fz + f * 0.02], P.neon[h % 4]!, true);
        } else {
          // A beach shack: a lean-to roof, a hatch with its awning, a surfboard against the wall.
          dio.add({ shape: "wedge", size: [d + 0.3, 0.5, w + 0.3], pos: [0, 0, 0], rot: [0, f < 0 ? -Math.PI / 2 : Math.PI / 2, 0], on: id, color: roof, pick: false, layer: 5 });
          part([w - 1.0, 0.6, 0.04], [0, -ht + 0.7, fz], P.win, P.night);
          for (let q = 0; q < 4; q++) dio.add({ size: [(w - 0.8) / 4, 0.05, 0.6], pos: [-(w - 0.8) / 2 + (q + 0.5) * ((w - 0.8) / 4), -ht + 1.36, f * (d / 2 + 0.28)], rot: [f * -0.4, 0, 0], color: P.awning[q & 1]!, on: id, pick: false, layer: 7 });
          dio.add({ size: [0.36, 1.4, 0.06], pos: [w / 2 + 0.12, -ht, f * (d / 2 - 0.3)], rot: [0, 0, -0.18], on: id, color: P.neon[(h + 1) % 4]!, pick: false });
        }
      }
      hk = -1;
    }
    function patrols() {
      // The neon patrol: per slot a bike, a cart and a drone (one shown), each with a light bar (two lamps).
      for (let i = 0; i < MAXP; i++) {
        const id = "pu" + i;
        units.push(dio.add({ id, shape: "group", size: [1, 0, 0.5], pos: [0, 0, 0], alpha: 0, pick: false }));
        for (let kd = 0; kd < 3; kd++) {
          const kid = `${id}k${kd}`;
          kinds.push(dio.add({ id: kid, shape: "group", size: [1, 0, 0.5], pos: [0, 0, 0], on: id, alpha: 0, pick: false }));
          const p = (size: number[], pos: number[], color: string, o2: { shape?: "box" | "cyl" | "wedge"; rot?: number[]; emissive?: boolean; sides?: number } = {}) => dio.add({ shape: o2.shape || "box", size, pos, rot: o2.rot, sides: o2.sides, on: kid, color, emissive: o2.emissive, pick: false });
          let lh = 0;
          if (kd === 0) {
            // A patrol bike: two wheels, a white body with a dark stripe, a rider in a white helmet.
            for (const wx of [-0.55, 0.55]) p([0.56, 0.14, 0.56], [wx, 0.0, 0], P.tyre, { shape: "cyl", sides: 10, rot: [Math.PI / 2, 0, 0] });
            p([1.1, 0.34, 0.32], [0, 0.26, 0], P.unit); p([1.12, 0.08, 0.34], [0, 0.42, 0], P.unit2);
            p([0.3, 0.5, 0.36], [-0.12, 0.6, 0], P.unit2); p([0.3, 0.28, 0.3], [-0.08, 1.1, 0], P.unit);
            lh = 1.2;
          } else if (kd === U_CART) {
            // A patrol cart: a low body, a roof on posts, the light bar on top.
            for (const wx of [-0.6, 0.6]) for (const wz of [-0.42, 0.42]) p([0.34, 0.14, 0.34], [wx, 0.0, wz], P.tyre, { shape: "cyl", sides: 10, rot: [Math.PI / 2, 0, 0] });
            p([1.6, 0.4, 0.9], [0, 0.14, 0], P.unit); p([1.62, 0.1, 0.92], [0, 0.34, 0], P.unit2);
            for (const wx of [-0.7, 0.55]) for (const wz of [-0.4, 0.4]) p([0.06, 0.7, 0.06], [wx, 0.54, wz], P.pole);
            p([1.6, 0.06, 1.0], [-0.08, 1.24, 0], P.unit);
            lh = 1.3;
          } else {
            // A patrol drone: a flat body, four rotors, the lights underneath.
            p([0.7, 0.18, 0.7], [0, 0, 0], P.unit); p([0.72, 0.05, 0.72], [0, 0.18, 0], P.unit2);
            for (const rx of [-0.5, 0.5]) for (const rz of [-0.5, 0.5]) p([0.5, 0.03, 0.5], [rx, 0.14, rz], P.pole, { shape: "cyl", sides: 8 });
            // Its neon: a ring round the body and an eye at the front (a cyber cop, not a weapon).
            p([1.0, 0.04, 1.0], [0, 0.09, 0], P.neon[1]!, { shape: "cyl", sides: 8, emissive: true });
            p([0.12, 0.1, 0.3], [0.38, 0.02, 0], P.neon[0]!, { emissive: true });
            lh = -0.1;
          }
          for (const s of [-1, 1]) lites.push(p([0.26, 0.12, 0.22], [kd === 2 ? 0 : -0.15, lh, s * 0.16], P.lite[(s + 1) >> 1]!, { emissive: true }));
        }
      }
    }
  }
  /** Draw only the hoods the rider is in or near (their objects' alpha), and the patrol's slots. */
  function show() {
    const d = bike.b, x = d.pos[0]!, z = d.pos[2]!;
    let v = 0;
    // The slot the bike is over, and the one it nears (never the same kind: one built hood each).
    const k = slotAt(x), lx = x - k * PITCH, j = k + (lx > 0 ? 1 : -1), a = slotKind(k), b = slotKind(j);
    moveHood(a, k);
    v |= 1 << a;
    if ((lx < 0 ? -lx : lx) > HX - 34) moveHood(b, j), (v |= 1 << b);
    fade(x, z, v);
    if (v === vis) return;
    vis = v;
    for (let k = 0; k < NHOOD; k++) {
      const a = v & (1 << k) ? 1 : 0, R = HR[k]!;
      for (let i = 0; i < R.length; i++) if (R[i]!.on === null && R[i]!.alpha !== a && !(R[i]!.id ?? "").startsWith("nb")) R[i]!.alpha = a;
    }
    dirty = true;
  }
  /** Endless: hood kind h to slot k (every root it built moves by the difference). */
  function moveHood(h: number, k: number) {
    const tx = k * PITCH - CX[h]!, tz = -CZ[h]!, dx = tx - VO[h * 2]!, dz = tz - VO[h * 2 + 1]!;
    if (!dx && !dz) return;
    VO[h * 2] = tx; VO[h * 2 + 1] = tz;
    const R = HR[h]!;
    for (let i = 0; i < R.length; i++) {
      const o = R[i]!;
      if (o.on !== null) continue;
      o.pos[0] = o.pos[0]! + dx; o.pos[2] = o.pos[2]! + dz;
    }
    dirty = true;
  }
  /** Endless: what stands up off the ground fades out into the haze (HAZE0 .. HAZE1 from the bike). */
  function fade(x: number, z: number, v: number) {
    for (let h = 0; h < NHOOD; h++) {
      if (!(v & (1 << h))) continue;
      const R = UP[h]!;
      for (let i = 0; i < R.length; i++) {
        const o = R[i]!;
        if ((o.id ?? "").startsWith("nb")) continue;
        const dx = o.pos[0]! - x, dz = o.pos[2]! - z, dd = Math.sqrt(dx * dx + dz * dz);
        o.alpha = dd < HAZE0 ? 1 : dd > HAZE1 ? 0 : 1 - (dd - HAZE0) / (HAZE1 - HAZE0);
      }
    }
  }
  // ---- occlusion: a building between the chase camera and the bike is ghosted ----
  // The standard chase-camera pattern: each step, rays from the camera's eye to five points on the
  // rider's silhouette (low, high, either side, the head) are tested against the boxes of the
  // buildings in the hoods drawn (the broadphase: only those two slots, then a box-vs-box reject).
  // A building a ray passes through fades to GHOST (and is outlined); one the eye is inside, or nearly
  // touching, fades out completely. Fades take OCC_T seconds (reduced motion: at once). Render only:
  // the run never reads it; no allocation (fixed arrays).
  const HO: (DioramaObject | null)[] = new Array(NH).fill(null), HB: (DioramaObject | null)[] = new Array(NH).fill(null);
  /** Per house: its ghost level now (0 solid, 1 ghosted, 2 gone) and the level it is heading for. */
  const GH = new Float64Array(NH), GT = new Uint8Array(NH);
  /** Per hood kind: its houses. */
  const HIX: Int32Array[] = [];
  for (let k = 0; k < NHOOD; k++) {
    let n = 0;
    for (let h = 0; h < NH; h++) if (W.hood[h] === k) n++;
    const a = new Int32Array(n);
    n = 0;
    for (let h = 0; h < NH; h++) if (W.hood[h] === k) a[n++] = h;
    HIX.push(a);
  }
  /** The eye, then the five silhouette points (x, y, z each). */
  const OP = new Float64Array(18), BOX = new Float64Array(6), PJ = new Float64Array(3), OCN = new Float64Array(16);
  /** House h's box (world, as drawn now): x0, y0, z0, x1, y1, z1 (roofs, masts and terraces in). */
  function boxOf(h: number, o: DioramaObject, m: number) {
    const w = HOUSES[h * 8 + 2]!, d = HOUSES[h * 8 + 3]!, ht = HOUSES[h * 8 + 4]!, look = HOUSES[h * 8 + 6]!;
    const top = ht + (look === L_TOWER ? 1.5 : look < 4 ? 0.9 : look === L_SHACK ? 0.5 : 0.15);
    BOX[0] = o.pos[0]! - w / 2 - 0.5 - m; BOX[3] = o.pos[0]! + w / 2 + 0.5 + m;
    BOX[2] = o.pos[2]! - d / 2 - 0.45 - m; BOX[5] = o.pos[2]! + d / 2 + 0.45 + m;
    BOX[1] = CURB - m; BOX[4] = o.pos[1]! + top + m;
  }
  /** Does the segment from the eye to silhouette point i pass through BOX? (slabs; t in [0, 1]). */
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
  /** The probe's x-ray (tests): 0 as drawn, 1 no ghosting (solid), 2 no buildings. */
  let XR = 0;
  /** Step the ghosts; true while one is still fading. */
  function occlude(dt: number) {
    const c = dio.cam, d = bike.b, cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    OP[0] = c.tx + c.dist * sy * cp; OP[1] = c.ty + c.dist * sp; OP[2] = c.tz + c.dist * cy * cp;
    const bx = d.pos[0]!, by = Math.max(CURB, d.pos[1]!), bz = d.pos[2]!, rx = cy * 0.95, rz = -sy * 0.95;
    OP[3] = bx; OP[4] = by + 0.35; OP[5] = bz;
    OP[6] = bx; OP[7] = by + 1.65; OP[8] = bz;
    OP[9] = bx + rx; OP[10] = by + 0.8; OP[11] = bz + rz;
    OP[12] = bx - rx; OP[13] = by + 0.8; OP[14] = bz - rz;
    OP[15] = bx; OP[16] = by + 1.0; OP[17] = bz;
    // The segments' box (the broadphase).
    let x0 = OP[0]!, x1 = x0, z0 = OP[2]!, z1 = z0;
    for (let i = 1; i < 6; i++) (x0 = Math.min(x0, OP[i * 3]!)), (x1 = Math.max(x1, OP[i * 3]!)), (z0 = Math.min(z0, OP[i * 3 + 2]!)), (z1 = Math.max(z1, OP[i * 3 + 2]!));
    const k = ctx.reduced ? 2 : dt / OCC_T;
    let busy = false;
    for (let hk2 = 0; hk2 < NHOOD; hk2++) {
      const L = HIX[hk2]!, on = vis & (1 << hk2) && view;
      for (let j = 0; j < L.length; j++) {
        const h = L[j]!, o = HO[h];
        if (!o) continue;
        let t = 0;
        if (on) {
          boxOf(h, o, 0);
          if (BOX[3]! >= x0 && BOX[0]! <= x1 && BOX[5]! >= z0 && BOX[2]! <= z1) {
            for (let i = 1; i < 6 && !t; i++) if (crosses(i)) t = 1;
            // The eye inside the building, or all but touching it: gone, not ghosted.
            if (t) {
              boxOf(h, o, 1.2);
              if (OP[0]! > BOX[0]! && OP[0]! < BOX[3]! && OP[1]! > BOX[1]! && OP[1]! < BOX[4]! && OP[2]! > BOX[2]! && OP[2]! < BOX[5]!) t = 2;
            }
          }
        }
        GT[h] = t;
        if (XR === 2) { o.alpha = 0; const b = HB[h]; if (b) b.alpha = 0; }
        const g = GH[h]!;
        if (g !== t) {
          GH[h] = g < t ? Math.min(t, g + k) : Math.max(t, g - k);
          busy = true;
        }
        const gh = GH[h]!;
        if (gh > 0 && on) {
          const f = gh <= 1 ? 1 - gh * (1 - GHOST) : GHOST * (2 - gh);
          o.alpha *= XR === 1 ? 1 : f;
          const b = HB[h];
          if (b) b.alpha *= XR === 1 ? 1 : f;
        }
      }
    }
    if (busy) dirty = true;
    return busy;
  }
  /** The drones' searchlights from three stars: a pale beam from each drone to the ground round the rider. */
  function paintBeams(c2: CanvasRenderingContext2D) {
    if (cop.S[STARS]! < 3 || S[0] !== RUN) return;
    const Pt = cop.P, b = bike.b.pos;
    c2.fillStyle = P.beam;
    for (let i = 0; i < MAXP; i++) {
      const o = i * PS, u = units[i]!;
      if (Pt[o + P_ON] !== 1 || Pt[o + P_KIND] !== U_DRONE || u.alpha < 0.5) continue;
      if (!dio.project(u.pos[0]!, u.pos[1]! - 0.1, u.pos[2]!, PJ)) continue;
      const sx = PJ[0]!, sy = PJ[1]!;
      // The spot: where the drone aims (the rider, lagging a little behind the unit's line).
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
  /** The ghosts' outlines (over the frame: where the building stands, a thin neon box). */
  function paintGhosts(c2: CanvasRenderingContext2D) {
    for (let h = 0; h < NH; h++) {
      const g = GH[h]!, o = HO[h];
      if (g < 0.02 || !o || !(vis & (1 << W.hood[h]!))) continue;
      boxOf(h, o, -0.45);
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
  // [0] measure, [1] theme, [2] poster resolution, [3] safe top, [4] safe bottom, [5] drawn once, [6] gamepad on, [7] width.
  const V = new Float64Array(8);
  V[0] = V[1] = 1;
  let view = 1, auto = !!ctx.auto || !!ctx.attract, dirty = true, hudDirty = true, shake = 0, toastT = 0, ticketT = 0, sirenT = 0, emitK = 0, crashT = 0, barkT = 0, crashes = 0, spin = 0, paused = false, ended = false, chaseSet = false, framed = -1;
  const TT = new Float64Array(4), TF = new Uint8Array(4);
  const was = new Float64Array(10).fill(-1);
  const TABLE = { yaw: 0, pitch: 0.86, dist: 40, tx: 0, ty: 0, tz: 0.6, ox: 0, oy: 0, fov: 0.62 };
  // Fixed for the event (no zoom; set once from the stage shape at the start).
  const chaseO = { dist: 10.5, pitch: 0.6, lift: 0.8, ahead: 0.35, side: 0.8, rate: 3.4, turn: 2.4, snap: !!ctx.reduced };
  const CTP = new Float64Array(3), target = { pos: CTP, yaw: 0, vel: bike.vel };
  // Resizes are debounced; only a new width refits the framing (height-only is the mobile URL bar).
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
    // The rig poses the bike from its centre of mass, the rider's weight and the crash (thrown clear);
    // seated on the e-bike and the mini, up in the attack position on the dirt bike.
    rigs[0]!.pose(d, ctx.bike.cls === "ebike" ? 0.3 : 0.7);
    // The dog: along its fence; a hop when it barks.
    dog.pos[0] = run.DG[0]!;
    dog.pos[1] = CURB + (run.DG[2]! > 0 ? Math.abs(Math.sin(run.DG[2]! * 10)) * 0.12 : 0);
    dog.rot[1] = run.DG[0]! < d.pos[0]! - 0.3 ? 0 : run.DG[0]! > d.pos[0]! + 0.3 ? Math.PI : dog.rot[1]!;
    dogTail.rot[2] = 0.7 + Math.sin(engine.time * 16) * (S[0] === RUN ? 0.4 : 0);
    // Neighbours: out of the door, a fist shaken, back in (only in the hoods drawn).
    for (let i = 0; i < NN; i++) {
      const t = run.NB[i * 3]!, nb = nbs[i]!, f = NEIGH[i * 8 + 3]!, h = NEIGH[i * 8]!, apt = HOUSES[h * 8 + 6] === L_FLATS;
      nb.alpha = t > 0 && vis & (1 << NBH[i]!) ? 1 : 0;
      if (t <= 0) continue;
      const out = t > 2.25 ? (2.6 - t) / 0.35 : t < 0.35 ? t / 0.35 : 1, step = apt ? 0.12 : 0.75;
      nb.pos[2] = NEIGH[i * 8 + 2]! + VO[NBH[i]! * 2 + 1]! + f * out * step;
      nb.pos[1] = CURB + HOUSES[h * 8 + 7]! + (apt ? 1.65 : 0);
      arms[i]!.rot[2] = -0.35 + Math.sin(t * 22) * 0.3;
    }
    // Sprinklers: the heads turn with the aim; the water is drawn from the run's clock.
    for (let i = 0; i < NSP; i++) sprHeads[i]!.rot[1] = run.sprinklerAim(i);
    // The patrol: each slot as its kind, lights flashing in turn; a drone up in the air, bobbing.
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
    // Tyre smoke off the back wheel: on the gas in a wheelie, or spinning up from a stop.
    if (ph === RUN && !bike.air) {
      const k = d.throttle * (bike.nose > 0.1 ? 1 : Math.max(0, 1 - d.speed / 3)) + d.dust * 0.3, w = d.wheel;
      emitK += k * 28 * dt;
      while (emitK >= 1) {
        emitK -= 1;
        dust.puff(w[0]! + (rnd() - 0.5) * 0.2, w[1]! - 0.2, w[2]! + (rnd() - 0.5) * 0.2, -v[0]! * 0.2 + (rnd() - 0.5) * 0.6, 0.4 + rnd() * 0.5, -v[2]! * 0.2 + (rnd() - 0.5) * 0.6, 0.6 + rnd() * 0.4, 0.1, 0.45);
      }
    }
    // Sprinkler water: each head throws an arc of drops along its aim (the hoods drawn only).
    const on = ph === RUN || ph === CRASH;
    water.n = on ? WATER : 0;
    if (on) {
      spin += dt;
      for (let i = 0; i < NSP; i++) {
        const a = run.sprinklerAim(i), ca = Math.cos(a), sa = Math.sin(a), seen = vis & (1 << SPH[i]!), shower = SPH[i] === 3, y0 = (shower ? 1.7 : 0.15) + (height(SPRINK[i * 4]!, SPRINK[i * 4 + 1]!) > 0.06 ? CURB : 0);
        for (let k = 0; k < DROPS; k++) {
          const u = ((k / DROPS + spin * 0.9) % 1), j = i * DROPS + k, rr = u * SP_REACH * (shower ? 0.5 : 1);
          water.x[j] = SPRINK[i * 4]! + VO[SPH[i]! * 2]! + ca * rr;
          water.z[j] = SPRINK[i * 4 + 1]! + VO[SPH[i]! * 2 + 1]! - sa * rr;
          water.y[j] = shower ? y0 - u * 1.6 : CURB + 0.15 + u * (1 - u) * 2.4;
          water.r[j] = 0.035 + u * 0.03;
          water.a[j] = seen ? 0.85 - u * 0.5 : 0;
        }
      }
    }
    let any = dust.step(dt, -0.3, 0.3, 0.45);
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
      if (type === E_START) setView(1), engine.events.emit("start"), toast("GO! NINETY SECONDS", "go"), say("Go: ninety seconds");
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
        // (nothing to call yet: the landing says it)
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
      } else if (type === E_RESPAWN) {
        engine.events.emit("respawn");
      } else if (type === E_STUCK) stuckEl.hidden = !val;
      else if (type === E_RESET) {
        stuckEl.hidden = true;
        toast(val === 2 ? "UNSTUCK · BACK ON THE STREET" : "RESET", "go");
      } else if (type === E_GRUMP) {
        engine.events.emit("grump");
        const c2 = canvas.getContext("2d")!;
        c2.font = BFONT;
        BW[val] = c2.measureText(LINES[run.NB[val * 3 + 2]!]!).width;
      } else if (type === E_BARK) {
        engine.events.emit("bark");
        barkT = 0.7;
        const c2 = canvas.getContext("2d")!;
        c2.font = BFONT;
        BW[NN] = c2.measureText("WOOF!").width;
      } else if (type === E_SPLASH) {
        engine.events.emit("splash");
        splash.ring(rnd, d.pos[0]!, d.pos[1]! + 0.4, d.pos[2]!, 14, 2.2, 3, 0.6, 0.05, 0.9);
      } else if (type === E_BONUS) {
        engine.events.emit("bonus");
        toast(val === F_CROSS ? "CROSSWALK WHEELIE!" : val === F_SPRINK ? "SPRINKLER RUN!" : "GRUMPY BONUS!", "meh");
      } else if (type === E_JUMP) {
        engine.events.emit("jump");
        dust.ring(rnd, d.pos[0]!, d.pos[1]! - 0.5, d.pos[2]!, 10, 2, 1.2, 0.7, 0.18, 0.6);
        say("Over the hump");
      } else if (type === E_LAND) {
        shake = 0.2;
        dust.ring(rnd, d.pos[0]!, d.pos[1]! - 0.5, d.pos[2]!, 12, 2.4, 1.2, 0.7, 0.2, 0.6);
        if (!framedFor(val)) frameTable();
        // (An escape's toast, if there was one, comes next in the ring.)
        toast(HOOD_NAMES[val]!, "clean");
        say(HOOD_NAMES[val]!);
      } else if (type === E_ESCAPE) {
        engine.events.emit("escape");
        toast(`LOST THEM! +${val.toLocaleString("en-US")} · COMBO ×${1 + sc[CB]!}`, "go");
        say(`Lost them: ${val} points, combo up`);
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
        say(`${UNIT[val]} on your tail. Keep riding: they only ticket you stopped. Jump a hump to lose them`);
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
    // The trick in progress: its distance, in tenths.
    const on = sc[ON] === 1 && ph === RUN, mm = on ? Math.floor(sc[DIST]! * 10) : -1;
    if (was[3] !== mm) {
      was[3] = mm;
      trickChip.hidden = !on;
      if (on) trickEl.textContent = `${run.sc.S[6]! < sc[TIME]! * 0.3 ? "MANUAL" : "WHEELIE"} ${(mm / 10).toFixed(1)} m`;
    }
    // The heat: stars, and the points at risk while it is on; the chip burns while a unit is out.
    const st = cop.S[STARS]!, ht = Math.ceil(cop.S[HEAT]! / 5), risk = Math.round(cop.S[HOT]!), chased = cop.chasing > 0 ? 1 : 0;
    if (was[5] !== st * 1000 + ht * 2 + chased) {
      was[5] = st * 1000 + ht * 2 + chased;
      heatChip.hidden = ht === 0;
      heatEl.textContent = "★".repeat(st) + "☆".repeat(5 - st);
      heatChip.classList.toggle("wc-hot", chased === 1);
      heatChip.setAttribute("aria-label", `Heat: ${st} of 5 stars`);
    }
    if (was[6] !== risk) (was[6] = risk), (riskEl.hidden = risk <= 0), (riskEl.textContent = `AT RISK ${risk.toLocaleString("en-US")}`);
    const g = chased, rideN = S[2]!;
    if (was[4] !== ph * 10 + g + rideN * 100) {
      was[4] = ph * 10 + g + rideN * 100;
      const touch = !!thePad.el.offsetParent;
      hintEl.textContent = ph === READY ? `BEST ${(best / 1000).toFixed(2)} KM · ${touch ? "hold ⚡: the town never ends · END banks it" : "Space to ride: the town never ends · END (or E) banks it"}` : g && ph === RUN ? "NEON PATROL ON YOU · KEEP RIDING (STOP AND IT'S A TICKET) · HUMP INTO THE NEXT HOOD TO LOSE THEM" : "";
    }
  }
  function stats() {
    const esc = cop.S[ESC]!, tix = cop.S[TIX]!;
    return m.stats({ finished: true, score: sc[SC]!, where: "city", farKey: "city", far: run.far, escapes: esc, tickets: tix, summary: `${(run.far / 1000).toFixed(2)} KM across town · ${run.slot} hoods along · longest wheelie ${sc[BEST_W]!.toFixed(1)} m · ${S[S_JUMPS]} humps · ${esc} ${esc === 1 ? "escape" : "escapes"} · ${tix} ${tix === 1 ? "ticket" : "tickets"}` });
  }
  function end() {
    if (ended || ctx.attract) return;
    ended = true;
    // Banked: the run is over (the patrol peels off, the bike rolls to a stop, then it settles).
    S[0] = DONE;
    setView(0);
    say(`${(run.far / 1000).toFixed(2)} kilometres`);
    ctx.end(stats());
  }

  // ---- camera: the table view (the hood the rider is in) or the chase view, a three-quarter view of the bike ----
  const framedFor = (h: number) => framed === h;
  function frameTable() {
    const h = S[S_HOOD]!, cx = run.HC[h * 2]!, cz = run.HC[h * 2 + 1]!;
    const pts = [cx - HX - 0.4, -1.1, cz - HZ - 0.4, cx + HX + 0.4, -1.1, cz - HZ - 0.4, cx - HX - 0.4, -1.1, cz + HZ + 0.4, cx + HX + 0.4, -1.1, cz + HZ + 0.4, cx - HX, 2.4, cz - HZ, cx + HX, 2.4, cz - HZ, cx + 5.4, 4.5, cz - 2.3];
    const Wd = dio.width, H = dio.height, tall = H / Wd > 0.75;
    // A hood is a long strip: across a wide stage, up and down a tall one (the same framing in every hood: only the target moves).
    TABLE.yaw = tall ? -Math.PI / 2 : 0;
    TABLE.pitch = tall ? 1.0 : 0.98;
    TABLE.dist = 40;
    TABLE.tx = cx; TABLE.ty = 0; TABLE.ox = TABLE.oy = 0;
    TABLE.tz = cz + 0.6;
    dio.fit(TABLE, pts, { x0: 8, y0: V[3]!, x1: Wd - 8, y1: H - V[4]! });
    framed = h;
    // (Endless: lower, to see down the row of hoods to the haze.)
    if (!chaseSet) (chaseSet = true), (chaseO.dist = tall ? 12.5 : 10.5), (chaseO.pitch = tall ? 0.46 : 0.36);
  }
  function stepCam(dt: number) {
    const cam = dio.cam, d = bike.b;
    target.yaw = d.yaw;
    CTP[0] = d.pos[0]!; CTP[1] = Math.max(0, d.pos[1]!); CTP[2] = d.pos[2]!;
    if (view) {
      const mv = chase(cam, target, chaseO, dt), k = 1 - Math.exp(-4 * dt);
      cam.ox -= cam.ox * k;
      cam.oy -= cam.oy * k;
      return mv || Math.abs(cam.ox) + Math.abs(cam.oy) > 0.2;
    }
    const k = ctx.reduced ? 1 : 1 - Math.exp(-2.6 * dt);
    let moving = false;
    for (const key of ["yaw", "pitch", "dist", "tx", "ty", "tz", "ox", "oy"] as const) {
      let dd = TABLE[key] - cam[key];
      if (key === "yaw") dd -= TAU * Math.floor(dd / TAU + 0.5);
      if (Math.abs(dd) > 1e-3) (cam[key] += dd * k), (moving = true);
      else cam[key] = TABLE[key];
    }
    return moving;
  }
  function setView(n: number) {
    view = n;
    viewK.textContent = n ? "VIEW · CHASE" : "VIEW · TABLE";
    dirty = true;
    engine.busy(2.5);
    engine.wake();
  }

  // ---- drawing extras ----
  function paintSky(c2: CanvasRenderingContext2D) {
    const Wd = dio.width, H = dio.height;
    if (!sky) {
      sky = c2.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, P.sky0);
      sky.addColorStop(0.6, P.sky1);
      sky.addColorStop(1, P.sky2);
    }
    c2.fillStyle = sky;
    c2.fillRect(0, 0, Wd, H);
    if (P.night) {
      c2.fillStyle = P.star;
      for (let i = 0; i < 90; i += 3) {
        c2.globalAlpha = 0.25 + STARS_BG[i + 2]! * 0.6;
        c2.fillRect(STARS_BG[i]! * Wd, STARS_BG[i + 1]! * H * 0.6, 1.5, 1.5);
      }
      c2.globalAlpha = 1;
    }
    // A moon (night) or a soft sun (day), up and to the left.
    const r = Math.min(Wd, H) * 0.08;
    c2.fillStyle = P.moon;
    c2.beginPath();
    c2.arc(Wd * 0.2, H * 0.17, r, 0, TAU);
    c2.fill();
    if (P.night) {
      c2.fillStyle = P.sky0;
      c2.beginPath();
      c2.arc(Wd * 0.2 + r * 0.42, H * 0.17 - r * 0.2, r * 0.86, 0, TAU);
      c2.fill();
    }
  }
  /** Endless: the haze over the far ground (the sky's horizon colour from the horizon down to where
   *  the ground HAZE0 units ahead meets the screen), as the desert's. */
  const FOG = { g: null as CanvasGradient | null, y0: 0, y1: 0, c: "" };
  function paintFog(c2: CanvasRenderingContext2D) {
    const c = dio.cam, d = bike.b, x = d.pos[0]!, z = d.pos[2]!, fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), f = dio.height / 2 / Math.tan(c.fov / 2);
    const yh = dio.height / 2 + c.oy - f * Math.tan(c.pitch);
    const ok1 = dio.project(x + fx * (HAZE1 - 4), 0, z + fz * (HAZE1 - 4), tmp), y1 = ok1 ? Math.max(yh, tmp[1]!) : yh + 4;
    const ok0 = dio.project(x + fx * (HAZE0 - 6), 0, z + fz * (HAZE0 - 6), tmp2), y0 = ok0 ? Math.max(y1 + 8, tmp2[1]!) : y1 + 40;
    const top = yh - dio.height * 0.12;
    if (!FOG.g || FOG.c !== P.sky2 || Math.abs(FOG.y0 - y0) > 3 || Math.abs(FOG.y1 - y1) > 3) {
      const span = y0 - top || 1;
      FOG.g = c2.createLinearGradient(0, top, 0, y0);
      FOG.g.addColorStop(0, P.sky2 + "00");
      FOG.g.addColorStop(Math.max(0.01, (yh - top) / span), P.sky2);
      FOG.g.addColorStop(Math.min(0.98, Math.max(0.02, (y1 - top) / span)), P.sky2);
      FOG.g.addColorStop(1, P.sky2 + "00");
      FOG.y0 = y0; FOG.y1 = y1; FOG.c = P.sky2;
    }
    c2.fillStyle = FOG.g;
    c2.fillRect(0, top, dio.width, FOG.y0 - top);
  }
  /** One projected segment (skipped when either end is behind the camera). */
  function seg(c2: CanvasRenderingContext2D, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    if (!dio.project(x0, y0, z0, tmp) || tmp[2]! < 0.5 || !dio.project(x1, y1, z1, tmp2) || tmp2[2]! < 0.5) return;
    c2.moveTo(tmp[0]!, tmp[1]!);
    c2.lineTo(tmp2[0]!, tmp2[1]!);
  }
  /** The curbs: every block's edge and the turning circles in the hoods drawn, a neon line at night (a light line by day). */
  function paintLines(c2: CanvasRenderingContext2D) {
    c2.strokeStyle = P.curb;
    c2.lineWidth = P.night ? 1.6 : 1.2;
    c2.globalAlpha = P.night ? 0.9 : 0.8;
    if (P.night) c2.globalCompositeOperation = "lighter";
    c2.beginPath();
    const y = CURB + 0.005;
    for (let k = 0; k < NHOOD; k++) {
      if (!(vis & (1 << k))) continue;
      const B = HOODS[k]!.blocks, cx = CX[k]! + VO[k * 2]!, cz = CZ[k]! + VO[k * 2 + 1]!, C = HOODS[k]!.rings;
      for (let o = 0; o < B.length; o += 4) {
        const x0 = B[o]! + cx, z0 = B[o + 1]! + cz, x1 = B[o + 2]! + cx, z1 = B[o + 3]! + cz;
        seg(c2, x0, y, z0, x1, y, z0); seg(c2, x1, y, z0, x1, y, z1); seg(c2, x1, y, z1, x0, y, z1); seg(c2, x0, y, z1, x0, y, z0);
      }
      for (let o = 0; o < C.length; o += 3) {
        const r = C[o + 2]!, x = C[o]! + cx, z = C[o + 1]! + cz;
        for (let q = 0; q < 16; q++) seg(c2, x + Math.cos((q * TAU) / 16) * r, y, z + Math.sin((q * TAU) / 16) * r, x + Math.cos(((q + 1) * TAU) / 16) * r, y, z + Math.sin(((q + 1) * TAU) / 16) * r);
      }
    }
    c2.stroke();
    c2.globalAlpha = 1;
    c2.globalCompositeOperation = "source-over";
  }
  /** Pools of light under the streetlamps (night only). */
  function paintPools(c2: CanvasRenderingContext2D) {
    if (!P.night) return;
    c2.globalCompositeOperation = "lighter";
    c2.fillStyle = P.glow;
    const f = dio.focal();
    for (let k = 0; k < LAMPS.length; k += 2) {
      const lh = W.lampHood[k / 2]!;
      if (!(vis & (1 << lh)) || !dio.project(LAMPS[k]! + VO[lh * 2]!, 0.13, LAMPS[k + 1]! + VO[lh * 2 + 1]!, tmp) || tmp[2]! < 0.5) continue;
      const r = (f * 2.2) / tmp[2]!;
      c2.globalAlpha = 0.08;
      c2.beginPath();
      c2.ellipse(tmp[0]!, tmp[1]!, r, r * 0.5, 0, 0, TAU);
      c2.fill();
      c2.globalAlpha = 0.07;
      c2.beginPath();
      c2.ellipse(tmp[0]!, tmp[1]!, r * 0.55, r * 0.28, 0, 0, TAU);
      c2.fill();
    }
    // The patrol's lights wash the street under each unit.
    const Pt = cop.P, flash = ((engine.time * 5) | 0) & 1;
    for (let i = 0; i < MAXP; i++) {
      const o = i * PS;
      if (Pt[o + P_ON] !== 1 || !dio.project(Pt[o + P_X]!, 0.05, Pt[o + P_Z]!, tmp) || tmp[2]! < 0.5) continue;
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
  /** The bike's shadow on the ground: an ellipse under it, smaller and fainter the higher it is. */
  function paintShadow(c2: CanvasRenderingContext2D) {
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
  function paintSign(c2: CanvasRenderingContext2D) {
    // The store's sign: one word, on the sign's face.
    const o = STORE * 8, f = HOUSES[o + 5]!;
    if (!(vis & 1) || !dio.project(HOUSES[o]! + VO[0]!, CURB + HOUSES[o + 4]! - 0.21, HOUSES[o + 1]! + VO[1]! + (f * HOUSES[o + 3]!) / 2 + f * 0.08, tmp) || tmp[2]! < 0.5) return;
    const s = dio.focal() / tmp[2]!;
    if (s < 6) return;
    c2.font = `900 ${Math.round(s * 0.28)}px ui-rounded, system-ui, sans-serif`;
    c2.textAlign = "center";
    c2.textBaseline = "middle";
    c2.fillStyle = P.night ? P.ink : "#ffffff";
    c2.fillText("CORNER STORE", tmp[0]!, tmp[1]!);
  }
  const BFONT = "900 13px ui-rounded, system-ui, sans-serif";
  /** A Board UI speech bubble over a world point. */
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
    // Neighbours' shouts and the dog's bark.
    for (let i = 0; i < NN; i++) {
      const t = run.NB[i * 3]!;
      if (t <= 0 || t > 2.3 || !(vis & (1 << NBH[i]!))) continue;
      const nb = nbs[i]!;
      bubble(c2, nb.pos[0]!, nb.pos[1]! + 1.5, nb.pos[2]!, LINES[run.NB[i * 3 + 2]!]!, BW[i]!, P.paper);
    }
    if (barkT > 0) bubble(c2, dog.pos[0]!, dog.pos[1]! + 0.7, dog.pos[2]!, "WOOF!", BW[NN]!, P.warn);
    // The balance gauge over the rider while the front is up: the arc from flat to looping out, the
    // sweet spot round the balance point, the needle at the nose.
    const nose = bike.nose, ph = S[0]!;
    if ((ph !== RUN && ph !== READY) || nose < 0.03 || S[S_FLY]) return;
    const d = bike.b;
    if (!dio.project(d.pos[0]!, d.pos[1]! + 1.55, d.pos[2]!, tmp) || tmp[2]! < 0.5) return;
    // (The shared bike loops out 0.62 past its balance point.)
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
  // The gamepad (../../bike/kit.ts): [stick x, stick y, gas, brake, trick (our hop), start].
  const GP = new Float64Array(7);
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
          frameTable();
          if (!view) Object.assign(dio.cam, TABLE);
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
      show();
      if (S[0] === CRASH) crashT += dt;
      // The siren while a unit is out.
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

  // ---- input: keys on the stage, hold-to-gas on the play surface, the stickers ----
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
  // The play surface: hold for gas (a mouse or a finger off the pad).
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

  run.reset(0, startHood);
  buildScene();
  vox.use(SPEC.power);
  setView(1);
  target.yaw = bike.b.yaw;
  CTP.set(bike.b.pos);
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
      const ph = S[0]!;
      return {
        phase: ph === READY ? "ready" : ph === RUN || ph === CRASH ? "run" : ph === DONE ? "done" : "idle", clock: S[1]!, score: sc[SC]!, combo: sc[CB]!, trick: sc[ON] === 1, nose: bike.nose, view: view ? "chase" : "table", speed: bike.b.speed, crashes, grumps: S[4]!, best: sc[BEST_W]!, ended,
        hood: HOOD_IDS[S[S_HOOD]!], slot: run.slot, far: run.far, endless: true, near: cop.S[NEAR]!, flying: S[S_FLY] === 1, jumps: S[S_JUMPS]!, heat: cop.S[HEAT]!, stars: cop.S[STARS]!, units: cop.chasing, risk: cop.S[HOT]!, escapes: cop.S[ESC]!, tickets: cop.S[TIX]!, drawn: vis, objects: dio.stats.objects, faces: dio.stats.faces,
      };
    },
    get camera() {
      return { dist: view ? dio.cam.dist : chaseO.dist, fov: dio.cam.fov, view: view ? "chase" : "table" };
    },
    finish() {
      if (!ended) end();
    },
    stats,
    pause(on: boolean) {
      if (paused === on || ended) return;
      paused = on;
      c.press("gas", false);
      if (on) engine.stop();
      else engine.start();
    },
    destroy: () => engine.destroy(),
    probe: {
      /** Put the bike `back` units out from house h's front, facing away from it, in the first slot
       *  (from `from`) that shows h's hood: the building stands between the chase camera and the bike. */
      behind(h: number, back = 4, from = 0) {
        const k0 = W.hood[h]!;
        let k = from;
        while (slotKind(k) !== k0) k++;
        // Riding along the street (east, or west), the chase camera sits back and to one side
        // (yaw − π/2 + side): put the bike on that line out from the tower's front.
        const f = HOUSES[h * 8 + 5]!, yaw = f < 0 ? 0 : Math.PI, cy = yaw - Math.PI / 2 + chaseO.side, ux = Math.sin(cy), uz = Math.cos(cy);
        const t = (HOUSES[h * 8 + 3]! / 2 + back) / Math.abs(uz), x = HOUSES[h * 8]! - CX[k0]! + k * PITCH - ux * t, z = HOUSES[h * 8 + 1]! - CZ[k0]! - uz * t;
        run.place(x, z, yaw);
        show();
        CTP[0] = bike.b.pos[0]!; CTP[1] = Math.max(0, bike.b.pos[1]!); CTP[2] = bike.b.pos[2]!; target.yaw = bike.b.yaw;
        chase(dio.cam, target, { ...chaseO, snap: true });
        dirty = true;
        engine.busy(1);
        engine.wake();
        return [x, z];
      },
      /** Draw now, x-rayed (see XR) and with the rider shown or not: the frame's pixels are the test's. */
      draw(xr = 0, rider = 1) {
        XR = xr;
        show();
        occlude(0);
        pose();
        rigs[0]!.root.alpha = rider;
        dio.draw();
        rigs[0]!.root.alpha = 1;
        XR = 0;
        dirty = true;
        return dio.cam.dist;
      },
      /** The bike's box on screen (CSS px): x0, y0, x1, y1. */
      bikeBox() {
        const b = bike.b.pos, out = [1e9, 1e9, -1e9, -1e9];
        for (let q = 0; q < 8; q++) if (dio.project(b[0]! + (q & 1 ? 1 : -1), Math.max(CURB, b[1]!) + (q & 2 ? 1.9 : 0), b[2]! + (q & 4 ? 1 : -1), PJ)) (out[0] = Math.min(out[0]!, PJ[0]!)), (out[1] = Math.min(out[1]!, PJ[1]!)), (out[2] = Math.max(out[2]!, PJ[0]!)), (out[3] = Math.max(out[3]!, PJ[1]!));
        return out;
      },
      /** Houses ghosted now: [house, level ×100] pairs (level 1 ghosted, 2 gone). */
      ghosts() {
        const out: number[] = [];
        for (let h = 0; h < NH; h++) if (GH[h]! > 0.01) out.push(h, Math.round(GH[h]! * 100));
        return out;
      },
      /** The eye (from the last step) and house h's box as tested. */
      eye(h: number) {
        const o = HO[h];
        if (o) boxOf(h, o, 0);
        return [OP[0], OP[1], OP[2], dio.cam.yaw, bike.b.yaw, ...BOX];
      },
      /** The towers (house ids), for scripting a ride past one. */
      towers() {
        const out: number[] = [];
        for (let h = 0; h < NH; h++) if (HOUSES[h * 8 + 6] === L_TOWER) out.push(h);
        return out;
      },
    },
  };
}
