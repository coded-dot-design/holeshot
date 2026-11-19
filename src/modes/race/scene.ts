// The track scene: Race and Free Ride on a tabletop motocross loop (from Fizlet's Moto Track gallery
// piece). A loop of dirt sits on a plinth: bermed turns, a rhythm section of doubles, the whoops, a
// big triple and the finish tabletop; at night (dark) the track glows with neon edges and light
// towers, by day (light) it is pastel low-poly. Race: the gate, three laps against three rivals on
// stock bikes of your class (your mods and your wear are the difference). Free Ride: the same table
// with nobody else on it, no laps; ride where you like; E or the pause card's END & BANK banks the session.
// The stick (W/S, ↑/↓) is the rider's weight: back lifts the front, forward keeps it down, and in the
// air it pitches the bike; A/D (←/→) steer; Space or J is the gas, K or Shift the brake.
// Bricks: the kernel (fixed step, settle, the ledger), @fzlt/core/diorama, terrain, drive (its
// `chase` camera), input, pad, sound. The bike is ../../bike/bike.ts drawn by ../../bike/rig.ts; the
// race is ./course.ts and Free Ride ../freeride/session.ts, both headless.
import { dist } from "../../model/units.ts";
import { createEngine, seeded } from "@fzlt/core/kernel";
import { diorama, type DioramaObject } from "@fzlt/core/diorama";
import { terrainView, type TerrainView } from "@fzlt/core/terrain";
import { chase } from "@fzlt/core/drive";
import { controls } from "@fzlt/core/input";
import { rocker } from "../../bike/rocker.ts";
import { flicker } from "../../bike/flick.ts";
import { pad } from "@fzlt/core/pad";
import { sound } from "@fzlt/core/sound";
import { LOOP, ENDO, CASE, BAIL, type Power } from "../../bike/bike.ts";
import { rig, type Rig, type RigColors } from "../../bike/rig.ts";
import { pool, voice, gamepad, type Pool } from "../../bike/kit.ts";
import { DONE, E_CRASH, E_FINISH, E_GATE, E_LAND, E_LAP, E_PLACE, E_RESPAWN, E_WHEELIE, E_COUNT, GRID, LAPS, RACE, TRACK_W, TD_GRID, TD_RUNOFF, TD_SLOT, motoRace, type RaceOpts, type Track } from "./course.ts";
import { freeRun, E_TRICK, E_STUCK, E_RESET, E_GROUND, E_DRAG, E_BANKED, E_LOST } from "../freeride/session.ts";
import { DRAG_NAME, FENDER } from "../stunts.ts";
import { SC as T_SC, CB as T_CB, PTS as T_PTS, KIND as T_KIND, DIST as T_DIST, TIME as T_TIME, MANUAL, STOPPIE } from "../wheelie/tricks.ts";
import { callout, stuntCalls, stuntCall, friendStunt } from "../callout.ts";
import { E_REGROUP, E_STUNT } from "../freeride/jam.ts";
import { font as tagFont, tag, marker } from "../../online/tags.ts";
import { RESET } from "../unstuck.ts";
import { desertView, biomePal, desertBands, GRID_A, type DesertView } from "../desert/look.ts";
import type { DesertTrack } from "../desert/track.ts";
import type { RideMap } from "../freeride/maps.ts";
import { mapLook, type MapLine } from "../freeride/scenery.ts";
import { meter } from "../meter.ts";
import type { ModeCtx, ModeRun } from "../mode.ts";
import type { Ride } from "../../online/match.ts";
import { walkUi } from "../../bike/walk-ui.ts";
import type { RigHelmet, RigKind } from "../../bike/rig.ts";
import { speedo } from "../speedo.ts";
import { keysHTML, menuKeys, paintMute as paintMuteK, paintView } from "../keys.ts";
import { rigOfPower } from "../../bike/bodies.ts";

/** An online ride on this screen (../../online/match.ts steps the sim; the scene draws it, reads this
 *  screen's input for it and plays the first run of each frame's events). */
export interface NetView {
  ride: Ride;
  seat: number;
  /** Every rider's tag (people's names, the AI rivals', "· AI" for a seat that left). */
  names: string[];
  /** Each person's colours, helmet, rig and plate. */
  looks: { look: ModeCtx["look"]; helmet: RigHelmet; rig: RigKind; model?: string; number: number }[];
}
/** A ModeRun with an online ride's hooks. */
export interface NetRun extends ModeRun {
  /** This screen's input now: [gas, brake, lean, steer] (zeros while paused or done). */
  input(): Float64Array;
  /** A frame's events, the first time it ran (stickers, sound, FX). */
  events(): void;
  /** Around a correction (the remote riders ease to where they really are). */
  rewind(before: boolean): void;
  /** Repaint the riders' tags (a seat left). */
  tags(names: string[]): void;
  /** The endless rides' commands from this screen now (../../net.ts C_END, C_REGROUP, C_HOP bits). */
  cmd?(): number;
}
/** A NetRun's commands (the same bits as ../../net.ts C_END, C_REGROUP, C_HOP, C_COMBO). */
export const CMD_END = 1, CMD_REGROUP = 2, CMD_HOP = 4, CMD_COMBO = 8;

const TAU = 6.283185307179586;
type Kit = Omit<RigColors, "plastic" | "plastic2" | "jersey" | "pants" | "helmet" | "stripe" | "plate" | "ink">;
const TEAM = (plastic: string, plastic2: string, jersey: string, pants: string, helmet: string, stripe: string, plate: string, ink: string) => ({ plastic, plastic2, jersey, pants, helmet, stripe, plate, ink });
// The palettes by role: a neon night (dark) and a pastel day (light). teams[0] is the player's
// default (the profile's look replaces it).
const DARK = {
  night: true, light: [-0.4, 1, 0.5], amb: 0.44,
  sky0: "#05061a", sky1: "#1a0f3e", sky2: "#3a1460", star: "#cfd8ff", grid: "#3b2a7a",
  ground: ["#0c1530", "#101b3a", "#142045"], crest: "#1a2a58", steep: "#0a1128", track: "#3a2650", face: "#55356f", edge: "#22e6ff", edge2: "#ff4fa8",
  plinth: "#120f26", rim: "#22e6ff", table: "#0a0918", tuff: "#1d1838", tuffTop: "#ff4fa8", tower: "#24203f", lamp: "#fff2c2", beam: "#22e6ff",
  gate: "#cfd6ff", gateBar: "#ff4fa8", gatePost: "#2a2548", check: "#f4f1ff", ink: "#0b0a14", banner: "#22e6ff",
  dust: "#7c68c4", spark: "#ffd166", shadow: "#000000", hot: "#ff4fa8", ok: "#22e6ff", meter: "#16132b",
  kit: { seat: "#14121f", frame: "#2b2a3d", tyre: "#0f0f16", rim: "#9aa0c8", metal: "#c9cde6", pipe: "#7e86a8", visor: "#0a0c16", boots: "#e9ecff", gloves: "#14121f", glow: "#ff2e88" } as Kit,
  teams: [
    TEAM("#22e6ff", "#eef0ff", "#22e6ff", "#1b1a2c", "#eef0ff", "#ff4fa8", "#eef0ff", "#0b0a14"),
    TEAM("#b6ff3b", "#1b1a2c", "#b6ff3b", "#2a2a3a", "#1b1a2c", "#b6ff3b", "#b6ff3b", "#0b0a14"),
    TEAM("#ff8a3d", "#eef0ff", "#ff8a3d", "#2a2238", "#ff8a3d", "#eef0ff", "#eef0ff", "#0b0a14"),
    TEAM("#b18cff", "#1b1a2c", "#b18cff", "#1b1a2c", "#eef0ff", "#b18cff", "#ffd166", "#0b0a14"),
  ],
};
export type Pal = typeof DARK;
/** SX (a stadium, indoors: ./venue.ts): the night show under the roof (dark), the arena with its house
 *  lights up (light). Packed brown stadium dirt, a concrete floor, the walls in the team colours. */
const SX_DARK: Partial<Pal> = {
  sky0: "#04030a", sky1: "#0d0a1c", sky2: "#1d1233", star: "#ffd166", amb: 0.42,
  ground: ["#2a1d2e", "#2f2133", "#342438"], crest: "#3a2a40", steep: "#1e1424", track: "#4a2f3a", face: "#6a4150",
  plinth: "#1a1730", rim: "#ff4fa8", table: "#08070f", tuff: "#22e6ff", tuffTop: "#fff2c2", banner: "#ffd166",
};
const SX_LIGHT: Partial<Pal> = {
  sky0: "#4a4f66", sky1: "#6d7290", sky2: "#a9aec8", star: "#ffffff", amb: 0.58,
  ground: ["#b88a62", "#b28460", "#ac7f5c"], crest: "#c29670", steep: "#8f6648", track: "#9a6a48", face: "#b58058",
  plinth: "#e9e4f2", rim: "#ff7a59", table: "#c9c4d6", tuff: "#13a9bb", tuffTop: "#ffffff", banner: "#ff7a59",
};
/** Track Day (./circuits.ts): a night race under floodlights (dark), a summer track day (light). Grass
 *  round dark asphalt, a pale run-off; the circuit's own colours (kerbs, lines, pit lane, stands) are TD_C. */
const TD_DARK: Partial<Pal> = {
  sky0: "#03040c", sky1: "#0b1024", sky2: "#1b1940", amb: 0.46,
  ground: ["#0f2a24", "#123128", "#15382d"], crest: "#1a4234", steep: "#0b2019", track: "#23232e", face: "#3b3a4c",
  plinth: "#10121f", rim: "#22e6ff", table: "#070812", tuff: "#ff4fa8", tuffTop: "#f4f1ff", banner: "#22e6ff", dust: "#8d8aa6",
};
const TD_LIGHT: Partial<Pal> = {
  sky0: "#9fd8ff", sky1: "#cdeeff", sky2: "#fff3dc", amb: 0.56,
  ground: ["#8fd18a", "#84c87f", "#79bd75"], crest: "#9ad995", steep: "#6aa866", track: "#5b5d6b", face: "#cfc9bd",
  plinth: "#b98e6c", rim: "#fff0dc", table: "#e3d2bd", tuff: "#ff5a4f", tuffTop: "#ffffff", banner: "#13a9bb", dust: "#d8d4cc",
};
/** Track Day's own colours: the kerbs, the lines on the asphalt, the pit lane, the stands, the lights. */
const TD_C = {
  dark: { kerb: "#ff3b5c", kerb2: "#f4f1ff", line: "#e9ecff", pit: "#2c2c3a", wall: "#3a3d58", wallTop: "#22e6ff", stand: "#3d4270", stand2: "#323760", seats: ["#22e6ff", "#ff4fa8", "#b6ff3b"], roof: "#14172a", garage: "#1d2034", door: "#ffd166", lampOff: "#2a1820", lampOn: "#ff2e4d", board: "#f4f1ff" },
  light: { kerb: "#e8323f", kerb2: "#ffffff", line: "#ffffff", pit: "#6c6e7c", wall: "#dcdfe8", wallTop: "#13a9bb", stand: "#c9ccd8", stand2: "#b3b7c6", seats: ["#13a9bb", "#ff7a59", "#7cc93a"], roof: "#eef0f6", garage: "#e6e1d6", door: "#5b5d6b", lampOff: "#4a3036", lampOn: "#ff2e4d", board: "#ffffff" },
};
const LIGHT: Pal = {
  ...DARK, night: false, light: [0.6, 1, 0.45], amb: 0.54,
  sky0: "#bfe6ff", sky1: "#d9f0ff", sky2: "#fff1dc", star: "#ffffff", grid: "#ffffff",
  ground: ["#a8dcb4", "#9ad2a9", "#8cc79d"], crest: "#b9e6c2", steep: "#7fb98f", track: "#d9a774", face: "#e8bf8f", edge: "#fff5e6", edge2: "#ff7a59",
  plinth: "#c98f6a", rim: "#fff0dc", table: "#e8c7a6", tuff: "#fff3e3", tuffTop: "#ff7a59", tower: "#8a8fb0", lamp: "#ffe9a8", beam: "#ffffff",
  gate: "#ffffff", gateBar: "#ff7a59", gatePost: "#6f6a8a", check: "#ffffff", ink: "#1b1420", banner: "#13a9bb",
  dust: "#e9c39a", spark: "#fff1a8", shadow: "#5a3a2a", hot: "#ff4f6d", ok: "#13a9bb", meter: "#ffffff",
  kit: { seat: "#2a2833", frame: "#3a3a4c", tyre: "#24232b", rim: "#d9dbe6", metal: "#eceef7", pipe: "#9aa0b8", visor: "#1b1d2a", boots: "#ffffff", gloves: "#2a2833", glow: "#ff3b30" },
  teams: [
    TEAM("#13a9bb", "#ffffff", "#13a9bb", "#2c3550", "#ffffff", "#ff7a59", "#ffffff", "#1b1420"),
    TEAM("#7cc93a", "#2c3550", "#7cc93a", "#3a3a4c", "#2c3550", "#7cc93a", "#7cc93a", "#1b1420"),
    TEAM("#ff8a3d", "#ffffff", "#ff8a3d", "#3d3550", "#ff8a3d", "#ffffff", "#ffffff", "#1b1420"),
    TEAM("#8f6bff", "#2c3550", "#8f6bff", "#2c3550", "#ffffff", "#8f6bff", "#ffd166", "#1b1420"),
  ],
};
const DUST = 120, SPARK = 48, ROOST = 60;
/** Track Day's level of detail: its flat ground is drawn on coarser cells (./circuits.ts), so its
 *  detail steps down later (about the faces a frame of an MX table). */
