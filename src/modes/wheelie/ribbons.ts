// Endless Wheelie City's road surfaces as ribbons: the asphalt, the gravel shoulder (the sidewalk in
// town), the roundabouts' rings and islands, each drawn along the road's true curve instead of
// coloured onto the ground's triangles (which made their edges zigzag along the grid, worst at a
// distance where the ground is drawn coarser). The ground under them is drawn as what lies round them
// (open.ts: HQ[2]), so nothing of the grid shows past a ribbon's edge.
// - What is drawn is what is ridden: a ribbon's edge is the road's edge as the world computes it (the
//   offset of the road's polyline at its half-width, mitred at the joints; the ring's circles), and
//   every corner sits on the ground the bike rides (the window's height there, by the window's own
//   rule).
// - The drawing is the shared painter's (../ribbons.ts: projection, near-plane clip, the terrain's
//   shading, one path per material and shade); this file walks the road graph into it: one decal in
//   the terrain cluster, under the lane paint, the strips round the bike cut finer near the eye.
import type { OpenWorld } from "./open.ts";
import { ribbons, UL, OV, type RibbonGround, type RibbonView } from "../ribbons.ts";
import { RC, NS, RB_R, RB_HW, RB_ISLE, TOWN_R, GRAVEL_W, WALK_W, F_ROAD, F_WALK, F_GRAVEL, F_ISLE, F_TRAIL } from "./open.ts";

/** The materials, in the order they are painted: gravel, sidewalk, asphalt, a roundabout's island,
 *  and the dirt trail a road becomes past the city (the Endless Mashup: shoulders and all). */
const M_GRAVEL = 0, M_WALK = 1, M_ROAD = 2, M_ISLE = 3, M_TRAIL = 4, NM = 5;

export type { RibbonGround, RibbonView } from "../ribbons.ts";

