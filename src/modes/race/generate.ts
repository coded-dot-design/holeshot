// The track generator: a seed and a difficulty (0..1) → a TrackPlan that makeTrack (./course.ts)
// builds like any other, and that has been ridden before anyone races it. Headless and pure.
//
// A draft is a loop of turns and straights: lefts and rights of varied angles and radii (sweepers,
// 90s, tight hairpins, S-bends: a right straight into a left), each turn bermed on its outside, the
// last turn's angle closing the heading to 360°. The straights' lengths are then nudged (the least
// change, in proportion to each) until the loop closes on itself, the whole thing is centred, and a
// table is sized round it. The features go onto the straights with room to run in and roll out: the
// start gate on the first, a rhythm section (doubles in a row) or the whoops, a double or a triple, a
// tabletop, a step-up or a step-down, more of them as the difficulty grows, and the finish jump on
// the last straight before the line. Difficulty also brings more turns, tighter radii, more rights,
// hairpins and shorter run-ins.
//
// validate() is the gate every track passes: the loop closes, no stretch of track comes near another
// (no self-overlap), it fits its table with a margin, every feature sits on a straight with room
// round it, and a race on the autopilot finishes clean: the reference bike (the 2-stroke starter)
// rides three laps without a crash while the other three starter classes ride it too. A draft that
// fails any of it is thrown away and the next seed tries (generateTrack), so a seed always gives a
// rideable track, the same one every time.
import { CELL, DONE, F_DOUBLE, F_FINISH, F_STEPDOWN, F_STEPUP, F_TABLE, F_TRIPLE, F_WHOOPS, FEATURE_LEN, LAPS, TRACK_W, makeTrack, motoRace, secLen, secTurn, type Section, type TrackPlan, type Turn } from "./course.ts";
import { STARTERS } from "../../data/roster.ts";
import { tune, type Tuned } from "../../model/tune.ts";
import { newBike } from "../../model/profile.ts";
import { atan2, cos, hypot, sin, tan } from "../../math.ts";

/** Limits: the table's largest size (cells), the margin round the track, the spacing between stretches. */
export const GEN = { maxCols: 140, maxRows: 100, minCols: 84, minRows: 58, margin: 4.6, sep: 7, tries: 400 };

const PI = Math.PI, DEG = PI / 180;
/** A small seeded generator (the same numbers in every browser: integer maths). */
function rng(seed: number) {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length) % xs.length]!;
const between = (r: () => number, a: number, b: number) => a + (b - a) * r();
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const ADJ = ["NEON", "VOLT", "CHROME", "STATIC", "GRID", "PULSE", "SODIUM", "HALO", "ION", "LASER", "VECTOR", "ARC", "CIRCUIT", "PIXEL", "SYNTH", "PLASMA"];
const NOUN = ["GULLY", "RIDGE", "BASIN", "QUARRY", "FLATS", "HOLLOW", "MESA", "CANYON", "BOWL", "SPUR", "DUNES", "PIT", "HEIGHTS", "WASH", "SWITCHBACK", "CRATER"];

/** Run-in (from the end of the turn before) and roll-out a feature wants, by kind. */
const RUN_IN = [0, 5, 3, 6.5, 4, 5, 4, 7];
/** The flat between the doubles of a rhythm section (closer and the autopilot lands on the next face). */
const RHYTHM = 5;
const ROLL_OUT = 3.2;

