// The two venues every track mode offers: MX (outdoors, the default) and SX (a stadium, indoors).
// MX is today's outdoor tracks made bigger for the fast bikes: `mxPlan` scales a plan's straights,
// turn radii and feature places by MX_SCALE and widens the track to MX_W (the jumps themselves keep
// their size: they are sized for the bike's physics, not the track's), so the berms are wider and
// longer and a supersport has room to brake and turn. SX is original tight indoor tracks (SX_TRACKS):
// a stadium floor near flat, short straights joined by hairpins, rhythm sections, whoops and a tight
// triple, a narrower track. Pure data and one pure function: a race, a series round or a Free Ride
// session on either venue is still just a TrackPlan (./course.ts makeTrack builds it).
import { F_DOUBLE, F_FINISH, F_TABLE, F_TRIPLE, F_WHOOPS, TRACK_W, type Section, type TrackPlan } from "./course.ts";

export type Venue = "mx" | "sx";
export const VENUES: readonly Venue[] = ["mx", "sx"];
/** A venue from anything (the default MX). */
export const venueOf = (v: unknown): Venue => (v === "sx" ? "sx" : "mx");
/** MX: lengths and radii × MX_SCALE, the track MX_W wide. */
export const MX_SCALE = 1.3, MX_W = 4.6;
/** SX: the track's width. */
export const SX_W = 3.2;

/** A plan made into its MX version (id + "-mx"): straights, turn radii, feature places and the table
 *  scaled, the track wider and its berms higher. The gate and the lap line stay put (on the first straight); the features keep their
 *  size. Idempotent per plan (an MX plan is not scaled again). Pure. */
export function mxPlan(p: TrackPlan, s = MX_SCALE): TrackPlan {
  if (p.venue) return p;
  const r3 = (v: number) => Math.round(v * 1e4) / 1e4;
  // The berms as high as the track is wider (the same bank angle across the wider track).
  const bh = (b: number | undefined) => r3((b ?? 0.75) * (MX_W / TRACK_W));
  const plan: Section[] = p.plan.map((v) => (typeof v === "number" ? (v < 0 ? { turn: Math.PI / 2, r: r3(p.RAD * s), berm: bh(undefined) } : r3(v * s)) : { ...v, r: r3((v.r ?? p.RAD) * s), berm: bh(v.berm) }));
  const features = p.features.slice();
  // A feature moves with its straight (a longer run-in out of the wider turn), except on the start
  // straight, where it keeps its place from the gate (the start the starters know).
  for (let k = 0; k < features.length; k += 3) if (features[k + 1]) features[k + 2] = r3(features[k + 2]! * s);
  const even = (v: number) => Math.ceil((v * s) / 2) * 2;
  return {
    // Its own id (a best time on the MX loop is not one on the old loop).
    ...p, id: p.id + "-mx", venue: "mx", width: MX_W, A: r3(p.A * s), B: r3(p.B * s), RAD: r3(p.RAD * s), plan, features,
    start: p.start ? [r3(p.start[0] * s), r3(p.start[1] * s), p.start[2]] : undefined,
    cols: even(p.cols), rows: even(p.rows),
  };
}

const PI = Math.PI;
/** A stadium hairpin or corner: `turn` radians (+ left) of radius r, bermed high. */
const T = (turn: number, r: number, berm = 1) => ({ turn, r, berm });
/** The SX tracks (original layouts). Each closes by construction (the straights' sums say so); the
 *  generator's checks (./generate.ts validate: the loop closes, no overlap, it fits, the features sit
 *  on straights, a starter race finishes clean) pass on every one (tests/venue.test.mjs). */
export const SX_TRACKS: TrackPlan[] = [
  {
    // A serpentine: the start straight (clear: the pack spreads before the first jump), down the side,
    // three straights across joined by hairpins (one right, one left), up the back to the line. The
    // whoops, the tight triple out of the right-hand hairpin, the rhythm doubles, the finish jump.
    id: "sx-neon-dome", name: "NEON DOME", venue: "sx", width: SX_W, A: 0, B: 0, RAD: 4.4,
    plan: [33, T(PI / 2, 4.4, 0.9), 6, T(PI / 2, 4.4, 0.9), 24, T(-PI, 4.4), 24, T(PI, 4.4), 33, T(PI / 2, 4.4, 0.9), 23.6, T(PI / 2, 4.4, 0.9)],
    start: [-16.5, 16.2, 0],
    features: [F_WHOOPS, 4, 4.5, F_TRIPLE, 6, 7, F_DOUBLE, 8, 4, F_DOUBLE, 8, 15.8, F_FINISH, 10, 10],
    gate: 1.2, line: 1.6, cols: 130, rows: 110, seed: 20261201,
  },
  {
    // A switchback: the long start straight (clear), a hairpin back over the whoops, a right-right
    // kink down, a short straight over the tabletop, a hairpin into the tight triple, up the back over
    // the finish jump.
    id: "sx-volt-arena", name: "VOLT ARENA", venue: "sx", width: SX_W, A: 0, B: 0, RAD: 4.4,
    plan: [26, T(PI, 4.4), 14, T(-PI / 2, 4.4, 0.9), 4, T(-PI / 2, 4.4, 0.9), 14, T(PI, 4.4), 26, T(PI / 2, 4.4, 0.9), 21.6, T(PI / 2, 4.4, 0.9)],
    start: [-13, 15.2, 0],
    features: [F_WHOOPS, 2, 2.5, F_TABLE, 6, 3.5, F_TRIPLE, 8, 9, F_FINISH, 10, 7],
    gate: 1.2, line: 1.6, cols: 116, rows: 106, seed: 20261202,
  },
];

