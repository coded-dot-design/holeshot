// Big Air's line, headless: an endless straight of packed dirt (along +x, the line at z = 0) that
// starts on a roll-in deck, drops down a long hill for speed, then throws a kicker and a landing
// every SP units forever. The jumps are sized by the bike's top speed (`lineFor(top)`): every length
// and height of a jump scales by k = (top / V0)², and a jump scaled by k throws a bike k times as far
// at √k times the speed (the flight is the same shape: the same lip angle, the same gravity), so a
// full-gas jump on any bike lands on the landing's down ramp. Each landing is a tabletop: its deck
// fills the gap, so a jump short of the down ramp lands on the deck, never in a hole. Banks along
// both sides and a stadium wall past them keep the bike on the line; a wall closes the back of the
// roll-in. The ground is a pure function of x and z (`heightAt`), so the same bike gets the same
// line on every screen; what the bike rides is a strip of it round the rider (`strip()`, a
// @fzlt/core/terrain-shaped heightfield that slides along x in whole steps: the desert's streaming
// pattern, ../desert/world.ts, along one axis). Zero allocation per step (typed arrays, fixed sizes).
import type { Terrain } from "@fzlt/core/terrain";
import { pow, sin } from "../../math.ts";

/** The strip: cells along x and across, the cell, the slide step (cells), the cells kept behind the bike. */
export const SCOLS = 240, SROWS = 64, SCELL = 0.5, SSTEP = 16, BEHIND = 72;
/** The line's half width (the dirt between the banks), the banks' height and width, the stadium wall. */
export const HW = 3.4, BANK_H = 1.7, BANK_W = 2.4, WALL_AT = HW + 9, WALL_H = 5, OUT = HW + 11.5;
/** The floor's height, the roll-in deck's and the hill's length; the run from its foot to the first kicker. */
export const FLOOR = 0.2, ROLL_H = 5, ROLL_X = -9, HILL = 26, RUN0 = 24;
/** The speed a k = 1 line is sized for (the 2-stroke starter's top), and k's range. */
export const V0 = 17.5, K_MIN = 0.62, K_MAX = 2.4;
/** Terrain kinds: dirt, the steel kicker, the landing (deck and down ramp). */
export const KIND_TRACK = 1, KIND_STEEL = 2, KIND_LAND = 3;
/** Profile parts (FK): 0 floor, 1 kicker, 2 the landing's deck, 3 its down ramp, 4 the roll-in. */
export const P_FLOOR = 0, P_KICK = 1, P_DECK = 2, P_DOWN = 3, P_ROLL = 4;

/** A line's jump, at k = 1: the kicker's length and height, the drop off its lip to the deck, the
 *  deck's height and length (lip to knuckle), the down ramp's length, the run-out to the next kicker. */
const KL = 4.4, KH = 2.6, LIP = 0.4, DH = 2.4, DECK = 8.4, DOWN = 15, RUNOUT = 12;

/** The line's sizes for a bike of top speed `top` (units/s), into L: [k, kicker length, kicker
 *  height, deck height, deck length, down ramp, spacing, first kicker's x]. */
export const L = new Float64Array(8);
export const LK = 0, LKL = 1, LKH = 2, LDH = 3, LDECK = 4, LDOWN = 5, LSP = 6, LX0 = 7;
export function lineFor(top: number, out = L) {
  const k = Math.max(K_MIN, Math.min(K_MAX, (top / V0) * (top / V0)));
  out[LK] = k;
  out[LKL] = KL * k;
  out[LKH] = KH * k;
  out[LDH] = DH * k;
  out[LDECK] = DECK * k;
  out[LDOWN] = DOWN * k;
  out[LSP] = (KL + DECK + DOWN) * k + RUNOUT * Math.max(1, Math.sqrt(k));
  out[LX0] = HILL + RUN0 * Math.max(1, Math.sqrt(k));
  return out;
}

