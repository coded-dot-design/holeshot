// Endless Wheelie City's open world, headless: roads, towns and fields that never end, in every
// direction. Everything is a pure function of the seed and the world position (only + − × ÷, floors
// and square roots: ../../math.ts rules), so the same place is the same world on every screen and
// every engine:
// - The road network: one junction per lattice cell (RC units a side), jittered, so nothing lines up
//   in squares. Every junction joins the next one east and west (the long east–west roads: every
//   third row a highway), and the one north or south on most columns (always on every fourth), each
//   join a smooth curve (a cubic through the junctions, its tangent the line through the junctions
//   either side: the road sweeps on through a junction instead of turning a corner). So every
//   junction has at least two roads: no dead ends. Some junctions are roundabouts.
// - The ground: gentle rolling fields (soft hills, mostly flat enough to wheelie), flattened round
//   every junction and over every town; the roads lie on it, level across and smoothed along their
//   length, blended into the fields over a shoulder; now and then a kicker on the crown of a road.
// - Towns: about two junctions in five (and always the start) are a town: lots along every road
//   out of it (shops, a diner, a gas station, flats and a tower near the middle, houses, a warehouse
//   on the edge), each set back from its road and facing it, with lamps, benches, mailboxes, parked
//   cars, crosswalks, sprinklers and a dog. A town's limits (TOWN_R from its junction) bound its patrol.
// - Fields between them: grass, ploughed dirt and crops in skewed plots, trees, rocks, hay bales,
//   the odd farmstead, fences and tree rows along the roads.
// What the bike rides is a window of that ground round the rider (`openWindow`, the shape
// @fzlt/core/terrain's view and the bike read, sliding in whole steps like the desert's); what it can
// hit is `gather`ed round it into fixed typed arrays. Caches (edges, towns) are fixed tables whose
// contents are pure, so they are never state. Zero allocation per step.
import type { Terrain } from "@fzlt/core/terrain";

/** The road lattice (world units a cell) and how far a junction strays from its cell's middle (of RC). */
export const RC = 120, JIT = 0.3;
/** The world's seed (the same world on every screen). */
export const CITY_SEED = 2611;
/** The window (cells a side, the cell, the slide step in cells) and the far ring's. */
export const WIN = 176, CELL = 0.5, STEP = 16, FAR_WIN = 136, FAR_CELL = 4, FAR_STEP = 4;
/** A town's limits (units from its junction). */
export const TOWN_R = 46;
/** Half-widths: a highway, a road, a lane; the shoulder the road blends into the fields over. */
export const HW_HI = 4.2, HW_RD = 3.1, HW_LN = 2.7, SHOULDER = 6;
/** The painted strips past a road's edge: the gravel shoulder out of town, the sidewalk in town. */
export const GRAVEL_W = 1.1, WALK_W = 1.6;
/** A roundabout: the ring's middle radius and half-width (the island inside it). */
export const RB_R = 9, RB_HW = 3, RB_ISLE = RB_R - RB_HW;
/** Samples along an edge (segments). */
export const NS = 20;
/** Face kinds (0 the meadow): asphalt, the town's sidewalk, a lawn, the gravel shoulder, ploughed dirt, crops, a roundabout's island. */
export const F_GRASS = 0, F_ROAD = 1, F_WALK = 2, F_LAWN = 3, F_GRAVEL = 4, F_DIRT = 5, F_CROP = 6, F_ISLE = 7;
/** Items (`gather`): buildings first (< I_PROP), then props. */
export const I_HOUSE = 0, I_HOUSE2 = 1, I_SHOP = 2, I_DINER = 3, I_STORE = 4, I_GAS = 5, I_FLATS = 6, I_TOWER = 7, I_WARE = 8, I_BARN = 9, I_SILO = 10, I_PROP = 11;
export const I_TREE = 11, I_PINE = 12, I_ROCK = 13, I_HAY = 14, I_LAMP = 15, I_SIGN = 16, I_MAIL = 17, I_BENCH = 18, I_CAR = 19, I_FENCE = 20, I_CONE = 21, I_ISLE = 22, I_SPRINK = 23, I_DOG = 24, I_CROSS = 25, I_KICK = 26;
export const NITEM = 27;
/** Building sizes by item: width (along the road), depth, height. */
export const BW = [3.4, 4.2, 5, 6.4, 6, 4.4, 5.2, 4.4, 8.5, 5.6, 2.2], BD = [3, 3.4, 3.6, 4.2, 4.4, 3.4, 3.8, 4.4, 6.5, 4.4, 2.2], BH = [1.9, 2.3, 2.2, 2.1, 2.5, 2.4, 3.9, 8.5, 3.4, 3, 5.2];
/** An item record in `gather`'s output: kind, x, z, ux, uz (its local x axis: along the road), w, d, h, look, key, y. */
export const IS = 11;
/** The kicker: its ramp length, height, half-width. */
export const KICK_L = 3.2, KICK_H = 0.8, KICK_W = 1.1;
/** Town names (fictional, from bike parts and riding words). */
const PRE = ["SPROCKET", "THROTTLE", "REDLINE", "PISTON", "KICKSTAND", "CLUTCH", "TORQUE", "GASKET", "SPOKE", "HOLESHOT", "BERM", "WHOOP", "MANUAL", "STOPPIE", "CHAIN", "PEGS"];
const SUF = [" JUNCTION", " FLATS", " CORNERS", " HOLLOW", " CROSSING", " RIDGE", " SPRINGS", " BEND"];

// Nothing here passes or returns a double through a call that might not be inlined (V8 boxes it):
// results go into scratch arrays.
const HI = 1 / 1073741824;
function hashI(i: number, j: number, s: number) {
  let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(s, 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 15), 0x297a2d39);
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b);
  return (h ^ (h >>> 16)) >>> 2;
}
const mod = (a: number, m: number) => ((a % m) + m) % m;
/** The kind two or three of a triangle's corners share (else the first's). */
const maj = (a: number, b: number, c: number) => (b === c ? b : a);

