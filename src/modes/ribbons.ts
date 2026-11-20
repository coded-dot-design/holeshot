// Ribbons: every road, track, trail and surface band drawn along its true curve at its true width,
// instead of coloured onto the ground's triangles (which made their edges zigzag along the grid, worst
// at a distance where the ground is drawn coarser). One module for every mode: Endless Wheelie City
// and the Mashup walk their road graph with it (./wheelie/ribbons.ts), the race tracks, Free Ride's
// maps and Track Day's circuits are closed lines with bands across them (`lineRibbon`), and
// `drawnKinds` gives the ground under a ribbon the colour of what lies round it.
// - What is drawn is what is ridden: a ribbon's edge is the line's offset at the band's half-width
//   (mitred at the joints), every corner on the ground the bike rides (the terrain's height there, by
//   its own split rule). Render only: heights and face kinds are untouched.
// - One decal in the terrain cluster: quads cut finer near the eye, clipped at the near plane, shaded
//   by their slope with the terrain's own rule, painted far to near in depth buckets (a jump's lip over
//   its landing) and, in a bucket, one path per material and shade. Each band reaches a little under
//   the next one painted over it, and each quad a little back over the one before: no hairline seams.
// - Zero allocation per frame: fixed typed arrays, and no double crosses a call that might not be
//   inlined (V8 would box it): inputs and results go through scratch arrays. Colours are made when the
//   scene is built.

/** Shade levels a material is painted in. */
const LV = 33;
/** The near plane the quads are clipped at (depth, world units). */
const ZN = 0.3;
/** How far a band reaches in under the next one painted over it (units), and how far back each quad
 *  reaches over the one before it (of its length). */
export const UL = 0.15, OV = 0.04;

/** What ribbons stand on: a heightfield (a terrain, or a window of one). */
export interface RibbonGround { h: Float64Array; x0: number; z0: number; cols: number; rows: number; cell: number; split?: string }
/** What they are seen through: the diorama's camera and size. */
export interface RibbonView {
  cam: { yaw: number; pitch: number; dist: number; tx: number; ty: number; tz: number; fov: number; ox: number; oy: number };
  readonly width: number;
  readonly height: number;
}

