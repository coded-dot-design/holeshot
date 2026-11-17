// Endless Desert as the track scene and Free Ride's session see it: a "track" with no line (one
// point, no features) and no table edge, carrying the endless world (./world.ts). The session
// (../freeride/session.ts) rides the world's window; the scene (../race/scene.ts) draws it with the
// desert's look (./look.ts).
import type { Track } from "../race/course.ts";
import { world, type World } from "./world.ts";

export const DESERT_SEED = 2611;
export type DesertTrack = Track & { isEndless: true; world: World };

/** The desert for `seed` (the same seed, the same sand everywhere). */
export function desertTrack(seed = DESERT_SEED): DesertTrack {
  const W = world(seed), NR = new Float64Array(4), z1 = new Float64Array(1);
  const fake = {
    id: "desert", name: "ENDLESS DESERT", isEndless: true as const, world: W,
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
