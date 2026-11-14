// The golden cases (tests/golden.mjs) in a browser: bundled with esbuild (as dist/ is), run in a
// page, compared with tests/golden.json. In Chromium as a gate (`node tests/golden.browser.mjs`); with
// `--serve` it also listens on the network and prints a URL to open on an iPhone (Safari: WebKit) or
// any other device: the page says MATCH or lists what differs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { launchOptions } from "./serve.mjs";

const want = JSON.parse(readFileSync(new URL("./golden.json", import.meta.url), "utf8")).hashes;
const js = (await build({ entryPoints: [new URL("./golden.mjs", import.meta.url).pathname], bundle: true, minify: true, format: "esm", write: false, target: "es2020", logLevel: "warning" })).outputFiles[0].text;
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot golden</title></head><body style="font:16px/1.4 system-ui;margin:16px"><h1>Holeshot: the golden hashes</h1><p id="out">Building the tracks and riding the rides…</p><pre id="diff"></pre><script type="module">${js.replace(/export\s*\{\s*(\w+) as compute\s*\};?\s*$/, "const compute = $1;")}
const want = ${JSON.stringify(want)};
setTimeout(() => { const got = compute(), bad = Object.keys(want).filter((k) => got[k] !== want[k]); window.result = { got, bad }; document.getElementById("out").textContent = bad.length ? "DIFFERS (" + bad.length + " of " + Object.keys(want).length + ")" : "MATCH: all " + Object.keys(want).length + " tracks, maps and rides, bit for bit (" + navigator.userAgent + ")"; document.getElementById("diff").textContent = bad.join("\\n"); }, 50);
</script></body></html>`;
const SERVE = process.argv.includes("--serve");
const server = createServer((_q, r) => r.writeHead(200, { "content-type": "text/html" }).end(page));
await new Promise((ok) => server.listen(SERVE ? 8765 : 0, SERVE ? "0.0.0.0" : "127.0.0.1", ok));
const port = server.address().port;
const browser = await chromium.launch(launchOptions());
try {
  const p = await browser.newPage(), errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/`);
  await p.waitForFunction(() => window.result, null, { timeout: 120000, polling: 500 }).catch(() => assert.fail(`no result: ${errs.join("; ")}`));
  const { bad } = await p.evaluate(() => window.result);
  assert.deepEqual(bad, [], `Chromium differs from the golden hashes: ${bad.join(", ")}`);
  console.log(`golden (Chromium, the bundled code): all ${Object.keys(want).length} tracks, maps and rides match, bit for bit.`);
} finally {
  await browser.close();
}
if (SERVE) {
  const ips = Object.values(networkInterfaces()).flat().filter((a) => a && a.family === "IPv4" && !a.internal).map((a) => a.address);
  console.log(`Open on a phone: ${ips.map((ip) => `http://${ip}:${port}/`).join("  ")} (Ctrl+C to stop)`);
} else server.close();
