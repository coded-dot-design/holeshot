// dist/holeshot.mjs (module) and dist/holeshot.js (one script for any page, global holeshot): the game,
// the Fizlet bricks it uses (@fzlt/core, bundled: no runtime dependencies) and the Board UI kit's CSS.
import { build, transform } from "esbuild";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";

const require = createRequire(import.meta.url);
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const core = JSON.parse(readFileSync(require.resolve("@fzlt/core/package.json"), "utf8")).version;
// The naming tier (src/data/names.ts, docs/names.md): the default build is NOD (and carries REAL for
// the private test link); HOLESHOT_NAMES=safe builds the app-store bundle with neither table in it.
// HOLESHOT_OUT builds somewhere else than dist/ (the tests' SAFE build).
const names = process.env.HOLESHOT_NAMES === "safe" ? "safe" : "nod";
const out = process.env.HOLESHOT_OUT || "dist";
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const css = async (file) => (await transform(readFileSync(file, "utf8"), { loader: "css", minify: true })).code.trim();
// The game's CSS: the shell's, the garage's, the series', then each mode scene's (and the map picker).
const game = (await Promise.all(["src/game.css", "src/shop/shop.css", "src/garage/garage.css", "src/shop/catalogue.css", "src/garage/showroom.css", "src/series.css", "src/modes/race/scene.css", "src/modes/bigair/scene.css", "src/modes/wheelie/scene.css", "src/modes/freeride/picker.css", "src/online/online.css", "src/modes/stunts.css"].map(css))).join("");
const kit = await css(require.resolve("@fzlt/core/ui/board-ui.css"));
const common = {
  define: { __KIT_CSS__: JSON.stringify(kit), __GAME_CSS__: JSON.stringify(game), __NAMES__: JSON.stringify(names), __VERSION__: JSON.stringify(version) },
  bundle: true, minify: true, target: "es2022", legalComments: "none", logLevel: "warning",
  banner: { js: `/* Holeshot ${version} · MIT © Chris Cooley · built on Fizlet ${core} */` },
};
await build({ ...common, entryPoints: ["src/index.ts"], format: "esm", outfile: `${out}/holeshot.mjs` });
await build({ ...common, entryPoints: ["src/index.ts"], format: "iife", globalName: "holeshot", outfile: `${out}/holeshot.js` });
const size = (f) => gzipSync(readFileSync(f)).length;
writeFileSync(`${out}/build.json`, JSON.stringify({ version, fizlet: core, gzip: { "holeshot.mjs": size(`${out}/holeshot.mjs`), "holeshot.js": size(`${out}/holeshot.js`) } }, null, 2) + "\n");
console.log(`Built Holeshot ${version} on @fzlt/core ${core} (${names.toUpperCase()} names): ${out}/holeshot.mjs, ${out}/holeshot.js`);
