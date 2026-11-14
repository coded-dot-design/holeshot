// Free Ride's open maps, headless (the "map object" of docs/ARCHITECTURE.md, "Add a map"): a map is
// its own ground (a builder over @fzlt/core/terrain: dunes, a terraced pit, wooded hills, a park),
// a ride line carved into it (a closed loop of control points: the line the autopilot and the ghost
// ride, the trail a rider can follow, and where a rider is put back after a crash), features
// stamped along that line (kickers, tables, a gap, a step-down, roots, logs, rocks), banks (berms and
// a wall ride), posts a rider can hit (trees) and spawn points. `makeMap(def)` turns the data into
// what `freeRun` (./session.ts) rides: the same names a race Track has for the line (TRACK, YAW, NT,
// WANT, near, prof), plus `course()` (the terrain, pure: the same every time), `SPAWN` and `POSTS`.
// The scenery and the colours live with the scene (./scenery.ts); nothing here touches the DOM.
import { terrain, type Terrain } from "@fzlt/core/terrain";

export const MAP_CELL = 0.5, DS = 0.5;
/** Painted kinds (the race's: terrainView colours kind 1 the trail, kind 2 a feature's faces). */
export const KIND_TRAIL = 1, KIND_FACE = 2, KIND_LOT = 3;
/** Night Park's lot (under the gap): [x0, z0, x1, z1], its height. */
export const LOT = [-27, -4.5, -15, 1.5], LOT_Y = 0;
/** Features along the line. */
export const F_DOUBLE = 1, F_TABLE = 2, F_KICKER = 3, F_GAP = 4, F_WHOOPS = 5, F_ROOTS = 6, F_LOG = 7, F_ROCKS = 8, F_STEP = 9, F_ROLLERS = 10;
/** Each feature's length along the line, the speed the line wants into it, its name (the HUD). */
export const FEATURE_LEN = [0, 7.1, 8, 12.6, 12.6, 9.5, 5.6, 1.2, 7.2, 18.1, 10];
const SPEED = [0, 10.8, 10.6, 12.8, 13, 12, 8.5, 7.5, 7, 10.8, 11];
export const FEATURE_NAMES = ["", "DOUBLE", "TABLETOP", "KICKER", "THE GAP", "WHOOPS", "ROOTS", "LOG", "ROCK GARDEN", "STEP-DOWN", "RIDGELINE"];

/** A map as data. */
export interface RideMapDef {
  id: string;
  name: string;
  /** A line for the map picker. */
  blurb: string;
  cols: number;
  rows: number;
  seed: number;
  /** The ride line: a closed polygon of control points [x, z, y, …], its corners rounded to
   *  `radius` (or `radii[k]`); y is the line's floor height there (with `follow`, ignored: the floor
   *  follows the ground, smoothed). A drop of more than 0.45 between two close points stays a ledge
   *  (the floor is smoothed everywhere else). */
  line: number[];
  radius: number;
  radii?: number[];
  follow: boolean;
  /** The line's width; `trail` paints it (else it is open ground: only the features are painted). */
  width: number;
  trail: boolean;
  /** Features: [kind, control point, offset into the straight after it, …]. */
  features: number[];
  /** Banks round corners: [first corner, last corner, height, side (1 the right of the way)], …. */
  banks: number[];
  /** The ground before the line is carved into it. */
  ground(t: Terrain, HX: number, HZ: number): void;
  /** Spawn points: the straights after these corners (the first is the start). */
  spawns: number[];
  /** The line's top speed (open stretches). */
  vmax: number;
  /** Posts a rider can hit (trees), scattered off the line: [count, nearest to the line, farthest, radius]. */
  posts?: [number, number, number, number];
}

const sm = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** Seeded value noise in 0..1 on a lattice (the posts' scatter, the rocks). */
const hash = (i: number, s: number) => {
  let h = Math.imul(i ^ s, 0x2c1b3c6d) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 15), 0x297a2d39);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

