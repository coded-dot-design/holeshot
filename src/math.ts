// Deterministic transcendental maths for everything that builds a track or a map or steps a sim:
// sin, cos, tan, atan, atan2, pow and hypot from + − × ÷, square roots and bit reads only, so an iPhone
// (WebKit, whose builtins call the system's libm) and desktop Chrome (V8) agree to the last bit.
// The builtins may differ between engines in the last bit, and one bit in a track's heading is a
// different track: online, a desync. These are fdlibm 5.3's algorithms (s_sin.c, s_cos.c, s_tan.c,
// k_sin.c, k_cos.c, k_tan.c, e_pow.c, e_rem_pio2.c's medium path, s_atan.c, e_atan2.c), the same V8 ports
// for its Math.sin/cos/tan/atan/atan2, so on Chrome they give what the builtins gave (the generated
// tracks and the series stay what they were: tests/golden.test.mjs) and on every engine the same.
// `hypot` is V8's two-argument Math.hypot (scaled, compensated), written out. Rendering may still use
// the builtins (a pixel off is fine); tests/math.test.mjs keeps them out of the sim and generator
// modules. Allocation-free (one shared buffer for the bit reads).

const F = new Float64Array(1), I = new Int32Array(F.buffer);
/** High and low 32 bits of a double (little-endian, as every browser is). */
const hi = (x: number) => ((F[0] = x), I[1]!);
const lo = (x: number) => ((F[0] = x), I[0]!);
/** x with its low word zeroed. */
const lo0 = (x: number) => ((F[0] = x), (I[0] = 0), F[0]!);

// ---- the kernels on [−π/4, π/4] (y: the tail of the reduced argument) ----
const S1 = -1.66666666666666324348e-1, S2 = 8.33333333332248946124e-3, S3 = -1.98412698298579493134e-4, S4 = 2.75573137070700676789e-6, S5 = -2.50507602534068634195e-8, S6 = 1.58969099521155010221e-10;
function ksin(x: number, y: number, iy: number) {
  const ix = hi(x) & 0x7fffffff;
  if (ix < 0x3e400000 && (x | 0) === 0) return x;
  const z = x * x, v = z * x, r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  return iy === 0 ? x + v * (S1 + z * r) : x - (z * (0.5 * y - v * r) - y - v * S1);
}
const C1 = 4.16666666666666019037e-2, C2 = -1.38888888888741095749e-3, C3 = 2.48015872894767294178e-5, C4 = -2.75573143513906633035e-7, C5 = 2.08757232129817482790e-9, C6 = -1.13596475577881948265e-11;
function kcos(x: number, y: number) {
  const ix = hi(x) & 0x7fffffff;
  if (ix < 0x3e400000 && (x | 0) === 0) return 1;
  const z = x * x, r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  if (ix < 0x3fd33333) return 1 - (0.5 * z - (z * r - x * y));
  let qx: number;
  if (ix > 0x3fe90000) qx = 0.28125;
  else (I[1] = ix - 0x00200000), (I[0] = 0), (qx = F[0]!);
  const hz = 0.5 * z - qx, a = 1 - qx;
  return a - (hz - (z * r - x * y));
}
const T = [3.33333333333334091986e-1, 1.33333333333201242699e-1, 5.39682539762260521377e-2, 2.18694882948595424599e-2, 8.86323982359930005737e-3, 3.59207910759131235356e-3, 1.45620945432529025516e-3, 5.88041240820264096874e-4, 2.46463134818469906812e-4, 7.81794442939557092300e-5, 7.14072491382608190305e-5, -1.85586374855275456654e-5, 2.59073051863633712884e-5] as const;
const PIO4 = 7.85398163397448278999e-1, PIO4LO = 3.06161699786838301793e-17;
function ktan(x: number, y: number, iy: number) {
  const hx = hi(x), ix = hx & 0x7fffffff;
  let z: number, w: number, s: number, r: number, v: number;
  if (ix < 0x3e300000 && (x | 0) === 0) {
    if (((ix | lo(x)) | (iy + 1)) === 0) return 1 / Math.abs(x);
    if (iy === 1) return x;
    // −1/(x + y), carefully.
    w = x + y;
    z = lo0(w);
    v = y - (z - x);
    const a = -1 / w, t = lo0(a);
    s = 1 + t * z;
    return t + a * (s + t * v);
  }
  if (ix >= 0x3fe59428) {
    if (hx < 0) (x = -x), (y = -y);
    z = PIO4 - x;
    w = PIO4LO - y;
    x = z + w;
    y = 0;
  }
  z = x * x;
  w = z * z;
  r = T[1] + w * (T[3] + w * (T[5] + w * (T[7] + w * (T[9] + w * T[11]))));
  v = z * (T[2] + w * (T[4] + w * (T[6] + w * (T[8] + w * (T[10] + w * T[12])))));
  s = z * x;
  r = y + z * (s * (r + v) + y);
  r += T[0] * s;
  w = x + r;
  if (ix >= 0x3fe59428) {
    v = iy;
    return (1 - ((hx >> 30) & 2)) * (v - 2 * (x - ((w * w) / (w + v) - r)));
  }
  if (iy === 1) return w;
  z = lo0(w);
  v = r - (z - x);
  const a = -1 / w, t = lo0(a);
  s = 1 + t * z;
  return t + a * (s + t * v);
}