/** A draft from one seed (null when its shape doesn't work out). Not yet validated. */
export function draft(seed: number, difficulty: number): TrackPlan | null {
  const d = clamp01(difficulty), r = rng(seed);
  // ---- the shape: corners round an ellipse; hairpins (a spike of two parallel legs out to a tight
  // U, the legs' feet turning right back onto the loop) and dents (a corner pulled inside its
  // neighbours' line: a right between two lefts, an S) ----
  const n0 = 4 + Math.floor(r() * 1.5 + d * 0.8), RX = between(r, 20, 23.5), RZ = between(r, 12.5, 15);
  /** kind: 0 a corner, 1 a hairpin's tip, 2 a hairpin's foot (its neighbour), 3 a dent. */
  type V = { a: number; rho: number; kind: 0 | 1 | 2 | 3 };
  const vs: V[] = [];
  for (let k = 0; k < n0; k++) vs.push({ a: ((k + (r() - 0.5) * 0.45) / n0) * 2 * PI, rho: between(r, 0.9, 1.1), kind: 0 });
  const hairs = n0 >= 5 && r() < 0.1 + 0.6 * d ? (n0 >= 7 && r() < 0.35 * d ? 2 : 1) : 0;
  for (let h = 0, k = Math.floor(r() * n0); h < hairs; h++, k = (k + Math.floor(n0 / 2)) % n0) {
    const a = (k + n0 - 1) % n0, b = (k + 1) % n0;
    if (vs[k]!.kind || vs[a]!.kind || vs[b]!.kind) continue;
    vs[k]!.kind = 1;
    vs[a]!.kind = vs[b]!.kind = 2;
  }
  for (let k = 0; k < n0; k++) if (!vs[k]!.kind && !vs[(k + 1) % n0]!.kind && !vs[(k + n0 - 1) % n0]!.kind && r() < 0.06 + 0.3 * d) vs[k]!.kind = 3;
  const rh = between(r, 3.7, 4.3 - 0.3 * d), link = between(r, 2.4, 3.6), leg = between(r, 9, 13), pull = between(r, 0.55, 0.78);
  const radius = (deg: number) => (deg <= 45 ? between(r, 7, 9.5) : deg <= 100 ? between(r, 5 - 0.5 * d, 6.6 - 0.8 * d) : between(r, 4.4 - 0.3 * d, 5.2 - 0.4 * d));
  const radii = Array.from({ length: n0 * 2 }, () => r());

  for (let grow = 0; grow < 8; grow++) {
    const sc = 1 + grow * 0.08;
    // The corners: first every vertex on the ellipse, then the hairpins' spikes and the dents.
    const at = vs.map((v) => [RX * sc * v.rho * cos(v.a), RZ * sc * v.rho * sin(v.a)] as [number, number]);
    const P: number[] = [], tip: boolean[] = [];
    vs.forEach((v, k) => {
      const [x, z] = at[k]!;
      if (v.kind === 1) {
        // The tip pair across the U; the feet (the neighbours, kind 2) are set here too, a leg back.
        const l = hypot(x, z), ex = x / l, ez = z / l, px = ez, pz = -ex, w = rh + link / 2, L = leg * Math.min(1.25, sc);
        at[(k + n0 - 1) % n0] = [x - ex * L + px * w, z - ez * L + pz * w];
        at[(k + 1) % n0] = [x - ex * L - px * w, z - ez * L - pz * w];
      }
    });
    vs.forEach((v, k) => {
      if (v.kind !== 3) return;
      const [ax, az] = at[(k + n0 - 1) % n0]!, [bx, bz] = at[(k + 1) % n0]!;
      at[k] = [((ax + bx) / 2) * pull, ((az + bz) / 2) * pull];
    });
    vs.forEach((v, k) => {
      const [x, z] = at[k]!;
      if (v.kind === 1) {
        const l = hypot(x, z), ex = x / l, ez = z / l, px = ez, pz = -ex, w = rh + link / 2;
        P.push(x + px * w, z + pz * w, x - px * w, z - pz * w), tip.push(true, true);
      } else P.push(x, z), tip.push(false);
    });
    // A corner that hardly turns is no corner: drop it (the straights either side join).
    for (let again = true; again && P.length > 8; ) {
      again = false;
      const m2 = P.length / 2;
      for (let i = 0; i < m2; i++) {
        const a = (i + m2 - 1) % m2, b = (i + 1) % m2;
        const h1 = atan2(-(P[i * 2 + 1]! - P[a * 2 + 1]!), P[i * 2]! - P[a * 2]!), h2 = atan2(-(P[b * 2 + 1]! - P[i * 2 + 1]!), P[b * 2]! - P[i * 2]!);
        let t = h2 - h1;
        t -= 2 * PI * Math.floor(t / (2 * PI) + 0.5);
        if (Math.abs(t) < 16 * DEG && !tip[i]) {
          P.splice(i * 2, 2), tip.splice(i, 1);
          again = true;
          break;
        }
      }
    }
    let n = P.length / 2;
    // Headings of each edge (i → i+1) and the turn at each corner (+ left).
    const head = (i: number) => atan2(-(P[((i + 1) % n) * 2 + 1]! - P[i * 2 + 1]!), P[((i + 1) % n) * 2]! - P[i * 2]!);
    const wrap = (a: number) => a - 2 * PI * Math.floor(a / (2 * PI) + 0.5);
    let th = [...Array(n).keys()].map((i) => wrap(head(i) - head((i + n - 1) % n)));
    let total = th.reduce((a, b) => a + b, 0);
    if (Math.abs(Math.abs(total) - 2 * PI) > 1e-6) return null; // it crosses itself
    if (total < 0) {
      // Round the other way: the same corners, reversed (the loop runs counter-clockwise, net left).
      const Q: number[] = [];
      for (let i = n - 1; i >= 0; i--) Q.push(P[i * 2]!, P[i * 2 + 1]!);
      P.splice(0, P.length, ...Q);
      tip.reverse();
      th = [...Array(n).keys()].map((i) => wrap(head(i) - head((i + n - 1) % n)));
      total = th.reduce((a, b) => a + b, 0);
    }
    if (th.some((a) => Math.abs(a) > 150 * DEG)) return null;
    // Each corner's arc: its radius and how far it reaches along both edges.
    const R = th.map((a, i) => (tip[i] ? rh : radius(Math.abs(a) / DEG) * (0.97 + radii[i % radii.length]! * 0.06)));
    const T = th.map((a, i) => R[i]! * tan(Math.abs(a) / 2));
    const E = [...Array(n).keys()].map((i) => hypot(P[((i + 1) % n) * 2]! - P[i * 2]!, P[((i + 1) % n) * 2 + 1]! - P[i * 2 + 1]!) - T[i]! - T[(i + 1) % n]!);
    // A link: the short straight across a hairpin's tip, or between a right and a left (an S); no features on it.
    const isLink = E.map((e, i) => (tip[i] && tip[(i + 1) % n]) || (e < 8 && th[i]! * th[(i + 1) % n]! < 0));
    if (E.some((e, i) => e < (isLink[i] ? 1.8 : 4))) continue;
    // The start: the longest straight with room for the finish jump on the one before it; the plan runs from there round.
    let k0 = -1;
    for (let i = 0; i < n; i++) {
      const b = (i + n - 1) % n;
      if (!isLink[i] && E[i]! >= 14 && !isLink[b] && E[b]! >= RUN_IN[F_FINISH]! + FEATURE_LEN[F_FINISH]! + ROLL_OUT && (k0 < 0 || E[i]! > E[k0]!)) k0 = i;
    }
    if (k0 < 0) continue;
    const plan: Section[] = [], L: number[] = [], links: boolean[] = [];
    for (let q = 0; q < n; q++) {
      const i = (k0 + q) % n, j = (i + 1) % n, a = th[j]!;
      plan.push(Math.round(E[i]! * 1e4) / 1e4, { turn: a, r: Math.round(R[j]! * 1e3) / 1e3, berm: Math.abs(a) > 100 * DEG ? 1 : Math.abs(a) > 50 * DEG ? 0.8 : 0.6 });
      L.push(plan[plan.length - 2] as number), links.push(isLink[i]!);
    }
    // The turns sum to exactly one turn (rounding goes to the biggest).
    {
      const ts = plan.filter((v): v is Turn => typeof v !== "number"), sum = ts.reduce((a, t) => a + t.turn, 0);
      ts.reduce((a, t) => (Math.abs(t.turn) > Math.abs(a.turn) ? t : a)).turn += 2 * PI - sum;
    }
    n = L.length;
    const ux = P[((k0 + 1) % n) * 2]! - P[k0 * 2]!, uz = P[((k0 + 1) % n) * 2 + 1]! - P[k0 * 2 + 1]!, ul = hypot(ux, uz);
    const sx = P[k0 * 2]! + (ux / ul) * T[k0]!, sz = P[k0 * 2 + 1]! + (uz / ul) * T[k0]!, yaw = atan2(-uz, ux);

    // ---- the features, onto the straights (the finish jump last on the last; none on a link) ----
    const r2 = rng(seed ^ 0xa5a5a5a5);
    // Each wanted section: its choices, the first that fits goes in (the first three must go in).
    const want: number[][][] = [];
    const rhythm = Array<number>(2 + (r2() < 0.6 * d ? 1 : 0)).fill(F_DOUBLE);
    want.push(r2() < 0.55 ? [rhythm, [F_DOUBLE, F_DOUBLE], [F_WHOOPS]] : [[F_WHOOPS], [F_DOUBLE, F_DOUBLE]]);
    want.push(d > 0.3 && r2() < 0.35 + 0.5 * d ? [[F_TRIPLE], [F_DOUBLE]] : [[F_DOUBLE]]);
    const step = r2() < 0.5 ? [[F_STEPUP], [F_STEPDOWN]] : [[F_STEPDOWN], [F_STEPUP]];
    // A tabletop and a step: one of them must go in (whichever comes first), the other if it fits.
    if (r2() < 0.5) want.push([[F_TABLE], ...step], step);
    else want.push([...step, [F_TABLE]], [[F_TABLE]]);
    const POOL = d < 0.35 ? [F_DOUBLE, F_TABLE, F_WHOOPS, F_STEPDOWN] : d < 0.7 ? [F_DOUBLE, F_TRIPLE, F_TABLE, F_WHOOPS, F_STEPUP, F_STEPDOWN] : [F_TRIPLE, F_TRIPLE, F_STEPUP, F_STEPDOWN, F_DOUBLE, F_WHOOPS];
    const extra = Math.floor(d * 2 + r2() * 1.2);
    for (let k = 0; k < extra; k++) want.push(r2() < 0.25 ? [[F_DOUBLE, F_DOUBLE]] : [[pick(r2, POOL)]]);
    const GAP = 2.4, glen = (g: number[]) => g.reduce((a, kind) => a + FEATURE_LEN[kind]!, 0) + (g.length - 1) * RHYTHM;
    /** Per straight: the groups on it, and the room it has left (from its run-in to its roll-out). */
    const on: number[][][] = L.map(() => []), used = L.map((_, k): number => (k === 0 ? 7.5 : 0)), room = L.map((v) => v - ROLL_OUT);
    /** Where a group would start on straight k: after the turn's run-in, or after the last group with the run-in it needs. */
    const from = (k: number, g: number[], i = on[k]!.length, at = used[k]!) => (i ? at + Math.max(GAP, RUN_IN[g[0]!]!) : Math.max(at, RUN_IN[g[0]!]!));
    const fits = (k: number, g: number[]) => !links[k] && from(k, g) + glen(g) <= room[k]! - (k === n - 1 ? FEATURE_LEN[F_FINISH]! + Math.max(GAP, RUN_IN[F_FINISH]!) : 0);
    const put = (k: number, g: number[]) => ((used[k] = from(k, g) + glen(g)), on[k]!.push(g));
    if (links[n - 1] || Math.max(used[n - 1]!, RUN_IN[F_FINISH]!) + FEATURE_LEN[F_FINISH]! > room[n - 1]!) continue;
    let ok = true;
    want.forEach((choices, w) => {
      const o = Math.floor(r2() * n);
      for (const g of choices) {
        let best = -1, left = -Infinity;
        // The straight with the most room left (from a random start: ties spread round).
        for (let q = 0; q < n; q++) {
          const k = (o + q) % n;
          if (fits(k, g) && room[k]! - used[k]! > left) (left = room[k]! - used[k]!), (best = k);
        }
        if (best >= 0) return void put(best, g);
      }
      if (w < 3) ok = false;
    });
    if (!ok) continue;
    on[n - 1]!.push([F_FINISH]);
    // Their places: the slack on each straight spread between them.
    const feats: number[] = [];
    for (let k = 0; k < n; k++) {
      const gs = on[k]!;
      if (!gs.length) continue;
      let need = k === 0 ? 7.5 : 0;
      gs.forEach((g, i) => (need = from(k, g, i, need) + glen(g)));
      const share = Math.max(0, room[k]! - need) / (gs.length + 1);
      let s = k === 0 ? 7.5 : 0;
      gs.forEach((g, i) => {
        s = from(k, g, i, s) + share;
        for (const kind of g) feats.push(kind, 2 * k, Math.round(s * 100) / 100), (s += FEATURE_LEN[kind]! + RHYTHM);
        s -= RHYTHM;
      });
    }

    // ---- the table: turned to the angle that needs the fewest cells, centred ----
    const pts = polyline(plan, 0, 0, 0.5, 5.2, 0), m = GEN.margin;
    let bestCells = Infinity, bx = 0, bz = 0, bc = 0, br = 0, ba = 0;
    for (let q = 0; q < 36; q++) {
      const a = (q / 36) * PI, c = cos(a), sn = sin(a);
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < pts.length; i += 2) {
        const x = pts[i]! * c + pts[i + 1]! * sn, z = -pts[i]! * sn + pts[i + 1]! * c;
        (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (z0 = Math.min(z0, z)), (z1 = Math.max(z1, z));
      }
      const cols = Math.max(GEN.minCols, Math.ceil((x1 - x0 + 2 * m) / CELL / 2) * 2), rows = Math.max(GEN.minRows, Math.ceil((z1 - z0 + 2 * m) / CELL / 2) * 2);
      if (cols > GEN.maxCols || rows > GEN.maxRows || cols * rows >= bestCells) continue;
      (bestCells = cols * rows), (ba = a), (bx = -(x0 + x1) / 2), (bz = -(z0 + z1) / 2), (bc = cols), (br = rows);
    }
    if (bestCells === Infinity) return null;
    void sx, void sz, void yaw;
    const name = `${pick(r2, ADJ)} ${pick(r2, NOUN)}`;
    return { id: `gen-${seed.toString(36)}`, name, A: 0, B: 0, RAD: 5.2, plan, start: [bx, bz, ba], features: feats, gate: 1.2, line: 1.6, cols: bc, rows: br, seed: (seed ^ 0x5bd1e995) >>> 0 };
  }
  return null;
}