/** One open world for a seed: its pure ground and the caches that speed it up. */
export function openWorld(seed: number) {
  // Scratch: noise (Q), a node (NQ), the road query (RQ), the town query (TQ), a point on an edge (PQ).
  const X_baseQ = new Float64Array(2), X_groundQ = new Float64Array(2), X_roadQ = new Float64Array(2), X_townQ = new Float64Array(2), X_heightQ = new Float64Array(2), X_kindQ = new Float64Array(2);
  const LB = new Float64Array(3), Q = new Float64Array(4), NQ = new Float64Array(2), RQ = new Float64Array(10), TQ = new Float64Array(6), PQ = new Float64Array(4), GQ = new Float64Array(2);
  function valueQ(s: number) {
    const a = Q[0]!, b = Q[1]!, i = (Math.floor(a) | 0), j = (Math.floor(b) | 0);
    let fa = a - i, fb = b - j;
    fa = fa * fa * (3 - 2 * fa);
    fb = fb * fb * (3 - 2 * fb);
    const v00 = hashI(i, j, s) * HI, v10 = hashI(i + 1, j, s) * HI, v01 = hashI(i, j + 1, s) * HI, v11 = hashI(i + 1, j + 1, s) * HI;
    Q[2] = v00 + (v10 - v00) * fa + (v01 - v00) * fb + (v00 - v10 - v01 + v11) * fa * fb;
  }
  /** The rolling fields' smooth ground at (x, z) into Q[3]. */
  function baseQI() {
    const x = X_baseQ[0]!, z = X_baseQ[1]!;
    Q[0] = x / 150; Q[1] = z / 150; valueQ(seed + 1);
    let h = 4.2 * Q[2]!;
    Q[0] = x / 55; Q[1] = z / 55; valueQ(seed + 2);
    h += 1.5 * Q[2]!;
    Q[0] = x / 21; Q[1] = z / 21; valueQ(seed + 3);
    Q[3] = h + 0.45 * Q[2]!;
  }
  // ---- the lattice ----
  /** Junction (i, j)'s place into NQ. */
  function nodeQ(i: number, j: number) {
    NQ[0] = (i + 0.5 + (hashI(i, j, seed + 7) * HI - 0.5) * 2 * JIT) * RC;
    NQ[1] = (j + 0.5 + (hashI(i, j, seed + 8) * HI - 0.5) * 2 * JIT) * RC;
  }
  const isTown = (i: number, j: number) => (i === 0 && j === 0) || hashI(i, j, seed + 11) * HI < 0.4;
  /** The road north from junction (i, j) to (i, j + 1): always on every fourth column, mostly from a town, else one in two. */
  const vOn = (i: number, j: number) => mod(i, 4) === 0 || hashI(i, j, seed + 13) * HI < ((isTown(i, j) || isTown(i, j + 1)) ? 0.85 : 0.5);
  /** A roundabout at junction (i, j): only where three or more roads meet. */
  const isRound = (i: number, j: number) => (vOn(i, j) || vOn(i, j - 1)) && !(i === 0 && j === 0) && hashI(i, j, seed + 12) * HI < (isTown(i, j) ? 0.3 : 0.45);
  const highway = (j: number) => mod(j, 3) === 0;

  // ---- the edges: a fixed table of sampled curves (pure contents: never state) ----
  const ECAP = 512, EP = (NS + 1) * 4;
  /** Per slot: i, j, dir (0 east, 1 north; −1 empty), half-width, length, bbox x0 z0 x1 z1, kicker s (−1 none). */
  const EK = new Int32Array(ECAP * 3), EF = new Float64Array(ECAP * 8), PT = new Float64Array(ECAP * EP), EU = new Float64Array(ECAP + 1);
  for (let e = 0; e < ECAP; e++) EK[e * 3 + 2] = -1;
  const TX = new Float64Array(4);
  /** Edge (i, j, dir)'s slot, built on first use (−1: no such road). */
  function edge(i: number, j: number, dir: number) {
    if (dir === 1 && !vOn(i, j)) return -1;
    // (Full: the least recently used of the eight probed slots goes; what is in use now never does.)
    const e0 = hashI(i, j, dir + 31) & (ECAP - 1);
    let e = e0;
    EU[ECAP] = EU[ECAP]! + 1;
    for (let p = 0; p < 8; p++) {
      const s = (e0 + p) & (ECAP - 1);
      if (EK[s * 3] === i && EK[s * 3 + 1] === j && EK[s * 3 + 2] === dir) return (EU[s] = EU[ECAP]!), s;
      if (EK[s * 3 + 2] === -1) { e = s; break; }
      if (EU[s]! < EU[e]!) e = s;
    }
    build(e, i, j, dir);
    EU[e] = EU[ECAP]!;
    return e;
  }
  function build(e: number, i: number, j: number, dir: number) {
    EK[e * 3] = i; EK[e * 3 + 1] = j; EK[e * 3 + 2] = dir;
    const di = dir ? 0 : 1, dj = dir ? 1 : 0;
    nodeQ(i, j); const ax = NQ[0]!, az = NQ[1]!;
    nodeQ(i + di, j + dj); const bx = NQ[0]!, bz = NQ[1]!;
    // Tangents: the line through the junctions either side (the road sweeps on through a junction).
    nodeQ(i - di, j - dj); TX[0] = bx - NQ[0]!; TX[1] = bz - NQ[1]!;
    nodeQ(i + 2 * di, j + 2 * dj); TX[2] = NQ[0]! - ax; TX[3] = NQ[1]! - az;
    const L = Math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az)), la = Math.sqrt(TX[0]! * TX[0]! + TX[1]! * TX[1]!), lb = Math.sqrt(TX[2]! * TX[2]! + TX[3]! * TX[3]!);
    const c1x = ax + (TX[0]! / la) * L * 0.36, c1z = az + (TX[1]! / la) * L * 0.36, c2x = bx - (TX[2]! / lb) * L * 0.36, c2z = bz - (TX[3]! / lb) * L * 0.36;
    const o = e * EP, hw = dir ? HW_LN : highway(j) ? HW_HI : HW_RD, m = hw + SHOULDER + 1;
    let x0 = 1e18, z0 = 1e18, x1 = -1e18, z1 = -1e18, len = 0;
    for (let k = 0; k <= NS; k++) {
      const t = k / NS, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
      const x = a * ax + b * c1x + c * c2x + d * bx, z = a * az + b * c1z + c * c2z + d * bz;
      ((X_groundQ[0] = x), (X_groundQ[1] = z), groundQI());
      PT[o + k * 4] = x; PT[o + k * 4 + 1] = z; PT[o + k * 4 + 2] = GQ[0]!;
      const lx = x - PT[o + k * 4 - 4]!, lz = z - PT[o + k * 4 - 3]!;
      if (k) len += Math.sqrt(lx * lx + lz * lz);
      PT[o + k * 4 + 3] = len;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    // Smooth the road's heights along it (twice; the ends stay at their junctions' heights).
    for (let p = 0; p < 2; p++) {
      let prev = PT[o + 2]!;
      for (let k = 1; k < NS; k++) {
        const cur = PT[o + k * 4 + 2]!;
        PT[o + k * 4 + 2] = (prev + 2 * cur + PT[o + k * 4 + 6]!) / 4;
        prev = cur;
      }
    }
    const f = e * 8;
    EF[f] = hw; EF[f + 1] = len; EF[f + 2] = x0 - m; EF[f + 3] = z0 - m; EF[f + 4] = x1 + m; EF[f + 5] = z1 + m;
    // A kicker on the crown of an open road between two junctions that are not towns, now and then.
    EF[f + 6] = !isTown(i, j) && !isTown(i + di, j + dj) && hashI(i, j, seed + 41 + dir) * HI < 0.55 ? len * (0.35 + hashI(i, j, seed + 42 + dir) * HI * 0.3) : -1;
  }
  /** The point s along edge e (from its start) into PQ: x, z, tangent x, z. */
  function at(e: number, s: number) {
    const o = e * EP;
    let k = 0;
    while (k < NS - 1 && PT[o + (k + 1) * 4 + 3]! < s) k++;
    const s0 = PT[o + k * 4 + 3]!, s1 = PT[o + (k + 1) * 4 + 3]!, t = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
    const x0 = PT[o + k * 4]!, z0 = PT[o + k * 4 + 1]!, dx = PT[o + k * 4 + 4]! - x0, dz = PT[o + k * 4 + 5]! - z0, l = Math.sqrt(dx * dx + dz * dz) || 1;
    PQ[0] = x0 + dx * t; PQ[1] = z0 + dz * t; PQ[2] = dx / l; PQ[3] = dz / l;
  }

  // ---- the ground ----
  /** The fields' ground under the roads at (x, z) into GQ[0]: the rolling base, flattened round every
   *  junction (and over every town, out past its limits). */
  function groundQI() {
    const x = X_groundQ[0]!, z = X_groundQ[1]!;
    ((X_baseQ[0] = x), (X_baseQ[1] = z), baseQI());
    let h = Q[3]!;
    const ci = (Math.floor(x / RC) | 0), cj = (Math.floor(z / RC) | 0);
    // Towns first, then every junction (so a junction is always level with the roads round it).
    GQ[0] = h;
    for (let pass = 0; pass < 2; pass++)
      for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
        const tw = isTown(i, j);
        if (pass === 0 && !tw) continue;
        nodeQ(i, j);
        const dx = x - NQ[0]!, dz = z - NQ[1]!, d = Math.sqrt(dx * dx + dz * dz), R = pass === 0 ? TOWN_R + 6 : 16, F = pass === 0 ? 26 : 14;
        if (d >= R + F) continue;
        const nx = NQ[0]!, nz = NQ[1]!;
        ((X_baseQ[0] = nx), (X_baseQ[1] = nz), baseQI());
        let w = (R + F - d) / F;
        w = w >= 1 ? 1 : w * w * (3 - 2 * w);
        GQ[0] = GQ[0]! + (Q[3]! - GQ[0]!) * w;
      }
  }
  /** The nearest road to (x, z) into RQ: [0] how far past its edge (≤ 0 on it), [1] its height there,
   *  [2] its half-width, [3] 1 on a roundabout's island, [4] the edge (−1: a ring), [5] s along it,
   *  [6] across it (signed), [7], [8] its direction, [9] the kicker's height there. */
  function roadQI() {
    const x = X_roadQ[0]!, z = X_roadQ[1]!;
    RQ[0] = 1e9; RQ[3] = 0; RQ[4] = -1; RQ[9] = 0;
    const ci = (Math.floor(x / RC) | 0), cj = (Math.floor(z / RC) | 0);
    for (let dir = 0; dir < 2; dir++)
      for (let j = cj - 1 - (dir ? 0 : 0); j <= cj + 1; j++)
        for (let i = ci - 1; i <= ci + 1; i++) {
          if (dir === 0 && i === ci + 1) continue;
          if (dir === 1 && j === cj + 1) continue;
          const e = edge(i, j, dir);
          if (e < 0) continue;
          const f = e * 8;
          if (x < EF[f + 2]! || x > EF[f + 4]! || z < EF[f + 3]! || z > EF[f + 5]!) continue;
          const o = e * EP, hw = EF[f]!;
          // (The loop's best in a scratch array: a double carried round a loop can be boxed before it is optimised.)
          LB[0] = 1e18; LB[1] = 0; LB[2] = 0;
          for (let k = 0; k < NS; k++) {
            const px = PT[o + k * 4]!, pz = PT[o + k * 4 + 1]!, ex = PT[o + k * 4 + 4]! - px, ez = PT[o + k * 4 + 5]! - pz, L = ex * ex + ez * ez;
            let t = L > 0 ? ((x - px) * ex + (z - pz) * ez) / L : 0;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const qx = px + ex * t - x, qz = pz + ez * t - z, d2 = qx * qx + qz * qz;
            if (d2 < LB[0]!) (LB[0] = d2), (LB[1] = k), (LB[2] = t);
          }
          const d = Math.sqrt(LB[0]!), ex2 = d - hw, bk = LB[1]!, bt = LB[2]!;
          if (ex2 >= RQ[0]!) continue;
          const k4 = o + bk * 4, ex = PT[k4 + 4]! - PT[k4]!, ez = PT[k4 + 5]! - PT[k4 + 1]!, l = Math.sqrt(ex * ex + ez * ez) || 1;
          RQ[0] = ex2; RQ[1] = PT[k4 + 2]! + (PT[k4 + 6]! - PT[k4 + 2]!) * bt; RQ[2] = hw; RQ[4] = e;
          RQ[5] = PT[k4 + 3]! + (PT[k4 + 7]! - PT[k4 + 3]!) * bt;
          RQ[7] = ex / l; RQ[8] = ez / l;
          RQ[6] = (x - PT[k4]!) * -RQ[8]! + (z - PT[k4 + 1]!) * RQ[7]!;
        }
    // Roundabouts: the ring is road, the island inside it is not.
    for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
      if (!isRound(i, j)) continue;
      nodeQ(i, j);
      const dx = x - NQ[0]!, dz = z - NQ[1]!, r = Math.sqrt(dx * dx + dz * dz);
      if (r > RB_R + RB_HW + SHOULDER + 1) continue;
      if (r < RB_ISLE) {
        RQ[3] = 1; RQ[0] = RB_ISLE - r; RQ[4] = -1;
        ((X_groundQ[0] = NQ[0]!), (X_groundQ[1] = NQ[1]!), groundQI()); RQ[1] = GQ[0]!;
        return;
      }
      const ex2 = (r - RB_R < 0 ? RB_R - r : r - RB_R) - RB_HW;
      if (ex2 < RQ[0]!) {
        nodeQ(i, j);
        ((X_groundQ[0] = NQ[0]!), (X_groundQ[1] = NQ[1]!), groundQI());
        RQ[0] = ex2; RQ[1] = GQ[0]!; RQ[2] = RB_HW; RQ[4] = -1; RQ[5] = 0; RQ[6] = 0; RQ[7] = -dz / (r || 1); RQ[8] = dx / (r || 1);
      }
    }
    // The kicker: on the crown of its road, up a ramp to a lip.
    const e = RQ[4]!;
    if (e >= 0 && RQ[0]! <= 0) {
      const ks = EF[e * 8 + 6]!, u = RQ[5]! - ks, v = RQ[6]! < 0 ? -RQ[6]! : RQ[6]!;
      if (ks >= 0 && u > 0 && u < KICK_L && v < KICK_W + 0.4) {
        let a = (v - KICK_W) / 0.4;
        a = a <= 0 ? 1 : a >= 1 ? 0 : 1 - a * a * (3 - 2 * a);
        const q = u / KICK_L;
        RQ[9] = KICK_H * q * Math.sqrt(q) * a;
      }
    }
  }
  /** The nearest town to (x, z) into TQ: [0] distance to its junction (1e9: none within reach), [1] i, [2] j, [3] x, [4] z. */
  function townQI() {
    const x = X_townQ[0]!, z = X_townQ[1]!;
    TQ[0] = 1e9;
    const ci = (Math.floor(x / RC) | 0), cj = (Math.floor(z / RC) | 0);
    for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
      if (!isTown(i, j)) continue;
      nodeQ(i, j);
      const dx = x - NQ[0]!, dz = z - NQ[1]!, d = Math.sqrt(dx * dx + dz * dz);
      if (d < TQ[0]!) (TQ[0] = d), (TQ[1] = i), (TQ[2] = j), (TQ[3] = NQ[0]!), (TQ[4] = NQ[1]!);
    }
  }
  /** The ground's height at (x, z) into HQ[0], its face kind into HQ[1], the kind drawn under the
   *  road ribbons into HQ[2] (asphalt, gravel and sidewalk: what lies round them; the ribbons, drawn
   *  along the road's true curve, paint the strips themselves, so their edges never follow the grid). */
  const HQ = new Float64Array(3);
  function heightQI() {
    const x = X_heightQ[0]!, z = X_heightQ[1]!;
    ((X_groundQ[0] = x), (X_groundQ[1] = z), groundQI());
    const g = GQ[0]!;
    ((X_roadQ[0] = x), (X_roadQ[1] = z), roadQI());
    const ex = RQ[0]!, yc = RQ[1]!;
    // The fields' own small roll, off the road.
    Q[0] = x / 4.5; Q[1] = z / 4.5; valueQ(seed + 4);
    const bump = 0.12 * Q[2]!;
    let h: number;
    if (RQ[3] === 1) h = yc + 0.08;
    else if (ex <= 0) h = yc + RQ[9]!;
    else if (ex < SHOULDER) {
      let w = ex / SHOULDER;
      w = w * w * (3 - 2 * w);
      h = yc + (g + bump - yc) * w;
    } else h = g + bump;
    HQ[0] = h;
  }
  /** The face kind at (x, z) into HQ[1] (heightQ's road query reused: call right after it, same point). */
  function kindQI() {
    const x = X_kindQ[0]!, z = X_kindQ[1]!;
    const ex = RQ[0]!;
    if (RQ[3] === 1) return void (HQ[1] = HQ[2] = F_ISLE);
    ((X_townQ[0] = x), (X_townQ[1] = z), townQI());
    const tw = TQ[0]! < TOWN_R;
    HQ[2] = tw ? F_LAWN : F_GRASS;
    if (ex <= 0) return void (HQ[1] = F_ROAD);
    if (tw) return void (HQ[1] = ex < WALK_W ? F_WALK : F_LAWN);
    if (ex < GRAVEL_W) return void (HQ[1] = F_GRAVEL);
    if (TQ[0]! < TOWN_R + 10 || ex < 5) return void (HQ[1] = F_GRASS);
    // Plots: a skewed lattice of fields, some ploughed, some crops.
    const a = x * 0.866 - z * 0.5, b = x * 0.5 + z * 0.866, r = hashI((Math.floor(a / 34) | 0), (Math.floor(b / 22) | 0), seed + 21) * HI;
    HQ[2] = HQ[1] = r < 0.22 ? F_DIRT : r < 0.42 ? F_CROP : F_GRASS;
  }
  const height = (x: number, z: number) => (((X_heightQ[0] = x), (X_heightQ[1] = z), heightQI()), HQ[0]!);

  // ---- towns: a fixed table of their lots (pure contents) ----
  const TCAP = 32, MAXL = 64;
  const TK = new Int32Array(TCAP * 3), TN = new Int32Array(TCAP), TL = new Float64Array(TCAP * MAXL * IS);
  for (let s = 0; s < TCAP; s++) TK[s * 3 + 2] = 0;
  /** Town (i, j)'s slot, its lots built on first use. */
  function town(i: number, j: number) {
    let e = hashI(i, j, 51) & (TCAP - 1);
    for (let p = 0; p < 4; p++) {
      const s = (e + p) & (TCAP - 1);
      if (TK[s * 3 + 2] === 1 && TK[s * 3] === i && TK[s * 3 + 1] === j) return s;
      if (TK[s * 3 + 2] === 0) { e = s; break; }
    }
    lots(e, i, j);
    return e;
  }
  /** The roads out of junction (i, j): edge slots and whether the junction is the edge's end, into IN (n into IN[8]). */
  const IN = new Int32Array(9);
  function incident(i: number, j: number) {
    let n = 0;
    let e = edge(i, j, 0); if (e >= 0) (IN[n * 2] = e), (IN[n * 2 + 1] = 0), n++;
    e = edge(i - 1, j, 0); if (e >= 0) (IN[n * 2] = e), (IN[n * 2 + 1] = 1), n++;
    e = edge(i, j, 1); if (e >= 0) (IN[n * 2] = e), (IN[n * 2 + 1] = 0), n++;
    e = edge(i, j - 1, 1); if (e >= 0) (IN[n * 2] = e), (IN[n * 2 + 1] = 1), n++;
    IN[8] = n;
  }
  /** The point s from the junction along incident road q (IN) into PQ (the tangent pointing away). */
  function out(q: number, s: number) {
    const e = IN[q * 2]!, end = IN[q * 2 + 1] === 1, L = EF[e * 8 + 1]!;
    at(e, end ? L - s : s);
    if (end) (PQ[2] = -PQ[2]!), (PQ[3] = -PQ[3]!);
  }
  const LOT = 8.5;
  function put(s0: number, k: number, x: number, z: number, ux: number, uz: number, w: number, d: number, h: number, look: number, key: number) {
    const o = (s0 * MAXL + TN[s0]!) * IS;
    if (TN[s0]! >= MAXL) return;
    TL[o] = k; TL[o + 1] = x; TL[o + 2] = z; TL[o + 3] = ux; TL[o + 4] = uz; TL[o + 5] = w; TL[o + 6] = d; TL[o + 7] = h; TL[o + 8] = look; TL[o + 9] = key;
    ((X_groundQ[0] = x), (X_groundQ[1] = z), groundQI()); TL[o + 10] = GQ[0]!;
    TN[s0] = TN[s0]! + 1;
  }
  /** Is a footprint (x, z, half extents a, b along u and across) clear of every road and of the lots so far? */
  function free(s0: number, x: number, z: number, ux: number, uz: number, a: number, b: number) {
    for (let q = 0; q < 5; q++) {
      const sa = q === 0 ? 0 : q & 1 ? 1 : -1, sb = q === 0 ? 0 : q & 2 ? 1 : -1, px = x + ux * a * sa - uz * b * sb, pz = z + uz * a * sa + ux * b * sb;
      ((X_roadQ[0] = px), (X_roadQ[1] = pz), roadQI());
      if (RQ[0]! < 0.9 || RQ[3] === 1) return false;
    }
    const r = Math.sqrt(a * a + b * b);
    for (let m = 0; m < TN[s0]!; m++) {
      const o = (s0 * MAXL + m) * IS, k = TL[o]!;
      if (k >= I_PROP && k !== I_DOG) continue;
      const dx = TL[o + 1]! - x, dz = TL[o + 2]! - z, rr = r + (k === I_DOG ? 1.6 : Math.sqrt(TL[o + 5]! * TL[o + 5]! + TL[o + 6]! * TL[o + 6]!) / 2);
      if (dx * dx + dz * dz < rr * rr * 0.8) return false;
    }
    return true;
  }
  function lots(s0: number, i: number, j: number) {
    TK[s0 * 3] = i; TK[s0 * 3 + 1] = j; TK[s0 * 3 + 2] = 1; TN[s0] = 0;
    incident(i, j);
    const n = IN[8]!, round = isRound(i, j), big = hashI(i, j, seed + 44) * HI < 0.45, S0 = round ? 16 : 11;
    let gas = hashI(i, j, seed + 45) * HI < 0.75 ? 1 : 0, diner = hashI(i, j, seed + 46) * HI < 0.7 ? 1 : 0, dog = 1, sp = 0;
    nodeQ(i, j);
    const cx = NQ[0]!, cz = NQ[1]!;
    for (let q = 0; q < n; q++) {
      const hw = EF[IN[q * 2]! * 8]!;
      // Crosswalks across the road just out of the junction.
      out(q, S0 - 3);
      put(s0, I_CROSS, PQ[0]!, PQ[1]!, PQ[2]!, PQ[3]!, 2.2, hw * 2, 0, 0, q);
      for (let k = 0, s = S0 + 2; s < TOWN_R - 3; k++, s += LOT) {
        out(q, s);
        const px = PQ[0]!, pz = PQ[1]!, tx = PQ[2]!, tz = PQ[3]!;
        for (let side = -1; side <= 1; side += 2) {
          const r = hashI(i * 37 + q * 5 + side, j * 41 + k, seed + 47) * HI, key = (q * 32 + k) * 2 + (side > 0 ? 1 : 0);
          // The street furniture: a lamp every lot on one side, benches and mailboxes, a parked car.
          const nx = -tz * side, nz = tx * side;
          if (side > 0 || k & 1) put(s0, I_LAMP, px + nx * (hw + 0.7), pz + nz * (hw + 0.7), tx, tz, 0, 0, 0, 0, key);
          if (r > 0.88) continue;
          let kind: number;
          if (s < 26) kind = gas ? I_GAS : diner ? I_DINER : big && r < 0.2 ? I_TOWER : r < 0.38 ? I_FLATS : r < 0.62 ? I_SHOP : r < 0.75 ? I_STORE : I_HOUSE2;
          else kind = s > 34 && r < 0.16 ? I_WARE : r < 0.55 ? I_HOUSE : I_HOUSE2;
          const w = BW[kind]!, d = BD[kind]!, set = kind === I_GAS ? 4.2 : kind < I_SHOP ? 3.2 : 1.9, off = hw + set + d / 2;
          // Facing the road: its local z towards the road (−n), its local x (z's (z, −x)) along it.
          const bx = px + nx * off, bz = pz + nz * off, fx = -nx, fz = -nz, ux = fz, uz = -fx;
          if (!free(s0, bx, bz, ux, uz, w / 2 + 0.3, d / 2 + 0.3)) continue;
          if (kind === I_GAS) gas = 0;
          if (kind === I_DINER) diner = 0;
          put(s0, kind, bx, bz, ux, uz, w, d, BH[kind]!, hashI(i + k, j + q, seed + 48 + side) & 7, key);
          if (kind < I_SHOP) {
            // A house: a mailbox at the curb; now and then a sprinkler on the lawn, a parked car; one dog a town.
            put(s0, I_MAIL, px + nx * (hw + 1.1) + tx * 1.4, pz + nz * (hw + 1.1) + tz * 1.4, tx, tz, 0, 0, 0, 0, key);
            if (sp < 3 && r < 0.3) put(s0, I_SPRINK, px + nx * (hw + 2.2) - tx * 1.2, pz + nz * (hw + 2.2) - tz * 1.2, tx, tz, 0, 0, 0, hashI(k, q, seed + 49) & 7, key), sp++;
            if (dog && s > 24) {
              const yx = bx + ux * (w / 2 + 1.8), yz = bz + uz * (w / 2 + 1.8);
              if (free(s0, yx, yz, ux, uz, 1.6, 1.2)) put(s0, I_DOG, yx, yz, ux, uz, 2.8, 2.2, 0.5, 0, key), (dog = 0);
            }
          } else if (r < 0.45 && kind !== I_GAS) put(s0, I_BENCH, px + nx * (hw + 1.0) + tx * 2.2, pz + nz * (hw + 1.0) + tz * 2.2, tx, tz, 1.2, 0.45, 0.5, 0, key);
          if (r > 0.7 && kind !== I_GAS) put(s0, I_CAR, px + nx * (hw + 0.9) - tx * 2.4, pz + nz * (hw + 0.9) - tz * 2.4, tx, tz, 2.3, 1.1, 1, hashI(k, j + q, seed + 50) & 3, key);
        }
      }
      // The town's sign on the way in.
      out(q, TOWN_R - 1);
      put(s0, I_SIGN, PQ[0]! - PQ[3]! * (hw + 1.2), PQ[1]! + PQ[2]! * (hw + 1.2), PQ[2]!, PQ[3]!, 0, 0, 1, 0, q);
    }
    if (round) put(s0, I_ISLE, cx, cz, 1, 0, RB_ISLE, RB_ISLE, 0.4, 0, 0);
  }
  /** Town (i, j)'s name (a toast; not state). */
  const townName = (i: number, j: number) => PRE[hashI(i, j, seed + 61) & 15]! + SUF[hashI(i, j, seed + 62) & 7]!;

  // ---- the gather: everything a rider can see or hit within R of (x, z), into a fixed array ----
  let G: Float64Array = new Float64Array(IS), n = 0, cap = 0;
  /** Push the item in PU (its IS numbers) onto the gather's output. */
  const PU = new Float64Array(IS);
  function push() {
    if (n >= cap) return;
    G.set(PU, n * IS);
    n++;
  }
  /** Into out (IS numbers an item), at most cap items, in a fixed order; returns the count. */
  function gather(x: number, z: number, R: number, outA: Float64Array, capN: number) {
    G = outA; n = 0; cap = capN;
    // The lattice cells whose junctions, roads or towns can reach within R.
    const i0 = (Math.floor((x - R - TOWN_R) / RC) | 0) - 1, i1 = (Math.floor((x + R + TOWN_R) / RC) | 0) + 1, j0 = (Math.floor((z - R - TOWN_R) / RC) | 0) - 1, j1 = (Math.floor((z + R + TOWN_R) / RC) | 0) + 1;
    // Towns (their lots).
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (!isTown(i, j)) continue;
      nodeQ(i, j);
      const dx = NQ[0]! - x, dz = NQ[1]! - z;
      if (dx * dx + dz * dz > (R + TOWN_R) * (R + TOWN_R)) continue;
      const s0 = town(i, j);
      for (let m = 0; m < TN[s0]!; m++) {
        const o = (s0 * MAXL + m) * IS, ex = TL[o + 1]! - x, ez = TL[o + 2]! - z;
        if (ex * ex + ez * ez > R * R) continue;
        ((PU[0] = TL[o]!), (PU[1] = TL[o + 1]!), (PU[2] = TL[o + 2]!), (PU[3] = TL[o + 3]!), (PU[4] = TL[o + 4]!), (PU[5] = TL[o + 5]!), (PU[6] = TL[o + 6]!), (PU[7] = TL[o + 7]!), (PU[8] = TL[o + 8]!), (PU[9] = TL[o + 9]! + ((i * 977 + j * 131) % 100000) * 4096), (PU[10] = TL[o + 10]!), push());
      }
    }
    // The open road: tree rows, fences, a sign, the kicker's cones; out of town.
    for (let dir = 0; dir < 2; dir++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const e = edge(i, j, dir);
      if (e < 0) continue;
      const f = e * 8;
      if (x + R < EF[f + 2]! || x - R > EF[f + 4]! || z + R < EF[f + 3]! || z - R > EF[f + 5]!) continue;
      const L = EF[f + 1]!, hw = EF[f]!, ks = EF[f + 6]!;
      for (let k = 0, s = 18; s < L - 18; k++, s += 9) {
        at(e, s);
        const px = PQ[0]!, pz = PQ[1]!, tx = PQ[2]!, tz = PQ[3]!, ex = px - x, ez = pz - z;
        if (ex * ex + ez * ez > (R + 14) * (R + 14)) continue;
        ((X_townQ[0] = px), (X_townQ[1] = pz), townQI());
        if (TQ[0]! < TOWN_R + 2) continue;
        const r = hashI(i * 13 + k, j * 7 + dir, seed + 71) * HI, side = r < 0.5 ? 1 : -1, nx = -tz * side, nz = tx * side, key = 1e9 + ((e * 4096 + k) % 1e8);
        const rowR = hashI(i, j, seed + 72 + dir) * HI;
        if (rowR < 0.4) {
          // A row of trees along both sides of this road.
          for (let sd = -1; sd <= 1; sd += 2) {
            const qx = px - tz * sd * (hw + 5.5), qz = pz + tx * sd * (hw + 5.5), qx2 = qx - x, qz2 = qz - z;
            if (qx2 * qx2 + qz2 * qz2 < R * R) ((X_groundQ[0] = qx), (X_groundQ[1] = qz), groundQI()), ((PU[0] = I_TREE), (PU[1] = qx), (PU[2] = qz), (PU[3] = tx), (PU[4] = tz), (PU[5] = 0), (PU[6] = 0), (PU[7] = 0), (PU[8] = k & 3), (PU[9] = key + sd), (PU[10] = GQ[0]!), push());
          }
        } else if (rowR < 0.7 && (k & 3) !== 3) {
          const qx = px + nx * (hw + 3.2), qz = pz + nz * (hw + 3.2);
          ((X_groundQ[0] = qx), (X_groundQ[1] = qz), groundQI());
          ((PU[0] = I_FENCE), (PU[1] = qx), (PU[2] = qz), (PU[3] = tx), (PU[4] = tz), (PU[5] = 8.6), (PU[6] = 0.12), (PU[7] = 0.6), (PU[8] = 0), (PU[9] = key), (PU[10] = GQ[0]!), push());
        }
        if (r > 0.94) {
          const qx = px + nx * (hw + 1.4), qz = pz + nz * (hw + 1.4);
          ((X_groundQ[0] = qx), (X_groundQ[1] = qz), groundQI());
          ((PU[0] = r > 0.97 ? I_CAR : I_SIGN), (PU[1] = qx), (PU[2] = qz), (PU[3] = tx), (PU[4] = tz), (PU[5] = 2.3), (PU[6] = 1.1), (PU[7] = 1), (PU[8] = k & 3), (PU[9] = key + 7), (PU[10] = GQ[0]!), push());
        }
      }
      if (ks >= 0) {
        at(e, ks);
        const px = PQ[0]!, pz = PQ[1]!, tx = PQ[2]!, tz = PQ[3]!, ex = px - x, ez = pz - z;
        if (ex * ex + ez * ez < (R + 6) * (R + 6)) {
          ((X_groundQ[0] = px), (X_groundQ[1] = pz), groundQI());
          ((PU[0] = I_KICK), (PU[1] = px), (PU[2] = pz), (PU[3] = tx), (PU[4] = tz), (PU[5] = KICK_W * 2), (PU[6] = KICK_L), (PU[7] = KICK_H), (PU[8] = 0), (PU[9] = 2e9 + e), (PU[10] = GQ[0]!), push());
          for (let sd = -1; sd <= 1; sd += 2) for (let c = 0; c < 2; c++) {
            const qx = px - tz * sd * (KICK_W + 0.7) + tx * c * 2.4, qz = pz + tx * sd * (KICK_W + 0.7) + tz * c * 2.4;
            ((PU[0] = I_CONE), (PU[1] = qx), (PU[2] = qz), (PU[3] = tx), (PU[4] = tz), (PU[5] = 0), (PU[6] = 0), (PU[7] = 0), (PU[8] = 0), (PU[9] = 2e9 + e + sd + c * 3), (PU[10] = GQ[0]!), push());
          }
        }
      }
    }
    // Roundabout islands out of town.
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (!isRound(i, j) || isTown(i, j)) continue;
      nodeQ(i, j);
      const px = NQ[0]!, pz = NQ[1]!, ex = px - x, ez = pz - z;
      if (ex * ex + ez * ez > (R + RB_ISLE) * (R + RB_ISLE)) continue;
      ((X_groundQ[0] = px), (X_groundQ[1] = pz), groundQI());
      ((PU[0] = I_ISLE), (PU[1] = px), (PU[2] = pz), (PU[3] = 1), (PU[4] = 0), (PU[5] = RB_ISLE), (PU[6] = RB_ISLE), (PU[7] = 0.4), (PU[8] = 1), (PU[9] = 3e9 + i * 7 + j * 13), (PU[10] = GQ[0]!), push());
    }
    // The fields: a lattice of scatter (trees, a stand of pines, rocks, hay bales, a farmstead).
    const FC = 16, fi0 = (Math.floor((x - R) / FC) | 0), fi1 = (Math.floor((x + R) / FC) | 0), fj0 = (Math.floor((z - R) / FC) | 0), fj1 = (Math.floor((z + R) / FC) | 0);
    for (let j = fj0; j <= fj1; j++) for (let i = fi0; i <= fi1; i++) {
      const r = hashI(i, j, seed + 81) * HI;
      if (r > 0.42) continue;
      const px = (i + 0.2 + hashI(i, j, seed + 82) * HI * 0.6) * FC, pz = (j + 0.2 + hashI(i, j, seed + 83) * HI * 0.6) * FC, ex = px - x, ez = pz - z;
      if (ex * ex + ez * ez > R * R) continue;
      ((X_roadQ[0] = px), (X_roadQ[1] = pz), roadQI());
      const farm = r < 0.035;
      if (RQ[0]! < (farm ? 14 : 4) || RQ[3] === 1) continue;
      ((X_townQ[0] = px), (X_townQ[1] = pz), townQI());
      if (TQ[0]! < TOWN_R + 4) continue;
      ((X_groundQ[0] = px), (X_groundQ[1] = pz), groundQI());
      const y = GQ[0]!, key = 4e9 + mod(i * 7919 + j * 104729, 1e9), a = (hashI(i, j, seed + 84) & 7) * 0.785;
      const ux = a < 1.6 ? 1 - a * 0.3 : 0.5, uz = Math.sqrt(1 - ux * ux) || 0;
      if (farm) {
        ((PU[0] = I_BARN), (PU[1] = px), (PU[2] = pz), (PU[3] = ux), (PU[4] = uz), (PU[5] = BW[I_BARN]!), (PU[6] = BD[I_BARN]!), (PU[7] = BH[I_BARN]!), (PU[8] = hashI(i, j, seed + 85) & 7), (PU[9] = key), (PU[10] = y), push());
        const sx = px + ux * 4.6, sz = pz + uz * 4.6;
        ((X_groundQ[0] = sx), (X_groundQ[1] = sz), groundQI());
        ((PU[0] = I_SILO), (PU[1] = sx), (PU[2] = sz), (PU[3] = ux), (PU[4] = uz), (PU[5] = BW[I_SILO]!), (PU[6] = BD[I_SILO]!), (PU[7] = BH[I_SILO]!), (PU[8] = 0), (PU[9] = key + 1), (PU[10] = GQ[0]!), push());
      } else if (r < 0.15) ((PU[0] = I_TREE), (PU[1] = px), (PU[2] = pz), (PU[3] = ux), (PU[4] = uz), (PU[5] = 0), (PU[6] = 0), (PU[7] = 0), (PU[8] = i & 3), (PU[9] = key), (PU[10] = y), push());
      else if (r < 0.24) {
        ((PU[0] = I_PINE), (PU[1] = px), (PU[2] = pz), (PU[3] = ux), (PU[4] = uz), (PU[5] = 0), (PU[6] = 0), (PU[7] = 0), (PU[8] = j & 3), (PU[9] = key), (PU[10] = y), push());
        const qx = px + 1.7, qz = pz + 0.9;
        ((X_groundQ[0] = qx), (X_groundQ[1] = qz), groundQI());
        ((PU[0] = I_PINE), (PU[1] = qx), (PU[2] = qz), (PU[3] = ux), (PU[4] = uz), (PU[5] = 0), (PU[6] = 0), (PU[7] = 0), (PU[8] = (j + 1) & 3), (PU[9] = key + 1), (PU[10] = GQ[0]!), push());
      } else if (r < 0.32) ((PU[0] = I_ROCK), (PU[1] = px), (PU[2] = pz), (PU[3] = ux), (PU[4] = uz), (PU[5] = 0), (PU[6] = 0), (PU[7] = 0), (PU[8] = i & 3), (PU[9] = key), (PU[10] = y), push());
      else ((PU[0] = I_HAY), (PU[1] = px), (PU[2] = pz), (PU[3] = ux), (PU[4] = uz), (PU[5] = 0), (PU[6] = 0), (PU[7] = 0), (PU[8] = 0), (PU[9] = key), (PU[10] = y), push());
    }
    return n;
  }

  // ---- a town's street graph (the patrol): its junction and points along every road out of it ----
  /** Up to 21 nodes (local to the junction), 20 edges, all-pairs distance and next hop: the
   *  ./cops.ts graph shape (`m`: edges in use). Refilled by `townGraph`. */
  const GN = 21, graph = { n: 1, m: 0, nodes: new Float64Array(GN * 2), edges: new Int16Array(GN * 2), D: new Float64Array(GN * GN), NX: new Int16Array(GN * GN) };
  const GS = [8, 17, 27, 37, 46];
  function townGraph(i: number, j: number) {
    nodeQ(i, j);
    const cx = NQ[0]!, cz = NQ[1]!, g = graph;
    incident(i, j);
    let n = 1, m = 0;
    g.nodes[0] = 0; g.nodes[1] = 0;
    for (let q = 0; q < IN[8]!; q++) {
      for (let k = 0; k < GS.length; k++) {
        out(q, GS[k]!);
        g.nodes[n * 2] = PQ[0]! - cx; g.nodes[n * 2 + 1] = PQ[1]! - cz;
        g.edges[m * 2] = k ? n - 1 : 0; g.edges[m * 2 + 1] = n;
        n++; m++;
      }
    }
    g.n = n; g.m = m;
    const D = g.D, NX = g.NX;
    for (let a = 0; a < n * n; a++) (D[a] = 1e9), (NX[a] = -1);
    for (let a = 0; a < n; a++) (D[a * n + a] = 0), (NX[a * n + a] = a);
    for (let o = 0; o < m; o++) {
      const a = g.edges[o * 2]!, b = g.edges[o * 2 + 1]!, dx = g.nodes[a * 2]! - g.nodes[b * 2]!, dz = g.nodes[a * 2 + 1]! - g.nodes[b * 2 + 1]!, d = Math.sqrt(dx * dx + dz * dz);
      D[a * n + b] = D[b * n + a] = d;
      NX[a * n + b] = b; NX[b * n + a] = a;
    }
    for (let k = 0; k < n; k++) for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const v = D[a * n + k]! + D[k * n + b]!;
      if (v < D[a * n + b]!) (D[a * n + b] = v), (NX[a * n + b] = NX[a * n + k]!);
    }
    return g;
  }

  return {
    seed, RQ, TQ, PQ, NQ, IN, EF, PT, EP, HQ, EK,
    heightQ: (x: number, z: number) => ((X_heightQ[0] = x), (X_heightQ[1] = z), heightQI()),
    kindQ: (x: number, z: number) => ((X_kindQ[0] = x), (X_kindQ[1] = z), kindQI()),
    roadQ: (x: number, z: number) => ((X_roadQ[0] = x), (X_roadQ[1] = z), roadQI()),
    townQ: (x: number, z: number) => ((X_townQ[0] = x), (X_townQ[1] = z), townQI()),
    groundQ: (x: number, z: number) => ((X_groundQ[0] = x), (X_groundQ[1] = z), groundQI()),
    /** The window's fill (no double crosses a call: V8 would box it): the point in XH, then `fillQ`. */
    XH: X_heightQ, heightI: heightQI, XT: X_townQ, townI: townQI, fillQ: () => (heightQI(), (X_kindQ[0] = X_heightQ[0]!), (X_kindQ[1] = X_heightQ[1]!), kindQI()),
    height, nodeQ, edge, at, out, incident, isTown, isRound, vOn, gather, town, townName, townGraph, graph,
    /** Town slot s's lots (for a test): count and the table. */
    lotsOf: (s: number) => TN[s]!, TL, MAXL,
  };
}
export type OpenWorld = ReturnType<typeof openWorld>;

