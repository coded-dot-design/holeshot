// The bike families' bodies, for ./rig.ts: what a bike that is not a gas dirt bike looks like (the
// rig keeps a 2-stroke's and a 4-stroke's tank, shrouds and pipe), and the garage upgrades you can
// see on any bike. Every body is built from the rig's own `part` on the rig's layers and groups
// (BodyKit), so it sits in the same draw order as the gas bikes: its body on the centre plane, the
// exhaust on the right side's group, the fenders and the tail on their wheel's level.
// - Electric bikes: no tank, no exhaust. An e-bike is a pedal bike (thin tubes, a battery on the down
//   tube, cranks, a saddle on a post); an electric dirt bike a moto frame round a big battery box with
//   its glow strip, the motor at the swingarm pivot, a flat cover where a tank would be.
// - Street bikes: a mini (a chunky backbone, a fat little tank, a stubby upswept can, a headlight
//   cowl), a supersport (a full fairing with a screen and twin lamps, clip-ons, a high tail cowl, an
//   under-belly can) and a naked superbike (a trellis frame round a big twin, a muscled tank, a round
//   lamp, wide bars, a short side can).
// - Upgrades (`extras`): a wheelie bar off the back (the mini), a bigger motor and battery (an
//   electric's motor swap), cylinder fins (a gas bike's big bore kit), a charger and its intake (a
//   street bike's turbo). Original shapes, no badges. Cosmetic: builtin maths is fine here.
import type { DioramaObject } from "@fzlt/core/diorama";
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
}
/** What a body gives back: the front fender (the rig rides it on the fork) and where the side plates go. */
export interface Built { fender: DioramaObject; plates: [x: number, y: number] }

const PI = Math.PI;
const LAMP = "#fff3c4";
/** A tube from (ax, ay) to (bx, by) on the centre plane: [size, pos, rot] for a box `w` thick. */
function tube(ax: number, ay: number, bx: number, by: number, w: number, z = 0): [number[], number[], number[]] {
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  // (A box's origin is its bottom centre: drop it half its height across the tube.)
  return [[l, w, w], [(ax + bx) / 2 + Math.sin(a) * w / 2, (ay + by) / 2 - Math.cos(a) * w / 2, z], [0, 0, a]];
}