const sm = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** Height over the floor at x into PF[0], its slope into PF[1], the part into FK[0], the jump's index into FK[1]. */
export const PF = new Float64Array(2), FK = new Int32Array(2);
export function prof(G: Float64Array, x: number) {
  FK[0] = P_FLOOR;
  FK[1] = -1;
  PF[0] = 0;
  PF[1] = 0;
  if (x < HILL) {
    // The roll-in: the deck, then the hill down to the floor.
    if (x < 0) return void ((FK[0] = P_ROLL), (PF[0] = ROLL_H - FLOOR));
    const u = x / HILL;
    return void ((FK[0] = P_ROLL), (PF[0] = (ROLL_H - FLOOR) * (1 - sm(u))), (PF[1] = (-(ROLL_H - FLOOR) * 6 * u * (1 - u)) / HILL));
  }
  const X0 = G[LX0]!, SP = G[LSP]!;
  if (x < X0) return;
  const j = Math.floor((x - X0) / SP), d = x - X0 - j * SP, kl = G[LKL]!, kh = G[LKH]!, dh = G[LDH]!, dk = G[LDECK]!, dn = G[LDOWN]!, lip = LIP * G[LK]!;
  FK[1] = j;
  if (d < kl) return void ((FK[0] = P_KICK), (PF[0] = kh * pow(d / kl, 1.35)), (PF[1] = (kh * 1.35 * pow(d / kl, 0.35)) / kl));
  // Off the lip: a short steep drop to the deck (the kicker's steel back), the deck to the knuckle.
  if (d < kl + lip) return void ((FK[0] = P_KICK), (PF[0] = kh - (kh - dh) * sm((d - kl) / lip)), (PF[1] = -(kh - dh) / lip));
  if (d < kl + dk) return void ((FK[0] = P_DECK), (PF[0] = dh));
  const f = (d - kl - dk) / dn;
  if (f < 1) return void ((FK[0] = P_DOWN), (PF[0] = dh * (1 - sm(f))), (PF[1] = (-dh * 6 * f * (1 - f)) / dn));
}
/** Where jump j's kicker starts, its knuckle (deck end), its down ramp's foot. */
export const kickAt = (G: Float64Array, j: number) => G[LX0]! + j * G[LSP]!;
export const knuckleAt = (G: Float64Array, j: number) => kickAt(G, j) + G[LKL]! + G[LDECK]!;
export const footAt = (G: Float64Array, j: number) => knuckleAt(G, j) + G[LDOWN]!;

/** The ground's height at (x, z) (the line between its banks, the outfield, the stadium wall). Pure. */
export function heightAt(G: Float64Array, x: number, z: number) {
  prof(G, x);
  return groundAt(x, z < 0 ? -z : z, PF[0]!);
}
/** The same with the profile at x already known (p): z is |z|. */
function groundAt(x: number, az: number, p: number) {
  // The jumps span the line and taper into the banks; the banks rise either side, the wall past the outfield.
  const w = az <= HW + 0.2 ? 1 : 1 - sm((az - HW - 0.2) / 3.4);
  let y = FLOOR + p * w + BANK_H * sm((az - HW) / BANK_W) + (WALL_H - BANK_H) * sm((az - WALL_AT) / 1.6);
  // The outfield rolls a little (a pure ripple: no state).
  if (az > HW + BANK_W) y += 0.18 * sm((az - HW - BANK_W) / 2) * (1 + sin(x * 0.21 + az * 0.7));
  // The back wall behind the roll-in deck.
  if (x < ROLL_X) y += 7 * sm((ROLL_X - x) / 2.5);
  return y;
}

