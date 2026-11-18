// Holeshot's bike and rider, drawn: a low-poly dirt bike (or e-bike) and a rider in kit, built
// from @fzlt/core/diorama parts and posed each frame from ./bike.ts (the same file in Moto Track, Big
// Air and Wheelie City). The bike: wheels that spin and ride their springs, a swingarm that follows
// the rear axle, telescoping forks, tank and shrouds, seat, fenders, number plate, the engine (a
// 2-stroke's fat expansion chamber, a 4-stroke's high silencer, an e-motor's glowing battery). The
// rider: a two-bone leg from hip to peg and arm from shoulder to grip (solved each frame), a torso
// that leans with the weight shift, a helmet with its peak; standing in the attack position, sitting
// in a turn. A trick pose (`T`) moves the body and takes the hands or feet off; after a crash the
// rider leaves the bike and tumbles where bike.ts throws them. Cosmetic: builtin maths is fine here.
import type { Diorama, DioramaObject } from "@fzlt/core/diorama";
import type { Bike } from "./bike.ts";
import { body, extras, type BodyKind, type BodyKit, type ShownUpgrade } from "./bodies.ts";
export type { ShownUpgrade };

/** The colours of one bike and rider (`#rrggbb`). */
export interface RigColors {
  /** Plastics (the team colour), a second plastic, the seat, the frame. */
  plastic: string; plastic2: string; seat: string; frame: string;
  /** Tyres, rims and hubs, bright metal, the exhaust. */
  tyre: string; rim: string; metal: string; pipe: string;
  /** The number plate and its number's ink. */
  plate: string; ink: string;
  /** Rider kit: jersey, pants, helmet, its stripe, the visor, boots, gloves. */
  jersey: string; pants: string; helmet: string; stripe: string; visor: string; boots: string; gloves: string;
  /** A glow (an e-motor's battery, the tail light). */
  glow: string;
  /** The garage's extras (all optional: a rival or a demo bike leaves them out). A graphics kit on
   *  the plastics in `graphic`; the side plates (`side`, `sideInk`) with the rider's number `num`
   *  drawn on them; crash damage: `bend` (bent bars, 0..1) and `cracks` (cracked plastics, 0..1). */
  gfx?: string; graphic?: string; side?: string; sideInk?: string; num?: number; bend?: number; cracks?: number;
  /** A family upgrade that shows (a wheelie bar, a motor swap, a big bore, a turbo: ./bodies.ts). */
  up?: ShownUpgrade;
}

/** Which bike it draws: a gas dirt bike's engine (a 2-stroke, a 4-stroke) on the rig's own body, or
 *  an electric or street bike's body (./bodies.ts). */
export type RigKind = "2t" | "4t" | BodyKind;
/** The helmet's shape: a motocross peak, a long duck-bill peak, a round street dome (no peak), an
 *  open-face shell with goggles, a peak with a fin on top, a peak with a row of spikes. */
export type RigHelmet = "peak" | "duck" | "dome" | "retro" | "fin" | "spike";

/** Seven-segment digits (a, b, c, d, e, f, g as bits) for the side plates' numbers. */
const SEG = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];

/** The trick pose (0 = riding), written by a game before `pose()`: [hands off 0..1, feet off 0..1
 *  (legs back), legs spread 0..1 (sideways), body out over the back 0..1, body up off the seat 0..1,
 *  twist (radians, about the bike's long axis), arms spread 0..1, tuck 0..1 (knees to the bars),
 *  hand drag 0..1 (the left hand off the bar and down to the road, the body back: Wheelie City),
 *  the right hand down too 0..1 (the double hand drag: ../modes/stunts.ts)]. */
export const TRICK_POSE = 10;

