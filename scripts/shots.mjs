// The site's stills, from the game itself (dist/holeshot.mjs) in Chromium: the hero's reduced-motion
// poster (shots/hero.jpg, 1600×900) and the share image (shots/og.jpg, 1200×630), both a moment of the
// attract race. Run after `npm run build`: node scripts/shots.mjs (CHROMIUM_PATH optional).
import { chromium } from "playwright";
import { serve, launchOptions } from "../tests/serve.mjs";
const page = `<!doctype html><html data-theme="dark"><body style="margin:0;background:#0d0b1c"><div id=h style="position:fixed;inset:0"></div><script type=module>import { createHoleshot } from "/dist/holeshot.mjs"; window.g = createHoleshot({ host: document.getElementById("h"), attract: true, sound: false });</script>`;
const s = await serve(".", { "/": page });
const b = await chromium.launch(launchOptions());
try {
  for (const [file, width, height, at] of [["hero.jpg", 1600, 900, 9], ["og.jpg", 1200, 630, 9]]) {
    const p = await b.newPage({ viewport: { width, height } });
    await p.goto(s.url + "/");
    await p.waitForFunction((at) => window.g?.run && g.run.state.clock >= at, at, { timeout: 60000, polling: 16 });
    await p.evaluate(() => g.run.engine.stop());
    await p.screenshot({ path: `site/public/shots/${file}`, type: "jpeg", quality: 84 });
    await p.close();
    console.log(`site/public/shots/${file}`);
  }
} finally {
  await b.close();
  await s.close();
}