/** A map from its data: the line, the features, the speeds, the terrain. Pure. */
export function makeMap(def: RideMapDef) {
  const COLS = def.cols, ROWS = def.rows, HX = (COLS * MAP_CELL) / 2, HZ = (ROWS * MAP_CELL) / 2;
  const C = def.line, NC = C.length / 3;
  // ---- the line: the control points' polygon with its corners rounded (radius `radius`), resampled every DS ----
  // Straights stay straight (the features sit on them); each corner is an arc. CS[k] is where the
  // straight after corner k starts (features and spawns count from it); VS[k] the corner's middle,
  // where the floor has corner k's height (linear between).
  const FX: number[] = [], FZ: number[] = [], FS: number[] = [], CS = new Float64Array(NC), VS = new Float64Array(NC);
  {
    const T = new Float64Array(NC * 9); // per corner: T1 x z, T2 x z, centre x z, r, start angle, sweep
    for (let k = 0; k < NC; k++) {
      const a = ((k - 1 + NC) % NC) * 3, p = k * 3, b = ((k + 1) % NC) * 3;
      const lu = Math.hypot(C[p]! - C[a]!, C[p + 1]! - C[a + 1]!), lv = Math.hypot(C[b]! - C[p]!, C[b + 1]! - C[p + 1]!);
      const ux = (C[p]! - C[a]!) / lu, uz = (C[p + 1]! - C[a + 1]!) / lu, vx = (C[b]! - C[p]!) / lv, vz = (C[b + 1]! - C[p + 1]!) / lv;
      const cr = ux * vz - uz * vx, th = Math.atan2(Math.abs(cr), ux * vx + uz * vz), o = k * 9;
      let tl = th > 1e-3 ? (def.radii?.[k] ?? def.radius) * Math.tan(th / 2) : 0;
      tl = Math.min(tl, 0.45 * Math.min(lu, lv));
      const r = th > 1e-3 ? tl / Math.tan(th / 2) : 0, sg = cr >= 0 ? 1 : -1;
      T[o] = C[p]! - ux * tl, T[o + 1] = C[p + 1]! - uz * tl, T[o + 2] = C[p]! + vx * tl, T[o + 3] = C[p + 1]! + vz * tl;
      T[o + 4] = T[o]! - uz * sg * r, T[o + 5] = T[o + 1]! + ux * sg * r, T[o + 6] = r;
      T[o + 7] = Math.atan2(T[o + 1]! - T[o + 5]!, T[o]! - T[o + 4]!), T[o + 8] = sg * th;
    }
    let s = 0, px = T[2]!, pz = T[3]!;
    const put = (x: number, z: number) => (s += Math.hypot(x - px, z - pz), FX.push(x), FZ.push(z), FS.push(s), (px = x), (pz = z));
    put(px, pz);
    for (let k = 0; k < NC; k++) {
      const o = k * 9, q = ((k + 1) % NC) * 9;
      // The straight from corner k to corner k + 1, then corner k + 1's arc.
      const x0 = T[o + 2]!, z0 = T[o + 3]!, x1 = T[q]!, z1 = T[q + 1]!, n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.05));
      for (let j = 1; j <= n; j++) put(x0 + ((x1 - x0) * j) / n, z0 + ((z1 - z0) * j) / n);
      const r = T[q + 6]!, sw = T[q + 8]!, m = Math.max(1, Math.ceil((Math.abs(sw) * r) / 0.05)), k1 = (k + 1) % NC;
      const sMid = s + (Math.abs(sw) * r) / 2;
      for (let j = 1; j <= m && r > 0; j++) {
        const an = T[q + 7]! + (sw * j) / m;
        put(T[q + 4]! + Math.cos(an) * r, T[q + 5]! + Math.sin(an) * r);
      }
      VS[k1] = sMid;
      if (k1) CS[k1] = s;
    }
    VS[0] = VS[0]! - s;
  }
  const LAP = FS[FS.length - 1]!, NT = Math.round(LAP / DS);
  const TRACK = new Float64Array(NT * 2), YAW = new Float64Array(NT), RAW = new Float64Array(NT);
  {
    let j = 0;
    for (let i = 0; i < NT; i++) {
      const s = (i * LAP) / NT;
      while (FS[j + 1]! < s) j++;
      const f = (s - FS[j]!) / (FS[j + 1]! - FS[j]! || 1);
      TRACK[i * 2] = FX[j]! + (FX[j + 1]! - FX[j]!) * f;
      TRACK[i * 2 + 1] = FZ[j]! + (FZ[j + 1]! - FZ[j]!) * f;
      // The floor: linear between the corners' heights (at their middles).
      let k = NC - 1;
      while (k > 0 && VS[k]! > s) k--;
      const k1 = (k + 1) % NC, s0 = VS[k]!, s1 = k1 ? VS[k1]! : VS[0]! + LAP;
      RAW[i] = C[k * 3 + 2]! + ((C[k1 * 3 + 2]! - C[k * 3 + 2]!) * (s - s0)) / (s1 - s0 || 1);
    }
    for (let i = 0; i < NT; i++) {
      const a = ((i - 1 + NT) % NT) * 2, b = ((i + 1) % NT) * 2;
      YAW[i] = Math.atan2(-(TRACK[b + 1]! - TRACK[a + 1]!), TRACK[b]! - TRACK[a]!);
    }
  }
  const sAt = (i: number) => (i * LAP) / NT;
  const wrapS = (s: number) => ((s % LAP) + LAP) % LAP;
  /** The features: [kind, start s, …]. */
  const FEATURES: number[] = [];
  for (let k = 0; k < def.features.length; k += 3) FEATURES.push(def.features[k]!, wrapS(CS[def.features[k + 1]!]! + def.features[k + 2]!));
  const SPAWN = new Float64Array(def.spawns.length * 3);
  def.spawns.forEach((c, k) => {
    const i = Math.round(CS[c]! / (LAP / NT)) % NT;
    SPAWN[k * 3] = TRACK[i * 2]!, SPAWN[k * 3 + 1] = TRACK[i * 2 + 1]!, SPAWN[k * 3 + 2] = YAW[i]!;
  });

  // ---- the profile: the features' heights over the line's floor, by distance along it ----
  const FK = new Int32Array(1), PF = new Float64Array(1);
  function jump(d: number, up: number, h: number, back: number, gap: number, lh: number, face: number, down: number) {
    if (d < up) return void (PF[0] = h * (d / up) ** 1.25);
    d -= up;
    if (d < back) return void (PF[0] = h * (1 - sm(d / back)));
    d -= back + gap;
    if (d < 0) return void (PF[0] = 0);
    if (d < face) return void (PF[0] = lh * sm(d / face));
    d -= face;
    return void (PF[0] = d < down ? lh * (1 - sm(d / down)) : 0);
  }
  function prof(s: number) {
    s = wrapS(s);
    FK[0] = 0;
    PF[0] = 0;
    for (let k = 0; k < FEATURES.length; k += 2) {
      const kind = FEATURES[k]!;
      let d = s - FEATURES[k + 1]!;
      if (d < 0) d += LAP;
      if (d > FEATURE_LEN[kind]!) continue;
      FK[0] = kind;
      if (kind === F_DOUBLE) return jump(d, 1.9, 0.85, 0.4, 0.8, 0.75, 0.8, 3.2);
      if (kind === F_TABLE) return void (PF[0] = d < 2.1 ? 0.95 * (d / 2.1) ** 1.2 : d < 5.3 ? 0.95 : 0.95 * (1 - sm((d - 5.3) / 2.7)));
      if (kind === F_KICKER || kind === F_GAP) {
        // Up a tall face; between it and the landing a saddle of sand (a kicker) or the sunken lot (the gap).
        const mid = kind === F_GAP ? -0.3 : 0.4;
        if (d < 3.2) return void (PF[0] = 1.45 * (d / 3.2) ** 1.25);
        if (d < 3.8) return void (PF[0] = 1.45 + (mid - 1.45) * sm((d - 3.2) / 0.6));
        // The landing's face is short of where the slowest rider comes down: past 10 u/s, it's the down ramp.
        if (d < 6.4) return void (PF[0] = mid + (kind === F_GAP ? 0 : 0.3 * Math.sin(((d - 3.8) / 2.6) * Math.PI)));
        if (d < 7.2) return void (PF[0] = mid + (1.4 - mid) * sm((d - 6.4) / 0.8));
        return void (PF[0] = 1.4 * (1 - sm((d - 7.2) / 5.4)));
      }
      if (kind === F_WHOOPS) return void (PF[0] = 0.25 * (0.5 - 0.5 * Math.cos((d / 1.9) * Math.PI * 2)));
      if (kind === F_ROOTS) return void (PF[0] = 0.09 * (0.5 - 0.5 * Math.cos((d / 0.7) * Math.PI * 2)));
      if (kind === F_LOG) return void (PF[0] = 0.28 * Math.sin((d / 1.2) * Math.PI));
      if (kind === F_ROCKS) return void (PF[0] = 0.15 * (0.5 - 0.5 * Math.cos((d / 0.9) * Math.PI * 2)) * (0.55 + 0.45 * Math.sin(d * 2.3 + 1)));
      if (kind === F_STEP) {
        // Up onto a deck, a kicker at its end, and the landing far below the lip.
        if (d < 5) return void (PF[0] = 1.6 * sm(d / 5) * 0.5 + 1.6 * (d / 5) * 0.5);
        if (d < 8) return void (PF[0] = 1.6);
        if (d < 9.2) return void (PF[0] = 1.6 + 0.45 * ((d - 8) / 1.2) ** 1.25);
        if (d < 9.6) return void (PF[0] = 2.05 * (1 - sm((d - 9.2) / 0.4)));
        return jump(d - 9.6, 0, 0, 0, 2.2, 0.9, 0.8, 5.5);
      }
      if (kind === F_ROLLERS) return void (PF[0] = 0.55 * (0.5 - 0.5 * Math.cos((d / 5) * Math.PI * 2)));
    }
  }
  function profile(s: number) {
    prof(s);
    return PF[0]!;
  }
  /** The line's surface at s (its floor and the feature there): what the autopilot lands to. */
  function heightAt(s: number) {
    prof(s);
    const u = wrapS(s) / DS, i = Math.floor(u), f = u - i;
    return FLOOR[i % NT]! + (FLOOR[(i + 1) % NT]! - FLOOR[i % NT]!) * f + PF[0]!;
  }

  /** The nearest point on the line to (x, z): NR = [distance, segment, t along it, signed side]. */
  const NR = new Float64Array(4);
  function near(x: number, z: number, from = -1, span = 0) {
    NR[0] = Infinity;
    const a0 = from < 0 ? 0 : from - span, a1 = from < 0 ? NT : from + span;
    for (let q = a0; q < a1; q++) {
      const s = ((q % NT) + NT) % NT, a = s * 2, b = ((s + 1) % NT) * 2, ax = TRACK[a]!, az = TRACK[a + 1]!, dx = TRACK[b]! - ax, dz = TRACK[b + 1]! - az, l2 = dx * dx + dz * dz || 1;
      const u = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2)), px = x - ax - dx * u, pz = z - az - dz * u, d = Math.sqrt(px * px + pz * pz);
      if (d < NR[0]!) (NR[0] = d), (NR[1] = s), (NR[2] = u), (NR[3] = dx * pz - dz * px >= 0 ? 1 : -1);
    }
  }

  /** The same, for the terrain's builders: only the segments in (x, z)'s bucket (NR[0] stays
   *  Infinity past the carve's reach). Buckets of BS units, each listing the segments within reach. */
  const BS = 2, BX = Math.ceil((2 * HX) / BS), BZ = Math.ceil((2 * HZ) / BS), REACH = def.width / 2 + 2.6;
  const BO = new Int32Array(BX * BZ + 1);
  let BL = new Int32Array(0);
  {
    const lists: number[][] = [...Array(BX * BZ)].map(() => []);
    for (let q = 0; q < NT; q++) {
      const a = q * 2, b = ((q + 1) % NT) * 2;
      const x0 = Math.min(TRACK[a]!, TRACK[b]!) - REACH, x1 = Math.max(TRACK[a]!, TRACK[b]!) + REACH, z0 = Math.min(TRACK[a + 1]!, TRACK[b + 1]!) - REACH, z1 = Math.max(TRACK[a + 1]!, TRACK[b + 1]!) + REACH;
      for (let j = Math.max(0, Math.floor((z0 + HZ) / BS)); j <= Math.min(BZ - 1, Math.floor((z1 + HZ) / BS)); j++)
        for (let i = Math.max(0, Math.floor((x0 + HX) / BS)); i <= Math.min(BX - 1, Math.floor((x1 + HX) / BS)); i++) lists[j * BX + i]!.push(q);
    }
    BL = new Int32Array(lists.reduce((n, l) => n + l.length, 0));
    let o = 0;
    lists.forEach((l, k) => ((BO[k] = o), BL.set(l, o), (o += l.length)));
    BO[BX * BZ] = o;
  }
  function nearBy(x: number, z: number) {
    NR[0] = Infinity;
    const i = Math.floor((x + HX) / BS), j = Math.floor((z + HZ) / BS);
    if (i < 0 || j < 0 || i >= BX || j >= BZ) return;
    for (let c = BO[j * BX + i]!, e = BO[j * BX + i + 1]!; c < e; c++) {
      const s = BL[c]!, a = s * 2, b = ((s + 1) % NT) * 2, ax = TRACK[a]!, az = TRACK[a + 1]!, dx = TRACK[b]! - ax, dz = TRACK[b + 1]! - az, l2 = dx * dx + dz * dz || 1;
      const u = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2)), px = x - ax - dx * u, pz = z - az - dz * u, d = Math.sqrt(px * px + pz * pz);
      if (d < NR[0]!) (NR[0] = d), (NR[1] = s), (NR[2] = u), (NR[3] = dx * pz - dz * px >= 0 ? 1 : -1);
    }
  }

  // ---- the speeds the line wants: the turns (by curvature), the features, braking ahead ----
  const WANT = new Float64Array(NT);
  {
    const V = new Float64Array(NT);
    for (let i = 0; i < NT; i++) {
      let dy = YAW[(i + 3) % NT]! - YAW[(i - 3 + NT) % NT]!;
      dy -= 2 * Math.PI * Math.floor(dy / (2 * Math.PI) + 0.5);
      const k = Math.abs(dy) / (6 * DS), r = k > 1e-4 ? 1 / k : 1e4;
      V[i] = Math.min(def.vmax, Math.sqrt(13 * r));
    }
    for (let k = 0; k < FEATURES.length; k += 2) {
      const kind = FEATURES[k]!, s0 = FEATURES[k + 1]!, v = SPEED[kind]!;
      for (let i = 0; i < NT; i++) {
        let d = sAt(i) - s0;
        d -= LAP * Math.floor(d / LAP + 0.5);
        if (d >= -7 && d <= FEATURE_LEN[kind]! * 0.6) V[i] = v;
      }
    }
    for (let i = 0; i < NT; i++) {
      let w = V[i]!;
      for (let a = 1; a <= 40; a++) w = Math.min(w, V[(i + a) % NT]! + a * 0.22);
      WANT[i] = w;
    }
  }

  // ---- posts (trees): a seeded scatter off the line ----
  const POSTS = new Float64Array((def.posts?.[0] ?? 0) * 3);
  let NP = 0;
  if (def.posts) {
    const [count, n0, n1, r] = def.posts;
    for (let q = 0; q < 4000 && NP < count; q++) {
      const x = (hash(q * 2, def.seed) * 2 - 1) * (HX - 1.6), z = (hash(q * 2 + 1, def.seed) * 2 - 1) * (HZ - 1.6);
      near(x, z);
      if (NR[0]! < n0 || NR[0]! > n1) continue;
      // Clear of the corners (a rider runs wide there).
      let ok = true;
      for (let k = 0; k < NC && ok; k++) ok = Math.hypot(C[k * 3]! - x, C[k * 3 + 1]! - z) > n0 + 2;
      for (let p = 0; p < NP && ok; p++) ok = Math.hypot(POSTS[p * 3]! - x, POSTS[p * 3 + 1]! - z) > 1.7;
      if (!ok) continue;
      POSTS[NP * 3] = x, POSTS[NP * 3 + 1] = z, POSTS[NP * 3 + 2] = r * (0.8 + hash(q, def.seed + 7) * 0.4);
      NP++;
    }
  }

  // ---- the terrain: the ground, the line carved into it, the banks, the paint ----
  /** The line's floor per point (before the features), set by course(). */
  const FLOOR = new Float64Array(NT);
  let built: Terrain | null = null;
  function course(): Terrain {
    const t = terrain({ cols: COLS, rows: ROWS, cell: MAP_CELL });
    def.ground(t, HX, HZ);
    // The floor: the ground under the line (smoothed), or the plan's heights (smoothed, ledges kept).
    const F2 = new Float64Array(NT);
    if (def.follow) for (let i = 0; i < NT; i++) RAW[i] = t.height(TRACK[i * 2]!, TRACK[i * 2 + 1]!);
    const W = def.follow ? 9 : 3;
    FLOOR.set(RAW);
    for (let pass = 0; pass < (def.follow ? 3 : 1); pass++) {
      for (let i = 0; i < NT; i++) {
        let sum = 0, n = 0;
        const c = FLOOR[i]!;
        for (let a = -W; a <= W; a++) {
          const v = FLOOR[(i + a + NT) % NT]!;
          if (!def.follow && Math.abs(v - c) > 0.45) continue;
          sum += v, n++;
        }
        F2[i] = sum / n;
      }
      FLOOR.set(F2);
    }
    // Flat floors under the features (a jump on a rolling floor lands where it was built to).
    for (let k = 0; k < FEATURES.length; k += 2) {
      const s0 = FEATURES[k + 1]! - 4, s1 = FEATURES[k + 1]! + FEATURE_LEN[FEATURES[k]!]! + 3;
      const i0 = Math.round(s0 / DS), i1 = Math.round(s1 / DS), y0 = FLOOR[((i0 % NT) + NT) % NT]!, y1 = FLOOR[i1 % NT]!;
      for (let i = i0; i <= i1; i++) FLOOR[((i % NT) + NT) % NT] = y0 + ((y1 - y0) * (i - i0)) / (i1 - i0);
    }
    const half = def.width / 2, edge = 1.8;

    t.shape((x, z, h) => {
      nearBy(x, z);
      const d = NR[0]!;
      if (d >= half + edge + 0.6) return h;
      const s = sAt(NR[1]! + NR[2]!), y = heightAt(s), u = d <= half + 0.3 ? 0 : (d - half - 0.3) / edge, w = 1 - sm(u);
      return h + (y - h) * w;
    });
    for (let k = 0; k < def.banks.length; k += 4) {
      const c0 = def.banks[k]!, c1 = def.banks[k + 1]!, i0 = (Math.round((2 * VS[c0]! - CS[c0]! - 2) / DS) + NT) % NT, i1 = Math.round((CS[c1]! + 2) / DS) % NT, n = ((i1 - i0 + NT) % NT) + 1, P = new Float64Array(n * 2);
      for (let j = 0; j < n; j++) {
        const q = ((i0 + j) % NT) * 2;
        P[j * 2] = TRACK[q]!;
        P[j * 2 + 1] = TRACK[q + 1]!;
      }
      t.berm(P, { width: def.width + 1.2, height: def.banks[k + 2]!, side: def.banks[k + 3]!, edge: 1.2 });
    }
    for (let j = 0; j < ROWS; j++)
      for (let i = 0; i < COLS * 2; i++) {
        const x = t.x0 + ((i >> 1) + (i & 1 ? 1 : 2) / 3) * MAP_CELL, z = t.z0 + (j + (i & 1 ? 2 : 1) / 3) * MAP_CELL;
        nearBy(x, z);
        if (NR[0]! > half) continue;
        const p = profile(sAt(NR[1]! + NR[2]!)), f = FK[0]!;
        if (f && p > 0.05 && f !== F_WHOOPS && f !== F_ROOTS && f !== F_ROCKS) t.kind[j * COLS * 2 + i] = KIND_FACE;
        else if (def.trail) t.kind[j * COLS * 2 + i] = KIND_TRAIL;
      }
    built = t;
    return t;
  }

  /** The line's two edges, [x, y, z] per point, left then right, just over the ground. */
  function trackEdges(t: Terrain) {
    const E = new Float64Array(NT * 6), half = def.width / 2 + 0.05;
    for (let i = 0; i < NT; i++) {
      const nx = Math.sin(YAW[i]!), nz = Math.cos(YAW[i]!);
      for (let k = 0; k < 2; k++) {
        const sd = k ? 1 : -1, x = TRACK[i * 2]! + nx * half * sd, z = TRACK[i * 2 + 1]! + nz * half * sd;
        E[k * NT * 3 + i * 3] = x; E[k * NT * 3 + i * 3 + 1] = t.height(x, z) + 0.04; E[k * NT * 3 + i * 3 + 2] = z;
      }
    }
    return E;
  }

  return {
    def, id: def.id, name: def.name, blurb: def.blurb, isMap: true as const, COLS, ROWS, HX, HZ, LAP, NT, TRACK, YAW, FLOOR, WANT, NR, FK, PF, FEATURES, FEATURE_NAMES, SPAWN, POSTS, CS, VS,
    get NP() { return NP; },
    get terrain() { return built ?? course(); },
    sAt, prof, profile, heightAt, near, course, trackEdges,
  };
}
export type RideMap = ReturnType<typeof makeMap>;

