// The site's stills, from the game itself (dist/holeshot.mjs) in Chromium. Run after `npm run build`:
//   node scripts/shots.mjs          the hero's poster (shots/hero.jpg, 1600×900, and hero-800.jpg for
//                                    phones): a moment of the attract race, the landing hero's first paint
//   node scripts/shots.mjs modes    one small still per way to ride (shots/modes/<id>.jpg, 720×450: the canvas, its HUD hidden;
//                                    the ride meter is on the canvas, bottom left: the tiles cover it)
// shots/og.jpg (the share image) is the owner's launch cover: this script never writes it.
// CHROMIUM_PATH optional.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { serve } from "../tests/serve.mjs";
const launch = () => chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const hero = `<!doctype html><html data-theme="dark"><body style="margin:0;background:#0d0b1c"><div id=h style="position:fixed;inset:0"></div><script type=module>import { createHoleshot } from "/dist/holeshot.mjs"; window.g = createHoleshot({ host: document.getElementById("h"), attract: true, sound: false });</script>`;
// A rider on the autopilot in each mode (a memory store: nothing saved); the HUD and touch controls hidden.
const rider = `<!doctype html><html data-theme="dark"><body style="margin:0;background:#0d0b1c"><div id=h style="position:fixed;inset:0"></div><script type=module>import { createHoleshot } from "/dist/holeshot.mjs"; const m = new Map(); window.g = createHoleshot({ host: document.getElementById("h"), sound: false, store: { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v) } }); g.setup({ starter: "anvil", paint: "pinkout" });</script>`;
const MODES = [
  ["race-mx", "race", { venue: "mx" }, 7],
  ["race-sx", "race", { venue: "sx" }, 7],
  ["endless-desert", "desert", { map: "desert" }, 6],
  ["endcity", "endcity", {}, 6],
  ["freeride", "freeride", { map: "night-park" }, 6],
  ["bigair", "bigair", {}, 5],
];
const s = await serve(".", { "/": hero, "/ride": rider });
const b = await launch();
try {
  if (process.argv[2] === "modes") {
    mkdirSync("site/public/shots/modes", { recursive: true });
    for (const [file, id, opt, secs] of MODES) {
      const p = await b.newPage({ viewport: { width: 720, height: 450 } });
      await p.goto(s.url + "/ride");
      await p.waitForFunction(() => window.g?.getSnapshot().screen === "menu", null, { timeout: 30000 });
      await p.evaluate(([id, opt]) => g.start(id, { ...opt, auto: true }), [id, opt]);
      await p.waitForFunction(() => g.run?.state, null, { timeout: 30000 });
      await p.evaluate(() => { const st = document.createElement("style"); st.textContent = ".dh *{visibility:hidden!important}.dh canvas{visibility:visible!important}"; document.querySelector("[data-fizlet-host]").shadowRoot.append(st); });
      await p.waitForTimeout(secs * 1000);
      await p.screenshot({ path: `site/public/shots/modes/${file}.jpg`, type: "jpeg", quality: 70 });
      await p.close();
      console.log(`site/public/shots/modes/${file}.jpg`);
    }
  } else {
    for (const [file, width, height, at] of [["hero.jpg", 1600, 900, 9], ["hero-800.jpg", 800, 900, 9]]) {
      const p = await b.newPage({ viewport: { width, height } });
      await p.goto(s.url + "/");
      await p.waitForFunction((at) => window.g?.run && g.run.state.clock >= at, at, { timeout: 60000, polling: 16 });
      await p.evaluate(() => g.run.engine.stop());
      await p.screenshot({ path: `site/public/shots/${file}`, type: "jpeg", quality: file === "hero.jpg" ? 74 : 70 });
      await p.close();
      console.log(`site/public/shots/${file}`);
    }
  }
} finally {
  await b.close();
  await s.close();
}
