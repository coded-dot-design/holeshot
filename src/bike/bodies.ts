// The bike families' bodies, for ./rig.ts, all in the art's style (an inked side profile per main
// shape through the rig's `slab()`, the plate-colour block on each side of the widest one, flat colours
// that read at 64 px), from one set of shared pieces (`tools`): a gas dirt bike (`dirt`: the shared
// base), the other families (`body`), and LOOK, the per-model table (what one model does differently).
// Every body is built from the rig's own `part` on the rig's layers and groups (BodyKit), so it sits
// in the same draw order: its body on the centre plane, the exhaust on the right side's group, the
// fenders and the tail on their wheel's level. Wheels, swingarm and forks are the rig's, for every bike.
// - Electric bikes: no tank, no exhaust. A pedal e-bike is a bicycle (thin tubes in the paint, a
//   battery on the down tube, a hub motor at the cranks, a saddle on a post) or, per LOOK, a moto-style
//   frame with fenders; an electric dirt bike a moto frame round a big battery box with a lightning
//   bolt, the motor at the swingarm pivot, a flat cover where a tank would be.
// - Street bikes: a mini (a backbone, a fat little tank, a round lamp, a low pipe, a short tail), a
//   supersport (a full fairing with a belly pan, a screen and twin lamps, clip-ons, a high tail cowl,
//   an under-belly can) and a naked superbike (a trellis frame round a V4: the cases, two banks and
//   four headers, a muscled tank, a sharp tail, a round lamp, wide bars, a short side can).
// - Upgrades (`extras`): a wheelie bar off the back (the mini), a bigger motor and battery (an
//   electric's motor swap), cylinder fins (a gas bike's big bore kit), a charger and its intake (a
//   street bike's turbo). Original shapes, no badges. Cosmetic: builtin maths is fine here.
import type { DioramaObject } from "@fzlt/core/diorama";
import { mix } from "../colour.ts";
import type { RigColors } from "./rig.ts";

/** The bodies this file builds. */
export type BodyKind = "ebike" | "emoto" | "mini" | "sport" | "naked";
/** Upgrades that show on the bike (../data/economy.ts MODS). */
export type ShownUpgrade = "wbar" | "swap" | "bore" | "boost";

type PartOpts = { shape?: "box" | "wedge" | "cyl"; on?: string; rot?: number[]; sides?: number; top?: number; emissive?: boolean; layer?: number };
/** What the rig hands a body: its part maker, colours and the layers and groups to hang parts on. */
export interface BodyKit {
  part: (size: number[], pos: number[], color: string, o?: PartOpts) => DioramaObject;
  C: RigColors;
  /** Layers: the body on the centre plane, a side's parts (on `side`), a fender over its tyre (on `rear`/`front`). */
  body: number; near: number; fender: number;
  /** A side's group id (−1 left, +1 right; the exhaust side is +1) and z inset its group adds. */
  side: (s: -1 | 1) => string;
  inset: number;
  /** The rear and front wheels' level groups, and the x the rig's level groups move a part by. */
  rear: string; front: string; eo: number;
  /** A group `gid` (after the rig's id) on `on` (the bike), `z` × the side groups' offset across, dropping `drop` layers on the far side. */
  group: (gid: string, on?: string, z?: number, drop?: number) => DioramaObject;
  /** A side-profile slab with the art's ink edge (../bike/rig.ts), and the light alloy colour. */
  slab: (pts: number[][], w: number, z: number, color: string, o: { on?: string; layer: number }, ink?: number) => DioramaObject;
  alloy: string;
}
/** What a body gives back: the front fender (the rig rides it on the fork), where the side plates go,
 *  and where the tail light goes (default: the rig's). */
export interface Built { fender: DioramaObject; plates: [x: number, y: number]; tail?: [x: number, y: number] }

/** The art's ink: the dark edge round a bike's main shapes (as on the helmet portrait and the cover). */
export const INK = "#15121f";
/** What sets one model's look apart from its family's base: the upper fork tubes' colour (null: the
 *  alloy), a 2-stroke chamber's belly (×), a pedal e-bike's frame (`cycle`: a bicycle's thin tubes and
 *  painted chainstays; false: a moto-style frame with fenders), the battery's size (×), and an
 *  electric dirt bike's frame tubes in the second plastic (`tube2`; else the alloy). */