/** The road ribbons of world W on the window t, painted into a 2D context round the point in `at`. */
export function roadRibbons(W: OpenWorld, t: RibbonGround, view: RibbonView) {
  const PT = W.PT, EP = W.EP, EF = W.EF, XT = W.XT, TQ = W.TQ;
  const K = ribbons(t, view, NM), WP = K.WP, B = K.B, X = K.X, GA = K.GA, hy = K.hy, emit = K.emit, ring = K.ring;
  /** Where to paint round: x, z, reach (set before `paint`). */
  const at = new Float64Array(3);
  /** Rows across a strip: [0..17] the previous row (x y z of: the shoulder's outer edge, its inner edge
   *  (UL under the asphalt), the asphalt's edge; left, then the same mirrored right), [18..35] this
   *  row; RM, RW: each row's shoulder material and width; RA: the row to make (x, z, across x, z,
   *  half-width, shoulder). */
  const R = new Float64Array(36), RM = new Int32Array(2), RW = new Float64Array(2), RA = new Float64Array(6);
  const stats = K.stats;
  /** The colours (a theme change): the kinds' colours as the terrain draws them, light and ambient. */
  const colors = (kindC: ArrayLike<string>, light: ArrayLike<number>, amb: number) =>
    K.colors([kindC[F_GRAVEL - 1]!, kindC[F_WALK - 1]!, kindC[F_ROAD - 1]!, kindC[F_ISLE - 1]!, kindC[F_TRAIL - 1] ?? kindC[F_GRAVEL - 1]!], light, amb);

  /** Row slot r (0 previous, 1 this) from RA: at (x, z), the across direction scaled for the mitre,
   *  the road's half-width and the shoulder's width. */
  function row(r: number) {
    const o = r * 18, x = RA[0]!, z = RA[1]!, nx = RA[2]!, nz = RA[3]!, hw = RA[4]!, sw = RA[5]!;
    for (let q = 0; q < 6; q++) {
      const w = q === 0 ? hw + sw : q === 1 ? hw - UL : q === 2 ? hw : q === 3 ? -hw : q === 4 ? UL - hw : -hw - sw;
      R[o + q * 3] = x + nx * w; R[o + q * 3 + 2] = z + nz * w;
      hy(R, o + q * 3);
    }
    RW[r] = sw;
  }
  /** The quads between the previous row and this one: the left shoulder, the asphalt, the right
   *  shoulder; each reaching OV of the way back over the one before it (no seam where the shade changes). */
  function quads(m: number) {
    for (let p = 0; p < 3; p++) {
      const a = p * 2, b = a + 1;
      for (let c = 0; c < 3; c++) {
        const pa = R[a * 3 + c]!, pb = R[b * 3 + c]!, ta = R[18 + a * 3 + c]!, tb = R[18 + b * 3 + c]!;
        WP[c] = pa + (pa - ta) * OV; WP[3 + c] = pb + (pb - tb) * OV; WP[6 + c] = tb; WP[9 + c] = ta;
      }
      emit(p === 1 && m !== M_TRAIL ? M_ROAD : m, 4);
    }
  }
  /** The shoulder's material at (XT[0], XT[1]): the sidewalk inside a town's limits, else gravel. */
  const mat = () => (W.townI(), TQ[0]! < TOWN_R ? M_WALK : W.pavedI() ? M_GRAVEL : M_TRAIL);

  /** One road (edge slot e): its polyline, segment by segment, cut finer near the eye; the shoulder's
   *  material changes where the road crosses a town's limits (found by halving). */
  function strip(e: number) {
    const o = e * EP, hw = EF[e * 8]!, bx = at[0]!, bz = at[1]!, reach = at[2]!, ex = B[0]!, ez = B[2]!;
    const x0 = X[0]! + t.cell, z0 = X[1]! + t.cell, x1 = X[2]! - t.cell, z1 = X[3]! - t.cell;
    let open = false;
    for (let k = 0; k < NS; k++) {
      const ax = PT[o + k * 4]!, az = PT[o + k * 4 + 1]!, cx = PT[o + k * 4 + 4]!, cz = PT[o + k * 4 + 5]!, dx = cx - ax, dz = cz - az, len = Math.sqrt(dx * dx + dz * dz) || 1;
      const mx = (ax + cx) / 2 - bx, mz = (az + cz) / 2 - bz;
      if (mx * mx + mz * mz > (reach + len) * (reach + len)) { open = false; continue; }
      // The across direction: this segment's, and the mitres at its ends (with the segments either side).
      const nx = -dz / len, nz = dx / len;
      const ex2 = (ax + cx) / 2 - ex, ez2 = (az + cz) / 2 - ez, de = Math.sqrt(ex2 * ex2 + ez2 * ez2) * 0.06, step = de < 0.8 ? 0.8 : de > 4 ? 4 : de;
      const n = Math.ceil(len / step);
      for (let q = open ? 1 : 0; q <= n; q++) {
        const f = q / n, x = ax + dx * f, z = az + dz * f;
        if (x < x0 || z < z0 || x > x1 || z > z1) { open = false; continue; }
        let mnx = nx, mnz = nz;
        if ((q === 0 && k > 0) || (q === n && k < NS - 1)) {
          const g = o + (q === 0 ? k - 1 : k + 1) * 4, px = PT[g + 4]! - PT[g]!, pz = PT[g + 5]! - PT[g + 1]!, pl = Math.sqrt(px * px + pz * pz) || 1;
          const qx = -pz / pl, qz = px / pl, d = 1 + nx * qx + nz * qz;
          if (d > 0.2) (mnx = (nx + qx) / d), (mnz = (nz + qz) / d);
        }
        XT[0] = x; XT[1] = z;
        const m = mat(), sw = m === M_WALK ? WALK_W : GRAVEL_W;
        RA[0] = x; RA[1] = z; RA[2] = mnx; RA[3] = mnz; RA[4] = hw; RA[5] = sw;
        if (!open) { row(1); RM[1] = m; open = true; continue; }
        R.copyWithin(0, 18, 36); RM[0] = RM[1]!; RW[0] = RW[1]!;
        if (m !== RM[0]) {
          // The town's limit between the rows: halve to it, end the old strip there and start the new.
          const sx = (R[0]! + R[15]!) / 2, sz = (R[2]! + R[17]!) / 2;
          let lo = 0, hi = 1;
          for (let it = 0; it < 7; it++) {
            const h2 = (lo + hi) / 2;
            XT[0] = sx + (x - sx) * h2; XT[1] = sz + (z - sz) * h2;
            if (mat() === RM[0]) lo = h2;
            else hi = h2;
          }
          RA[0] = sx + (x - sx) * hi; RA[1] = sz + (z - sz) * hi; RA[2] = nx; RA[3] = nz; RA[5] = RW[0]!;
          row(1);
          quads(RM[0]!);
          RA[5] = sw;
          row(0);
          RA[0] = x; RA[1] = z; RA[2] = mnx; RA[3] = mnz;
        }
        row(1);
        RM[1] = m;
        quads(m);
      }
    }
  }

  /** Paint the ribbons round `at` (x, z, reach) as the diorama's camera sees them now. */
  function paint(c2: CanvasRenderingContext2D) {
    K.begin();
    const bx = at[0]!, bz = at[1]!, reach = at[2]!, ci = Math.floor(bx / RC), cj = Math.floor(bz / RC);
    // Shoulders and asphalt (one pass: they are sorted by material below), then the rings and islands.
    for (let dir = 0; dir < 2; dir++) for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
      const e = W.edge(i, j, dir);
      if (e < 0) continue;
      const f = e * 8;
      if (bx + reach < EF[f + 2]! || bx - reach > EF[f + 4]! || bz + reach < EF[f + 3]! || bz - reach > EF[f + 5]!) continue;
      strip(e);
    }
    const RR = reach + RB_R + RB_HW + WALK_W;
    for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
      if (!W.isRound(i, j)) continue;
      W.nodeQ(i, j);
      const nx = W.NQ[0]!, nz = W.NQ[1]!;
      if ((nx - bx) * (nx - bx) + (nz - bz) * (nz - bz) > RR * RR) continue;
      XT[0] = nx; XT[1] = nz;
      const m = mat();
      GA[0] = nx; GA[1] = nz;
      GA[2] = RB_R + RB_HW - UL; GA[3] = RB_R + RB_HW + (m === M_WALK ? WALK_W : GRAVEL_W); ring(m);
      GA[2] = RB_ISLE - UL; GA[3] = RB_R + RB_HW; ring(M_ROAD);
      GA[2] = 0; GA[3] = RB_ISLE; ring(M_ISLE);
    }
    K.flush(c2);
  }
  return { at, paint, colors, stats };
}

