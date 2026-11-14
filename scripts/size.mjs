// The size of every build, gzip, against the budget. Board games have no fixed cap (the size ledger
// tracks them); this budget is the first measured build plus room, raised only with a measured reason.
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync } from "node:fs";
// 0.1.0: the first build measured 90,466 B (dirt-hop.mjs: the shell, the garage, four modes on three
// scenes, the kernel, diorama,
// terrain, drive, input, pad, sound, ui), plus about 5.5 KB of room.
// phase2/garage: 99,998 B (+9,514: tune choices, tyre compounds, five mods, wear and failures, crash
// damage, the service log, the 16-bike showroom with trade-ins, more cosmetics and outfits with a
// try-on, the rig's graphics kits, side-plate numbers and helmet shapes, six makers with factory
// paints), plus about 4 KB of room.
const BUDGET = 104_000;
let failed = false;
for (const file of readdirSync("dist").filter((f) => /\.m?js$/.test(f)).sort().map((f) => `dist/${f}`)) {
  const gz = gzipSync(readFileSync(file)).length, ok = gz <= BUDGET;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "OVER"} ${file} ${gz.toLocaleString("en-US")} / ${BUDGET.toLocaleString("en-US")} bytes gzip`);
}
if (failed) process.exit(1);
