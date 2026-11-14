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
const BUDGET = 142_000;
let failed = false;
for (const file of readdirSync("dist").filter((f) => /\.m?js$/.test(f)).sort().map((f) => `dist/${f}`)) {
  const gz = gzipSync(readFileSync(file)).length, ok = gz <= BUDGET;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "OVER"} ${file} ${gz.toLocaleString("en-US")} / ${BUDGET.toLocaleString("en-US")} bytes gzip`);
}
if (failed) process.exit(1);
