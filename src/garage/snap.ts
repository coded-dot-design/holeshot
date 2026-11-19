// A still of a bike from the game's own diorama (the rig the turntable draws), for the showroom's
// cards and the comparison: each model new, in its maker's factory colours, side on, no rider, on a
// transparent ground (the card's tile shows through). One offscreen canvas draws them all; each still
// is kept as a WebP data URL (PNG where the browser has no WebP encoder) per model, theme and size, so a card is an <img> and a redraw costs
// nothing (tests/showroom.browser.mjs measures the first draw). Also the rig's metal and seat colours
// by theme (`rigKit`), shared with the turntable (../game.ts).
import { diorama } from "@fzlt/core/diorama";
import { bike as makeBike } from "../bike/bike.ts";
import { rig, type RigColors } from "../bike/rig.ts";
import { model } from "../data/roster.ts";
import { newBike, type Profile } from "../model/profile.ts";
import { tune } from "../model/tune.ts";
import { lookOf } from "./look.ts";

/** The rig's seat, frame, tyres, rims, metal, pipe and glow, by night (dark) or day (light). */
export const rigKit = (night: boolean) => night
  ? { seat: "#14121f", frame: "#2b2a3d", tyre: "#0f0f16", rim: "#9aa0c8", metal: "#c9cde6", pipe: "#7e86a8", glow: "#ff2e88" }
  : { seat: "#2a2833", frame: "#3a3a4c", tyre: "#24232b", rim: "#d9dbe6", metal: "#eceef7", pipe: "#9aa0b8", glow: "#ff3b30" };

const FLAT = { sample(_x: number, _z: number, out: { [i: number]: number }) { out[0] = 0; out[1] = 0; out[2] = 1; out[3] = 0; return 0; } };
const kept = new Map<string, string>();
let cv: HTMLCanvasElement | null = null, dio: ReturnType<typeof diorama> | null = null;
/** Draw time of every still so far (ms), for the measure. */
export const snapCost = { n: 0, ms: 0, bytes: 0 };

/** Model `id` new, side on, as a WebP data URL (PNG where the browser has no WebP encoder) of `w` × `h` CSS px (at 2× density). `p` gives the
 *  rider's number (the side plates). Kept: the same model, theme and size draw once. */
export function snap(id: string, p: Profile, night: boolean, w = 384, h = 216): string {
  const m = model(id), key = `${m.id}|${night ? 1 : 0}|${w}x${h}`, hit = kept.get(key);
  if (hit) return hit;
  const t0 = performance.now();
  cv ??= document.createElement("canvas");
  dio ??= diorama(cv, { light: [-0.4, 1, 0.6], ambient: 0.6, maxDpr: 2 });
  dio.resize(w, h, 2);
  dio.clear();
  const nb = newBike(m.id, "snap", "f-" + m.maker, p.bikes[p.ride]?.look.number ?? 7), P = { ...p, bikes: [nb], ride: 0 }, t = tune(nb), L = lookOf(P);
  const g = rig(dio, "snap", { ...rigKit(night), ...L.look } as RigColors, t.rig, L.helmet, t.model.id), b = makeBike(FLAT, t.power, t.shape);
  b.reset(0, 0, 0);
  g.pose(b, 0);
  // No rider: everything that hangs off the rider's group (its id chain through `on`) is hidden.
  const D = dio, riderOf = (o: { on: string | null }): boolean => { for (let id = o.on; id; id = D.get(id)?.on ?? null) if (id === "snap:r") return true; return false; };
  g.rider.hidden = true;
  for (const o of g.parts) if (riderOf(o)) o.hidden = true;
  Object.assign(dio.cam, { yaw: -0.3, pitch: 0.12, dist: 4, tx: 0, ty: 0.42, tz: 0, ox: 0, oy: 0, fov: 0.55 });
  dio.fit(dio.cam, [-1.05, -0.05, -0.4, 1.05, -0.05, 0.4, -1.05, 1.15, 0, 1.05, 1.15, 0], { x0: w * 0.06, y0: h * 0.08, x1: w * 0.94, y1: h * 0.94 });
  dio.draw();
  const url = cv.toDataURL("image/webp", 0.9);
  snapCost.n++;
  snapCost.ms += performance.now() - t0;
  snapCost.bytes += url.length;
  kept.set(key, url);
  return url;
}