export interface BikeLook { fork: string | null; belly: number; cycle: boolean; cell: number; tube2: boolean }
/** The models drawn past their family's base, by model id (../data/roster.ts), only what differs;
 *  every other model (and a rival, which carries no model) is its family's base. */
export const LOOK: Record<string, Partial<BikeLook>> = {
  // YOWLER 250 2T: the class's top two-stroke, the fattest chamber.
  hivequeen: { belly: 1.15 },
  // CRIMSON 450 FACTORY: the factory team's gold forks.
  bulkhead: { fork: "#e2a62a" },
  // The pedal e-bikes: KIT FOX the plain alley bike; RED FOX a bigger battery and dark forks; ARCTIC
  // FOX and SILVER FOX a moto-style frame (SILVER the flagship: gold forks, the biggest battery).
  "pulse-pedal": { cell: 1.12, fork: "#2b2a3d" },
  arclight: { cycle: false },
  nightloop: { cycle: false, fork: "#e2a62a", cell: 1.12 },
  // The electric dirt bikes: ULTRA BUZZ bigger cells; GREYWOLF MX a frame in its orange and orange
  // forks; ALPHA WOLF the biggest battery and dark forks.
  gridrat: { cell: 1.1 },
  overcharge: { tube2: true, fork: "#ff8a3d" },
  "feral-coil": { cell: 1.15, fork: "#1b1a2c" },
  // STRIKER V4: gold forks.
  "bare-knuckle": { fork: "#e2a62a" },
};
/** Model `model`'s look on a bike of rig kind `kind` (its family's base where it has no entry). */
export const bikeLook = (kind: string, model?: string): BikeLook => ({ fork: null, belly: 1, cycle: kind === "ebike", cell: 1, tube2: false, ...(model ? LOOK[model] : null) });

/** `a` and `b` (`#rrggbb`) too close to tell apart at a glance. */
const near = (a: string, b: string) => { const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16); return Math.abs((p >> 16) - (q >> 16)) + Math.abs(((p >> 8) & 255) - ((q >> 8) & 255)) + Math.abs((p & 255) - (q & 255)) < 90; };

/** The shared pieces every body is drawn with (each body's own shapes go through these):
 *  - `t`: a plain tube on the centre plane; `bar`: a frame tube in profile, inked;
 *  - `sl`: a side-profile shape on the centre plane, inked (layer BODY + l, its ink 0.01 under it);
 *  - `pipe`: a round pipe on the exhaust's side group;
 *  - `block`: the plate-colour block, one per side, on the face of a `w`-wide inked shape coloured
 *    `base` (the second plastic where the plate is near `base`; a side group: under it on the far side);
 *  - `tail`, `front`: the tail and the front fender on their wheels' levels, inked;
 *  - `lamp`: a round headlight facing forward. */