/** Build body `kind` with kit `k` (the frame, motor or engine, exhaust, bodywork, seat, fenders, bars). */
export function body(kind: BodyKind, k: BodyKit): Built {
  const { part, C } = k, B = { layer: k.body }, x = { on: k.side(1), layer: k.near }, xz = (z: number) => z - k.inset;
  const R = { on: k.rear, layer: k.fender }, F = { on: k.front, layer: k.fender }, e = k.eo;
  const t = (ax: number, ay: number, bx: number, by: number, w: number, color: string, o: PartOpts = B) => {
    const [s, p, r] = tube(ax, ay, bx, by, w);
    return part(s, p, color, { ...o, rot: r });
  };
  if (kind === "ebike") {
    // A pedal bike: top tube, down tube with its battery, seat tube and post, a hub motor at the cranks.
    t(-0.18, 0.04, 0.48, 0.12, 0.06, C.frame);
    t(0.46, 0.06, 0.0, -0.34, 0.07, C.frame);
    t(-0.02, -0.36, -0.2, 0.06, 0.06, C.frame);
    t(-0.02, -0.36, -0.58, -0.4, 0.045, C.frame);
    t(-0.18, 0.04, -0.58, -0.38, 0.04, C.frame);
    // The battery: a long box on the down tube, the maker's colour, a glowing charge strip.
    const [bs, bp, br] = tube(0.38, -0.02, 0.06, -0.3, 0.13);
    part([bs[0]! - 0.1, 0.13, 0.15], bp, C.plastic, { ...B, rot: br, layer: k.body + 0.05 });
    part([bs[0]! - 0.2, 0.025, 0.155], [bp[0]! - 0.01, bp[1]! + 0.06, 0], C.glow, { ...B, rot: br, emissive: true, layer: k.body + 0.1 });
    part([0.18, 0.18, 0.16], [0.0, -0.44, 0], C.metal, { ...B, shape: "cyl", sides: 10, rot: [PI / 2, 0, 0] });
    // Cranks and pedals, one per side.
    for (const s of [-1, 1] as const) {
      part([0.04, 0.2, 0.03], [0.0, -0.46, s * (0.11 - k.inset)], C.metal, { on: k.side(s), layer: k.near, rot: [0, 0, s * 0.5] });
      part([0.1, 0.03, 0.06], [s * 0.05, -0.47 + s * 0.08, s * (0.14 - k.inset)], C.seat, { on: k.side(s), layer: k.near + 0.1 });
    }
    // Saddle, a short rear fender, a slim front one, riser bars, a lamp.
    part([0.28, 0.06, 0.13], [-0.22, 0.08, 0], C.seat, B);
    part([0.42, 0.035, 0.12], [-0.56 + e, -0.03, 0], C.plastic2, { ...R, shape: "wedge", rot: [0, 0, -0.2] });
    const fender = part([0.34, 0.03, 0.12], [0.62 - e, -0.1, 0], C.plastic2, { ...F, shape: "wedge", rot: [0, PI, 0.1] });
    part([0.05, 0.12, 0.05], [0.47, 0.16, 0], C.frame, B);
    part([0.05, 0.05, 0.66], [0.44, 0.3, 0], C.frame, { ...B, rot: [0, 0, 0] });
    part([0.04, 0.07, 0.1], [0.54, 0.12, 0], LAMP, { ...B, emissive: true, layer: k.body + 0.1 });
    return { fender, plates: [-0.12, -0.14] };
  }
  if (kind === "emoto") {
    // A moto frame round a big battery box (no tank, no pipe): the motor at the pivot.
    part([0.62, 0.07, 0.1], [0.12, -0.02, 0], C.frame, { ...B, rot: [0, 0, -0.45] });
    part([0.56, 0.32, 0.26], [0.1, -0.44, 0], C.frame, B);
    part([0.5, 0.03, 0.27], [0.1, -0.14, 0], C.glow, { ...B, emissive: true, layer: k.body + 0.15 });
    part([0.06, 0.18, 0.27], [0.36, -0.38, 0], C.glow, { ...B, emissive: true, layer: k.body + 0.15 });
    part([0.22, 0.22, 0.22], [-0.14, -0.38, 0], C.metal, { ...B, shape: "cyl", sides: 10, rot: [PI / 2, 0, 0], layer: k.body + 0.05 });
    // A flat cover where a tank would be, slim side plastics, a long flat seat.
    part([0.46, 0.08, 0.3], [0.2, -0.06, 0], C.plastic, { ...B, layer: k.body + 0.05 });
    part([0.3, 0.16, 0.34], [0.32, -0.1, 0], C.plastic2, { ...B, shape: "wedge", rot: [0, PI, 0], layer: k.body + 0.05 });
    part([0.82, 0.07, 0.2], [-0.2, 0.06, 0], C.seat, B);
    part([0.32, 0.16, 0.26], [-0.36, -0.12, 0], C.plastic2, B);
    part([0.55, 0.06, 0.18], [-0.62 + e, 0.05, 0], C.plastic, { ...R, shape: "wedge", rot: [0, 0, -0.12] });
    const fender = part([0.44, 0.05, 0.17], [0.86 - e, -0.1, 0], C.plastic, { ...F, shape: "wedge", rot: [0, PI, 0.1] });
    part([0.05, 0.26, 0.28], [0.62, 0.08, 0], C.plate, { ...B, rot: [0, 0, -0.35], layer: k.body + 0.05 });
    part([0.06, 0.06, 0.64], [0.42, 0.3, 0], C.frame, B);
    return { fender, plates: [-0.36, -0.13] };
  }
  if (kind === "mini") {
    // A chunky backbone, a horizontal single, a stubby upswept can, a fat little tank.
    part([0.64, 0.13, 0.13], [0.1, -0.12, 0], C.frame, { ...B, rot: [0, 0, -0.32] });
    part([0.36, 0.22, 0.24], [0.0, -0.42, 0], C.metal, B);
    part([0.2, 0.14, 0.2], [0.2, -0.34, 0], C.metal, { ...B, rot: [0, 0, -0.15] });
    part([0.4, 0.07, 0.07], [-0.08, -0.36, xz(0.15)], C.pipe, { ...x, rot: [0, 0, 0.32] });
    part([0.14, 0.3, 0.14], [-0.38, -0.2, xz(0.16)], C.pipe, { ...x, shape: "cyl", sides: 8, rot: [0, 0, PI / 2 + 0.3], layer: k.near + 0.1 });
    part([0.42, 0.2, 0.36], [0.2, -0.04, 0], C.plastic, { ...B, layer: k.body + 0.05 });
    part([0.34, 0.2, 0.42], [0.32, -0.14, 0], C.plastic2, { ...B, shape: "wedge", rot: [0, PI, 0], layer: k.body + 0.05 });
    part([0.6, 0.09, 0.24], [-0.22, 0.02, 0], C.seat, B);
    part([0.38, 0.13, 0.2], [-0.48 + e, -0.04, 0], C.plastic, { ...R, shape: "wedge", rot: [0, 0, -0.06] });
    const fender = part([0.3, 0.05, 0.18], [0.62 - e, -0.1, 0], C.plastic, { ...F, shape: "wedge", rot: [0, PI, 0.1] });
    // The headlight cowl and its lamp, short bars.
    part([0.16, 0.18, 0.24], [0.56, 0.04, 0], C.plastic, { ...B, shape: "wedge", rot: [0, PI, 0], layer: k.body + 0.05 });
    part([0.03, 0.1, 0.15], [0.64, 0.08, 0], LAMP, { ...B, emissive: true, layer: k.body + 0.1 });
    part([0.06, 0.06, 0.58], [0.42, 0.27, 0], C.frame, B);
    return { fender, plates: [-0.3, -0.12] };
  }
  if (kind === "sport") {
    // A twin-spar frame, the engine low in it, a full fairing (belly, sides, a nose with twin lamps and
    // a screen), a tank and a pillion-less tail cowl, clip-on bars, an under-belly can.
    part([0.66, 0.12, 0.28], [0.14, -0.14, 0], C.frame, { ...B, rot: [0, 0, -0.32] });
    part([0.44, 0.3, 0.26], [0.06, -0.46, 0], C.metal, B);
    part([0.66, 0.16, 0.38], [0.18, -0.48, 0], C.plastic2, { ...B, layer: k.body + 0.05 });
    part([0.5, 0.32, 0.42], [0.3, -0.34, 0], C.plastic, { ...B, shape: "wedge", rot: [0, PI, 0], layer: k.body + 0.1 });
    part([0.28, 0.26, 0.36], [0.64, -0.04, 0], C.plastic, { ...B, shape: "wedge", layer: k.body + 0.1 });
    part([0.2, 0.14, 0.26], [0.54, 0.2, 0], C.visor, { ...B, shape: "wedge", layer: k.body + 0.15 });
    for (const z of [-0.08, 0.08]) part([0.04, 0.05, 0.08], [0.76, 0.0, z], LAMP, { ...B, emissive: true, layer: k.body + 0.2 });
    part([0.42, 0.18, 0.36], [0.1, 0.0, 0], C.plastic, { ...B, layer: k.body + 0.05 });
    part([0.34, 0.07, 0.22], [-0.18, 0.06, 0], C.seat, B);
    part([0.58, 0.17, 0.24], [-0.5 + e, 0.03, 0], C.plastic, { ...R, shape: "wedge" });
    const fender = part([0.3, 0.05, 0.18], [0.86 - e, -0.1, 0], C.plastic2, { ...F, shape: "wedge", rot: [0, PI, 0.1] });
    part([0.05, 0.05, 0.5], [0.44, 0.22, 0], C.frame, B);
    part([0.36, 0.14, 0.14], [-0.14, -0.5, xz(0.14)], C.pipe, { ...x, shape: "cyl", sides: 8, rot: [0, 0, PI / 2 + 0.08] });
    return { fender, plates: [-0.44, 0.0] };
  }
  // The naked superbike: a trellis frame round a big twin, a muscled tank, a round lamp, wide bars.
  t(0.5, 0.12, -0.08, -0.26, 0.05, C.plastic2);
  t(0.5, 0.0, 0.12, -0.36, 0.05, C.plastic2);
  t(0.22, -0.1, -0.08, -0.06, 0.05, C.plastic2);
  t(-0.08, -0.3, -0.36, 0.0, 0.05, C.plastic2);
  part([0.46, 0.3, 0.28], [0.06, -0.5, 0], C.metal, B);
  part([0.16, 0.26, 0.2], [0.24, -0.32, 0], C.metal, { ...B, shape: "cyl", sides: 8, rot: [0, 0, -0.55], layer: k.body + 0.05 });
  part([0.16, 0.26, 0.2], [-0.1, -0.3, 0], C.metal, { ...B, shape: "cyl", sides: 8, rot: [0, 0, 0.5], layer: k.body + 0.05 });
  part([0.52, 0.24, 0.42], [0.16, -0.02, 0], C.plastic, { ...B, shape: "wedge", rot: [0, PI, 0], layer: k.body + 0.1 });
  part([0.2, 0.16, 0.44], [0.36, -0.08, 0], C.plastic2, { ...B, shape: "wedge", rot: [0, PI, 0], layer: k.body + 0.1 });
  part([0.5, 0.08, 0.24], [-0.24, 0.06, 0], C.seat, B);
  part([0.42, 0.1, 0.18], [-0.56 + e, 0.06, 0], C.plastic, { ...R, shape: "wedge", rot: [0, 0, -0.1] });
  const fender = part([0.3, 0.05, 0.18], [0.86 - e, -0.1, 0], C.plastic, { ...F, shape: "wedge", rot: [0, PI, 0.1] });
  part([0.2, 0.08, 0.2], [0.62, 0.02, 0], C.frame, { ...B, shape: "cyl", sides: 10, rot: [0, 0, PI / 2] });
  part([0.16, 0.02, 0.16], [0.67, 0.04, 0], LAMP, { ...B, shape: "cyl", sides: 10, rot: [0, 0, PI / 2], emissive: true, layer: k.body + 0.1 });
  part([0.06, 0.06, 0.72], [0.42, 0.3, 0], C.frame, B);
  part([0.42, 0.07, 0.07], [0.1, -0.54, xz(0.15)], C.pipe, { ...x, rot: [0, 0, -0.1] });
  part([0.16, 0.36, 0.16], [-0.24, -0.38, xz(0.16)], C.pipe, { ...x, shape: "cyl", sides: 8, rot: [0, 0, PI / 2 + 0.3], layer: k.near + 0.1 });
  return { fender, plates: [-0.4, -0.08] };
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
