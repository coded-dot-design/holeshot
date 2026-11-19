// The Endless Mashup's biome field, headless: one endless world whose ground changes by region. The
// plane is cut into big regions (a Voronoi cell round each site of a jittered lattice, BC units a
// cell: every region well over a kilometre across), each one biome: THE CITY (Endless Wheelie City's
// roads and towns, ../wheelie/open.ts), THE DUNES (the Endless dune sea), THE MOUNTAINS (the endless
// woods' hills, scaled up), THE QUARRY (its benches) and THE PARK (its jump lines): the endless
// grounds of ../desert/world.ts, each on its own Endless seed, so the same place is the same sand
// you ride in ENDLESS. The lattice is coloured so riding far one way cycles them (east: city, dunes,
// mountains, city, quarry, park, city…) and no two regions side by side are the same wild ground.
//
// Nothing is forked: the open world asks this field (`Mix`, ../wheelie/open.ts) how much of a point
// is city, and blends its own ground with the wild one this field computes from the endless
// generators. Across a border every site within BAND of the nearest one weighs in (a smoothstep of
// how much further it is), so heights, the face palette (dithered by a noise threshold) and the
// scenery's density all change over a band about BAND wide, continuously: no edge, no gap. The roads
// run on through every region; past the city they are dirt trails on the wild ground.
//
// Pure functions of the seed and the place (only + − × ÷, floors and square roots: ../../math.ts
// rules), scratch arrays only, so zero allocation per step and the same bytes on every engine.
import { featureOf, groundQ, GQ, FCELL, B_DESERT, B_QUARRY, B_FOREST, B_PARK, D_CACTUS, D_ROCKS, D_CAMP } from "../desert/world.ts";
import { BIOMES } from "../desert/track.ts";
import { IS, I_PINE, I_ROCK, I_LAMP, I_CONE, I_BARN, I_CACTUS, BW, BD, BH, F_SAND, F_FLOOR, F_STONE, F_TURF } from "../wheelie/open.ts";

/** The region lattice (world units a cell), how far a site strays (of BC), the blend band (units). */
export const BC = 1600, JIT = 0.18, BAND = 160;
/** The biomes: the city, then the wild grounds. */
export const M_CITY = 0, M_DUNES = 1, M_PEAKS = 2, M_QUARRY = 3, M_PARK = 4, NBIOME = 5;
/** Per biome: its name (the toast: "ENTERING THE DUNES"), its endless ground (../desert/world.ts's
 *  biome and seed), the ground's spread and height (the mountains: the woods' hills ×1.8 wide, ×2.6
 *  high), and its face kind. */
export const MASH = [
  { id: "city", name: "THE CITY", bi: -1, seed: 0, spread: 1, lift: 1, kind: 0 },
  { id: "dunes", name: "THE DUNES", bi: B_DESERT, seed: BIOMES[0]!.seed, spread: 1, lift: 1, kind: F_SAND },
  { id: "peaks", name: "THE MOUNTAINS", bi: B_FOREST, seed: BIOMES[2]!.seed, spread: 1.8, lift: 2.6, kind: F_FLOOR },
  { id: "quarry", name: "THE QUARRY", bi: B_QUARRY, seed: BIOMES[1]!.seed, spread: 1, lift: 1, kind: F_STONE },
  { id: "park", name: "THE PARK", bi: B_PARK, seed: BIOMES[3]!.seed, spread: 1, lift: 1, kind: F_TURF },
] as const;
/** The lattice's colouring: cell (i, j) is CYCLE[(i + 2j) mod 6]. Every neighbour (the eight round a
 *  cell) differs by 1, 2 or 3 places, so only city meets city (diagonally: one bigger city). */
const CYCLE = [M_CITY, M_DUNES, M_PEAKS, M_CITY, M_QUARRY, M_PARK];
const SP = new Float64Array(NBIOME), SL = new Float64Array(NBIOME), KB = new Int32Array(NBIOME);
for (let b = 0; b < NBIOME; b++) (SP[b] = 1 / MASH[b]!.spread), (SL[b] = MASH[b]!.lift), (KB[b] = MASH[b]!.kind);

const HI = 1 / 1073741824;
function hashI(i: number, j: number, s: number) {
  let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(s, 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 15), 0x297a2d39);
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b);
  return (h ^ (h >>> 16)) >>> 2;
}
const mod = (a: number, m: number) => ((a % m) + m) % m;
/** Cell (i, j)'s biome (the start's cell, 0 0, is the city). */
export const biomeOf = (i: number, j: number) => CYCLE[mod(i + 2 * j, 6)]!;

/** The field for a world seed: the Mix the open world composes with (../wheelie/open.ts), plus the
 *  wild scatter its gather adds. X (in and out): [0] x, [1] z → [2] the city's weight 0..1, [3] the
 *  wild ground's height (its biomes blended), [4] the wild face kind (dithered across a border), [5]
 *  the biome with the most weight, [6] how much further the nearest site of another biome is than
 *  the nearest site (2 × about the distance to the border), [7..11] each biome's weight. */
