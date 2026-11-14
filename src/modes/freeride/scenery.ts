// Free Ride's maps, drawn: each open map's look in the cyberpunk × Tron style (a neon night in dark,
// a pastel day in light): its palette over the track scene's, its ground bands, the neon lines
// drawn over the terrain, the things it builds on the table (marker poles, monoliths, light towers,
// boulders, neon trees, logs, the wall, parked cars) and its sky. The track scene (../race/scene.ts
// `mountTrack`) calls `mapLook(map)` and builds with it. Everything is placed from the map's data
// and its seed: the same map, the same scenery. Cheap by design: a few hundred flat objects at most.
import type { Diorama } from "@fzlt/core/diorama";
import type { Terrain } from "@fzlt/core/terrain";
import type { Pal } from "../race/scene.ts";
import { F_GAP, F_LOG, F_ROCKS, F_STEP, F_DOUBLE, F_KICKER, LOT, LOT_Y, type RideMap } from "./maps.ts";

/** A map's colours beyond the track scene's. */
export interface MapPal { lot: string; trunk: string; leaf: string; leafTop: string; rock: string; wall: string; car: string; sun: string; sun2: string }
type P = Pal & MapPal;
/** A neon line over the terrain: points [x, y, z, …], closed or not, a palette key, its alpha. */
export interface MapLine { p: Float64Array; n: number; closed: boolean; c: "edge" | "edge2" | "rim" | "leafTop" | "sun"; a: number }
interface Look {
  dark: Partial<Pal> & MapPal;
  light: Partial<Pal> & MapPal;
  /** Ground colour bands by height (terrainView `bands`) and the painted kinds' colours. */
  bands(p: P): [number, string][];
  kinds(p: P): string[];
  /** Over the sky's gradient: a sun, a skyline, a moon. */
  sky?(c: CanvasRenderingContext2D, W: number, H: number, p: P): void;
}
/** A map's look, bound to its map. */
export interface MapLook extends Look {
  /** The neon lines (built once per scene). */
  lines(t: Terrain): MapLine[];
  /** The scenery on the table. */
  build(d: Diorama, t: Terrain, p: P): void;
}

const hash = (i: number, s: number) => {
  let h = Math.imul(i ^ s, 0x2c1b3c6d) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 15), 0x297a2d39);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};
