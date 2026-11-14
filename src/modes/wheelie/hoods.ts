// Wheelie City's four neighbourhoods, as data (headless): each its own layout on the same footprint
// (98 × 28 units, local coordinates), side by side on the table in a 2 × 2 grid with canals between
// them, linked by jump ramps (humps) across the canals.
// - 0 THE BLOCK (north-west): the suburb strip of the gallery piece: two boulevards round four
//   blocks of houses with lawns, a corner store and the flats, the dog's yard, a speed bump and a kicker.
// - 1 HILLCREST (north-east): a hillside of cul-de-sacs: a winding street, four courts ending in
//   turning circles, a dead-end lane, houses perched on retaining walls and a ridge along the top.
// - 2 DOWNTOWN (south-west): a block grid of neon towers round an open plaza with a fountain and
//   planters, crosswalks at the corners, shops along the outer sidewalks.
// - 3 NEON MARINA (south-east): a beach road and a long boardwalk over the sand, beach houses and
//   shacks, palms, showers on the sand, the sea and the marina's berths.
// The houses, driveways, trees and lamps of hoods 1–3 are placed by rule along their streets
// (`frontage`, `scatter`): anything that would sit on a road, a turning circle, a terrace or another
// house is dropped, so a layout is a short list of streets. Every array is plain numbers, built once
// at load; world arrays (`W`) are the local ones moved to each hood's place. The street graph of
// each hood (nodes at the junctions and dead ends, all-pairs next hops) is what the patrols path on.

export const HX = 49, HZ = 14, GAP = 8, CURB = 0.12;
/** Hood centres on the table (world), in the order above. */
export const CX = [-(HX + GAP / 2), HX + GAP / 2, -(HX + GAP / 2), HX + GAP / 2];
export const CZ = [-(HZ + GAP / 2), -(HZ + GAP / 2), HZ + GAP / 2, HZ + GAP / 2];
export const NHOOD = 4;
export const HOOD_NAMES = ["THE BLOCK", "HILLCREST", "DOWNTOWN", "NEON MARINA"];
/** Ground kinds. */
export const K_ROAD = 0, K_WALK = 1, K_LAWN = 2, K_DRIVE = 3, K_WATER = 4, K_BOARD = 5, K_SAND = 6, K_PLAZA = 7;
/** Building looks: 0..3 houses, 4 the flats, 5 the corner store, 6 a tower, 7 a shop, 8 a beach shack. */
export const L_FLATS = 4, L_STORE = 5, L_TOWER = 6, L_SHOP = 7, L_SHACK = 8;
/** Hump ramps: the ramp runs RAMP up to the deck, the deck to the lip (lip is LIP in from the hood's
 *  edge), height HUMP_H; across the band ±HUMP_W. */
export const RAMP = 2.8, DECK = 0.6, LIP = 0.4, HUMP_H = 0.5, HUMP_W = 2;
/** The bank: the ground runs on this far past a hood's edge before the canal. */
export const BANK = 1, CANAL = -1.2;

/** One hood's layout, local coordinates (see the file comment). */
export interface Hood {
  id: string;
  name: string;
  /** Road rects [x0, z0, x1, z1] and turning circles [x, z, r]. */
  roads: number[];
  rings: number[];
  /** Driveways (rects), blocks (rects, their edges are sidewalks), surfaces [x0, z0, x1, z1, kind] (over the kind). */
  drives: number[];
  blocks: number[];
  surf: number[];
  /** Buildings: x, z, w, d, height, face (−1 faces north, +1 south), look, base (a terrace under it). */
  houses: number[];
  /** Who comes out to shout: indices into `houses`. */
  home: number[];
  /** Parked cars: x, z, yaw, look. Crosswalks (rects). Sprinklers: x, z, aim, phase. Trees, lamps: x, z. */
  cars: number[];
  cross: number[];
  sprink: number[];
  trees: number[];
  lamps: number[];
  /** Raised ground and water [x0, z0, x1, z1, height, kind] (0 a terrace wall, 1 water, 2 a planter): solid. */
  terr: number[];
  /** Round solids [x, z, r, kind] (0 the fountain, 1 a bollard). */
  posts: number[];
  /** Speed bumps [x, z0, z1, half width, height] (across a street along x) and kickers [x0, z0, x1, z1, height] (up along +z). */
  bumps: number[];
  kicks: number[];
  /** The autopilot's loop (x, z, …) and where it starts: x, z, yaw. */
  route: number[];
  start: number[];
  /** The street graph: nodes x, z, …; edges a, b, …. */
  nodes: number[];
  edges: number[];
}