/** The plinth: the ground eases down to the table's edge. */
function plinth(t: Terrain, HX: number, HZ: number, to = 0, over = 2.6) {
  t.shape((x, z, h) => {
    const ex = Math.min(1, (HX - Math.abs(x)) / over), ez = Math.min(1, (HZ - Math.abs(z)) / over), e = sm(Math.max(0, Math.min(ex, ez)));
    return to + (h - to) * e;
  });
}

// ---- the maps ----

/** Dune Sea: open rolling dunes, sharp ridgelines across the wind, two big natural kickers. */
export const DUNE_SEA: RideMapDef = {
  id: "dune-sea", name: "DUNE SEA", blurb: "Open rolling dunes under a neon sun. Ridgelines, big natural kickers, nowhere you can't ride.",
  cols: 104, rows: 72, seed: 4417, follow: true, width: 3.6, trail: false, vmax: 13.5, radius: 6,
  line: [-20, -11, 0, 18, -11, 0, 21.5, 0, 0, 16, 11, 0, -13, 11, 0, -21.5, 4, 0],
  features: [F_KICKER, 0, 5, F_ROLLERS, 0, 17, F_KICKER, 3, 5],
  banks: [1, 3, 0.7, -1],
  spawns: [5, 2, 4],
  ground(t, HX, HZ) {
    t.noise({ seed: 4417, amp: 3.4, scale: 9, octaves: 3, ridge: 0.7, wind: [1, 0.25], stretch: 3 });
    plinth(t, HX, HZ, 0.1);
  },
};