/** The point at lap distance s on the line, offset `side` across it: [x, z, yaw]. */
function at(m: RideMap, s: number, side: number, out: Float64Array) {
  const i = ((Math.round(s / (m.LAP / m.NT)) % m.NT) + m.NT) % m.NT, yaw = m.YAW[i]!;
  out[0] = m.TRACK[i * 2]! + Math.sin(yaw) * side;
  out[1] = m.TRACK[i * 2 + 1]! + Math.cos(yaw) * side;
  out[2] = yaw;
  return out;
}
/** The line's two edges as neon lines. */
function edges(m: RideMap, t: Terrain, left: MapLine["c"], right: MapLine["c"], a = 1): MapLine[] {
  const E = m.trackEdges(t), n = m.NT;
  return [{ p: E.subarray(0, n * 3), n, closed: true, c: left, a }, { p: E.subarray(n * 3), n, closed: true, c: right, a }];
}
/** Light towers in the table's corners, their lamps aimed in (the race's). */
function towers(d: Diorama, t: Terrain, m: RideMap, p: P, h = 4.2) {
  for (const [x, z] of [[-m.HX + 1.4, -m.HZ + 1.4], [m.HX - 1.4, -m.HZ + 1.4], [-m.HX + 1.4, m.HZ - 1.4], [m.HX - 1.4, m.HZ - 1.4]] as const) {
    const id = "tw" + x + z, yaw = Math.atan2(-z, x) + Math.PI / 2;
    d.add({ id, shape: "cyl", sides: 6, size: [0.3, h, 0.3], pos: [x, t.height(x, z) - 0.1, z], color: p.tower, pick: false });
    d.add({ size: [1.3, 0.5, 0.25], pos: [0, 0, 0], rot: [0, yaw, 0], on: id, color: p.tower, pick: false });
    d.add({ size: [1.1, 0.34, 0.27], pos: [0, 0.08, 0], rot: [0, yaw, 0], on: id, color: p.lamp, emissive: true, pick: false, layer: 9 });
  }
}
/** Neon-tipped pylons along the line, every `every` points, alternating sides. */
function pylons(d: Diorama, t: Terrain, m: RideMap, p: P, every: number, off: number, P3: Float64Array) {
  for (let i = 6, k = 0; i < m.NT; i += every, k++) {
    const side = k & 1 ? 1 : -1;
    at(m, m.sAt(i), (m.def.width / 2 + off) * side, P3);
    const id = "py" + i;
    d.add({ id, shape: "cyl", sides: 6, size: [0.14, 0.8, 0.14], pos: [P3[0]!, t.height(P3[0]!, P3[1]!), P3[1]!], color: p.gatePost, pick: false });
    d.add({ shape: "cyl", sides: 6, size: [0.22, 0.16, 0.22], pos: [0, 0, 0], on: id, color: side > 0 ? p.edge : p.edge2, emissive: true, pick: false });
  }
}
/** Lines of the terrain along x at rows of z (a Tron scan over the dunes). */
function scanlines(t: Terrain, m: RideMap, rows: number, step: number): MapLine[] {
  const out: MapLine[] = [];
  for (let r = 0; r < rows; r++) {
    const z = -m.HZ + 2 + ((2 * m.HZ - 4) * (r + 0.5)) / rows, n = Math.floor((2 * m.HX - 3) / step) + 1, p = new Float64Array(n * 3);
    for (let k = 0; k < n; k++) {
      const x = -m.HX + 1.5 + k * step;
      p[k * 3] = x, p[k * 3 + 1] = t.height(x, z) + 0.05, p[k * 3 + 2] = z;
    }
    out.push({ p, n, closed: false, c: "edge", a: 0.3 });
  }
  return out;
}
/** Each feature of a kind: its start along the line. */
const featureStarts = (m: RideMap, kinds: number[]) => {
  const out: number[] = [];
  for (let k = 0; k < m.FEATURES.length; k += 2) if (kinds.includes(m.FEATURES[k]!)) out.push(m.FEATURES[k]!, m.FEATURES[k + 1]!);
  return out;
};
/** A synthwave sun: a disc low on the horizon, cut by bands. */
function sun(c: CanvasRenderingContext2D, W: number, H: number, p: P, x: number, r: number) {
  const y = H * 0.5, g = c.createLinearGradient(0, y - r, 0, y + r * 0.2);
  g.addColorStop(0, p.sun);
  g.addColorStop(1, p.sun2);
  c.fillStyle = g;
  c.globalAlpha = p.night ? 0.9 : 0.55;
  c.beginPath();
  c.arc(x, y, r, Math.PI, 0);
  c.fill();
  c.fillStyle = p.sky1;
  for (let k = 0; k < 5; k++) c.fillRect(x - r, y - r * (0.12 + k * 0.17), r * 2, r * (0.025 + k * 0.012));
  c.globalAlpha = 1;
}

// ---- the looks ----

