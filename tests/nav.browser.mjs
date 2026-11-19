// The navigation (owner, 2026-11-19), at 1440 (mouse) and 390 (touch, taps), on the built
// dist/holeshot.mjs: the garage is home (after the first-run setup and on every load), with one main
// action, LET'S RIDE, and ⚙ settings beside the theme key; no row of top links. LET'S RIDE shows the
// four groups (RACE, ENDLESS, FREE RIDE, TRACK DAY), each with its line, laid out side by side on a
// wide screen and stacked on a phone, with no sideways scroll and ← GARAGE always in view; a tile
// starts a ride, and the result's GARAGE key comes home. ⚙ opens the settings and ← goes back.
// Garage spots: + BUY SPOT buys the 4th with real credits (saved); with ?money=inf spots 4-6 and
// bikes up to six, then no BUY key and no spot is left (the 7th bike is refused: only a trade-in),
// and nothing is saved. Chromium always; WebKit too with BROWSERS=chromium,webkit (and
// PLAYWRIGHT_BROWSERS_PATH pointing at a WebKit build). Waits on the game's state, never on time.
import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const page = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false, onTheme: () => {} });</script></body></html>`;
const server = await serve(".", { "/": page });
const want = (process.env.BROWSERS ?? "chromium").split(",");
const R = "document.querySelector('[data-fizlet-host]').shadowRoot";
const $ = (p, fn, arg) => p.evaluate(`((root, arg) => (${fn}))(${R}, ${JSON.stringify(arg ?? null)})`);
const until = (p, fn, what, timeout = 20000) => p.waitForFunction(`((root) => (${fn}))(${R})`, null, { timeout, polling: 30 }).catch(async () => assert.fail(`${what}: timed out (${await p.evaluate(() => JSON.stringify({ screen: game.getSnapshot().screen })).catch((e) => e.message)})`));
const screen = (p) => p.evaluate(() => game.getSnapshot().screen);
const saved = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("holeshot:profile") || "null"));

try {
  for (const [bn, type, opts] of [["chromium", chromium, launchOptions()], ["webkit", webkit, {}]]) {
    if (!want.includes(bn)) continue;
    const browser = await type.launch(opts);
    try {
      for (const [vn, viewport, touch] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]]) {
        const at = `${bn} ${vn}`;
        const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
        const p = await ctx.newPage(), errs = [];
        p.on("pageerror", (e) => errs.push(e.message));
        /** A real tap (phone) or click (desktop) on the first visible match (Playwright pierces the shadow root). */
        const press = async (sel) => { const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await (touch ? l.tap() : l.click()); };
        const sideways = () => $(p, "root.querySelector('.dh-cards').scrollWidth > innerWidth + 1");

        // ---- the first-run setup lands on the garage ----
        await p.goto(server.url + "/");
        await until(p, "window.game && game.getSnapshot().screen === 'setup'", `${at}: a fresh device: the setup`);
        await press(".dh-setup button[type=submit]");
        await until(p, "game.getSnapshot().screen === 'garage'", `${at}: setup → the garage`);

        // ---- the garage is home: one main action, ⚙ beside the theme key, no top links ----
        await p.goto(server.url + "/");
        await until(p, "window.game && game.getSnapshot().screen === 'garage' && root.querySelector('.dh-preview').width > 50", `${at}: a load lands on the garage`);
        const home = await $(p, `(() => {
          const r = (e) => e.getBoundingClientRect(), cog = root.querySelector('.dh-cog'), th = root.querySelector('.dh-theme'), go = root.querySelector('.dh-letsride');
          return { tabs: root.querySelectorAll('.dh-tabs, nav[aria-label=Menu]').length, go: root.querySelectorAll('.dh-letsride').length, label: go.textContent.includes("LET'S RIDE"), focus: root.activeElement === go,
            gogo: go.dataset.go, cog: cog.getAttribute('aria-label'), beside: Math.abs(r(cog).top - r(th).top) < 2 && r(th).left > r(cog).left && r(th).left - r(cog).right < 16,
            big: Math.min(r(go).width, r(go).height) >= 44 && [cog, th].every((k) => Math.min(r(k).width, r(k).height) >= 44), inView: r(go).bottom <= innerHeight && r(go).top >= 0 };
        })()`);
        assert.deepEqual(home, { tabs: 0, go: 1, label: true, focus: true, gogo: "ride", cog: "Settings", beside: true, big: true, inView: true }, `${at}: the garage, home`);
        assert.equal(await sideways(), false, `${at}: garage: no sideways scroll`);

        // ---- ⚙ opens the settings; ← GARAGE goes back; Escape steps back too (keyboard) ----
        await press(".dh-cog");
        await until(p, "game.getSnapshot().screen === 'settings'", `${at}: ⚙ opens the settings`);
        assert.ok(await $(p, "!!root.querySelector('.dh-units') && !root.querySelector('.dh-cog')"), `${at}: the settings, no ⚙ on them`);
        await press(".dh-set .dh-back");
        await until(p, "game.getSnapshot().screen === 'garage'", `${at}: ← GARAGE from the settings`);

        // ---- LET'S RIDE: four groups, each with a line; a grid on a wide screen, stacked on a phone ----
        await press(".dh-letsride");
        await until(p, "game.getSnapshot().screen === 'ride'", `${at}: LET'S RIDE`);
        const groups = await $(p, `[...root.querySelectorAll('.dh-grp')].map((g) => { const h = g.querySelector('header').getBoundingClientRect(), t = g.querySelector('.dh-tiles').getBoundingClientRect(); return [g.dataset.grp, g.querySelector('h2').textContent, g.querySelector('header p').textContent.length > 20, t.left >= h.right ? "side" : t.top >= h.bottom ? "stacked" : "?"]; })`);
        const lay = touch ? "stacked" : "side";
        assert.deepEqual(groups, [["race", "RACE", true, lay], ["endless", "ENDLESS", true, lay], ["free", "FREE RIDE", true, lay], ["day", "TRACK DAY", true, lay]], `${at}: the groups`);
        const tiles = await $(p, `(() => {
          const r = (e) => e.getBoundingClientRect(), keys = [...root.querySelectorAll('.dh-ridec .dh-grps button')];
          const g = (id) => [...root.querySelectorAll('[data-grp=' + id + '] button')];
          return {
            race: g('race').map((b) => (b.dataset.go || b.dataset.mode || 'online') + (b.dataset.venue ? ':' + b.dataset.venue : '') + (b.disabled ? '!' : '')),
            endless: g('endless').map((b) => (b.dataset.endless || b.dataset.mode || (b.classList.contains('ol-open') ? 'online' : 'soon')) + (b.disabled ? '!' : '')),
            free: g('free').map((b) => (b.dataset.map || b.dataset.mode || (b.classList.contains('ol-open') ? 'online' : 'soon')) + (b.disabled ? '!' : '')),
            day: g('day').map((b) => (b.disabled ? 'soon!' : 'ride')),
            big: keys.every((k) => Math.min(r(k).width, r(k).height) >= 44),
          };
        })()`);
        assert.deepEqual(tiles, {
          race: ["series:mx", "series:sx", "race:mx", "race:sx", "online"],
          endless: ["desert", "quarry", "forest", "night-park", "endcity", "online", "soon!"],
          free: ["neon-park", "dune-sea", "quarry", "forest", "night-park", "sx-floor", "sx-volt-floor", "bigair", "online"],
          day: ["soon!"], big: true,
        }, `${at}: the tiles (SERIES first; MX and SX; the coming ones disabled)`);
        assert.equal(await sideways(), false, `${at}: LET'S RIDE: no sideways scroll`);
        // ← GARAGE stays top-left with the groups scrolled to the end.
        await $(p, "(() => { const c = root.querySelector('.dh-cards'); c.scrollTop = c.scrollHeight; })()");
        await until(p, "(() => { const b = root.querySelector('.dh-ridec .dh-back').getBoundingClientRect(); return root.querySelector('.dh-cards').scrollTop > 200 && b.top >= 0 && b.top < 80 && b.left < innerWidth / 3; })()", `${at}: ← GARAGE in view, top-left, scrolled down`);
        await press(".dh-ridec .dh-back");
        await until(p, "game.getSnapshot().screen === 'garage'", `${at}: ← GARAGE`);
        if (!touch) {
          await press(".dh-letsride");
          await until(p, "game.getSnapshot().screen === 'ride'", `${at}: LET'S RIDE again`);
          await p.keyboard.press("Escape");
          await until(p, "game.getSnapshot().screen === 'garage'", `${at}: Escape steps back to the garage`);
        }

        // ---- a ride from a tile, then the result, then home ----
        await press(".dh-letsride");
        await until(p, "game.getSnapshot().screen === 'ride'", `${at}: LET'S RIDE`);
        await press("[data-endless=quarry]");
        await until(p, "game.getSnapshot().screen === 'event' && game.getSnapshot().mode === 'desert' && game.getSnapshot().run.phase === 'ready'", `${at}: a tile starts the ride`);
        await p.evaluate(() => game.leave());
        await until(p, "game.getSnapshot().screen === 'result'", `${at}: left: the result`);
        assert.equal(await $(p, "root.querySelector('.dh-result .dh-go').dataset.go"), "garage", `${at}: GARAGE is the result's main key`);
        await press(".dh-result [data-go=garage]");
        await until(p, "game.getSnapshot().screen === 'garage'", `${at}: back on the garage`);
        // A SERIES key opens the series (← LET'S RIDE back), a RACE key races.
        await press(".dh-letsride");
        await press("[data-go=series][data-venue=mx]");
        await until(p, "game.getSnapshot().screen === 'series' && /SERIES · MX/.test(root.querySelector('.dh-title').textContent)", `${at}: SERIES · MX`);
        await press(".ds .dh-back");
        await until(p, "game.getSnapshot().screen === 'ride'", `${at}: ← LET'S RIDE`);
        await press("[data-go=series][data-venue=sx]");
        await until(p, "game.getSnapshot().screen === 'series' && /SERIES · SX/.test(root.querySelector('.dh-title').textContent) && /SX STADIUM SERIES/.test(root.querySelector('.ds > b.dh-h').textContent)", `${at}: SERIES · SX`);
        await press(".ds [data-series-enter]:not(:disabled)");
        await until(p, "game.profile.series.run && game.profile.series.run.venue === 'sx'", `${at}: entered at SX`);
        await press(".ds [data-series-retire]");
        await press(".ds [data-series-retire]");
        await until(p, "!game.profile.series.run", `${at}: retired`);
        await press(".ds .dh-back");
        await press("[data-mode=race][data-venue=sx]");
        await until(p, "game.getSnapshot().screen === 'event' && game.getSnapshot().mode === 'race' && /^sx-/.test(game.getSnapshot().run.map)", `${at}: RACE · SX`);
        await p.evaluate(() => game.leave());
        await until(p, "game.getSnapshot().screen === 'result'", `${at}: left the SX race`);
        await press(".dh-result [data-go=ride]");
        await press("[data-map=sx-floor]");
        await until(p, "game.getSnapshot().screen === 'event' && game.getSnapshot().mode === 'freeride'", `${at}: FREE RIDE · STADIUM FLOOR`);
        await p.evaluate(() => game.leave());
        await until(p, "game.getSnapshot().screen === 'result'", `${at}: left`);
        await press(".dh-result [data-go=ride]");
        await press("[data-mode=race][data-venue=mx]");
        await until(p, "game.getSnapshot().screen === 'event' && game.getSnapshot().mode === 'race'", `${at}: RACE · MX`);
        await p.evaluate(() => game.finish());
        await until(p, "game.getSnapshot().screen === 'result'", `${at}: the race ends`);
        await press(".dh-result [data-go=garage]");
        await until(p, "game.getSnapshot().screen === 'garage'", `${at}: home again`);

        // ---- a garage spot, bought with real credits (and saved) ----
        const s0 = await saved(p);
        assert.equal(s0.slots, 3, `${at}: three spots to start`);
        await p.evaluate((s) => localStorage.setItem("holeshot:profile", JSON.stringify({ ...s, credits: 3000 })), s0);
        await p.goto(server.url + "/");
        await until(p, "window.game && game.getSnapshot().screen === 'garage'", `${at}: reload`);
        assert.match(await $(p, "root.querySelector('.dh-spot').textContent"), /SPOT 4 OF 6.*BUY SPOT.*2,500/, `${at}: + BUY SPOT, the 4th, its price`);
        await press(".dh-spot");
        await until(p, "game.profile.slots === 4", `${at}: the 4th spot`);
        assert.deepEqual([(await saved(p)).slots, (await saved(p)).credits], [4, 500], `${at}: paid and saved`);
        assert.match(await $(p, "root.querySelector('.dh-spot').textContent"), /SPOT 5 OF 6.*5,000/, `${at}: the 5th costs more`);

        // ---- test credits: spots to six, bikes to six, then the 7th is refused; nothing saved ----
        const real = JSON.stringify(await saved(p));
        await p.goto(server.url + "/?money=inf");
        await until(p, "window.game && game.getSnapshot().screen === 'garage' && game.getSnapshot().testCredits", `${at}: test credits`);
        while (await $(p, "!!root.querySelector('.dh-spot')")) await press(".dh-spot");
        assert.equal(await p.evaluate(() => game.profile.slots), 6, `${at}: six spots`);
        await press("[data-gtab=showroom]");
        for (let n = await p.evaluate(() => game.profile.bikes.length); n < 6; n++) {
          await press("[data-bike]:not([data-trade]):not(:disabled)");
          await until(p, `game.profile.bikes.length === ${n + 1}`, `${at}: bike ${n + 1}`);
          if (await screen(p) !== "garage") break;
          if (await $(p, "root.querySelector('[data-gtab=showroom]').getAttribute('aria-pressed') !== 'true'")) await press("[data-gtab=showroom]");
        }
        const full = await $(p, "({ bikes: game.profile.bikes.length, buy: root.querySelectorAll('[data-bike]:not([data-trade])').length, trade: root.querySelectorAll('[data-bike][data-trade]').length > 0, spot: !!root.querySelector('.dh-spot'), empty: !!root.querySelector('.dh-slots .dh-empty') })");
        assert.deepEqual(full, { bikes: 6, buy: 0, trade: true, spot: false, empty: false }, `${at}: six bikes: no BUY, no spot left, only TRADE IN`);
        await press("[data-bike][data-trade]");
        await until(p, "/Traded in/.test(root.querySelector('.dh-live').textContent)", `${at}: a trade-in`);
        assert.equal(await p.evaluate(() => game.profile.bikes.length), 6, `${at}: still six (the 7th is refused)`);
        assert.equal(JSON.stringify(await saved(p)), real, `${at}: test credits: nothing saved`);
        assert.deepEqual(errs, [], `${at}: no page errors`);
        await ctx.close();
      }
    } finally {
      await browser.close();
    }
  }
  console.log("nav.browser: ok");
} finally {
  await server.close();
}
