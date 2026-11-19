// The three naming tiers in Chromium, at 1440 and 390 (docs/names.md): the default build's garage and
// showroom read in NOD names; ?names=real and the test-credits links (?money=inf, ?credits=infinite)
// read in REAL ones, and the saved profile is
// byte for byte what it was (REAL is never saved); a SAFE build (HOLESHOT_NAMES=safe, built here into
// a scratch directory) reads in SAFE names, and ?names=real cannot reach REAL there. The bike in the
// bay is the naked V4 in its factory red. With MEDIA set, screenshots of each tier's showroom and bay.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const MEDIA = process.env.MEDIA;
if (MEDIA) mkdirSync(MEDIA, { recursive: true });
const SAFE_DIR = mkdtempSync(join(tmpdir(), "holeshot-safe-"));
execFileSync(process.execPath, ["scripts/build.mjs"], { env: { ...process.env, HOLESHOT_NAMES: "safe", HOLESHOT_OUT: SAFE_DIR }, stdio: "pipe" });
const page = (src) => `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "${src}"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false });</script></body></html>`;
const main = await serve(".", { "/": page("/dist/holeshot.mjs") });
const safe = await serve(SAFE_DIR, { "/": page("/holeshot.mjs") });
const browser = await chromium.launch(launchOptions());
const KEY = "holeshot:profile";
const SAVE = JSON.stringify({
  v: 5, name: "KIP", credits: 30000, ride: 0, owned: ["paint:f-ironjaw"], pit: 0, stats: { events: 40, wins: 10, earned: 40000, best: {}, far: {} },
  kit: { helmet: "peak", helmetPaint: "white", visor: "smoke", jersey: "lime", pants: "ink", pattern: "stripe", boots: "white", gloves: "ink" },
  bikes: [{ uid: "b1", model: "bare-knuckle", parts: { tyres: 1, chain: 1, motor: 1, susp: 1, brakes: 1 }, look: { paint: "f-ironjaw", number: 4 }, odo: 3000, events: 40 }],
});
const root = "document.querySelector('[data-fizlet-host]').shadowRoot";
const $ = (p, fn, arg) => p.evaluate(`((root, arg) => (${fn}))(${root}, ${JSON.stringify(arg ?? null)})`);
const click = (p, sel) => $(p, "root.querySelector(arg).click()", sel);
const until = (p, fn, what, timeout = 20000) => p.waitForFunction(`((root) => (${fn}))(${root})`, null, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const text = (p, sel) => $(p, "root.querySelector(arg).textContent", sel);

// [tier, server, query, what the bay says, a paint in PAINT & KIT, showroom names that must show (maker and model: the cards name each bike's maker, not the class's), names that must not]
const CASES = [
  ["nod", main, "", "DUCELLI", "DUCELLI RED", ["YAMORI YOWLER 250 2T", "HONZO CRIMSON 450 FACTORY", "SURGE-ON LIGHT BUZZ", "HONZO GROWL 125", "DUCELLI STRIKER V4"], ["YAMAHA", "HONDA", "DUCATI", "BLUEWAKE", "STING"]],
  ["real", main, "?names=real", "DUCATI", "DUCATI RED", ["YAMAHA YZ250", "HONDA CRF450R WORKS EDITION", "SUR-RON LIGHT BEE", "HONDA GROM", "DUCATI STREETFIGHTER V4", "STARK VARG MX"], ["YAMORI", "BLUEWAKE"]],
  ["real-money", main, "?money=inf", "DUCATI", "SUR-RON BLACK", ["YAMAHA YZ250", "KAWASAKI KX450", "YAMAHA R6"], ["YAMORI", "BLUEWAKE"]],
  ["real-credits", main, "?credits=infinite", "DUCATI", "SUR-RON BLACK", ["YAMAHA YZ250", "KAWASAKI KX450", "YAMAHA R6"], ["YAMORI", "BLUEWAKE"]],
  ["safe", safe, "?names=real", "IRONJAW", "BUZZWORKS BLACK", ["BLUEWAKE RIPPER 250", "EMBERLINE BLAZE 450 PRO", "BUZZWORKS DART", "EMBERLINE BLOCK PUP 125", "IRONJAW BARE KNUCKLE V4"], ["YAMAHA", "YAMORI", "HONZO", "DUCELLI", "DUCATI"]],
];
try {
  for (const [vname, viewport, touch] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]]) {
    for (const [tier, server, q, bay, paint, want, never] of CASES) {
      const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
      await ctx.addInitScript(([k, s]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, s); }, [KEY, SAVE]);
      const p = await ctx.newPage(), errs = [], at = `${vname} ${tier}`;
      p.on("pageerror", (e) => errs.push(e.message));
      await p.goto(server.url + "/" + q);
      await until(p, "window.game && game.getSnapshot().screen === 'garage'", `${at}: the saved profile loads`);
      await until(p, "game.getSnapshot().screen === 'garage' && root.querySelector('.dh-preview').width > 50", `${at}: the garage`);
      const head = await text(p, ".dh-bay");
      assert.ok(head.includes(bay), `${at}: the bay names the maker (${head.slice(0, 80)})`);
      if (MEDIA) await p.waitForTimeout(150), await p.screenshot({ path: `${MEDIA}/${vname}-${tier}-bay.png` });
      // PAINT & KIT: the factory paints in the tier's names.
      await click(p, "[data-gtab=look]");
      await until(p, "root.querySelector('[data-gtab=look]').getAttribute('aria-pressed') === 'true'", `${at}: paint & kit`);
      const look = await $(p, "root.querySelector('.dh-garage').innerHTML");
      assert.ok(look.includes(paint), `${at}: the paint ${paint}`);
      if (MEDIA) await p.waitForTimeout(150), await p.screenshot({ path: `${MEDIA}/${vname}-${tier}-paint.png` });
      await click(p, "[data-gtab=showroom]");
      await until(p, "!!root.querySelector('.shop-cat')", `${at}: the showroom`);
      while (await $(p, "!!root.querySelector('[data-shop-more]')")) await click(p, "[data-shop-more]");
      // (a card names its maker in the eyebrow; its picture's label says both)
      const all = (await text(p, ".dh-garage")) + (await $(p, "[...root.querySelectorAll('[data-shop-pick]')].map((b) => b.getAttribute('aria-label')).join(' ')"));
      for (const w of want) assert.ok(all.includes(w), `${at}: shows ${w}`);
      for (const w of never) assert.ok(!all.toUpperCase().includes(w), `${at}: never ${w}`);
      if (MEDIA) await $(p, "root.querySelector('.shop-cat-item:last-of-type').scrollIntoView()"), await p.waitForTimeout(150), await p.screenshot({ path: `${MEDIA}/${vname}-${tier}-showroom.png` });
      assert.equal(await p.evaluate((k) => localStorage.getItem(k), KEY), SAVE, `${at}: the save is untouched`);
      assert.deepEqual(errs, [], `${at}: no page errors`);
      await ctx.close();
    }
  }
  console.log("names.browser: ok (NOD default, REAL by ?names=real and ?money=inf, SAFE build; 1440 and 390)");
} finally {
  await browser.close();
  await main.close();
  await safe.close();
  rmSync(SAFE_DIR, { recursive: true, force: true });
}
