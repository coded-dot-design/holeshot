// The size of every build, gzip, against the budget. Board games have no fixed cap (the size ledger
// tracks them); this budget is the first measured build plus room, raised only with a measured reason.
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync } from "node:fs";
// 0.1.0: the first build measured 90,466 B (dirt-hop.mjs: the shell, the garage, four modes on three
// scenes, the kernel, diorama,
// terrain, drive, input, pad, sound, ui), plus about 5.5 KB of room.
// Phase 2, the Race Series: 100,281 B measured (+9.8 KB: the track generator 8.4 KB minified, the
// series' rules, its screen and sheet, turns of any angle in the course), so 106,000.
const BUDGET = 106_000;
let failed = false;
for (const file of readdirSync("dist").filter((f) => /\.m?js$/.test(f)).sort().map((f) => `dist/${f}`)) {
  const gz = gzipSync(readFileSync(file)).length, ok = gz <= BUDGET;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "OVER"} ${file} ${gz.toLocaleString("en-US")} / ${BUDGET.toLocaleString("en-US")} bytes gzip`);
}
if (failed) process.exit(1);
