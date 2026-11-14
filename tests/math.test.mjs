// The determinism guard. Online, an iPhone (WebKit) and desktop Chrome (V8) run one sim, so nothing
// that builds a track or a map, steps a sim or lands in the rollback's snapshot and hash may call a
// builtin transcendental (Math.sin, cos, tan, atan, atan2, exp, pow, hypot, log, …, or `**`): each
// engine's builtins may differ in the last bit. Those modules use src/math.ts (fdlibm's algorithms,
// + − × ÷ and square roots: the same bits everywhere) and the bike's own polynomials. Drawing,
// sound, FX, cameras and the cards may use the builtins (a pixel off is fine): the allow-list below
// names them, each with why. src/math.ts matches V8's builtins bit for bit (so on Chrome nothing
// changed: tests/golden.test.mjs), and the Fizlet bricks the sims use keep their builtin trig out of
// the sim path (terrain: only its shadow circles and camera; steer's hypot: + − × ÷ and √).
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const M = await import("../src/math.ts");
const SRC = new URL("../src/", import.meta.url).pathname;
/** Files that only draw, sound, animate or show cards (or pay out on one device): builtins are fine. */
const RENDER = {
  "bike/rig.ts": "draws the bike and rider",
  "bike/kit.ts": "particles, the engine's voice, the gamepad",
  "modes/race/scene.ts": "the track scene: camera, FX, stickers",
  "modes/bigair/scene.ts": "the arena scene",
  "modes/wheelie/scene.ts": "the town scene",
  "modes/freeride/scenery.ts": "map scenery and skies (drawn)",
  "modes/freeride/picker.ts": "the map picker's previews",
  "modes/race/preview.ts": "a track drawn as SVG",
  "game.ts": "the shell's cards and preview",
  "garage/view.ts": "the garage card",
  "garage/look.ts": "colours",
  "series-ui.ts": "the series card",
  "online/room.ts": "the room card",
  "html.ts": "card helpers",
  "model/economy.ts": "payouts: each device pays its own profile (the online cap's halving)",
};
const BUILTIN = /\bMath\.(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|asinh|acosh|atanh|exp|expm1|log|log1p|log2|log10|pow|hypot|cbrt)\b|[\w)\]]\s*\*\*\s*[\w(]/g;
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1").replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');
const files = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? files(join(d, n)) : n.endsWith(".ts") ? [join(d, n)] : []));

test("the sim and generator modules call no builtin transcendental maths (render code is allow-listed)", () => {
  const found = [], seen = new Set();
  for (const f of files(SRC)) {
    const rel = relative(SRC, f), hits = strip(readFileSync(f, "utf8")).match(BUILTIN) ?? [];
    if (RENDER[rel]) seen.add(rel);
    else if (hits.length) found.push(`${rel}: ${[...new Set(hits)].join(", ")}`);
  }
  assert.deepEqual(found, [], `builtin maths in sim or generator code (use src/math.ts):\n${found.join("\n")}`);
  for (const k of Object.keys(RENDER)) assert.ok(seen.has(k), `the allow-list names a file that exists: ${k}`);
  // And the guard works: it catches what it should.
  assert.equal(strip("const a = Math.sin(x) ** 2; // Math.cos(y)").match(BUILTIN)?.length, 2);
});

test("the sims import only Fizlet bricks whose sim path is pure arithmetic", () => {
  const sim = ["bike/bike.ts", "modes/race/course.ts", "modes/race/generate.ts", "modes/freeride/maps.ts", "modes/freeride/session.ts", "modes/freeride/jam.ts", "modes/bigair/show.ts", "modes/bigair/tricks.ts", "modes/wheelie/city.ts", "modes/wheelie/ride.ts", "modes/wheelie/tricks.ts", "modes/meter.ts", "model/tune.ts", "online/match.ts", "online/rollback.ts", "net.ts"];
  const ok = new Set(["@fzlt/core/terrain", "@fzlt/core/steer", "@fzlt/core/kernel", "@fzlt/core/presence"]);
  for (const f of sim) {
    const bricks = [...readFileSync(join(SRC, f), "utf8").matchAll(/from "(@fzlt\/core[^"]*)"/g)].map((m) => m[1]);
    for (const b of bricks) assert.ok(ok.has(b), `${f} imports ${b}: check its sim path is pure arithmetic, then allow it here`);
  }
});

test("src/math.ts: V8's builtins bit for bit (so Chrome builds what it always built), defined everywhere", () => {
  let s = 99;
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const bad = [];
  for (let i = 0; i < 200000; i++) {
    const x = (r() * 2 - 1) * [1e-9, 0.01, 1, 3, 10, 100, 1e4, 4e5][i % 8], y = (r() * 2 - 1) * [0.001, 1, 50, 1e4][i % 4];
    for (const [k, a, b] of [["sin", M.sin(x), Math.sin(x)], ["cos", M.cos(x), Math.cos(x)], ["tan", M.tan(x), Math.tan(x)], ["atan", M.atan(x * 7), Math.atan(x * 7)], ["atan2", M.atan2(y, x), Math.atan2(y, x)], ["hypot", M.hypot(x, y), Math.hypot(x, y)]])
      if (!Object.is(a, b) && bad.length < 5) bad.push([k, x, y, a, b]);
  }
  for (const v of [0, -0, Math.PI / 2, Math.PI, -Math.PI / 4, (3 * Math.PI) / 4, 1, -1, 2.5, -7]) for (const k of ["sin", "cos", "tan", "atan"]) if (!Object.is(M[k](v), Math[k](v))) bad.push([k, v]);
  for (const [y, x] of [[0, 0], [0, -1], [-0, -1], [1, 0], [-1, 0], [0, 1], [1, 1], [-3, -4]]) if (!Object.is(M.atan2(y, x), Math.atan2(y, x))) bad.push(["atan2", y, x]);
  assert.deepEqual(bad, []);
  assert.ok([M.sin(1e300), M.cos(-1e300), M.tan(1e300)].every((v) => Number.isFinite(v)), "huge arguments stay defined");
});