// ---------------------------------------------------------------- 0: THE BLOCK (the gallery piece)
function theBlock(): Hood {
  const h: Hood = {
    id: "block", name: HOOD_NAMES[0]!,
    // Streets: north, south, west avenue, east avenue, two inner avenues, the cross street; the stubs
    // to the east hump (the south boulevard's end) and the south hump (the cross street on through).
    roads: [-47, -10.5, 47, -6.5, -47, 6.5, 47, 10.5, -47, -10.5, -43, 10.5, 43, -10.5, 47, 10.5, -17, -10.5, -13, 10.5, 13, -10.5, 17, 10.5, -2, -6.5, 2, 6.5,
      47, 6.5, 49, 10.5, -2, 10.5, 2, 14],
    rings: [],
    drives: [-8.9, -6.5, -7.6, -0.8, -4.4, -6.5, -3.1, -0.8, -8.9, 0.8, -7.6, 6.5, -4.4, 0.8, -3.1, 6.5, 6.1, 0.8, 7.4, 6.5, 10.6, 0.8, 11.9, 6.5],
    blocks: [-13, -6.5, -2, 6.5, 2, -6.5, 13, 6.5, -43, -6.5, -17, 6.5, 17, -6.5, 43, 6.5],
    surf: [],
    houses: [
      -10.5, -2.2, 3, 2.8, 1.9, -1, 0, 0,
      -6.0, -2.2, 3, 2.8, 1.9, -1, 1, 0,
      -10.5, 2.2, 3, 2.8, 1.9, 1, 2, 0,
      -6.0, 2.2, 3, 2.8, 1.9, 1, 3, 0,
      5.4, -2.3, 4.4, 3.4, 4.2, -1, 4, 0,
      10.1, -2.2, 3.6, 2.8, 2.3, -1, 5, 0,
      4.5, 2.2, 3, 2.8, 1.9, 1, 1, 0,
      9.0, 2.2, 3, 2.8, 1.9, 1, 0, 0,
    ],
    home: [],
    cars: [-10.6, -7.3, 0, 0, 7.6, -7.3, 0, 1, -10.6, 7.3, Math.PI, 2, 13.8, -1.5, Math.PI / 2, 3, -3.75, -4.4, Math.PI / 2, 1, -35.5, 7.3, Math.PI, 3, 30, -7.3, 0, 2, 43.8, 2.5, Math.PI / 2, 0, -24, -7.3, 0, 1, 11.25, 4.4, -Math.PI / 2, 2],
    cross: [-2, -5.9, 2, -4.7, 10.6, 6.5, 11.8, 10.5, -30.6, 6.5, -29.4, 10.5, 25.6, 6.5, 26.8, 10.5, -21.4, -10.5, -20.2, -6.5, 34.4, -10.5, 35.6, -6.5],
    sprink: [-10.5, -4.6, -Math.PI / 2, 0, -6.0, 4.6, Math.PI / 2, 2.1, 4.5, 4.6, Math.PI / 2, 4.2, -35.25, 4.6, Math.PI / 2, 1.3, 24.25, 4.6, Math.PI / 2, 3.3, 33.75, -4.6, -Math.PI / 2, 5.1, -21, -4.6, -Math.PI / 2, 2.6],
    // (The verge tree at (1, 12.4) made way for the south hump's stub: it moved to (5, 12.4).)
    trees: [-48.2, -12.4, -41, -12.4, -33, -12.4, -26, -12.4, -19, -12.4, -12, -12.4, -5, -12.4, 5, -12.4, 12, -12.4, 19, -12.4, 26, -12.4, 33, -12.4, 41, -12.4, 48.2, -12.4, -48.2, 12.4, -40, 12.4, -30, 12.4, -21, 12.4, -9, 12.4, 5, 12.4, 9, 12.4, 21, 12.4, 30, 12.4, 40, 12.4, -48.4, -4, -48.4, 4, 48.4, -4, 48.4, 4, -8.3, 0, -3.5, 0.2, 3.3, 0.1, 11.6, 0, -37.5, 0, -27.5, 0.1, -22, 0, 22.5, 0, 28, 0.1, 37.5, 0],
    lamps: [-47.6, -11.2, 47.6, -11.2, -47.6, 11.2, 47.6, 11.2, -32, -11.2, 32, 11.2, -17.6, -11.2, 17.6, 11.2, -2.5, -6.0, 2.5, 6.0, -12.5, -6.0, 12.5, 6.0, -25, 11.2, 25, -11.2, -38, 11.2, 38, -11.2],
    terr: [],
    posts: [],
    bumps: [4, -10.5, -6.5, 0.45, 0.16],
    kicks: [-16.4, 0.8, -13.6, 2.2, 0.42],
    // The ring anticlockwise from above, east on the south street first ((0, −8.6) is on the way: the south hump's turn).
    route: [45.1, 8.6, 45.1, -8.6, 0, -8.6, -45, -8.6, -45, 8.6],
    start: [-9, 8.7, 0],
    nodes: [-45, -8.5, -15, -8.5, 0, -8.5, 15, -8.5, 45, -8.5, -45, 8.5, -15, 8.5, 0, 8.5, 15, 8.5, 45, 8.5],
    edges: [0, 1, 1, 2, 2, 3, 3, 4, 5, 6, 6, 7, 7, 8, 8, 9, 0, 5, 1, 6, 2, 7, 3, 8, 4, 9],
  };
  // The outer blocks: five houses a row facing each boulevard, a driveway beside each.
  for (const x0 of [-42, 18]) for (let k = 0; k < 5; k++) for (const f of [-1, 1]) {
    const x = x0 + 1.5 + k * 4.75;
    h.houses.push(x, f * 2.2, 3, 2.8, 1.9, f, (k * 2 + (f > 0 ? 1 : 0) + (x0 > 0 ? 1 : 0)) % 4, 0);
    h.drives.push(x + 1.6, f < 0 ? -6.5 : 0.8, x + 2.9, f < 0 ? -0.8 : 6.5);
  }
  // Someone is at home in the old town's houses, the flats and the store; on the outer blocks, every other house.
  const n = h.houses.length / 8;
  h.home = [0, 1, 2, 3, 6, 4, 5, ...Array.from({ length: n - 8 }, (_, k) => 8 + k).filter((i) => ((i - 8) >> 1) % 2 === 0)];
  return h;
}