function tools(k: BodyKit) {
  const { part, slab, C } = k, e = k.eo, B = (l: number) => ({ layer: k.body + l });
  const t = (ax: number, ay: number, bx: number, by: number, w: number, color: string, l = 0) => {
    const [s, p, r] = tube(ax, ay, bx, by, w);
    return part(s, p, color, { ...B(l), rot: r });
  };
  const sl = (pts: number[][], w: number, color: string, l: number) => slab(pts, w, 0, color, B(l));
  const bar = (ax: number, ay: number, bx: number, by: number, th: number, w: number, color: string, l: number) => {
    const a = Math.atan2(by - ay, bx - ax), nx = -Math.sin(a) * th / 2, ny = Math.cos(a) * th / 2;
    return sl([[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]], w, color, l);
  };
  /** A round pipe from (ax, ay) to (bx, by), `w` across at its start and × `top` at its end (it starts a
   *  little back, so the bends close), `z` out on the exhaust's side. */
  const pipe = (ax: number, ay: number, bx: number, by: number, w: number, top: number, color: string, l = 0, z = 0.17) => {
    const a = Math.atan2(by - ay, bx - ax), b = w * 0.35;
    return part([w, Math.hypot(bx - ax, by - ay) + b, w], [ax - Math.cos(a) * b, ay - Math.sin(a) * b, z - k.inset], color, { on: k.side(1), layer: k.near + l, shape: "cyl", sides: 8, top, rot: [0, 0, a - PI / 2] });
  };
  const block = (shapes: number[][][], w: number, base: string) => {
    const color = !near(C.plate, base) ? C.plate : !near(C.plastic2, base) ? C.plastic2 : C.plastic;
    for (const s of [-1, 1] as const) {
      const on = k.group(s < 0 ? ":sbL" : ":sbR", undefined, s, 1).id!;
      for (const pts of shapes) slab(pts, 0.006, s * (w / 2 + 0.002 - k.inset), color, { on, layer: k.body + 0.16 }, 0);
    }
  };
  const tail = (pts: number[][], color: string, w = 0.2, l = 0) => slab(pts.map(([a, b]) => [a! + e, b!]), w, 0, color, { on: k.rear, layer: k.fender + l });
  /** The front fender's group at x `x0` (the rig rides it on the fork), its shape (if any) on it. */
  const front = (x0: number, pts: number[][] | null, color: string, w = 0.15) => {
    const fender = k.group(":ff", k.front);
    fender.pos[0] = x0 - e;
    if (pts) slab(pts, w, 0, color, { on: fender.id!, layer: k.fender });
    return fender;
  };
  const lamp = (x: number, y: number, r: number, l = 0.1) => {
    part([r * 2, 0.07, r * 2], [x, y, 0], C.frame, { ...B(l), shape: "cyl", sides: 10, rot: [0, 0, -PI / 2] });
    part([r * 1.5, 0.02, r * 1.5], [x + 0.065, y, 0], LAMP, { ...B(l + 0.05), shape: "cyl", sides: 10, rot: [0, 0, -PI / 2], emissive: true });
  };
  /** The bars on a stem from the head (`up` above it, `w` wide). */
  const bars = (up: number, w: number) => {
    t(0.5, 0.16, 0.43, 0.16 + up, 0.05, C.frame);
    part([0.06, 0.06, w], [0.42, 0.16 + up, 0], C.frame, { ...B(0), rot: [0.22 * (C.bend ?? 0), 0.3 * (C.bend ?? 0), 0] });
  };
  return { t, sl, bar, pipe, block, tail, front, lamp, bars, B };
}

/** A gas dirt bike in the art's style, the shared base: an angled alloy frame round the engine (its
 *  cylinder leaning forward), one sculpted tank-and-shroud in the plastic with a block of the plate's
 *  colour on each shroud, a sloped seat, the side panel in the second plastic, a long tail and front
 *  fender, the front plate; the main shapes inked. A 2-stroke's identity: the silver expansion chamber
 *  curving down from the cylinder, back under the engine and up to its silencer; a 4-stroke's: a thin
 *  header round the front and a big side silencer under the seat. Wheels, swingarm and forks are the
 *  rig's (it draws every bike's in the same style). Layers on the centre plane, BODY + : 0 frame,
 *  engine, bars; 0.05–0.06 side panel; 0.08–0.09 tank and shroud; 0.11–0.12 seat; 0.14–0.15 front
 *  plate (each shape's ink 0.01 under it); 0.16 the shroud's colour block (a side group: under the
 *  tank on the far side). The exhaust is on the right side's group (NEAR, the silencer + 0.1). */
