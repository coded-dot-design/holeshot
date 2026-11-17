// Endless Desert's world, headless: a dune sea that never ends. The ground is a pure function of the
// seed and the world position (`heightAt(seed, x, z)`: big ridged dunes across the wind, witches'-hat
// peaks, bowls, and features on a coarse lattice: kickers, whoop sections, cactus clusters, rock
// piles, a camp with its beacon), so the same place always has the same sand, on every screen and
// every engine (only + − × ÷, floors and square roots: ../../math.ts rules). What the bike rides is a
// window of that ground around the rider (`world.t`, a @fzlt/core/terrain-shaped heightfield whose
// origin moves in whole steps): when the rider gets STEP units from the window's middle, the window
// slides, the rows it keeps are copied and only the new strip is computed. The window never decides
// a height, so where it sits is not state. Zero allocation per step (typed arrays, fixed sizes).
import type { Terrain } from "@fzlt/core/terrain";

/** The window: cells a side, the cell (world units, as the open maps), the slide step in cells. */
export const WIN = 160, CELL = 0.5, STEP = 16, HALF = (WIN * CELL) / 2;
const WIN0 = WIN, CELL0 = CELL, STEP0 = STEP;
/** The far ring: the same ground on a coarse window (cells a side, the cell, the slide step in cells)
 *  that the view reads for the ridgelines to the horizon (never the bike: it rides the near window). */
export const FAR_WIN = 136, FAR_CELL = 4, FAR_STEP = 4;
/** The feature lattice (world units a cell) and the peak lattice. */
export const FCELL = 40, PCELL = 72;
/** Feature kinds on the lattice. */
export const D_NONE = 0, D_KICKER = 1, D_WHOOPS = 2, D_CACTUS = 3, D_ROCKS = 4, D_CAMP = 5;
/** A post's place round its feature: one of eight directions (the scene places the same). */
export const postDir = (i: number, j: number, q: number, seed: number) => ((hashI(i * 7 + q, j, seed + 90) & 7) + q * 2) & 7;
export const DIRS = [1, 0, 0.7071067811865476, 0.7071067811865476, 0, 1, -0.7071067811865476, 0.7071067811865476, -1, 0, -0.7071067811865476, -0.7071067811865476, 0, -1, 0.7071067811865476, -0.7071067811865476];
export const D_NAMES = ["", "KICKER", "WHOOPS", "CACTUS", "ROCKS", "CAMP"];
/** The endless biomes: the desert (Free Ride's DUNE SEA, endless) and one per other open Free Ride
 *  map, each its own ground on the same streaming window: B_QUARRY benches and faces, B_FOREST
 *  wooded hills, B_PARK a flat park of jump lines. Feature kinds keep their slots: per biome a kicker
 *  is a ledge, a log jump or a double; whoops are rubble, roots or rollers; the "cactus" cluster is a
 *  stand of trees or a row of pylons; the camp is a light tower or a cabin. */
export const B_DESERT = 0, B_QUARRY = 1, B_FOREST = 2, B_PARK = 3;
/** Per biome: the feature mix (the roll's upper bounds for none, kicker, whoops, cactus, rocks; the camp
 *  takes the rest), the whoops' height, the cluster's post radius. */
const MIX = [
  [0.5, 0.68, 0.78, 0.86, 0.94], [0.42, 0.62, 0.7, 0.7, 0.92], [0.34, 0.48, 0.6, 0.88, 0.95], [0.3, 0.6, 0.76, 0.86, 0.88],
];
const WH = [0.25, 0.32, 0.12, 0.28], POST_R = [0.22, 0.22, 0.32, 0.18];
/** The wind (crests run across it): a unit vector. */
const WX = 0.9578262852211514, WZ = 0.28734788556634544;

