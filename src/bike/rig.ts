// Holeshot's bike and rider, drawn: a low-poly dirt bike (or e-bike) and a rider in kit, built
// from @fzlt/core/diorama parts and posed each frame from ./bike.ts (the same file in Moto Track, Big
// Air and Wheelie City). The bike: wheels that spin and ride their springs, a swingarm that follows
// the rear axle, telescoping forks, tank and shrouds, seat, fenders, number plate, the engine (a
// 2-stroke's curved silver expansion chamber, a 4-stroke's header and side silencer: ./bodies.ts
// `dirt` and `body`, every bike in the art's style with an ink edge). The
// rider: a two-bone leg from hip to peg and arm from shoulder to grip (solved each frame), a torso
// that leans with the weight shift, a helmet with its peak; standing in the attack position, sitting
// in a turn. A trick pose (`T`) moves the body and takes the hands or feet off; after a crash the
// rider leaves the bike and tumbles where bike.ts throws them. Cosmetic: builtin maths is fine here.
import type { Diorama, DioramaObject } from "@fzlt/core/diorama";
import type { Bike } from "./bike.ts";
import { bikeLook, body, dirt, extras, INK, type BodyKind, type BodyKit, type ShownUpgrade } from "./bodies.ts";
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

/** The goggle's frame and strap colour: the stripe, or (a stripe near the shell's own colour) a dark
 *  band on a light shell and a light one on a dark shell, so the goggle always reads. */
export function bandOf(helmet: string, stripe: string) {
  const x = parseInt(helmet.slice(1), 16), y = parseInt(stripe.slice(1), 16);
  const near = Math.abs((x >> 16) - (y >> 16)) + Math.abs(((x >> 8) & 255) - ((y >> 8) & 255)) + Math.abs((x & 255) - (y & 255)) < 90;
  return !near ? stripe : (x >> 16) * 0.3 + ((x >> 8) & 255) * 0.59 + (x & 255) * 0.11 > 110 ? "#14121f" : "#e8e6f0";
}

/** The goggle strap's colour: dark on a light or mid shell, the band darkened on a dark one, so it
 *  reads as a strap apart from the peak and the frame, never as a second layer of the shell. */
export function strapOf(helmet: string, band: string) {
  const x = parseInt(helmet.slice(1), 16);
  return (x >> 16) * 0.3 + ((x >> 8) & 255) * 0.59 + (x & 255) * 0.11 > 70 ? "#1d1b29" : mix(band, "#0b0a14", 0.45);
}

/** Seven-segment digits (a, b, c, d, e, f, g as bits) for the side plates' numbers. */
const SEG = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];

/** The trick pose (0 = riding), written by a game before `pose()`: [hands off 0..1, feet off 0..1
 *  (legs back), legs spread 0..1 (sideways), body out over the back 0..1, body up off the seat 0..1,
 *  twist (radians, about the bike's long axis), arms spread 0..1, tuck 0..1 (knees to the bars),
 *  hand drag 0..1 (the left hand off the bar and down to the road, the body back: Wheelie City),
 *  the right hand down too 0..1 (the double hand drag: ../modes/stunts.ts), then the freestyle set
 *  (Big Air: ../modes/bigair/fmx.ts): the right hand back on the seat 0..1 (a seat grab), the right leg
 *  over the back to the far side 0..1 (a nac-nac), the right leg over the tank to the far side 0..1 (a
 *  can-can), both feet up over the bars 0..1 (a heel clicker, a cliffhanger, a lazy boy), legs
 *  straight up over the bike 0..1 (a handstand), the bars turned 0..1 (a cross-up), the body's pitch
 *  (radians: + flat out over the bars, − upright and on back to lying on the seat)]. Every one is 0
 *  in a mode that does not write it. */
export const TRICK_POSE = 17;
/** The freestyle channels of `T` (see TRICK_POSE). */
export const T_GRAB = 10, T_NAC = 11, T_CAN = 12, T_HEELS = 13, T_HANDSTAND = 14, T_BARS = 15, T_BODY = 16;

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
/** A wheel face's drop on the far side: from just over its tyre to just under it. */
const FACE_DROP = 0.1;
/** The level and side groups' offset (only its direction counts; the parts make up for it). */
const END = 1e-3;
/** The right hand's release blend at the double hand drag (seconds from the bar to the road). */
const RELEASE = 0.25;
const THIGH = 0.4, SHIN = 0.42, UPPER = 0.29, FORE = 0.29, TORSO = 0.46;

/** `a` toward `b` by t (`#rrggbb`). */
const mix = (a: string, b: string, t: number) => {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), c = (sh: number) => Math.round(((x >> sh) & 255) * (1 - t) + ((y >> sh) & 255) * t);
  return "#" + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
};

/** The ink edge's width round a gas bike's main shapes (./bodies.ts INK is its colour). */
const INK_W = 0.013;
/** Twice the signed area of polygon `P`. */
const area = (P: number[][]) => P.reduce((a, p, i) => { const q = P[(i + 1) % P.length]!; return a + p[0]! * q[1]! - q[0]! * p[1]!; }, 0);
/** Polygon `P` grown by `e` all round (each corner mitred, spikes capped). */
function grow(P: number[][], e: number) {
  const n = P.length, s = area(P) > 0 ? 1 : -1;
  const nrm = (a: number[], b: number[]) => { const dx = b[0]! - a[0]!, dy = b[1]! - a[1]!, l = Math.hypot(dx, dy) || 1; return [(s * dy) / l, (-s * dx) / l]; };
  return P.map((p, i) => {
    const a = nrm(P[(i + n - 1) % n]!, p), b = nrm(p, P[(i + 1) % n]!), k = e / Math.max(0.35, 1 + a[0]! * b[0]! + a[1]! * b[1]!);
    return [p[0]! + (a[0]! + b[0]!) * k, p[1]! + (a[1]! + b[1]!) * k];
  });
}

/** Where a horizontal line at `y` crosses outline `P` ([x, y] points): its least x (the back) and its
 *  greatest (the front). Build time only. */