// ---- argument reduction: x = n·π/2 + (Y[0] + Y[1]) ----
const INVPIO2 = 6.36619772367581382433e-1, PIO2_1 = 1.57079632673412561417, PIO2_1T = 6.07710050650619224932e-11, PIO2_2 = 6.07710050630396597660e-11, PIO2_2T = 2.02226624879595063154e-21, PIO2_3 = 2.02226624871116645580e-21, PIO2_3T = 8.47842766036889956997e-32;
const Y = new Float64Array(2);
/** n (mod 4 is what matters) and the remainder in Y. Cody–Waite in three steps (fdlibm's medium path). */
function rem(x: number) {
  // Past 2^19·π/2 (never in the game): first x mod 2π (`%` is exact everywhere), so it stays defined.
  if ((hi(x) & 0x7fffffff) > 0x413921fb) x %= 6.283185307179586;
  const hx = hi(x), ix = hx & 0x7fffffff;
  if (ix < 0x4002d97c) {
    // |x| < 3π/4.
    let z: number;
    if (hx > 0) {
      z = x - PIO2_1;
      if (ix !== 0x3ff921fb) (Y[0] = z - PIO2_1T), (Y[1] = z - Y[0]! - PIO2_1T);
      else (z -= PIO2_2), (Y[0] = z - PIO2_2T), (Y[1] = z - Y[0]! - PIO2_2T);
      return 1;
    }
    z = x + PIO2_1;
    if (ix !== 0x3ff921fb) (Y[0] = z + PIO2_1T), (Y[1] = z - Y[0]! + PIO2_1T);
    else (z += PIO2_2), (Y[0] = z + PIO2_2T), (Y[1] = z - Y[0]! + PIO2_2T);
    return -1;
  }
  const t0 = Math.abs(x), n = Math.trunc(t0 * INVPIO2 + 0.5), fn = n;
  let r = t0 - fn * PIO2_1, w = fn * PIO2_1T;
  // (fdlibm skips this check for small n off its table of near-multiples; it is a no-op there.)
  const j = ix >> 20;
  Y[0] = r - w;
  let i = j - ((hi(Y[0]!) >> 20) & 0x7ff);
  if (i > 16) {
    let t = r;
    w = fn * PIO2_2;
    r = t - w;
    w = fn * PIO2_2T - (t - r - w);
    Y[0] = r - w;
    i = j - ((hi(Y[0]!) >> 20) & 0x7ff);
    if (i > 49) {
      t = r;
      w = fn * PIO2_3;
      r = t - w;
      w = fn * PIO2_3T - (t - r - w);
      Y[0] = r - w;
    }
  }
  Y[1] = r - Y[0]! - w;
  if (hx < 0) return (Y[0] = -Y[0]!), (Y[1] = -Y[1]!), -n;
  return n;
}