// The ground is computed thousands of times a slide, so nothing in it passes or returns a double
// through a call (V8 boxes those: an allocation): the hash returns a small integer, and the noise
// reads its place from and writes its value to the scratch Q.
const Q = new Float64Array(8), HI = 1 / 1073741824;
/** A hash of two lattice ints and the seed, 0 .. 2³⁰ − 1 (a small integer: never boxed). */
function hashI(i: number, j: number, s: number) {
  let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(s, 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 15), 0x297a2d39);
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b);
  return (h ^ (h >>> 16)) >>> 2;
}
/** The same, 0..1 (scenery placing, the tests). */
export const hash2 = (i: number, j: number, s: number) => hashI(i, j, s) * HI;
/** Value noise at (Q[0], Q[1]) into Q[2], 0..1; with `ridge`, sharp crests (a slip face and its brink). */
function valueQ(s: number, ridge: number) {
  const a = Q[0]!, b = Q[1]!, i = Math.floor(a), j = Math.floor(b);
  let fa = a - i, fb = b - j;
  fa = fa * fa * (3 - 2 * fa);
  fb = fb * fb * (3 - 2 * fb);
  const v00 = hashI(i, j, s) * HI, v10 = hashI(i + 1, j, s) * HI, v01 = hashI(i, j + 1, s) * HI, v11 = hashI(i + 1, j + 1, s) * HI;
  const v = v00 + (v10 - v00) * fa + (v01 - v00) * fb + (v00 - v10 - v01 + v11) * fa * fb;
  if (!ridge) return void (Q[2] = v);
  const r = 1 - Math.abs(2 * v - 1);
  Q[2] = v + (r * r - v) * 0.75;
}
/** The open dune sea at (Q[4], Q[5]) into Q[3]: long dunes across the wind, a second set, small ripples. */
function dunesQ(seed: number) {
  const x = Q[4]!, z = Q[5]!, a = x * WX + z * WZ, b = z * WX - x * WZ;
  Q[0] = a / 34; Q[1] = b / 90; valueQ(seed, 1);
  let h = 6.2 * Q[2]!;
  Q[0] = a / 12; Q[1] = b / 32; valueQ(seed + 1013, 1);
  h += 1.6 * Q[2]!;
  Q[0] = a / 4.2; Q[1] = b / 9; valueQ(seed + 2026, 0);
  Q[3] = h + 0.35 * Q[2]!;
}
export function dunes(seed: number, x: number, z: number) {
  Q[4] = x; Q[5] = z;
  dunesQ(seed);
  return Q[3]!;
}
/** Eight headings (a feature faces one of them): cos, sin. */
const HD = [1, 0, 0.7071067811865476, 0.7071067811865476, 0, 1, -0.7071067811865476, 0.7071067811865476, -1, 0, -0.7071067811865476, -0.7071067811865476, 0, -1, 0.7071067811865476, -0.7071067811865476];