const DUNES: Look = {
  dark: {
    sky0: "#07031c", sky1: "#24093f", sky2: "#5a1660", grid: "#ff4fa8", star: "#ffd6f2",
    ground: ["#1f0c38", "#2c1248", "#3b1a5a"], crest: "#55246e", steep: "#170929", track: "#3a1d5c", face: "#5c2a7c", edge: "#22e6ff", edge2: "#ffb13b",
    plinth: "#1a0a2e", rim: "#ff4fa8", table: "#0b0618", tower: "#2a1a48", gatePost: "#2a1a48", dust: "#b06ad8",
    lot: "#1a1430", trunk: "#2a1a48", leaf: "#2a1a48", leafTop: "#22e6ff", rock: "#3a1d5c", wall: "#2a1a48", car: "#2a1a48", sun: "#ffd166", sun2: "#ff3d8b",
  },
  light: {
    sky0: "#ffd2bf", sky1: "#ffe6d2", sky2: "#fff3e4", grid: "#ffffff",
    ground: ["#f3cfa0", "#eebf88", "#e7ae72"], crest: "#fff0d8", steep: "#d4945f", track: "#e2a874", face: "#e59a6a", edge: "#13a9bb", edge2: "#ff7a59",
    plinth: "#d9925f", rim: "#ff7a59", table: "#f2d6b5", dust: "#efc597",
    lot: "#e8d2b8", trunk: "#8a6a58", leaf: "#8a6a58", leafTop: "#13a9bb", rock: "#d4945f", wall: "#c98f6a", car: "#c98f6a", sun: "#ffe08a", sun2: "#ff8a6b",
  },
  bands: (p) => [[0.8, p.ground[0]!], [1.6, p.ground[1]!], [2.4, p.ground[2]!], [99, p.crest]],
  kinds: (p) => [p.track, p.face],
  sky: (c, W, H, p) => sun(c, W, H, p, W * 0.66, Math.min(W, H) * 0.17),
};

const QUARRY_LOOK: Look = {
  dark: {
    sky0: "#040a14", sky1: "#0d1a2c", sky2: "#1d2e44", grid: "#2f5a78", star: "#cfe6ff",
    ground: ["#132030", "#18293b", "#1e3247"], crest: "#25405a", steep: "#0b131d", track: "#3a2d44", face: "#56405e", edge: "#ffb13b", edge2: "#22e6ff",
    plinth: "#0f1826", rim: "#ffb13b", table: "#070c14", tower: "#1d2a3c", gatePost: "#1d2a3c", lamp: "#ffe2a8", dust: "#6a7fa0",
    lot: "#1a2330", trunk: "#1d2a3c", leaf: "#1d2a3c", leafTop: "#ffb13b", rock: "#2a3a50", wall: "#1d2a3c", car: "#ffb13b", sun: "#ffb13b", sun2: "#ff4fa8",
  },
  light: {
    sky0: "#c8e2f2", sky1: "#e2eff6", sky2: "#fbf1e2", grid: "#ffffff",
    ground: ["#e3cdb0", "#d8be9c", "#cbad87", "#bf9c74"], crest: "#efdcc2", steep: "#a98462", track: "#c98f6a", face: "#dba57a", edge: "#ff8a3d", edge2: "#13a9bb",
    plinth: "#b08463", rim: "#ff8a3d", table: "#e8d3ba", tower: "#8a8fb0", dust: "#dcc3a3",
    lot: "#d8c4aa", trunk: "#8a8fb0", leaf: "#8a8fb0", leafTop: "#ff8a3d", rock: "#b59572", wall: "#a98462", car: "#ff8a3d", sun: "#ffe08a", sun2: "#ff8a6b",
  },
  bands: (p) => [[0.55, p.ground[0]!], [1.65, p.ground[1]!], [2.75, p.ground[2]!], [99, p.crest]],
  kinds: (p) => [p.track, p.face],
};