function crossX(P: number[][], y: number) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < P.length; i++) {
    const a = P[i]!, b = P[(i + 1) % P.length]!;
    if ((a[1]! - y) * (b[1]! - y) > 0 || a[1] === b[1]) continue;
    const x = a[0]! + ((y - a[1]!) / (b[1]! - a[1]!)) * (b[0]! - a[0]!);
    lo = Math.min(lo, x); hi = Math.max(hi, x);
  }
  return [lo, hi] as const;
}
const backX = (P: number[][], y: number) => crossX(P, y)[0];
const frontX = (P: number[][], y: number) => crossX(P, y)[1];

/** Polygon `P` cut to the convex polygon `Cv` (Sutherland–Hodgman; build time only). */
function clip(P: number[][], Cv: number[][]) {
  const s = area(Cv) > 0 ? 1 : -1;
  let out = P;
  for (let i = 0; i < Cv.length && out.length; i++) {
    const a = Cv[i]!, b = Cv[(i + 1) % Cv.length]!, inp = out;
    const side = (p: number[]) => s * ((b[0]! - a[0]!) * (p[1]! - a[1]!) - (b[1]! - a[1]!) * (p[0]! - a[0]!));
    out = [];
    for (let j = 0; j < inp.length; j++) {
      const p = inp[j]!, q = inp[(j + 1) % inp.length]!, sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if (sp >= 0 !== sq >= 0) { const t = sp / (sp - sq); out.push([p[0]! + (q[0]! - p[0]!) * t, p[1]! + (q[1]! - p[1]!) * t]); }
    }
  }
  return out;
}
/** A rounded rectangle `h` by `w` about its centre (three points a corner), a prism outline. */
function rounded(h: number, w: number) {
  const r = Math.min(h, w) * 0.3, P: number[][] = [];
  for (let c = 0; c < 4; c++) for (let i = 0; i < 3; i++) {
    const a = (c + i / 2) * (PI / 2), sx = c === 0 || c === 3 ? 1 : -1, sy = c < 2 ? 1 : -1;
    P.push([sx * (h / 2 - r) + r * Math.cos(a), sy * (w / 2 - r) + r * Math.sin(a)]);
  }
  return P;
}

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
/** The 3D limb solve: K = [middle joint x, y, z, end x, y, z]; L = the two bones' frames as diorama
 *  rotations ([x, y, z] for the first bone, then the second). */
const K = new Float64Array(6), L = new Float64Array(6);
/** Two-bone solve in 3D from A (ax, ay, az) toward B (bx, by, bz), bones l1 then l2, in the plane through
 *  A and B nearest to normal (nx, ny, nz), the middle joint bending to `bend` (+1: toward n × (B − A), as
 *  `ik`'s with n = +z). The middle joint is exactly l1 from A and the end exactly l2 from it (out of
 *  reach, B is pulled in along the line), so the first bone ends where the second begins: one joint. Each
 *  bone's frame: x along it, z the limb plane's normal, y = z × x (with n = +z, `ik`'s angles about z). */
function ik3(ax: number, ay: number, az: number, bx: number, by: number, bz: number, l1: number, l2: number, nx: number, ny: number, nz: number, bend: number) {
  let dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz);
  if (d < 1e-4) (dx = 0), (dy = -1e-4), (dz = 0), (d = 1e-4);
  const ux = dx / d, uy = dy / d, uz = dz / d;
  d = Math.min(d, l1 + l2 - 1e-4);
  // The plane's normal: n made square to the line (a fallback when n lies along it).
  const nu = nx * ux + ny * uy + nz * uz;
  let px = nx - nu * ux, py = ny - nu * uy, pz = nz - nu * uz, pl = Math.hypot(px, py, pz);
  if (pl < 1e-6) (px = -uy), (py = ux), (pz = 0), (pl = Math.hypot(px, py) || 1), pl < 1e-6 && ((px = 0), (py = 0), (pz = 1), (pl = 1));
  px /= pl; py /= pl; pz /= pl;
  // Toward the bend: w = bend · (p × u).
  const wx = bend * (py * uz - pz * uy), wy = bend * (pz * ux - px * uz), wz = bend * (px * uy - py * ux);
  const c = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))), sn = Math.sqrt(1 - c * c);
  const mx = ax + l1 * (c * ux + sn * wx), my = ay + l1 * (c * uy + sn * wy), mz = az + l1 * (c * uz + sn * wz);
  const ex = ax + d * ux, ey = ay + d * uy, ez = az + d * uz;
  K[0] = mx; K[1] = my; K[2] = mz; K[3] = ex; K[4] = ey; K[5] = ez;
  frame(mx - ax, my - ay, mz - az, px, py, pz, 0);
  frame(ex - mx, ey - my, ez - mz, px, py, pz, 3);
}
/** L[o..o+2] = the rotation (diorama order: y, then x, then z) whose x axis runs along (x, y, z) and
 *  whose z axis is the unit normal (px, py, pz), square to it. */
function frame(x: number, y: number, z: number, px: number, py: number, pz: number, o: number) {
  const l = Math.hypot(x, y, z) || 1;
  x /= l; y /= l; z /= l;
  // y axis = z × x (only its y component is needed: R11).
  const yy = pz * x - px * z;
  L[o] = Math.asin(Math.max(-1, Math.min(1, -py)));
  L[o + 1] = Math.atan2(px, pz);
  L[o + 2] = Math.atan2(y, yy);
}

/** The helmet's side profiles, the portrait's (../garage/portrait.ts) in its units ([x, y], y down,
 *  facing +x): the MX shell (round at the back and under it), its chin bar, the street dome, the open
 *  face, the dome's visor and the peaks. */
const SHELL = [[-30, 38], [-41, 29], [-46, 10], [-46, -10], [-41, -28], [-28, -40], [-8, -46], [14, -46], [29, -41], [39, -30], [44, -14], [46, 2], [42, 28], [12, 41]];
const CHIN = [[34, -3], [46, 2], [74, 24], [58, 46], [10, 42], [16, 18]];
const DOME = [[-30, 40], [-42, 30], [-48, 8], [-46, -22], [-30, -42], [0, -50], [26, -44], [44, -30], [54, -8], [58, 18], [50, 36], [30, 43]];
const OPEN = [[-30, 38], [-41, 29], [-46, 10], [-46, -10], [-41, -28], [-28, -40], [-8, -46], [14, -46], [29, -41], [39, -30], [44, -14], [44, -2], [24, 4], [18, 20], [22, 38]];
/** The goggle (portrait y, top and bottom): the frame across the eye port, between the peak and the
 *  chin bar, as the portrait draws it (../garage/portrait.ts: its rect -23..9), and the strap's band
 *  (through the goggle's middle, round the head). */
