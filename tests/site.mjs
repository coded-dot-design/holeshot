// The built site (artifacts/pages, `npm run site:build` first) in Chromium, at 1440 and 390, dark and
// light: the header's wordmark (named HOLESHOT) and a header about the game only (its section links,
// the theme, PLAY; the links out in the footer: Fizlet, the source); the hero is the game behind the
// brand: the poster paints first, in the page's theme (the light still in light, only that one fetched; the
// switch swaps it at once, before the game loads and after), then the attract race starts on its own (no scroll) and replaces
// it (drawn, riding, its HUD and touch controls hidden), under the lockup in the h1, the title, the
// hook and a PLAY link to /play/; the controls (the key caps, the gamepad, the animated rocker); the
// ways to ride (four groups, every entry a live link to a real mode: ?mode= for each, Mashup and Track Day included); the garage
// (3 spots to start, up to 6); the brand kit (eight colours, every download served); built on Fizlet
// with the measured size, by David Cooley, linked; every hard shadow straight down (Fizlet's
// language); no DOM VIRUS; no sideways scroll. Reduced motion: the still poster, no game, the controls
// diagram still. /play/ mounts the game with the first-run setup; once set up, ?mode=bigair
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
// The hero's poster: the still it shows (from its CSS background), whether it shows, the hero stills fetched.
const poster = () => {
  const el = document.querySelector(".dt-poster"), cs = getComputedStyle(el);
  return { file: (cs.backgroundImage.match(/([\w-]+\.jpg)/) || [])[1], shown: !el.hidden && cs.visibility === "visible", fetched: performance.getEntriesByType("resource").map((e) => e.name.split("/").pop()).filter((n) => /^hero[\w-]*\.jpg$/.test(n)) };
};
const still = (w, theme) => `hero${theme === "light" ? "-light" : ""}${w <= 700 ? "-800" : ""}.jpg`;
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
      const first = await p.evaluate(poster);
      assert.deepEqual(first, { file: still(w, theme), shown: true, fetched: [still(w, theme)] }, `${at}: the poster is the ${theme} still, the only one fetched`);
      const brand = await p.evaluate(async () => {
        const wm = document.querySelector(".site-head .brand-mark");
        const dl = [...document.querySelectorAll("#brand a[download]")].map((a) => a.href);
        const ok = await Promise.all(dl.map(async (u) => (await fetch(u)).ok));
        return { wordmark: wm?.getAttribute("aria-label"), wmHeight: wm?.getBoundingClientRect().height, lockup: !!document.querySelector("h1 svg.hero-lockup"), swatches: document.querySelectorAll("#brand .sw").length, downloads: dl.length, served: ok.every(Boolean) };
      });
      assert.ok(brand.wordmark === "HOLESHOT" && brand.wmHeight >= 20 && brand.lockup, `${at}: the header wordmark and the hero lockup: ${JSON.stringify(brand)}`);
      assert.ok(brand.swatches === 8 && brand.downloads >= 6 && brand.served, `${at}: the brand kit: ${JSON.stringify(brand)}`);
      // The race starts by itself after load (no scroll) and takes over from the poster.
      await until(p, () => window.hero?.run && hero.run.state.speed > 3 && document.querySelector(".dt-hero").hasAttribute("data-live"), null, `${at}: the hero's race rides`);
      const m = await p.evaluate(() => {
        const root = document.querySelector("#dt-hero [data-fizlet-host]").shadowRoot, cv = root.querySelector("canvas"), px = cv.getContext("2d").getImageData(cv.width >> 1, cv.height >> 1, 1, 1).data;
        const play = document.querySelector(".start-key");
        return {
          theme: document.documentElement.dataset.theme,
          drawn: px[3] === 255,
          hud: root.querySelector(".mt-hud").hidden && root.querySelector(".dh-cards").hidden && [...root.querySelectorAll(".hs-rocker,.ba-pad")].every((e) => !e.getClientRects().length),
          h1: document.querySelector("h1").textContent.trim(),
          play: play.getAttribute("href"),
          playSize: Math.min(play.getBoundingClientRect().width, play.getBoundingClientRect().height) >= 44,
          sections: ["how", "controls", "modes", "garage", "brand", "fizlet"].every((id) => document.getElementById(id)),
          ways: document.querySelectorAll("#modes .way").length,
          rides: [...document.querySelectorAll("#modes a.go")].map((a) => new URL(a.href).searchParams.get("mode")),
          soon: [...document.querySelectorAll("#modes .way-items li")].filter((li) => li.querySelector(".chip-soon")).map((li) => [li.querySelector("b").textContent, !!li.querySelector("a")]),
          caps: document.querySelectorAll("#controls kbd").length,
          capText: [...document.querySelectorAll("#controls kbd")].map((k) => k.textContent).join(" "),
          rocker: document.querySelectorAll("#controls .ph-rocker .rz").length === 3 && !!document.querySelector("#controls .ph-combo"),
          looping: document.getAnimations().filter((a) => a.effect?.target?.closest?.(".phone")).length,
          garage: document.getElementById("garage-title").textContent,
          spots: [document.querySelectorAll("#garage .spots .open").length, document.querySelectorAll("#garage .spots li").length],
          spotText: document.querySelector("#garage .spots").textContent,
          nav: [...document.querySelectorAll(".site-head a")].map((a) => a.getAttribute("href")),
          foot: [...document.querySelectorAll(".site-foot a")].map((a) => a.href),
          domvirus: /dom virus/i.test(document.body.innerText + document.title + document.querySelector('meta[name="description"]').content),
          shadows: [...document.querySelectorAll(".panel,.sticker,.way,.start-key,#controls kbd,.way-items .go,.brand-grid .dl a,.bui-key")].flatMap((e) => getComputedStyle(e).boxShadow.split(/,(?![^(]*\))/).filter((sh) => sh !== "none").map((sh) => +(sh.replace(/(?:rgba?|color)\([^)]*\)|inset/g, "").trim().split(" ")[0] || "0").replace("px", ""))).filter((x) => x !== 0),
          size: document.getElementById("fizlet").textContent.replace(/\s+/g, " "),
          by: /by David Cooley/i.test(document.body.textContent) && !!document.querySelector('a[href="https://fizlet.com/people/david-cooley/"]'),
          sideways: document.documentElement.scrollWidth > innerWidth,
        };
      });
      assert.equal(m.theme, theme, `${at}: the theme`);
      assert.ok(m.drawn && m.hud, `${at}: the hero draws the race, no HUD over the copy`);
      assert.equal(m.h1, "Holeshot.One bike. Every kind of dirt.", `${at}: the title and hook`);
      assert.match(m.play, /\/play\/$/, `${at}: PLAY links to /play/`);
      assert.ok(m.playSize && m.sections && m.by, `${at}: PLAY ≥ 44 px, six sections, by David Cooley (linked)`);
      assert.equal(m.ways, 4, `${at}: four ways to ride`);
      assert.deepEqual([...new Set(m.rides)].sort(), ["bigair", "desert", "endcity", "freeride", "mashup", "race", "trackday"], `${at}: every live mode has a ride link, and only real modes`);
      assert.deepEqual(m.soon, [], `${at}: no coming-soon entries (Mashup and Track Day are live)`);
      assert.ok(m.caps >= 20 && ["Space", "J", "K", "Shift", "W", "S", "A", "D", "L", "C", "R", "V", "M", "P", "Esc"].every((k) => m.capText.split(" ").includes(k)), `${at}: the key caps: ${m.capText}`);
      assert.ok(m.rocker && m.looping > 0, `${at}: the rocker diagram (three zones, COMBO), animated`);
      assert.match(m.garage, /Three spots to start\. Grow to six\./, `${at}: the garage's spots`);
      assert.deepEqual(m.spots, [3, 6], `${at}: 3 garage spots open of 6`);
      assert.match(m.spotText, /2,500.*5,000.*10,000/, `${at}: the spots' prices`);
      assert.ok(m.nav.every((h) => !/^https?:/.test(h)), `${at}: the header links stay on the site: ${m.nav}`);
      assert.ok(m.foot.some((h) => h.startsWith("https://github.com/")) && m.foot.some((h) => h === "https://fizlet.com/"), `${at}: the footer links out (source, Fizlet)`);
      assert.equal(m.domvirus, false, `${at}: no DOM VIRUS`);
      assert.deepEqual(m.shadows, [], `${at}: every hard shadow straight down`);
      assert.ok(m.size.includes(`${gz.toLocaleString("en-US")} bytes gzip`), `${at}: the measured size (${gz} B)`);
      assert.equal(m.sideways, false, `${at}: no sideways scroll`);
      if (SHOTS) {
        await p.evaluate(() => scrollTo(0, 0));
        await p.screenshot({ path: `${SHOTS}/landing-${w}-${theme}.png` });
        if (!touch) await p.screenshot({ path: `${SHOTS}/landing-${w}-${theme}-full.png`, fullPage: true });
      }
      // /play/: the first-run setup; then ?mode= starts an event.
      await p.goto(`${server.url}${BASE}/play/`);
      await until(p, () => window.game && game.getSnapshot().screen === "setup", null, `${at}: /play/ mounts with the setup`);
      if (SHOTS) await p.screenshot({ path: `${SHOTS}/play-setup-${w}-${theme}.png` });
      await p.evaluate(() => game.setup({ starter: "anvil" }));
      // The header handle (shown where there is a pointer) clears the garage card's top edge.
      await p.evaluate(() => game.show("garage"));
      await until(p, () => !!document.querySelector("#game [data-fizlet-host]").shadowRoot.querySelector(".dh-garage"), null, `${at}: the garage`);
      const gap = await p.evaluate(() => { const h = document.querySelector(".head-handle"), c = document.querySelector("#game [data-fizlet-host]").shadowRoot.querySelector(".dh-garage"); return h.getClientRects().length ? c.getBoundingClientRect().top - h.getBoundingClientRect().bottom : null; });
      assert.ok(gap === null || gap >= 4, `${at}: the header handle clears the card (${gap} px)`);
      if (SHOTS) await p.waitForTimeout(300), await p.screenshot({ path: `${SHOTS}/play-garage-${w}-${theme}.png` });
      await p.goto(`${server.url}${BASE}/play/?mode=bigair`);
      await until(p, () => window.game && game.getSnapshot().mode === "bigair", null, `${at}: ?mode= starts that event`);
      for (const id of ["mashup", "trackday"]) {
        await p.goto(`${server.url}${BASE}/play/?mode=${id}`);
        await until(p, (id) => window.game && game.getSnapshot().mode === id, id, `${at}: ?mode=${id} starts it`);
      }
      await p.goto(`${server.url}${BASE}/play/?mode=bigair`);
      await until(p, () => window.game && game.getSnapshot().mode === "bigair", null, `${at}: back to Big Air`);
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
  // The Home Screen tip and the PWA bits: the manifest (full screen, start at /play/, icons), shown
  // once in a phone's landscape only (never portrait, never desktop), remembered.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(`${server.url}${BASE}/play/`);
    await until(p, () => window.game, null, "desktop: /play/");
    const man = await p.evaluate(async () => { const l = document.querySelector('link[rel="manifest"]'); const m = await (await fetch(l.href)).json(); const ok = await Promise.all(m.icons.map(async (i) => (await fetch(new URL(i.src, l.href))).ok)); return { display: m.display, start: new URL(m.start_url, l.href).pathname, icons: m.icons.length, ok: ok.every(Boolean), apple: !!document.querySelector('link[rel="apple-touch-icon"]'), theme: document.querySelector('meta[name="theme-color"]')?.content }; });
    assert.ok(man.display === "fullscreen" && man.start === `${BASE}/play/` && man.icons >= 3 && man.ok && man.apple && man.theme, `the manifest: ${JSON.stringify(man)}`);
    assert.equal(await p.evaluate(() => document.querySelector(".pwa-tip").hidden), true, "desktop: no Home Screen tip");
    await ctx.close();
    for (const [w, h, show] of [[390, 844, false], [844, 390, true]]) {
      const c2 = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
      const q = await c2.newPage();
      await q.goto(`${server.url}${BASE}/play/`);
      await until(q, () => window.game, null, `${w}: /play/`);
      const tip = await q.evaluate(() => { const t = document.querySelector(".pwa-tip"); return { shown: !t.hidden, text: t.textContent.replace(/\s+/g, " ").trim() }; });
      assert.equal(tip.shown, show, `${w}×${h}: the Home Screen tip ${show ? "shown" : "not shown"}`);
      if (show) {
        assert.match(tip.text, /add HOLESHOT to your Home Screen/i);
        if (SHOTS) await q.screenshot({ path: `${SHOTS}/play-pwa-tip-${w}.png` });
        await q.click(".pwa-x");
        assert.equal(await q.evaluate(() => document.querySelector(".pwa-tip").hidden), true, "dismissed");
        await q.reload();
        await until(q, () => window.game, null, `${w}: /play/ again`);
        assert.equal(await q.evaluate(() => document.querySelector(".pwa-tip").hidden), true, "once: remembered");
      }
      await c2.close();
    }
  }
  // The poster follows the theme before the game loads: saved light, the game's module held back; the
  // light still first, the switch swaps it at once (both ways); released, the race rides in the theme
  // and the poster leaves the layout, so a switch then fetches no still.
  for (const [w, h, touch] of [[1440, 900, false], [390, 844, true]]) {
    const at = `${w} poster`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript(() => localStorage.setItem("dom-virus:theme", "light"));
    let release, asked = false;
    const held = new Promise((r) => (release = r));
    await ctx.route(/\/holeshot\.[\w-]+\.js$/, async (r) => ((asked = true), await held, r.continue()));
    const p = await ctx.newPage();
    await p.goto(`${server.url}${BASE}/`);
    await until(p, () => document.readyState === "complete", null, `${at}: loaded`);
    assert.deepEqual(await p.evaluate(poster), { file: still(w, "light"), shown: true, fetched: [still(w, "light")] }, `${at}: light first, the dark still not fetched`);
    assert.ok(!(await p.evaluate(() => !!document.querySelector("[data-fizlet-host]"))), `${at}: the game has not loaded yet`);
    await p.click("[data-theme-toggle]");
    assert.equal((await p.evaluate(poster)).file, still(w, "dark"), `${at}: the switch swaps to the dark still at once`);
    await p.click("[data-theme-toggle]");
    assert.equal((await p.evaluate(poster)).file, still(w, "light"), `${at}: and back`);
    assert.ok(!(await p.evaluate(() => !!document.querySelector("[data-fizlet-host]"))), `${at}: still before the game`);
    release();
    await until(p, () => window.hero?.run && hero.run.state.speed > 3 && document.querySelector(".dt-hero").hasAttribute("data-live") && document.querySelector(".dt-poster").hidden, null, `${at}: the race rides, the poster gone`);
    assert.ok(asked, `${at}: the game module was held back`);
    const live = await p.evaluate(() => document.querySelector("#dt-hero [data-fizlet-host]").shadowRoot.querySelector("[data-theme]")?.dataset.theme);
    assert.equal(live, "light", `${at}: the race rides in light`);
    const before = (await p.evaluate(poster)).fetched;
    await p.click("[data-theme-toggle]");
    await until(p, () => document.querySelector("#dt-hero [data-fizlet-host]").shadowRoot.querySelector("[data-theme]")?.dataset.theme === "dark", null, `${at}: the race follows the switch`);
    assert.deepEqual((await p.evaluate(poster)).fetched, before, `${at}: no still fetched for a gone poster`);
    await ctx.close();
  }
  // Reduced motion: the still poster; no game loads.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto(`${server.url}${BASE}/`);
  await until(p, () => document.readyState === "complete" && performance.getEntriesByType("resource").some((e) => /\/hero\.jpg$/.test(e.name) && e.responseEnd > 0), null, "reduced motion: the poster");
  await p.evaluate(() => new Promise((r) => requestIdleCallback(() => r(), { timeout: 2000 })));
  assert.deepEqual(await p.evaluate(() => ({ poster: getComputedStyle(document.querySelector(".dt-poster")).visibility, game: !!document.querySelector("[data-fizlet-host]"), looping: document.getAnimations().filter((a) => a.effect?.target?.closest?.(".phone")).length })), { poster: "visible", game: false, looping: 0 }, "reduced motion: a still poster, no game, a still controls diagram");
  await ctx.close();
  console.log("Holeshot site: the header wordmark and game-only header, the footer links out, the hero lockup over the demo race (poster first, no touch controls), the controls (key caps, gamepad, the animated rocker), four ways to ride (every entry a live link to a real mode; ?mode=mashup and ?mode=trackday start), the garage's 3 of 6 spots, the brand kit and its downloads, the title, PLAY to /play/, six sections, the measured size, shadows straight down, no DOM VIRUS, no sideways scroll, /play/ setup (the header handle clear of the card) and ?mode=, the poster in the page's theme (light first, only that still fetched, the switch swaps it before the game and after), the reduced-motion poster; 1440 and 390, dark and light; the manifest and the one-time Home Screen tip (phone landscape only).");
} finally {
  await browser.close();
  await server.close();
}