const FOREST_LOOK: Look = {
  dark: {
    sky0: "#020a10", sky1: "#08182a", sky2: "#123040", grid: "#1f6a5a", star: "#d8fff0",
    ground: ["#071a14", "#0a2219", "#0d2a1f"], crest: "#11352a", steep: "#05120d", track: "#2c2036", face: "#4a3550", edge: "#b6ff3b", edge2: "#22e6ff",
    plinth: "#06140f", rim: "#b6ff3b", table: "#030a08", tower: "#14302a", gatePost: "#14302a", dust: "#5a8a72",
    lot: "#0a1a14", trunk: "#1c1630", leaf: "#0c3a2c", leafTop: "#3dffb0", rock: "#22303a", wall: "#14302a", car: "#14302a", sun: "#e8fff6", sun2: "#9fe8ff",
  },
  light: {
    sky0: "#cdeedd", sky1: "#e4f6ec", sky2: "#f8f6e6", grid: "#ffffff",
    ground: ["#a8dcb4", "#9ad2a9", "#8cc79d"], crest: "#b9e6c2", steep: "#76ad86", track: "#d2a47c", face: "#e2b88c", edge: "#7cc93a", edge2: "#13a9bb",
    plinth: "#8a6a58", rim: "#7cc93a", table: "#dfe9d2", tower: "#6f8a7a", dust: "#d9c09a",
    lot: "#c9dcc0", trunk: "#8a6a58", leaf: "#5fae78", leafTop: "#b8f0a0", rock: "#a3a8b8", wall: "#6f8a7a", car: "#6f8a7a", sun: "#ffffff", sun2: "#e8f6ff",
  },
  bands: (p) => [[0.55, p.ground[0]!], [1.05, p.ground[1]!], [1.55, p.ground[2]!], [99, p.crest]],
  kinds: (p) => [p.track, p.face],
};

const PARK_LOOK: Look = {
  dark: {
    ground: ["#0e0c22", "#120f2a", "#161232"], crest: "#1d1838", steep: "#0a0918", track: "#3a2650", face: "#5a3874",
    lot: "#17142e", trunk: "#24203f", leaf: "#24203f", leafTop: "#ff4fa8", rock: "#24203f", wall: "#1d1838", car: "#2b2748", sun: "#ff4fa8", sun2: "#7b2cff",
  },
  light: {
    ground: ["#a8dcb4", "#9ad2a9", "#8cc79d"], crest: "#b9e6c2", track: "#d9a774", face: "#e8bf8f",
    lot: "#cfc6d8", trunk: "#8a8fb0", leaf: "#8a8fb0", leafTop: "#ff7a59", rock: "#c98f6a", wall: "#e9e0f0", car: "#ffffff", sun: "#ffd1dc", sun2: "#ffe9c8",
  },
  bands: (p) => [[0.45, p.ground[0]!], [0.85, p.ground[1]!], [1.25, p.ground[2]!], [99, p.crest]],
  kinds: (p) => [p.track, p.face, p.lot],
};

const LOOKS: Record<string, Look> = { "dune-sea": DUNES, quarry: QUARRY_LOOK, forest: FOREST_LOOK, "night-park": PARK_LOOK };
/** A map's ground bands and painted kinds, for the picker's preview (every look sets them). */
export function previewColors(m: RideMap, night: boolean) {
  const L = LOOKS[m.id] ?? PARK_LOOK, p = (night ? L.dark : L.light) as P;
  return { bands: L.bands(p), kinds: L.kinds(p) };
}
/** A map's look, bound to the map (its lines and scenery read the map's line and features). */
export function mapLook(m: RideMap): MapLook {
  const L = LOOKS[m.id] ?? PARK_LOOK;
  return { ...L, lines: (t) => linesOf(m, t), build: (d, t, p) => buildOf(m, d, t, p) };
}

function linesOf(m: RideMap, t: Terrain): MapLine[] {
  if (m.id === "dune-sea") return scanlines(t, m, 10, 1);
  if (m.id === "quarry") {
    // The benches' lips, in amber, and the trail's edges.
    const out = edges(m, t, "edge2", "edge", 0.85);
    for (const r of [6.85, 9.85, 12.85]) {
      const n = 72, p = new Float64Array(n * 3);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2, x = Math.cos(a) * r * 1.4, z = Math.sin(a) * r;
        m.near(x, z);
        // Broken where the trail cuts through the bench (NaN: no line there).
        p[k * 3] = x, p[k * 3 + 1] = m.NR[0]! < m.def.width / 2 + 1.2 ? NaN : t.height(x, z) + 0.06, p[k * 3 + 2] = z;
      }
      out.push({ p, n, closed: true, c: "edge", a: 0.7 });
    }
    return out;
  }
  if (m.id === "forest") return edges(m, t, "edge", "edge2", 0.9);
  return edges(m, t, "edge2", "edge");
}