/** A feature lattice cell: its kind, centre and heading into F = [kind, x, z, heading 0..7]. */
export function featureOf(seed: number, ci: number, cj: number, F: Float64Array, bi = 0) {
  const r = hashI(ci, cj, seed + 77) * HI, M = MIX[bi]!;
  // The start (cell 0, 0) stays open sand.
  const kind = ci === 0 && cj === 0 ? D_NONE : r < M[0]! ? D_NONE : r < M[1]! ? D_KICKER : r < M[2]! ? D_WHOOPS : r < M[3]! ? D_CACTUS : r < M[4]! ? D_ROCKS : D_CAMP;
  F[0] = kind;
  F[1] = (ci + 0.5) * FCELL + (hashI(ci, cj, seed + 78) * HI - 0.5) * 16;
  F[2] = (cj + 0.5) * FCELL + (hashI(ci, cj, seed + 79) * HI - 0.5) * 16;
  F[3] = hashI(ci, cj, seed + 80) & 7;
  return kind;
}
const FF = new Float64Array(4);
/** A biome's open ground at (Q[4], Q[5]) into Q[3] (the desert's is `dunesQ`). */
function baseQ(seed: number, bi: number) {
  if (bi === B_DESERT) return dunesQ(seed);
  const x = Q[4]!, z = Q[5]!;
  if (bi === B_QUARRY) {
    // Benches: a broad rise cut into terraces 1.1 high, each riser a steep face; broken rock over it.
    Q[0] = x / 70; Q[1] = z / 70; valueQ(seed, 0);
    let H = 9 * Q[2]!;
    Q[0] = x / 23; Q[1] = z / 23; valueQ(seed + 1013, 0);
    H = (H + 2.5 * Q[2]!) / 1.1;
    const t = Math.floor(H), f = H - t, u = f < 0.58 ? 0 : (f - 0.58) / 0.42;
    Q[0] = x / 3; Q[1] = z / 3; valueQ(seed + 2026, 0);
    Q[3] = 1.1 * (t + u * u * (3 - 2 * u)) + 0.3 * Q[2]!;
    return;
  }
  if (bi === B_FOREST) {
    // Wooded hills: long rolls, a second set, the forest floor.
    Q[0] = x / 30; Q[1] = z / 30; valueQ(seed, 0);
    let h = 3 * Q[2]!;
    Q[0] = x / 11; Q[1] = z / 11; valueQ(seed + 1013, 0);
    h += 1.3 * Q[2]!;
    Q[0] = x / 3.5; Q[1] = z / 3.5; valueQ(seed + 2026, 0);
    Q[3] = h + 0.25 * Q[2]!;
    return;
  }
  // The park: nearly flat, a gentle roll (the jump lines do the rest).
  Q[0] = x / 16; Q[1] = z / 16; valueQ(seed, 0);
  const h = 0.6 * Q[2]!;
  Q[0] = x / 6; Q[1] = z / 6; valueQ(seed + 1013, 0);
  Q[3] = h + 0.2 * Q[2]!;
}
/** The ground at (Q[4], Q[5]) into Q[6]: the dunes, the peaks and bowls, a feature's pad and its shape. */
function heightQ(seed: number, bi = 0) {
  const x = Q[4]!, z = Q[5]!;
  baseQ(seed, bi);
  let h = Q[3]!;
  // A witches'-hat peak or a bowl on the peak lattice (well inside its cell): the desert's.
  if (bi === B_DESERT) {
    const pi = Math.floor(x / PCELL), pj = Math.floor(z / PCELL), r = hashI(pi, pj, seed + 5) * HI;
    if (r < 0.62 && !(pi === 0 && pj === 0)) {
      const cx = (pi + 0.5) * PCELL + (hashI(pi, pj, seed + 6) * HI - 0.5) * 24, cz = (pj + 0.5) * PCELL + (hashI(pi, pj, seed + 7) * HI - 0.5) * 24;
      const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
      if (r < 0.42) {
        const R = 9 + hashI(pi, pj, seed + 8) * HI * 5, H = 4.5 + hashI(pi, pj, seed + 9) * HI * 3;
        if (d2 < R * R) {
          const u = 1 - Math.sqrt(d2) / R;
          h += H * u * u * (1.6 - 0.6 * u);
        }
      } else {
        const R = 9 + hashI(pi, pj, seed + 8) * HI * 4;
        if (d2 < R * R) {
          const u = 1 - d2 / (R * R);
          h -= 2.6 * u * u;
        }
      }
    }
  }
  Q[6] = h;
  // A feature: a flattened pad, then its shape.
  const kind = featureOf(seed, Math.floor(x / FCELL), Math.floor(z / FCELL), FF, bi);
  if (kind !== D_KICKER && kind !== D_WHOOPS) return;
  const dx = x - FF[1]!, dz = z - FF[2]!, d = Math.sqrt(dx * dx + dz * dz);
  if (d > 12) return;
  Q[4] = FF[1]!; Q[5] = FF[2]!;
  baseQ(seed, bi);
  Q[4] = x; Q[5] = z;
  const base = bi === B_DESERT ? Q[3]! * 0.5 + 1 : Q[3]!;
  let w = (d - 8) / 4;
  w = w <= 0 ? 1 : w >= 1 ? 0 : 1 - w * w * (3 - 2 * w);
  h += (base - h) * w;
  // Local axes: u along the heading, v across.
  const k = FF[3]! * 2, fx = HD[k]!, fz = HD[k + 1]!, u = dx * fx + dz * fz, v = -dx * fz + dz * fx, av = v < 0 ? -v : v;
  let across = (av - 2.2) / 0.8;
  across = across <= 0 ? 1 : across >= 1 ? 0 : 1 - across * across * (3 - 2 * across);
  if (across <= 0) return void (Q[6] = h);
  if (kind === D_WHOOPS) {
    if (u > -7.6 && u < 7.6) {
      // 0.25 × (½ − ½ cos): a whoop every 1.9 units, as (1 − c²)-free smooth bumps: sin² by a parabola per hump.
      const ph = ((u + 7.6) / 1.9) % 1, bump = 4 * ph * (1 - ph);
      h += WH[bi]! * bump * bump * (3 - 2 * bump) * across;
    }
    return void (Q[6] = h);
  }
  // The kicker (the open maps' natural kicker): up a face, a saddle, the landing, down its back.
  const e = u + 6.3;
  let y = 0;
  if (e >= 0 && e <= 12.6) {
    if (e < 3.2) y = 1.45 * (e / 3.2) * Math.sqrt(e / 3.2);
    else if (e < 3.8) { const q = (e - 3.2) / 0.6; y = 1.45 + (0.4 - 1.45) * q * q * (3 - 2 * q); }
    else if (e < 6.4) y = 0.4;
    else if (e < 7.2) { const q = (e - 6.4) / 0.8; y = 0.4 + q * q * (3 - 2 * q); }
    else { const q = (e - 7.2) / 5.4; y = 1.4 * (1 - q * q * (3 - 2 * q)); }
  }
  Q[6] = h + y * across;
}
/** The ground at (x, z). Pure: the same seed and place, the same height, on every engine. */
export function heightAt(seed: number, x: number, z: number, bi = 0) {
  Q[4] = x; Q[5] = z;
  heightQ(seed, bi);
  return Q[6]!;
}

