// The turntable's backdrops: scenery behind the bike, built from the diorama's own shapes in flat
// colours (no images), simple on purpose (a few big shapes). TRACK is an MX day: soft hills, one
// flowing dirt ribbon, a few marker poles, a light sky. SUNSET a synthwave night: a sun with a few
// stripes, two mountain silhouettes, stars and the vanishing tron grid. AUTO follows Day / Night.
// The scenes are a data list: one more is one more entry (with a `price` when backdrops become
// shop items; none are sold now).
// The scenery is static, so it is drawn ONCE per scene and size into a canvas of its own (its own
// diorama and a lower camera, a painted cyclorama) and the turntable paints that canvas first, in a
// fixed cluster under the bike: a redraw (a turn, a peek, a resize) costs one drawImage, not the
// scene's faces.
import { diorama, type Diorama } from "@fzlt/core/diorama";

type Add = Parameters<Diorama["add"]>[0];
type Put = (d: Add) => void;
/** One backdrop: its key, its name on the picker, the sky (the cache's clear colour), the camera's
 *  look down and height (the horizon's place) and its parts. */
export interface Backdrop { id: string; name: string; sky: string; pitch: number; ty: number; build: (put: Put) => void }

/** A flat silhouette standing across the view: `pts` are [x, y] in the plane z (a prism on its side). */
const cut = (put: Put, pts: [number, number][], z: number, color: string, layer: number) =>
  put({ shape: "prism", outline: pts.map(([x, y]) => [x, -y]), size: [1, 0.05, 1], pos: [0, 0, z], rot: [Math.PI / 2, 0, 0], color, layer, emissive: true });
/** A rolling ridge from x0 to x1: `n` humps of height `h` over `base`, sampled smooth. */
const ridge = (x0: number, x1: number, base: number, h: number, n: number, ph: number): [number, number][] => {
  const P: [number, number][] = [[x0, -1]];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32, x = x0 + (x1 - x0) * t;
    P.push([x, base + h * (0.55 + 0.45 * Math.sin(t * n * Math.PI * 2 + ph)) * (0.7 + 0.3 * Math.sin(t * 2.3 + ph * 2))]);
  }
  P.push([x1, -1]);
  return P;
};
const mix = (a: string, b: string, t: number) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("");

/** A flat band along the ground through `pts` ([x, z]), `w` wide (a prism lying down): the dirt. */
const band = (put: Put, pts: [number, number][], w: number, y: number, color: string, layer: number) => {
  const L: number[][] = [], R: number[][] = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i]!, [x0, z0] = pts[Math.max(0, i - 1)]!, [x1, z1] = pts[Math.min(pts.length - 1, i + 1)]!;
    const dx = x1 - x0, dz = z1 - z0, n = Math.hypot(dx, dz) || 1, nx = (-dz / n) * w / 2, nz = (dx / n) * w / 2;
    L.push([x + nx, z + nz]), R.push([x - nx, z - nz]);
  }
  put({ shape: "prism", outline: [...L, ...R.reverse()], size: [1, 0.03, 1], pos: [0, y, 0], color, layer });
};