/** The painter: `nm` materials, `nb` depth buckets (1: material order only), up to `qmax` quads a frame. */
export function ribbons(t: RibbonGround, view: RibbonView, nm: number, nb = 1, qmax = 3072) {
  const NK = nm * LV, NKB = NK * nb;
  const QV = new Float64Array(qmax * 10), QN = new Uint8Array(qmax), QK = new Uint32Array(qmax), ORD = new Int32Array(qmax), CNT = new Int32Array(NKB + 1);
  const COL: string[] = [];
  /** Scratch: the polygon to emit (world [x y z] × 4; slot 4 a clipped corner), its screen points and
   *  depths; the light; the camera's basis (eye, right, up, forward, focal, screen middle); the ground's
   *  extent [x0, z0, x1, z1]; BK: the depth bucket for the quads emitted next ([0]). */
  const WP = new Float64Array(15), WZ = new Float64Array(5), SP = new Float64Array(10), L = new Float64Array(4), B = new Float64Array(15), X = new Float64Array(4), BK = new Int32Array(1);
  const stats = { quads: 0, dropped: 0, fills: 0 };
  let nq = 0;

  /** The colours (a theme change): each material's colour as the terrain draws it, light and ambient. */
  function colors(mc: ArrayLike<string>, light: ArrayLike<number>, amb: number) {
    COL.length = 0;
    for (let m = 0; m < nm; m++) for (let l = 0; l < LV; l++) COL.push(shade(mc[m]!, 0.5 + (l / 40) * 0.62));
    const ll = Math.sqrt(light[0]! * light[0]! + light[1]! * light[1]! + light[2]! * light[2]!) || 1;
    L[0] = light[0]! / ll; L[1] = light[1]! / ll; L[2] = light[2]! / ll; L[3] = amb;
  }

  /** The ground's height under point (A[o], A[o + 2]) into A[o + 1]: the face there, split as the
   *  ground splits it ("adaptive": along the smaller height difference; else along (i, j)–(i + 1, j + 1)). */
  // The ground's grid as numbers (x0, z0, cell, cols, rows, adaptive 1): read once a frame (begin),
  // so the height lookups do no property loads.
  const G = new Float64Array(6), VW = new Float64Array(2), HS = t.h;
  function grid() {
    G[0] = t.x0; G[1] = t.z0; G[2] = t.cell; G[3] = t.cols; G[4] = t.rows; G[5] = t.split === "adaptive" ? 1 : 0;
  }
  grid();
  function hy(A: Float64Array, o: number) {
    const c = G[2]!, n = G[3]!, m = G[4]!, W1 = n + 1, hs = HS, x = A[o]!, z = A[o + 2]!;
    let u = (x - G[0]!) / c, v = (z - G[1]!) / c;
    u = u < 0 ? 0 : u > n ? n : u; v = v < 0 ? 0 : v > m ? m : v;
    let i = Math.floor(u), j = Math.floor(v);
    if (i > n - 1) i = n - 1;
    if (j > m - 1) j = m - 1;
    const fu = u - i, fv = v - j, k = j * W1 + i, a = hs[k]!, b = hs[k + 1]!, cc = hs[k + W1 + 1]!, d = hs[k + W1]!;
    const fl = G[5]! > 0 && Math.abs(b - d) < Math.abs(cc - a), up = fl ? fu + fv > 1 : fu >= fv;
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
  /** The depth bucket of world point (A[o], A[o + 1], A[o + 2]) into BK[0]: far first, finer near. */
  function bucket(A: Float64Array, o: number) {
    if (nb === 1) return void (BK[0] = 0);
    const zz = (A[o]! - B[0]!) * B[9]! + (A[o + 1]! - B[1]!) * B[10]! + (A[o + 2]! - B[2]!) * B[11]!, u = zz > 4 ? 4 / zz : 1, b = Math.floor(u * nb);
    BK[0] = b >= nb ? nb - 1 : b;
  }

  /** Emit the polygon in WP (n = 3 or 4 corners, world) as material m: shaded by its normal, clipped
   *  at the near plane, culled off screen, in depth bucket BK[0]. */
  function emit(m: number, n: number) {
    if (nq >= qmax) return void stats.dropped++;
    let back = 0;
    for (let i = 0; i < n; i++) (prj(i), WZ[i]! < ZN && back++);
    if (back === n) return;
    // The normal (the diagonals' cross product, a triangle's two sides'), up.
    const a = n === 4 ? 2 : 1, b = n === 4 ? 3 : 2, c1 = n === 4 ? 1 : 0;
    const ux = WP[a * 3]! - WP[0]!, uy = WP[a * 3 + 1]! - WP[1]!, uz = WP[a * 3 + 2]! - WP[2]!;
    const vx = WP[b * 3]! - WP[c1 * 3]!, vy = WP[b * 3 + 1]! - WP[c1 * 3 + 1]!, vz = WP[b * 3 + 2]! - WP[c1 * 3 + 2]!;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (ny < 0) (nx = -nx), (ny = -ny), (nz = -nz);
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) + 1e-12, dot = (nx * L[0]! + ny * L[1]! + nz * L[2]!) / nl;
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
    const Wd = VW[0]!, H = VW[1]!;
    for (let i = 0; i < k; i++) {
      const x = QV[o + i * 2]!, y = QV[o + i * 2 + 1]!;
      if (x < 0) l0++; if (x > Wd) r0++; if (y < 0) t0++; if (y > H) b0++;
    }
    if (l0 === k || r0 === k || t0 === k || b0 === k) return;
    // One winding on screen for every piece (a path of pieces fills by the non-zero rule: two that
    // overlap wound opposite ways would cut a hole).
    let ar = 0;
    for (let i = 0; i < k; i++) {
      const j = i + 1 === k ? 0 : i + 1;
      ar += QV[o + i * 2]! * QV[o + j * 2 + 1]! - QV[o + j * 2]! * QV[o + i * 2 + 1]!;
    }
    if (ar < 0)
      for (let i = 0, j = k - 1; i < j; i++, j--) {
        const x = QV[o + i * 2]!, y = QV[o + i * 2 + 1]!;
        QV[o + i * 2] = QV[o + j * 2]!; QV[o + i * 2 + 1] = QV[o + j * 2 + 1]!; QV[o + j * 2] = x; QV[o + j * 2 + 1] = y;
      }
    QN[nq] = k; QK[nq] = BK[0]! * NK + m * LV + lvl; nq++;
  }

  /** Start a frame: the camera's basis (the diorama's) and the ground's extent; no quads yet. */
  function begin() {
    nq = 0; stats.dropped = 0; BK[0] = 0;
    const cm = view.cam, cp = Math.cos(cm.pitch), sp = Math.sin(cm.pitch), cy = Math.cos(cm.yaw), sy = Math.sin(cm.yaw);
    B[0] = cm.tx + cm.dist * sy * cp; B[1] = cm.ty + cm.dist * sp; B[2] = cm.tz + cm.dist * cy * cp;
    B[3] = cy; B[4] = 0; B[5] = -sy;
    B[6] = -sy * sp; B[7] = cp; B[8] = -cy * sp;
    B[9] = -sy * cp; B[10] = -sp; B[11] = -cy * cp;
    B[12] = view.height / 2 / Math.tan(cm.fov / 2); B[13] = view.width / 2 + cm.ox; B[14] = view.height / 2 + cm.oy;
    X[0] = t.x0; X[1] = t.z0; X[2] = t.x0 + t.cols * t.cell; X[3] = t.z0 + t.rows * t.cell;
    grid();
    VW[0] = view.width; VW[1] = view.height;
  }
  /** Paint the frame's quads: sorted by key (depth bucket far to near, material, shade), one path and
   *  one fill each. */
  function flush(c2: CanvasRenderingContext2D) {
    stats.quads = nq;
    CNT.fill(0);
    for (let q = 0; q < nq; q++) CNT[QK[q]! + 1]!++;
    for (let k = 0; k < NKB; k++) CNT[k + 1] = CNT[k + 1]! + CNT[k]!;
    for (let q = 0; q < nq; q++) ORD[CNT[QK[q]!]!++] = q;
    let k = -1, fills = 0;
    for (let a = 0; a < nq; a++) {
      const q = ORD[a]!, o = q * 10, n = QN[q]!;
      if (QK[q] !== k) {
        if (k >= 0) c2.fill();
        k = QK[q]!;
        c2.fillStyle = COL[k % NK]!;
        c2.beginPath();
        fills++;
      }
      c2.moveTo(QV[o]!, QV[o + 1]!);
      for (let i = 1; i < n; i++) c2.lineTo(QV[o + i * 2]!, QV[o + i * 2 + 1]!);
      c2.closePath();
    }
    if (k >= 0) c2.fill();
    stats.fills = fills;
  }

  /** A ring from GA (middle x, z; radii r0 to r1; r0 0: a disc) as material m, each side starting OV
   *  of a side back, under the one before it. */
  const RS = 48, RCS = new Float64Array(RS * 4), GA = new Float64Array(4);
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
  return { T: t, G, WP, B, X, BK, GA, hy, emit, bucket, begin, flush, ring, colors, stats };
}
export type Ribbons = ReturnType<typeof ribbons>;

