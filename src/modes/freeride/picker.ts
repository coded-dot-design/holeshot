// LET'S RIDE → FREE RIDE: the maps. One key per map with a preview: the map seen from above (its
// ground by height, hill-shaded, its painted trail and faces), the ride line in neon, the start
// marked, and its features listed. Previews are drawn into small canvases after the card mounts,
// one map per frame (building a map's terrain takes a few tens of ms), and kept per map and theme.
import { FREE_MAPS } from "../index.ts";
import { makeTrack, MOTO_TRACK } from "../race/course.ts";
import { FEATURE_NAMES, type RideMap } from "./maps.ts";
import { previewColors } from "./scenery.ts";

/** One key per map (`<li>`s for LET'S RIDE's FREE RIDE group; `cls` on each key). */
export function mapTiles(cls = "") {
  return FREE_MAPS.map((m, i) => {
    const tags = m.open ? [...new Set(tagsOf(m.open()))] : ["DOUBLES", "WHOOPS", "TRIPLE", "TABLETOP"];
    return `<li><button type="button" class="bui-key dh-mapk ${cls}" data-map="${m.id}"><canvas class="dh-mapv" data-prev="${m.id}" aria-hidden="true"></canvas><b><i>${i + 1}</i> ${m.name}</b><small>${m.blurb}</small><em>${tags.slice(0, 4).join(" · ")}</em></button></li>`;
  }).join("");
}

/** The features a map is known for (its picker tags). */
function tagsOf(m: RideMap) {
  const out: string[] = [];
  for (let k = 0; k < m.FEATURES.length; k += 2) out.push(FEATURE_NAMES[m.FEATURES[k]!]!.replace(/^THE /, ""));
  if (m.def.banks.length) out.push(m.id === "night-park" ? "WALL RIDE" : "BERMS");
  if (m.id === "quarry") out.push("DROP-IN", "HILL CLIMBS", "LEDGES");
  if (m.NP) out.push("TREES");
  return out;
}

const cache = new Map<string, ImageData>();
let queue: HTMLCanvasElement[] = [], raf = 0;
/** Draw the previews in `root` (dark: the night look), one map per frame. */
export function paintMaps(root: ParentNode, night: boolean) {
  queue = [...root.querySelectorAll<HTMLCanvasElement>("canvas[data-prev]")];
  for (const c of queue) c.dataset.night = night ? "1" : "";
  if (!raf) raf = requestAnimationFrame(next);
}
function next() {
  raf = 0;
  const c = queue.shift();
  if (!c) return;
  if (c.isConnected) draw(c, c.dataset.prev!, !!c.dataset.night);
  if (queue.length) raf = requestAnimationFrame(next);
}

const hex = (s: string) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)] as const;
function draw(c: HTMLCanvasElement, id: string, night: boolean) {
  const f = FREE_MAPS.find((m) => m.id === id);
  if (!f) return;
  const key = id + (night ? ":n" : ":d");
  let img = cache.get(key);
  const m = f.open ? f.open() : null, tr = m ? null : makeTrack(f.plan ?? MOTO_TRACK);
  const t = m ? m.terrain : tr!.course();
  const W = t.cols, H = t.rows;
  if (!img) {
    // The look's colours (the loop: the race's night or day).
    const pc = m ? previewColors(m, night) : { bands: (night ? [[0.45, "#0c1530"], [0.85, "#101b3a"], [1.25, "#142045"], [99, "#1a2a58"]] : [[0.45, "#a8dcb4"], [0.85, "#9ad2a9"], [1.25, "#8cc79d"], [99, "#b9e6c2"]]) as [number, string][], kinds: night ? ["#3a2650", "#55356f"] : ["#d9a774", "#e8bf8f"] };
    const th = pc.bands.map((b) => b[0]), cols = pc.bands.map((b) => hex(b[1])), kinds = pc.kinds.map(hex);
    img = new ImageData(W, H);
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const x = t.x0 + (i + 0.5) * t.cell, z = t.z0 + (j + 0.5) * t.cell, h = t.height(x, z);
        const dx = t.height(x + t.cell, z) - t.height(x - t.cell, z), dz = t.height(x, z + t.cell) - t.height(x, z - t.cell);
        const shade = Math.max(0.55, Math.min(1.25, 1 - (dx * 0.5 + dz * 0.8) * 0.9));
        const kd = t.kindAt(x, z);
        let b = 0;
        while (b < th.length - 1 && h > th[b]!) b++;
        const col = kd && kinds[kd - 1] ? kinds[kd - 1]! : cols[Math.min(b, cols.length - 1)]!, o = (j * W + i) * 4;
        img.data[o] = Math.min(255, col[0] * shade), img.data[o + 1] = Math.min(255, col[1] * shade), img.data[o + 2] = Math.min(255, col[2] * shade), img.data[o + 3] = 255;
      }
    cache.set(key, img);
  }
  // Fit the map into the canvas, then the line over it.
  const r = c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), cw = Math.max(40, Math.round(r.width * dpr)), ch = Math.max(30, Math.round(r.height * dpr));
  c.width = cw, c.height = ch;
  const g = c.getContext("2d");
  if (!g) return;
  const tmp = document.createElement("canvas");
  tmp.width = W, tmp.height = H;
  tmp.getContext("2d")!.putImageData(img, 0, 0);
  const s = Math.min(cw / W, ch / H), ox = (cw - W * s) / 2, oy = (ch - H * s) / 2;
  g.fillStyle = night ? "#0a0918" : "#f2dcc4";
  g.fillRect(0, 0, cw, ch);
  g.imageSmoothingEnabled = true;
  g.drawImage(tmp, ox, oy, W * s, H * s);
  const line = m ?? tr!, P2 = (x: number, z: number) => [ox + ((x - t.x0) / t.cell) * s, oy + ((z - t.z0) / t.cell) * s] as const;
  g.lineWidth = Math.max(1.5, s * 0.9);
  g.lineJoin = "round";
  g.strokeStyle = night ? "#22e6ff" : "#0b8fa3";
  g.globalAlpha = 0.9;
  g.beginPath();
  for (let i = 0; i <= line.NT; i++) {
    const k = (i % line.NT) * 2, [px, py] = P2(line.TRACK[k]!, line.TRACK[k + 1]!);
    if (i) g.lineTo(px, py);
    else g.moveTo(px, py);
  }
  g.stroke();
  g.globalAlpha = 1;
  // The start.
  const sx = m ? m.SPAWN[0]! : line.TRACK[8]!, sz = m ? m.SPAWN[1]! : line.TRACK[9]!, [qx, qy] = P2(sx, sz);
  g.fillStyle = night ? "#ff4fa8" : "#d81b72";
  g.strokeStyle = night ? "#0a0918" : "#ffffff";
  g.lineWidth = Math.max(1.5, s * 0.6);
  g.beginPath();
  g.arc(qx, qy, Math.max(3, s * 2.2), 0, Math.PI * 2);
  g.fill();
  g.stroke();
}