// ---------------------------------------------------------------- the rules that fill a layout
const blank = (id: string, name: string): Hood => ({ id, name, roads: [], rings: [], drives: [], blocks: [], surf: [], houses: [], home: [], cars: [], cross: [], sprink: [], trees: [], lamps: [], terr: [], posts: [], bumps: [], kicks: [], route: [], start: [], nodes: [], edges: [] });
const hyp = (a: number, b: number) => Math.sqrt(a * a + b * b);
const over = (a0: number, b0: number, a1: number, b1: number, c0: number, d0: number, c1: number, d1: number) => a0 < c1 && a1 > c0 && b0 < d1 && b1 > d0;
/** Is the rect clear of roads and circles (by `m`), terraces, houses and round solids? */
function free(h: Hood, x0: number, z0: number, x1: number, z1: number, m = 0.4) {
  if (x0 < -HX + 0.3 || x1 > HX - 0.3 || z0 < -HZ + 0.3 || z1 > HZ - 0.3) return false;
  for (let o = 0; o < h.roads.length; o += 4) if (over(x0 - m, z0 - m, x1 + m, z1 + m, h.roads[o]!, h.roads[o + 1]!, h.roads[o + 2]!, h.roads[o + 3]!)) return false;
  for (let o = 0; o < h.rings.length; o += 3) {
    const cx = Math.max(x0, Math.min(x1, h.rings[o]!)), cz = Math.max(z0, Math.min(z1, h.rings[o + 1]!));
    if (hyp(cx - h.rings[o]!, cz - h.rings[o + 1]!) < h.rings[o + 2]! + m) return false;
  }
  for (let o = 0; o < h.terr.length; o += 6) if (over(x0, z0, x1, z1, h.terr[o]!, h.terr[o + 1]!, h.terr[o + 2]!, h.terr[o + 3]!)) return false;
  for (let o = 0; o < h.houses.length; o += 8) {
    const w = h.houses[o + 2]! / 2 + 0.3, d = h.houses[o + 3]! / 2 + 0.3;
    if (over(x0, z0, x1, z1, h.houses[o]! - w, h.houses[o + 1]! - d, h.houses[o]! + w, h.houses[o + 1]! + d)) return false;
  }
  for (let o = 0; o < h.drives.length; o += 4) if (over(x0, z0, x1, z1, h.drives[o]!, h.drives[o + 1]!, h.drives[o + 2]!, h.drives[o + 3]!)) return false;
  for (let o = 0; o < h.posts.length; o += 4) {
    const cx = Math.max(x0, Math.min(x1, h.posts[o]!)), cz = Math.max(z0, Math.min(z1, h.posts[o + 1]!));
    if (hyp(cx - h.posts[o]!, cz - h.posts[o + 1]!) < h.posts[o + 2]! + 0.2) return false;
  }
  return true;
}
interface Front { w: number; d: number; ht: (k: number) => number; looks: number[]; yard: number; step: number; drive?: boolean; base?: (z: number) => number; home?: number; sprink?: number }
/** Buildings along a street's edge at z = `edge` from x0 to x1, facing it (`face` −1: the street is
 *  north of them), each where it fits (with its driveway, when it has one). */