export function dirt(kind: "2t" | "4t", k: BodyKit, L: BikeLook): Built {
  const { part, C } = k, { t, sl, pipe, block, tail, front, bars, B } = tools(k);
  // The frame: a down tube and a spine from the steering head, the subframe up from the pivot.
  t(0.5, 0.12, 0.28, -0.44, 0.06, k.alloy);
  t(0.48, 0.17, -0.06, -0.24, 0.06, k.alloy);
  t(-0.04, -0.22, -0.6, 0.11, 0.05, k.alloy);
  // The engine: cases, the cylinder leaning forward (a 4-stroke's taller head).
  const four = kind === "4t";
  part([0.36, 0.24, 0.24], [0.04, -0.48, 0], mix(C.pipe, C.frame, 0.35), B(0.01));
  part(four ? [0.17, 0.25, 0.22] : [0.15, 0.2, 0.2], [0.15, -0.28, 0], k.alloy, { ...B(0.02), rot: [0, 0, four ? -0.2 : -0.3] });
  if (!four) {
    // The chamber: out of the cylinder's front, down, fat back under the engine, a cone up to the silencer.
    const f = L.belly;
    pipe(0.25, -0.2, 0.36, -0.33, 0.075, 1.4, C.metal);
    pipe(0.36, -0.33, 0.27, -0.5, 0.105 * f, 1.25, C.metal);
    pipe(0.27, -0.5, 0.0, -0.5, 0.13 * f, 1, C.metal);
    pipe(0.0, -0.5, -0.3, -0.28, 0.13 * f, 0.45, C.metal);
    pipe(-0.3, -0.28, -0.62, -0.05, 0.085, 1, C.pipe, 0.1);
  } else {
    // The header: round the front of the head, down and back under the engine, up to a big side silencer.
    pipe(0.25, -0.17, 0.36, -0.3, 0.05, 1, C.metal);
    pipe(0.36, -0.3, 0.3, -0.48, 0.05, 1, C.metal);
    pipe(0.3, -0.48, 0.02, -0.52, 0.05, 1, C.metal);
    pipe(0.02, -0.52, -0.22, -0.3, 0.05, 1, C.metal);
    pipe(-0.2, -0.27, -0.62, -0.1, 0.14, 1, k.alloy, 0.1);
    pipe(-0.62, -0.1, -0.66, -0.085, 0.09, 1, C.frame, 0.15);
  }
  // Plastics and the seat, inked: the side panel, the tank and shroud, the sloped seat, the front plate.
  sl([[-0.1, 0.12], [-0.6, 0.13], [-0.52, -0.12], [-0.2, -0.17]], 0.28, C.plastic2, 0.06);
  sl([[0.53, 0.28], [0.3, 0.255], [0.03, 0.19], [-0.02, 0.06], [0.1, -0.08], [0.38, -0.2], [0.58, -0.08], [0.61, 0.12]], 0.38, C.plastic, 0.09);
  sl([[0.13, 0.225], [-0.66, 0.15], [-0.64, 0.09], [-0.01, 0.12]], 0.24, C.seat, 0.12);
  sl([[0.55, -0.02], [0.63, -0.05], [0.72, 0.2], [0.62, 0.25]], 0.24, C.plate, 0.15);
  // The shroud's colour block, one per side, on the shroud's face.
  block([[[0.2, -0.03], [0.42, -0.15], [0.54, -0.04], [0.5, 0.07], [0.3, 0.08]]], 0.38, C.plastic);
  bars(0.14, 0.64);
  // The tail (rising to a point) and the front fender, on their wheels' levels, inked.
  tail([[-0.36, 0.06], [-0.34, 0.14], [-1.04, 0.26], [-1.0, 0.19]], C.plastic);
  const fender = front(0.86, [[-0.24, 0], [-0.22, 0.05], [0.06, 0.07], [0.32, 0.02], [0.3, -0.01], [0.04, 0.01]], C.plastic);
  return { fender, plates: [-0.36, -0.1], tail: [-1.0, 0.18] };
}
/** `a` toward `b` by t (`#rrggbb`). */

const PI = Math.PI;
const LAMP = "#fff3c4";
/** A tube from (ax, ay) to (bx, by) on the centre plane: [size, pos, rot] for a box `w` thick. */
function tube(ax: number, ay: number, bx: number, by: number, w: number, z = 0): [number[], number[], number[]] {
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  // (A box's origin is its bottom centre: drop it half its height across the tube.)
  return [[l, w, w], [(ax + bx) / 2 + Math.sin(a) * w / 2, (ay + by) / 2 - Math.cos(a) * w / 2, z], [0, 0, a]];
}

/** Build body `kind` with kit `k` and the model's look `L`, in the gas bikes' style (the same shared
 *  pieces: inked shapes, the plate-colour block on each side of the widest one, the tail and fender on
 *  their wheels' levels). Layers on the centre plane as `dirt`'s: BODY + 0–0.04 frame and motor,
 *  0.05–0.07 side panels and the battery, 0.08–0.11 tank, fairing and cover, 0.11–0.12 seat, 0.16 the
 *  block. */
