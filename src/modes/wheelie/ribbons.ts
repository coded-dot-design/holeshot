// Endless Wheelie City's road surfaces as ribbons: the asphalt, the gravel shoulder (the sidewalk in
// town), the roundabouts' rings and islands, each drawn along the road's true curve instead of
// coloured onto the ground's triangles (which made their edges zigzag along the grid, worst at a
// distance where the ground is drawn coarser). The ground under them is drawn as what lies round them
// (open.ts: HQ[2]), so nothing of the grid shows past a ribbon's edge.
// - What is drawn is what is ridden: a ribbon's edge is the road's edge as the world computes it (the
//   offset of the road's polyline at its half-width, mitred at the joints; the ring's circles), and
//   every corner sits on the ground the bike rides (the window's height there, by the window's own
//   rule).
// - One decal in the terrain cluster, under the lane paint: the strips round the bike cut into quads
//   (finer near the eye), clipped at the near plane, shaded by their slope with the terrain's own
//   rule and painted one path per material and shade (each quad tucked under its neighbours: no seams).
// - Zero allocation per frame: fixed typed arrays, and no double crosses a call that might not be
//   inlined (V8 would box it): inputs and results go through scratch arrays. The colours are made when
//   the scene is built.
import type { OpenWorld } from "./open.ts";
import { RC, NS, RB_R, RB_HW, RB_ISLE, TOWN_R, GRAVEL_W, WALK_W, F_ROAD, F_WALK, F_GRAVEL, F_ISLE, F_TRAIL } from "./open.ts";

/** The materials, in the order they are painted: gravel, sidewalk, asphalt, a roundabout's island,
 *  and the dirt trail a road becomes past the city (the Endless Mashup: shoulders and all). */
const M_GRAVEL = 0, M_WALK = 1, M_ROAD = 2, M_ISLE = 3, M_TRAIL = 4, NM = 5, LV = 33, NK = NM * LV;
/** Quads a frame (past it they are dropped), sides of a roundabout's circles. */
const QMAX = 3072, RS = 48;
/** The near plane the quads are clipped at (depth, world units). */
const ZN = 0.3;
/** How far a shoulder reaches in under the asphalt (units), and how far back each quad reaches over
 *  the one before it (of its length): no hairline of the ground between two quads painted apart. */
const UL = 0.15, OV = 0.04;

/** What the ribbons stand on: the window (its heights, as `openWindow` keeps them). */
export interface RibbonGround { h: Float64Array; x0: number; z0: number; cols: number; rows: number; cell: number }
/** What they are seen through: the diorama's camera and size. */
export interface RibbonView {
  cam: { yaw: number; pitch: number; dist: number; tx: number; ty: number; tz: number; fov: number; ox: number; oy: number };
  readonly width: number;
  readonly height: number;
}

