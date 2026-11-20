// Endless Desert, drawn: the dune sea's palette (a neon night in dark, a hot pastel day in light),
// the sand's bands, the Tron grid laid over the sand (world-fixed lines every GRID units: they slide
// under the bike as it rides, so the ground reads as motion), the haze that swallows the far sand
// into the sky's horizon colour (so the window's edge is never seen), and the scenery streamed round
// the rider from a fixed pool: the lattice's cactus clusters, rock piles and camps with their beacon,
// placed from the same seeded lattice the sim's posts come from. Nothing here allocates per frame.
import type { Diorama, DioramaObject } from "@fzlt/core/diorama";
import type { Pal } from "../race/scene.ts";
import { featureOf, hash2, postDir, world, DIRS, FCELL, FAR_WIN, FAR_CELL, FAR_STEP, D_CACTUS, D_ROCKS, D_CAMP, B_DESERT, B_QUARRY, B_FOREST, type World } from "./world.ts";
import { lookColors } from "../freeride/scenery.ts";

/** Grid spacing (units), reach (units from the bike), haze start and full (units from the bike). */
export const GRID = 4, REACH = 34, HAZE0 = 20, HAZE1 = 35;
/** The far ring's bands (units from the eye: each band's near and far edge) and how far each one is
 *  gone into the haze (0: the sand, 1: the sky's horizon colour). The near haze fades to the first. */
export const BANDS = [34, 52, 52, 78, 78, 112, 112, 160, 160, 250];
const HAZES = [0.22, 0.3, 0.44, 0.58, 0.71, 0.83];
/** The grid's strength by theme (light sand needs more ink than the neon night). */
export const GRID_A = { night: 0.55, day: 0.62 };

export const DESERT_DARK: Partial<Pal> = {
  light: [-0.75, 0.55, 0.35], amb: 0.3,
  sky0: "#07031c", sky1: "#2a0b46", sky2: "#7a2470", grid: "#22e6ff", star: "#ffd6f2",
  ground: ["#3a1858", "#4c2070", "#5e2a86"], crest: "#8a44a8", steep: "#1c0b34", dust: "#b06ad8",
  edge: "#22e6ff", edge2: "#ffb13b", table: "#6a1d6a", tower: "#2a1a48", lamp: "#ffd166",
};
export const DESERT_LIGHT: Partial<Pal> = {
  light: [-0.75, 0.6, 0.35], amb: 0.42,
  sky0: "#8fd3ff", sky1: "#ffd9c2", sky2: "#ffeedd", grid: "#c8431f",
  ground: ["#f2c088", "#f5cc96", "#f8d8a6"], crest: "#fff0d4", steep: "#c9824e", dust: "#efc597",
  edge: "#13a9bb", edge2: "#ff7a59", table: "#fff1e0", tower: "#8a6a58", lamp: "#ffe08a",
};
/** The ground's bands by biome (the heights each biome's ground spans: benches, hills, the park's rolls). */
const BAND_H = [[1.2, 2.6, 4.2], [2.6, 5.2, 7.8], [1.5, 2.5, 3.4], [0.28, 0.5, 0.7]];
export const desertBands = (p: Pal, bi = 0): [number, string][] => [[BAND_H[bi]![0]!, p.ground[0]!], [BAND_H[bi]![1]!, p.ground[1]!], [BAND_H[bi]![2]!, p.ground[2]!], [99, p.crest]];
/** A biome's palette over the track scene's: the desert's own; the others their Free Ride map's
 *  colours (../freeride/scenery.ts), with the endless look's light and the haze's sky. */
const BIOME_MAP = ["dune-sea", "quarry", "forest", "night-park"];
export function biomePal(bi: number): { dark: Partial<Pal>; light: Partial<Pal> } {
  if (bi === B_DESERT) return { dark: DESERT_DARK, light: DESERT_LIGHT };
  const c = lookColors(BIOME_MAP[bi]!), d = c.dark as Partial<Pal> & { leafTop?: string }, l = c.light as Partial<Pal>;
  return {
    dark: { ...d, light: DESERT_DARK.light, amb: 0.3, grid: d.grid ?? d.edge, table: d.table ?? "#0b0618" },
    light: { ...l, light: DESERT_LIGHT.light, amb: 0.42, grid: l.edge ?? DESERT_LIGHT.grid },
  };
}