/** A closed line with bands across it: `P` its points [x, z, …] (n of them), `E` the bands' edges
 *  across it, left to right (offsets from the line, nb + 1 of them), `BM` each band's material (−1:
 *  the material along the line, from `along`), `along()` the material at line position XS[0]
 *  (point index + fraction; −1: not drawn there). Paints the bands round (x, z) within `reach` (set
 *  in `at`) through the painter `R` (begin and flush are the caller's). */
export function lineRibbon(R: Ribbons, P: Float64Array, n: number, E: ArrayLike<number>, BM: ArrayLike<number>, along: () => number) {
  const nb = BM.length, WP = R.WP, B = R.B, hy = R.hy, emit = R.emit;
  /** Where to paint round: x, z, reach (set before `paint`). The line position along() reads. */
  const at = new Float64Array([0, 0, 1e9]), XS = new Float64Array(1);
  /** Each point's mitred across direction (unit normal scaled by 1 / cos of half the turn) and the
   *  turn there (radians): made once. */
  const MN = new Float64Array(n * 2), TA = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const p = (i + n - 1) % n, q = (i + 1) % n;
    let ax = P[i * 2]! - P[p * 2]!, az = P[i * 2 + 1]! - P[p * 2 + 1]!, bx = P[q * 2]! - P[i * 2]!, bz = P[q * 2 + 1]! - P[i * 2 + 1]!;
    const la = Math.sqrt(ax * ax + az * az) || 1, lb = Math.sqrt(bx * bx + bz * bz) || 1;
    ax /= la; az /= la; bx /= lb; bz /= lb;
    const nax = -az, naz = ax, nbx = -bz, nbz = bx, d = 1 + nax * nbx + naz * nbz;
    MN[i * 2] = d > 0.2 ? (nax + nbx) / d : nbx; MN[i * 2 + 1] = d > 0.2 ? (naz + nbz) / d : nbz;
    TA[i] = Math.acos(Math.max(-1, Math.min(1, ax * bx + az * bz)));
  }
  /** Rows: [0..] the previous row's edge points (x y z per edge, plus each edge's UL-shifted twin
   *  for the band that reaches under its neighbour), then this row's; RA: the row to make (x, z, across
   *  x, z); RM: each row's along-material. */
  const ne = nb + 1, RW = ne * 6, Rw = new Float64Array(RW * 2), RA = new Float64Array(4), RM = new Int32Array(2);
  /** UD[e]: which way edge e's twin shifts (into the band painted over it), 0 none. */
  const UD = new Float64Array(ne);
  // Paint order is material order: a band reaches UL under a neighbour with a higher material.
  for (let e = 1; e < nb; e++) {
    const l = BM[e - 1]!, r = BM[e]!;
    UD[e] = l >= 0 && r >= 0 ? (r > l ? 1 : -1) : 0;
  }
  function row(r: number) {
    const o = r * RW, x = RA[0]!, z = RA[1]!, nx = RA[2]!, nz = RA[3]!;
    for (let e = 0; e < ne; e++) {
      const w = E[e]!, k = o + e * 6;
      Rw[k] = x + nx * w; Rw[k + 2] = z + nz * w; hy(Rw, k);
      const w2 = w + UD[e]! * UL;
      Rw[k + 3] = x + nx * w2; Rw[k + 5] = z + nz * w2; hy(Rw, k + 3);
    }
  }
  /** Hidden by the ground? Each row's edges are tested on the way to the eye (a ray over the
   *  heights), and a band piece is cut where its edge goes behind a crest, so ground in front of a
   *  ribbon hides it as it hides the ground (the ribbons are painted after the ground). VS: each
   *  edge's visibility, previous row then this; RF: each row's line position; CV: each edge's cut
   *  (0..1 from the previous row) where its visibility changes; Q: the point tested. */
  const VS = new Uint8Array(ne * 2), RF = new Float64Array(2), CV = new Float64Array(ne), Q = new Float64Array(6);
  let HMAX = -Infinity;
  for (let k = 0; k < R.T.h.length; k++) if (R.T.h[k]! > HMAX) HMAX = R.T.h[k]!;
  /** Is (Q[0], Q[1], Q[2]) in view (no ground between it and the eye)? */
  function seen() {
    const qx = Q[0]!, qy = Q[1]! + 0.03, qz = Q[2]!, dx = B[0]! - qx, dy = B[1]! - qy, dz = B[2]! - qz, lh = Math.sqrt(dx * dx + dz * dz);
    if (lh < 1e-6) return 1;
    const st = R.G[2]! * 0.5, n2 = Math.floor(lh / st);
    for (let k = 2; k <= n2; k++) {
      const f = (k * st) / lh, y = qy + dy * f;
      if (y > HMAX) return 1;
      Q[3] = qx + dx * f; Q[5] = qz + dz * f;
      hy(Q, 3);
      if (Q[4]! > y) return 0;
    }
    return 1;
  }
  /** Row slot r's edges' visibility into VS. */
  function vrow(r: number) {
    for (let e = 0; e < ne; e++) {
      const k = r * RW + e * 6;
      Q[0] = Rw[k]!; Q[1] = Rw[k + 1]!; Q[2] = Rw[k + 2]!;
      VS[r * ne + e] = seen();
    }
  }
  /** Edge e's point at line position XS[0] into Q (and its visibility). */
  function edgeAt(e: number) {
    pos();
    Q[0] = RA[0]! + RA[2]! * E[e]!; Q[2] = RA[1]! + RA[3]! * E[e]!;
    hy(Q, 0);
    return seen();
  }
  /** Point on band side `o` (an offset into a row: an edge or its twin) at v (0: the previous row,
   *  1: this one; 0 reaches back OV of the length, at least 0.08 units: a short piece's overlap must
   *  still cover a pixel's anti-aliasing) into WP slot q. */
  const SV = new Float64Array(1);
  function side(o: number, q: number) {
    const ax = Rw[o]!, az = Rw[o + 2]!, dx = Rw[RW + o]! - ax, dz = Rw[RW + o + 2]! - az, ln = Math.sqrt(dx * dx + dz * dz) + 1e-9, back = 0.08 / ln;
    let w = SV[0]!;
    if (w <= 0) w = back > OV ? -back : -OV;
    WP[q * 3] = ax + dx * w; WP[q * 3 + 2] = az + dz * w;
    hy(WP, q * 3);
  }
  /** The quads between the previous row and this one, band by band (along material m), each cut to
   *  the part in view. */
  function quads(m: number) {
    // Where each edge goes out of (or into) view between the rows.
    for (let e = 0; e < ne; e++) {
      const pv = VS[e]!, tv = VS[ne + e]!;
      if (pv === tv) continue;
      let lo = 0, hi = 1;
      for (let it = 0; it < 8; it++) {
        const h2 = (lo + hi) / 2;
        XS[0] = RF[0]! + (RF[1]! - RF[0]!) * h2;
        if (edgeAt(e) === pv) lo = h2;
        else hi = h2;
      }
      CV[e] = (lo + hi) / 2;
    }
    for (let b = 0; b < nb; b++) {
      const mat = BM[b]! >= 0 ? BM[b]! : m;
      if (mat < 0) continue;
      // The band's left edge: its twin if this band reaches under the left neighbour (UD < 0 there);
      // its right edge: the twin if it reaches under the right one (UD > 0).
      const la = b * 6 + (UD[b]! < 0 ? 3 : 0), lb = (b + 1) * 6 + (UD[b + 1]! > 0 ? 3 : 0);
      const lp = VS[b]!, lt = VS[ne + b]!, rp = VS[b + 1]!, rt = VS[ne + b + 1]!;
      if (!lp && !lt && !rp && !rt) continue;
      if (lp && lt && rp && rt) {
        ((SV[0] = 0), side(la, 0)); ((SV[0] = 0), side(lb, 1)); ((SV[0] = 1), side(lb, 2)); ((SV[0] = 1), side(la, 3));
        emit(mat, 4);
        continue;
      }
      // Each side's part in view [lo, hi] (none: −1).
      const l0 = lp ? 0 : lt ? CV[b]! : -1, l1 = lt ? 1 : lp ? CV[b]! : -1, r0 = rp ? 0 : rt ? CV[b + 1]! : -1, r1 = rt ? 1 : rp ? CV[b + 1]! : -1;
      let q = 0;
      if (l0 >= 0) ((SV[0] = l0), side(la, q++)), ((SV[0] = l1), side(la, q++));
      else ((SV[0] = rp ? r1 : r0), side(la, q++));
      if (r0 >= 0) ((SV[0] = r1), side(lb, q++)), ((SV[0] = r0), side(lb, q++));
      else ((SV[0] = lp ? l1 : l0), side(lb, q++));
      emit(mat, q);
    }
  }
  /** The line position XS[0] (point index + fraction) into RA (place, across). */
  function pos() {
    const f = XS[0]!;
    let i = Math.floor(f);
    const u = f - i;
    i = ((i % n) + n) % n;
    const j = (i + 1) % n;
    RA[0] = P[i * 2]! + (P[j * 2]! - P[i * 2]!) * u; RA[1] = P[i * 2 + 1]! + (P[j * 2 + 1]! - P[i * 2 + 1]!) * u;
    if (u < 1e-9) (RA[2] = MN[i * 2]!), (RA[3] = MN[i * 2 + 1]!);
    else {
      const dx = P[j * 2]! - P[i * 2]!, dz = P[j * 2 + 1]! - P[i * 2 + 1]!, l = Math.sqrt(dx * dx + dz * dz) || 1;
      RA[2] = -dz / l; RA[3] = dx / l;
    }
  }

  let open = false;
  /** A row at line position FR[0]: the quads back to the previous row (the material's change between
   *  them found by halving), or the first row of a stretch. (The position goes through FR: no double
   *  crosses the call.) */
  const FR = new Float64Array(1);
  function rowAt() {
    const f = FR[0]!;
    XS[0] = f;
    const m = along();
    pos();
    if (!open) {
      row(1); RM[1] = m; open = true; RF[1] = f; vrow(1);
      R.bucket(Rw, RW + Math.floor(ne / 2) * 6);
      return;
    }
    Rw.copyWithin(0, RW, RW * 2); RM[0] = RM[1]!; RF[0] = RF[1]!; VS.copyWithin(0, ne, ne * 2);
    if (m !== RM[0]) {
      // The material changes between the rows: halve to where, end the old stretch there and start the new.
      let lo = RF[0]!, hi = f;
      for (let it = 0; it < 9; it++) {
        XS[0] = (lo + hi) / 2;
        if (along() === RM[0]) lo = XS[0]!;
        else hi = XS[0]!;
      }
      XS[0] = hi;
      pos();
      row(1); RF[1] = hi; vrow(1);
      R.bucket(Rw, RW + Math.floor(ne / 2) * 6);
      quads(RM[0]!);
      Rw.copyWithin(0, RW, RW * 2); RF[0] = hi; VS.copyWithin(0, ne, ne * 2);
      XS[0] = f;
      pos();
    }
    row(1); RF[1] = f; vrow(1);
    R.bucket(Rw, RW + Math.floor(ne / 2) * 6);
    RM[1] = m;
    quads(m);
  }
  /** Paint the bands round `at` as the camera sees them now (between the painter's begin and flush).
   *  Rows every half cell near the eye (an edge between two rows is a straight line: the ground under
   *  it folds at every cell, so near it must be cut as fine), coarser out to 3 units far off, and at
   *  every point where the line turns. */
  function paint() {
    const bx = at[0]!, bz = at[1]!, reach = at[2]!, ex = B[0]!, ez = B[2]!, rim = E[0]! < 0 ? -E[0]! : E[0]!, rim2 = E[nb]! < 0 ? -E[nb]! : E[nb]!, wid = rim > rim2 ? rim : rim2, fine = R.G[2]! * 0.5;
    let acc = 0, turn = 0;
    open = false;
    for (let i = 0; i <= n; i++) {
      const k = i === n ? 0 : i, x = P[k * 2]!, z = P[k * 2 + 1]!, dbx = x - bx, dbz = z - bz;
      let sl = 0;
      if (i > 0) {
        const p = i - 1, dx = x - P[p * 2]!, dz = z - P[p * 2 + 1]!;
        sl = Math.sqrt(dx * dx + dz * dz);
        acc += sl;
        turn += TA[p]!;
      }
      if (dbx * dbx + dbz * dbz > (reach + wid) * (reach + wid)) { open = false; continue; }
      const dex = x - ex, dez = z - ez, de = Math.sqrt(dex * dex + dez * dez) * 0.025, step = de < fine ? fine : de > 2 ? 2 : de;
      XS[0] = i;
      if (open && i < n && acc < step && turn < 0.06 && along() === RM[1]) continue;
      // A long last stretch near the eye: rows between the points too.
      if (open && sl > step * 1.5) {
        const sub = Math.ceil(sl / step);
        for (let q = 1; q < sub; q++) (FR[0] = i - 1 + q / sub), rowAt();
      }
      FR[0] = i;
      rowAt();
      acc = turn = 0;
    }
  }
  return { at, XS, paint };
}