const GOG_Y = [-23, 9] as const, STRAP_Y = [-10, 3] as const;
const VISOR = [[2, -28], [30, -36], [45, -26], [53, -8], [55, 8], [30, 13], [2, 8]];
const PEAK: Partial<Record<RigHelmet, number[][]>> = {
  peak: [[-10, -44], [40, -54], [78, -62], [76, -40], [34, -26]],
  duck: [[-10, -44], [40, -52], [98, -52], [96, -34], [34, -26]],
  retro: [[2, -44], [36, -50], [56, -48], [54, -36], [20, -32]],
};
PEAK.fin = PEAK.spike = PEAK.peak;

/** A bike and its rider in diorama `d`, named `id`: `pose(bike)` each frame before `d.draw()`. */
export function rig(d: Diorama, id: string, C: RigColors, kind: RigKind = "2t", helmet: RigHelmet = "peak", model?: string) {
  const root = d.add({ id, shape: "group", size: [1.9, 0, 0.8], tag: { bike: id } });
  const rid = id + ":r";
  const rider = d.add({ id: rid, shape: "group", size: [0.6, 0, 0.5], on: id });
  const parts: DioramaObject[] = [];
  const part = (size: number[], pos: number[], color: string, o: { shape?: "box" | "wedge" | "cyl" | "prism"; on?: string; rot?: number[]; sides?: number; top?: number; taper?: number; outline?: number[][]; mask?: number; emissive?: boolean; layer?: number } = {}) => {
    const p = d.add({ shape: o.shape || "box", size, pos, rot: o.rot, on: o.on || id, color, sides: o.sides, top: o.top, taper: o.taper, outline: o.outline, mask: o.mask, emissive: o.emissive, layer: o.layer, pick: false });
    parts.push(p);
    return p;
  };
  const group = (gid: string, on: string) => d.add({ id: gid, shape: "group", size: [0.2, 0, 0.2], on, pick: false });
  /** A side-profile slab: outline `pts` ([x, y] in its parent's frame) extruded `w` across, centred on
   *  `z` (a prism turned on its side, as the helmet's are); with `ink` (the default) a dark twin grown
   *  INK_W all round on the layer just under it, so the shape wears the art's ink edge from any side. */
  const slab = (pts: number[][], w: number, z: number, color: string, o: { on?: string; layer: number }, ink = INK_W) => {
    let P = pts.map(([x, y]) => [x!, -y!]);
    if (area(P) * area(SHELL) < 0) P = P.reverse();
    const at = (q: number[][], ww: number, c: string, layer: number) =>
      part([Math.max(...q.map((v) => v[0]!)) - Math.min(...q.map((v) => v[0]!)), ww, 0], [0, 0, z - ww / 2], c, { ...o, shape: "prism", outline: q, rot: [PI / 2, 0, 0], layer });
    if (ink) at(grow(P, ink), w + 2 * ink, INK, o.layer - 0.01);
    return at(P, w, color, o.layer);
  };
  /** The light alloy of a gas bike's frame, swingarm and plain fork tubes. */
  const ALLOY = mix(C.metal, C.pipe, 0.35);
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
  //   0.99–1.4 far-side parts (FAR_DROP from 5.99–6.4): the far fork leg, swingarm arm (and its ink),
  //            exhaust, side plate
  //   1.5–2.1  a wheel and its fender at the far end of the bike (the eye is past the other end)
  //   3–3.6    a wheel and its fender seen from the side
  //   3.16     a gas bike's far shroud block (under the tank: its side group drops by 1)
  //   4–4.3    the body on the centre plane: frame, engine, tank and shrouds, seat, side panels, plate,
  //            bars, then their graphics (a gas bike's: ./bodies.ts `dirt`, each inked shape's ink
  //            0.01 under it; the near shroud block 4.16)
  //   4.5–5.1  a wheel and its fender at the near end (within 45° of straight ahead or behind; a gas
  //            bike's fender ink 0.01 under its fender)
  //   6–6.4    near-side parts: the near fork leg, swingarm arm, exhaust, side plate
  //   7        the rider (near-side leg and arm, torso, helmet)
  // Every bike is the art's style (./bodies.ts: `dirt` for a gas dirt bike, `body` for the others, and
  // LOOK, the per-model table): a dark tyre, a light rim and a three-spoke hub, an inked tapered
  // swingarm, fork tubes (the model's colour over chrome); tests/bikes.browser.mjs sweeps its draw order.
  // A wheel's level comes from two nested groups with `behind`, pointing out of its end of the bike
  // and 45° to each side: both face the eye (the near end), one does (the side), neither (the far end).
  // A side's parts hang from a group just off the centre plane (x 0: only which side the eye is on counts).
  const hubs: DioramaObject[] = [], ends: DioramaObject[] = [];
  // The model's look (./bodies.ts LOOK), or its family's base (a rival carries no model).
  const gas = kind === "2t" || kind === "4t", DL = bikeLook(kind, model);
  // The wheel's dish: between the tyre and the rim, so it reads solid, not a hole (near the tyre's
  // black, under a light three-spoke hub).
  const dish = mix(C.tyre, C.rim, 0.16);
  for (let i = 0; i < 2; i++) {
    const hid = id + ":w" + i, f = i ? 1 : -1;
    d.add({ id: hid + "a", shape: "group", size: [0.2, 0, 0.2], pos: [f * END, 0, END], on: id, behind: END_DROP, pick: false });
    d.add({ id: hid + "b", shape: "group", size: [0.2, 0, 0.2], pos: [f * END, 0, -END], on: hid + "a", behind: END_DROP, pick: false });
    const hub = group(hid, hid + "b");
    // The tyre: one closed band (tread and both sidewalls). Each face of the wheel (rim ring, a solid
    // dish, spokes, the hub) is thin and sits on its sidewall, on a side group that drops under the
    // tyre on the far side (`behind`), so the far face never shows through the near sidewall.
    part([0.68, 0.15, 0.68], [0, 0, -0.075], C.tyre, { shape: "cyl", sides: 16, rot: [PI / 2, 0, 0], on: hid, layer: WHEEL });
    for (const s of [-1, 1]) {
      const sid = hid + (s < 0 ? "L" : "R"), z = (h: number) => (s > 0 ? 0.075 : -0.075 - h) - s * END, o = { on: sid, rot: [PI / 2, 0, 0] };
      d.add({ id: sid, shape: "group", size: [0.2, 0, 0.2], pos: [0, 0, s * END], on: hid, behind: FACE_DROP, pick: false });
      part([0.52, 0.006, 0.52], [0, 0, z(0.006)], C.rim, { ...o, shape: "cyl", sides: 14, layer: WHEEL + 0.05 });
      part([0.42, 0.01, 0.42], [0, 0, z(0.01)], dish, { ...o, shape: "cyl", sides: 12, layer: WHEEL + 0.06 });
      // The hub's three spokes: out from the middle to the rim, 120° apart.
      for (let k = 0; k < 3; k++) {
        part([0.2, 0.05, 0.012], [Math.cos(k * 2.094) * 0.1 + Math.sin(k * 2.094) * 0.025, Math.sin(k * 2.094) * 0.1 - Math.cos(k * 2.094) * 0.025, s * (0.091 - END)], C.rim, { on: sid, rot: [0, 0, k * 2.094], layer: WHEEL + 0.07 });
      }
      part([0.13, 0.03, 0.13], [0, 0, z(0.03)], C.metal, { ...o, shape: "cyl", sides: 8, layer: WHEEL + 0.08 });
    }
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
    const s = Math.sign(z), k = s < 0 ? "L" : "R", ao = { on: sideOf(id + ":arm" + k, id + ":arm", s), layer: NEAR };
    const fo = { on: sideOf(id + ":fk" + k, id + ":fk", s), layer: NEAR }, so = { on: sideOf(id + ":sl" + k, id + ":sl", s), layer: NEAR + 0.1 };
    // A tapered swingarm (alloy; a pedal bike's chainstays in its frame's paint), inked; real fork
    // tubes: the fat outer tube from the clamp (the model's colour: gold on a factory bike) over the
    // chrome inner tube down to a dark axle lug.
    slab([[0, 0.05], [0.64, 0.025], [0.68, -0.025], [0, -0.06]], DL.cycle ? 0.04 : 0.05, z - s * END, DL.cycle ? C.plastic : ALLOY, ao);
    part([0.09, 0.42, 0.09], [0, 0, z - s * END], DL.fork ?? ALLOY, { ...fo, shape: "cyl", sides: 8, rot: [0, 0, -PI / 2], layer: NEAR + 0.2 });
    part([0.062, 0.36, 0.062], [0, 0, z - s * END], C.metal, { ...so, shape: "cyl", sides: 8, rot: [0, 0, -PI / 2] });
    part([0.11, 0.05, 0.08], [0.01, -0.035, z - s * END], C.frame, so);
  }
  // The exhaust runs down the right side.
  const ex = sideOf(id + ":ex", id, 1);
  // The fenders (and the tail light) ride with their wheel's level, always just over its tyre.
  const rearEnd = ends[0]!.id!, frontEnd = ends[1]!.id!, eo = 2 * END;
  // An electric or street bike: its own body (./bodies.ts), on the same layers and groups as the gas
  // bike's: the body on the centre plane, the right side's parts on the exhaust's group (the left on
  // its own side group), the fenders and the tail on their wheel's level.
  let left = "";
  const kit: BodyKit = {
    part, C, body: BODY, near: NEAR, fender: WHEEL + 0.5, inset: END, rear: rearEnd, front: frontEnd, eo,
    side: (s) => (s > 0 ? ex : left || (left = sideOf(id + ":exL", id, -1))),
    group: (gid, on = id, z = 0, drop = 0) => d.add({ id: id + gid, shape: "group", size: [0.2, 0, 0.2], pos: [0, 0, z * END], on, behind: drop, pick: false }),
    slab, alloy: ALLOY,
  };
  const built = gas ? dirt(kind as "2t" | "4t", kit, DL) : body(kind as BodyKind, kit, DL);
  extras(kind, C.up, kit);
  const fender = built.fender;
  const NP = built.plates;
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
  if (C.num !== undefined) {
    // Side plates with the rider's number, one per side, in seven-segment bars; each side hangs from a
    // side group (it drops under the bodywork and the wheels on the far side), and reads the right way round.
    // Number 0 is a blank plate (a showroom bike: no rider's number on it yet).
    const n = Math.max(0, Math.min(99, C.num | 0)), ds = n > 9 ? [(n / 10) | 0, n % 10] : n ? [n] : [], ink = C.sideInk ?? C.ink;
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
  const TL = built.tail ?? [-0.9, 0.08];
  part([0.05, 0.05, 0.05], [TL[0] + eo, TL[1], 0], C.glow, { emissive: true, on: rearEnd, layer: WHEEL + 0.6 });

  // ---- the rider (on the bike, or thrown clear after a crash) ----
  const torso = group(id + ":t", rid);
  part([TORSO, 0.2, 0.32], [TORSO / 2, -0.1, 0], C.jersey, { on: id + ":t" });
  part([0.12, 0.21, 0.33], [TORSO * 0.62, -0.105, 0], C.stripe, { on: id + ":t", layer: 5 });
  // The helmet, the portrait's side profile in 3D (../garage/portrait.ts: its shell, peak, goggle,
  // chin bar and open face, in the portrait's units, PK of the old size each): every piece is that
  // outline extruded across the head as slabs, a full one in the middle and two on each side, each
  // side slab's outer face the profile shrunk toward the head's centre (a prism's `taper`), so side-on
  // it is the portrait's outline and from the front or the back it rounds off, round at the back and
  // under it. The goggle (a thick frame in the band, the lens in the visor tint standing proud of it, a
  // glint) sits in front of the shell; the strap is the shell's slabs again, a band a little bigger
  // than the shell from the back round to the goggle; the chin bar is a narrower slab jutting forward and
  // down, stepped from the shell; the peak is a profile too, its sides shrunk toward its root.
  // Its draw order (the rider is layer 7; faces in one layer sort by depth, back faces are culled):
  //   6.1–6.4   facing away (the face group and the far side's strap drop by 1): under the shell
  //   7         the shell's slabs, the chin bar's, the dome's visor rim (solids, sorted together by
  //             depth), like the torso, the arms and the legs on the near side
  //   7.05      the dome visor's side plates (under the shell from the far side or past 102°)
  //   7.1       the strap (each side's half under the shell from the other side); the fin and the
  //             spikes (on the crown, over it from any side)
  //   7.2       the goggle's frame, the open face's dark face
  //   7.3       the lens (the dome's visor)
  //   7.35      the peak              7.4  the glint (its front face only)
  // The face hangs from a group just in front of the head's centre (x END: only whether the eye is in
  // front of the face or behind it counts) with `behind`, as the far leg and arm
  // are; the swap at exactly side-on only hides what is inside the
  // shell's outline then (tests/helmet.browser.mjs sweeps the yaws and pitches).
  const HS = 1.18, head = group(id + ":h", rid), hf = id + ":hf", ho = { on: id + ":h" }, fo = { on: hf };
  const dome = helmet === "dome", open = helmet === "retro";
  /** A part of the helmet, its size and place given at the old size. */
  const hp = (size: number[], pos: number[], color: string, o: Parameters<typeof part>[3]) => part(size.map((v) => v * HS), pos.map((v) => v * HS), color, o);
  // The goggle's frame: the stripe, or (a stripe the shell's own colour) a dark or light band; the
  // strap is the band toward the shell's colour, so it reads as a strap, not a stripe round the head.
  const band = bandOf(C.helmet, C.stripe), strap = strapOf(C.helmet, band);
  /** Portrait units to the old size, and the head's centre (the portrait's 0, 0) in it. */
  const PK = 0.0033, O = [0.015, 0.105];
  /** Outline `pts` (portrait [x, y], y down) about [ox, oy], extruded across the head: a slab `w` wide
   *  in the middle (`half` 1: halves, one on each side's group; 2: none) and on each side a slab `w1` (its outer face
   *  scaled `t1`) and one `w2` (`t2`), the -z side on `on[0]` and the +z side on the last. Old size. */
  const slabs = (pts: number[][], w: number, w1: number, t1: number, w2: number, t2: number, color: string, layer: number, on: string[], oxy = O, half = 0) => {
    for (const sd of [-1, 0, 1]) {
      if (!sd && half) continue;
      const g = on[sd > 0 ? on.length - 1 : 0]!;
      for (const [z0, ww, sc, tp] of sd ? [[half ? 0 : w / 2, half > 1 ? 0 : half ? w / 2 : 0, 1, 1], [w / 2, w1, 1, t1], [w / 2 + w1, w2, t1, t2]] : [[-w / 2, w, 1, 1]]) {
        if (!ww) continue;
        // Its outer face (the prism's bottom, scaled by `taper`) at z0 + ww out to its side.
        part([0, ww! * HS, 0], [oxy[0]! * HS, oxy[1]! * HS, (sd ? sd * (z0! + ww!) : z0!) * HS], color, { on: g, shape: "prism", taper: tp, layer, rot: [sd > 0 ? -PI / 2 : PI / 2, 0, 0],
          outline: pts.map(([x, y]) => [x! * PK * sc! * HS, (sd > 0 ? -y! : y!) * PK * sc! * HS]) });
      }
    }
  };
  const SH = [0.1, 0.055, 0.86, 0.03, 0.62] as const;
  slabs(dome ? DOME : open ? OPEN : SHELL, ...SH, C.helmet, 7, [id + ":h"]);
  d.add({ id: hf, shape: "group", size: [0.2, 0, 0.2], pos: [END, 0, 0], on: id + ":h", behind: 1, pick: false });
  const k = (pts: number[][], s: number) => pts.map(([x, y]) => [x! * s, y! * s]);
  const shellP = dome ? DOME : open ? OPEN : SHELL;
  if (dome) {
    // A street full-face: the big visor in its rim, wrapping round the front of the shell, a flush chin.
    // The rim and the lens hang from the face (under the shell from behind) and stay inside the shell's
    // outline (clipped to it), so from behind none of the visor shows past the shell's edge.
    slabs(clip(k(VISOR, 1.06), k(DOME, 0.98)), 0.1, 0.055, 0.86, 0, 1, band, 7.2, [hf]);
    slabs(clip(k(VISOR, 0.98), k(DOME, 0.97)), ...SH, C.visor, 7.3, [hf]);
    // Its side, as the portrait shows it: the rim and the lens as thin plates on the side slabs' outer
    // face, each on the near side's group (as the strap is: it never swaps with the face, so side-on
    // the visor stays) and in it one off the front turned 10° to that side (`behind` on both: under the
    // shell once the eye is round the other side or over 100° from the face). Each plate is clipped to
    // the shell's outline where it sits (the side slab's taper there), so dropped it is hidden.
    for (const sd of [-1, 1]) {
      const gid = id + (sd < 0 ? ":hvL" : ":hvR");
      d.add({ id: gid + "s", shape: "group", size: [0.2, 0, 0.2], pos: [0, 0, sd * END], on: id + ":h", behind: 1, pick: false });
      d.add({ id: gid, shape: "group", size: [0.2, 0, 0.2], pos: [END, 0, sd * 0.176 * END], on: gid + "s", behind: 1, pick: false });
      for (const [sc, z, c, l] of [[0.96, 0.105, band, 7.05], [0.9, 0.107, C.visor, 7.06]] as const)
        part([0, 0.004 * HS, 0], [O[0]! * HS, O[1]! * HS, sd * (z + 0.004) * HS], c, { on: gid, shape: "prism", layer: l, rot: [sd > 0 ? -PI / 2 : PI / 2, 0, 0],
          outline: clip(k(VISOR, sc), k(DOME, 0.76)).map(([x, y]) => [x! * PK * HS, (sd > 0 ? -y! : y!) * PK * HS]) });
    }
  } else {
    // The goggle, as the portrait and the box art draw it: a big rounded frame across the eye port at
    // eye height (GOG_Y: between the peak and the chin bar, about 60 % of the head's width), its front
    // just inside the shell's face, the lens filling most of it a hair proud. Side-on the goggle's side
    // shows as the portrait has it: a frame and a lens plate on each side, on a group off the front
    // turned 10° to that side (`behind` on both, as the dome's visor: under the shell once the eye is
    // round the other side or over 100° from the face), clipped inside the shell's outline there.
    const gy0 = open ? GOG_Y[0] - 2 : GOG_Y[0], gy1 = open ? 0 : GOG_Y[1];
    const gh = (gy1 - gy0) * PK, gy = O[1]! - ((gy0 + gy1) / 2) * PK, fx = O[0]! + 37 * PK;
    const goggle = (x0: number, len: number, h: number, w: number, color: string, layer: number) =>
      part([0, len * HS, 0], [x0 * HS, gy * HS, 0], color, { ...fo, shape: "prism", layer, rot: [0, 0, -PI / 2], outline: rounded(h * HS, w * HS) });
    goggle(fx - 0.094, 0.092, gh, 0.17, band, 7.2);
    goggle(fx - 0.004, 0.006, gh * 0.8, 0.15, C.visor, 7.3);
    const box = (x0: number, x1: number, y0: number, y1: number) => rounded(x1 - x0, y1 - y0).map(([x, y]) => [x! + (x0 + x1) / 2, y! + (y0 + y1) / 2]);
    const gm = (gy0 + gy1) / 2, lh = ((gy1 - gy0) * 0.8) / 2;
    for (const sd of [-1, 1]) {
      const gid = id + (sd < 0 ? ":hgL" : ":hgR");
      d.add({ id: gid + "s", shape: "group", size: [0.2, 0, 0.2], pos: [0, 0, sd * END], on: id + ":h", behind: 1, pick: false });
      d.add({ id: gid, shape: "group", size: [0.2, 0, 0.2], pos: [END, 0, sd * 0.176 * END], on: gid + "s", behind: 1, pick: false });
      for (const [P, z, c, l] of [[clip(box(8, 52, gy0, open ? -4 : gy1), k(SHELL, 0.8)), 0.086, band, 7.2], [clip(box(14, 48, gm - lh, open ? -5 : gm + lh), k(SHELL, 0.76)), 0.088, C.visor, 7.3]] as const)
        part([0, 0.004 * HS, 0], [O[0]! * HS, O[1]! * HS, sd * (z + 0.004) * HS], c, { on: gid, shape: "prism", layer: l, rot: [sd > 0 ? -PI / 2 : PI / 2, 0, 0],
          outline: P.map(([x, y]) => [x! * PK * HS, (sd > 0 ? -y! : y!) * PK * HS]) });
    }
    // The strap: a thin band round the head at goggle height (STRAP_Y), from the goggle's sides round
    // the back, hugging the shell: the shell's own cross-section there (each slab's back edge at its
    // taper) 1.5 % proud, as a thin wall (a ring's slice, so from above it is a line, never a cap over
    // the crown). Its back on a group behind the head, each side's on a group off that side and a
    // little back (`behind`: under the shell once the eye is in front or round the other side).
    // (each slab's scale across: the middle 1, the first side slab 1 → 0.86, the outer one 0.86 → 0.86 × 0.62)
    const ym = (STRAP_Y[0] + STRAP_Y[1]) / 2, sz = (z: number) => (z <= 0.05 ? 1 : z <= 0.105 ? 1 - ((z - 0.05) / 0.055) * 0.14 : 0.86 - ((z - 0.105) / 0.03) * 0.86 * 0.38);
    // (the back edge at the band's top, middle and bottom, the least: so the wall stays on the shell at every height)
    const xb = (z: number) => sz(z) * Math.max(...[STRAP_Y[0], ym, STRAP_Y[1]].map((y) => backX(shellP, y / sz(z))));
    const wall = (pts: number[][], gid: string) => {
      const out = pts.map(([x, z]) => [x! * 1.015, z! * 1.015]), inn = pts.map(([x, z]) => [x! * 0.93, z! * 0.93]).reverse();
      part([0, (STRAP_Y[1] - STRAP_Y[0]) * PK * HS, 0], [O[0]! * HS, (O[1]! - STRAP_Y[1] * PK) * HS, 0], strap, { on: gid, shape: "prism", layer: 7.1,
        outline: [...out, ...inn].map(([x, z]) => [x! * PK * HS, z! * HS]) });
    };
    d.add({ id: id + ":hsB", shape: "group", size: [0.2, 0, 0.2], pos: [-END, 0, 0], on: id + ":h", behind: 1, pick: false });
    wall([[xb(0), -0.05], [xb(0), 0.05]], id + ":hsB");
    for (const sd of [-1, 1]) {
      const gid = id + (sd < 0 ? ":hsL" : ":hsR");
      d.add({ id: gid, shape: "group", size: [0.2, 0, 0.2], pos: [-0.7 * END, 0, sd * END], on: id + ":h", behind: 1, pick: false });
      wall([0.05, 0.0775, 0.105, 0.12, 0.135].map((z) => [xb(z), sd * z]).concat([[Math.min(16, sz(0.135) * Math.min(...STRAP_Y.map((y) => frontX(shellP, y / sz(0.135))))), sd * 0.135]]), gid);
    }
  }
  hp([0.008, 0.018, 0.045], [dome ? 0.22 : 0.21, dome ? 0.12 : 0.146, 0.04], mix(C.visor, "#ffffff", 0.72), { ...fo, layer: 7.4, emissive: true, mask: 4 });
  if (open) slabs([[24, 4], [44, 4], [50, 18], [44, 30], [24, 38], [19, 20]], 0.12, 0.02, 0.9, 0, 1, "#2a2233", 7.2, [hf]);
  else if (!dome) slabs(CHIN, 0.1, 0.035, 0.85, 0, 1, C.helmet, 7, [id + ":h"]);
  const pk = PEAK[helmet];
  // The peak: its side profile, its sides shrunk toward its root (thinner and shorter at the edges).
  if (pk) slabs(pk.map(([x, y]) => [x! - pk[0]![0]!, y! - pk[0]![1]!]), 0, open ? 0.1 : 0.115, 0.62, 0, 1, C.stripe, 7.35, [hf], [O[0]! + pk[0]![0]! * PK, O[1]! - pk[0]![1]! * PK], 1);
  // A shark fin along the crown (a side profile, thin across the head), glowing.
  if (helmet === "fin") part([0, 0.03 * HS, 0], [0, 0, -0.015 * HS], C.stripe, { ...ho, shape: "prism", outline: [[-0.11, 0.21], [0.07, 0.235], [-0.07, 0.315], [-0.14, 0.24]].map(([x, y]) => [x! * HS, -y! * HS]), rot: [PI / 2, 0, 0], layer: 7.1, emissive: true });
  if (helmet === "spike") for (let i = 0; i < 3; i++) hp([0.05, 0.08, 0.04], [-0.09 + i * 0.065, 0.225 - i * 0.012, 0], C.stripe, { ...ho, shape: "cyl", sides: 4, top: 0, layer: 7.1 });
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
    upper.push(bone(k + "ua", UPPER, 0.11, 0, C.jersey, k + "sd"));
    const fa = bone(k + "fa", FORE, 0.1, 0, C.jersey, k + "sd");
    part([0.09, 0.1, 0.1], [FORE, -0.05, 0], C.gloves, { on: k + "fa" });
    fore.push(fa);
  }

  /** The hand drag now: how far (0..1), the road's direction in the bike's frame (x, y). */
  const DG = new Float64Array(3);
  /** Walking the bike: on (0/1), the stride's phase, the ground's height in the rider's frame. */
  const WALKP = new Float64Array(3);
  /** The trick pose (see TRICK_POSE), written by the game. */
  const T = new Float64Array(TRICK_POSE), Z = new Float64Array(TRICK_POSE);
  /** The trick channels the limbs read now (T on the bike, zeros thrown or walking). */
  let E = Z;
  let thrown = false;
  /** The right hand's drag now (its release blend: eased toward T[9] × the drag over about RELEASE s,
   *  so it eases off the bar when the double hand drag starts and back onto it after). */
  const RH = new Float64Array(1);
  /** Each hand's target off the drag and its drag blend ([x, y, drag] left, then right). */
  const HT = new Float64Array(6);
  /** A limb bone at (x, y, z) in its side group, turned by the solve's frame (L at `o`): the only place a
   *  limb part is placed, so each joint is the one point both bones share. */
  const seg = (g: DioramaObject, x: number, y: number, z: number, o: number) => {
    g.pos[0] = x; g.pos[1] = y; g.pos[2] = z;
    g.rot[0] = L[o]!; g.rot[1] = L[o + 1]!; g.rot[2] = L[o + 2]!;
  };

  /** Pose everything from bike `b` (call each frame before draw). `stand` 0..1: sitting to the attack position. */
  function pose(b: Bike, stand = 0.7, dt = 1 / 60) {
    root.pos.set(b.pos);
    root.rot.set(b.rot);
    const R = b.radius, rx = b.rear, fx = b.front, dy = -b.drop;
    // Wheels on their springs, spinning; the swingarm to the rear axle; the fork to the front.
    const ry = dy + b.comp[0]!, fy = dy + b.comp[1]!;
    hubs[0]!.pos[0] = rx + 2 * END; hubs[0]!.pos[1] = ry; hubs[0]!.rot[2] = -b.spin[0]!;
    hubs[1]!.pos[0] = fx - 2 * END; hubs[1]!.pos[1] = fy; hubs[1]!.rot[2] = -b.spin[1]!;
    hubs[1]!.rot[1] = (b.contact[1] || b.air > 0 ? -b.steerAngle * 0.6 : 0) - 0.75 * T[T_BARS]!;
    arm.pos[0] = PIVOT[0]!; arm.pos[1] = PIVOT[1]!;
    arm.rot[2] = Math.atan2(ry - PIVOT[1]!, rx - PIVOT[0]!);
    const fa = Math.atan2(fy - HEAD[1]!, fx - HEAD[0]!);
    fork.pos[0] = HEAD[0]!; fork.pos[1] = HEAD[1]!; fork.rot[2] = fa;
    slider.pos[0] = fx; slider.pos[1] = fy; slider.rot[2] = fa + PI;
    fender!.pos[1] = fy + R + 0.02;
    void R;
    if (b.crashed || b.walking) RH[0] = 0;
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
    const rt = T[8]! * T[9]!, rk = Math.min(1, dt / RELEASE);
    RH[0] = rt > RH[0]! ? Math.min(rt, RH[0]! + rk) : Math.max(rt, RH[0]! - rk);
    E = T;
    limbs(b.lean, stand, T[0]!, T[1]!, T[2]!, T[3]! + 0.5 * T[8]!, T[6]!, T[7]!, false, T[4]!);
    E = Z;
    DG[0] = 0;
  }
  /** The rider's body: weight (−1 forward .. 1 back), standing, hands and feet off, spread, out over the back. */
  function limbs(lean: number, stand: number, hands: number, feet: number, spread: number, back: number, arms: number, tuck: number, loose: boolean, up = 0) {
    // The hip: over the pegs standing, on the seat sitting; back with the weight, up off the seat in a trick.
    // The freestyle set (zeros unless a mode writes them): a handstand puts the hips over the bike.
    const grab = E[T_GRAB]!, nac = E[T_NAC]!, can = E[T_CAN]!, heels = E[T_HEELS]!, hs = E[T_HANDSTAND]!;
    let hx = SEAT[0]! + 0.08 * stand - 0.14 * lean - 0.25 * back + 0.1 * tuck + 0.18 * hs + 0.12 * heels;
    const hy = SEAT[1]! + 0.06 + 0.2 * stand + 0.22 * up + 0.12 * back - 0.06 * tuck + 0.72 * hs;
    // The torso leans forward over the bars (less with the weight back; flat out over the back in a
    // plank; upright or lying back with the body's pitch; head down over the seat in a handstand).
    const tilt0 = 0.75 - 0.35 * lean + 0.25 * stand - 0.6 * back + 0.35 * tuck + E[T_BODY]!, tilt = tilt0 + (PI - 0.25 - tilt0) * hs, ta = PI / 2 - tilt;
    const rh = RH[0]!, reach = UPPER + FORE;
    // Each hand's target off the drag (x, y): its grip; hands off, up and out; the right hand back on
    // the seat (a seat grab; in a handstand, the seat's middle); in a handstand the other hand stays on
    // its grip. With it how far each hand is in the drag (the left with the drag, the right with its own
    // release blend, `RH`), and how firmly it holds its grip (off the drag, hands on, not grabbing).
    let shift = 0;
    for (let s = 0; s < 2; s++) {
      let gx = GRIP[0]! - hands * (0.55 + 0.25 * arms), gy = GRIP[1]! + hands * (0.65 - 0.3 * arms) + (loose ? 0.3 : 0);
      if (s === 1 && grab) (gx += (-0.42 + 0.22 * hs - gx) * grab), (gy += (0.17 - gy) * grab);
      if (s === 0 && hs) (gx += (GRIP[0]! - gx) * hs), (gy += (GRIP[1]! - gy) * hs);
      const dr = s === 0 ? DG[0]! : rh * rh * (3 - 2 * rh);
      HT[s * 3] = gx; HT[s * 3 + 1] = gy; HT[s * 3 + 2] = dr;
      // A hand on its grip keeps the body within reach of it: the shoulder slides along the bike
      // (hip and torso with it) by as little as puts the grip in reach (weight back in a wheelie, the
      // body back in a hand drag).
      const hold = loose ? 0 : (1 - dr) * (1 - hands) * (s === 1 ? 1 - grab : 1);
      if (!hold) continue;
      const qx = gx - (hx + Math.cos(ta) * (TORSO - 0.05)), qy = gy - (hy + Math.sin(ta) * (TORSO - 0.05)), r = reach * 0.99;
      const room = Math.sqrt(Math.max(0, r * r - qy * qy)), need = Math.abs(qx) > room ? (qx - Math.sign(qx) * room) * hold : 0;
      if (Math.abs(need) > Math.abs(shift)) shift = need;
    }
    hx += shift;
    torso.pos[0] = hx; torso.pos[1] = hy; torso.rot[2] = ta;
    const sx = hx + Math.cos(ta) * (TORSO - 0.05), sy = hy + Math.sin(ta) * (TORSO - 0.05);
    head.pos[0] = hx + Math.cos(ta) * (TORSO + 0.06); head.pos[1] = hy + Math.sin(ta) * (TORSO + 0.06) - 0.02; head.rot[2] = ta - PI / 2 + 0.15 + Math.min(0.85, Math.max(0, PI / 2 - ta) * 0.9);
    for (let s = 0; s < 2; s++) {
      const side = s ? 1 : -1;
      // Legs: hip to peg (knee forward); feet off, the foot goes back and out (a plank, a split).
      let px = PEG[0]! - feet * 0.85 + tuck * 0.35 + (loose ? 0.1 * side : 0), py = PEG[1]! + feet * 0.42 + tuck * 0.45 + (loose ? -0.2 : 0);
      if (WALKP[0]) {
        // A stride: the boots out of phase, forward and back of the hip, the swinging one lifted.
        const ph = Math.sin(WALKP[1]! + side * PI / 2);
        px = hx + 0.06 + ph * 0.2; py = WALKP[2]! + Math.max(0, Math.cos(WALKP[1]! + side * PI / 2)) * 0.07;
      }
      // Both feet up over the bars; the right leg over the back (a nac-nac) or the tank (a can-can) to
      // the far side; legs straight up (a handstand).
      if (heels) (px += (0.72 - px) * heels), (py += (0.5 - py) * heels);
      const over = s === 1 ? (nac > can ? nac : can) : 0;
      if (s === 1 && nac) (px += (-0.8 - px) * nac), (py += (0.45 - py) * nac);
      if (s === 1 && can) (px += (0.42 - px) * can), (py += (0.3 - py) * can);
      if (hs) (px += (hx - 0.12 - px) * hs), (py += (hy + 0.8 - py) * hs);
      let lz = side * (0.15 + spread * 0.55 + (loose ? 0.15 : 0));
      if (over) lz += (-0.34 - lz) * over;
      if (heels) lz += (side * 0.06 - lz) * heels;
      // The foot's target in 3D (z from the side group at side × 0.15; the hip at its origin): the leg
      // spread swings it out about the hip (roll ro), the trick offsets move it across; then one solve
      // places the knee, so the thigh ends exactly where the shin begins.
      const ro = -side * spread * 0.9, cr = Math.cos(ro), sr = Math.sin(ro), fy = py - hy;
      ik3(hx, hy, 0, px, hy + fy * cr, fy * sr + lz - side * 0.15, THIGH, SHIN, 0, -sr, cr, 1);
      seg(thigh[s]!, hx, hy, 0, 0);
      seg(shin[s]!, K[0]!, K[1]!, K[2]!, 3);
      // Arms: shoulder to grip (elbow out and down). The hand's target in 3D (z from the side group;
      // the shoulder at side × 0.04, the grip at side × 0.05). The hand drag: the hand reaches down to
      // the road and out from the bike, straight-armed.
      const gx = HT[s * 3]!, gy = HT[s * 3 + 1]!, dr = HT[s * 3 + 2]!, sz = side * 0.04;
      const ox = DG[1]!, oy = DG[2]!, oz = side * 0.55, ol = (reach * 0.98) / Math.hypot(ox, oy, oz);
      const tx = gx + (sx + ox * ol - gx) * dr, ty = gy + (sy + oy * ol - gy) * dr, tz = side * (0.05 + (loose ? 0.2 : 0)) + (sz + oz * ol - side * 0.05) * dr;
      // Arms spread (hands off): spread wide, the arm straightens and lifts a little above the shoulder
      // (its angles toward 1.25), and the whole arm swings out sideways about the shoulder (turned about
      // y): the hand goes there and its plane turns with it.
      const sp = arms * hands * 1.3, ca = Math.cos(sp), sa = Math.sin(sp), st = sp / 1.3;
      ik(sx, sy, tx, ty, UPPER, FORE, -1);
      const a0 = J[0]! + (1.25 - J[0]!) * st, a1 = J[1]! + (1.25 - J[1]!) * st;
      const hx2 = UPPER * Math.cos(a0) + FORE * Math.cos(a1), hy2 = UPPER * Math.sin(a0) + FORE * Math.sin(a1);
      ik3(sx, sy, sz, sx + hx2 * ca, sy + hy2, tz + side * hx2 * sa, UPPER, FORE, -side * sa, 0, ca, -1);
      seg(upper[s]!, sx, sy, sz, 0);
      seg(fore[s]!, K[0]!, K[1]!, K[2]!, 3);
    }
  }
  /** New colours (a theme change). */
  function recolor(next: RigColors) {
    void next;
  }
  return { root, rider, T, pose, recolor, parts };
}
export type Rig = ReturnType<typeof rig>;
