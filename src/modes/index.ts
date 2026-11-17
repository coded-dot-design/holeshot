// Every mode, one list: the shell's RIDE menu reads it, and a new mode is one entry here (see
// docs/ARCHITECTURE.md, "Add a mode").
import { MODELS } from "../data/roster.ts";
import type { Mode, ModeCtx } from "./mode.ts";
import { makeTrack, MOTO_TRACK, type TrackPlan } from "./race/course.ts";
import { mountTrack } from "./race/scene.ts";
import { makeMap, RIDE_MAPS, type RideMap } from "./freeride/maps.ts";
import { mountAir } from "./bigair/scene.ts";
import { mountCity } from "./wheelie/scene.ts";
import { desertTrack } from "./desert/track.ts";

/** Race tracks (id → plan). Phase 1: the one fixed loop; a generated track is another TrackPlan. */
export const TRACKS: TrackPlan[] = [MOTO_TRACK];
/** Free Ride maps: map 1 is the race loop (a plan); maps 2–5 are open maps (./freeride/maps.ts),
 *  each built once on first ride and kept (their terrain is pure). */
export const FREE_MAPS: { id: string; name: string; blurb: string; plan?: TrackPlan; open?: () => RideMap }[] = [
  { id: "neon-park", name: "NEON LOOP", blurb: "The race loop to yourself: the double, whoops, the triple, the tabletop.", plan: MOTO_TRACK },
  ...RIDE_MAPS.map((d) => {
    let m: RideMap | null = null;
    return { id: d.id, name: d.name, blurb: d.blurb, open: () => (m ??= makeMap(d)) };
  }),
];
const freeMap = (id?: string) => {
  const f = FREE_MAPS.find((m) => m.id === id) ?? FREE_MAPS[0]!;
  return f.open ? f.open() : makeTrack(f.plan!);
};

/** Rivals ride stock bikes of the player's class: the first three models' new power. */
const rivalsFor = (ctx: ModeCtx) => {
  const same = MODELS.filter((m) => m.cls === ctx.bike.cls).sort((a, b) => a.tier - b.tier);
  return [same[1] ?? same[0]!, same[0]!, same[2] ?? same[0]!].map((m) => m.power);
};

export const MODES: Mode[] = [
  {
    id: "race", name: "RACE", blurb: "Three laps against three rivals on stock bikes of your class. Places pay.",
    maps: TRACKS.map((t) => ({ id: t.id, name: t.name })),
    start: (ctx) => mountTrack(ctx, makeTrack(TRACKS.find((t) => t.id === ctx.map) ?? TRACKS[0]!), false, rivalsFor(ctx)),
  },
  {
    id: "freeride", name: "FREE RIDE", blurb: "Five open maps to yourself. No laps, no clock. Saddle time, air, wheelies and tricks pay a little.",
    maps: FREE_MAPS.map((m) => ({ id: m.id, name: m.name })),
    start: (ctx) => mountTrack(ctx, freeMap(ctx.map), true, []),
  },
  {
    id: "desert", name: "ENDLESS DESERT", blurb: "Endless dunes under a neon sky: ridges, bowls, peaks, kickers, a camp to ride to. No edge, no clock. How far can you go?",
    maps: [{ id: "desert", name: "THE DUNE SEA" }],
    start: (ctx) => mountTrack(ctx, desertTrack(), true, []),
  },
  {
    id: "bigair", name: "BIG AIR", blurb: "A minute in the arena: two kickers, four tricks, flips. Five judges pay.",
    maps: [{ id: "arena", name: "THE ARENA" }],
    start: (ctx) => mountAir(ctx),
  },
  {
    id: "wheelie", name: "WHEELIE CITY", blurb: "Four hoods, ninety seconds: wheelies, manuals, hops. Too loud and the neon patrol comes; jump a hump to lose them.",
    maps: [{ id: "city", name: "FOUR HOODS" }],
    start: (ctx) => mountCity(ctx),
  },
];
export const mode = (id: string) => MODES.find((m) => m.id === id) ?? MODES[0]!;