/** Quarry: a terraced pit. A long drop-in from the rim, the pit floor, hill-climb faces up the
 *  benches, a ledge off the top bench and the climb back to the rim. */
const QR = (x: number, z: number) => Math.sqrt((x / 1.4) * (x / 1.4) + z * z);
export const QUARRY: RideMapDef = {
  id: "quarry", name: "THE QUARRY", blurb: "A terraced pit. Drop in from the rim, climb the faces, send it off the ledges.",
  cols: 104, rows: 72, seed: 9133, follow: false, width: 3.6, trail: true, vmax: 12, radius: 5,
  line: [
    -19, -15, 3.3, -8, -15, 3.3, 5, -2, 0, 3, 7, 0,
    -0.5, 9.5, 0, -5.5, 13, 2.2, -16, 12, 2.2,
    -17.5, 3, 2.2, -17.58, 2.5, 1.1, -18.1, 0.5, 1.1, -19, -7.5, 3.3,
  ],
  features: [],
  banks: [2, 2, 0.7, -1],
  spawns: [0, 3, 6],
  ground(t, HX, HZ) {
    // Benches stepping down to the pit floor, each riser a steep face; broken rock over it.
    t.shape((x, z) => {
      const r = QR(x, z), b = (lo: number, w: number) => sm((r - lo) / w);
      return 1.1 * b(6.5, 0.7) + 1.1 * b(9.5, 0.7) + 1.1 * b(12.5, 0.7) - 0.15;
    });
    t.noise({ seed: 9133, amp: 0.35, scale: 3, octaves: 2 });
    plinth(t, HX, HZ, 0.2, 1.6);
  },
};