export const BACKDROPS: Backdrop[] = [
  {
    id: "track", name: "Track", sky: "#c4e8f5", pitch: 0.2, ty: 3,
    build(put) {
      put({ size: [260, 0.02, 196], pos: [0, -0.02, -100], color: "#a9da92", layer: 0 });
      // Soft hills: a hazy far ridge and a green near one.
      cut(put, ridge(-120, 120, 5, 6, 1.6, 0.4), -95, "#c6e4bb", 0.1);
      cut(put, ridge(-90, 90, 1, 5, 2.2, 2.1), -62, "#98d184", 0.2);
      // One flowing dirt ribbon across the field, its lighter edge under it.
      const P: [number, number][] = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40, x = -46 + 92 * t;
        P.push([x, -24 - 7 * Math.sin(t * Math.PI * 2.2 + 0.6) - 4 * t]);
      }
      band(put, P, 5.6, 0, "#efd8ab", 1);
      band(put, P, 4.4, 0.01, "#d4a578", 1.1);
      // A few marker poles along it: a dark post and an orange flag top.
      for (const i of [4, 13, 22, 31]) {
        const [x, z] = P[i]!;
        put({ size: [0.16, 2, 0.16], pos: [x, 0, z + 3.6], color: "#3a3a4c", layer: 1.5 });
        put({ size: [0.3, 0.4, 0.3], pos: [x, 1.8, z + 3.6], color: "#ff6b2c", layer: 1.6 });
      }
    },
  },
  {
    id: "sunset", name: "Sunset", sky: "#2a1458", pitch: -0.1, ty: 2.4,
    build(put) {
      // A magenta haze at the horizon under the night sky, and a few stars.
      cut(put, [[-140, 0], [140, 0], [140, 6], [-140, 6]], -120, "#7a1f86", 0.01);
      for (let i = 0; i < 14; i++) {
        const r = Math.imul(i + 1, 2654435761) >>> 0, x = (r & 1023) / 1023 * 80 - 40, y = 12 + ((r >>> 12) & 1023) / 1023 * 24;
        if (Math.abs(x - 24) < 14 && y < 27) continue;
        put({ size: [0.24, 0.24, 0.05], pos: [x, y, -110], color: "#fff4d6", emissive: true, layer: 0.05 });
      }
      // The sun, up and to the right (clear of the rider): solid on top, a few stripes below.
      const R = 11, cy = 13, sx = 24, z = -104, N = 16;
      for (let i = 0; i < N; i++) {
        const top = R - (i * 2 * R) / N, gap = i < 9 ? 0 : 0.25 + (i - 9) * 0.16, h = (2 * R) / N - gap;
        const y = top - h / 2, w = 2 * Math.sqrt(Math.max(0, R * R - y * y));
        if (w < 0.4 || h <= 0.1) continue;
        const col = mix("#ffe27a", "#ff5a9a", i / (N - 1));
        cut(put, [[sx - w / 2, cy + top - h], [sx + w / 2, cy + top - h], [sx + w / 2, cy + top], [sx - w / 2, cy + top]], z, col, 0.1);
      }
      // Two mountain silhouettes.
      cut(put, [[-70, -1], [-50, 7], [-38, 3], [-22, 11], [-6, 2], [6, 2], [70, -1]], -80, "#5b2a96", 0.2);
      cut(put, [[-10, -1], [12, 3], [30, 9], [44, 4], [58, 8], [80, -1]], -72, "#7a3cb8", 0.3);
      // The floor: the vanishing tron grid, cyan on dark purple, running to the horizon.
      put({ size: [260, 0.02, 196], pos: [0, -0.02, -100], color: "#1c0d40", layer: 0.4 });
      for (let k = -14; k <= 14; k++) put({ size: [0.07, 0.03, 96], pos: [k * 3, 0, -50], color: "#22e6ff", emissive: true, layer: 0.5 });
      for (let j = 0; j < 9; j++) put({ size: [200, 0.03, 0.07 + j * 0.06], pos: [0, 0, -2 - 1.6 * j * j], color: "#22e6ff", emissive: true, layer: 0.5 });
    },
  },
];
/** The picks: AUTO, then every backdrop. */
export const PICKS: readonly (readonly [string, string])[] = [["auto", "Auto"], ...BACKDROPS.map((b) => [b.id, b.name] as const)];
/** AUTO's backdrop for the theme. */
const AUTO = { day: "track", night: "sunset" };
/** A saved pick kept only when it is still a backdrop (else AUTO). */
export const pickOf = (v: unknown): string => (typeof v === "string" && BACKDROPS.some((b) => b.id === v) ? v : "auto");
/** The backdrop shown: the pick, or (AUTO) the theme's. */
export const backdropOf = (pick: string | undefined, night: boolean): Backdrop => {
  const id = pickOf(pick) === "auto" ? AUTO[night ? "night" : "day"] : pick;
  return BACKDROPS.find((b) => b.id === id)!;
};

/** The painted backdrop for `b` at w × h CSS px (dpr), drawn once and kept until any of those change. */
export function backdropCache() {
  const cv = document.createElement("canvas");
  let dio: ReturnType<typeof diorama> | null = null, key = "", sky = "#000000";
  return (b: Backdrop, w: number, h: number, dpr: number) => {
    const k = b.id + w + "x" + h + "@" + dpr;
    if (k === key) return cv;
    key = k;
    sky = b.sky;
    dio ??= diorama(cv, { light: [-0.4, 1, 0.6], ambient: 0.62, background: () => sky, maxDpr: 2 });
    dio.resize(w, h, dpr);
    dio.clear();
    b.build((d) => void dio!.add({ pick: false, ...d }));
    Object.assign(dio.cam, { yaw: 0, pitch: b.pitch, dist: 6, tx: 0, ty: b.ty, tz: 0, ox: 0, oy: 0, fov: 0.55 });
    dio.draw();
    return cv;
  };
}