/** Lattice slots streamed round the rider (3 × 3 feature cells) and the parts each slot can show. */
const SLOTS = 9, CACTI = 4, ROCKS = 4;

export function desertView(d: Diorama, W: World) {
  const bi = W.biome;
  const F = new Float64Array(4), SL = new Float64Array(SLOTS * 3);
  const cacti: DioramaObject[] = [], rocks: DioramaObject[] = [], camps: DioramaObject[] = [], beams: DioramaObject[] = [];
  const objs: DioramaObject[] = [];
  let ci0 = NaN, cj0 = NaN;
  const PT = new Float64Array(3), PT2 = new Float64Array(3);
  // The far ring: the same ground, 4-unit cells, 544 units a side (view only; slides 16 units at a time).
  const FR = world(W.seed, FAR_WIN, FAR_CELL, FAR_STEP), NB = BANDS.length / 2;
  // Per screen column: its x, the near sand's top (its silhouette), each band's ridge (screen y).
  const COLS = 200, CX = new Float64Array(COLS), SIL = new Float64Array(COLS), RID = new Float64Array(COLS * NB);
  const HZ: string[] = [], CR: string[] = [];

  /** (Re)build the pool in palette p (a theme change rebuilds the scene). */
  function build(p: Pal) {
    // The bands' colours: the lit sand going into the sky's horizon colour, band by band; a crest line a step lighter.
    HZ.length = CR.length = 0;
    for (let k = 0; k <= NB; k++) HZ.push(mix(p.ground[k ? 0 : 2]!, p.sky2, HAZES[k]!)), CR.push(mix(p.crest, p.sky2, HAZES[k]! * 0.8));
    cacti.length = rocks.length = camps.length = beams.length = objs.length = 0;
    const q = p as Pal & { trunk?: string; leaf?: string; leafTop?: string; rock?: string; wall?: string };
    for (let s = 0; s < SLOTS; s++) {
      for (let k = 0; k < CACTI; k++) {
        const id = `dc${s}_${k}`;
        let g: DioramaObject;
        if (bi === B_FOREST) {
          // A neon tree: a trunk, a dark crown, a lit tip (the woods' posts).
          g = d.add({ id, shape: "cyl", sides: 5, size: [0.3, 0.9, 0.3], pos: [0, -50, 0], color: q.trunk!, pick: false, off: true });
          d.add({ id: id + "c", shape: "cyl", sides: 6, top: 0, size: [1.7, 2.2, 1.7], pos: [0, 0, 0], on: id, color: q.leaf!, pick: false });
          d.add({ shape: "cyl", sides: 6, top: 0, size: [0.8, 0.8, 0.8], pos: [0, -1, 0], on: id + "c", color: q.leafTop!, emissive: p.night, pick: false });
        } else if (bi !== B_DESERT) {
          // A pylon: a post with a neon tip (the park's and the quarry's markers).
          g = d.add({ id, shape: "cyl", sides: 6, size: [0.16, 1.1, 0.16], pos: [0, -50, 0], color: p.gatePost ?? p.tower, pick: false, off: true });
          d.add({ shape: "cyl", sides: 6, size: [0.26, 0.2, 0.26], on: id, color: k & 1 ? p.edge : p.edge2, emissive: true, pick: false });
        } else {
          g = d.add({ id, shape: "cyl", sides: 6, size: [0.32, 2, 0.32], pos: [0, -50, 0], color: p.night ? "#1f5a4a" : "#5f9a6a", pick: false, off: true });
          d.add({ shape: "cyl", sides: 6, size: [0.2, 0.8, 0.2], pos: [0.3, -1.1, 0], rot: [0, 0, 0], on: id, color: p.night ? "#1f5a4a" : "#5f9a6a", pick: false });
          d.add({ shape: "cyl", sides: 6, size: [0.34, 0.08, 0.34], on: id, color: p.night ? p.edge : "#b8f0a0", emissive: p.night, pick: false });
        }
        cacti.push(g), objs.push(g);
      }
      for (let k = 0; k < ROCKS; k++) {
        const r = d.add({ shape: "cyl", sides: 5, top: 0.5, size: [1, 0.6, 0.9], pos: [0, -50, 0], color: q.rock ?? (p.night ? "#2a1a48" : "#c98f6a"), pick: false, off: true });
        rocks.push(r), objs.push(r);
      }
      // A camp: a tent and its beacon (a tall pole with a lamp: something to ride to); the quarry's a
      // hopper on a rig, the woods' a cabin, the park's a light tower on its own.
      const cid = `dk${s}`, c = d.add({ id: cid, shape: "group", size: [1, 0, 1], pos: [0, -50, 0], pick: false, off: true, alpha: 0 });
      if (bi === B_DESERT) d.add({ shape: "cyl", sides: 4, top: 0, size: [2.2, 1.4, 2.2], pos: [2.2, 0, 1.4], on: cid, color: p.night ? "#3a1d5c" : "#ffffff", pick: false });
      else if (bi === B_QUARRY) {
        d.add({ id: cid + "h", size: [2.2, 1.4, 1.6], pos: [2.4, 0, 1.4], on: cid, color: p.tower, pick: false });
        d.add({ size: [2.22, 0.14, 1.62], pos: [0, -0.4, 0], on: cid + "h", color: p.rim, emissive: true, pick: false });
      } else if (bi === B_FOREST) {
        d.add({ id: cid + "h", size: [2.4, 1.3, 2], pos: [2.4, 0, 1.4], on: cid, color: q.wall ?? p.tower, pick: false });
        d.add({ shape: "wedge", size: [2.6, 0.8, 2.2], pos: [0, 0, 0], on: cid + "h", color: q.trunk ?? p.tower, pick: false });
        d.add({ size: [0.5, 0.4, 0.04], pos: [0.5, -0.55, 1.01], on: cid + "h", color: p.lamp, emissive: true, pick: false });
      }
      const pole = d.add({ id: cid + "p", shape: "cyl", sides: 6, size: [0.18, 5.2, 0.18], pos: [0, 0, 0], on: cid, color: p.tower, pick: false });
      void pole;
      const lamp = d.add({ shape: "box", size: [0.5, 0.5, 0.5], on: cid + "p", color: p.edge2, emissive: true, pick: false });
      camps.push(c), objs.push(c), beams.push(lamp);
    }
    ci0 = cj0 = NaN;
  }
  /** Put the pool on the 3 × 3 lattice cells round (x, z) (when the rider's cell changes). */
  function place(x: number, z: number) {
    const ci = Math.floor(x / FCELL), cj = Math.floor(z / FCELL);
    if (ci === ci0 && cj === cj0) return;
    ci0 = ci; cj0 = cj;
    // Let go: `off` takes the object and its parts (a camp's tent, pole and lamp) out of the draw and
    // skips their matrices; alpha 0 so `frame` fades in what is placed.
    for (let o = 0; o < objs.length; o++) {
      const ob = objs[o]!;
      ob.off = true; ob.alpha = 0;
    }
    let s = 0;
    for (let j = cj - 1; j <= cj + 1; j++)
      for (let i = ci - 1; i <= ci + 1; i++, s++) {
        const k = featureOf(W.seed, i, j, F, bi);
        SL[s * 3] = F[1]!; SL[s * 3 + 1] = F[2]!; SL[s * 3 + 2] = k;
        if (k === D_CACTUS || k === D_ROCKS) {
          for (let q = 0; q < 4; q++) {
            // The same places as the sim's posts (./world.ts postsNear).
            const a = postDir(i, j, q, W.seed), rr = 1.2 + hash2(i, j * 7 + q, W.seed + 91) * 3.2;
            const px = F[1]! + DIRS[a * 2]! * rr, pz = F[2]! + DIRS[a * 2 + 1]! * rr, y = W.height(px, pz);
            const ob = k === D_CACTUS ? cacti[s * CACTI + q]! : rocks[s * ROCKS + q]!;
            ob.pos[0] = px; ob.pos[1] = y - 0.1; ob.pos[2] = pz;
            ob.rot[1] = a * 1.7 + q;
            if (k === D_ROCKS) {
              const sz = 0.32 + hash2(i + q, j + q, W.seed + 92) * 0.3;
              ob.size[0] = sz * 3; ob.size[1] = sz * 1.8; ob.size[2] = sz * 2.6;
            } else ob.size[1] = bi === B_FOREST ? 0.8 + q * 0.15 : bi !== B_DESERT ? 1.1 : 1.6 + q * 0.3;
            ob.off = false;
          }
        } else if (k === D_CAMP) {
          const c = camps[s]!;
          c.pos[0] = F[1]!; c.pos[1] = W.height(F[1]!, F[2]!) - 0.1; c.pos[2] = F[2]!;
          c.off = false;
        }
      }
  }
  /** Each frame: stream the pool, fade what is out in the haze. (x, z): the bike. */
  function frame(x: number, z: number, night: boolean, time: number) {
    place(x, z);
    FR.follow(x, z);
    for (let o = 0; o < objs.length; o++) {
      const ob = objs[o]!;
      if (ob.off) continue;
      const dx = ob.pos[0]! - x, dz = ob.pos[2]! - z, dd = Math.sqrt(dx * dx + dz * dz);
      // Camps' beacons show further: they are what you ride to.
      const far = HAZE1 + 6;
      ob.alpha = dd < HAZE0 ? 1 : dd > far ? 0 : 1 - (dd - HAZE0) / (far - HAZE0);
    }
    for (let k = 0; k < beams.length; k++) beams[k]!.alpha = night ? 0.65 + 0.35 * Math.sin(time * 4 + k) : 1;
  }

  /** The grid over the sand round (x, z), faded by distance (painted in the terrain's sort, over the faces). */
  function paintGrid(ctx: CanvasRenderingContext2D, x: number, z: number, color: string, alpha: number) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, d.width / 1100);
    ctx.lineCap = "round";
    const gx0 = Math.ceil((x - REACH) / GRID) * GRID, gz0 = Math.ceil((z - REACH) / GRID) * GRID;
    for (let pass = 0; pass < 2; pass++) {
      for (let band = 0; band < 3; band++) {
        // Three rings: near, middle, far (fainter: the haze's job is finished by the fog).
        ctx.globalAlpha = alpha * (band === 0 ? 1 : band === 1 ? 0.6 : 0.3);
        const r0 = band === 0 ? 0 : band === 1 ? 12 : 22, r1 = band === 0 ? 12 : band === 1 ? 22 : REACH;
        ctx.beginPath();
        for (let g = pass ? gz0 : gx0; g <= (pass ? z : x) + REACH; g += GRID) {
          let pen = false;
          for (let s = -REACH; s <= REACH; s += 1) {
            const px = pass ? x + s : g, pz = pass ? g : z + s, dx = px - x, dz = pz - z, dd = Math.sqrt(dx * dx + dz * dz);
            if (dd < r0 || dd > r1) { pen = false; continue; }
            if (!d.project(px, W.t.height(px, pz) + 0.04, pz, PT) || PT[2]! < 0.5) { pen = false; continue; }
            if (pen) ctx.lineTo(PT[0]!, PT[1]!);
            else ctx.moveTo(PT[0]!, PT[1]!), (pen = true);
          }
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
  /** The far ring: dune ridgelines layered to the horizon, one band at a time from the farthest in
   *  (hazier the further), each drawn only above the near sand's silhouette (sampled down the same
   *  column), so a near crest always stands in front. Painted after the near sand and its haze. */
  function paintFar(ctx: CanvasRenderingContext2D) {
    const c = d.cam, cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
    const ex = c.tx + c.dist * sy * cp, ez = c.tz + c.dist * cy * cp;
    const fx = -sy, fz = -cy, rx = cy, rz = -sy, f = d.height / 2 / Math.tan(c.fov / 2), mid = d.width / 2 + c.ox;
    const n = Math.min(COLS, Math.max(24, Math.ceil(d.width / 14) + 1)), span = (d.width / 2 + 24) / f * cp, H = d.height;
    const nt = W.t, x0 = nt.x0, z0 = nt.z0, x1 = x0 + nt.cols * nt.cell, z1 = z0 + nt.rows * nt.cell;
    for (let i = 0; i < n; i++) {
      const u = -span + (2 * span * i) / (n - 1), l = Math.sqrt(1 + u * u), dx = (fx + rx * u) / l, dz = (fz + rz * u) / l;
      CX[i] = mid + (u * f) / cp;
      // The near sand's top down this column (to the window's edge).
      let top = H + 2;
      for (let r = 1.5; r < BANDS[0]! + 12; r += 0.8 + r * 0.07) {
        const px = ex + dx * r, pz = ez + dz * r;
        if (px <= x0 || pz <= z0 || px >= x1 || pz >= z1) break;
        if (d.project(px, nt.height(px, pz), pz, PT) && PT[2]! > 0.5 && PT[1]! < top) top = PT[1]!;
      }
      SIL[i] = top;
      for (let b = 0; b < NB; b++) {
        const r0 = BANDS[b * 2]!, r1 = BANDS[b * 2 + 1]!, st = (r1 - r0) / 6;
        let y = H + 2;
        for (let r = r0; r <= r1 + 0.01; r += st) {
          const px = ex + dx * r, pz = ez + dz * r;
          if (d.project(px, FR.t.height(px, pz), pz, PT) && PT[1]! < y) y = PT[1]!;
        }
        RID[b * COLS + i] = y;
      }
    }
    void sp;
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1.2, d.width / 700);
    for (let b = NB - 1; b >= 0; b--) {
      // The band: its ridge left to right, back along the near silhouette (clamped: where the near sand
      // is higher the band has no height there).
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const y = Math.min(RID[b * COLS + i]!, SIL[i]!);
        i ? ctx.lineTo(CX[i]!, y) : ctx.moveTo(CX[i]!, y);
      }
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(CX[i]!, SIL[i]!);
      ctx.closePath();
      ctx.fillStyle = HZ[b + 1]!;
      ctx.fill();
      // Its crest line, only where the ridge shows.
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i < n; i++) {
        const y = RID[b * COLS + i]!;
        if (y >= SIL[i]! - 0.5) { pen = false; continue; }
        if (pen) ctx.lineTo(CX[i]!, y);
        else ctx.moveTo(CX[i]!, y), (pen = true);
      }
      ctx.strokeStyle = CR[b + 1]!;
      ctx.stroke();
    }
  }
  /** The near haze's colour: the first band's (the far ring carries on from it). */
  const hazeColor = () => HZ[0]!;
  /** The horizon's screen y (the eye's level, straight ahead). */
  function horizon() {
    const c = d.cam, f = d.height / 2 / Math.tan(c.fov / 2);
    return d.height / 2 + c.oy - f * Math.tan(c.pitch);
  }
  /** The haze: the sky's horizon colour over the far sand, from the horizon down to where the sand
   *  HAZE0 units ahead of the bike meets the screen (and solid above HAZE1). */
  function paintFog(ctx: CanvasRenderingContext2D, x: number, z: number, color: string, g: { g: CanvasGradient | null; y0: number; y1: number }) {
    const c = d.cam, fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), y = W.t.height(x, z);
    const ok1 = d.project(x + fx * HAZE1, y, z + fz * HAZE1, PT), ok0 = d.project(x + fx * HAZE0, y, z + fz * HAZE0, PT2);
    const yh = horizon(), y1 = ok1 ? Math.max(yh, PT[1]!) : yh + 4, y0 = ok0 ? Math.max(y1 + 8, PT2[1]!) : y1 + 40;
    const top = yh - d.height * 0.1;
    if (!g.g || Math.abs(g.y0 - y0) > 3 || Math.abs(g.y1 - y1) > 3) {
      // One gradient: clear well above the horizon, solid from the horizon to the haze's full line,
      // clear again where the near sand starts (a tall far dune fades into the sky, never cut).
      const span = y0 - top || 1;
      g.g = ctx.createLinearGradient(0, top, 0, y0);
      g.g.addColorStop(0, color + "00");
      g.g.addColorStop(Math.max(0.01, (yh - top) / span), color);
      g.g.addColorStop(Math.min(0.98, Math.max(0.02, (y1 - top) / span)), color);
      g.g.addColorStop(1, color + "00");
      g.y0 = y0; g.y1 = y1;
    }
    ctx.fillStyle = g.g;
    ctx.fillRect(0, top, d.width, g.y0 - top);
  }
  return { build, frame, paintGrid, paintFog, paintFar, hazeColor, horizon, place, slots: SL, far: FR };
}
export type DesertView = ReturnType<typeof desertView>;

/** a → b by t, as "#rrggbb" (theme changes only). */
function mix(a: string, b: string, t: number) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  let o = 0;
  for (let s = 16; s >= 0; s -= 8) o |= Math.round(((A >> s) & 255) + (((B >> s) & 255) - ((A >> s) & 255)) * t) << s;
  return "#" + o.toString(16).padStart(6, "0");
}