const TD_LOD = [19, 36];
const ORD = ["1ST", "2ND", "3RD", "4TH"];
/** Endless: the ground tricks' names (../wheelie/tricks.ts kinds). */
const GROUND = ["", "WHEELIE", "MANUAL", "HOP", "STOPPIE"];
const CRASH_NAME: Record<number, string> = { [LOOP]: "LOOPED OUT!", [ENDO]: "OVER THE BARS!", [CASE]: "CASED IT!", [BAIL]: "BAILED!", 5: "WIPEOUT!", 9: "OFF THE TABLE!" };

/** The mode's host: the gallery stage's two layers (a backdrop and the slot the scene draws in). */
export function modeStage(host: HTMLElement, cls: string) {
  host.textContent = "";
  const bg = document.createElement("div");
  bg.className = cls;
  bg.setAttribute("aria-hidden", "true");
  const stage = document.createElement("div");
  stage.setAttribute("data-fizlet-slot", "");
  stage.className = "dh-slot";
  host.append(bg, stage);
  return stage;
}

/** Race (`free` false: the gate, three laps, three rivals) or Free Ride (`free`: the table to yourself).
 *  Free Ride also rides an open map (../freeride/maps.ts): its look and scenery from ../freeride/scenery.ts.
 *  `opts` tunes a race (a series round's rivals' nerve). */