function frontage(h: Hood, x0: number, x1: number, edge: number, face: number, f: Front) {
  let k = 0;
  for (let x = x0 + f.w / 2; x + f.w / 2 <= x1; x += f.step) {
    const z = edge - face * (f.yard + f.d / 2), fz = z + (face * f.d) / 2;
    if (!free(h, x - f.w / 2, z - f.d / 2, x + f.w / 2, z + f.d / 2, 0.3)) continue;
    const dz0 = face < 0 ? edge : fz, dz1 = face < 0 ? fz : edge;
    if (f.drive && !free(h, x + f.w / 2 + 0.2, Math.min(dz0, dz1), x + f.w / 2 + 1.5, Math.max(dz0, dz1), -0.05)) continue;
    const i = h.houses.length / 8, look = f.looks[k % f.looks.length]!;
    h.houses.push(x, z, f.w, f.d, f.ht(k), face, look, f.base ? f.base(z) : 0);
    if (f.drive) h.drives.push(x + f.w / 2 + 0.2, Math.min(dz0, dz1), x + f.w / 2 + 1.5, Math.max(dz0, dz1));
    if (f.home && k % f.home === 0) h.home.push(i);
    if (f.sprink && k % f.sprink === 1 && f.yard > 1.6) h.sprink.push(x - 0.4, fz + face * Math.min(1.1, f.yard * 0.45), (-face * Math.PI) / 2, (k * 1.7) % 6.28);
    k++;
  }
}
/** Trees (or lamps) at the points of a row that are clear of everything by `m`. */
function scatter(h: Hood, into: number[], xs: number[], zs: number[], m: number, r = 0.3) {
  for (const z of zs) for (const x of xs) if (free(h, x - r, z - r, x + r, z + r, m)) into.push(x, z);
}
const range = (a: number, b: number, s: number) => Array.from({ length: Math.floor((b - a) / s) + 1 }, (_, k) => a + k * s);

