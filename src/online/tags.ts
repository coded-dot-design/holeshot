// Online riders on a canvas overlay, for every scene that draws other people (../modes/race/scene.ts,
// ../modes/wheelie/scene.ts): a name tag over a rider's head (a Board UI sticker in their colours,
// a callout after the name while one shows), and, in the endless rides, the "where's my friend"
// marker: an arrow on the screen's edge toward a rider off the screen, with their name and how far.
// Nothing allocated per frame but the tag's text.
import type { Diorama } from "@fzlt/core/diorama";
import { dist, type Units } from "../model/units.ts";
import { atan2 } from "../math.ts";

const T = new Float64Array(3);
/** The tags' font size for a canvas `w` wide (set on ctx2 by `font`). */
export function font(ctx2: CanvasRenderingContext2D, w: number) {
  const fs = Math.round(Math.max(10, Math.min(13, w / 70)));
  ctx2.font = `900 ${fs}px ui-rounded, system-ui, sans-serif`;
  ctx2.textBaseline = "middle";
  ctx2.textAlign = "center";
  return fs;
}
/** A sticker: `text` in a rounded box at (x, y) (its top left), a hard ink shadow. */
function sticker(ctx2: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number, color: string, ink: string) {
  ctx2.fillStyle = ink;
  ctx2.beginPath();
  ctx2.roundRect(x + 2, y + 2, w, h, 6);
  ctx2.fill();
  ctx2.fillStyle = color;
  ctx2.beginPath();
  ctx2.roundRect(x, y, w, h, 6);
  ctx2.fill();
  ctx2.fillStyle = ink;
  ctx2.fillText(text, x + w / 2, y + h / 2 + 0.5);
}
/** A rider's tag over world point (x, y, z) if it is on the screen; false when it is not. */
export function tag(ctx2: CanvasRenderingContext2D, dio: Diorama, x: number, y: number, z: number, text: string, color: string, ink: string, fs: number) {
  if (!dio.project(x, y, z, T) || T[2]! < 0.5 || T[0]! < 0 || T[0]! > dio.width || T[1]! < 0 || T[1]! > dio.height) return false;
  const w = ctx2.measureText(text).width + fs, h = fs + 8;
  sticker(ctx2, text, T[0]! - w / 2, T[1]! - h, w, h, color, ink);
  return true;
}
/** The marker for a rider at (dx, dz) from this screen's rider at `me` (d away): an arrow on the edge
 *  of the play area (below `top`) toward them, from where the camera looks (their bearing pulled in
 *  close and projected, or mirrored when it is behind the eye), and their name and distance. */
export function marker(ctx2: CanvasRenderingContext2D, dio: Diorama, me: ArrayLike<number>, dx: number, dz: number, d: number, name: string, color: string, ink: string, fs: number, top: number, units: Units = "imperial") {
  const W = dio.width, H = dio.height, cx = W / 2, cy = H / 2, k = 12 / (d || 1);
  let ux = 0, uy = 1;
  if (dio.project(me[0]! + dx * k, me[1]!, me[2]! + dz * k, T) && T[2]! >= 0.5) (ux = T[0]! - cx), (uy = T[1]! - cy);
  else if (dio.project(me[0]! - dx * k, me[1]!, me[2]! - dz * k, T) && T[2]! >= 0.5) (ux = cx - T[0]!), (uy = cy - T[1]!);
  const l = Math.sqrt(ux * ux + uy * uy) || 1, m = 28;
  ux /= l;
  uy /= l;
  const sx = ux > 0 ? (W - m - cx) / ux : ux < 0 ? (m - cx) / ux : Infinity, sy = uy > 0 ? (H - m - 60 - cy) / uy : uy < 0 ? (top - cy) / uy : Infinity, s = Math.max(0, Math.min(sx, sy));
  const x = cx + ux * s, y = cy + uy * s;
  ctx2.save();
  ctx2.translate(x, y);
  ctx2.rotate(atan2(uy, ux));
  ctx2.fillStyle = ink;
  ctx2.beginPath();
  ctx2.moveTo(16, 2); ctx2.lineTo(-6, -9); ctx2.lineTo(-6, 13); ctx2.closePath();
  ctx2.fill();
  ctx2.fillStyle = color;
  ctx2.strokeStyle = ink;
  ctx2.lineWidth = 2;
  ctx2.beginPath();
  ctx2.moveTo(14, 0); ctx2.lineTo(-8, -11); ctx2.lineTo(-8, 11); ctx2.closePath();
  ctx2.fill();
  ctx2.stroke();
  ctx2.restore();
  const text = `${name} · ${d >= 1000 ? dist(d, units) : units === "metric" ? Math.round(d) + " M" : Math.round(d * 3.28084) + " FT"}`, w = ctx2.measureText(text).width + fs, h = fs + 8;
  sticker(ctx2, text, Math.max(4, Math.min(W - w - 4, x - ux * 34 - w / 2)), Math.max(top - h / 2, Math.min(H - h - 4, y - uy * 30 - h / 2)), w, h, color, ink);
}