/** sin(x), the same bits on every engine. */
export function sin(x: number) {
  const ix = hi(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return ksin(x, 0, 0);
  if (ix >= 0x7ff00000) return NaN;
  const n = rem(x) & 3;
  return n === 0 ? ksin(Y[0]!, Y[1]!, 1) : n === 1 ? kcos(Y[0]!, Y[1]!) : n === 2 ? -ksin(Y[0]!, Y[1]!, 1) : -kcos(Y[0]!, Y[1]!);
}
/** cos(x). */
export function cos(x: number) {
  const ix = hi(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kcos(x, 0);
  if (ix >= 0x7ff00000) return NaN;
  const n = rem(x) & 3;
  return n === 0 ? kcos(Y[0]!, Y[1]!) : n === 1 ? -ksin(Y[0]!, Y[1]!, 1) : n === 2 ? -kcos(Y[0]!, Y[1]!) : ksin(Y[0]!, Y[1]!, 1);
}
/** tan(x). */
export function tan(x: number) {
  const ix = hi(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return ktan(x, 0, 1);
  if (ix >= 0x7ff00000) return NaN;
  const n = rem(x);
  return ktan(Y[0]!, Y[1]!, 1 - ((n & 1) << 1));
}

const ATANHI = [4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1, 1.57079632679489655800] as const;
const ATANLO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17] as const;
const AT = [3.33333333333329318027e-1, -1.99999999998764832476e-1, 1.42857142725034663711e-1, -1.11111104054623557880e-1, 9.09088713343650656196e-2, -7.69187620504482999495e-2, 6.66107313738753120669e-2, -5.83357013379057348645e-2, 4.97687799461593236017e-2, -3.65315727442169155270e-2, 1.62858201153657823623e-2] as const;
/** atan(x). */
export function atan(x: number) {
  const hx = hi(x), ix = hx & 0x7fffffff;
  let id: number;
  if (ix >= 0x44100000) {
    // |x| ≥ 2^66 (or NaN).
    if (x !== x) return x;
    return hx > 0 ? ATANHI[3] + ATANLO[3] : -ATANHI[3] - ATANLO[3];
  }
  if (ix < 0x3fdc0000) {
    if (ix < 0x3e200000) return x;
    id = -1;
  } else {
    x = Math.abs(x);
    if (ix < 0x3ff30000) {
      if (ix < 0x3fe60000) (id = 0), (x = (2 * x - 1) / (2 + x));
      else (id = 1), (x = (x - 1) / (x + 1));
    } else if (ix < 0x40038000) (id = 2), (x = (x - 1.5) / (1 + 1.5 * x));
    else (id = 3), (x = -1 / x);
  }
  const z = x * x, w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) return x - x * (s1 + s2);
  const r = ATANHI[id as 0] - (x * (s1 + s2) - ATANLO[id as 0] - x);
  return hx < 0 ? -r : r;
}
const PI = 3.1415926535897931160, PI_LO = 1.2246467991473531772e-16, PI_O_2 = 1.5707963267948965580, PI_O_4 = 7.8539816339744827900e-1;
/** atan2(y, x). */
export function atan2(y: number, x: number) {
  if (x !== x || y !== y) return NaN;
  const hx = hi(x), lx = lo(x), ix = hx & 0x7fffffff, hy = hi(y), ly = lo(y), iy = hy & 0x7fffffff;
  if (hx === 0x3ff00000 && lx === 0) return atan(y);
  const m = ((hy >> 31) & 1) | ((hx >> 30) & 2);
  if ((iy | ly) === 0) return m === 0 || m === 1 ? y : m === 2 ? PI : -PI;
  if ((ix | lx) === 0) return hy < 0 ? -PI_O_2 : PI_O_2;
  if (ix === 0x7ff00000) {
    if (iy === 0x7ff00000) return m === 0 ? PI_O_4 : m === 1 ? -PI_O_4 : m === 2 ? 3 * PI_O_4 : -3 * PI_O_4;
    return m === 0 ? 0 : m === 1 ? -0 : m === 2 ? PI : -PI;
  }
  if (iy === 0x7ff00000) return hy < 0 ? -PI_O_2 : PI_O_2;
  const k = (iy - ix) >> 20;
  let z: number;
  if (k > 60) z = PI_O_2 + 0.5 * PI_LO;
  else if (hx < 0 && k < -60) z = 0;
  else z = atan(Math.abs(y / x));
  return m === 0 ? z : m === 1 ? -z : m === 2 ? PI - (z - PI_LO) : z - PI_LO - PI;
}
/** √(x² + y²) without overflow: V8's two-argument Math.hypot (scaled to the larger, compensated). */
export function hypot(x: number, y: number) {
  const ax = Math.abs(x), ay = Math.abs(y), max = ax > ay ? ax : ay;
  if (max === Infinity) return Infinity;
  if (max === 0) return 0;
  const a = ax / max, b = ay / max;
  let sum = 0, comp = 0;
  const s1 = a * a - comp, p1 = sum + s1;
  comp = p1 - sum - s1;
  sum = p1;
  const s2 = b * b - comp, p2 = sum + s2;
  sum = p2;
  return Math.sqrt(sum) * max;
}

// ---- pow (fdlibm's e_pow.c: log2 of x in extra precision, times y, then 2^that) ----
const BP = [1, 1.5] as const, DP_H = [0, 5.84962487220764160156e-1] as const, DP_L = [0, 1.35003920212974897128e-8] as const;
const L1 = 5.99999999999994648725e-1, L2 = 4.28571428578550184252e-1, L3 = 3.33333329818377432918e-1, L4 = 2.72728123808534006489e-1, L5 = 2.30660745775561754067e-1, L6 = 2.06975017800338417784e-1;
const P1 = 1.66666666666666019037e-1, P2 = -2.77777777770155933842e-3, P3 = 6.61375632143793436117e-5, P4 = -1.65339022054652515390e-6, P5 = 4.13813679705723846039e-8;
const LG2 = 6.93147180559945286227e-1, LG2_H = 6.93147182464599609375e-1, LG2_L = -1.90465429995776804525e-9, OVT = 8.0085662595372944372e-17;
const CP = 9.61796693925975554329e-1, CP_H = 9.61796700954437255859e-1, CP_L = -7.02846165095275826516e-9, TWO53 = 9007199254740992;
/** A double from its two words. */
const make = (h: number, l: number) => ((I[1] = h), (I[0] = l), F[0]!);
/** 2^n for an integer n in the normal range (an exact power of two, built from its bits). */
const two = (n: number) => make((n + 0x3ff) << 20, 0);
/** x^y for x ≥ 0 (or x < 0 with an integer y) and finite y: the same bits on every engine. */
export function pow(x: number, y: number): number {
  if (y === 0) return 1;
  if (x !== x || y !== y) return NaN;
  if (y === 1) return x;
  if (y === 2) return x * x;
  if (y === 0.5 && x >= 0) return Math.sqrt(x);
  if (x < 0) {
    if (Math.trunc(y) !== y) return NaN;
    const r = pow(-x, y);
    return Math.trunc(y / 2) * 2 === y ? r : -r;
  }
  if (x === 0) return y > 0 ? 0 : Infinity;
  if (x === 1) return 1;
  if (x === Infinity) return y > 0 ? Infinity : 0;
  if (y === Infinity) return x > 1 ? Infinity : 0;
  if (y === -Infinity) return x > 1 ? 0 : Infinity;
  let ax = x, ix = hi(ax), n = 0;
  if (ix < 0x00100000) (ax *= TWO53), (n -= 53), (ix = hi(ax));
  n += (ix >> 20) - 0x3ff;
  const j0 = ix & 0x000fffff;
  ix = j0 | 0x3ff00000;
  let k: 0 | 1;
  if (j0 <= 0x3988e) k = 0;
  else if (j0 < 0xbb67a) k = 1;
  else (k = 0), (n += 1), (ix -= 0x00100000);
  ax = make(ix, lo(ax));
  // log2(ax) as t1 + t2.
  let u = ax - BP[k], v = 1 / (ax + BP[k]);
  const ss = u * v, s_h = lo0(ss);
  let t_h = make(((ix >> 1) | 0x20000000) + 0x00080000 + (k << 18), 0);
  let t_l = ax - (t_h - BP[k]);
  const s_l = v * (u - s_h * t_h - s_h * t_l);
  let s2 = ss * ss, r: number = s2 * s2 * (L1 + s2 * (L2 + s2 * (L3 + s2 * (L4 + s2 * (L5 + s2 * L6)))));
  r += s_l * (s_h + ss);
  s2 = s_h * s_h;
  t_h = lo0(3 + s2 + r);
  t_l = r - (t_h - 3 - s2);
  u = s_h * t_h;
  v = s_l * t_h + t_l * ss;
  const p_h0 = lo0(u + v), p_l0 = v - (p_h0 - u);
  const z_h = CP_H * p_h0, z_l = CP_L * p_h0 + p_l0 * CP + DP_L[k];
  const t = n, t1 = lo0(z_h + z_l + DP_H[k] + t), t2 = z_l - (t1 - t - DP_H[k] - z_h);
  // y · log2(x), split, then 2^that.
  const y1 = lo0(y);
  const p_l = (y - y1) * t1 + y * t2;
  let p_h = y1 * t1, z = p_l + p_h;
  let j = hi(z);
  const i0 = lo(z);
  if (j >= 0x40900000) {
    if (((j - 0x40900000) | i0) !== 0 || p_l + OVT > z - p_h) return Infinity;
  } else if ((j & 0x7fffffff) >= 0x4090cc00) {
    if (((j - 0xc090cc00) | i0) !== 0 || p_l <= z - p_h) return 0;
  }
  const i = j & 0x7fffffff;
  let kk = (i >> 20) - 0x3ff;
  n = 0;
  if (i > 0x3fe00000) {
    n = j + (0x00100000 >> (kk + 1));
    kk = ((n & 0x7fffffff) >> 20) - 0x3ff;
    const tt = make(n & ~(0x000fffff >> kk), 0);
    n = ((n & 0x000fffff) | 0x00100000) >> (20 - kk);
    if (j < 0) n = -n;
    p_h -= tt;
  }
  const tq = lo0(p_l + p_h);
  u = tq * LG2_H;
  v = (p_l - (tq - p_h)) * LG2 + tq * LG2_L;
  z = u + v;
  const w = v - (z - u), tz = z * z, w1 = z - tz * (P1 + tz * (P2 + tz * (P3 + tz * (P4 + tz * P5))));
  r = (z * w1) / (w1 - 2) - (w + z * w);
  z = 1 - (r - z);
  j = hi(z) + (n << 20);
  // Out of the normal range: scale in two exact steps (never in the game: its bases are 0..1).
  if (j >> 20 <= 0) return z * two(n + 600) * two(-600);
  return make(j, lo(z));
}