const PI = Math.PI;
// Bike-frame points (x forward, y up, from the centre of mass): the swingarm pivot, the steering head,
// the grips, the pegs, the seat.
const PIVOT = [-0.08, -0.3], HEAD = [0.5, 0.14], GRIP = [0.42, 0.33], PEG = [-0.06, -0.33], SEAT = [-0.22, 0.12];
/** Layers a side's leg and arm drop by on the far side of the bike: from 7 (over the bike's parts)
 *  to 0.5 (under all of them, the far-side parts and the wheels included). */
const SIDE_DROP = 6.5;
/** The bike's layers (see "the bike" in `rig`): a wheel at the near end, the body, near-side parts. */
const WHEEL = 4.5, BODY = 4, NEAR = 6;
/** A wheel's level drops by END_DROP per group facing away (4.5 → 3 → 1.5); a side's parts by FAR_DROP (6 → 1). */
const END_DROP = 1.5, FAR_DROP = 5;
/** The level and side groups' offset (only its direction counts; the parts make up for it). */
const END = 1e-3;
const THIGH = 0.4, SHIN = 0.42, UPPER = 0.29, FORE = 0.29, TORSO = 0.46;

/** Bones and the solved joints, reused (no allocation per pose). */
const J = new Float64Array(4);
/** Two-bone solve from (ax, ay) to (bx, by), bones l1 then l2, bending to `bend` (+1: the middle joint
 *  forward/up of the line): J = [first bone's angle, second bone's angle, middle x, middle y]. */
function ik(ax: number, ay: number, bx: number, by: number, l1: number, l2: number, bend: number) {
  let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
  const most = l1 + l2 - 1e-4;
  if (d > most) (dx *= most / d), (dy *= most / d), (d = most);
  if (d < 1e-4) (dx = 1e-4), (d = 1e-4);
  const base = Math.atan2(dy, dx), c = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))), a1 = base + bend * Math.acos(c);
  const mx = ax + Math.cos(a1) * l1, my = ay + Math.sin(a1) * l1;
  J[0] = a1; J[1] = Math.atan2(ay + dy - my, ax + dx - mx); J[2] = mx; J[3] = my;
}