/** Forest Enduro: a winding single track through neon trees, roots, logs and rock gardens. */
export const FOREST: RideMapDef = {
  id: "forest", name: "FOREST ENDURO", blurb: "A winding single track through the neon woods. Roots, logs, rock gardens: mind the trees.",
  cols: 104, rows: 72, seed: 5521, follow: true, width: 2.8, trail: true, vmax: 10.5, radius: 4,
  line: [-20, -13, 0, -8, -13.5, 0, -1, -8.5, 0, 7, -13.5, 0, 18, -12.5, 0, 20.5, -3, 0, 15, 1.5, 0, 19.5, 7.5, 0, 13.5, 12.5, 0, 4, 9.5, 0, -4, 13, 0, -12, 9, 0, -19.5, 10.5, 0, -21.5, 3, 0, -15.5, -1.5, 0, -21.5, -6.5, 0],
  features: [F_ROOTS, 0, 1.5, F_LOG, 1, 1.5, F_ROCKS, 3, 0, F_ROOTS, 4, 0, F_LOG, 8, 2.5, F_ROCKS, 9, 0, F_LOG, 10, 2, F_ROOTS, 11, 0, F_ROCKS, 12, 0],
  banks: [],
  spawns: [0, 5, 10],
  posts: [70, 3.6, 8, 0.32],
  ground(t, HX, HZ) {
    t.noise({ seed: 5521, amp: 1.7, scale: 8, octaves: 3, ridge: 0.1 });
    plinth(t, HX, HZ, 0.1);
  },
};

