// Endless Desert as the track scene and Free Ride's session see it: a "track" with no line (one
// point, no features) and no table edge, carrying the endless world (./world.ts). The session
// (../freeride/session.ts) rides the world's window; the scene (../race/scene.ts) draws it with the
// desert's look (./look.ts).
import type { Track } from "../race/course.ts";
import { world, B_DESERT, B_QUARRY, B_FOREST, B_PARK, WIN, CELL, STEP, type World } from "./world.ts";

export const DESERT_SEED = 2611;
export type DesertTrack = Track & { isEndless: true; world: World; biome: Biome };
/** The endless biomes (the ENDLESS picker): the desert first (the default), then one per open Free
 *  Ride map, endless: its ground, its colours, its scenery (each its own seed: the same ground for
 *  everyone, so the best distances compare). `map`: the Free Ride map it is the endless version of. */
export interface Biome { id: string; name: string; blurb: string; bi: number; seed: number; map: string; word: string }
export const BIOMES: Biome[] = [
  { id: "desert", name: "THE DUNE SEA", blurb: "Endless dunes under a neon sky: ridges, bowls, peaks, kickers, a camp to ride to.", bi: B_DESERT, seed: DESERT_SEED, map: "dune-sea", word: "across the dunes" },
  { id: "quarry", name: "THE DEEP QUARRY", blurb: "Benches and faces that never stop: climb them, send the ledges, ride to the light towers.", bi: B_QUARRY, seed: 9133, map: "quarry", word: "through the quarry" },
  { id: "forest", name: "THE ENDLESS WOODS", blurb: "Wooded hills to the horizon: log jumps, roots, rock gardens. Mind the trees.", bi: B_FOREST, seed: 5521, map: "forest", word: "through the woods" },
  { id: "night-park", name: "THE NIGHT PARK", blurb: "A freeride park with no fence: doubles, rollers, pylons and towers, on and on.", bi: B_PARK, seed: 7781, map: "night-park", word: "through the park" },
];
export const biome = (id?: string) => BIOMES.find((b) => b.id === id) ?? BIOMES[0]!;

/** The endless ground for biome `id` (the desert by default; the same seed, the same ground everywhere). */
export function desertTrack(seed = DESERT_SEED, id = "desert"): DesertTrack {
  const B = biome(id), W = world(id === "desert" ? seed : B.seed, WIN, CELL, STEP, B.bi), NR = new Float64Array(4), z1 = new Float64Array(1);
  const fake = {
    id: B.id, name: B.name, isEndless: true as const, world: W, biome: B,
    HX: 1e9, HZ: 1e9, NT: 1, LAP: 1, GATE_S: 0, LINE_S: 0,
    TRACK: new Float64Array(2), YAW: new Float64Array(1), TURN: new Float64Array(1), WANT: new Float64Array(1).fill(10),
    NR, FK: new Int32Array(1), PF: z1,
    near: () => void ((NR[0] = 0), (NR[1] = 0), (NR[2] = 0), (NR[3] = 1)),
    prof: () => void (z1[0] = 0),
    sAt: () => 0,
    course: () => W.t,
    trackEdges: () => new Float64Array(6),
  };
  return fake as unknown as DesertTrack;
}