/** A bike and its rider in diorama `d`, named `id`: `pose(bike)` each frame before `d.draw()`. */
export function rig(d: Diorama, id: string, C: RigColors, kind: RigKind = "2t", helmet: RigHelmet = "peak") {
  const root = d.add({ id, shape: "group", size: [1.9, 0, 0.8], tag: { bike: id } });
  const rid = id + ":r";
  const rider = d.add({ id: rid, shape: "group", size: [0.6, 0, 0.5], on: id });
  const parts: DioramaObject[] = [];
  const part = (size: number[], pos: number[], color: string, o: { shape?: "box" | "wedge" | "cyl"; on?: string; rot?: number[]; sides?: number; top?: number; emissive?: boolean; layer?: number } = {}) => {
    const p = d.add({ shape: o.shape || "box", size, pos, rot: o.rot, on: o.on || id, color, sides: o.sides, top: o.top, emissive: o.emissive, layer: o.layer, pick: false });
    parts.push(p);
    return p;
  };
  const group = (gid: string, on: string) => d.add({ id: gid, shape: "group", size: [0.2, 0, 0.2], on, pick: false });
  // A bone: a group at the joint, turned about z; a box along its x.
  const bone = (gid: string, len: number, w: number, z: number, color: string, on = rid) => {
    const g = group(gid, on);
    g.pos[2] = z;
    part([len, w, w], [len / 2, -w / 2, 0], color, { on: gid });
    return g;
  };

  // ---- the bike ----
  // Layers inside the bike's cluster (the painter sorts by layer, then by depth inside a layer):
  //   0.5      the rider's far-side leg and arm (SIDE_DROP)
  //   1–1.4    far-side parts (FAR_DROP from 6–6.4): the far fork leg, swingarm arm, exhaust, side plate
  //   1.5–2.1  a wheel and its fender at the far end of the bike (the eye is past the other end)
  //   3–3.6    a wheel and its fender seen from the side
  //   4–4.3    the body on the centre plane: frame, engine, tank and shrouds, seat, side panels, plate,
  //            bars, then their graphics
  //   4.5–5.1  a wheel and its fender at the near end (within 45° of straight ahead or behind)
  //   6–6.4    near-side parts: the near fork leg, swingarm arm, exhaust, side plate
  //   7        the rider (near-side leg and arm, torso, helmet)
  // A wheel's level comes from two nested groups with `behind`, pointing out of its end of the bike
  // and 45° to each side: both face the eye (the near end), one does (the side), neither (the far end).
  // A side's parts hang from a group just off the centre plane (x 0: only which side the eye is on counts).
  const hubs: DioramaObject[] = [], ends: DioramaObject[] = [];
  for (let i = 0; i < 2; i++) {
    const hid = id + ":w" + i, f = i ? 1 : -1;
    const a = d.add({ id: hid + "a", shape: "group", size: [0.2, 0, 0.2], pos: [f * END, 0, END], on: id, behind: END_DROP, pick: false });
    d.add({ id: hid + "b", shape: "group", size: [0.2, 0, 0.2], pos: [f * END, 0, -END], on: hid + "a", behind: END_DROP, pick: false });
    const hub = group(hid, hid + "b");
    part([0.68, 0.15, 0.68], [0, 0, -0.075], C.tyre, { shape: "cyl", sides: 14, rot: [PI / 2, 0, 0], on: hid, layer: WHEEL });
    part([0.5, 0.16, 0.5], [0, 0, -0.08], C.rim, { shape: "cyl", sides: 14, rot: [PI / 2, 0, 0], on: hid, layer: WHEEL + 0.1 });
    part([0.44, 0.17, 0.44], [0, 0, -0.085], C.tyre, { shape: "cyl", sides: 12, rot: [PI / 2, 0, 0], on: hid, layer: WHEEL + 0.2 });
    // Spokes: two bars across the rim that turn with the wheel; the hub.
    part([0.44, 0.03, 0.18], [0, -0.015, 0], C.metal, { on: hid, layer: WHEEL + 0.3 });
    part([0.03, 0.44, 0.18], [0, -0.22, 0], C.metal, { on: hid, layer: WHEEL + 0.3 });
    part([0.12, 0.2, 0.12], [0, 0, -0.1], C.metal, { shape: "cyl", sides: 8, rot: [PI / 2, 0, 0], on: hid, layer: WHEEL + 0.4 });
    hubs.push(hub);
    ends.push(d.get(hid + "b")!);
  }
  /** A side's group (`s` −1 left, +1 right) on `on`, for that side's parts: layer NEAR on the near side. */
  const sideOf = (gid: string, on: string, s: number) => (d.add({ id: gid, shape: "group", size: [0.2, 0, 0.2], pos: [0, 0, s * END], on, behind: FAR_DROP, pick: false }), gid);
  // The swingarm (from the pivot to the rear axle) and the fork (upper tubes from the head, sliders from
  // the axle): one arm and one fork leg per side.
  const arm = group(id + ":arm", id);
  const fork = group(id + ":fk", id), slider = group(id + ":sl", id);
  for (const z of [-0.12, 0.12]) {
    const s = Math.sign(z), k = s < 0 ? "L" : "R";
    part([0.66, 0.08, 0.06], [0.33, -0.04, z - s * END], C.metal, { on: sideOf(id + ":arm" + k, id + ":arm", s), layer: NEAR });
    part([0.38, 0.07, 0.07], [0.19, -0.035, z - s * END], C.metal, { on: sideOf(id + ":fk" + k, id + ":fk", s), layer: NEAR });
    part([0.36, 0.09, 0.09], [0.18, -0.045, z - s * END], C.frame, { on: sideOf(id + ":sl" + k, id + ":sl", s), layer: NEAR + 0.1 });
  }
  // The exhaust runs down the right side.
  const ex = sideOf(id + ":ex", id, 1), xo = { on: ex, layer: NEAR }, xz = (z: number) => z - END;
  // The fenders (and the tail light) ride with their wheel's level, always just over its tyre.
  const rearEnd = ends[0]!.id!, frontEnd = ends[1]!.id!, eo = 2 * END;
  // An electric or street bike: its own body (./bodies.ts), on the same layers and groups as the gas
  // bike's: the body on the centre plane, the right side's parts on the exhaust's group (the left on
  // its own side group), the fenders and the tail on their wheel's level.
  let left = "";
  const kit: BodyKit = {
    part, C, body: BODY, near: NEAR, fender: WHEEL + 0.5, inset: END, rear: rearEnd, front: frontEnd, eo,
    side: (s) => (s > 0 ? ex : left || (left = sideOf(id + ":exL", id, -1))),
  };
  const gas = kind === "2t" || kind === "4t", built = gas ? null : body(kind, kit);
  extras(kind, C.up, kit);
  let fender = built?.fender;
  if (gas) {
    // Frame, engine, exhaust.
    part([0.62, 0.07, 0.1], [0.12, -0.02, 0], C.frame, { rot: [0, 0, -0.45], layer: BODY });
    part([0.42, 0.3, 0.26], [0.06, -0.42, 0], C.metal, { layer: BODY });
    if (kind === "2t") {
      // The expansion chamber: fat under the engine on the right, tapering back to a silencer.
      part([0.22, 0.42, 0.22], [0.26, -0.36, xz(0.17)], C.pipe, { ...xo, shape: "cyl", sides: 8, top: 0.7, rot: [0, 0, PI / 2 + 0.2] });
      part([0.4, 0.1, 0.1], [-0.36, -0.05, xz(0.15)], C.pipe, { ...xo, rot: [0, 0, 0.3] });
      part([0.32, 0.12, 0.12], [-0.52, 0.02, xz(0.15)], C.metal, { ...xo, shape: "cyl", sides: 8, rot: [0, 0, PI / 2 + 0.3], layer: NEAR + 0.1 });
    } else {
      // A header round the front, a big silencer up high.
      part([0.08, 0.32, 0.08], [0.26, -0.44, xz(0.15)], C.pipe, { ...xo, rot: [0, 0, 0.6] });
      part([0.5, 0.08, 0.08], [-0.12, -0.32, xz(0.15)], C.pipe, { ...xo, rot: [0, 0, 0.32] });
      part([0.2, 0.42, 0.2], [-0.5, 0.0, xz(0.15)], C.metal, { ...xo, shape: "cyl", sides: 8, rot: [0, 0, PI / 2 + 0.28], layer: NEAR + 0.1 });
      part([0.1, 0.12, 0.26], [0.02, -0.2, 0], C.metal, { layer: BODY });
    }
    // Plastics: tank and shrouds, seat, rear fender (the tail), side panel, front fender, plate, bars.
    part([0.5, 0.22, 0.4], [0.26, -0.08, 0], C.plastic, { shape: "wedge", rot: [0, PI, 0], layer: BODY });
    part([0.34, 0.1, 0.42], [0.24, 0.1, 0], C.plastic2, { layer: BODY + 0.05 });
    part([0.78, 0.08, 0.22], [-0.2, 0.08, 0], C.seat, { layer: BODY });
    part([0.55, 0.07, 0.2], [-0.62 + eo, 0.06, 0], C.plastic, { shape: "wedge", rot: [0, 0, -0.12], on: rearEnd, layer: WHEEL + 0.5 });
    part([0.36, 0.2, 0.3], [-0.36, -0.14, 0], C.plastic2, { layer: BODY });
    fender = part([0.44, 0.05, 0.17], [0.86 - eo, -0.1, 0], C.plastic, { shape: "wedge", rot: [0, PI, 0.1], on: frontEnd, layer: WHEEL + 0.5 });
    part([0.05, 0.26, 0.28], [0.62, 0.08, 0], C.plate, { rot: [0, 0, -0.35], layer: BODY + 0.05 });
    part([0.06, 0.06, 0.64], [GRIP[0]!, GRIP[1]! - 0.03, 0], C.frame, { rot: [0.22 * (C.bend ?? 0), 0.3 * (C.bend ?? 0), 0], layer: BODY });
  }
  const NP = built?.plates ?? [-0.36, -0.13];
  // The garage's extras: a graphics kit, the side plates and their number, a crack.
  const G2 = C.graphic ?? C.plastic2;
  if (C.gfx === "bolt") {
    part([0.2, 0.035, 0.44], [0.32, -0.02, 0], G2, { rot: [0, 0, 0.7], layer: BODY + 0.1 });
    part([0.2, 0.035, 0.44], [0.2, 0.0, 0], G2, { rot: [0, 0, -0.5], layer: BODY + 0.1 });
  } else if (C.gfx === "chevron") {
    for (let i = 0; i < 3; i++) part([0.05, 0.12, 0.44], [0.08 + i * 0.1, -0.06, 0], G2, { shape: "wedge", rot: [0, PI, 0], layer: BODY + 0.1 });
  } else if (C.gfx === "rally") {
    part([1.2, 0.03, 0.07], [-0.12, 0.12, 0], G2, { layer: BODY + 0.2 });
  } else if (C.gfx === "circuit") {
    part([0.46, 0.02, 0.43], [0.22, -0.02, 0], G2, { layer: BODY + 0.1, emissive: true });
    part([0.02, 0.12, 0.43], [0.4, -0.08, 0], G2, { layer: BODY + 0.1, emissive: true });
    part([0.3, 0.02, 0.31], [-0.4, -0.02, 0], G2, { layer: BODY + 0.2, emissive: true });
  }
  if (C.cracks && C.cracks > 0.3) part([0.3, 0.015, 0.43], [0.26, -0.04, 0], "#0b0a14", { rot: [0, 0, 0.9], layer: BODY + 0.2 });
  if (C.num) {
    // Side plates with the rider's number, one per side, in seven-segment bars; each side hangs from a
    // side group (it drops under the bodywork and the wheels on the far side), and reads the right way round.
    const n = Math.max(1, Math.min(99, C.num | 0)), ds = n > 9 ? [(n / 10) | 0, n % 10] : [n], ink = C.sideInk ?? C.ink;
    const W = 0.075, H = 0.12, T = 0.018;
    for (let side = -1; side <= 1; side += 2) {
      const gid = id + ":np" + side;
      d.add({ id: gid, shape: "group", size: [0.2, 0, 0.2], pos: [NP[0], NP[1], side * (0.156 - END)], on: sideOf(gid + "s", id, side), pick: false });
      part([0.3, 0.17, 0.01], [0, 0, 0], C.side ?? C.plate, { on: gid, layer: NEAR });
      ds.forEach((dg, i) => {
        const cx = ds.length > 1 ? (i ? 0.05 : -0.05) : 0, bits = SEG[dg]!, f = side;
        const bar = (on: number, x: number, y: number, w: number, h: number) => bits & on && part([w, h, 0.012], [(cx + x) * f, 0.025 + y, 0], ink, { on: gid, layer: NEAR + 0.1 });
        bar(1, 0, H - T, W, T); bar(64, 0, H / 2 - T / 2, W, T); bar(8, 0, 0, W, T);
        bar(2, W / 2 - T / 2, H / 2, T, H / 2); bar(4, W / 2 - T / 2, 0, T, H / 2);
        bar(32, -W / 2 + T / 2, H / 2, T, H / 2); bar(16, -W / 2 + T / 2, 0, T, H / 2);
      });
    }
  }
  part([0.05, 0.05, 0.05], [-0.9 + eo, 0.08, 0], C.glow, { emissive: true, on: rearEnd, layer: WHEEL + 0.6 });

  // ---- the rider (on the bike, or thrown clear after a crash) ----
  const torso = group(id + ":t", rid);
  part([TORSO, 0.2, 0.32], [TORSO / 2, -0.1, 0], C.jersey, { on: id + ":t" });
  part([0.12, 0.21, 0.33], [TORSO * 0.62, -0.105, 0], C.stripe, { on: id + ":t", layer: 5 });
  const head = group(id + ":h", rid);
  part([0.28, 0.27, 0.26], [0.02, -0.04, 0], C.helmet, { shape: "cyl", sides: 8, on: id + ":h" });
  part([0.05, 0.1, 0.19], [0.15, 0.06, 0], C.visor, { on: id + ":h", layer: 6 });
  const round = helmet === "dome" || helmet === "retro";
  if (!round) part([helmet === "duck" ? 0.32 : 0.2, 0.035, 0.2], [helmet === "duck" ? 0.22 : 0.16, 0.2, 0], C.stripe, { on: id + ":h", rot: [0, 0, helmet === "duck" ? -0.18 : -0.3], layer: 6 });
  else part([0.3, 0.06, 0.24], [0.0, 0.1, 0], C.helmet, { shape: "cyl", sides: 8, on: id + ":h", layer: 5 });
  if (helmet === "fin") part([0.24, 0.1, 0.03], [-0.02, 0.15, 0], C.stripe, { on: id + ":h", rot: [0, 0, 0.1], layer: 7, emissive: true });
  if (helmet === "spike") for (let i = 0; i < 3; i++) part([0.05, 0.08, 0.04], [-0.08 + i * 0.08, 0.2 - i * 0.01, 0], C.stripe, { shape: "cyl", sides: 4, top: 0, on: id + ":h", layer: 7 });
  if (helmet === "retro") part([0.06, 0.05, 0.28], [0.02, 0.04, 0], C.stripe, { on: id + ":h", layer: 6 });
  else part([0.14, 0.11, 0.16], [0.17, -0.06, 0], C.helmet, { shape: "wedge", rot: [0, PI, 0], on: id + ":h" });
  // Each side's leg and arm hang from a side group at the hip's offset across the bike (x 0, y 0, z
  // ±0.15: nothing along it, so the test is which side of the bike's centre plane the eye is on, at any
  // yaw and pitch). On the far side it drops under every bike part (`behind`: 7 → 0.5), so the far leg
  // and arm draw behind the frame, tank, seat and wheels; the near side stays over them (layer 7).
  const thigh: DioramaObject[] = [], shin: DioramaObject[] = [], upper: DioramaObject[] = [], fore: DioramaObject[] = [];
  for (let s = 0; s < 2; s++) {
    const z = s ? 0.15 : -0.15, k = id + (s ? "R" : "L");
    d.add({ id: k + "sd", shape: "group", size: [0.2, 0, 0.2], pos: [0, 0, z], on: rid, layer: 5, behind: SIDE_DROP, pick: false });
    thigh.push(bone(k + "th", THIGH, 0.16, 0, C.pants, k + "sd"));
    const sh = bone(k + "sh", SHIN, 0.14, 0, C.boots, k + "sd");
    part([0.22, 0.09, 0.15], [SHIN - 0.02, -0.08, 0], C.boots, { on: k + "sh" });
    shin.push(sh);
    upper.push(bone(k + "ua", UPPER, 0.11, z * 0.3, C.jersey, k + "sd"));
    const fa = bone(k + "fa", FORE, 0.1, z * 0.5, C.jersey, k + "sd");
    part([0.09, 0.1, 0.1], [FORE, -0.05, 0], C.gloves, { on: k + "fa" });
    fore.push(fa);
  }

  /** The hand drag now: how far (0..1), the road's direction in the bike's frame (x, y). */
  const DG = new Float64Array(3);
  /** Walking the bike: on (0/1), the stride's phase, the ground's height in the rider's frame. */
  const WALKP = new Float64Array(3);
  /** The trick pose (see TRICK_POSE), written by the game. */
  const T = new Float64Array(TRICK_POSE);
  let thrown = false;

  /** Pose everything from bike `b` (call each frame before draw). `stand` 0..1: sitting to the attack position. */
  function pose(b: Bike, stand = 0.7) {
    root.pos.set(b.pos);
    root.rot.set(b.rot);
    const R = b.radius, rx = b.rear, fx = b.front, dy = -b.drop;
    // Wheels on their springs, spinning; the swingarm to the rear axle; the fork to the front.
    const ry = dy + b.comp[0]!, fy = dy + b.comp[1]!;
    hubs[0]!.pos[0] = rx + 2 * END; hubs[0]!.pos[1] = ry; hubs[0]!.rot[2] = -b.spin[0]!;
    hubs[1]!.pos[0] = fx - 2 * END; hubs[1]!.pos[1] = fy; hubs[1]!.rot[2] = -b.spin[1]!;
    hubs[1]!.rot[1] = b.contact[1] || b.air > 0 ? -b.steerAngle * 0.6 : 0;
    arm.pos[0] = PIVOT[0]!; arm.pos[1] = PIVOT[1]!;
    arm.rot[2] = Math.atan2(ry - PIVOT[1]!, rx - PIVOT[0]!);
    const fa = Math.atan2(fy - HEAD[1]!, fx - HEAD[0]!);
    fork.pos[0] = HEAD[0]!; fork.pos[1] = HEAD[1]!; fork.rot[2] = fa;
    slider.pos[0] = fx; slider.pos[1] = fy; slider.rot[2] = fa + PI;
    fender!.pos[1] = fy + R + 0.02;
    void R;
    if (b.crashed) {
      if (!thrown) (thrown = true), d.on(rider, null);
      rider.pos.set(b.rider);
      rider.rot.set(b.riderRot);
      limbs(0.2, 0.6, 0.25, 0.9, 0, 0, 0.8, 0, true);
      return;
    }
    if (thrown) (thrown = false), d.on(rider, id);
    rider.pos[0] = rider.pos[1] = rider.pos[2] = 0;
    rider.rot[0] = T[5]!; rider.rot[1] = rider.rot[2] = 0;
    if (b.walking) {
      // Walking it: off the seat and astride it, both boots on the ground beside it, striding with the
      // rear wheel's roll (one foot planted, the other swinging), hands on the grips.
      rider.pos[1] = -0.14;
      WALKP[0] = 1; WALKP[1] = b.spin[0]! * 1.6; WALKP[2] = -b.drop - b.radius + b.comp[0]! + 0.14 + 0.04;
      limbs(0, 0, 0, 0, 0.32, 0, 0, 0, false, 0);
      WALKP[0] = 0;
      return;
    }
    // The hand drag: the road is "down" in the bike's frame (x forward, y up, pitched by rel).
    DG[0] = T[8]!; DG[1] = -Math.sin(b.pitch); DG[2] = -Math.cos(b.pitch);
    limbs(b.lean, stand, T[0]!, T[1]!, T[2]!, T[3]! + 0.5 * T[8]!, T[6]!, T[7]!, false, T[4]!);
    DG[0] = 0;
  }
  /** The rider's body: weight (−1 forward .. 1 back), standing, hands and feet off, spread, out over the back. */
  function limbs(lean: number, stand: number, hands: number, feet: number, spread: number, back: number, arms: number, tuck: number, loose: boolean, up = 0) {
    // The hip: over the pegs standing, on the seat sitting; back with the weight, up off the seat in a trick.
    const hx = SEAT[0]! + 0.08 * stand - 0.14 * lean - 0.25 * back + 0.1 * tuck, hy = SEAT[1]! + 0.06 + 0.2 * stand + 0.22 * up + 0.12 * back - 0.06 * tuck;
    // The torso leans forward over the bars (less with the weight back; flat out over the back in a plank).
    const tilt = 0.75 - 0.35 * lean + 0.25 * stand - 0.6 * back + 0.35 * tuck, ta = PI / 2 - tilt;
    torso.pos[0] = hx; torso.pos[1] = hy; torso.rot[2] = ta;
    const sx = hx + Math.cos(ta) * (TORSO - 0.05), sy = hy + Math.sin(ta) * (TORSO - 0.05);
    head.pos[0] = hx + Math.cos(ta) * (TORSO + 0.06); head.pos[1] = hy + Math.sin(ta) * (TORSO + 0.06) - 0.02; head.rot[2] = ta - PI / 2 + 0.15;
    for (let s = 0; s < 2; s++) {
      const side = s ? 1 : -1;
      // Legs: hip to peg (knee forward); feet off, the foot goes back and out (a plank, a split).
      let px = PEG[0]! - feet * 0.85 + tuck * 0.35 + (loose ? 0.1 * side : 0), py = PEG[1]! + feet * 0.42 + tuck * 0.45 + (loose ? -0.2 : 0);
      if (WALKP[0]) {
        // A stride: the boots out of phase, forward and back of the hip, the swinging one lifted.
        const ph = Math.sin(WALKP[1]! + side * PI / 2);
        px = hx + 0.06 + ph * 0.2; py = WALKP[2]! + Math.max(0, Math.cos(WALKP[1]! + side * PI / 2)) * 0.07;
      }
      ik(hx, hy, px, py, THIGH, SHIN, 1);
      const lz = side * (0.15 + spread * 0.55 + (loose ? 0.15 : 0));
      // (z from the side group at side × 0.15.)
      thigh[s]!.pos[0] = hx; thigh[s]!.pos[1] = hy; thigh[s]!.pos[2] = (lz - side * 0.15) * 0.5; thigh[s]!.rot[2] = J[0]!;
      shin[s]!.pos[0] = J[2]!; shin[s]!.pos[1] = J[3]!; shin[s]!.pos[2] = lz - side * 0.15; shin[s]!.rot[2] = J[1]!;
      thigh[s]!.rot[0] = -side * spread * 0.9;
      shin[s]!.rot[0] = -side * spread * 0.9;
      // Arms: shoulder to grip (elbow out and down); hands off, they go up and out.
      const gx = GRIP[0]! - hands * (0.55 + 0.25 * arms), gy = GRIP[1]! + hands * (0.65 + 0.2 * arms) + (loose ? 0.3 : 0);
      // The hand drag: the left hand reaches down to the road (straight-armed, out from the bike).
      const dr = s === 0 ? DG[0]! : DG[0]! * T[9]!, reach = (UPPER + FORE) * 0.98;
      ik(sx, sy, gx + (sx + DG[1]! * reach - gx) * dr, gy + (sy + DG[2]! * reach - gy) * dr, UPPER, FORE, -1);
      const az = side * (0.2 + arms * 0.45 * hands + (loose ? 0.2 : 0) + dr * 0.35);
      upper[s]!.pos[0] = sx; upper[s]!.pos[1] = sy; upper[s]!.pos[2] = side * 0.04; upper[s]!.rot[2] = J[0]!;
      fore[s]!.pos[0] = J[2]!; fore[s]!.pos[1] = J[3]!; fore[s]!.pos[2] = az - side * 0.15; fore[s]!.rot[2] = J[1]!;
      upper[s]!.rot[0] = fore[s]!.rot[0] = -side * arms * hands * 0.8;
    }
  }
  /** New colours (a theme change). */
  function recolor(next: RigColors) {
    void next;
  }
  return { root, rider, T, pose, recolor, parts };
}
export type Rig = ReturnType<typeof rig>;
