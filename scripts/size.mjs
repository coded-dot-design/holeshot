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
// Unreleased, integration of r6 and r7: 184,788 B measured (holeshot.js; +2,328 B over 182,460 on main with the stray-parts fix: r6's
// bike layers (level and side groups), the turntable, the speed chip, the icon keys; r7's measured
// pace and the garage's PACE rows, the top-gear stretch, the gear-change voice), plus about 3.2 KB of room.
// Unreleased, R8 tricks everywhere: 186,048 B measured (holeshot.js; +5,355 B over 180,693: the
// stunts sim (the drag ladder: double hand and fender drags; the whip; the combo button's eight
// tricks, ladder and seeded draw), the trick callout and its CSS, the rocker's slide-out COMBO
// button, the ENDLESS grounds' ground-trick scoring, score and drag chips); 187,119 B on top of the
// Units setting, plus about 2.9 KB of room.
// Unreleased, r6 + r7 + r8 integrated: 189,970 B measured (holeshot.js; +5,182 B over 184,788 with r6
// and r7: r8's stunts, callout, COMBO button and ENDLESS scoring), plus about 3 KB of room.
// Unreleased, the bike families: 186,525 B measured (holeshot.js; +4,738 B over 181,787: the five
// family bodies (e-bike, electric dirt, street mini, supersport, naked) and the four visible
// upgrades, three street bikes, the families' rules (the dirt penalty, the warning, the fit and the
// measured pace for the garage's before → after), the upgrades' tune and wheelie bar), plus about
// 2.5 KB of room.
// Unreleased, r6 + r7 + r8 + r9 integrated: 194,496 B measured (holeshot.js; +4,526 B over 189,970 with
// r6-r8: r9's family bodies on r6's layers and groups, the street bikes, the upgrades and their
// garage rows on r7's one pace measure, the wheelie bar's cap in r8's stunts), plus about 3 KB of room.
// Unreleased, online endless with friends: 186,581 B measured (holeshot.js; +4,794 B over 181,787:
// the endless rides in the match (each rider's own window of one world, regroup, END, bumps), Endless
// Wheelie City together (each rider's own run and patrol), the shared session scoreboard, the name
// tags and off-screen markers, the city scene's online view, the room card's grounds), plus about
// 3.4 KB of room.
// 0.4.0, r6 + r7 + r8 + r9 + r11 integrated: 200,063 B measured (holeshot.js; +5,567 B over 194,496 with
// r6-r9: r11's endless rides together, and their wiring to r8's tricks: the COMBO bit, the board's
// trick feeds and names, friends' trick callouts and poses, END & BANK in the online pause), plus
// about 2.9 KB of room.
// 0.5.0, r12 + r13 + r14 integrated: 205,309 B measured (holeshot.js; +5,246 B over 0.4.0's 200,063:
// r12's TRICK/HOP bubbles and tether, the ☰ menu column, the controls' CSS and the Home Screen tip
// +1,627 on its own; r13's NOD and REAL name tables and the dressing +1,196; r14's garage dock, live
// preview with BUY/APPLY/CANCEL and pace deltas, the plinth and the card layout +2,246; REAL on every test-credits link +29), plus about
// 2 KB of room. r18 (venues and the endless Big Air) +2,139 measured (205,943 → 208,082 .mjs): the
// Big Air line and its streaming strip, the scenery sets, the SX tracks, the stadium and the venue
// plumbing; budget 207,300 → 210,000 (about 1.9 KB of room again).
// Unreleased, r17 (the garage is home, LET'S RIDE in four groups, buyable garage spots), on r18:
// 209,820 B measured (holeshot.js; +1,738 B over 0.5.6's 208,082: the ride page's groups, tiles,
// MX/SX keys and their CSS, the sticky ← back header, ⚙, the spots and the v7 step; less the old
// menu card, the ENDLESS picker card and the map picker's card). Then the final HOLESHOT logo inline
// (src/logo.ts: the L1 wordmark in the header, the lockup with "by David Cooley" in the garage, paths
// only, one letter path drawn five times): +933 B → 210,753 B; budget 210,000 → 211,700 (about
// 0.9 KB of room).
// R21 (freestyle tricks in Big Air), on 0.6.0: +2,870 B measured (210,553 → 213,423 .mjs): the trick ladder, the whip and the scorer
// (bigair/tricks.ts), eleven rider poses and the bike's turn (bigair/fmx.ts), the rig's freestyle
// channels and joined spread arms, the callout wiring; budget 211,700 → 215,000 (about 1.6 KB of room).
// R23 Track Day, on 0.6.1: +4,938 B measured (213,623 → 218,561 holeshot.js): three paved
// circuits' plans, the course's asphalt, run-off and road-corner speeds, the staggered grid, the
// scene's kerbs, edge lines, chequer, grid boxes, pit lane, gantry and start lights, pit wall,
// garages, grandstands and tyre walls, two palettes, the mode, the rivals, the road penalty, the best
// lap per circuit and the ride page's circuit tiles; budget 215,000 → 220,500 (about 1.9 KB of room).
// R22 (the Endless Mashup), on 0.7.0: +3,311 B measured (218,561 → 221,872 holeshot.js): the biome field (src/modes/mashup/
// field.ts), the open world's Mix hook (blended heights and kinds, town/roundabout/kicker gating,
// thinning and the wild scatter), the trail ribbon, the cactus, the region toast, big airs out of the
// city and the lit tile; budget 220,500 → 223,500 (about 1.6 KB of room).
// R30 (the helmet like the game art, the helmet portrait), on 0.8.0: +1,919 B measured (221,638 →
// 223,557 holeshot.mjs; holeshot.js 221,871 → 223,800): the rig's new helmet (a 14-sided three-part shell, the
// goggle's frame, lens and glint, the straps, the chin bar, the raked peak and its root, the fin) on
// its facing groups, the portrait SVG (garage/portrait.ts) in the top bar, the bay and the HELMET keys,
// the rider close-up; budget 223,500 → 225,000 (about 1.2 KB of room).
// R34 (the game self-contained), on 0.9.0 + online copy: +954 B measured (223,870 → 224,824 holeshot.mjs;
// holeshot.js 224,086 → 225,026): the CONTROLS · HOW TO card in settings (src/data/controls.ts: the keyboard,
// gamepad and phone bindings the landing also reads; the card and its key-cap CSS); budget 225,000 →
// 226,000 (about 1 KB of room).
const BUDGET = 226_000;
let failed = false;
for (const file of readdirSync("dist").filter((f) => /\.m?js$/.test(f)).sort().map((f) => `dist/${f}`)) {
  const gz = gzipSync(readFileSync(file)).length, ok = gz <= BUDGET;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "OVER"} ${file} ${gz.toLocaleString("en-US")} / ${BUDGET.toLocaleString("en-US")} bytes gzip`);
}
if (failed) process.exit(1);
