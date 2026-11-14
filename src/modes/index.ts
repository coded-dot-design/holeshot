// Every mode, one list: the shell's RIDE menu reads it, and a new mode is one entry here (see
// docs/ARCHITECTURE.md, "Add a mode").
import { MODELS } from "../data/roster.ts";
import type { Mode, ModeCtx } from "./mode.ts";
import { makeTrack, MOTO_TRACK, type TrackPlan } from "./race/course.ts";
import { mountTrack } from "./race/scene.ts";
import { mountAir } from "./bigair/scene.ts";
import { mountCity } from "./wheelie/scene.ts";

/** Race tracks (id → plan). Phase 1: the one fixed loop; a generated track is another TrackPlan. */
export const TRACKS: TrackPlan[] = [MOTO_TRACK];
/** Free Ride maps (id → plan). */
export const FREE_MAPS: { id: string; name: string; plan: TrackPlan }[] = [{ id: "neon-park", name: "NEON PARK", plan: MOTO_TRACK }];

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
    id: "freeride", name: "FREE RIDE", blurb: "The park to yourself. No laps, no clock. Saddle time, air and wheelies pay a little.",
    maps: FREE_MAPS.map((m) => ({ id: m.id, name: m.name })),
    start: (ctx) => mountTrack(ctx, makeTrack((FREE_MAPS.find((m) => m.id === ctx.map) ?? FREE_MAPS[0]!).plan), true, []),
  },
  {
    id: "bigair", name: "BIG AIR", blurb: "A minute in the arena: two kickers, four tricks, flips. Five judges pay.",
    maps: [{ id: "arena", name: "THE ARENA" }],
    start: (ctx) => mountAir(ctx),
  },
  {
    id: "wheelie", name: "WHEELIE CITY", blurb: "A minute on the block: wheelies, manuals, hops. Points pay; neighbours complain.",
    maps: [{ id: "city", name: "THE BLOCK" }],
    start: (ctx) => mountCity(ctx),
  },
];
export const mode = (id: string) => MODES.find((m) => m.id === id) ?? MODES[0]!;