/** The posts near (x, z) a rider can hit (cactus, rocks, the beacon): [x, z, r] into P; returns the count. */
export function postsNear(seed: number, x: number, z: number, P: Float64Array, bi = 0) {
  let n = 0;
  const ci = Math.floor(x / FCELL), cj = Math.floor(z / FCELL);
  for (let j = cj - 1; j <= cj + 1; j++)
    for (let i = ci - 1; i <= ci + 1; i++) {
      const k = featureOf(seed, i, j, FF, bi);
      if (k === D_CACTUS || k === D_ROCKS) {
        for (let q = 0; q < 4 && n * 3 < P.length; q++) {
          const a = ((hashI(i * 7 + q, j, seed + 90) & 7) + q * 2) & 7, rr = 1.2 + hashI(i, j * 7 + q, seed + 91) * HI * 3.2;
          P[n * 3] = FF[1]! + HD[a * 2]! * rr;
          P[n * 3 + 1] = FF[2]! + HD[a * 2 + 1]! * rr;
          P[n * 3 + 2] = k === D_CACTUS ? POST_R[bi]! : 0.32 + hashI(i + q, j + q, seed + 92) * HI * 0.3;
          n++;
        }
      } else if (k === D_CAMP && n * 3 < P.length) {
        P[n * 3] = FF[1]!; P[n * 3 + 1] = FF[2]!; P[n * 3 + 2] = 0.35;
        n++;
      }
    }
  return n;
}

/** The window: a heightfield of WIN × WIN cells that follows the rider (the Terrain shape terrainView
 *  and the bike read: cols, rows, cell, x0, z0, h, kind, version, height, normal, sample, kindAt, at).
 *  With other sizes it is the view's far ring (./look.ts): the same ground, coarser. */