/** The kinds the ground is drawn with under a line's bands: a face whose corners all lie in one band
 *  keeps its kind; one across a band's edge takes the kind of the outermost band it touches (`BK[b]`,
 *  the last: what lies outside, 0 for the bare ground), so no grid shows past a ribbon's edge. Faces
 *  whose kind is not in `own` are left alone. `R` the bands' outer half-widths, inside out. Made once
 *  (a static ground: a race track, a Free Ride map). */
export function drawnKinds(t: RibbonGround & { kind: Uint8Array }, P: Float64Array, n: number, R: ArrayLike<number>, BK: ArrayLike<number>, own: ArrayLike<number>) {
  const DK = t.kind.slice(), C = t.cols, W1 = C + 1, rmax = R[R.length - 1]!, cell = t.cell;
  // Segment buckets on a grid of G-unit squares (build time only).
  const G = 4, gx0 = t.x0 - G, gz0 = t.z0 - G, GW = Math.ceil((C * cell) / G) + 3, GH = Math.ceil((t.rows * cell) / G) + 3, lists: number[][] = [];
  for (let k = 0; k < GW * GH; k++) lists.push([]);
  const reach = rmax + cell * 2;
  for (let s = 0; s < n; s++) {
    const a = s * 2, b = ((s + 1) % n) * 2;
    const xa = Math.min(P[a]!, P[b]!) - reach, xb = Math.max(P[a]!, P[b]!) + reach, za = Math.min(P[a + 1]!, P[b + 1]!) - reach, zb = Math.max(P[a + 1]!, P[b + 1]!) + reach;
    for (let j = Math.max(0, Math.floor((za - gz0) / G)); j <= Math.min(GH - 1, Math.floor((zb - gz0) / G)); j++)
      for (let i = Math.max(0, Math.floor((xa - gx0) / G)); i <= Math.min(GW - 1, Math.floor((xb - gx0) / G)); i++) lists[j * GW + i]!.push(s);
  }
  const band = (x: number, z: number) => {
    const i = Math.floor((x - gx0) / G), j = Math.floor((z - gz0) / G);
    let d = Infinity;
    if (i >= 0 && j >= 0 && i < GW && j < GH)
      for (const s of lists[j * GW + i]!) {
        const a = s * 2, b = ((s + 1) % n) * 2, ax = P[a]!, az = P[a + 1]!, dx = P[b]! - ax, dz = P[b + 1]! - az, l2 = dx * dx + dz * dz || 1;
        const u = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2)), px = x - ax - dx * u, pz = z - az - dz * u, e = Math.sqrt(px * px + pz * pz);
        if (e < d) d = e;
      }
    for (let k = 0; k < R.length; k++) if (d <= R[k]!) return k;
    return R.length;
  };
  const VB = new Int8Array(W1 * (t.rows + 1)).fill(-1), isOwn = new Set(Array.from(own));
  const vb = (i: number, j: number) => {
    const k = j * W1 + i;
    if (VB[k]! < 0) VB[k] = band(t.x0 + i * cell, t.z0 + j * cell);
    return VB[k]!;
  };
  // A face is drawn at every level of detail its cell anchors (terrainView draws a coarse cell, 2, 4 or
  // 8 fine ones a side, with its first fine cell's kind): it keeps its kind only if, at each of them,
  // its corners lie in one band.
  const adaptive = t.split === "adaptive", h = t.h;
  for (let j = 0; j < t.rows; j++)
    for (let i = 0; i < C; i++)
      for (let q = 0; q < 2; q++) {
        const o = (j * C + i) * 2 + q;
        if (!isOwn.has(DK[o]!)) continue;
        let top = -1, split = false;
        for (let st = 1; st <= 8 && i % st === 0 && j % st === 0 && i + st <= C && j + st <= t.rows; st *= 2) {
          // The triangle's corners: fixed split along (i, j)–(i + s, j + s), the one with (i + s, j)
          // first; adaptive, split along the smaller height difference (10–01: the one with (i + s, j + s) first).
          const k = j * W1 + i, fl = adaptive && Math.abs(h[k + st]! - h[k + st * W1]!) < Math.abs(h[k + st * W1 + st]! - h[k]!);
          // (Corners as [i, j] offsets in steps; each side's middle too: inside a turn the band's edge
          // bends in, and a side between two corners in the band can dip out of it.)
          const T = !fl ? (q ? [0, 0, 0, 1, 1, 1] : [0, 0, 1, 0, 1, 1]) : (q ? [1, 0, 0, 1, 0, 0] : [1, 0, 0, 1, 1, 1]);
          let lo = 99, hi = -1;
          for (let c = 0; c < 3; c++) {
            const u = T[c * 2]!, w = T[c * 2 + 1]!, u2 = T[((c + 1) % 3) * 2]!, w2 = T[((c + 1) % 3) * 2 + 1]!;
            const v = vb(i + u * st, j + w * st), m = band(t.x0 + (i + ((u + u2) / 2) * st) * cell, t.z0 + (j + ((w + w2) / 2) * st) * cell);
            lo = Math.min(lo, v, m); hi = Math.max(hi, v, m);
          }
          if (lo !== hi) split = true;
          if (hi > top) top = hi;
        }
        if (split) DK[o] = BK[top]!;
      }
  return DK;
}

/** "#rrggbb" at brightness b, as the terrain shades it (theme changes only). */
export function shade(col: string, b: number) {
  const n = parseInt(col.slice(1), 16), f = (c: number) => (b <= 1 ? c * b : c + (255 - c) * (b - 1) * 0.9) | 0;
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
