// The size of every build, gzip, against the budget. Board games have no fixed cap (the size ledger
// tracks them); this budget is the first measured build plus room, raised only with a measured reason.
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync } from "node:fs";
// 0.1.0: the first build measured 90,466 B (the .mjs: the shell, the garage, four modes on three
// scenes, the kernel, diorama,
// terrain, drive, input, pad, sound, ui), plus about 5.5 KB of room.
// Phase 2, the Race Series: 100,281 B measured (+9.8 KB: the track generator 8.4 KB minified, the
// series' rules, its screen and sheet, turns of any angle in the course).
// Phase 2, Free Ride maps 2–5: 101,732 B measured on its own (+11,248 B: four open maps' builders and
// data, their scenery and looks, the map picker with previews).
// phase2/garage: 99,998 B on its own (+9,514: tune choices, tyre compounds, five mods, wear and
// failures, crash damage, the service log, the 16-bike showroom with trade-ins, more cosmetics and
// outfits with a try-on, the rig's graphics kits, side-plate numbers and helmet shapes, six makers
// with factory paints).
// Phase 2 merged (series + maps + garage) and renamed HOLESHOT: 120,996 B measured (holeshot.js),
// plus about 4 KB of room.
// 0.2.0, online for up to four: 137,888 B measured (holeshot.js; +16,892 B over 120,996: the
// presence brick's join, the rollback link 4.7 KB and the match 4.3 KB minified, the wire and the
// hello 3.2 KB, the Free Ride jam 1.7 KB, the room card, the lobby and the online result 5.4 KB, the
// shell's online flow about 13 KB, the race scene's online view, the economy's online bonus and cap),
// plus about 4 KB of room.
// 0.2.1, the same bits on every engine: 141,265 B measured (+3,377 B: src/math.ts, fdlibm's sin, cos,
// tan, atan, atan2 and pow written out for the sims and the generators), plus about 3.7 KB of room.
// 0.3.0, Wheelie City's four neighbourhoods and the neon patrol: 155,843 B measured (holeshot.js; +14,578 B over
// 141,265: the three new
// hoods' layouts and their placing rules, the humps and the flight, the heat and the patrol's pathing
// on the street graphs, towers, shops, shacks, palms and the patrol units in the scene, the heat chip
// and the ticket card), plus about 4 KB of room.
// Unreleased, Endless Desert and Unstuck: 163,637 B measured (holeshot.js; +7,794 B over 155,843: the
// desert's pure ground and sliding window, its grid, haze, sky and scenery pool, the session's
// endless path and autopilot, the unstuck ring and reset with its HUD prompt and key, best distance
// and the profile's v3 step), plus about 4.3 KB of room.
// Unreleased, round 3, Endless Wheelie City and the endless grounds: 170,188 B measured (holeshot.js;
// +4,124 B over 166,064: the town as slots (the ground factory, the slot row, the session's endless
// path and autopilot line), the scene's hood moves, haze and fade, the END key; three biome grounds
// and feature mixes on the desert's window, their scenery and palettes, the ENDLESS picker card, the
// profile's v4 step), plus about 3.8 KB of room.
// Unreleased, round 4: 174,039 B measured (holeshot.js; +3,851 B over 170,188 with the fixed city's
// scene code gone: the camera's occlusion test and the ghosts' outlines, the patrol's new rules and
// the drones' neon and searchlights, the hand drag (its sim, HUD chip, pose, sparks), the throttle
// rocker (its icons and CSS), the profile's v5 step), plus about 4 KB of room for the crests.
// Unreleased, the open world's road ribbons: 180,285 B measured (holeshot.js; +3,291 B over 176,994:
// the asphalt, shoulders, rings and islands drawn as ribbons along the roads' true curves, the
// window's drawn kinds under them, the probe's bare draw), plus about 3.7 KB of room.
// Unreleased, online endless with friends: 186,581 B measured (holeshot.js; +4,794 B over 181,787:
// the endless rides in the match (each rider's own window of one world, regroup, END, bumps), Endless
// Wheelie City together (each rider's own run and patrol), the shared session scoreboard, the name
// tags and off-screen markers, the city scene's online view, the room card's grounds), plus about
// 3.4 KB of room.
const BUDGET = 190_000;
let failed = false;
for (const file of readdirSync("dist").filter((f) => /\.m?js$/.test(f)).sort().map((f) => `dist/${f}`)) {
  const gz = gzipSync(readFileSync(file)).length, ok = gz <= BUDGET;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "OVER"} ${file} ${gz.toLocaleString("en-US")} / ${BUDGET.toLocaleString("en-US")} bytes gzip`);
}
if (failed) process.exit(1);