export function mountTrack(ctx: ModeCtx, track: Track | RideMap, free: boolean, rivals: Power[], opts: RaceOpts = {}, net: NetView | null = null): NetRun {
  const stage = modeStage(ctx.host, "mt");
  /** Metres (world units) on the HUD, in the rider's units (miles or km). */
  const km = (u: number) => dist(u, ctx.units);
  const engine = createEngine({ root: stage, settle: 0.5, seed: ctx.seed });
  const L = engine.ledger, sig = { signal: engine.signal };
  const map = "isMap" in track ? track : null, look = map ? mapLook(map) : null;
  // Endless Desert: no table, no line; the world streams round the rider (../desert/).
  const endless = "isEndless" in track ? (track as DesertTrack) : null;
  const bp = endless ? biomePal(endless.biome.bi) : null;
  // SX: a stadium track (./venue.ts): indoor colours and the stadium's walls.
  const sx = !map && !endless && (track as Track).venue === "sx";
  // Track Day: a paved road circuit (./circuits.ts): asphalt colours, kerbs, the gantry, the pits.
  const td = !map && !endless && (track as Track).venue === "td";
  const DK: Pal = look ? { ...DARK, ...look.dark } : bp ? { ...DARK, ...bp.dark } : sx ? { ...DARK, ...SX_DARK } : td ? { ...DARK, ...TD_DARK } : DARK, LT: Pal = look ? { ...LIGHT, ...look.light } : bp ? { ...LIGHT, ...bp.light } : sx ? { ...LIGHT, ...SX_LIGHT } : td ? { ...LIGHT, ...TD_LIGHT } : LIGHT;
  let P: Pal = document.documentElement.dataset.theme === "light" ? LT : DK;
  const { HX, HZ, NT, TRACK, YAW } = track, { TURN, LAP, GATE_S, LINE_S } = track as Track, TW = (track as Track).W ?? TRACK_W;
  const me0 = { power: ctx.bike.power, shape: ctx.bike.shape, sweet: ctx.bike.sweet, bar: ctx.bike.bar, hop: ctx.bike.hop };
  // Online: the match's sim (stepped by the rollback link, not here), this screen's seat in it.
  const seat = net ? net.seat : 0, jam = net ? net.ride.jam : null, humans = net ? net.ride.players : 1;
  const race = net ? net.ride.race : free ? null : motoRace(ctx.seed, track as Track, me0, rivals, opts);
  // (Online on an endless ground `fr` is this seat's own run in the jam: its window is this screen's ground.)
  const fr = net ? (jam && endless ? jam.runs[seat]! : null) : free ? freeRun(track, me0, endless ? 1e9 : 600) : null;
  const sim = (race ?? jam ?? fr)!, t = net && fr ? fr.t : sim.t, me = sim.riders[seat]!, RIDERS = sim.riders.length;
  /** Online endless: the ride together (END banks yours, REGROUP brings you to the host). */
  const roam = !!(net && endless), jamOnly = jam && !roam ? jam : null;
  const m = net ? net.ride.meters[seat]! : meter(endless ? "desert" : free ? "freeride" : td ? "trackday" : "race");
  /** A placed ride (a race, a jam): its place, against whom. */
  const placed = !!race || !!jam, TAGS: string[] = net ? net.names.slice() : [];
  const NAME = ctx.bike.model.name;

  // ---- the page: the canvas, the play surface over it, the stickers, the pad ----
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "mt-play";
  play.setAttribute("aria-label", `${free ? "Free Ride" : td ? "Track Day" : "Race"}: Space or J for gas, K or Shift to brake, W and S (or up and down) shift your weight forward and back (back lifts the front; in the air it pitches the bike), A and D (or left and right) steer${endless ? ", L hops (or flick the stick back then forward), C holds the combo" : ""}. V changes the view, M mutes, P or Escape pauses`);
  const hud = L.add(document.createElement("div"));
  hud.className = "mt-hud";
  hud.innerHTML = `<div class="mt-head"><p class="mt-top">${jamOnly ? `<b class="mt-chip mt-pos"><span>1ST</span><i>/${RIDERS}</i></b><b class="mt-chip mt-lap"><span>0 PTS</span></b>` : endless ? `<b class="mt-chip mt-pos"><span>BEST ${km(ctx.best ?? 0)}</span></b><b class="mt-chip mt-lap"><span>${km(0)}</span></b>` : free ? `<b class="mt-chip mt-pos"><span>${map ? map.name : "FREE RIDE"}</span></b><b class="mt-chip mt-lap"><span>0.0s AIR</span></b>` : `<b class="mt-chip mt-pos"><span>1ST</span><i>/${RIDERS}</i></b><b class="mt-chip mt-lap"><span>LAP 1/${LAPS}</span></b>`}<b class="mt-chip mt-time"><span>0:00.0</span></b><b class="mt-chip mt-ride"><span>#${ctx.number} ${NAME}</span></b>${endless ? `<b class="mt-chip mt-score" aria-label="Trick points"><span>0 PTS</span><i></i></b><b class="mt-chip mt-drag" hidden><span></span></b>` : ""}</p><p class="mt-hint"></p></div><p class="mt-toast" hidden></p><p class="mt-live" aria-live="polite"></p><p class="mt-stuck" hidden>STUCK? Hold R / tap ↺ to reset</p><p class="mt-keys">${keysHTML("mt", { reset: "Reset to the last good spot (R)", view: !endless, theme: !!ctx.theme, regroup: roam ? (seat ? "To the host (G)" : "Regroup: everyone to you (G)") : undefined })}</p>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement;
  const toastEl = hud.children[1] as HTMLElement, live = hud.children[2] as HTMLElement, stuckEl = hud.children[3] as HTMLElement, keysEl = hud.children[4] as HTMLElement;
  const posEl = top.children[0]!.firstChild as HTMLElement, lapEl = top.children[1]!.firstChild as HTMLElement, timeEl = top.children[2]!.firstChild as HTMLElement;
  // The speed, next to the distance (lap, points, air) chip.
  const speedW = speedo(top.children[1]!, "mt", ctx.units);
  const viewK = keysEl.querySelector<HTMLButtonElement>(".mt-view")!, muteK = keysEl.querySelector<HTMLButtonElement>(".mt-mute")!;
  // Endless: the trick points chip, the drag's (at risk) chip, the callout (../callout.ts).
  const scoreChip = top.querySelector<HTMLElement>(".mt-score"), dragChip = top.querySelector<HTMLElement>(".mt-drag");
  const call = callout(hud, ctx.reduced), st = endless && fr ? fr.st : null, tsc = endless && fr ? fr.sc.S : null;
  stage.append(canvas, play, hud);
  if (ctx.attract) hud.hidden = true;
  const snd = sound(engine, { cues: { count: "click", gate: "power", lap: "ready", crash: "boom", land: "click", wheelie: "power", finish: "win", pass: "click" }, volume: 0.1, on: ctx.sound && !ctx.attract });
  const vox = voice();
  vox.on = snd.on;
  const c = controls(engine, { keys: { left: [], right: [], fwd: [], back: [], gas: [], brake: [], reset: [], combo: [], hop: [] }, target: play });
  const HOPK = c.id("hop"), COMBOK = c.id("combo"), RESETK = c.id("reset"), GAS = c.id("gas"), BRAKE = c.id("brake"), LEFT = c.id("left"), RIGHT = c.id("right"), FWD = c.id("fwd"), BACK = c.id("back");
  const thePad = pad(engine, c, {
    scheme: "stick",
    // Gas and brake on the throttle rocker (../../bike/rocker.ts), under the right thumb.
    actions: [],
    host: stage,
  });
  thePad.el.classList.add("mt-pad");
  // Endless: the TRICK bubble (the combo button) pops out of the rocker in the air and in a wheelie past 10 o'clock.
  const rock = rocker(c, thePad.el, { reduced: ctx.reduced, signal: engine.signal, combo: endless ? "combo" : "" });
  // Endless: the bunny hop, as in Endless Wheelie City: a back-then-forward flick of the stick, only
  // started with both wheels down (../../bike/flick.ts), L, or a pad's button.
  const flk = flicker(() => me.crashed || (!!(me.contact[0] || me.contact[1]) && me.rel <= 0.12));
  // Walking the bike: the WALK chip, and on a touch screen the one-time "stick back" hint.
  const coarse = matchMedia("(pointer: coarse)"), walkHud = walkUi(hud, () => coarse.matches && !ctx.attract);
  if (ctx.attract) thePad.el.hidden = true;
  const paintMute = () => paintMuteK(muteK, snd.on);
  paintMute();
  const toggle = () => {
    snd.on = vox.on = !snd.on;
    paintMute();
  };

  // ---- the diorama ----
  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => (endless ? P.sky2 : P.table), overlay: drawOverlay, get shadowColor() { return P.shadow; } });
  let tv: TerrainView, dust: Pool, spark: Pool, roost: Pool;
  const dv: DesertView | null = endless ? desertView(dio, endless.world) : null, FOG = { g: null as CanvasGradient | null, y0: 0, y1: 0 };
  const rigs: Rig[] = [], gateBars: DioramaObject[] = [];
  const EDGE = track.trackEdges(t);
  // The neon lines over the terrain: the track's edges, or the map's own (Endless: the grid, drawn live).
  const LINES: MapLine[] = endless || td ? [] : look ? look.lines(t) : [{ p: EDGE.subarray(0, NT * 3), n: NT, closed: true, c: "edge2", a: 1 }, { p: EDGE.subarray(NT * 3), n: NT, closed: true, c: "edge", a: 1 }];
  const rnd = seeded(ctx.seed);
  let sky: CanvasGradient | null = null;
  const STARS = new Float32Array(120);
  for (let i = 0; i < 120; i++) STARS[i] = rnd();
  const rigKind = (p: Power) => rigOfPower(p.name);

  function buildScene() {
    dio.clear();
    rigs.length = gateBars.length = 0;
    dio.setLight(P.light, P.amb);
    dio.cluster("sky", { fixed: -10 });
    dio.cluster("table", { fixed: -5 });
    dio.decal("sky", 0, paintSky);
    if (!endless) {
      dio.add({ id: "table", size: [HX * 2 + 8, 0.5, HZ * 2 + 7], pos: [0, -1.55, 0.6], color: P.table, cluster: "table", layer: 0, pick: false });
      dio.add({ id: "plinth", size: [HX * 2 + 0.5, 1.05, HZ * 2 + 0.5], pos: [0, -1.05, 0], color: P.plinth, cluster: "table", layer: 1, pick: false });
      dio.add({ id: "rim", size: [HX * 2 + 0.7, 0.12, HZ * 2 + 0.7], pos: [0, -0.2, 0], color: P.rim, cluster: "table", layer: 2, emissive: true, pick: false });
      if (sx) stadium();
    }
    tv = terrainView(dio, t, {
      bands: endless ? desertBands(P, endless.biome.bi) : look ? look.bands(P as Parameters<typeof look.bands>[0]) : [[0.45, P.ground[0]!], [0.85, P.ground[1]!], [1.25, P.ground[2]!], [99, P.crest]], steep: 0.5, steepColor: P.steep, kinds: look ? look.kinds(P as Parameters<typeof look.kinds>[0]) : [P.track, P.face],
      light: P.light, ambient: P.amb, lod: endless ? [14, 26] : td ? TD_LOD : TW !== TRACK_W ? [19, 36] : [24, 44], shadows: RIDERS + 1, shadowColor: P.shadow,
      // (MX and SX tracks, on bigger tables, step their detail down sooner: about the same faces a frame.)
      // The endless grounds split each cell along its flatter diagonal (crests fold straight); the
      // window's own height queries (../desert/world.ts) use the same rule, so the bike rides the drawn face.
      split: endless ? "adaptive" : "fixed",
    });
    if (dv) {
      dv.build(P);
      dio.decal("terrain", 1, (c2) => dv.paintGrid(c2, me.pos[0]!, me.pos[2]!, P.grid, P.night ? GRID_A.night : GRID_A.day));
      dio.decal("terrain", 2, (c2) => dv.paintFog(c2, me.pos[0]!, me.pos[2]!, dv.hazeColor(), FOG));
      dio.decal("terrain", 3, (c2) => dv.paintFar(c2));
      FOG.g = null;
    } else dio.decal("terrain", 1, td ? paintCircuit : paintLines);
    if (look) look.build(dio, t, P as Parameters<typeof look.build>[2]);
    else if (td) circuitScenery();
    else if (!endless) trackScenery();
    // The riders: the player first, in the profile's colours and kit.
    for (let r = 0; r < RIDERS; r++) {
      // Online: every person in their own garage colours and kit; the AI in the track's teams.
      const L = net && r < humans ? net.looks[r]! : null;
      const col = L ? { ...P.kit, ...L.look } : r ? { ...P.kit, ...P.teams[r]! } : { ...P.kit, ...ctx.look };
      rigs.push(rig(dio, "rider" + r, col, L ? L.rig : r ? rigKind(sim.riders[r]!.power) : ctx.bike.rig, L ? L.helmet : r ? "peak" : ctx.helmet, L ? L.model : r ? undefined : ctx.bike.model.id));
    }
    dust = pool(dio, DUST, P.dust, 4);
    roost = pool(dio, ROOST, P.dust, 5);
    spark = pool(dio, SPARK, P.spark, 6);
    sky = null;
    pose();
  }

  /** SX: the stadium round the floor: a wall on each side (the near one low, so the chase camera sees
   *  over it), a banner strip along each with the sponsor-free panel lights, rigs of lamps overhead. */
  function stadium() {
    const walls: [number, number, number, number, number][] = [[0, -HZ - 0.5, HX * 2 + 1.6, 0.6, 2.4], [0, HZ + 0.5, HX * 2 + 1.6, 0.6, 1.1], [-HX - 0.5, 0, 0.6, HZ * 2 + 1.6, 1.8], [HX + 0.5, 0, 0.6, HZ * 2 + 1.6, 1.8]];
    walls.forEach(([x, z, w, d, h], k) => {
      dio.add({ id: "sw" + k, size: [w, h, d], pos: [x, -0.6, z], color: P.plinth, cluster: "sw" + k, pick: false });
      dio.add({ size: [w + 0.02, 0.22, d + 0.02], pos: [0, -0.5, 0], on: "sw" + k, color: k & 1 ? P.banner : P.rim, emissive: P.night, pick: false });
      // Panels along the wall: lit blocks every few metres.
      const n = Math.floor(Math.max(w, d) / 4);
      for (let q = 0; q < n; q++) {
        const u = (q + 0.5) / n - 0.5;
        dio.add({ size: [w > d ? 1.6 : w + 0.04, 0.42, w > d ? d + 0.04 : 1.6], pos: [w > d ? u * w : 0, -h * 0.55, w > d ? 0 : u * d], on: "sw" + k, color: q & 1 ? P.edge : P.edge2, emissive: P.night, pick: false });
      }
    });
    // The lighting rigs: two trusses over the floor with their lamps.
    for (const z of [-HZ * 0.45, HZ * 0.45]) {
      const id = "truss" + (z > 0 ? 1 : 0);
      dio.add({ id, size: [HX * 1.6, 0.25, 0.25], pos: [0, 9.5, z], color: P.tower, cluster: id, pick: false });
      for (let q = 0; q < 6; q++) dio.add({ size: [0.45, 0.3, 0.45], pos: [(q / 5 - 0.5) * HX * 1.5, -0.55, 0], on: id, color: P.lamp, emissive: true, pick: false });
    }
  }
  /** The race track's scenery: tuff blocks, light towers, the start gate and the lap line's arch, pylons. */
  function trackScenery() {
    // Tuff blocks round the outside of each turn, glowing at night.
    for (let i = 0; i < NT; i += 3) {
      if (!TURN[i]) continue;
      const yaw = YAW[i]!, nx = Math.sin(yaw), nz = Math.cos(yaw), d = (TW / 2 + 1.5) * TURN[i]!, x = TRACK[i * 2]! + nx * d, z = TRACK[i * 2 + 1]! + nz * d, id = "tf" + i;
      dio.add({ id, size: [0.55, 0.32, 0.36], pos: [x, t.height(x, z) - 0.05, z], rot: [0, yaw, 0], color: P.tuff, pick: false });
      dio.add({ size: [0.57, 0.07, 0.38], on: id, color: P.tuffTop, emissive: P.night, pick: false });
    }
    // Light towers at the corners, their lamps aimed in.
    for (const [x, z] of [[-HX + 1.4, -HZ + 1.4], [HX - 1.4, -HZ + 1.4], [-HX + 1.4, HZ - 1.4], [HX - 1.4, HZ - 1.4]] as const) {
      const id = "tw" + x + z;
      dio.add({ id, shape: "cyl", sides: 6, size: [0.3, 4.2, 0.3], pos: [x, t.height(x, z) - 0.1, z], color: P.tower, pick: false });
      dio.add({ size: [1.3, 0.5, 0.25], pos: [0, 0, 0], rot: [0, Math.atan2(-z, x) + Math.PI / 2, 0], on: id, color: P.tower, pick: false });
      dio.add({ size: [1.1, 0.34, 0.27], pos: [0, 0.08, 0], rot: [0, Math.atan2(-z, x) + Math.PI / 2, 0], on: id, color: P.lamp, emissive: true, pick: false, layer: 9 });
    }
    // The start gate: a beam across the track and a drop bar in front of each lane; the lap line's arch.
    {
      const i = Math.round(GATE_S / (LAP / NT)), x = TRACK[i * 2]!, z = TRACK[i * 2 + 1]!, yaw = YAW[i]!, w = TW + 0.8;
      dio.add({ id: "gate", shape: "group", size: [0.4, 0, w], pos: [x, t.height(x, z), z], rot: [0, yaw, 0], pick: false });
      dio.add({ size: [0.16, 0.12, w], pos: [0.1, 0, 0], on: "gate", color: P.gatePost, pick: false });
      for (const zz of [-w / 2, w / 2]) dio.add({ shape: "cyl", sides: 6, size: [0.2, 0.7, 0.2], pos: [0.1, 0, zz], on: "gate", color: P.gatePost, pick: false });
      for (let k = 0; k < 4; k++) {
        const gid = "gb" + k, lane = [-0.35, -1.15, 0.45, 1.25][k]!;
        const g = dio.add({ id: gid, shape: "group", size: [0.1, 0, 0.6], pos: [0.18, 0.12, lane], on: "gate", pick: false });
        dio.add({ size: [0.06, 0.5, 0.62], pos: [0, 0, 0], on: gid, color: P.gate, pick: false });
        dio.add({ size: [0.065, 0.12, 0.63], pos: [0, 0.36, 0], on: gid, color: P.gateBar, emissive: P.night, pick: false });
        gateBars.push(g);
      }
    }
    {
      const i = Math.round(LINE_S / (LAP / NT)), x = TRACK[i * 2]!, z = TRACK[i * 2 + 1]!, yaw = YAW[i]!, w = TW + 1.6;
      dio.add({ id: "arch", shape: "group", size: [0.4, 0, w], pos: [x, t.height(x, z), z], rot: [0, yaw, 0], pick: false });
      for (const zz of [-w / 2, w / 2]) dio.add({ shape: "cyl", sides: 6, size: [0.22, 3.1, 0.22], pos: [0.6, 0, zz], on: "arch", color: P.gatePost, pick: false });
      dio.add({ size: [0.2, 0.5, w + 0.2], pos: [0.6, 3.1, 0], on: "arch", color: P.banner, emissive: P.night, pick: false });
      for (let k = 0; k < 10; k++) dio.add({ size: [0.22, 0.18, w / 10], pos: [0.6, 2.92 + (k & 1 ? 0 : 0.18), -w / 2 + (k + 0.5) * (w / 10)], on: "arch", color: k & 1 ? P.ink : P.check, pick: false, layer: 9 });
    }
    // Pylons along the straights (neon tips at night).
    for (let i = 8; i < NT; i += 14) {
      if (TURN[i]) continue;
      const yaw = YAW[i]!, side = (i / 14) & 1 ? 1 : -1, d = TW / 2 + 1.1, x = TRACK[i * 2]! + Math.sin(yaw) * d * side, z = TRACK[i * 2 + 1]! + Math.cos(yaw) * d * side, id = "py" + i;
      dio.add({ id, shape: "cyl", sides: 6, size: [0.14, 0.8, 0.14], pos: [x, t.height(x, z), z], color: P.gatePost, pick: false });
      dio.add({ shape: "cyl", sides: 6, size: [0.22, 0.16, 0.22], pos: [0, 0, 0], on: id, color: side > 0 ? P.edge : P.edge2, emissive: true, pick: false });
    }
  }

  // ---- Track Day: the circuit's paint (kerbs, lines, the grid, the pit lane) and its buildings ----
  /** Per point: 1 where a kerb runs (round every corner, a little past each end). The kerbs' inner
   *  and outer edges (both sides: [side × 2 + edge] × NT points) and the edge lines (just inside the
   *  asphalt), each [x, y, z] per point; the kerb points on the screen this frame ([x, y], NaN off it). */
  const KB = new Uint8Array(td ? NT : 0), KP = new Float64Array(td ? NT * 12 : 0), EL = new Float64Array(td ? NT * 6 : 0), KS = new Float64Array(td ? NT * 8 : 0);
  /** The pit lane's quad, the start line's chequer and the grid boxes ([x, y, z] corners), the gantry's lamps. */
  const PITQ = new Float64Array(12), CHQ = new Float64Array(td ? 2 * 3 * 3 * 15 : 0), GRIDL = new Float64Array(td ? 4 * 24 : 0), LAMPS: DioramaObject[] = [];
  const TDL = new Float64Array(2); // [lamps lit, the lap's start on the clock]
  TDL[0] = -1;
  /** Which way the loop goes round: +1 anticlockwise (left-handed), −1 clockwise; the pits are inside. */
  let LOOP_DIR = 1;
  if (td) {
    const T0 = (track as Track), CW = T0.W / 2, KW = 0.8;
    let tot = 0;
    for (let i = 0; i < NT; i++) {
      let d = YAW[(i + 1) % NT]! - YAW[i]!;
      d -= TAU * Math.floor(d / TAU + 0.5);
      tot += d;
      for (let a = -4; a <= 4 && !KB[i]; a++) if (TURN[(i + a + NT) % NT]) KB[i] = 1;
    }
    LOOP_DIR = tot > 0 ? 1 : -1;
    const at = (out: Float64Array, o: number, i: number, d: number, lift = 0.03) => {
      const x = TRACK[i * 2]! + Math.sin(YAW[i]!) * d, z = TRACK[i * 2 + 1]! + Math.cos(YAW[i]!) * d;
      (out[o] = x), (out[o + 1] = t.height(x, z) + lift), (out[o + 2] = z);
    };
    for (let i = 0; i < NT; i++)
      for (let k = 0; k < 2; k++) at(KP, k * 2 * NT * 3 + i * 3, i, (k ? 1 : -1) * CW), at(KP, (k * 2 + 1) * NT * 3 + i * 3, i, (k ? 1 : -1) * (CW + KW)), at(EL, k * NT * 3 + i * 3, i, (k ? 1 : -1) * (CW - 0.22));
    // The pit lane: inside the main straight (section 0), from just past the last corner to short of the first.
    const main = typeof T0.def.plan[0] === "number" ? (T0.def.plan[0] as number) : 30, step = LAP / NT, inside = -LOOP_DIR;
    const p0 = Math.round(4 / step), p1 = Math.round(Math.min(main - 6, GATE_S + 60) / step), d0 = inside * (CW + TD_RUNOFF + 0.7), d1 = inside * (CW + TD_RUNOFF + 3.9);
    at(PITQ, 0, p0, d0, 0.02), at(PITQ, 3, p1, d0, 0.02), at(PITQ, 6, p1, d1, 0.02), at(PITQ, 9, p0, d1, 0.02);
    // The start line: a chequer two squares deep across the asphalt (14 squares), at the lap line.
    const li = Math.round(LINE_S / step);
    for (let rw = 0; rw < 3; rw++) for (let q = 0; q < 15; q++) at(CHQ, (rw * 15 + q) * 3, (li + rw) % NT, -CW + (q / 14) * 2 * CW, 0.04);
    // The grid boxes: a line across each slot just ahead of its front wheel and its two sides back.
    const gi = Math.round(GATE_S / step) - 1;
    for (let k = 0; k < 4; k++) {
      const lane = TD_GRID[k]![0] * (CW - 1), g = gi - Math.round(TD_GRID[k]![1] / step), f = g + 3, b = g - 1, o = k * 24;
      at(GRIDL, o, f, lane - 0.75, 0.04), at(GRIDL, o + 3, f, lane + 0.75, 0.04);
      at(GRIDL, o + 6, f, lane - 0.75, 0.04), at(GRIDL, o + 9, b, lane - 0.75, 0.04);
      at(GRIDL, o + 12, f, lane + 0.75, 0.04), at(GRIDL, o + 15, b, lane + 0.75, 0.04);
    }
  }
  const tdc = () => (P.night ? TD_C.dark : TD_C.light);
  /** Track Day's buildings: the start/finish gantry and its lights, the pit wall, the garages, two
   *  grandstands, tyre walls round the outside of every corner, light towers. */
  function circuitScenery() {
    const C = tdc(), T0 = track as Track, CW = T0.W / 2, step = LAP / NT, inside = -LOOP_DIR, edge = CW + TD_RUNOFF;
    LAMPS.length = 0;
    TDL[0] = -1;
    const fits = (x: number, z: number, m = 1) => Math.abs(x) < HX - m && Math.abs(z) < HZ - m;
    const spot = (i: number, d: number) => [TRACK[i * 2]! + Math.sin(YAW[i]!) * d, TRACK[i * 2 + 1]! + Math.cos(YAW[i]!) * d] as const;
    // Tyre walls round the outside of each corner (red and white stacks), off the run-off.
    for (let i = 0; i < NT; i += 3) {
      if (!TURN[i]) continue;
      const [x, z] = spot(i, (edge + 0.45) * TURN[i]!);
      if (!fits(x, z)) continue;
      dio.add({ shape: "cyl", sides: 6, size: [0.62, 0.5, 0.62], pos: [x, t.height(x, z) - 0.02, z], color: (i / 3) & 1 ? P.tuff : P.tuffTop, pick: false });
    }
    // The start/finish gantry over the line: two posts, the beam, the banner and the start lights.
    {
      const i = Math.round(LINE_S / step), [x, z] = spot(i, 0), w = (CW + TD_RUNOFF) * 2 + 0.6;
      dio.add({ id: "gantry", shape: "group", size: [0.4, 0, w], pos: [x, t.height(x, z), z], rot: [0, YAW[i]!, 0], pick: false });
      for (const zz of [-w / 2, w / 2]) dio.add({ size: [0.36, 4.2, 0.36], pos: [0, 0, zz], on: "gantry", color: C.wall, pick: false });
      dio.add({ size: [0.5, 0.7, w + 0.4], pos: [0, 4.2, 0], on: "gantry", color: C.wall, pick: false });
      dio.add({ size: [0.52, 0.22, w + 0.42], pos: [0, 4.62, 0], on: "gantry", color: P.banner, emissive: P.night, pick: false });
      for (let k = 0; k < 12; k++) dio.add({ size: [0.54, 0.12, (w + 0.4) / 12], pos: [0, 4.84 + (k & 1 ? 0 : 0.12), -(w + 0.4) / 2 + (k + 0.5) * ((w + 0.4) / 12)], on: "gantry", color: k & 1 ? P.ink : P.check, pick: false, layer: 9 });
      // Three pairs of start lights on the beam's face toward the grid: on, one pair a second; out at GO.
      for (let k = 0; k < 6; k++) LAMPS.push(dio.add({ size: [0.1, 0.36, 0.36], pos: [-0.28, 4.36, (k < 3 ? -1 : 1) * (0.5 + (k % 3) * 0.55)], on: "gantry", color: C.lampOff, emissive: true, pick: false, layer: 10 }));
    }
    // The pit wall between the run-off and the pit lane, the garages behind the lane.
    {
      const p0 = Math.round(4 / step), main = typeof T0.def.plan[0] === "number" ? (T0.def.plan[0] as number) : 30, p1 = Math.round(Math.min(main - 6, GATE_S + 60) / step);
      const pm = (p0 + p1) >> 1, len = (p1 - p0) * step, [wx, wz] = spot(pm, inside * (edge + 0.35));
      if (fits(wx, wz)) {
        dio.add({ id: "pitwall", size: [len, 0.75, 0.3], pos: [wx, t.height(wx, wz) - 0.05, wz], rot: [0, YAW[pm]!, 0], color: C.wall, pick: false });
        dio.add({ size: [len + 0.02, 0.1, 0.32], on: "pitwall", color: C.wallTop, emissive: P.night, pick: false });
      }
      const n = Math.max(3, Math.min(8, Math.floor(len / 5)));
      for (let q = 0; q < n; q++) {
        const i = Math.round(p0 + ((q + 0.5) / n) * (p1 - p0)), [gx, gz] = spot(i, inside * (edge + 6.1)), id = "garage" + q;
        if (!fits(gx, gz, 1.6)) continue;
        dio.add({ id, size: [len / n - 0.4, 2.2, 3.2], pos: [gx, t.height(gx, gz) - 0.05, gz], rot: [0, YAW[i]!, 0], color: C.garage, pick: false });
        dio.add({ size: [len / n - 1.4, 1.5, 0.05], pos: [0, -2, -inside * 1.62], on: id, color: C.door, emissive: P.night, pick: false });
        dio.add({ size: [len / n - 0.3, 0.16, 3.4], on: id, color: q & 1 ? P.banner : C.wallTop, emissive: P.night, pick: false });
      }
    }
    // Grandstands: one along the outside of the main straight by the line, one round the outside of the first corner.
    const stand = (i: number, side: number, len: number, id: string) => {
      const C2 = tdc();
      for (let tier = 0; tier < 3; tier++) {
        const [x, z] = spot(i, side * (edge + 1.3 + tier * 1.05));
        if (!fits(x, z, 0.8)) return;
        const tid = id + tier;
        dio.add({ id: tid, size: [len, 0.6 + tier * 0.55, 1.05], pos: [x, t.height(x, z) - 0.05, z], rot: [0, YAW[i]!, 0], color: tier & 1 ? C2.stand2 : C2.stand, pick: false });
        dio.add({ size: [len - 0.2, 0.14, 0.5], pos: [0, 0, side * 0.2], on: tid, color: C2.seats[tier]!, emissive: P.night, pick: false });
      }
      const [x, z] = spot(i, side * (edge + 3.4));
      if (!fits(x, z)) return;
      dio.add({ id: id + "r", size: [len + 0.4, 0.14, 3.6], pos: [x, t.height(x, z) + 3.1, z], rot: [0, YAW[i]!, 0], color: C2.roof, pick: false });
    };
    stand(Math.round(LINE_S / step) + Math.round(6 / step), LOOP_DIR, Math.min(26, (typeof T0.def.plan[0] === "number" ? (T0.def.plan[0] as number) : 30) * 0.45), "gs");
    {
      let i = 0;
      while (i < NT && !TURN[i]) i++;
      let j = i;
      while (j < NT && TURN[j] === TURN[i]) j++;
      const mid = (i + j) >> 1;
      stand(mid, TURN[mid]! || 1, Math.max(6, Math.min(18, (j - i) * step * 0.6)), "gt");
    }
    // Light towers at the table's corners (lit at night).
    for (const [x, z] of [[-HX + 1.4, -HZ + 1.4], [HX - 1.4, -HZ + 1.4], [-HX + 1.4, HZ - 1.4], [HX - 1.4, HZ - 1.4]] as const) {
      const id = "tw" + x + z;
      dio.add({ id, shape: "cyl", sides: 6, size: [0.3, 5.2, 0.3], pos: [x, t.height(x, z) - 0.1, z], color: P.tower, pick: false });
      dio.add({ size: [1.6, 0.6, 0.25], pos: [0, 0, 0], rot: [0, Math.atan2(-z, x) + Math.PI / 2, 0], on: id, color: P.tower, pick: false });
      dio.add({ size: [1.4, 0.4, 0.27], pos: [0, 0.1, 0], rot: [0, Math.atan2(-z, x) + Math.PI / 2, 0], on: id, color: P.lamp, emissive: true, pick: false, layer: 9 });
    }
  }
  /** The start lights: a pair lit per second of the countdown, all out at GO. */
  function lights() {
    if (!race || !LAMPS.length) return;
    const lit = race.phase === GRID ? Math.max(0, Math.min(3, 4 - Math.ceil(race.count))) : 0;
    if (lit === TDL[0]) return;
    TDL[0] = lit;
    const C = tdc();
    for (let k = 0; k < 6; k++) LAMPS[k]!.color = k % 3 < lit ? C.lampOn : C.lampOff;
  }
  /** Track Day's paint on the asphalt (a decal over the ground): the pit lane, the kerbs (red and
   *  white, a metre a stripe), the edge lines, the start line's chequer and the grid boxes. Batched:
   *  one fill per colour, one stroke per run of line segments of about the same width on screen. */
  function paintCircuit(c2: CanvasRenderingContext2D) {
    const C = tdc(), f = dio.focal(), Wd = dio.width, Hd = dio.height;
    c2.lineCap = "butt";
    c2.lineJoin = "round";
    // The pit lane.
    poly(c2, PITQ, 0, 4, C.pit);
    // The kerbs (quads between their inner and outer edges): the white band, then the red stripes
    // over it, one path each; the edge lines.
    for (let q = 0; q < NT * 4; q++) {
      const side = q >= NT * 2 ? 1 : 0, e = q & 1, i = (q >> 1) % NT, a = ((side * 2 + e) * NT + i) * 3, o = q * 2;
      if (!KB[i] || !dio.project(KP[a]!, KP[a + 1]!, KP[a + 2]!, tmp) || tmp[2]! < 0.5) KS[o] = NaN;
      else (KS[o] = tmp[0]!), (KS[o + 1] = tmp[1]!);
    }
    for (let pass = 0; pass < 2; pass++) {
      c2.fillStyle = pass ? C.kerb : C.kerb2;
      c2.beginPath();
      for (let side = 0; side < 2; side++)
        for (let i = 0; i < NT; i++) {
          if (pass && !((i >> 1) & 1)) continue;
          const j = (i + 1) % NT, a = (side * NT * 2 + i * 2) * 2, b = (side * NT * 2 + j * 2) * 2;
          const ax = KS[a]!, ay = KS[a + 1]!, ox = KS[a + 2]!, oy = KS[a + 3]!, bx = KS[b]!, by = KS[b + 1]!, px = KS[b + 2]!, py = KS[b + 3]!;
          if (ax !== ax || ox !== ox || bx !== bx || px !== px) continue;
          if ((ax < 0 && bx < 0 && ox < 0) || (ax > Wd && bx > Wd && ox > Wd) || (ay < 0 && by < 0 && oy < 0) || (ay > Hd && by > Hd && oy > Hd)) continue;
          c2.moveTo(ax, ay);
          c2.lineTo(bx, by);
          c2.lineTo(px, py);
          c2.lineTo(ox, oy);
          c2.closePath();
        }
      c2.fill();
    }
    c2.lineCap = "round";
    for (let k = 0; k < 2; k++) strip(c2, EL, k * NT * 3, C.line, 0.14, f, Wd, Hd);
    c2.lineCap = "butt";
    // The start line: white, then the black squares.
    c2.fillStyle = C.line;
    c2.beginPath();
    for (let rw = 0; rw < 2; rw++) quad(c2, CHQ, rw * 15, 1, 13, Wd, Hd);
    c2.fill();
    c2.fillStyle = P.ink;
    c2.beginPath();
    for (let rw = 0; rw < 2; rw++) for (let q = rw & 1; q < 14; q += 2) quad(c2, CHQ, rw * 15 + q, 1, 0, Wd, Hd);
    c2.fill();
    // The grid boxes.
    c2.strokeStyle = C.line;
    for (let k = 0; k < 4; k++) {
      const o = k * 24;
      if (!dio.project(GRIDL[o]!, GRIDL[o + 1]!, GRIDL[o + 2]!, tmp) || tmp[2]! < 0.5) continue;
      c2.lineWidth = Math.max(1, (f * 0.12) / tmp[2]!);
      c2.beginPath();
      for (let q = 0; q < 3; q++) {
        if (!dio.project(GRIDL[o + q * 6]!, GRIDL[o + q * 6 + 1]!, GRIDL[o + q * 6 + 2]!, tmp) || tmp[2]! < 0.5 || !dio.project(GRIDL[o + q * 6 + 3]!, GRIDL[o + q * 6 + 4]!, GRIDL[o + q * 6 + 5]!, tmp2) || tmp2[2]! < 0.5) continue;
        c2.moveTo(tmp[0]!, tmp[1]!);
        c2.lineTo(tmp2[0]!, tmp2[1]!);
      }
      c2.stroke();
    }
  }
  /** A filled polygon of `n` corners from A (at offset o, xyz each); skipped if a corner is behind the eye. */
  function poly(c2: CanvasRenderingContext2D, A: Float64Array, o: number, n: number, color: string) {
    c2.beginPath();
    for (let k = 0; k < n; k++) {
      const a = o + k * 3;
      if (!dio.project(A[a]!, A[a + 1]!, A[a + 2]!, tmp) || tmp[2]! < 0.5) return;
      if (k) c2.lineTo(tmp[0]!, tmp[1]!);
      else c2.moveTo(tmp[0]!, tmp[1]!);
    }
    c2.fillStyle = color;
    c2.fill();
  }
  /** Square q of the chequer (row-major, 15 corners a row), `extra` more squares wide, as a closed
   *  subpath of the path under way (mode 0 begins a path first). Skipped off the screen or behind the eye. */
  function quad(c2: CanvasRenderingContext2D, A: Float64Array, q: number, mode: number, extra: number, Wd: number, Hd: number) {
    if (!mode) c2.beginPath();
    const w = extra + 1;
    const a = q * 3, b = (q + w) * 3, cc = (q + w + 15) * 3, d = (q + 15) * 3;
    if (!dio.project(A[a]!, A[a + 1]!, A[a + 2]!, tmp) || tmp[2]! < 0.5) return;
    if (tmp[0]! < -Wd || tmp[0]! > Wd * 2 || tmp[1]! < -Hd || tmp[1]! > Hd * 2) return;
    if (!dio.project(A[b]!, A[b + 1]!, A[b + 2]!, tmp2) || tmp2[2]! < 0.5 || !dio.project(A[cc]!, A[cc + 1]!, A[cc + 2]!, tmp3) || tmp3[2]! < 0.5 || !dio.project(A[d]!, A[d + 1]!, A[d + 2]!, tmp4) || tmp4[2]! < 0.5) return;
    c2.moveTo(tmp[0]!, tmp[1]!);
    c2.lineTo(tmp2[0]!, tmp2[1]!);
    c2.lineTo(tmp3[0]!, tmp3[1]!);
    c2.lineTo(tmp4[0]!, tmp4[1]!);
    c2.closePath();
  }
  /** A line round the loop (NT points of A from offset o), `wu` wide in world units. */
  function strip(c2: CanvasRenderingContext2D, A: Float64Array, o: number, color: string, wu: number, f: number, Wd: number, Hd: number) {
    c2.strokeStyle = color;
    let open = false, w0 = 0, last = -2;
    for (let i = 0; i < NT; i++) {
      const j = (i + 1) % NT;
      const a = o + i * 3, b = o + j * 3;
      if (!dio.project(A[a]!, A[a + 1]!, A[a + 2]!, tmp) || tmp[2]! < 0.5 || !dio.project(A[b]!, A[b + 1]!, A[b + 2]!, tmp2) || tmp2[2]! < 0.5) continue;
      if ((tmp[0]! < 0 && tmp2[0]! < 0) || (tmp[0]! > Wd && tmp2[0]! > Wd) || (tmp[1]! < 0 && tmp2[1]! < 0) || (tmp[1]! > Hd && tmp2[1]! > Hd)) continue;
      const w = Math.max(1, (f * wu) / tmp[2]!);
      if (open && (w > w0 * 1.25 || w < w0 * 0.8)) c2.stroke(), (open = false);
      if (!open) c2.beginPath(), (c2.lineWidth = w0 = w), (open = true), (last = -2);
      if (last !== i - 1) c2.moveTo(tmp[0]!, tmp[1]!);
      c2.lineTo(tmp2[0]!, tmp2[1]!);
      last = i;
    }
    if (open) c2.stroke();
  }

  // ---- state ----
  const I = new Float64Array(7), GP = new Float64Array(8), DRAGA = new Float64Array(1), tmp = new Float64Array(3), tmp2 = new Float64Array(3), tmp3 = new Float64Array(3), tmp4 = new Float64Array(3);
  // Pointer: down, start x, start y, x, y, id.
  const PD = new Float64Array(6);
  PD[5] = -1;
  // [0] measure, [1] theme, [2] (unused), [3] safe top, [4] safe bottom, [5] drawn once, [6] a pad seen, [7] the width framed.
  const V = new Float64Array(8);
  V[0] = V[1] = 1;
  let blinkT = 0, resetQ = 0;
  let view = ctx.attract ? 1 : 0, auto = !!ctx.auto || !!ctx.attract, dirty = true, hudDirty = true, shake = 0, toastT = 0, gateT = 0, endAt = -1, emitK = 0, paused = false, ended = false, led = true, chaseSet = false;
  const was = new Float64Array(10).fill(-1);
  const TABLE = { yaw: 0, pitch: 0.82, dist: 40, tx: 0, ty: 0, tz: 0.6, ox: 0, oy: 0, fov: 0.62 };
  // The chase framing is fixed for the whole event (set once, from the stage's shape at the start):
  // no zoom with speed or air, no refit when a phone's address bar comes and goes.
  const chaseO = { dist: 9.5, pitch: 0.36, lift: 0.9, ahead: 0.3, rate: 3.4, turn: 2.6, side: 0.62, snap: !!ctx.reduced };
  const VEL = new Float64Array(3), CTP = new Float64Array(3), target = { pos: CTP, yaw: 0, vel: VEL };
  // Resizes are debounced; only a change of width refits the framing (a height-only change is the
  // mobile URL bar: the canvas follows, the camera does not).
  let rzT: ReturnType<typeof setTimeout> | 0 = 0;
  const ro = new ResizeObserver(() => {
    if (rzT) clearTimeout(rzT);
    rzT = setTimeout(() => ((rzT = 0), (V[0] = 1), engine.wake()), V[5] ? 150 : 0);
  });
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  const padHello = () => ((V[6] = 1), engine.wake());
  addEventListener("gamepadconnected", padHello, sig);
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect(), vox.close(), rzT && clearTimeout(rzT)), { once: true });

  // Online: after a correction a remote rider is drawn where it was and eases to where it is (OFF:
  // its offset, x y z a rider; OLD: the places before the correction).
  const OFF = new Float64Array(RIDERS * 3), OLD = new Float64Array(RIDERS * 3);
  // Online: each rider's callout over their head (a trick, a regroup) and how long it shows; this
  // screen's commands (END sticky, REGROUP frames left).
  const CALLT = new Float64Array(RIDERS), CALLS: string[] = [], CMDQ = new Uint8Array(2);
  const friend = (r: number, text: string) => void ((CALLS[r] = text), (CALLT[r] = 1.8), (dirty = true));
  const shift = (r: number, k: number) => {
    const b = sim.riders[r]!, x = OFF[r * 3]! * k, y = OFF[r * 3 + 1]! * k, z = OFF[r * 3 + 2]! * k;
    b.pos[0] = b.pos[0]! + x; b.pos[1] = b.pos[1]! + y; b.pos[2] = b.pos[2]! + z;
    b.rider[0] = b.rider[0]! + x; b.rider[1] = b.rider[1]! + y; b.rider[2] = b.rider[2]! + z;
    for (let i = 0; i < 2; i++) (b.wheel[i * 3] = b.wheel[i * 3]! + x), (b.wheel[i * 3 + 1] = b.wheel[i * 3 + 1]! + y), (b.wheel[i * 3 + 2] = b.wheel[i * 3 + 2]! + z);
  };
  function pose() {
    for (let r = 0; r < RIDERS; r++) {
      const b = sim.riders[r]!, g = rigs[r]!;
      if (net) shift(r, 1);
      // The trick pose and the whip from the rider's own stunts: this seat's drag eased, a friend's
      // (online, endless) straight from their run's state, the same on every screen.
      const rs = r === seat ? st : roam ? jam!.runs[r]!.st : null;
      if (rs) rs.pose(g.T, r === seat ? DRAGA[0]! : rs.HD[1] ? 1 : 0);
      g.pose(b, b.air > 0 || Math.abs(b.speed) > 5 ? 0.85 : 0.35);
      // The whip: the bike kicked out sideways in the air.
      if (rs && rs.whip !== 0 && !b.crashed) (g.root.rot[0] = g.root.rot[0]! + rs.whip * 0.95), (g.root.rot[1] = g.root.rot[1]! + rs.whip * 0.3);
      if (net) shift(r, -1);
      // Endless together: a friend past this screen's ground (its window) is a marker, not a bike in the haze.
      if (roam && r !== seat) {
        const dx = b.pos[0]! - me.pos[0]!, dz = b.pos[2]! - me.pos[2]!, far = dx * dx + dz * dz > 34 * 34;
        g.root.alpha = far ? 0 : 1;
        if (far) continue;
      }
      const x = b.pos[0]!, z = b.pos[2]!, inside = Math.abs(x) < HX && Math.abs(z) < HZ, lift = inside ? b.pos[1]! - t.height(x, z) : 9;
      tv.shadow(r, x, z, 0.95, inside ? Math.max(0, 0.36 - lift * 0.09) : 0);
    }
    walkHud.update(me);
    const drop = free ? 1 : Math.min(1, gateT / 0.28);
    for (const g of gateBars) g.rot[2] = -1.5 * drop * drop;
    if (td) lights();
  }

  // ---- FX ----
  function stepFx(dt: number) {
    let any = false;
    for (let r = 0; r < RIDERS; r++) {
      const b = sim.riders[r]!;
      if (b.crashed || !b.contact[0] || ctx.reduced) continue;
      // Dust from the rear by how hard it digs; a roost of dirt thrown back when it spins.
      // (On Track Day's asphalt no dust: tyre smoke, only when the rear spins up.)
      const d = (td ? b.slip * 0.5 : b.dust) * (r !== seat ? 0.6 : 1);
      emitK += d * 55 * dt;
      while (emitK >= 1) {
        emitK -= 1;
        dust.puff(b.wheel[0]! + (rnd() - 0.5) * 0.3, b.wheel[1]! - 0.25, b.wheel[2]! + (rnd() - 0.5) * 0.3, -b.cy * b.speed * 0.12 + (rnd() - 0.5), 0.4 + rnd() * 0.6, b.sy * b.speed * 0.12 + (rnd() - 0.5), 0.6 + rnd() * 0.5, 0.11, 0.4);
      }
      if (!td && b.slip > 0.1 && rnd() < b.slip) roost.puff(b.wheel[0]!, b.wheel[1]! - 0.2, b.wheel[2]!, -b.cy * (3 + rnd() * 3), 2 + rnd() * 2.5, b.sy * (3 + rnd() * 3), 0.5 + rnd() * 0.3, 0.05, 0.9);
    }
    if (st) {
      // The drags: the hand eases down; sparks off the hand on the road, and off the fender.
      const dg = st.HD[1]! > 0 && !me.crashed ? 1 : 0, was0 = DRAGA[0]!;
      DRAGA[0] = ctx.reduced ? dg : was0 + (dg - was0) * Math.min(1, dt * 10);
      if (Math.abs(DRAGA[0]! - dg) > 0.01 || st.amount > 0 || st.whip !== 0) any = true;
      if (!ctx.reduced && (dg || st.fender)) {
        const w = me.wheel, fx = me.cy, fz = -me.sy;
        for (let q = 0; q < (st.fender ? 3 : 1); q++) spark.puff(w[0]! - fx * 0.3 + (rnd() - 0.5) * 0.2, w[1]! - 0.3, w[2]! - fz * 0.3 + (rnd() - 0.5) * 0.2, -fx * me.speed * 0.5 + (rnd() - 0.5) * 3, 1.5 + rnd() * 2.5, -fz * me.speed * 0.5 + (rnd() - 0.5) * 3, 0.2 + rnd() * 0.25, 0.035, 1);
        any = true;
      }
    }
    if (dust.step(dt, -0.4, 0.22, 0.32)) any = true;
    if (roost.step(dt, 14, 0.02, 0.9, 0.4)) any = true;
    if (spark.step(dt, 14, -0.05, 1)) any = true;
    return any;
  }

  // ---- events from the sim: stickers, sound, FX ----
  function events() {
    for (let k = 0; k < sim.n; k++) {
      const type = sim.ev[k * 3]!, r = sim.ev[k * 3 + 1]!, val = sim.ev[k * 3 + 2]!, b = sim.riders[r]!;
      hudDirty = true;
      if (type === E_COUNT) engine.events.emit("count"), toast("" + val, "go");
      else if (type === E_GATE) (gateT = 0.001), (TDL[1] = 0), engine.events.emit("gate"), toast(td ? "LIGHTS OUT!" : "GATE DROP!", "go"), say("Go");
      else if (type === E_LAP && r === seat && race) {
        if (race.place(seat) !== 0) led = false;
        engine.events.emit("lap");
        // Track Day: the lap's time (and a best lap, the rider's on this circuit or this race's).
        if (td) toast(`${val === LAPS - 1 ? "LAST LAP" : `LAP ${val + 1}/${LAPS}`} · ${lapLine()}`, "go"), say(`Lap ${val + 1}`);
        else toast(val === LAPS - 1 ? "LAST LAP!" : `LAP ${val + 1}/${LAPS}`, "go"), say(`Lap ${val + 1}`);
      } else if (type === E_PLACE && r === seat && race && race.phase === RACE && !(toastT > 0.5 && toastEl.className.endsWith("bad"))) toast(ORD[val]!, val < race.place(seat) ? "go" : "meh"), engine.events.emit("pass");
      else if (type === E_LAND) {
        if (r !== seat || me.crashed) continue;
        const clean = val < 0.25;
        engine.events.emit("land");
        if (me.landAir > 0.45) toast(`${me.landAir.toFixed(2)}s AIR · ${clean ? "CLEAN" : "SKETCHY"}`, clean ? "clean" : "meh");
        if (!ctx.reduced) dust.ring(rnd, me.pos[0]!, me.pos[1]! - 0.6, me.pos[2]!, clean ? 8 : 14, 2.2, 1, 0.8, 0.2, 0.55);
      } else if (type === E_TRICK && r === seat) toast(val === 2 ? "FLIP! LANDED" : "BIG AIR!", "clean"), say(val === 2 ? "Flip" : "Big air");
      else if (type === E_WHEELIE && r === seat && val > 0.6 && !st) toast(`WHEELIE ${val.toFixed(1)}s`, "clean"), engine.events.emit("wheelie");
      else if (type === E_GROUND && tsc && r === seat) {
        // Endless: a ground trick banked (as Endless Wheelie City's).
        const kind = val, x = tsc[T_CB]! > 0 ? ` ×${1 + tsc[T_CB]!}` : "", pts = tsc[T_PTS]!.toLocaleString("en-US");
        engine.events.emit("wheelie");
        if (kind === STOPPIE || kind === 3) toast(`${GROUND[kind]} +${pts}${x}`, "meh");
        else toast(`${GROUND[kind]} ${tsc[T_DIST]!.toFixed(1)} m · ${tsc[T_TIME]!.toFixed(1)}s +${pts}${x}`, kind === MANUAL ? "clean" : "go");
        say(`${GROUND[kind]}, ${tsc[T_PTS]} points`);
      } else if (type === E_DRAG && st && r === seat) {
        const nm = DRAG_NAME[val]!, x = st.mult(val);
        engine.events.emit("wheelie");
        if (val === FENDER && !ctx.reduced) shake = 0.3;
        call.show(`${nm}!`, `×${x} · ${val === FENDER ? "SPARKS!" : "BACK UNDER 12 TO BANK"}`, val === FENDER ? "bad" : "go", 1.4);
        say(`${nm}! Times ${x}. Bring it back under twelve to bank it`);
      } else if (type === E_BANKED && st && r === seat) {
        engine.events.emit("finish");
        call.show(`${DRAG_NAME[st.lastLevel]!} BANKED`, `+${val.toLocaleString("en-US")}`, "go");
        toast(`BANKED! +${val.toLocaleString("en-US")}`, "clean");
        say(`Banked ${val} points`);
      } else if (type === E_LOST && st && r === seat) toast(`LOOPED OUT — LOST ${val.toLocaleString("en-US")}`, "bad"), call.hide(), say(`Looped out. ${val} points lost`);
      else if (type === E_TRICK && net) friend(r, val === 2 ? "FLIP!" : "BIG AIR!");
      else if (type === E_WHEELIE && net && !st && val > 1) friend(r, `WHEELIE ${val.toFixed(1)}s`);
      else if (type === E_GROUND && net && r !== seat) friend(r, GROUND[val] ?? "TRICK");
      else if (type === E_DRAG && net && r !== seat) friend(r, `${DRAG_NAME[val]!}!`);
      else if (type === E_BANKED && net && r !== seat) friend(r, `BANKED +${val.toLocaleString("en-US")}`);
      else if (type >= E_STUNT && type < E_STUNT + 10 && jam) {
        // The combo button, the whips, an air banked (../stunts.ts), forwarded by the jam: this seat's
        // as its own callouts, a friend's over their head.
        if (r === seat) stuntCall(type - E_STUNT, val, jam.runs[r]!.st, call, say, (n) => engine.events.emit(n === "cheer" ? "finish" : "wheelie"));
        else { const f = friendStunt(type - E_STUNT, val, jam.runs[r]!.st); if (f) friend(r, f); }
      } else if (type === E_REGROUP) {
        if (r === seat) CTP.set(me.pos), (target.yaw = me.yaw), chase(dio.cam, target, { ...chaseO, snap: true }, 1 / 60), toast(seat ? "WITH THE HOST" : "REGROUP", "go");
        else friend(r, "REGROUPED");
      }
      else if (type === E_CRASH) {
        if (r === seat) (shake = ctx.reduced ? 0 : 0.5), toast(CRASH_NAME[val] || "WIPEOUT!", "bad"), say(CRASH_NAME[val] || "Wipeout"), call.hide();
        engine.events.emit("crash");
        if (!ctx.reduced) {
          for (let q = 0; q < 22; q++) {
            const a = rnd() * TAU, u = 0.4 + rnd();
            spark.puff(b.pos[0]!, b.pos[1]!, b.pos[2]!, Math.cos(a) * 4 * u, 2 + rnd() * 4, Math.sin(a) * 4 * u, 0.5 + rnd() * 0.5, 0.07, 1);
          }
          dust.ring(rnd, b.pos[0]!, b.pos[1]! - 0.4, b.pos[2]!, 18, 3, 1.2, 1, 0.24, 0.6);
        }
      } else if (type === E_STUCK && r === seat) stuckEl.hidden = !val;
      else if (type === E_RESET && r === seat) {
        stuckEl.hidden = true;
        CTP.set(me.pos);
        target.yaw = me.yaw;
        chase(dio.cam, target, { ...chaseO, snap: true }, 1 / 60);
        blinkT = 1.2;
        toast(val === 2 ? "UNSTUCK · BACK ON IT" : "RESET", "go");
      } else if (type === E_RESPAWN && r === seat) {
        CTP.set(me.pos);
        chase(dio.cam, target, { ...chaseO, snap: view === 1 }, 1 / 60);
        toast("BACK ON IT", "go");
      } else if (type === E_FINISH && r === seat) {
        engine.events.emit("finish");
        if (race) toast(`FINISH · ${ORD[val]}${td ? " · " + lapLine() : ""}`, val ? "go" : "clean"), say(`Finished ${ORD[val]}`);
        else if (roam) toast("RIDE BANKED · RIDE ON WHILE THE OTHERS DO", "clean"), say("Ride banked");
        else if (jam) toast(`TIME · ${ORD[jam.place(seat)]}`, "clean"), say(`Time. ${ORD[jam.place(seat)]}`);
        else toast("RIDE BANKED", "clean"), say("Ride banked");
        // (Online the match ends the ride for everyone at once: the shell shows the result.)
        if (!net) endAt = engine.time + (race ? 1.6 : 0.8);
        engine.busy(1.7);
      }
    }
    if (st) stuntCalls(st, call, say, (n) => engine.events.emit(n === "cheer" ? "finish" : "wheelie"));
    sim.clear();
  }
  /** Track Day: the lap just done, "0:24.3", with BEST LAP! when it is the circuit's best (or the first). */
  function lapLine() {
    const now = race!.clock, lt = now - TDL[1]!, best = ctx.best ?? 0;
    TDL[1] = now;
    return `${clock(lt)}${lt <= race!.bestLap(seat) + 1e-9 && (!best || lt < best) ? " · BEST LAP!" : ""}`;
  }
  function toast(text: string, kind: string) {
    toastEl.textContent = text;
    toastEl.className = "mt-toast mt-" + kind;
    toastEl.hidden = false;
    toastT = 1.4;
  }
  let said = "";
  function say(s: string) {
    if (s === said) s += " ";
    live.textContent = said = s;
  }
  const clock = (s: number) => `${(s / 60) | 0}:${(s % 60).toFixed(1).padStart(4, "0")}`;
  function hudWrite() {
    const ph = sim.phase;
    if (jamOnly) {
      const pl = jamOnly.place(seat), pts = jamOnly.points(seat);
      if (was[0] !== pl) (was[0] = pl), (posEl.textContent = ORD[pl]!);
      if (was[1] !== pts) (was[1] = pts), (lapEl.textContent = `${pts.toLocaleString("en-US")} PTS`);
    } else if (race) {
      const pl = race.place(seat), lap = race.lap(seat);
      if (was[0] !== pl) (was[0] = pl), (posEl.textContent = ORD[pl]!);
      if (was[1] !== lap || was[5] !== ph) (was[1] = lap), (was[5] = ph), (lapEl.textContent = ph === DONE ? "FINISHED" : lap === LAPS ? "LAST LAP" : `LAP ${lap}/${LAPS}`);
    } else if (endless) {
      const k = Math.floor(fr!.distance / 10);
      if (was[1] !== k) (was[1] = k), (lapEl.textContent = km(fr!.distance) + (fr!.distance > (ctx.best ?? 0) && (ctx.best ?? 0) > 0 ? " · BEST!" : ""));
      const pts = tsc![T_SC]!, cb = tsc![T_CB]!;
      if (was[8] !== pts + cb * 1e9) (was[8] = pts + cb * 1e9), (scoreChip!.firstChild!.textContent = `${pts.toLocaleString("en-US")} PTS`), (scoreChip!.lastChild!.textContent = cb > 0 ? `×${1 + cb}` : "");
      const HD = st!.HD, dk = HD[1] ? HD[1]! * 1e8 + Math.floor(HD[2]! / 10) : -1;
      if (was[9] !== dk) (was[9] = dk), (dragChip!.hidden = dk < 0), dk >= 0 && (dragChip!.firstChild!.textContent = `${DRAG_NAME[HD[1]!]} ×${st!.mult(HD[1]!)} · ${Math.round(HD[2]!).toLocaleString("en-US")} AT RISK`);
    } else {
      const a = Math.floor(m.M[3]! * 10);
      if (was[1] !== a) (was[1] = a), (lapEl.textContent = `${(a / 10).toFixed(1)}s AIR`);
    }
    speedW(me.speed);
    const tenths = Math.floor((jamOnly ? jamOnly.left : fr ? fr.clock : sim.clock) * 10);
    if (was[2] !== tenths) (was[2] = tenths), (timeEl.textContent = clock(tenths / 10));
    const touch = !!thePad.el.offsetParent;
    const hint = roam
      ? ph === GRID ? (touch ? "Ride together: no edge, no clock · the regroup key finds the others · pause ❚❚ banks it" : "Ride together: no edge, no clock · G regroups · E (or pause) banks it") : ""
      : jam
      ? ph === GRID ? "Trick points: big air, flips, long wheelies · most in three minutes wins" : ""
      : free
      ? ph === GRID ? (endless ? (touch ? `Hold GAS: ${endless.biome.id === "desert" ? "the desert" : "it"} never ends · pause ❚❚ banks it` : `Space to ride: ${endless.biome.id === "desert" ? "the desert" : "it"} never ends · E (or pause) banks it`) : touch ? "Hold GAS and ride anywhere · pause ❚❚ banks it" : "Space to ride, anywhere · E (or pause) banks it") : endless && ph === RACE && sim.clock < 6 ? (touch ? "Hop: flick the stick back, then forward" : "L hops · W/S lean · A/D steer") : ""
      : ph === GRID ? (td ? (touch ? "Hold GAS to rev · go when the lights go out" : "Hold Space to rev · go when the lights go out") : touch ? "Hold GAS to rev · it drops on GO" : "Hold Space to rev · it drops on GO") : ph === RACE && sim.clock < 6 ? (touch ? "Stick: lean and steer · back lifts the front" : "W/S lean · A/D steer · Space gas · K brake") : "";
    if (hintEl.textContent !== hint) hintEl.textContent = hint;
  }
  function stats() {
    if (race) {
      // Track Day: the circuit's name and, when the best lap beats the one kept, a new record.
      const bl = race.bestLap(seat), rec = td && bl > 0 && (!ctx.best || bl < ctx.best);
      return m.stats({ place: race.place(seat), time: race.finishTime(seat), bestLap: bl, led: led && race.place(seat) === 0, finished: race.finished(seat), where: track.id, order: [0, 1, 2, 3].map((r) => race.place(r)), summary: `${td ? (track as Track).name + " · " : ""}${ORD[race.place(seat)]} · ${clock(race.finishTime(seat) || race.clock)}${bl ? ` · best lap ${clock(bl)}` : ""}${rec ? " · NEW CIRCUIT BEST" : ""}` });
    }
    if (jamOnly) return m.stats({ finished: jamOnly.phase === DONE, where: track.id, tricks: jamOnly.tricks(seat), flips: jamOnly.flips(seat), score: jamOnly.points(seat), place: jamOnly.place(seat), summary: `${ORD[jamOnly.place(seat)]} · ${jamOnly.points(seat).toLocaleString("en-US")} trick points · ${m.M[3]!.toFixed(1)}s in the air` });
    if (endless) return m.stats({ finished: true, where: track.id, farKey: endless.biome.id, tricks: fr!.tricks, flips: fr!.flips, far: fr!.distance, score: tsc![T_SC]!, summary: `${km(fr!.distance)} ${endless.biome.word} · ${clock(sim.clock)} ridden · ${m.M[3]!.toFixed(1)}s in the air${fr!.tricks ? ` · ${fr!.tricks} ${fr!.tricks === 1 ? "trick" : "tricks"}` : ""}${tsc![T_SC]! ? ` · ${tsc![T_SC]!.toLocaleString("en-US")} trick points` : ""}` });
    return m.stats({ finished: true, where: track.id, tricks: fr!.tricks, flips: fr!.flips, summary: `${map ? map.name + " · " : ""}${clock(sim.clock)} ridden · ${m.M[3]!.toFixed(1)}s in the air · ${m.M[4]!.toFixed(1)}s on one wheel${fr!.tricks ? ` · ${fr!.tricks} ${fr!.tricks === 1 ? "trick" : "tricks"}` : ""}` });
  }
  function end() {
    endAt = -1;
    if (ended || ctx.attract) return;
    ended = true;
    setView(0);
    ctx.end(stats());
  }

  // ---- camera: the table view (the whole track) or the chase view behind the bike ----
  function frameTable() {
    if (endless) {
      const tall = dio.height / dio.width > 0.75;
      if (!chaseSet) (chaseSet = true), (chaseO.dist = tall ? 10.5 : 9), (chaseO.pitch = tall ? 0.42 : 0.3);
      return;
    }
    const pts = [-HX - 0.4, -1.1, -HZ - 0.4, HX + 0.4, -1.1, -HZ - 0.4, -HX - 0.4, -1.1, HZ + 0.4, HX + 0.4, -1.1, HZ + 0.4, -HX, 2.4, -HZ, HX, 2.4, -HZ];
    const W = dio.width, H = dio.height, tall = H / W > 0.75;
    TABLE.yaw = tall ? -0.55 : 0;
    TABLE.pitch = tall ? 0.98 : 0.8;
    TABLE.dist = 38;
    TABLE.tx = TABLE.ty = TABLE.ox = TABLE.oy = 0;
    TABLE.tz = 0.4;
    dio.fit(TABLE, pts, { x0: 8, y0: V[3]!, x1: W - 8, y1: H - V[4]! });
    if (!chaseSet) (chaseSet = true), (chaseO.dist = tall ? 10.5 : 9), (chaseO.pitch = tall ? 0.46 : 0.36);
  }
  function stepCam(dt: number) {
    const cam = dio.cam, b = me;
    target.yaw = b.crashed ? target.yaw : b.yaw;
    const src = b.crashed ? b.rider : b.pos;
    CTP[0] = Math.max(-HX - 1, Math.min(HX + 1, src[0]!));
    CTP[1] = Math.max(-1, src[1]!);
    CTP[2] = Math.max(-HZ - 1, Math.min(HZ + 1, src[2]!));
    VEL[0] = b.cy * b.speed; VEL[1] = 0; VEL[2] = -b.sy * b.speed;
    if (view) {
      const mv = chase(cam, target, chaseO, dt), k = 1 - Math.exp(-4 * dt);
      cam.ox -= cam.ox * k;
      cam.oy -= cam.oy * k;
      return mv || Math.abs(cam.ox) + Math.abs(cam.oy) > 0.2;
    }
    const k = ctx.reduced ? 1 : 1 - Math.exp(-2.6 * dt);
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
    if (endless) n = 1;
    view = n;
    paintView(viewK, !n);
    dirty = true;
    engine.busy(2.5);
    engine.wake();
  }

  // ---- drawing: the sky, the track's neon edges, the tach and balance sticker ----
  let skyY = -1;
  function paintSky(ctx2: CanvasRenderingContext2D) {
    const W = dio.width, H = dio.height;
    if (dv) {
      // The sky down to the horizon (the eye's level), its last colour the haze's.
      const yh = Math.max(4, Math.min(H - 4, dv.horizon()));
      if (!sky || Math.abs(yh - skyY) > 2) {
        skyY = yh;
        sky = ctx2.createLinearGradient(0, 0, 0, yh);
        sky.addColorStop(0, P.sky0);
        sky.addColorStop(0.55, P.sky1);
        sky.addColorStop(1, P.sky2);
      }
      ctx2.fillStyle = sky;
      ctx2.fillRect(0, 0, W, skyY);
      ctx2.fillStyle = P.sky2;
      ctx2.fillRect(0, skyY, W, H - skyY);
      if (P.night) {
        ctx2.fillStyle = P.star;
        for (let i = 0; i < 120; i += 3) {
          ctx2.globalAlpha = 0.2 + STARS[i + 2]! * 0.6;
          ctx2.fillRect(STARS[i]! * W, STARS[i + 1]! * skyY * 0.9, 1.5, 1.5);
        }
        ctx2.globalAlpha = 1;
      }
      // The sun on the horizon, a little to the side (it turns with the view: it is far away).
      const r = Math.min(W, H) * 0.16, sx = W * 0.5 + Math.sin(dio.cam.yaw - 0.9) * W * 1.2;
      if (sx > -r && sx < W + r) {
        ctx2.globalAlpha = P.night ? 0.85 : 0.5;
        ctx2.fillStyle = P.night ? "#ff3d8b" : "#ffd27a";
        ctx2.beginPath();
        ctx2.arc(sx, skyY, r, Math.PI, 0);
        ctx2.fill();
        ctx2.fillStyle = P.sky1;
        for (let k = 0; k < 5; k++) ctx2.fillRect(sx - r, skyY - r * (0.12 + k * 0.17), r * 2, r * (0.025 + k * 0.012));
        ctx2.globalAlpha = 1;
      }
      return;
    }
    if (!sky) {
      sky = ctx2.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, P.sky0);
      sky.addColorStop(0.6, P.sky1);
      sky.addColorStop(1, P.sky2);
    }
    ctx2.fillStyle = sky;
    ctx2.fillRect(0, 0, W, H);
    if (P.night) {
      ctx2.fillStyle = P.star;
      for (let i = 0; i < 120; i += 3) {
        ctx2.globalAlpha = 0.2 + STARS[i + 2]! * 0.6;
        ctx2.fillRect(STARS[i]! * W, STARS[i + 1]! * H * 0.55, 1.5, 1.5);
      }
      // A neon horizon grid, far behind the table.
      ctx2.globalAlpha = 0.35;
      ctx2.strokeStyle = P.grid;
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      for (let k = 1; k < 7; k++) {
        const y = H * (0.5 + k * k * 0.012);
        ctx2.moveTo(0, y);
        ctx2.lineTo(W, y);
      }
      for (let k = -8; k <= 8; k++) {
        ctx2.moveTo(W / 2 + k * W * 0.04, H * 0.5);
        ctx2.lineTo(W / 2 + k * W * 0.2, H);
      }
      ctx2.stroke();
      ctx2.globalAlpha = 1;
      look?.sky?.(ctx2, W, H, P as Parameters<NonNullable<typeof look.sky>>[3]);
    } else {
      // Two soft clouds.
      ctx2.fillStyle = "#ffffff";
      ctx2.globalAlpha = 0.7;
      for (let k = 0; k < 2; k++) {
        const x = W * (0.2 + k * 0.55), y = H * (0.14 + k * 0.06), r = Math.min(W, H) * 0.05;
        ctx2.beginPath();
        ctx2.arc(x, y, r, 0, TAU);
        ctx2.arc(x + r * 1.1, y + r * 0.2, r * 0.8, 0, TAU);
        ctx2.arc(x - r * 1.0, y + r * 0.3, r * 0.7, 0, TAU);
        ctx2.fill();
      }
      ctx2.globalAlpha = 1;
      look?.sky?.(ctx2, W, H, P as Parameters<NonNullable<typeof look.sky>>[3]);
    }
  }
  function paintLines(ctx2: CanvasRenderingContext2D) {
    ctx2.lineCap = "round";
    const f = dio.focal();
    for (let q = 0; q < LINES.length; q++) {
      const Ln = LINES[q]!, E = Ln.p, n = Ln.n, last = Ln.closed ? n : n - 1;
      ctx2.strokeStyle = (P as Record<string, unknown>)[Ln.c] as string;
      ctx2.globalAlpha = Ln.a;
      if (Ln.a < 1) {
        // A faint line: one thin path (overlapping round caps would bead), broken where y is NaN or behind the eye.
        ctx2.lineWidth = Math.max(1, dio.width / 900);
        ctx2.beginPath();
        let pen = false;
        for (let i = 0; i <= last; i++) {
          const a = (i % n) * 3, y = E[a + 1]!;
          if (y !== y || !dio.project(E[a]!, y, E[a + 2]!, tmp) || tmp[2]! < 0.5) pen = false;
          else if (pen) ctx2.lineTo(tmp[0]!, tmp[1]!);
          else ctx2.moveTo(tmp[0]!, tmp[1]!), (pen = true);
        }
        ctx2.stroke();
        continue;
      }
      for (let i = 0; i < last; i++) {
        const a = i * 3, b = ((i + 1) % n) * 3;
        if (!dio.project(E[a]!, E[a + 1]!, E[a + 2]!, tmp) || tmp[2]! < 0.5 || !dio.project(E[b]!, E[b + 1]!, E[b + 2]!, tmp2) || tmp2[2]! < 0.5) continue;
        ctx2.lineWidth = Math.max(1, (f * 0.16) / tmp[2]!);
        ctx2.beginPath();
        ctx2.moveTo(tmp[0]!, tmp[1]!);
        ctx2.lineTo(tmp2[0]!, tmp2[1]!);
        ctx2.stroke();
      }
    }
    ctx2.globalAlpha = 1;
  }
  /** Online: every other rider's name over their head (and a callout) in their colours; on an
   *  endless ground, a friend off the screen is an arrow on its edge (../../online/tags.ts). */
  function drawTags(ctx2: CanvasRenderingContext2D) {
    const fs = tagFont(ctx2, dio.width);
    for (let r = 0; r < RIDERS; r++) {
      if (r === seat || !TAGS[r]) continue;
      const b = sim.riders[r]!, src = b.crashed ? b.rider : b.pos, q = r * 3, col = r < humans ? net!.looks[r]!.look.plastic : P.teams[r % 4]!.plastic;
      const dx = src[0]! - me.pos[0]!, dz = src[2]! - me.pos[2]!, d = Math.sqrt(dx * dx + dz * dz);
      if ((!roam || d < 34) && tag(ctx2, dio, src[0]! + OFF[q]!, src[1]! + OFF[q + 1]! + 1.25, src[2]! + OFF[q + 2]!, CALLT[r]! > 0 ? `${TAGS[r]} · ${CALLS[r]}` : TAGS[r]!, col, P.ink, fs)) continue;
      if (roam) marker(ctx2, dio, me.pos, dx, dz, d, TAGS[r]!, col, P.ink, fs, V[3]! + 20, ctx.units);
    }
  }
  /** The tach (revs, the power band lit) and, up on the back wheel, the balance meter: a Board UI sticker. */
  function drawOverlay(ctx2: CanvasRenderingContext2D) {
    if (net) drawTags(ctx2);
    if (ctx.attract || (sim.phase !== RACE && sim.phase !== GRID)) return;
    const W = dio.width, H = dio.height, s = Math.max(0.8, Math.min(1.2, W / 720)), w = 168 * s, h = 46 * s, x = 10, y = H - V[4]! - h - 6;
    ctx2.fillStyle = P.ink;
    ctx2.beginPath();
    ctx2.roundRect(x + 3, y + 3, w, h, 8);
    ctx2.fill();
    ctx2.fillStyle = P.meter;
    ctx2.strokeStyle = P.ink;
    ctx2.lineWidth = 2;
    ctx2.beginPath();
    ctx2.roundRect(x, y, w, h, 8);
    ctx2.fill();
    ctx2.stroke();
    // Revs: 16 segments; the curve's strongest band glows.
    const pw = me.power, n = 16, sw = (w - 20 * s) / n, rpm = me.rpm;
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n, cv = pw.curve, ci = Math.min(cv.length - 1, Math.round(u * (cv.length - 1))), band = cv[ci]! > 0.85;
      ctx2.fillStyle = u <= rpm ? (band ? P.hot : P.ok) : band ? (P.night ? "#3a2240" : "#ffd9d9") : P.night ? "#2a2545" : "#e8e4f0";
      ctx2.fillRect(x + 10 * s + k * sw, y + 8 * s, sw - 2, 10 * s);
    }
    ctx2.fillStyle = P.night ? "#e9e6ff" : "#1b1420";
    ctx2.font = `900 ${Math.round(10 * s)}px ui-rounded, system-ui, sans-serif`;
    ctx2.textBaseline = "middle";
    ctx2.textAlign = "left";
    const up = me.contact[0] && !me.contact[1] && me.rel > 0.1;
    if (!up) {
      ctx2.fillText(`${pw.name} · GEAR ${me.gear + 1}`, x + 10 * s, y + 32 * s);
      return;
    }
    // Balance: the wheelie's angle on a bar, the balance point marked; past it, red.
    const bal = Math.max(0, Math.min(1.5, me.balance)), bx = x + 10 * s, bw = w - 20 * s, by = y + 26 * s, bh = 12 * s;
    ctx2.fillStyle = P.night ? "#2a2545" : "#e8e4f0";
    ctx2.fillRect(bx, by, bw, bh);
    ctx2.fillStyle = P.ok;
    ctx2.fillRect(bx + bw * (0.7 / 1.5), by, bw * (0.3 / 1.5), bh);
    ctx2.fillStyle = bal > 1 ? P.hot : P.ink;
    ctx2.fillRect(bx + bw * (bal / 1.5) - 2, by - 3, 4, bh + 6);
    ctx2.fillStyle = P.night ? "#e9e6ff" : "#1b1420";
    ctx2.textAlign = "right";
    ctx2.fillText(bal > 1 ? "BRAKE!" : me.wheelie.toFixed(1) + "s", x + w - 10 * s, by - 6 * s);
  }

  /** Inputs into I: keys and pad (controls), a gamepad, the pointer (hold for gas, drag to steer and
   *  lean). Online the link reads it once a frame (`input`); the autopilot rides on its own bit. */
  function readInput() {
    const drag = PD[0] ? Math.max(40, dio.width * 0.12) : 1;
    I[0] = c.down(GAS) || PD[0] || GP[2]! > 0.2 ? Math.max(c.down(GAS) || PD[0] ? 1 : 0, GP[2]!) : 0;
    I[1] = c.down(BRAKE) || GP[3]! > 0.2 ? 1 : 0;
    I[2] = (+c.down(BACK) - +c.down(FWD)) || (c.stick.active ? c.stick.y : 0) || GP[1]! || (PD[0] ? Math.max(-1, Math.min(1, (PD[4]! - PD[2]!) / drag)) : 0);
    I[3] = (+c.down(RIGHT) - +c.down(LEFT)) || (c.stick.active ? c.stick.x : 0) || GP[0]! || (PD[0] ? Math.max(-1, Math.min(1, (PD[3]! - PD[1]!) / drag)) : 0);
    I[4] = resetQ || c.down(RESETK) || GP[6]! > 0.5 ? RESET : 0;
    I[5] = endless && (c.down(COMBOK) || GP[7]! > 0.5) ? 1 : 0;
    // (The flick reads the stick's own lean: + forward there, + back in I[2].)
    I[6] = endless && (c.hit(HOPK) || GP[4]! > 0.5 || (c.stick.active && flk.step(-I[2]!))) ? 1 : 0;
    resetQ = 0;
    if (paused || ended) I.fill(0);
  }

  // ---- the loop ----
  const loop: Parameters<typeof engine.add>[0] = {
    read() {
      if (V[1]) {
        V[1] = 0;
        const next = document.documentElement.dataset.theme === "light" ? LT : DK;
        if (next !== P) (P = next), buildScene(), (dirty = true);
      }
      if (V[0]) {
        V[0] = 0;
        const sr = stage.getBoundingClientRect(), hr = head.getBoundingClientRect(), cr = getComputedStyle(canvas).position === "absolute" ? canvas.getBoundingClientRect() : sr;
        dio.resize(cr.width || 1, cr.height || 1, Math.min(2, devicePixelRatio || 1));
        sky = null;
        // Only a new width refits the table framing; the chase framing never changes mid-event.
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
      if (!net) readInput();
      const ph = sim.phase;
      // Online the link steps the sim (and reads I through `input`); remote riders ease in.
      let moving = true;
      if (net) {
        for (let i = 0; i < OFF.length; i++) OFF[i] = Math.abs(OFF[i]!) < 1e-4 ? 0 : OFF[i]! * 0.82;
        for (let r = 0; r < RIDERS; r++) if (CALLT[r]! > 0) CALLT[r] = Math.max(0, CALLT[r]! - dt);
      }
      else {
        moving = race ? race.step(dt, I, auto) : fr!.step(dt, I, auto);
        if (ph === RACE && !ended && !(race && race.finished(0))) m.tick(me, dt);
        if (sim.n || (st && st.n)) events(), (moving = true);
      }
      if (gateT > 0 && gateT < 0.3) (gateT += dt), (moving = true);
      if (stepFx(dt)) moving = true;
      if (call.step(dt)) moving = true;
      if (stepCam(dt)) moving = true;
      if (shake > 0) (shake = Math.max(0, shake - dt)), (moving = true);
      if (blinkT > 0) (blinkT = Math.max(0, blinkT - dt)), (moving = true);
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true), toastT === 0 && (toastEl.hidden = true);
      if (endAt > 0) moving = true;
      if (moving) e.busy(), (dirty = true), (hudDirty = true);
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      vox.set(me.rpm, me.throttle, (sim.phase === RACE || sim.phase === GRID) && !me.crashed && !paused && !ended, me.gear, me.speed);
      if (!dirty) return;
      dirty = false;
      pose();
      if (dv) dv.frame(me.pos[0]!, me.pos[2]!, P.night, engine.time);
      if (blinkT > 0) rigs[seat]!.root.alpha = Math.sin(engine.time * 30) > 0 ? 0.35 : 1;
      else if (rigs[seat]!.root.alpha !== 1) rigs[seat]!.root.alpha = 1;
      const cam = dio.cam, k = shake * shake * 10, sx = Math.sin(engine.time * 71) * k, sy = Math.cos(engine.time * 53) * k * 0.7;
      (cam.ox += sx), (cam.oy += sy);
      dio.draw();
      (cam.ox -= sx), (cam.oy -= sy), (V[5] = 1);
    },
  };
  engine.add(loop);

  // ---- input: keys on the stage, hold-and-drag on the play surface, the stickers ----
  const MAP: Record<string, string> = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "fwd", KeyW: "fwd", ArrowDown: "back", KeyS: "back", Space: "gas", KeyJ: "gas", KeyK: "brake", ShiftLeft: "brake", ShiftRight: "brake", KeyR: "reset", KeyC: "combo", ...(endless ? { KeyL: "hop" } : {}) };
  const keyHost: EventTarget = window;
  const src = (e: Event) => (e.composedPath?.()[0] ?? e.target) as Element | null;
  keyHost.addEventListener("keydown", (ev) => {
    const e = ev as KeyboardEvent;
    if (e.metaKey || e.ctrlKey || e.altKey || ctx.attract || paused || src(e)?.closest?.("input,textarea,select")) return;
    if (e.code === "KeyM") return void (e.preventDefault(), toggle());
    if (e.code === "KeyV") return void (e.preventDefault(), setView(view ? 0 : 1));
    if (e.code === "KeyE" && fr) return void (e.preventDefault(), roam ? (CMDQ[0] = CMD_END) : (fr.finish(), events()));
    if (e.code === "KeyG" && roam) return void (e.preventDefault(), (CMDQ[1] = 8));
    const k = MAP[e.code];
    if (!k || src(e)?.closest?.(".bui-pad") || ended) return;
    e.preventDefault();
    auto = false;
    wake();
    if (!e.repeat) c.press(k);
    engine.wake();
  }, sig);
  keyHost.addEventListener("keyup", (e) => {
    const k = MAP[(e as KeyboardEvent).code];
    if (k) c.press(k, false);
  }, sig);
  const wake = () => vox.wake(me.power);
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
  keysEl.querySelector(".mt-menu")!.addEventListener("click", () => ctx.menu(), sig);
  menuKeys(keysEl, engine.signal);
  keysEl.querySelector(".mt-reset")!.addEventListener("click", () => ((resetQ = 1), (auto = false), engine.wake()), sig);
  keysEl.querySelector(".mt-theme")?.addEventListener("click", () => ctx.theme?.(), sig);
  keysEl.querySelector(".mt-regroup")?.addEventListener("click", () => ((CMDQ[1] = 8), engine.wake()), sig);
  thePad.el.addEventListener("pointerdown", () => ((auto = false), wake(), engine.wake()), sig);

  // ---- start: the gate (Race) or the open table (Free Ride) ----
  buildScene();
  if (race && !net) race.go(ctx.bike.power);
  vox.use(me.power);
  setView(1);
  CTP.set(me.pos);
  target.yaw = me.yaw;
  chase(dio.cam, target, { ...chaseO, snap: true });
  engine.busy(4);
  engine.start();
  if (!ctx.attract) play.focus({ preventScroll: true });

  return {
    engine,
    get state() {
      const ph = sim.phase;
      return { phase: ph === GRID ? (free && !jam ? "ready" : "grid") : ph === RACE ? "run" : ph === DONE ? "done" : "idle", speed: me.speed, walking: me.walking, clock: sim.clock, lap: race ? race.lap(seat) : 0, place: race ? race.place(seat) : jam ? jam.place(seat) : 0, crashes: m.M[5]!, air: me.air, gas: I[0]!, brake: I[1]!, wheelie: me.wheelie, view: view ? "chase" : "table", count: race ? race.count : jam ? jam.count : 0, ended, riders: RIDERS, map: track.id, tricks: fr ? fr.tricks : jam ? jam.tricks(seat) : 0, seat, points: jam ? jam.points(seat) : 0, steer: I[3]!, steerAngle: me.steerAngle, x: me.pos[0]!, z: me.pos[2]!, y: me.pos[1]!, distance: fr ? fr.distance : 0, stuck: fr ? fr.stuck : false, upright: !me.crashed && Math.abs(me.rel) < 0.5, tiles: dv ? endless!.world.stats[0]! : 0, faces: tv.stats.faces, score: tsc ? tsc[T_SC]! : 0, drag: st ? st.HD[1]! : 0, stunt: st ? st.trick : -1, whip: st ? st.whip : 0, flicks: flk.n, down: !me.crashed && !!me.contact[0] && !!me.contact[1] };
    },
    get auto() {
      return auto;
    },
    set auto(on: boolean) {
      auto = on;
      engine.wake();
    },
    get camera() {
      return { dist: view ? dio.cam.dist : chaseO.dist, fov: dio.cam.fov, view: view ? "chase" : "table" };
    },
    finish() {
      if (ended) return;
      if (roam) CMDQ[0] = CMD_END;
      else if (fr) fr.finish(), events();
      else end();
    },
    stats,
    pause(on: boolean) {
      if (paused === on || ended) return;
      paused = on;
      PD[0] = 0;
      if (on) rock.release();
      // (Online the ride goes on: pausing only lets go of the bike.)
      if (net) return;
      if (on) engine.stop();
      else engine.start();
    },
    destroy: () => engine.destroy(),
    input: () => (readInput(), I),
    /** END (sticky, once pressed), REGROUP (a few frames after a press), the combo button (held), a hop. */
    cmd() {
      let c = CMDQ[0]! | (I[5] ? CMD_COMBO : 0) | (I[6] ? CMD_HOP : 0);
      if (CMDQ[1]! > 0) (c |= CMD_REGROUP), (CMDQ[1] = CMDQ[1]! - 1);
      return c;
    },
    events() {
      events();
      dirty = hudDirty = true;
      engine.busy();
    },
    rewind(before: boolean) {
      for (let r = 0; r < RIDERS; r++) {
        if (r === seat) continue;
        const b = sim.riders[r]!, q = r * 3, src = b.crashed ? b.rider : b.pos;
        if (before) (OLD[q] = src[0]! + OFF[q]!), (OLD[q + 1] = src[1]! + OFF[q + 1]!), (OLD[q + 2] = src[2]! + OFF[q + 2]!);
        else {
          // Big jumps (a respawn) snap; small ones ease.
          const dx = OLD[q]! - src[0]!, dy = OLD[q + 1]! - src[1]!, dz = OLD[q + 2]! - src[2]!, far = dx * dx + dy * dy + dz * dz > 9;
          (OFF[q] = far ? 0 : dx), (OFF[q + 1] = far ? 0 : dy), (OFF[q + 2] = far ? 0 : dz);
        }
      }
    },
    tags(names: string[]) {
      for (let i = 0; i < names.length; i++) TAGS[i] = names[i]!;
      dirty = true;
    },
    probe: {
      /** Step the ride n times by dt without drawing, as the loop does (a long autopilot ride in a test). */
      tick(n: number, dt = 1 / 60) {
        for (let q = 0; q < n; q++) loop.step!(engine, dt);
      },
      /** Draw now, as the loop does. */
      draw() {
        dirty = true;
        loop.render!(engine, 1);
      },
      /** Every part that draws faces while an ancestor is hidden (diorama's `hidden` hides only the
       *  object itself, never its parts: a pool's let-go camp, tent, beacon): [top's id, screen x, y]
       *  each, as of the last draw. */
      orphans() {
        const out: (string | number)[] = [];
        dio.recolor((ob) => {
          if (ob.shape === "group" || ob.hidden) return;
          let a = ob.alpha, top = ob, cut = false;
          for (let p = ob.parent; p; p = p.parent) (a *= p.alpha), (cut = cut || p.hidden), (top = p);
          if (a <= 0.01 || !cut) return;
          const m = ob.M, ok = dio.project(m[9]!, m[10]!, m[11]!, tmp);
          out.push(top.id ?? "?", ok ? Math.round(tmp[0]!) : NaN, ok ? Math.round(tmp[1]!) : NaN);
        });
        return out;
      },
    },
  };
}