/** The window: a heightfield of WIN × WIN cells of the open world round the rider, with each cell's
 *  face kind (the Terrain shape terrainView and the bike read), sliding in whole steps like
 *  ../desert/world.ts's (kept rows and columns copied, only the new strip computed). With `kinds`
 *  off it is the view's far ring (heights only, coarser). */
export function openWindow(W: OpenWorld, WINn = WIN, CELLn = CELL, STEPn = STEP, kinds = true) {
  const XH = W.XH, W1 = WINn + 1, h = new Float64Array(W1 * W1), kind = new Uint8Array(WINn * WINn * 2), F = new Float64Array(3);
  const O = new Int32Array(2), N = new Float64Array(2);
  const t = {
    cols: WINn, rows: WINn, cell: CELLn, x0: 0, z0: 0, h, kind, version: 0, split: "adaptive" as const,
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
    const x0 = t.x0, z0 = t.z0, c = CELLn;
    const u = Math.min(WINn, Math.max(0, (x - x0) / c)), v = Math.min(WINn, Math.max(0, (z - z0) / c));
    const i = Math.min(WINn - 1, Math.floor(u)), j = Math.min(WINn - 1, Math.floor(v)), fu = u - i, fv = v - j, k = j * W1 + i;
    const a = h[k]!, b = h[k + 1]!, cc = h[k + W1 + 1]!, d = h[k + W1]!;
    // The adaptive split (the rule the view draws: @fzlt/core/terrain's "adaptive").
    const fl = Math.abs(b - d) < Math.abs(cc - a), up = fl ? fu + fv > 1 : fu >= fv;
    const sx = up !== fl ? b - a : cc - d, sz = up ? cc - b : d - a;
    F[0] = a + sx * fu + sz * fv + (fl && up ? b - a - sx : 0);
    F[1] = sx / c;
    F[2] = sz / c;
    return (j * WINn + i) * 2 + (up ? 0 : 1);
  }
  // VK: each vertex's face kind (a cell takes its first corner's: the road's edge a quarter cell off, unseen);
  // DV, DK: the same for the kinds drawn (the road ribbons' strips as what lies round them).
  const VK = new Uint8Array(kinds ? W1 * W1 : 0), DV = new Uint8Array(kinds ? W1 * W1 : 0), DK = new Uint8Array(kinds ? WINn * WINn * 2 : 0);
  /** What terrainView draws: the window's heights with the drawn kinds (kept in step by moveTo). */
  const view = { cols: WINn, rows: WINn, cell: CELLn, x0: 0, z0: 0, h, kind: DK, version: 0, split: "adaptive" as const, height: t.height, normal: t.normal, sample: t.sample, kindAt: (x: number, z: number) => DK[face(x, z)]!, at: t.at };
  function fill(i0: number, i1: number, j0: number, j1: number) {
    for (let j = j0; j <= j1; j++) {
      const z = (O[1]! + j) * CELLn;
      for (let i = i0; i <= i1; i++) {
        const x = (O[0]! + i) * CELLn;
        XH[0] = x; XH[1] = z;
        if (kinds) W.fillQ(), (VK[j * W1 + i] = W.HQ[1]!), (DV[j * W1 + i] = W.HQ[2]!);
        else W.heightI();
        h[j * W1 + i] = W.HQ[0]!;
      }
    }
    N[1] = N[1]! + (i1 - i0 + 1) * (j1 - j0 + 1);
  }
  /** Cells i0..i1 × j0..j1: each triangle (as the adaptive split cuts it) takes the kind most of its
   *  three corners have, so a road's edge runs along the diagonals instead of in steps. */
  function cells(i0: number, i1: number, j0: number, j1: number) {
    if (!kinds) return;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * W1 + i, o = (j * WINn + i) * 2, a = VK[k]!, b = VK[k + 1]!, cc = VK[k + W1 + 1]!, d = VK[k + W1]!;
      const da = DV[k]!, db = DV[k + 1]!, dc = DV[k + W1 + 1]!, dd = DV[k + W1]!;
      if (Math.abs(h[k + 1]! - h[k + W1]!) < Math.abs(h[k + W1 + 1]! - h[k]!)) (kind[o] = maj(b, cc, d)), (kind[o + 1] = maj(a, b, d)), (DK[o] = maj(db, dc, dd)), (DK[o + 1] = maj(da, db, dd));
      else (kind[o] = maj(a, b, cc)), (kind[o + 1] = maj(a, cc, d)), (DK[o] = maj(da, db, dc)), (DK[o + 1] = maj(da, dc, dd));
    }
  }
  function moveTo(ox: number, oz: number) {
    const dx = ox - O[0]!, dz = oz - O[1]!;
    if (!dx && !dz && t.version) return false;
    const keep = t.version > 0 && Math.abs(dx) < WINn && Math.abs(dz) < WINn;
    O[0] = ox; O[1] = oz;
    t.x0 = ox * CELLn; t.z0 = oz * CELLn;
    if (!keep) fill(0, WINn, 0, WINn), cells(0, WINn - 1, 0, WINn - 1);
    else {
      shift(h, W1, 1, dx, dz);
      if (kinds) shift(VK, W1, 1, dx, dz), shift(DV, W1, 1, dx, dz), shift(kind, WINn * 2, 2, dx, dz), shift(DK, WINn * 2, 2, dx, dz);
      if (dz > 0) fill(0, WINn, W1 - dz, WINn), cells(0, WINn - 1, WINn - dz, WINn - 1);
      else if (dz < 0) fill(0, WINn, 0, -dz - 1), cells(0, WINn - 1, 0, -dz - 1);
      const j0 = dz > 0 ? 0 : -dz, j1 = dz > 0 ? WINn - dz : WINn, k0 = dz > 0 ? 0 : -dz, k1 = dz > 0 ? WINn - 1 - dz : WINn - 1;
      if (dx > 0) fill(W1 - dx, WINn, j0, j1), cells(WINn - dx, WINn - 1, k0, k1);
      else if (dx < 0) fill(0, -dx - 1, j0, j1), cells(0, -dx - 1, k0, k1);
    }
    N[0] = N[0]! + 1;
    t.version++;
    view.x0 = t.x0; view.z0 = t.z0; view.version = t.version;
    return true;
  }
  /** Shift a row-major grid (rows of `stride`, `per` entries a column) by (dx, dz) columns and rows, in place. */
  function shift(a: Float64Array | Uint8Array, stride: number, per: number, dx: number, dz: number) {
    const rows = a.length / stride;
    if (dz > 0) a.copyWithin(0, dz * stride);
    else if (dz < 0) a.copyWithin(-dz * stride, 0, (rows + dz) * stride);
    if (dx) for (let j = 0; j < rows; j++) {
      const r = j * stride;
      if (dx > 0) a.copyWithin(r, r + dx * per, r + stride);
      else a.copyWithin(r - dx * per, r, r + stride + dx * per);
    }
  }
  function follow(x: number, z: number) {
    const cx = (Math.floor(x / CELLn / STEPn) | 0) * STEPn, cz = (Math.floor(z / CELLn / STEPn) | 0) * STEPn;
    const ox = cx - WINn / 2 + STEPn / 2, oz = cz - WINn / 2 + STEPn / 2;
    if (t.version && ox === O[0] && oz === O[1]) return false;
    return moveTo(ox, oz);
  }
  return { t: t as unknown as Terrain & { x0: number; z0: number }, view: view as unknown as Terrain & { x0: number; z0: number }, O, stats: N, follow, moveTo };
}
export type OpenWindow = ReturnType<typeof openWindow>;

/** One chunk of the open ground, as bytes: (CH + 1)² heights and CH² face kinds (the determinism test). */
export function openChunk(seed: number, ci: number, cj: number, CH = 16) {
  const W = openWorld(seed), out = new Float64Array((CH + 1) * (CH + 1) + CH * CH);
  for (let j = 0; j <= CH; j++) for (let i = 0; i <= CH; i++) W.heightQ((ci * CH + i) * CELL, (cj * CH + j) * CELL), (out[j * (CH + 1) + i] = W.HQ[0]!);
  for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) {
    const x = (ci * CH + i) * CELL, z = (cj * CH + j) * CELL;
    W.roadQ(x, z); W.kindQ(x, z);
    out[(CH + 1) * (CH + 1) + j * CH + i] = W.HQ[1]!;
  }
  return new Uint8Array(out.buffer);
}