/** The road ribbons of world W on the window t, painted into a 2D context round the point in `at`. */
export function roadRibbons(W: OpenWorld, t: RibbonGround, view: RibbonView) {
  const PT = W.PT, EP = W.EP, EF = W.EF, XT = W.XT, TQ = W.TQ, hs = t.h;
  const QV = new Float64Array(QMAX * 10), QN = new Uint8Array(QMAX), QK = new Uint16Array(QMAX), ORD = new Int32Array(QMAX), CNT = new Int32Array(NK + 1);
  const COL: string[] = [];
  /** Where to paint round: x, z, reach (set before `paint`). */
  const at = new Float64Array(3);
  /** Scratch: the polygon to emit (world; slot 4 a clipped corner), its screen points and depths; the
   *  light; the camera's basis (eye, right, up, forward, focal, screen middle); the window's extent. */
  const WP = new Float64Array(15), WZ = new Float64Array(5), SP = new Float64Array(10), L = new Float64Array(4), B = new Float64Array(15), X = new Float64Array(5);
  /** Rows across a strip: [0..17] the previous row (x y z of: the shoulder's outer edge, its inner edge
   *  (UL under the asphalt), the asphalt's edge; left, then the same mirrored right), [18..35] this
   *  row; RM, RW: each row's shoulder material and width; RA: the row to make (x, z, across x, z,
   *  half-width, shoulder); GA: a ring (middle x, z, radii). */
  const R = new Float64Array(36), RM = new Int32Array(2), RW = new Float64Array(2), RA = new Float64Array(6), GA = new Float64Array(4);
  const stats = { quads: 0, dropped: 0 };
  let nq = 0;

  /** The colours (a theme change): the kinds' colours as the terrain draws them, light and ambient. */
  function colors(kindC: ArrayLike<string>, light: ArrayLike<number>, amb: number) {
    COL.length = 0;
    const kc = [kindC[F_GRAVEL - 1]!, kindC[F_WALK - 1]!, kindC[F_ROAD - 1]!, kindC[F_ISLE - 1]!, kindC[F_TRAIL - 1] ?? kindC[F_GRAVEL - 1]!];
    for (let m = 0; m < NM; m++) for (let l = 0; l < LV; l++) COL.push(shade(kc[m]!, 0.5 + (l / 40) * 0.62));
    const ll = Math.sqrt(light[0]! * light[0]! + light[1]! * light[1]! + light[2]! * light[2]!) || 1;
    L[0] = light[0]! / ll; L[1] = light[1]! / ll; L[2] = light[2]! / ll; L[3] = amb;
  }

  /** The ground's height under point (A[o], A[o + 2]) into A[o + 1]: the window's face there, split as
   *  the window splits it (openWindow's `face`). */
  function hy(A: Float64Array, o: number) {
    const c = t.cell, n = t.cols, W1 = n + 1, x = A[o]!, z = A[o + 2]!;
    let u = (x - X[0]!) / c, v = (z - X[1]!) / c;
    u = u < 0 ? 0 : u > n ? n : u; v = v < 0 ? 0 : v > n ? n : v;
    let i = Math.floor(u), j = Math.floor(v);
    if (i > n - 1) i = n - 1;
    if (j > n - 1) j = n - 1;
    const fu = u - i, fv = v - j, k = j * W1 + i, a = hs[k]!, b = hs[k + 1]!, cc = hs[k + W1 + 1]!, d = hs[k + W1]!;
    const fl = Math.abs(b - d) < Math.abs(cc - a), up = fl ? fu + fv > 1 : fu >= fv;
    const sx = up !== fl ? b - a : cc - d, sz = up ? cc - b : d - a;
    A[o + 1] = a + sx * fu + sz * fv + (fl && up ? b - a - sx : 0);
  }
  /** Corner i of WP to the screen (SP) and its depth (WZ): the diorama's projection. */
  function prj(i: number) {
    const dx = WP[i * 3]! - B[0]!, dy = WP[i * 3 + 1]! - B[1]!, dz = WP[i * 3 + 2]! - B[2]!, zz = dx * B[9]! + dy * B[10]! + dz * B[11]!, k = B[12]! / (zz > 0.05 ? zz : 0.05);
    SP[i * 2] = B[13]! + (dx * B[3]! + dy * B[4]! + dz * B[5]!) * k;
    SP[i * 2 + 1] = B[14]! - (dx * B[6]! + dy * B[7]! + dz * B[8]!) * k;
    WZ[i] = zz;
  }

  /** Emit the polygon in WP (n = 3 or 4 corners, world) as material m: shaded by its normal,
   *  clipped at the near plane, culled off screen. */
  function emit(m: number, n: number) {
    if (nq >= QMAX) return void stats.dropped++;
    let back = 0;
    for (let i = 0; i < n; i++) (prj(i), WZ[i]! < ZN && back++);
    if (back === n) return;
    // The normal (the diagonals' cross product, a triangle's two sides'), up.
    const a = n === 4 ? 2 : 1, b = n === 4 ? 3 : 2, c1 = n === 4 ? 1 : 0;
    const ux = WP[a * 3]! - WP[0]!, uy = WP[a * 3 + 1]! - WP[1]!, uz = WP[a * 3 + 2]! - WP[2]!;
    const vx = WP[b * 3]! - WP[c1 * 3]!, vy = WP[b * 3 + 1]! - WP[c1 * 3 + 1]!, vz = WP[b * 3 + 2]! - WP[c1 * 3 + 2]!;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (ny < 0) (nx = -nx), (ny = -ny), (nz = -nz);
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1, dot = (nx * L[0]! + ny * L[1]! + nz * L[2]!) / nl;
    const lvl = Math.round((L[3]! + (1 - L[3]!) * (dot > 0 ? dot : 0)) * 32);
    const o = nq * 10;
    let k = 0;
    if (!back) for (let i = 0; i < n; i++) (QV[o + k * 2] = SP[i * 2]!), (QV[o + k * 2 + 1] = SP[i * 2 + 1]!), k++;
    else
      for (let i = 0; i < n; i++) {
        const j = i + 1 === n ? 0 : i + 1, zi = WZ[i]!, zj = WZ[j]!;
        if (zi >= ZN) (QV[o + k * 2] = SP[i * 2]!), (QV[o + k * 2 + 1] = SP[i * 2 + 1]!), k++;
        if ((zi >= ZN) !== (zj >= ZN)) {
          const f = (ZN - zi) / (zj - zi);
          for (let c = 0; c < 3; c++) WP[12 + c] = WP[i * 3 + c]! + (WP[j * 3 + c]! - WP[i * 3 + c]!) * f;
          prj(4);
          (QV[o + k * 2] = SP[8]!), (QV[o + k * 2 + 1] = SP[9]!), k++;
        }
      }
    // Off screen: every corner past the same side.
    let l0 = 0, r0 = 0, t0 = 0, b0 = 0;
    const Wd = view.width, H = view.height;
    for (let i = 0; i < k; i++) {
      const x = QV[o + i * 2]!, y = QV[o + i * 2 + 1]!;
      if (x < 0) l0++; if (x > Wd) r0++; if (y < 0) t0++; if (y > H) b0++;
    }
    if (l0 === k || r0 === k || t0 === k || b0 === k) return;
    QN[nq] = k; QK[nq] = m * LV + lvl; nq++;
  }

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

  /** A ring from GA (middle x, z; radii r0 to r1; r0 0: a disc) as material m, each side starting OV
   *  of a side back, under the one before it. */
  const RCS = new Float64Array(RS * 4);
  for (let q = 0; q < RS; q++) {
    const a = (q * Math.PI * 2) / RS, b = ((q - OV) * Math.PI * 2) / RS;
    RCS[q * 4] = Math.cos(b); RCS[q * 4 + 1] = Math.sin(b); RCS[q * 4 + 2] = Math.cos(a); RCS[q * 4 + 3] = Math.sin(a);
  }
  function ring(m: number) {
    const cx = GA[0]!, cz = GA[1]!, r0 = GA[2]!, r1 = GA[3]!;
    for (let q = 0; q < RS; q++) {
      const p = q + 1 === RS ? 0 : q + 1, ca = RCS[q * 4]!, sa = RCS[q * 4 + 1]!, cb = RCS[p * 4 + 2]!, sb = RCS[p * 4 + 3]!;
      WP[0] = cx + ca * r1; WP[2] = cz + sa * r1; WP[3] = cx + cb * r1; WP[5] = cz + sb * r1;
      WP[6] = cx + cb * r0; WP[8] = cz + sb * r0; WP[9] = cx + ca * r0; WP[11] = cz + sa * r0;
      const n = r0 > 0 ? 4 : 3;
      for (let i = 0; i < n; i++) hy(WP, i * 3);
      emit(m, n);
    }
  }

  /** Paint the ribbons round `at` (x, z, reach) as the diorama's camera sees them now. */
  function paint(c2: CanvasRenderingContext2D) {
    nq = 0; stats.dropped = 0;
    // The camera's basis (the diorama's), the window's extent.
    const cm = view.cam, cp = Math.cos(cm.pitch), sp = Math.sin(cm.pitch), cy = Math.cos(cm.yaw), sy = Math.sin(cm.yaw);
    B[0] = cm.tx + cm.dist * sy * cp; B[1] = cm.ty + cm.dist * sp; B[2] = cm.tz + cm.dist * cy * cp;
    B[3] = cy; B[4] = 0; B[5] = -sy;
    B[6] = -sy * sp; B[7] = cp; B[8] = -cy * sp;
    B[9] = -sy * cp; B[10] = -sp; B[11] = -cy * cp;
    B[12] = view.height / 2 / Math.tan(cm.fov / 2); B[13] = view.width / 2 + cm.ox; B[14] = view.height / 2 + cm.oy;
    X[0] = t.x0; X[1] = t.z0; X[2] = t.x0 + t.cols * t.cell; X[3] = t.z0 + t.rows * t.cell;
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
    stats.quads = nq;
    // Sort by key (material, then shade): one path and one fill each.
    CNT.fill(0);
    for (let q = 0; q < nq; q++) CNT[QK[q]! + 1]!++;
    for (let k = 0; k < NK; k++) CNT[k + 1] = CNT[k + 1]! + CNT[k]!;
    for (let q = 0; q < nq; q++) ORD[CNT[QK[q]!]!++] = q;
    let k = -1;
    for (let a = 0; a < nq; a++) {
      const q = ORD[a]!, o = q * 10, n = QN[q]!;
      if (QK[q] !== k) {
        if (k >= 0) c2.fill();
        k = QK[q]!;
        c2.fillStyle = COL[k]!;
        c2.beginPath();
      }
      c2.moveTo(QV[o]!, QV[o + 1]!);
      for (let i = 1; i < n; i++) c2.lineTo(QV[o + i * 2]!, QV[o + i * 2 + 1]!);
      c2.closePath();
    }
    if (k >= 0) c2.fill();
  }
  return { at, paint, colors, stats };
}

/** "#rrggbb" at brightness b, as the terrain shades it (theme changes only). */
function shade(col: string, b: number) {
  const n = parseInt(col.slice(1), 16), f = (c: number) => (b <= 1 ? c * b : c + (255 - c) * (b - 1) * 0.9) | 0;
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
