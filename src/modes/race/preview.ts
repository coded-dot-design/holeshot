// A track from above as an SVG string (the series screen's preview, and the media): the table, the
// loop as a neon line, each feature as a mark along it (filled by kind), the start gate and the
// direction of travel. Pure: a Track in, a string out; no DOM (the shell sets it as innerHTML).
import type { Track } from "./course.ts";

/** Feature kinds' short labels on the map (1 double … 7 finish). */
const MARK = ["", "D", "W", "T", "TT", "SU", "SD", "F"];

export function trackSvg(t: Track, o: { label?: string } = {}) {
  const W = t.HX * 2, H = t.HZ * 2, step = Math.max(1, Math.round(t.NT / 220));
  let d = "";
  for (let i = 0; i <= t.NT; i += step) {
    const k = (i % t.NT) * 2;
    d += `${i ? "L" : "M"}${(t.TRACK[k]! + t.HX).toFixed(2)} ${(t.TRACK[k + 1]! + t.HZ).toFixed(2)}`;
  }
  d += "Z";
  const marks: string[] = [];
  for (let k = 0; k < t.FEATURES.length; k += 2) {
    const kind = t.FEATURES[k]!, i = Math.round(t.FEATURES[k + 1]! / (t.LAP / t.NT)) % t.NT, x = t.TRACK[i * 2]! + t.HX, z = t.TRACK[i * 2 + 1]! + t.HZ;
    marks.push(`<g class="tp-f tp-f${kind}"><circle cx="${x.toFixed(2)}" cy="${z.toFixed(2)}" r="1.25"/><text x="${x.toFixed(2)}" y="${(z + 0.45).toFixed(2)}">${MARK[kind]}</text></g>`);
  }
  const g = Math.round(t.GATE_S / (t.LAP / t.NT)) % t.NT, gx = t.TRACK[g * 2]! + t.HX, gz = t.TRACK[g * 2 + 1]! + t.HZ, gy = t.YAW[g]!;
  const hx = Math.cos(gy), hz = -Math.sin(gy), nx = Math.sin(gy), nz = Math.cos(gy), f = (v: number) => v.toFixed(2);
  // The gate across the track, and an arrow just past it the way the loop runs.
  const tip = [gx + hx * 4.2, gz + hz * 4.2], b0 = [gx + hx * 2.4 + nx * 1.1, gz + hz * 2.4 + nz * 1.1], b1 = [gx + hx * 2.4 - nx * 1.1, gz + hz * 2.4 - nz * 1.1];
  const gate = `<line class="tp-gate" x1="${f(gx - nx * 2.2)}" y1="${f(gz - nz * 2.2)}" x2="${f(gx + nx * 2.2)}" y2="${f(gz + nz * 2.2)}"/><path class="tp-dir" d="M${f(tip[0]!)} ${f(tip[1]!)}L${f(b0[0]!)} ${f(b0[1]!)}L${f(b1[0]!)} ${f(b1[1]!)}Z"/>`;
  const label = o.label ?? t.name;
  return `<svg class="tp" viewBox="-1 -1 ${(W + 2).toFixed(1)} ${(H + 2).toFixed(1)}" role="img" aria-label="${label}: a map of the track"><rect class="tp-table" x="0" y="0" width="${W.toFixed(1)}" height="${H.toFixed(1)}" rx="1.5"/><path class="tp-edge" d="${d}"/><path class="tp-line" d="${d}"/>${gate}${marks.join("")}</svg>`;
}