export function world(seed: number, WIN = WIN0, CELL = CELL0, STEP = STEP0, biome = 0) {
  const W1 = WIN + 1, h = new Float64Array(W1 * W1), kind = new Uint8Array(WIN * WIN * 2), F = new Float64Array(3);
  // OX, OZ: the window's first vertex, in cells (integers); stats: slides, vertices computed.
  const O = new Int32Array(2), N = new Float64Array(2);
  const t = {
    cols: WIN, rows: WIN, cell: CELL, x0: 0, z0: 0, h, kind, version: 0, split: "adaptive" as const,
    height: (x: number, z: number) => (face(x, z), F[0]!),
    normal<O extends { [i: number]: number }>(x: number, z: number, out: O) {
      face(x, z);
      const sx = F[1]!, sz = F[2]!, l = Math.sqrt(sx * sx + sz * sz + 1);
      out[0] = -sx / l; out[1] = 1 / l; out[2] = -sz / l;
      return out;
    },
    sample(x: number, z: number, out: { [i: number]: number }) {
      const k = face(x, z), sx = F[1]!, sz = F[2]!, l = Math.sqrt(sx * sx + sz * sz + 1);
      out[0] = F[0]!; out[1] = -sx / l; out[2] = 1 / l; out[3] = -sz / l;
      return kind[k]!;
    },
    kindAt: (x: number, z: number) => kind[face(x, z)]!,
    at: (i: number, j: number) => h[j * W1 + i]!,
  };
  function face(x: number, z: number) {
    const x0 = t.x0, z0 = t.z0, c = CELL;
    const u = Math.min(WIN, Math.max(0, (x - x0) / c)), v = Math.min(WIN, Math.max(0, (z - z0) / c));
    const i = Math.min(WIN - 1, Math.floor(u)), j = Math.min(WIN - 1, Math.floor(v)), fu = u - i, fv = v - j, k = j * W1 + i;
    const a = h[k]!, b = h[k + 1]!, cc = h[k + W1 + 1]!, d = h[k + W1]!;
    // The adaptive split (@fzlt/core/terrain's split: "adaptive", the rule the view draws): each cell
    // along the diagonal whose two ends are closer in height (b–d when |b − d| < |cc − a|; a tie keeps
    // the fixed a–cc), so a crest is one straight fold and the bike rides exactly the drawn face.
    const fl = Math.abs(b - d) < Math.abs(cc - a), up = fl ? fu + fv > 1 : fu >= fv;
    const sx = up !== fl ? b - a : cc - d, sz = up ? cc - b : d - a;
    F[0] = a + sx * fu + sz * fv + (fl && up ? b - a - sx : 0);
    F[1] = sx / c;
    F[2] = sz / c;
    return (j * WIN + i) * 2 + (up ? 0 : 1);
  }
  /** Fill rows j0..j1 and columns i0..i1 (vertex indices) from the pure ground. */
  function fill(i0: number, i1: number, j0: number, j1: number) {
    for (let j = j0; j <= j1; j++) {
      const z = (O[1]! + j) * CELL;
      for (let i = i0; i <= i1; i++) (Q[4] = (O[0]! + i) * CELL), (Q[5] = z), heightQ(seed, biome), (h[j * W1 + i] = Q[6]!);
    }
    N[1] = N[1]! + (i1 - i0 + 1) * (j1 - j0 + 1);
  }
  /** Put the window's middle at cell (cx, cz) (a multiple of STEP): copy what it keeps, fill the rest. */
  function moveTo(ox: number, oz: number) {
    const dx = ox - O[0]!, dz = oz - O[1]!;
    if (!dx && !dz && t.version) return false;
    const keep = t.version > 0 && Math.abs(dx) < WIN && Math.abs(dz) < WIN;
    O[0] = ox; O[1] = oz;
    t.x0 = ox * CELL; t.z0 = oz * CELL;
    if (!keep) fill(0, WIN, 0, WIN);
    else {
      // Shift rows (z) then columns (x) in place, in the order that never reads a moved value.
      if (dz > 0) h.copyWithin(0, dz * W1);
      else if (dz < 0) h.copyWithin(-dz * W1, 0, (W1 + dz) * W1);
      if (dx) for (let j = 0; j < W1; j++) {
        const r = j * W1;
        if (dx > 0) h.copyWithin(r, r + dx, r + W1);
        else h.copyWithin(r - dx, r, r + W1 + dx);
      }
      if (dz > 0) fill(0, WIN, W1 - dz, WIN);
      else if (dz < 0) fill(0, WIN, 0, -dz - 1);
      const j0 = dz > 0 ? 0 : -dz, j1 = dz > 0 ? WIN - dz : WIN;
      if (dx > 0) fill(W1 - dx, WIN, j0, j1);
      else if (dx < 0) fill(0, -dx - 1, j0, j1);
    }
    N[0] = N[0]! + 1;
    t.version++;
    return true;
  }
  /** Keep (x, z) near the window's middle: slide when it is STEP cells off. True if it slid. */
  function follow(x: number, z: number) {
    const cx = Math.floor(x / CELL / STEP) * STEP, cz = Math.floor(z / CELL / STEP) * STEP;
    const ox = cx - WIN / 2 + STEP / 2, oz = cz - WIN / 2 + STEP / 2;
    if (t.version && ox === O[0] && oz === O[1]) return false;
    return moveTo(ox, oz);
  }
  return {
    seed, biome, t: t as unknown as Terrain & { x0: number; z0: number }, O,
    /** Slides so far, vertices computed so far (the test's and the perf note's numbers). */
    stats: N,
    follow, moveTo,
    height: (x: number, z: number) => heightAt(seed, x, z, biome),
  };
}
export type World = ReturnType<typeof world>;

/** One chunk of the ground, as bytes: (CH + 1)² heights at the chunk's vertices (the determinism test:
 *  same seed and chunk, same bytes). */
export function chunkBytes(seed: number, ci: number, cj: number, CH = 8, bi = 0) {
  const out = new Float64Array((CH + 1) * (CH + 1));
  for (let j = 0; j <= CH; j++) for (let i = 0; i <= CH; i++) out[j * (CH + 1) + i] = heightAt(seed, (ci * CH + i) * CELL, (cj * CH + j) * CELL, bi);
  return new Uint8Array(out.buffer);
}
