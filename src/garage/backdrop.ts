// The turntable's backdrops, built from the diorama's own shapes in flat colours (no images): TRACK,
// an MX day (rolling green hills, a dirt track with jumps, marker poles, a light sky) and SUNSET, a
// synthwave night (the cover's striped sun, purple mountains, stars, the neon floor). AUTO follows
// Day / Night. A list, so more can join later (as shop items: `price` is there for that, 0 now).
// The scene is static: it is added with the bike and drawn only when the preview redraws (on a
// change: a turn, a peek, a resize), never on a loop. Its group turns with the camera, so the
// scenery always stands behind the bike.
import type { Diorama } from "@fzlt/core/diorama";

export interface Backdrop { id: "auto" | "track" | "sunset"; name: string; price: number }
export const BACKDROPS: Backdrop[] = [
  { id: "auto", name: "Auto", price: 0 },
  { id: "track", name: "Track", price: 0 },
  { id: "sunset", name: "Sunset", price: 0 },
];
export type Scene = "track" | "sunset";
/** The scene shown: the pick, or (AUTO) the theme's. */
export const sceneOf = (pick: string | undefined, night: boolean): Scene => (pick === "track" || pick === "sunset" ? pick : night ? "sunset" : "track");
/** The pick after `pick` (the backdrop key cycles through the list). */
export const nextBackdrop = (pick: string | undefined) => BACKDROPS[(BACKDROPS.findIndex((b) => b.id === (pick ?? "auto")) + 1) % BACKDROPS.length]!.id;
/** The sky behind the scene (the diorama's background). */
export const skyOf = (s: Scene) => (s === "track" ? "#bfe4f2" : "#24124a");

type Add = Parameters<Diorama["add"]>[0];
/** Adds the scene to `dio` in a group facing the camera at `yaw` (the scene's back is −z from the view). */
export function addBackdrop(dio: Diorama, s: Scene, yaw: number) {
  dio.add({ id: "bd", shape: "group", size: [0, 0, 0], rot: [0, yaw, 0], pick: false });
  // Children of the group: positions in its frame (−z away from the eye), on its centre.
  const at = (d: Add) => dio.add({ pick: false, on: "bd", ...d });
  if (s === "track") {
    at({ size: [90, 0.04, 90], pos: [0, -0.16, -30], color: "#a6d98f", layer: 0 });
    for (const [x, z, w, h, c] of [[-22, -40, 30, 3.2, "#8fcf7d"], [12, -46, 38, 4, "#9ad687"], [32, -36, 24, 2.6, "#86c574"], [-2, -32, 20, 1.6, "#94d281"]] as const)
      at({ shape: "cyl", sides: 14, top: 0.25, size: [w, h, w * 0.45], pos: [x, -0.2, z], color: c, layer: 0.5 });
    // The dirt track: a loop of straights with two jumps (wedges) and its berm.
    for (const [x, z, w, r] of [[-5, -7, 14, 0.1], [8, -9.5, 10, -0.3], [-12, -11, 9, 0.5], [2, -13, 18, 0.04]] as const)
      at({ size: [w, 0.06, 1.8], pos: [x, -0.12, z], rot: [0, r, 0], color: "#d9b28a", layer: 1 });
    for (const [x, z, f] of [[-1, -7.3, 1], [10, -10, -1], [5, -13, 1]] as const)
      at({ shape: "wedge", size: [2.2, 0.9, 1.5], pos: [x, -0.1, z], rot: [0, f > 0 ? 0 : Math.PI, 0], color: "#c99a6e", layer: 1.2 });
    for (const [x, z] of [[-12, -5.6], [-5, -5.5], [3, -5.7], [10, -7.6], [15, -10.5], [-16, -10], [-7, -12.6], [11, -14.6]] as const) {
      at({ size: [0.12, 1.3, 0.12], pos: [x, -0.1, z], color: "#3a3a4c", layer: 1.5 });
      at({ size: [0.2, 0.22, 0.2], pos: [x, 1.2, z], color: "#ff6b2c", layer: 1.6 });
    }
  } else {
    at({ size: [90, 0.04, 90], pos: [0, -0.16, -30], color: "#2a1458", layer: 0 });
    for (let i = 0; i < 7; i++) at({ size: [90, 0.05, 0.08], pos: [0, -0.14, -3 - i * i * 1.2], color: i % 2 ? "#22e6ff" : "#ff4fa8", emissive: true, layer: 0.2 });
    // The sun: horizontal slices of a disc, yellow to pink, the gaps widening toward the horizon.
    const R = 6.5, cy = 1.2, z = -44;
    for (let i = 0; i < 14; i++) {
      const y0 = R - i * (2 * R / 14), gap = i < 6 ? 0 : (i - 5) * 0.05, h = 2 * R / 14 - gap * 2 * R / 14 * 2.4, y = y0 - R / 14;
      const w = 2 * Math.sqrt(Math.max(0, R * R - y * y));
      if (w < 0.3 || h <= 0.05) continue;
      const t = i / 13, col = t < 0.5 ? mix("#ffe27a", "#ffa04a", t * 2) : mix("#ffa04a", "#ff4f9a", (t - 0.5) * 2);
      at({ size: [w, h, 0.1], pos: [0, cy + y - h / 2, z], color: col, emissive: true, layer: 0.3 });
    }
    for (const [x, w, h, c] of [[-20, 16, 4.5, "#6a2f9e"], [-9, 12, 3.2, "#7d3cb5"], [9, 14, 4, "#6a2f9e"], [22, 18, 5, "#5a2788"], [1, 10, 2, "#8a47c4"]] as const)
      at({ shape: "cyl", sides: 4, top: 0, size: [w, h, w * 0.5], pos: [x, -0.2, -36], rot: [0, Math.PI / 4, 0], color: c, layer: 0.6 });
    for (let i = 0; i < 26; i++) {
      const x = ((i * 37) % 52) - 26, y = 4 + ((i * 53) % 9) * 0.9;
      if (Math.abs(x) < 8 && y < cy + R) continue;
      at({ size: [0.12, 0.12, 0.05], pos: [x, y, -46], color: "#fff4d6", emissive: true, layer: 0.25 });
    }
  }
}
const mix = (a: string, b: string, t: number) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("");