export function body(kind: BodyKind, k: BodyKit, L: BikeLook): Built {
  const { part, C } = k, T = tools(k), { t, sl, bar, pipe, block, tail, front, lamp, bars, B } = T;
  /** The battery's dark case (an electric's) and a cased engine's grey. */
  const cell = mix(C.frame, "#0b0a14", 0.35), cases = mix(C.pipe, C.frame, 0.35);
  if (kind === "ebike") {
    // A pedal bike: thin inked tubes (a bicycle's diamond in the paint, or a moto-style frame: a long
    // flat top tube to the seat, dark, with fenders), a battery on the down tube, a hub motor at the
    // cranks, cranks and pedals, a saddle on a post.
    const cyc = L.cycle, P = cyc ? C.plastic : C.frame, n = L.cell;
    bar(0.47, 0.25, 0.52, 0.0, 0.075, 0.08, P, 0.03);
    bar(0.48, 0.17, cyc ? -0.2 : -0.3, cyc ? 0.04 : 0.06, 0.05, 0.07, P, 0.03);
    bar(0.5, 0.06, 0.0, -0.36, 0.065, 0.07, P, 0.03);
    bar(-0.02, -0.38, -0.2, 0.06, 0.05, 0.07, P, 0.03);
    bar(cyc ? -0.19 : -0.28, cyc ? 0.03 : 0.04, -0.56, -0.32, 0.04, 0.07, P, 0.03);
    // The battery: a long case along the down tube, its colour block one per side.
    const a = Math.atan2(-0.42, -0.5), ux = Math.cos(a), uy = Math.sin(a), vx = uy, vy = -ux;
    const at = (s: number, o: number) => [0.27 + ux * s + vx * o, -0.13 + uy * s + vy * o];
    const h = 0.2 * n, th = 0.055 * n;
    sl([at(-h, -0.01), at(h, -0.01), at(h, th * 2), at(-h, th * 2)], 0.17, cyc ? cell : C.plastic, 0.06);
    block([[at(-h + 0.04, 0.02), at(h - 0.04, 0.02), at(h - 0.04, th * 2 - 0.03), at(-h + 0.04, th * 2 - 0.03)]], 0.17, cyc ? cell : C.plastic);
    part([0.2, 0.18, 0.2], [-0.02, -0.37, -0.09], C.metal, { ...B(0.04), shape: "cyl", sides: 10, rot: [PI / 2, 0, 0] });
    for (const s of [-1, 1] as const) {
      part([0.04, 0.2, 0.03], [0.0, -0.46, s * (0.11 - k.inset)], C.metal, { on: k.side(s), layer: k.near, rot: [0, 0, s * 0.5] });
      part([0.1, 0.03, 0.06], [s * 0.05, -0.47 + s * 0.08, s * (0.14 - k.inset)], C.seat, { on: k.side(s), layer: k.near + 0.1 });
    }
    // The saddle on its post; riser bars, a lamp.
    t(-0.19, 0.04, -0.23, 0.17, 0.035, k.alloy, 0.04);
    sl([[-0.1, 0.22], [-0.38, 0.21], [-0.37, 0.16], [-0.12, 0.16]], 0.13, C.seat, 0.12);
    bars(0.16, 0.66);
    part([0.04, 0.07, 0.1], [0.54, 0.14, 0], LAMP, { ...B(0.1), emissive: true });
    if (cyc) return { fender: front(0.6, null, C.plastic2), plates: [-0.3, -0.08], tail: [-0.4, 0.16] };
    // A moto-style frame's fenders and the side panel under the saddle, in the second plastic.
    sl([[-0.04, 0.04], [-0.32, 0.05], [-0.28, -0.13], [-0.06, -0.16]], 0.15, C.plastic2, 0.05);
    tail([[-0.3, 0.05], [-0.29, 0.1], [-0.9, 0.17], [-0.88, 0.11]], C.plastic2, 0.15);
    const fender = front(0.6, [[-0.2, 0], [-0.18, 0.04], [0.06, 0.06], [0.28, 0.02], [0.26, -0.01], [0.04, 0.01]], C.plastic2, 0.13);
    return { fender, plates: [-0.18, -0.12], tail: [-0.88, 0.15] };
  }
  if (kind === "emoto") {
    // A moto frame round a big battery box (no tank, no pipe) with its lightning panel, the motor at
    // the swingarm pivot, a flat cover where a tank would be, the side panel, the seat, tail, fender, plate.
    const F = L.tube2 ? C.plastic2 : k.alloy, n = L.cell;
    t(0.48, 0.17, -0.06, -0.12, 0.06, F);
    t(0.5, 0.1, 0.4, -0.54, 0.06, F);
    t(0.42, -0.56, -0.08, -0.6, 0.05, F);
    t(-0.04, -0.14, -0.6, 0.11, 0.05, F);
    const bt = -0.12 + 0.06 * (n - 1), bf = 0.36 + 0.04 * (n - 1);
    sl([[bf, bt], [-0.06, bt], [-0.1, -0.58], [bf - 0.04, -0.6]], 0.4, cell, 0.06);
    // The lightning bolt, in two strokes.
    block([[[0.18, -0.16], [0.28, -0.16], [0.2, -0.33], [0.1, -0.33]], [[0.27, -0.3], [0.12, -0.3], [0.05, -0.55]]], 0.4, cell);
    part([0.26, 0.3, 0.26], [-0.14, -0.36, -0.15], C.metal, { ...B(0.07), shape: "cyl", sides: 10, rot: [PI / 2, 0, 0] });
    part([0.12, 0.31, 0.12], [-0.14, -0.36, -0.155], C.frame, { ...B(0.075), shape: "cyl", sides: 8, rot: [PI / 2, 0, 0] });
    sl([[-0.12, 0.13], [-0.6, 0.14], [-0.52, -0.1], [-0.12, -0.12]], 0.28, C.plastic2, 0.05);
    sl([[0.53, 0.26], [0.02, 0.21], [-0.02, 0.1], [0.1, -0.06], [0.38, -0.12], [0.58, -0.04], [0.61, 0.12]], 0.34, C.plastic, 0.09);
    sl([[0.12, 0.235], [-0.7, 0.17], [-0.68, 0.11], [-0.01, 0.13]], 0.24, C.seat, 0.12);
    sl([[0.55, -0.02], [0.63, -0.05], [0.72, 0.2], [0.62, 0.25]], 0.24, C.plate, 0.15);
    bars(0.14, 0.64);
    tail([[-0.36, 0.06], [-0.34, 0.14], [-1.04, 0.26], [-1.0, 0.19]], C.plastic);
    const fender = front(0.86, [[-0.24, 0], [-0.22, 0.05], [0.06, 0.07], [0.32, 0.02], [0.3, -0.01], [0.04, 0.01]], C.plastic);
    return { fender, plates: [-0.36, -0.08], tail: [-1.0, 0.18] };
  }
  if (kind === "mini") {
    // A street mini: a chunky backbone, a grey single with its head forward, a fat little tank, a flat
    // seat over a side cover, a short upswept tail, a low silver pipe, a round lamp, a stubby fender.
    t(0.5, 0.14, -0.08, -0.16, 0.09, C.frame);
    t(-0.08, -0.12, -0.5, 0.08, 0.05, C.frame);
    sl([[0.22, -0.22], [-0.14, -0.22], [-0.16, -0.5], [0.2, -0.52]], 0.26, cases, 0.02);
    part([0.18, 0.15, 0.22], [0.28, -0.36, 0], k.alloy, { ...B(0.03), rot: [0, 0, 0.25] });
    pipe(0.32, -0.32, 0.34, -0.5, 0.055, 1, C.metal);
    pipe(0.34, -0.5, 0.02, -0.56, 0.055, 1, C.metal);
    pipe(0.02, -0.56, -0.24, -0.44, 0.055, 1, C.metal);
    pipe(-0.22, -0.45, -0.52, -0.24, 0.12, 0.85, C.metal, 0.1);
    sl([[-0.1, 0.1], [-0.44, 0.1], [-0.38, -0.08], [-0.14, -0.12]], 0.26, C.plastic2, 0.06);
    sl([[0.47, 0.22], [0.22, 0.27], [-0.06, 0.21], [-0.08, 0.06], [0.12, -0.04], [0.42, -0.0], [0.52, 0.1]], 0.36, C.plastic, 0.09);
    block([[[0.1, 0.06], [0.32, 0.02], [0.42, 0.08], [0.34, 0.17], [0.12, 0.17]]], 0.36, C.plastic);
    sl([[0.0, 0.21], [-0.5, 0.18], [-0.5, 0.11], [-0.02, 0.11]], 0.24, C.seat, 0.12);
    lamp(0.58, 0.12, 0.08);
    bars(0.14, 0.58);
    tail([[-0.42, 0.12], [-0.4, 0.2], [-0.8, 0.3], [-0.8, 0.22]], C.plastic);
    const fender = front(0.6, [[-0.16, 0], [-0.14, 0.05], [0.12, 0.06], [0.22, 0.01], [0.2, -0.02], [0.0, 0.01]], C.plastic);
    return { fender, plates: [-0.28, -0.03], tail: [-0.8, 0.26] };
  }
  if (kind === "sport") {
    // A supersport: the spar frame and the engine low in it, a full fairing (the block on its side, a
    // belly pan under it, a screen over the nose and twin lamps), a tank, a high tail cowl over a light
    // under-tail, clip-on bars, a short can under the belly.
    t(0.5, 0.12, -0.08, -0.24, 0.1, k.alloy);
    sl([[0.3, -0.2], [-0.1, -0.2], [-0.12, -0.52], [0.26, -0.56]], 0.28, cases, 0.02);
    sl([[0.34, -0.46], [-0.06, -0.56], [0.0, -0.63], [0.36, -0.58]], 0.32, C.plastic2, 0.07);
    sl([[0.8, 0.04], [0.68, 0.2], [0.5, 0.26], [0.42, 0.08], [0.3, -0.08], [0.32, -0.34], [0.22, -0.54], [0.42, -0.5], [0.6, -0.26], [0.78, -0.1]], 0.4, C.plastic, 0.09);
    block([[[0.42, -0.06], [0.54, -0.22], [0.66, -0.14], [0.62, 0.0], [0.48, 0.04]]], 0.4, C.plastic);
    sl([[0.43, 0.24], [0.12, 0.27], [-0.06, 0.19], [0.0, 0.05], [0.38, 0.06]], 0.32, C.plastic, 0.1);
    sl([[0.68, 0.2], [0.5, 0.36], [0.46, 0.3], [0.52, 0.24]], 0.22, C.visor, 0.11);
    for (const z of [-0.08, 0.08]) part([0.04, 0.05, 0.08], [0.77, 0.0, z], LAMP, { ...B(0.2), emissive: true });
    sl([[-0.03, 0.2], [-0.36, 0.18], [-0.36, 0.12], [0.0, 0.12]], 0.24, C.seat, 0.12);
    pipe(0.18, -0.52, -0.16, -0.58, 0.06, 1, C.metal);
    pipe(-0.16, -0.58, -0.42, -0.5, 0.13, 0.8, C.metal, 0.1);
    bars(0.06, 0.5);
    tail([[-0.34, 0.06], [-0.92, 0.22], [-0.92, 0.16], [-0.36, -0.04]], C.plastic2, 0.18, -0.03);
    tail([[-0.32, 0.1], [-0.3, 0.22], [-1.0, 0.36], [-0.98, 0.26]], C.plastic);
    const fender = front(0.86, [[-0.22, 0], [-0.2, 0.05], [0.06, 0.06], [0.26, 0.02], [0.24, -0.01], [0.04, 0.01]], C.plastic);
    return { fender, plates: [-0.44, 0.0], tail: [-1.0, 0.3] };
  }
  // The naked superbike: a trellis frame round a V4 (the cases, two cylinder banks in a V, four headers
  // down the front on the exhaust side), a muscled tank with its block, a sharp high tail, a round lamp,
  // wide bars, a short side can.
  t(0.5, 0.12, -0.08, -0.26, 0.05, k.alloy);
  t(0.5, 0.0, 0.12, -0.36, 0.05, k.alloy);
  t(0.22, -0.1, -0.08, -0.06, 0.05, k.alloy);
  t(-0.08, -0.3, -0.4, 0.06, 0.05, k.alloy);
  sl([[0.3, -0.36], [-0.12, -0.36], [-0.14, -0.62], [0.26, -0.64]], 0.28, cases, 0.02);
  sl([[0.16, -0.36], [0.3, -0.12], [0.44, -0.18], [0.3, -0.42]], 0.26, k.alloy, 0.04);
  sl([[-0.08, -0.36], [-0.16, -0.1], [-0.02, -0.08], [0.06, -0.36]], 0.26, k.alloy, 0.04);
  for (let i = 0; i < 4; i++) pipe(0.4 - i * 0.045, -0.24, 0.26 - i * 0.045, -0.6, 0.032, 1, C.metal, i * 0.01, 0.09 + i * 0.022);
  sl([[-0.06, 0.1], [-0.44, 0.1], [-0.36, -0.08], [-0.12, -0.1]], 0.24, C.plastic2, 0.06);
  sl([[0.5, 0.2], [0.24, 0.28], [-0.08, 0.2], [-0.06, 0.06], [0.14, -0.06], [0.44, -0.04], [0.54, 0.06]], 0.4, C.plastic, 0.09);
  block([[[0.16, 0.02], [0.4, -0.0], [0.47, 0.07], [0.3, 0.15], [0.14, 0.11]]], 0.4, C.plastic);
  sl([[-0.04, 0.18], [-0.5, 0.15], [-0.5, 0.09], [-0.04, 0.08]], 0.24, C.seat, 0.12);
  pipe(0.12, -0.62, -0.26, -0.54, 0.07, 1, C.metal);
  pipe(-0.26, -0.54, -0.56, -0.36, 0.13, 0.85, C.metal, 0.1);
  lamp(0.6, 0.06, 0.08);
  bars(0.16, 0.72);
  tail([[-0.42, 0.08], [-0.42, 0.16], [-0.98, 0.32], [-0.96, 0.24]], C.plastic);
  const fender = front(0.86, [[-0.2, 0], [-0.18, 0.05], [0.06, 0.06], [0.24, 0.02], [0.22, -0.01], [0.04, 0.01]], C.plastic);
  return { fender, plates: [-0.4, -0.04], tail: [-0.96, 0.28] };
}