// ---------------------------------------------------------------- 1: HILLCREST
function hillcrest(): Hood {
  const h = blank("hillcrest", HOOD_NAMES[1]!);
  h.roads.push(
    -47, 6.5, 47, 10.5, // the south street
    -49, 6.5, -47, 10.5, // the stub to the west hump
    43, -10.5, 47, 10.5, // the east avenue
    -2, -10.5, 47, -6.5, // the north lane
    -2, -10.5, 2, 10.5, -2, 10.5, 2, 14, // the middle avenue, on through to the south hump
    -47, -10.5, -43, 10.5, // the west avenue
    -47, -10.5, -24, -6.5, // the dead-end lane (its turning circle below)
    -33, -0.5, -29, 6.5, -14, -2.5, -10, 6.5, 12, -6.5, 16, 0.5, 28, -0.5, 32, 6.5, // four courts
  );
  h.rings.push(-24, -8.5, 3.2, -31, -0.5, 3, -12, -2.5, 3, 14, 0.5, 3, 30, -0.5, 3);
  h.blocks.push(-43, -6.5, -2, 6.5, 2, -6.5, 43, 6.5);
  // The ridge along the top (houses on it) and a raised garden west of the middle avenue.
  h.terr.push(-49, -14, 49, -11.1, 1.1, 0, -20.6, -10.6, -2.6, -6.2, 0.55, 0);
  // Houses perched on walls: the further up the hill, the higher.
  const base = (z: number) => (z < -11 ? 1.1 : 0.22 + ((HZ - z) / (2 * HZ)) * 0.5);
  const house = (yard: number, d = 2.6): Front => ({ w: 3, d, ht: (k) => 1.8 + (k % 3) * 0.2, looks: [0, 2, 1, 3, 2], yard, step: 4.6, drive: true, base, home: 2, sprink: 3 });
  frontage(h, -42.5, 42.5, 10.5, -1, house(0.5, 2.2)); // south of the south street (the downhill row)
  frontage(h, -42.5, -2.5, 6.5, 1, house(2.2)); // north of it, west
  frontage(h, 2.5, 42.5, 6.5, 1, house(2.2)); // north of it, east
  frontage(h, 2.5, 42.5, -6.5, -1, house(2.2)); // south of the north lane
  frontage(h, -42.5, -24, -6.5, -1, house(2.2)); // south of the dead-end lane
  for (let x = -40; x <= 42; x += 5.2) if (x < -3 || x > 3) h.houses.push(x, -12.5, 3, 2.2, 1.9, -1, (Math.round(x) & 3), 1.1); // up on the ridge (seen, not reached)
  scatter(h, h.trees, range(-46, 46, 3.1), [-4.2, 3.6, 12.6], 1.1);
  scatter(h, h.lamps, range(-44, 44, 11), [-5.9, 5.9, 11.1], 0.35, 0.12);
  h.cars.push(-38, 11.3, 0, 1, 22, 11.3, Math.PI, 2, 38.5, -5.6, 0, 0, -30.5, 3, Math.PI / 2, 3);
  h.cross.push(-2, 4.2, 2, 5.4, 4, 6.5, 5.2, 10.5);
  h.route.push(45.1, 8.6, 45.1, -8.6, 0, -8.6, 0, 8.6);
  h.start.push(-20, 8.6, 0);
  h.nodes.push(-45, 8.5, -31, 8.5, -12, 8.5, 0, 8.5, 30, 8.5, 45, 8.5, 45, -8.5, 14, -8.5, 0, -8.5, -45, -8.5, -24, -8.5, -31, -0.5, -12, -2.5, 14, 0.5, 30, -0.5);
  h.edges.push(0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 3, 0, 9, 9, 10, 1, 11, 2, 12, 7, 13, 4, 14);
  return h;
}