/** The strip the bike rides: SCOLS × SROWS cells round the rider, sliding along x in SSTEP-cell steps. */
export function strip(G: Float64Array) {
  const W1 = SCOLS + 1, R1 = SROWS + 1, h = new Float64Array(W1 * R1), kind = new Uint8Array(SCOLS * SROWS * 2), F = new Float64Array(3);
  const COLP = new Float64Array(W1), COLK = new Int8Array(SCOLS);
  // O: the strip's first column (cells, an integer); N: slides, columns computed.
  const O = new Int32Array(1), N = new Float64Array(2);
  const z0 = -(SROWS * SCELL) / 2;
  const t = {
    cols: SCOLS, rows: SROWS, cell: SCELL, x0: 0, z0, h, kind, version: 0, split: "adaptive" as const,
    height: (x: number, z: number) => (face(x, z), F[0]!),
    normal<Q extends { [i: number]: number }>(x: number, z: number, out: Q) {
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
    const c = SCELL, u = Math.min(SCOLS, Math.max(0, (x - t.x0) / c)), v = Math.min(SROWS, Math.max(0, (z - z0) / c));
    const i = Math.min(SCOLS - 1, Math.floor(u)), j = Math.min(SROWS - 1, Math.floor(v)), fu = u - i, fv = v - j, k = j * W1 + i;
    const a = h[k]!, b = h[k + 1]!, cc = h[k + W1 + 1]!, d = h[k + W1]!;
    // The adaptive split, as @fzlt/core/terrain draws it (and ../desert/world.ts rides it).
    const fl = Math.abs(b - d) < Math.abs(cc - a), up = fl ? fu + fv > 1 : fu >= fv;
    const sx = up !== fl ? b - a : cc - d, sz = up ? cc - b : d - a;
    F[0] = a + sx * fu + sz * fv + (fl && up ? b - a - sx : 0);
    F[1] = sx / c;
    F[2] = sz / c;
    return (j * SCOLS + i) * 2 + (up ? 0 : 1);
  }
  /** Fill columns i0..i1 (vertex indices) from the pure ground, and their cells' kinds. */
  function fill(i0: number, i1: number) {
    for (let i = i0; i <= i1; i++) {
      const x = (O[0]! + i) * SCELL;
      prof(G, x);
      COLP[i] = PF[0]!;
      for (let j = 0; j < R1; j++) {
        const z = z0 + j * SCELL;
        h[j * W1 + i] = groundAt(x, z < 0 ? -z : z, COLP[i]!);
      }
      if (i < SCOLS) {
        prof(G, x + SCELL / 2);
        const p = FK[0]!;
        COLK[i] = p === P_KICK ? KIND_STEEL : p === P_DECK || p === P_DOWN ? KIND_LAND : KIND_TRACK;
        for (let j = 0; j < SROWS; j++) {
          const zc = z0 + (j + 0.5) * SCELL, k = COLK[i]!;
          kind[(j * SCOLS + i) * 2] = kind[(j * SCOLS + i) * 2 + 1] = (zc < 0 ? -zc : zc) <= HW ? k : 0;
        }
      }
    }
    N[1] = N[1]! + (i1 - i0 + 1);
  }
  /** Put the strip's first column at cell ox: copy what it keeps, fill the rest. */
  function moveTo(ox: number) {
    const dx = ox - O[0]!;
    if (!dx && t.version) return false;
    const keep = t.version > 0 && Math.abs(dx) < SCOLS;
    O[0] = ox;
    t.x0 = ox * SCELL;
    if (!keep) fill(0, SCOLS);
    else {
      for (let j = 0; j < R1; j++) {
        const r = j * W1;
        if (dx > 0) h.copyWithin(r, r + dx, r + W1);
        else h.copyWithin(r - dx, r, r + W1 + dx);
      }
      for (let j = 0; j < SROWS; j++) {
        const r = j * SCOLS * 2;
        if (dx > 0) kind.copyWithin(r, r + dx * 2, r + SCOLS * 2);
        else kind.copyWithin(r - dx * 2, r, r + (SCOLS + dx) * 2);
      }
      if (dx > 0) fill(W1 - dx - 1, SCOLS);
      else fill(0, -dx);
    }
    N[0] = N[0]! + 1;
    t.version++;
    return true;
  }
  /** Keep x BEHIND cells from the strip's back (in SSTEP steps). True if it slid. */
  function follow(x: number) {
    const ox = Math.floor(x / SCELL / SSTEP) * SSTEP - BEHIND;
    if (t.version && ox === O[0]) return false;
    return moveTo(ox);
  }
  return { t: t as unknown as Terrain & { x0: number; z0: number }, O, stats: N, follow, moveTo };
}
export type Strip = ReturnType<typeof strip>;