/** Night Park: a neon freeride park on a lot. A dirt jump line, a wall ride, a big step-down and the gap over the lot. */
export const NIGHT_PARK: RideMapDef = {
  id: "night-park", name: "NIGHT PARK", blurb: "A neon freeride park: a dirt jump line, the wall ride, a big step-down, the gap over the lot.",
  cols: 108, rows: 80, seed: 7781, follow: false, width: 3.6, trail: true, vmax: 13, radius: 5, radii: [5, 9, 6, 5, 5],
  line: [-22.5, -14.5, 0.3, 19, -14.5, 0.3, 23, -2, 0.3, 19, 14, 0.3, -22.5, 14, 0.3],
  features: [F_DOUBLE, 0, 3, F_DOUBLE, 0, 13, F_DOUBLE, 0, 23, F_STEP, 3, 7, F_GAP, 4, 5.5],
  banks: [2, 2, 1.3, -1],
  spawns: [0, 2, 3],
  ground(t, HX, HZ) {
    t.noise({ seed: 7781, amp: 0.5, scale: 7, octaves: 2 });
    plinth(t, HX, HZ, 0.1);
    // The lot: flat, paved, a step down from the park.
    const [x0, z0, x1, z1] = LOT as [number, number, number, number];
    t.shape((x, z, h) => {
      const e = Math.min(x - x0, x1 - x, z - z0, z1 - z);
      return e <= -1 ? h : h + (LOT_Y - h) * sm((e + 1) / 1);
    });
    for (let j = 0; j < t.rows; j++)
      for (let i = 0; i < t.cols * 2; i++) {
        const x = t.x0 + ((i >> 1) + 0.5) * t.cell, z = t.z0 + (j + 0.5) * t.cell;
        if (x > x0 && x < x1 && z > z0 && z < z1) t.kind[j * t.cols * 2 + i] = KIND_LOT;
      }
  },
};

/** Free Ride's maps after the loop (map 1 is the race loop, ../race/course.ts). */
export const RIDE_MAPS: RideMapDef[] = [DUNE_SEA, QUARRY, FOREST, NIGHT_PARK];