// ---------------------------------------------------------------- 2: DOWNTOWN
function downtown(): Hood {
  const h = blank("downtown", HOOD_NAMES[2]!);
  h.roads.push(
    -47, -10.5, 47, -6.5, -47, 6.5, 47, 10.5, // the north and south boulevards
    -47, -1.6, 2, 1.6, 21, -1.6, 47, 1.6, // the middle street (the plaza between)
    -47, -10.5, -43, 10.5, -25, -10.5, -21, 10.5, -2, -10.5, 2, 10.5, 21, -10.5, 25, 10.5, 43, -10.5, 47, 10.5, // avenues
    2, -6.5, 21, 6.5, // the plaza, paved level with the street
    -2, -14, 2, -10.5, 47, 6.5, 49, 10.5, // the stubs to the north and east humps
  );
  h.surf.push(2, -6.5, 21, 6.5, K_PLAZA);
  h.blocks.push(-43, -6.5, -25, -1.6, -43, 1.6, -25, 6.5, -21, -6.5, -2, -1.6, -21, 1.6, -2, 6.5, 25, -6.5, 43, -1.6, 25, 1.6, 43, 6.5);
  // The plaza: the fountain in the middle, four planters with a sprinkler each, bollards at its mouths.
  h.posts.push(11.5, 0, 1.7, 0);
  h.terr.push(3.6, -5.4, 6.2, -3.6, 0.35, 2, 16.8, -5.4, 19.4, -3.6, 0.35, 2, 3.6, 3.6, 6.2, 5.4, 0.35, 2, 16.8, 3.6, 19.4, 5.4, 0.35, 2);
  h.sprink.push(6.6, -4.5, 0, 0.4, 16.4, -4.5, Math.PI, 2.2, 6.6, 4.5, 0, 3.9, 16.4, 4.5, Math.PI, 5.3);
  // Towers on the blocks, facing the boulevards and the middle street; low shops along the outer sidewalks.
  const tower = (k0: number): Front => ({ w: 4.6, d: 3.1, ht: (k) => 4.4 + ((k + k0) * 7 % 5) * 1.1, looks: [L_TOWER], yard: 0.9, step: 6.2, home: 2 });
  frontage(h, -43, -25, -6.5, -1, tower(0)); frontage(h, -21, -2, -6.5, -1, tower(1)); frontage(h, 25, 43, -6.5, -1, tower(2));
  frontage(h, -43, -25, 6.5, 1, tower(3)); frontage(h, -21, -2, 6.5, 1, tower(4)); frontage(h, 25, 43, 6.5, 1, tower(0));
  const shop: Front = { w: 3.4, d: 2.2, ht: (k) => 1.7 + (k % 2) * 0.4, looks: [L_SHOP], yard: 0.9, step: 4.3, home: 2 };
  frontage(h, -46.5, 46.5, -10.5, 1, shop);
  frontage(h, -46.5, 46.5, 10.5, -1, shop);
  scatter(h, h.trees, range(-44, 44, 5.4), [-11.3, 11.3], 0.25, 0.25);
  scatter(h, h.lamps, range(-46, 46, 9.2), [-6, 6], 0.3, 0.12);
  scatter(h, h.lamps, [3, 20], [-7.1, 7.1], -1, 0.12);
  h.cars.push(-34, -7.3, 0, 2, 10, -7.3, 0, 2, -12, 7.3, Math.PI, 2, 34, 7.3, Math.PI, 1, 33, -0.85, 0, 2, -35, 0.85, Math.PI, 0);
  for (const x of [-23, 23]) for (const z of [-8.5, 8.5]) h.cross.push(x - 3.4, z - 2, x - 2.2, z + 2, x + 2.2, z - 2, x + 3.4, z + 2);
  h.cross.push(-2, -6.1, 2, -4.9);
  h.route.push(0, -8.6, 45.1, -8.6, 45.1, 8.6, 0, 8.6);
  h.start.push(20, 8.6, Math.PI);
  h.nodes.push(-45, -8.5, -23, -8.5, 0, -8.5, 23, -8.5, 45, -8.5, -45, 0, -23, 0, 0, 0, 23, 0, 45, 0, -45, 8.5, -23, 8.5, 0, 8.5, 23, 8.5, 45, 8.5);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) h.edges.push(r * 5 + c, r * 5 + c + 1);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) h.edges.push(r * 5 + c, r * 5 + c + 5);
  return h;
}

