// Track Day: paved road circuits for the street bikes (original layouts and names). Each is a plain
// TrackPlan on the "td" venue (./course.ts makeTrack builds it: flat asphalt with run-off round it in
// rolling grass, no berms, no jumps, a road bike's corner speeds for the rivals), so a Track Day race
// is the Race's sim on another plan: the same grid start, three laps, places, lap times. The scene
// (./scene.ts) draws the kerbs, the edge and grid lines, the start/finish gantry, the pit wall and the
// grandstands. Each plan closes by construction (two of its straights were solved for it); the tests
// (tests/trackday.test.mjs) check that it closes, never crosses itself and fits its table.
//   MERIDIAN RING: fast and flowing. A 122-unit main straight into a heavy stop, a flat-out sweeping S
//     down the back, a long right-hand-side run home: a supersport is flat out twice a lap.
//   KNOTWORKS: technical. A short straight into a right-left chicane, a hairpin, a dog-leg of
//     ninety-degree corners, a second chicane up the far side: brakes and changes of direction.
//   BOTTLECAP: a kart-style tight one, good for the mini: two hairpins and a hook in 177 units.
import type { Power } from "../../bike/bike.ts";
import { MODELS, type Model } from "../../data/roster.ts";
import type { TrackPlan } from "./course.ts";

const PI = Math.PI;
/** A corner: `deg` degrees (+ left, − right) of radius r. */
const T = (deg: number, r: number) => ({ turn: (deg * PI) / 180, r });

export const TRACK_DAY: TrackPlan[] = [
  {
    id: "td-meridian", name: "MERIDIAN RING", venue: "td", width: 7, cell: 0.75, A: 0, B: 0, RAD: 12,
    plan: [122.0525, T(90, 9), 14, T(90, 14), 22, T(-30, 34), 22, T(30, 34), 34, T(90, 20), 25.1102, T(90, 12)],
    start: [-59.501, 28.555, 0], features: [], gate: 22, line: 22.4, cols: 220, rows: 106, seed: 20261119,
  },
  {
    id: "td-knotworks", name: "KNOTWORKS", venue: "td", width: 6.4, cell: 0.75, A: 0, B: 0, RAD: 9,
    plan: [47.4427, T(-40, 7), 6, T(40, 7), 24, T(-180, 7.5), 36, T(90, 9), 20, T(-90, 9), 22, T(-90, 12), 15.1534, T(35, 6), 5, T(-35, 6), 14, T(-90, 8)],
    start: [-42.244, -30.066, 0], features: [], gate: 17, line: 17.4, cols: 164, rows: 110, seed: 20261120,
  },
  {
    id: "td-bottlecap", name: "BOTTLECAP", venue: "td", width: 5, cell: 0.5, A: 0, B: 0, RAD: 5,
    plan: [31.9998, T(180, 5), 8, T(-90, 4.5), 6, T(-90, 4.5), 10, T(180, 5), 34, T(90, 6), 22.9998, T(90, 6)],
    start: [-16.475, 17.5, 0], features: [], gate: 13, line: 13.4, cols: 132, rows: 112, seed: 20261121,
  },
];

/** Each circuit's blurb (the map picker's line). */
export const TRACK_DAY_BLURB: Record<string, string> = {
  "td-meridian": "Fast and flowing: the longest straight in the game into a heavy stop, a flat-out S down the back.",
  "td-knotworks": "Technical: two chicanes, a hairpin and a dog-leg of square corners. Brakes win it.",
  "td-bottlecap": "Kart-style and tight: two hairpins and a hook. Built for the mini.",
};

/** A Track Day circuit by id (the first if unknown). */
export const circuit = (id?: string) => TRACK_DAY.find((t) => t.id === id) ?? TRACK_DAY[0]!;

/** The rivals on Track Day: street bikes of the rider's class. The mini races minis; a supersport or
 *  the naked V4 races the big street bikes (the supersports and the naked); a dirt bike (it may ride
 *  Track Day on knobblies: ../../model/families.ts ROAD_FX) races stock bikes of its own class on the
 *  same knobblies (`road` makes a rival's power what the asphalt does to it). */
export function trackDayRivals(m: Model, road: (p: Power) => Power): Power[] {
  const street = MODELS.filter((x) => x.cls === "street").sort((a, b) => a.tier - b.tier);
  if (m.cls === "street") {
    const mini = street.filter((x) => x.body === "mini"), big = street.filter((x) => x.body !== "mini");
    if (m.body === "mini") return [mini[0]!, mini[0]!, mini[0]!].map((x) => x.power);
    return [big[0]!, big[big.length - 1]!, big[0]!].map((x) => x.power);
  }
  const same = MODELS.filter((x) => x.cls === m.cls).sort((a, b) => a.tier - b.tier);
  return [same[1] ?? same[0]!, same[0]!, same[2] ?? same[0]!].map((x) => road(x.power));
}
