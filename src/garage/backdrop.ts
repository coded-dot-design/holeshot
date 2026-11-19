// The turntable's backdrops: scenery behind the bike, built from the diorama's own shapes in flat
// colours (no images). TRACK is an MX day (rolling green hills, a dirt track with jumps, marker
// poles, a light sky); SUNSET a synthwave night (the cover's striped sun, purple mountains, stars).
// AUTO follows Day / Night. The scenes are a data list: one more is one more entry (with a `price`
// when backdrops become shop items; none are sold now).
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

export const BACKDROPS: Backdrop[] = [
  {
    id: "track", name: "Track", sky: "#bfe6f5", pitch: 0.2, ty: 3,
    build(put) {
      put({ size: [260, 0.02, 200], pos: [0, -0.02, -101], color: "#a9da92", layer: 0 });
      // Three bands of hills, far (hazy) to near (green), each a rolling silhouette.
      cut(put, ridge(-120, 120, 6, 7, 2.5, 0.4), -95, "#c3e3b8", 0.1);
      cut(put, ridge(-90, 90, 2.5, 6, 3.2, 2.1), -70, "#9fd38c", 0.2);
      cut(put, ridge(-70, 70, 0.5, 3.5, 4.1, 4.0), -48, "#8cc97a", 0.3);
      // The dirt track: an S of straights and berms with its lighter edge, two tabletop jumps.
      const run: [number, number, number, number][] = [[-24, -22, 22, 0.08], [-3, -26, 18, -0.35], [14, -31, 20, 0.12], [-16, -34, 26, -0.05], [6, -18, 26, 0.03], [24, -21, 10, 0.6]];
      for (const [x, z, w, r] of run) {
        put({ size: [w + 1, 0.03, 5], pos: [x, 0, z], rot: [0, r, 0], color: "#f0d9ae", layer: 1 });
        put({ size: [w, 0.05, 4], pos: [x, 0, z], rot: [0, r, 0], color: "#d4a578", layer: 1.1 });
      }
      for (const [x, z] of [[-12, -18.4], [9, -33.6]] as const) {
        put({ shape: "wedge", size: [2.4, 1.1, 4], pos: [x - 2.4, 0, z], rot: [0, Math.PI, 0], color: "#c08d60", layer: 1.2 });
        put({ size: [2.4, 1.1, 4], pos: [x, 0, z], color: "#cc9a6c", layer: 1.2 });
        put({ shape: "wedge", size: [2.4, 1.1, 4], pos: [x + 2.4, 0, z], color: "#b48257", layer: 1.2 });
      }
      // Marker poles: a dark post and an orange flag top, along the track's edge.
      for (const [x, z] of [[-30, -19], [-18, -19.5], [-6, -15], [4, -14.6], [16, -15.8], [27, -17], [-10, -29], [2, -30], [22, -27], [-26, -31]] as const) {
        put({ size: [0.16, 2, 0.16], pos: [x, 0, z], color: "#3a3a4c", layer: 1.5 });
        put({ size: [0.3, 0.4, 0.3], pos: [x, 1.8, z], color: "#ff6b2c", layer: 1.6 });
      }
    },
  },
  {
    id: "sunset", name: "Sunset", sky: "#2a1458", pitch: -0.1, ty: 2.4,
    build(put) {
      // The sky darkens up from a magenta haze at the horizon: flat bands, far behind everything.
      for (const [y, h, c] of [[0, 5, "#a3288c"], [5, 4, "#6e1f84"], [9, 5, "#4c1a76"], [14, 8, "#361564"]] as const)
        cut(put, [[-140, y], [140, y], [140, y + h], [-140, y + h]], -120, c, 0.01);
      for (let i = 0; i < 34; i++) {
        const r = Math.imul(i + 1, 2654435761) >>> 0, x = (r & 1023) / 1023 * 80 - 40, y = 10 + ((r >>> 12) & 1023) / 1023 * 26;
        if (Math.abs(x - 12) < 21 && y < 33) continue;
        put({ size: [0.22, 0.22, 0.05], pos: [x, y, -110], color: "#fff4d6", emissive: true, layer: 0.05 });
      }
      // The sun: slices of a disc, yellow to pink, the gaps (the sky through them) widening downward.
      const R = 19, cy = 13, z = -105, N = 18, sx = 12;
      for (let i = 0; i < N; i++) {
        const top = R - (i * 2 * R) / N, gap = i < 6 ? 0 : (i - 5) * 0.2, h = (2 * R) / N - gap;
        const y = top - h / 2, w = 2 * Math.sqrt(Math.max(0, R * R - y * y));
        if (w < 0.4 || h <= 0.1 || cy + top - h < 0) continue;
        const t = i / (N - 1), col = t < 0.5 ? mix("#ffe27a", "#ffb04a", t * 2) : mix("#ffb04a", "#ff5a9a", (t - 0.5) * 2);
        cut(put, [[sx - w / 2, cy + top - h], [sx + w / 2, cy + top - h], [sx + w / 2, cy + top], [sx - w / 2, cy + top]], z + 1, col, 0.1);
      }
      // Mountains: two ranges of purple peaks.
      cut(put, [[-80, -1], [-62, 9], [-48, 4], [-34, 14], [-18, 5], [-8, 8], [4, 2], [16, 11], [30, 4], [44, 13], [60, 5], [80, 8], [80, -1]], -90, "#5b2a96", 0.2);
      cut(put, [[-70, -1], [-52, 5], [-40, 2], [-26, 7], [-12, 1.5], [10, 1.5], [24, 6], [38, 2.5], [54, 8], [70, 3], [70, -1]], -70, "#7a3cb8", 0.3);
      // The floor: dark purple with the neon horizon (cyan) and a pink line nearer.
      put({ size: [260, 0.02, 200], pos: [0, -0.02, -101], color: "#2a1458", layer: 0.4 });
      put({ size: [260, 0.04, 0.6], pos: [0, 0, -62], color: "#22e6ff", emissive: true, layer: 0.5 });
      for (const [z, c] of [[-30, "#ff4fa8"], [-16, "#3d1d7a"], [-9, "#3d1d7a"]] as const)
        put({ size: [260, 0.04, 0.25], pos: [0, 0, z], color: c, emissive: true, layer: 0.5 });
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