/** The centre line of a plan at a step ds: [x, z, …] (the same integration as makeTrack's, coarser). */
export function polyline(plan: Section[], sx: number, sz: number, ds: number, RAD = 5.2, yaw = 0) {
  const out: number[] = [];
  let x = sx, z = sz, psi = yaw;
  for (const v of plan) {
    const len = secLen(v, RAD), turn = secTurn(v), n = Math.max(1, Math.round(len / ds)), step = len / n, rad = typeof v === "number" ? RAD : v.r ?? RAD;
    for (let i = 0; i < n; i++) {
      out.push(x, z);
      if (turn) {
        // Exact arc step.
        const sg = turn > 0 ? 1 : -1, dpsi = (sg * step) / rad;
        x += sg * rad * (sin(psi + dpsi) - sin(psi));
        z += sg * rad * (cos(psi + dpsi) - cos(psi));
        psi += dpsi;
      } else (x += cos(psi) * step), (z -= sin(psi) * step);
    }
  }
  out.push(x, z);
  return out;
}

/** The checks with no ride: the loop closes, no self-overlap, fits the table, features on straights with room. */
export function checkShape(p: TrackPlan): string | null {
  const t = makeTrack(p), { TRACK, NT, HX, HZ, LAP } = t;
  // The loop closes: the last point meets the first (and the heading comes round).
  const gap = hypot(TRACK[0]! - TRACK[(NT - 1) * 2]!, TRACK[1]! - TRACK[(NT - 1) * 2 + 1]!);
  if (gap > LAP / NT + 0.1) return `open loop (${gap.toFixed(2)})`;
  const turn = p.plan.reduce<number>((s, v) => s + secTurn(v), 0);
  if (Math.abs(turn - 2 * PI) > 1e-6) return "heading does not close";
  // Fits the table, with a margin for the berms, the lip and the off-table line.
  const m = GEN.margin - 0.2;
  for (let i = 0; i < NT; i++) if (Math.abs(TRACK[i * 2]!) > HX - m || Math.abs(TRACK[i * 2 + 1]!) > HZ - m) return `off the table at ${i}`;
  // No self-overlap: two points far apart along the lap are never close on the table.
  const ds = LAP / NT, far = Math.ceil(11 / ds), sep2 = GEN.sep * GEN.sep;
  for (let i = 0; i < NT; i++)
    for (let j = i + far; j < NT; j++) {
      if (NT - (j - i) < far) break;
      const dx = TRACK[i * 2]! - TRACK[j * 2]!, dz = TRACK[i * 2 + 1]! - TRACK[j * 2 + 1]!;
      if (dx * dx + dz * dz < sep2) return `overlap ${i}/${j} (${Math.sqrt(dx * dx + dz * dz).toFixed(2)})`;
    }
  // Every feature sits on a straight, inside it with room to land, and none overlaps the next.
  const F = p.features, spans: [number, number][] = [];
  for (let k = 0; k < F.length; k += 3) {
    const kind = F[k]!, sec = F[k + 1]!, at = F[k + 2]!, v = p.plan[sec];
    if (typeof v !== "number" || v < 0) return `feature ${k / 3} not on a straight`;
    if (at < 0 || at + FEATURE_LEN[kind]! > v - 2) return `feature ${k / 3} runs off its straight`;
    const s0 = t.FEATURES[(k / 3) * 2 + 1]!;
    spans.push([s0, s0 + FEATURE_LEN[kind]!]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  for (let k = 1; k < spans.length; k++) if (spans[k]![0] < spans[k - 1]![1] + 0.5) return "features overlap";
  if (spans.length && spans[0]![0] < p.gate + 6) return "a feature on the gate";
  // The features stand up: the profile reaches each one's height (none shadowed by the one before).
  for (let k = 0; k < F.length; k += 3) {
    const s0 = t.FEATURES[(k / 3) * 2 + 1]!;
    let hi = 0;
    for (let q = 0; q <= 40; q++) hi = Math.max(hi, t.profile(s0 + (q / 40) * FEATURE_LEN[F[k]!]!));
    if (hi < 0.2) return `feature ${k / 3} is flat`;
  }
  return null;
}

/** The reference riders: the four starters, stock and new (the 2-stroke first: it must ride clean). Built on first use. */
let REF: Tuned[] | null = null;
const refs = () => (REF ??= ["buzzline", ...STARTERS.map((m) => m.id).filter((id) => id !== "buzzline")].map((id) => tune(newBike(id, "ref"))));

/** The ride check: a race on the autopilot, the 2-stroke starter (rider 0) against the other three
 *  starters. Rider 0 finishes three laps with no crash; everyone else gets two laps or more in that time. */
export function checkRide(p: TrackPlan, seed = 7): string | null {
  const REF = refs(), t = makeTrack(p), me = REF[0]!;
  const race = motoRace(seed, t, { power: me.power, shape: me.shape }, REF.slice(1).map((x) => x.power));
  const I = new Float64Array(5);
  race.go(me.power);
  const limit = 60 * (40 + (t.LAP * LAPS) / 6);
  for (let i = 0; i < limit && race.phase !== DONE; i++) {
    race.step(1 / 60, I, true);
    race.clear();
    if (race.crashes(0)) return `crash on lap ${race.lap(0)}`;
  }
  if (!race.finished(0)) return "the autopilot did not finish";
  for (let k = 1; k < 4; k++) if (race.progress(k) < 2 * t.LAP) return `rider ${k} (${REF[k]!.model.name}) under two laps`;
  return null;
}

/** Every check (shape, then the ride). */
export function validate(p: TrackPlan): string | null {
  return checkShape(p) ?? checkRide(p);
}

/** A seed's track at a difficulty: the first draft (seed, seed+1 mixed, …) that passes validate().
 *  `tries` is how many drafts it took; `fallback` if none did (then a known good loop). */
export function generateTrack(seed: number, difficulty: number): { plan: TrackPlan; tries: number; fallback: boolean } {
  for (let k = 0; k < GEN.tries; k++) {
    const s = (Math.imul((seed >>> 0) ^ 0x2545f491, 1) + Math.imul(k, 0x9e3779b1)) >>> 0;
    const p = draft(s, difficulty);
    if (!p || validate(p)) continue;
    return { plan: p, tries: k + 1, fallback: false };
  }
  return { plan: FALLBACK, tries: GEN.tries, fallback: true };
}

/** The loop every draft falls back to (never needed in 1,500 seeds tested; kept so a round always has a track). */
const FALLBACK: TrackPlan = {
  id: "gen-fallback", name: "GRID LOOP", A: 19.2, B: 10.7, RAD: 5.2,
  plan: [28, -1, 11, -1, 28, -1, 11, -1],
  features: [F_DOUBLE, 0, 7.5, F_DOUBLE, 0, 15.5, F_WHOOPS, 2, 0.6, F_TABLE, 4, 3, F_STEPDOWN, 4, 14, F_FINISH, 6, 0.4],
  gate: 1.2, line: 1.6, cols: 104, rows: 68, seed: 20261118,
};