// ---------------------------------------------------------------- 3: NEON MARINA
function marina(): Hood {
  const h = blank("marina", HOOD_NAMES[3]!);
  h.roads.push(
    -47, -10.5, 47, -6.5, // the beach road
    -47, 6.5, 47, 10.5, // the boardwalk
    -47, 10.5, 47, 12.3, // the sand (level with the boardwalk; the sea past it)
    -47, -10.5, -43, 10.5, -2, -10.5, 2, 10.5, 43, -10.5, 47, 10.5, -24, -6.5, -20, 6.5, 20, -6.5, 24, 6.5, // avenues and lanes
    -49, 6.5, -47, 10.5, -2, -14, 2, -10.5, // the stubs to the west and north humps
  );
  h.surf.push(-47, 6.5, 47, 10.5, K_BOARD, -47, 10.5, 47, 12.3, K_SAND);
  h.blocks.push(-43, -6.5, -24, 6.5, -20, -6.5, -2, 6.5, 2, -6.5, 20, 6.5, 24, -6.5, 43, 6.5);
  // The sea along the south and the marina's berths along the north: water, solid.
  h.terr.push(-49, 12.3, 49, 14, 0, 1, -49, -14, -2.6, -11.3, 0, 1, 2.6, -14, 49, -11.3, 0, 1);
  // Beach houses on the beach road, shacks on the boardwalk.
  frontage(h, -42.5, 42.5, -6.5, -1, { w: 3, d: 2.6, ht: (k) => 1.8 + (k % 2) * 0.3, looks: [0, 3, 1, 2], yard: 2.3, step: 4.6, drive: true, home: 2, sprink: 3 });
  frontage(h, -42.5, 42.5, 6.5, 1, { w: 3.2, d: 2.2, ht: () => 1.6, looks: [L_SHACK], yard: 0.8, step: 4.4, home: 2 });
  // A lifeguard tower on the sand; showers on the sand (the sprinklers here), aimed up the beach.
  h.posts.push(-30, 11.5, 0.5, 1, 30, 11.5, 0.5, 1);
  h.sprink.push(-12, 11.6, Math.PI / 2, 0.8, 14, 11.6, Math.PI / 2, 3.1, 38, 11.6, Math.PI / 2, 4.6);
  for (let x = -44; x <= 44; x += 5.5) if ([0, 22, -22, 45, -45, 30, -30, -12, 14, 38].every((c) => Math.abs(x - c) > (Math.abs(c) === 30 || c === -12 || c === 14 || c === 38 ? 2 : 5))) h.trees.push(x, 12.05); // palms on the sand, clear of the lanes' mouths, the towers and the showers
  scatter(h, h.trees, range(-41, 41, 6.5), [0.2], 1, 0.3);
  scatter(h, h.lamps, range(-45, 45, 10), [-11, 6.2], 0.15, 0.12);
  h.cars.push(-32, -7.3, 0, 3, 8, -7.3, 0, 1, 36, -7.3, 0, 0);
  h.cross.push(-24, -10.5, -22.8, -6.5, 21.2, -10.5, 22.4, -6.5, -2, 4.6, 2, 5.8);
  h.route.push(-45.1, 8.6, -45.1, -8.6, 45.1, -8.6, 45.1, 8.6, 0, 8.6);
  h.start.push(20, 8.6, Math.PI);
  h.nodes.push(-45, -8.5, -22, -8.5, 0, -8.5, 22, -8.5, 45, -8.5, -45, 8.5, -22, 8.5, 0, 8.5, 22, 8.5, 45, 8.5);
  h.edges.push(0, 1, 1, 2, 2, 3, 3, 4, 5, 6, 6, 7, 7, 8, 8, 9, 0, 5, 1, 6, 2, 7, 3, 8, 4, 9);
  return h;
}

export const HOODS: Hood[] = [theBlock(), hillcrest(), downtown(), marina()];

/** The humps, world: lip x, z, outward direction x, z, hood. Partner of hump i is i ^ 1. */
export const HUMPS: number[] = [];
// [hood, local lip x, z, dir x, z]: 0 BLOCK east ↔ HILLCREST west; BLOCK south ↔ DOWNTOWN north;
// HILLCREST south ↔ MARINA north; DOWNTOWN east ↔ MARINA west.
const LIPS = [0, HX - LIP, 8.5, 1, 0, 1, -(HX - LIP), 8.5, -1, 0, 0, 0, HZ - LIP, 0, 1, 2, 0, -(HZ - LIP), 0, -1, 1, 0, HZ - LIP, 0, 1, 3, 0, -(HZ - LIP), 0, -1, 2, HX - LIP, 8.5, 1, 0, 3, -(HX - LIP), 8.5, -1, 0];
for (let o = 0; o < LIPS.length; o += 5) { const h = LIPS[o]!; HUMPS.push(CX[h]! + LIPS[o + 1]!, CZ[h]! + LIPS[o + 2]!, LIPS[o + 3]!, LIPS[o + 4]!, h); }
export const NHUMP = HUMPS.length / 5;
/** Per hump: where the autopilot rides on after landing there: the route waypoint it heads for, the
 *  direction it takes the loop (+1 as listed, −1 the other way round). */
