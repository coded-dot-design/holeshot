// Every mode, one list: the shell's RIDE menu reads it, and a new mode is one entry here (see
// docs/ARCHITECTURE.md, "Add a mode").
import { MODELS } from "../data/roster.ts";
import type { Mode, ModeCtx } from "./mode.ts";
import { makeTrack, MOTO_TRACK, type TrackPlan } from "./race/course.ts";
import { SX_TRACKS, mxPlan, venueOf, type Venue } from "./race/venue.ts";
import { mountTrack } from "./race/scene.ts";
import { makeMap, RIDE_MAPS, type RideMap } from "./freeride/maps.ts";
import { mountAir } from "./bigair/scene.ts";
import { mountCity } from "./wheelie/scene.ts";
import { desertTrack, BIOMES, DESERT_SEED } from "./desert/track.ts";
import { TRACK_DAY, TRACK_DAY_BLURB, circuit, trackDayRivals } from "./race/circuits.ts";
import { roadPower } from "../model/families.ts";
import { lapKey } from "../model/economy.ts";

/** Race tracks (id → plan). MX: the fixed loop made MX-sized (./race/venue.ts); SX: the stadium tracks. */
export const TRACKS: TrackPlan[] = [mxPlan(MOTO_TRACK)];
/** Race tracks by venue. */
export const VENUE_TRACKS: Record<Venue, TrackPlan[]> = { mx: TRACKS, sx: SX_TRACKS };
/** A race's track: the map asked for at the venue, else the venue's first (SX: the event seed picks). */
export const raceTrack = (map: string | undefined, venue: Venue | undefined, seed = 0): TrackPlan => {
  const v = venueOf(venue), list = VENUE_TRACKS[v];
  return list.find((t) => t.id === map) ?? (v === "sx" ? list[(seed >>> 0) % list.length]! : list[0]!);
};
/** Free Ride maps: map 1 is the race loop (a plan); maps 2–5 are open maps (./freeride/maps.ts),
 *  each built once on first ride and kept (their terrain is pure). */
export const FREE_MAPS: { id: string; name: string; blurb: string; plan?: TrackPlan; open?: () => RideMap }[] = [
  { id: "neon-park", name: "NEON LOOP", blurb: "The race loop to yourself: the double, whoops, the triple, the tabletop.", plan: TRACKS[0]! },
  ...RIDE_MAPS.map((d) => {
    let m: RideMap | null = null;
    return { id: d.id, name: d.name, blurb: d.blurb, open: () => (m ??= makeMap(d)) };
  }),
];
/** Free Ride's SX maps: the stadium floor to yourself (the SX tracks, no rivals, no clock). */
export const FREE_SX: { id: string; name: string; blurb: string; plan: TrackPlan }[] = [
  { id: "sx-floor", name: "STADIUM FLOOR", blurb: "The NEON DOME's floor to yourself under the lights: the rhythm doubles, whoops, the tight triple, hairpins.", plan: SX_TRACKS[0]! },
  { id: "sx-volt-floor", name: "VOLT FLOOR", blurb: "The VOLT ARENA to yourself: the tabletop, whoops, the kink and the tight triple.", plan: SX_TRACKS[1]! },
];
const freeMap = (id?: string, venue?: Venue) => {
  if (venueOf(venue) === "sx" || FREE_SX.some((m) => m.id === id)) return makeTrack((FREE_SX.find((m) => m.id === id) ?? FREE_SX[0]!).plan);
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
    start: (ctx) => mountTrack(ctx, makeTrack(raceTrack(ctx.map, ctx.venue, ctx.seed)), false, rivalsFor(ctx)),
  },
  {
    id: "freeride", name: "FREE RIDE", blurb: "Five open maps to yourself. No laps, no clock. Saddle time, air, wheelies and tricks pay a little.",
    maps: FREE_MAPS.map((m) => ({ id: m.id, name: m.name })),
    start: (ctx) => mountTrack(ctx, freeMap(ctx.map, ctx.venue), true, []),
  },
  {
    id: "desert", name: "ENDLESS", blurb: "Ground that never ends: the dune sea, or an endless quarry, woods or night park (each Free Ride map, endless). No edge, no clock. How far can you go?",
    maps: BIOMES.map((b) => ({ id: b.id, name: b.name })),
    start: (ctx) => mountTrack(ctx, desertTrack(DESERT_SEED, ctx.map), true, []),
  },
  {
    id: "bigair", name: "BIG AIR", blurb: "A minute down an endless line of big kickers, sized for your bike: a roll-in for speed, landings you never miss at full gas, four tricks, flips. Five judges pay.",
    maps: [{ id: "arena", name: "THE ARENA" }],
    start: (ctx) => mountAir(ctx),
  },
  {
    id: "endcity", name: "ENDLESS WHEELIE CITY", blurb: "An open world of roads, towns and fields that never ends: wheelie the long smooth roads in any direction, roll through town after town, ride out of town limits to lose the neon patrol. No clock. How far out can you get?",
    maps: [{ id: "city", name: "THE OPEN ROAD" }],
    start: (ctx) => mountCity(ctx),
  },
  {
    id: "mashup", name: "ENDLESS MASHUP", blurb: "One endless world that changes as you ride: the city's roads and towns, then out along the trail into the dunes, the mountains, the quarry or the park, and into a city again. Wheelie the streets, send the dunes. How far can you go?",
    maps: [{ id: "mashup", name: "THE WHOLE WORLD" }],
    start: (ctx) => mountCity(ctx, null, true),
  },
];
/** TRACK DAY: three laps against three rivals on paved road circuits (./race/circuits.ts), street
 *  bikes on their own rubber (a dirt bike may ride, on knobblies: ../model/families.ts ROAD_FX). Not on
 *  the RIDE menu's list (the menu gives it its own tile); `mode("trackday")` finds it. Solo only. */
export const TRACK_DAY_MODE: Mode = {
  id: "trackday", name: "TRACK DAY", blurb: "Street bikes on paved circuits: a grid start, three laps against three rivals of your class, lap times and a best lap kept per circuit.",
  maps: TRACK_DAY.map((t) => ({ id: t.id, name: t.name })),
  start: (ctx) => mountTrack(ctx, makeTrack(circuit(ctx.map)), false, trackDayRivals(ctx.bike.model, roadPower)),
};
/** Track Day's circuits for the ride page (id, name, blurb, its character: FAST, TECHNICAL, KART). */
export const TRACK_DAY_MAPS = TRACK_DAY.map((t, k) => ({ id: t.id, name: t.name, blurb: TRACK_DAY_BLURB[t.id] ?? "", kind: ["FAST", "TECHNICAL", "KART"][k] ?? "" }));
/** A lap time as the ride page shows it ("0:18.4"; "" for none). */
export const lapClock = (s: number) => (s > 0 ? `${(s / 60) | 0}:${(s % 60).toFixed(1).padStart(4, "0")}` : "");
/** The rider's best lap on a Track Day circuit (seconds; 0 for none), from the profile's `stats.best`. */
export const trackDayBest = (best: Record<string, number>, map?: string) => best[lapKey(circuit(map).id)] ?? 0;
export const mode = (id: string) => MODES.find((m) => m.id === id) ?? (id === "trackday" ? TRACK_DAY_MODE : MODES[0]!);