export function field(seed: number) {
  const CW = new Float64Array(NBIOME), X = new Float64Array(12), D = new Float64Array(9), B = new Int32Array(9), W = new Float64Array(NBIOME), N = new Float64Array(4);
  /** Site (i, j) into N[0], N[1] (the start's site is the origin). */
  function site(i: number, j: number) {
    if (i === 0 && j === 0) return void ((N[0] = 0), (N[1] = 0));
    N[0] = (i + (hashI(i, j, seed + 301) * HI - 0.5) * 2 * JIT) * BC;
    N[1] = (j + (hashI(i, j, seed + 302) * HI - 0.5) * 2 * JIT) * BC;
  }
  /** A smooth noise 0..1 at (N[2], N[3]) (the palette's dither) into N[2]. */
  function noise(s: number) {
    const a = N[2]!, b = N[3]!, i = Math.floor(a) | 0, j = Math.floor(b) | 0;
    let fa = a - i, fb = b - j;
    fa = fa * fa * (3 - 2 * fa);
    fb = fb * fb * (3 - 2 * fb);
    const v00 = hashI(i, j, s) * HI, v10 = hashI(i + 1, j, s) * HI, v01 = hashI(i, j + 1, s) * HI, v11 = hashI(i + 1, j + 1, s) * HI;
    N[2] = v00 + (v10 - v00) * fa + (v01 - v00) * fb + (v00 - v10 - v01 + v11) * fa * fb;
  }
  function at() {
    const x = X[0]!, z = X[1]!, ci = Math.floor(x / BC + 0.5) | 0, cj = Math.floor(z / BC + 0.5) | 0;
    let d1 = 1e18, k1 = 0, n = 0;
    for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
      site(i, j);
      const dx = x - N[0]!, dz = z - N[1]!, d = Math.sqrt(dx * dx + dz * dz);
      D[n] = d; B[n] = biomeOf(i, j);
      if (d < d1) (d1 = d), (k1 = n);
      n++;
    }
    W.fill(0);
    const b1 = B[k1]!;
    let sum = 0, gap = 1e9;
    for (let k = 0; k < 9; k++) {
      const g = D[k]! - d1;
      if (B[k] !== b1 && g < gap) gap = g;
      let u = 1 - g / BAND;
      if (u <= 0) continue;
      u = u * u * (3 - 2 * u);
      W[B[k]!] = W[B[k]!]! + u;
      sum += u;
    }
    let top = 0;
    for (let b = 0; b < NBIOME; b++) (W[b] = W[b]! / sum), (X[7 + b] = W[b]!), W[b]! > W[top]! && (top = b);
    X[2] = W[M_CITY]!; X[5] = top; X[6] = gap;
    const wild = 1 - W[M_CITY]!;
    if (wild <= 0) return void ((X[3] = 0), (X[4] = 0));
    // The wild ground: each wild biome's endless ground, weighed; the kind dithered between them.
    N[2] = x / 5.5; N[3] = z / 5.5; noise(seed + 311);
    let h = 0, pick = N[2]! * wild, kind = 0;
    for (let b = 1; b < NBIOME; b++) {
      const w = W[b]!;
      if (w <= 0) continue;
      const s = SP[b]!;
      GQ[4] = x * s; GQ[5] = z * s;
      groundQ(MASH[b]!.seed, MASH[b]!.bi);
      h += w * GQ[6]! * SL[b]!;
      if (!kind && pick < w) kind = KB[b]!;
      pick -= w;
    }
    X[3] = h / wild;
    X[4] = kind || KB[top === M_CITY ? M_DUNES : top]!;
  }
  /** The wild scatter round (x, z) within R: each wild region's features (../desert/world.ts's lattice:
   *  cactus stands, the woods' trees, rock piles, a camp's beacon, the park's pylons) and a sparse
   *  ground scatter, thinned by the biome's weight at each spot (so it thins out across a border),
   *  off the trails. Into out (IS numbers an item) from n, at most cap; returns the new count. */
  const scatter: Scatter = (Wd, x, z, R, out, n, cap) => {
    const XH = Wd.XH, RQ = Wd.RQ;
    // The lattice in each biome's own (spread) coordinates: the cells round (x, z) for each wild biome near.
    X[0] = x; X[1] = z; at();
    for (let b = 0; b < NBIOME; b++) CW[b] = X[7 + b]!;
    const far = X[6]! > 2 * R + BAND + 4 * FCELL * 2;
    for (let b = 1; b < NBIOME; b++) {
      if (CW[b]! <= 0 && far) continue;
      const s = SP[b]!, bs = MASH[b]!.seed, bi = MASH[b]!.bi, spread = MASH[b]!.spread, rr = R * s;
      const i0 = Math.floor((x * s - rr) / FCELL) | 0, i1 = Math.floor((x * s + rr) / FCELL) | 0, j0 = Math.floor((z * s - rr) / FCELL) | 0, j1 = Math.floor((z * s + rr) / FCELL) | 0;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const k = featureOf(bs, i, j, FF, bi);
        if (k !== D_CACTUS && k !== D_ROCKS && k !== D_CAMP) continue;
        const cx = FF[1]! * spread, cz = FF[2]! * spread;
        for (let q = 0; q < (k === D_CAMP ? 1 : 4); q++) {
          if (n >= cap) return n;
          const a = ((hashI(i * 7 + q, j, bs + 90) & 7) + q * 2) & 7, r = k === D_CAMP ? 0 : (1.2 + hashI(i, j * 7 + q, bs + 91) * HI * 3.2) * spread;
          const px = cx + DX[a * 2]! * r, pz = cz + DX[a * 2 + 1]! * r, ex = px - x, ez = pz - z;
          if (ex * ex + ez * ez > R * R) continue;
          const kind = k === D_CAMP ? (b === M_PEAKS ? I_BARN : I_LAMP) : k === D_ROCKS ? I_ROCK : b === M_DUNES ? I_CACTUS : b === M_PEAKS ? I_PINE : b === M_PARK ? I_CONE : I_ROCK;
          n = put(Wd, out, n, b, kind, px, pz, hashI(i + q, j, bs + 93), 5e9 + b * 1e8 + mod(i * 7919 + j * 104729, 1e7) * 8 + q);
        }
      }
      // The ground scatter: a 16-unit lattice (the mountains' pines, the odd rock and cactus).
      const p = b === M_PEAKS ? 0.3 : b === M_DUNES ? 0.06 : b === M_QUARRY ? 0.08 : 0;
      if (!p) continue;
      const FC = 16, fi0 = Math.floor((x - R) / FC) | 0, fi1 = Math.floor((x + R) / FC) | 0, fj0 = Math.floor((z - R) / FC) | 0, fj1 = Math.floor((z + R) / FC) | 0;
      for (let j = fj0; j <= fj1; j++) for (let i = fi0; i <= fi1; i++) {
        const r = hashI(i, j, bs + 381) * HI;
        if (r > p) continue;
        const px = (i + 0.15 + hashI(i, j, bs + 382) * HI * 0.7) * FC, pz = (j + 0.15 + hashI(i, j, bs + 383) * HI * 0.7) * FC, ex = px - x, ez = pz - z;
        if (ex * ex + ez * ez > R * R) continue;
        if (n >= cap) return n;
        const kind = b === M_PEAKS ? I_PINE : b === M_DUNES && r < 0.035 ? I_CACTUS : I_ROCK;
        n = put(Wd, out, n, b, kind, px, pz, hashI(i, j, bs + 384), 6e9 + b * 1e8 + mod(i * 7919 + j * 104729, 1e8));
      }
    }
    return n;
  };
  /** Push one wild item at (px, pz) if biome b holds the spot (its weight against a hashed draw) and
   *  it is off the trails; its y the full ground's (the blended height). */
  function put(Wd: Parameters<Scatter>[0], out: Float64Array, n: number, b: number, kind: number, px: number, pz: number, h: number, key: number) {
    X[0] = px; X[1] = pz; at();
    if (X[7 + b]! < 1 && X[7 + b]! <= (h & 1023) / 1024) return n;
    Wd.roadQ(px, pz);
    if (Wd.RQ[0]! < (kind === I_BARN ? 6 : 2.2)) return n;
    Wd.XH[0] = px; Wd.XH[1] = pz; Wd.heightI();
    const o = n * IS, a = (h >>> 10) & 7, ux = CS[a * 2]!, uz = CS[a * 2 + 1]!;
    out[o] = kind; out[o + 1] = px; out[o + 2] = pz; out[o + 3] = ux; out[o + 4] = uz;
    out[o + 5] = kind === I_BARN ? BW[I_BARN]! : 0; out[o + 6] = kind === I_BARN ? BD[I_BARN]! * 0.8 : 0; out[o + 7] = kind === I_BARN ? BH[I_BARN]! * 0.8 : 0;
    out[o + 8] = (h >>> 13) & 3; out[o + 9] = key; out[o + 10] = Wd.HQ[0]!;
    return n + 1;
  }
  return { X, at, scatter, /** Site (i, j)'s place into N[0], N[1] (the tests). */ site, N };
}
export type Field = ReturnType<typeof field>;
/** The wild scatter's view of the open world: its height and road queries through scratch. */
export type Scatter = (W: { XH: Float64Array; heightI: () => void; HQ: Float64Array; RQ: Float64Array; roadQ: (x: number, z: number) => void }, x: number, z: number, R: number, out: Float64Array, n: number, cap: number) => number;
const FF = new Float64Array(4);
/** Eight directions (a post round its feature) and eight headings (an item's facing): cos, sin. */
const DX = [1, 0, 0.7071067811865476, 0.7071067811865476, 0, 1, -0.7071067811865476, 0.7071067811865476, -1, 0, -0.7071067811865476, -0.7071067811865476, 0, -1, 0.7071067811865476, -0.7071067811865476];
const CS = DX;

/** The biome at (x, z) for a seed (the tests, the toast's name): the one with the most weight. */
export function biomeAt(f: Field, x: number, z: number) {
  f.X[0] = x; f.X[1] = z; f.at();
  return f.X[5]!;
}