/** The upgrade `up` as you see it on a bike of rig kind `kind` (a 2-stroke, a 4-stroke or a body). */
export function extras(kind: string, up: ShownUpgrade | undefined, k: BodyKit) {
  if (!up) return;
  const { part, C } = k, B = { layer: k.body + 0.2 };
  if (up === "wbar") {
    // Two rails off the back of the frame to a small axle with two little wheels (it holds the loop).
    // (On the rear wheel's level: it is further out than the tyre, so it draws with it, just over it.)
    const R = { on: k.rear, layer: k.fender + 0.1 }, e = k.eo;
    for (const z of [-0.1, 0.1]) {
      const [s, p, r] = tube(-0.46 + e, -0.3, -1.18 + e, -0.52, 0.035, z);
      part(s, p, C.metal, { ...R, rot: r });
    }
    part([0.03, 0.03, 0.32], [-1.18 + e, -0.54, 0], C.metal, R);
    for (const z of [-0.15, 0.15]) part([0.09, 0.04, 0.09], [-1.18 + e, -0.56, z], C.tyre, { ...R, shape: "cyl", sides: 8, rot: [PI / 2, 0, 0], layer: k.fender + 0.15 });
    return;
  }
  if (up === "swap") {
    // A bigger motor (a finned can with a glowing ring) and a second battery stacked on the first.
    part([0.3, 0.28, 0.3], [-0.12, -0.42, 0], C.metal, { ...B, shape: "cyl", sides: 12, rot: [PI / 2, 0, 0] });
    part([0.2, 0.2, 0.31], [-0.12, -0.38, 0], C.glow, { ...B, shape: "cyl", sides: 12, rot: [PI / 2, 0, 0], emissive: true, layer: k.body + 0.25 });
    part([0.4, 0.12, 0.3], [kind === "ebike" ? 0.14 : 0.12, kind === "ebike" ? -0.3 : -0.12, 0], C.frame, B);
    part([0.36, 0.025, 0.31], [kind === "ebike" ? 0.14 : 0.12, kind === "ebike" ? -0.19 : -0.01, 0], C.glow, { ...B, emissive: true, layer: k.body + 0.25 });
    return;
  }
  if (up === "bore") {
    // A bigger barrel: deep cooling fins up the cylinder.
    for (let i = 0; i < 4; i++) part([0.3 - i * 0.03, 0.025, 0.32], [0.14, -0.3 + i * 0.05, 0], C.metal, { ...B, rot: [0, 0, -0.25] });
    return;
  }
  // The turbo: a charger snail on the right with its intake pipe and a blow-off valve.
  const x = { on: k.side(1), layer: k.near + 0.2 }, z = 0.2 - k.inset;
  part([0.22, 0.12, 0.22], [0.34, -0.36, z], C.metal, { ...x, shape: "cyl", sides: 12, rot: [PI / 2, 0, 0] });
  part([0.12, 0.13, 0.12], [0.34, -0.34, z + 0.01], C.pipe, { ...x, shape: "cyl", sides: 8, rot: [PI / 2, 0, 0], layer: k.near + 0.25 });
  part([0.36, 0.07, 0.07], [0.46, -0.16, z - 0.02], C.pipe, { ...x, rot: [0, 0, 1.1] });
  part([0.06, 0.08, 0.06], [0.2, -0.24, z], C.glow, { ...x, emissive: true, layer: k.near + 0.25 });
}

/** A rival's rig kind from its engine's name (the race scene's rivals carry only their power). */
export const rigOfPower = (name: string): "2t" | "4t" | BodyKind =>
  name === "2-STROKE" ? "2t" : name === "4-STROKE" ? "4t" : name === "E-BIKE" ? "ebike" : name === "MINI" ? "mini" : name === "SUPERSPORT" ? "sport" : name === "NAKED" ? "naked" : "emoto";