function buildOf(m: RideMap, d: Diorama, t: Terrain, p: P) {
  const P3 = new Float64Array(3), seed = m.def.seed, half = m.def.width / 2;
  if (m.id === "dune-sea") {
    // Marker poles along the line, glowing at the tip, and monoliths on the high crests.
    pylons(d, t, m, p, 16, 1.6, P3);
    for (let k = 0, placed = 0; k < 400 && placed < 4; k++) {
      const x = (hash(k * 2, seed) * 2 - 1) * (m.HX - 4), z = (hash(k * 2 + 1, seed) * 2 - 1) * (m.HZ - 4), h = t.height(x, z);
      m.near(x, z);
      if (h < 1.9 || m.NR[0]! < half + 4) continue;
      const id = "mono" + placed++, yaw = hash(k, seed + 3) * Math.PI;
      d.add({ id, size: [0.5, 2.6, 0.9], pos: [x, h - 0.2, z], rot: [0, yaw, 0], color: p.tower, pick: false });
      d.add({ size: [0.54, 0.08, 0.94], pos: [0, 0, 0], on: id, color: p.edge, emissive: true, pick: false });
    }
    return;
  }
  if (m.id === "quarry") {
    towers(d, t, m, p, 5.4);
    pylons(d, t, m, p, 14, 1.1, P3);
    // Boulders on the benches, off the line.
    for (let k = 0, placed = 0; k < 600 && placed < 22; k++) {
      const x = (hash(k * 2, seed) * 2 - 1) * (m.HX - 2), z = (hash(k * 2 + 1, seed) * 2 - 1) * (m.HZ - 2);
      m.near(x, z);
      if (m.NR[0]! < half + 1.6) continue;
      const s = 0.35 + hash(k, seed + 5) * 0.6;
      d.add({ shape: "cyl", sides: 5, top: 0.55, size: [s * 1.5, s, s * 1.3], pos: [x, t.height(x, z) - 0.08, z], rot: [0, hash(k, seed + 9) * 6, 0], color: p.rock, pick: false });
      placed++;
    }
    // A mining rig on the rim: a hopper and its lit band.
    for (const [x, z] of [[17, -13], [-21, 13]] as const) {
      const id = "rig" + x;
      d.add({ id, size: [2.2, 1.4, 1.6], pos: [x, t.height(x, z) - 0.05, z], color: p.tower, pick: false });
      d.add({ size: [2.22, 0.14, 1.62], pos: [0, -0.4, 0], on: id, color: p.rim, emissive: true, pick: false });
      d.add({ shape: "wedge", size: [1.6, 0.9, 1.4], pos: [0, 0, 0], on: id, color: p.rock, pick: false });
    }
    return;
  }
  if (m.id === "forest") {
    // Neon trees on the posts the rider can hit: a trunk, a dark crown, a lit tip.
    for (let k = 0; k < m.NP; k++) {
      const x = m.POSTS[k * 3]!, z = m.POSTS[k * 3 + 1]!, r = m.POSTS[k * 3 + 2]!, h = 1.6 + hash(k, seed) * 1.4, id = "tree" + k;
      d.add({ id, shape: "cyl", sides: 5, size: [r * 0.9, h * 0.45, r * 0.9], pos: [x, t.height(x, z) - 0.05, z], color: p.trunk, pick: false });
      d.add({ id: id + "c", shape: "cyl", sides: 6, top: 0, size: [r * 5, h * 0.7, r * 5], pos: [0, 0, 0], on: id, color: p.leaf, pick: false });
      d.add({ shape: "cyl", sides: 6, top: 0, size: [r * 2.2, h * 0.32, r * 2.2], pos: [0, -h * 0.3, 0], on: id + "c", color: p.leafTop, emissive: p.night, pick: false });
    }
    // The logs across the trail, and rocks round the rock gardens.
    const L = featureStarts(m, [F_LOG, F_ROCKS]);
    for (let k = 0; k < L.length; k += 2) {
      if (L[k] === F_LOG) {
        at(m, L[k + 1]! + 0.6, 0, P3);
        d.add({ size: [0.34, 0.26, m.def.width + 1.2], pos: [P3[0]!, t.height(P3[0]!, P3[1]!) - 0.06, P3[1]!], rot: [0, P3[2]!, 0], color: p.trunk, pick: false });
      } else
        for (let q = 0; q < 6; q++) {
          at(m, L[k + 1]! + q * 1.3, (half + 0.4 + hash(q, seed) * 0.8) * (q & 1 ? 1 : -1), P3);
          const s = 0.28 + hash(q + k, seed + 2) * 0.3;
          d.add({ shape: "cyl", sides: 5, top: 0.5, size: [s * 1.4, s, s * 1.2], pos: [P3[0]!, t.height(P3[0]!, P3[1]!) - 0.05, P3[1]!], color: p.rock, pick: false });
        }
    }
    return;
  }
  // Night Park: light towers, pylons, the wall ride's wall, lit lips, the cars in the lot.
  towers(d, t, m, p);
  pylons(d, t, m, p, 18, 1.2, P3);
  {
    // The wall: panels round the outside of the banked corner, a neon band along the top.
    const c = m.def.banks[0]!, s0 = 2 * m.VS[c]! - m.CS[c]! - 1, s1 = m.CS[c]! + 1;
    for (let s = s0, k = 0; s <= s1; s += 1.6, k++) {
      at(m, s, -(half + 1.5), P3);
      const id = "wall" + k, y = t.height(P3[0]!, P3[1]!) - 0.2;
      d.add({ id, size: [1.7, 2.4, 0.3], pos: [P3[0]!, y, P3[1]!], rot: [0, P3[2]!, 0], color: p.wall, pick: false });
      d.add({ size: [1.72, 0.14, 0.32], pos: [0, -0.3, 0], on: id, color: k & 1 ? p.edge : p.edge2, emissive: true, pick: false });
    }
  }
  const J = featureStarts(m, [F_DOUBLE, F_STEP, F_GAP, F_KICKER]);
  for (let k = 0; k < J.length; k += 2) {
    // A lit strip across each lip.
    const lip = J[k] === F_DOUBLE ? 1.75 : J[k] === F_STEP ? 9.1 : 3.1;
    at(m, J[k + 1]! + lip, 0, P3);
    d.add({ size: [0.12, 0.06, m.def.width + 0.2], pos: [P3[0]!, t.height(P3[0]!, P3[1]!) + 0.02, P3[1]!], rot: [0, P3[2]!, 0], color: p.edge2, emissive: true, pick: false, layer: 6 });
  }
  {
    // Cars parked in the lot either side of the gap, tail lights on.
    const [x0, z0, x1, z1] = LOT as [number, number, number, number];
    for (let k = 0; k < 6; k++) {
      const x = x0 + 1.6 + (k % 3) * 1.1 + (k >= 3 ? x1 - x0 - 5.4 : 0), z = z0 + 1.2 + (k % 2) * 3.2, id = "car" + k;
      m.near(x, z);
      if (m.NR[0]! < half + 0.8) continue;
      d.add({ id, size: [0.8, 0.36, 1.7], pos: [x, LOT_Y, z], color: p.car, pick: false });
      d.add({ size: [0.7, 0.28, 0.9], pos: [0, 0, -0.1], on: id, color: p.wall, pick: false });
      d.add({ size: [0.82, 0.08, 0.06], pos: [0, -0.16, 0.84], on: id, color: p.hot, emissive: true, pick: false });
    }
  }
}
