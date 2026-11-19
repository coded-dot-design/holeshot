// Generated. Exits 1 when a file here differs from ORIGIN.json: node vendor/shop/check.mjs
import * as fs from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
function driftOf(dir, fs, hash) {
  const out = [];
  let origin;
  try { origin = JSON.parse(fs.readFileSync(dir + "/ORIGIN.json", "utf8")); } catch { return ["ORIGIN.json: missing or not JSON"]; }
  const listed = new Set(origin.files.map((f) => f.path));
  for (const f of origin.files) {
    let buf;
    try { buf = fs.readFileSync(dir + "/" + f.path); } catch { out.push(f.path + ": missing"); continue; }
    if (hash(buf) !== f.sha256) out.push(f.path + ": changed (sha256 differs from ORIGIN.json)");
  }
  for (const n of fs.readdirSync(dir)) if (n !== "ORIGIN.json" && !listed.has(n)) out.push(n + ": not in ORIGIN.json");
  return out;
}
const out = driftOf(dirname(fileURLToPath(import.meta.url)), fs, (b) => createHash("sha256").update(b).digest("hex"));
if (out.length) { console.error("vendor/shop drifted:\n  " + out.join("\n  ")); process.exit(1); }
console.log("vendor/shop matches ORIGIN.json");
