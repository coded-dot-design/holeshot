// The built site (artifacts/pages, `npm run site:build` first) in Chromium, at 1440 and 390, dark and
// light: the landing page's hero is the game's attract race (drawn, riding, its HUD hidden), with the
// title, the hook and a PLAY link to /play/; the four sections (how to play, the events, the garage,
// built on Fizlet with the measured size, by David Cooley, linked); no sideways scroll. Reduced motion: the
// still poster, no game. /play/ mounts the game with the first-run setup; once set up, ?mode=bigair
// starts that event. SHOTS=<dir> saves a screenshot of each.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const BASE = (process.env.SITE_BASE || "/holeshot").replace(/\/$/, "");
const server = await serve("artifacts/pages", {}, BASE);
const browser = await chromium.launch(launchOptions());
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const until = (p, fn, arg, what, timeout = 20000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const gz = JSON.parse(readFileSync("dist/build.json", "utf8")).gzip["holeshot.mjs"];

try {
  for (const [w, h, touch] of [[1440, 900, false], [390, 844, true]])
    for (const theme of ["dark", "light"]) {
      const at = `${w} ${theme}`;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
      await ctx.addInitScript((t) => localStorage.setItem("dom-virus:theme", t), theme);
      const p = await ctx.newPage(), errs = [];
      p.on("pageerror", (e) => errs.push(e.message));
      await p.goto(`${server.url}${BASE}/`);
      await until(p, () => window.hero?.run && hero.run.state.speed > 3, null, `${at}: the hero's race rides`);
      const m = await p.evaluate(() => {
        const root = document.querySelector("#dt-hero [data-fizlet-host]").shadowRoot, cv = root.querySelector("canvas"), px = cv.getContext("2d").getImageData(cv.width >> 1, cv.height >> 1, 1, 1).data;
        const play = document.querySelector(".start-key");
        return {
          theme: document.documentElement.dataset.theme,
          drawn: px[3] === 255,
          hud: root.querySelector(".mt-hud").hidden && root.querySelector(".dh-cards").hidden,
          h1: document.querySelector("h1").textContent.trim(),
          play: play.getAttribute("href"),
          playSize: Math.min(play.getBoundingClientRect().width, play.getBoundingClientRect().height) >= 44,
          sections: ["how", "modes", "garage", "fizlet"].every((id) => document.getElementById(id)),
          modes: document.querySelectorAll("#modes li").length,
          size: document.getElementById("fizlet").textContent.replace(/\s+/g, " "),
          by: /by David Cooley/i.test(document.body.textContent) && !!document.querySelector('a[href="https://fizlet.com/people/david-cooley/"]'),
          sideways: document.documentElement.scrollWidth > innerWidth,
        };
      });
      assert.equal(m.theme, theme, `${at}: the theme`);
      assert.ok(m.drawn && m.hud, `${at}: the hero draws the race, no HUD over the copy`);
      assert.equal(m.h1, "Holeshot.One bike. Every kind of dirt.", `${at}: the title and hook`);
      assert.match(m.play, /\/play\/$/, `${at}: PLAY links to /play/`);
      assert.ok(m.playSize && m.sections && m.modes === 5 && m.by, `${at}: PLAY ≥ 44 px, four sections, five ways to ride, by David Cooley (linked)`);
      assert.ok(m.size.includes(`${gz.toLocaleString("en-US")} bytes gzip`), `${at}: the measured size (${gz} B)`);
      assert.equal(m.sideways, false, `${at}: no sideways scroll`);
      if (SHOTS) {
        await p.screenshot({ path: `${SHOTS}/landing-${w}-${theme}.png` });
        if (!touch) await p.screenshot({ path: `${SHOTS}/landing-${w}-${theme}-full.png`, fullPage: true });
      }
      // /play/: the first-run setup; then ?mode= starts an event.
      await p.goto(`${server.url}${BASE}/play/`);
      await until(p, () => window.game && game.getSnapshot().screen === "setup", null, `${at}: /play/ mounts with the setup`);
      if (SHOTS) await p.screenshot({ path: `${SHOTS}/play-setup-${w}-${theme}.png` });
      await p.evaluate(() => game.setup({ starter: "anvil" }));
      if (SHOTS) await p.evaluate(() => game.show("garage")), await p.waitForTimeout(300), await p.screenshot({ path: `${SHOTS}/play-garage-${w}-${theme}.png` });
      await p.goto(`${server.url}${BASE}/play/?mode=bigair`);
      await until(p, () => window.game && game.getSnapshot().mode === "bigair", null, `${at}: ?mode= starts that event`);
      const pad = await p.evaluate(() => !!document.querySelector("[data-fizlet-host]").shadowRoot.querySelector(".ba-pad").offsetParent);
      if (touch) assert.equal(pad, true, `${at}: the pad on a phone`);
      if (SHOTS) {
        await p.evaluate(() => (game.run.auto = true));
        await until(p, () => game.run.state.clock < 52, null, `${at}: riding`);
        await p.screenshot({ path: `${SHOTS}/play-bigair-${w}-${theme}.png` });
      }
      assert.deepEqual(errs, [], `${at}: no page errors`);
      await ctx.close();
    }
  // Reduced motion: the still poster; no game loads.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto(`${server.url}${BASE}/`);
  await until(p, () => document.querySelector(".dt-poster img")?.complete, null, "reduced motion: the poster");
  assert.deepEqual(await p.evaluate(() => ({ poster: !document.querySelector(".dt-poster").hidden, game: !!document.querySelector("[data-fizlet-host]") })), { poster: true, game: false }, "reduced motion: a still poster, no game");
  await ctx.close();
  console.log("Holeshot site: the hero races, the title, PLAY to /play/, four sections, the measured size, no sideways scroll, /play/ setup and ?mode=, the reduced-motion poster; 1440 and 390, dark and light.");
} finally {
  await browser.close();
  await server.close();
}