export const ENTRY = [4, -1, 0, 1, 2, 1, 3, -1, 2, -1, 4, 1, 3, 1, 4, -1];
/** Per hump: the route waypoint at which an escaping autopilot turns for it, and the direction it
 *  must be riding the loop in (0: either). */
export const BRANCH = [0, 1, 3, -1, 2, 0, 0, 1, 3, 1, 4, 0, 2, -1, 0, 1];

/** Which hood a world point belongs to (the quadrant), and where it is in it. */
export const hoodAt = (x: number, z: number) => (z < 0 ? 0 : 2) + (x < 0 ? 0 : 1);

// ---------------------------------------------------------------- the street graphs (patrols)
/** Per hood: nodes (local), and all-pairs distance and next hop (n × n). */
export const GRAPH = HOODS.map((h) => {
  const n = h.nodes.length / 2, D = new Float64Array(n * n).fill(1e9), NX = new Int16Array(n * n).fill(-1);
  for (let i = 0; i < n; i++) (D[i * n + i] = 0), (NX[i * n + i] = i);
  for (let o = 0; o < h.edges.length; o += 2) {
    const a = h.edges[o]!, b = h.edges[o + 1]!, dx = h.nodes[a * 2]! - h.nodes[b * 2]!, dz = h.nodes[a * 2 + 1]! - h.nodes[b * 2 + 1]!, d = Math.sqrt(dx * dx + dz * dz);
    D[a * n + b] = D[b * n + a] = d;
    NX[a * n + b] = b; NX[b * n + a] = a;
  }
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = D[i * n + k]! + D[k * n + j]!;
    if (v < D[i * n + j]!) (D[i * n + j] = v), (NX[i * n + j] = NX[i * n + k]!);
  }
  return { n, nodes: Float64Array.from(h.nodes), edges: Int16Array.from(h.edges), D, NX };
});

// ---------------------------------------------------------------- world tables (the scene, the sim)
function world() {
  const W = { houses: [] as number[], hood: [] as number[], home: [] as number[], cars: [] as number[], cross: [] as number[], sprink: [] as number[], trees: [] as number[], treeHood: [] as number[], lamps: [] as number[], lampHood: [] as number[] };
  HOODS.forEach((h, k) => {
    const x = CX[k]!, z = CZ[k]!, h0 = W.houses.length / 8;
    for (let o = 0; o < h.houses.length; o += 8) W.houses.push(h.houses[o]! + x, h.houses[o + 1]! + z, ...h.houses.slice(o + 2, o + 8)), W.hood.push(k);
    for (const i of h.home) W.home.push(h0 + i);
    for (let o = 0; o < h.cars.length; o += 4) W.cars.push(h.cars[o]! + x, h.cars[o + 1]! + z, h.cars[o + 2]!, h.cars[o + 3]!);
    for (let o = 0; o < h.cross.length; o += 4) W.cross.push(h.cross[o]! + x, h.cross[o + 1]! + z, h.cross[o + 2]! + x, h.cross[o + 3]! + z);
    for (let o = 0; o < h.sprink.length; o += 4) W.sprink.push(h.sprink[o]! + x, h.sprink[o + 1]! + z, h.sprink[o + 2]!, h.sprink[o + 3]!);
    for (let o = 0; o < h.trees.length; o += 2) W.trees.push(h.trees[o]! + x, h.trees[o + 1]! + z), W.treeHood.push(k);
    for (let o = 0; o < h.lamps.length; o += 2) W.lamps.push(h.lamps[o]! + x, h.lamps[o + 1]! + z), W.lampHood.push(k);
  });
  return W;
}
export const W = world();
