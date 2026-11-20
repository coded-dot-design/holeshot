// Every action the garage offered before its rebuild, reached and done in the new UI (Chromium, the
// built dist/holeshot.mjs, 1440 and 390): the header (Garage / Showroom, Rider, ⚙ settings and its
// units / export / import, Day / Night), LET'S RIDE and the online entry, the turntable's ‹ › and
// drag, My Bikes (select a bike, sell with a confirm at its trade value, unlock a bay), Parts & Mods
// (a new set of each compound, service, rebuild, fix, every tune choice, an upgrade from its
// preview, the service log), Paint & Kit (paint, plastics, graphics, plate decal, race number, the
// owned filter and paging; every rider slot; an outfit; try on, cancel, buy), the showroom's buy,
// Escape (closes a menu, cancels a try-on) and the pit crew. Waits on state, never on time.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const page = (theme) => `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false, onTheme: () => { const h = document.documentElement; h.dataset.theme = h.dataset.theme === "light" ? "dark" : "light"; } });</script></body></html>`;
const server = await serve(".", { "/": page("dark"), "/day": page("light") });
const browser = await chromium.launch(launchOptions());
const kit = { helmet: "peak", helmetPaint: "white", visor: "smoke", jersey: "lime", pants: "ink", pattern: "stripe", boots: "white", gloves: "ink" };
const bike = (uid, model, extra = {}) => ({ uid, model, parts: { tyres: 0.5, chain: 0.6, motor: 0.7, susp: 0.8, brakes: 0.9 }, look: { paint: "acid", number: 23 }, dmg: { bars: 0.4, plastics: 0.3 }, odo: 3000, events: 6, ...extra });
const SAVE = { v: 7, name: "KIP", credits: 40000, ride: 0, slots: 3, owned: [], pit: 0, stats: { events: 6, wins: 0, earned: 900, best: {} }, kit, bikes: [bike("b1", "buzzline"), bike("b2", "anvil", { look: { paint: "pinkout", number: 8 } })] };
const root = "document.querySelector('[data-fizlet-host]').shadowRoot";
const $ = (p, fn, arg) => p.evaluate(`((root, arg) => (${fn}))(${root}, ${JSON.stringify(arg ?? null)})`);
const until = (p, fn, what, timeout = 20000) => p.waitForFunction(`((root) => (${fn}))(${root})`, null, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const prof = (p) => p.evaluate(() => JSON.parse(JSON.stringify(game.profile)));
const screen = (p) => p.evaluate(() => game.getSnapshot().screen);
const has = (p, sel) => $(p, "!!root.querySelector(arg)", sel);
const done = [];

try {
  for (const [name, viewport, touch, path] of [["desktop", { width: 1440, height: 900 }, false, "/"], ["phone", { width: 390, height: 844 }, true, "/day"]]) {
    const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) localStorage.setItem("holeshot:profile", s), sessionStorage.setItem("seeded", "1"); }, JSON.stringify(SAVE));
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    // A real press on the element (scrolled into view; a tap on touch): it must be reachable.
    // (Centred, so the sticky header never sits over it.)
    const press = async (sel) => { const l = p.locator(sel).first(); await l.evaluate((e) => e.scrollIntoView({ block: "center" })); await (touch ? l.tap() : l.click()); };
    const ok = (what) => name === "desktop" && done.push(what);
    await p.goto(server.url + path);
    await until(p, "window.game && game.getSnapshot().screen === 'garage'", `${name}: loads`);
    const b0 = () => prof(p).then((q) => q.bikes[q.ride]);

    // ---- header: the app icon, the wordmark, the version, BY DAVID COOLEY, credits, Rider, ⚙, Day / Night ----
    const H = await $(p, "(() => { const h = root.querySelector('.dh-ghead'), vis = (s) => { const e = h.querySelector(s); return !!e && e.getClientRects().length > 0; }; return { icon: vis('.dh-appicon'), mark: vis('.dh-logo'), text: h.textContent, cr: vis('.dh-cr'), rider: !!h.querySelector('[data-rider]'), riderShown: vis('[data-rider]'), cog: vis('.dh-cog'), theme: vis('.dh-theme') }; })()");
    assert.ok(H.icon && H.mark && H.cr && H.rider && H.cog && H.theme, `${name}: the header's pieces (${JSON.stringify({ ...H, text: undefined })})`);
    assert.match(H.text, /V\d+\.\d+\.\d+.*BY DAVID COOLEY/s, `${name}: the version and the byline`);
    if (name === "desktop") assert.ok(H.riderShown, `${name}: Rider shows`);
    ok("header: app icon, wordmark, version, BY DAVID COOLEY, credits, Rider, ⚙, Day / Night");
    await press("[data-gtab=showroom]");
    await until(p, "!!root.querySelector('.shop-cat')", `${name}: Showroom tab`);
    await press("[data-gtab=garage]");
    await until(p, "!!root.querySelector('[data-gsub]')", `${name}: Garage tab`);
    ok("Garage / Showroom tabs");
    if (name === "desktop") {
      await press("[data-rider]");
      await until(p, "root.querySelector('[data-look=rider]')?.getAttribute('aria-pressed') === 'true'", `${name}: Rider opens the rider's gear`);
      ok("Rider (header) → Paint & Kit › Rider gear");
      await press("[data-gtab=bike]");
    }
    const th = await p.evaluate(() => document.documentElement.dataset.theme);
    await press(".dh-theme");
    await until(p, `document.documentElement.dataset.theme !== ${JSON.stringify(th)}`, `${name}: Day / Night`);
    ok("Day / Night");
    await press("[data-go=settings]");
    await until(p, "game.getSnapshot().screen === 'settings'", `${name}: ⚙ settings`);
    for (const k of [".dh-units", ".dh-sound", ".dh-copy", ".dh-import", ".dh-reset"]) assert.ok(await has(p, k), `${name}: settings has ${k}`);
    const u = (await prof(p)).settings.units;
    await press(".dh-units");
    await until(p, `game.profile.settings.units !== ${JSON.stringify(u)}`, `${name}: units`);
    await press(".dh-units");
    await press("[data-go=controls]");
    await until(p, "game.getSnapshot().screen === 'controls' && !!root.querySelector('.dh-ctl')", `${name}: CONTROLS · HOW TO`);
    await press(".dh-back");
    await until(p, "game.getSnapshot().screen === 'settings'", `${name}: back to settings`);
    ok("⚙ settings: units, sound, export / import code, reset, CONTROLS · HOW TO");
    await press(".dh-back");
    await until(p, "game.getSnapshot().screen === 'garage'", `${name}: back to the garage`);
    // The settings page's rows (the shop's design): CONTROLS · HOW TO as a row, the test credits row, START
    // OVER asking first; the Rider key on a page opens the rider's gear in the garage.
    await press("[data-go=settings]");
    await until(p, "game.getSnapshot().screen === 'settings'", `${name}: ⚙ settings again`);
    assert.ok(await has(p, ".dh-set .dh-ctl-go[data-go=controls]"), `${name}: CONTROLS · HOW TO is a row`);
    assert.match(await $(p, "root.querySelector('.dh-set').textContent"), /Test credits.*credits=inf.*Off/s, `${name}: the test credits row`);
    await press(".dh-reset");
    assert.equal(await $(p, "root.querySelector('.dh-reset').textContent"), "Sure? Tap again", `${name}: start over asks first`);
    if (name === "desktop") {
      await press(".dh-set [data-rider]");
      await until(p, "game.getSnapshot().screen === 'garage' && root.querySelector('[data-look=rider]')?.getAttribute('aria-pressed') === 'true'", `${name}: Rider from the settings`);
      await press("[data-gtab=bike]");
    } else await press(".dh-back"), await until(p, "game.getSnapshot().screen === 'garage'", `${name}: back to the garage`);
    ok("settings rows: CONTROLS · HOW TO, test credits, start over asks first; Rider from a page");
    // A ride left at once: the result's wear column reads 0%, neutral (never a pink −0.0%).
    await p.evaluate(() => game.start("race"));
    await until(p, "game.getSnapshot().screen === 'event' || !!root.querySelector('.dh-risk')", `${name}: a race`);
    if (await has(p, ".dh-risk")) await press(".dh-risk-go");
    await until(p, "game.getSnapshot().screen === 'event'", `${name}: racing`);
    await p.evaluate(() => game.leave());
    await until(p, "game.getSnapshot().screen === 'result'", `${name}: the result`);
    assert.deepEqual(await $(p, "[...root.querySelectorAll('.dh-wear small')].map((e) => [e.textContent, e.hasAttribute('data-d')])"), Array(5).fill(["0%", false]), `${name}: nothing wore: 0%, neutral`);
    await press(".dh-result [data-go=garage]");
    await until(p, "game.getSnapshot().screen === 'garage'", `${name}: the result's Garage key`);
    ok("result: nothing worn reads 0%, neutral; its Garage key");

    // ---- LET'S RIDE and the online entry ----
    await press(".dh-letsride");
    await until(p, "game.getSnapshot().screen === 'ride'", `${name}: LET'S RIDE`);
    assert.ok(await has(p, ".ol-open"), `${name}: the online entry`);
    ok("LET'S RIDE (its screen, the online entry)");
    await press(".dh-back");
    await until(p, "game.getSnapshot().screen === 'garage'", `${name}: back`);

    // ---- the turntable: ‹ › between your bikes; drag turns it ----
    await press("[data-turn='1']");
    await until(p, "game.profile.ride === 1", `${name}: › next bike`);
    await press("[data-turn='-1']");
    await until(p, "game.profile.ride === 0", `${name}: ‹ previous bike`);
    ok("turntable ‹ › (swap the bike that rides)");
    // The backdrop picker: each pick pressed, shown on the turntable (AUTO: the theme's), saved, and the showroom's preview wears it.
    for (const want of ["track", "sunset", "auto"]) {
      await press(`[data-backdrop=${want}]`);
      await until(p, `game.profile.settings.backdrop === ${JSON.stringify(want)} && root.querySelector('[data-backdrop=${want}]').getAttribute('aria-pressed') === 'true'`, `${name}: backdrop ${want}`);
      await until(p, `root.querySelector('.dh-preview')?.dataset.scene === (${JSON.stringify(want)} === 'auto' ? (document.documentElement.dataset.theme === 'light' ? 'track' : 'sunset') : ${JSON.stringify(want)})`, `${name}: the turntable shows ${want}`);
    }
    await press("[data-backdrop=sunset]");
    await until(p, "JSON.parse(localStorage.getItem('holeshot:profile') || '{}').settings?.backdrop === 'sunset'", `${name}: the pick is saved`);
    await press("[data-gtab=showroom]");
    await until(p, "root.querySelector('.shop-cat') && root.querySelector('.dh-preview')?.dataset.scene === 'sunset'", `${name}: the showroom preview wears the pick`);
    await press("[data-gtab=garage]");
    await until(p, "!!root.querySelector('[data-backdrop=auto]')", `${name}: back to the garage`);
    await press("[data-backdrop=auto]");
    await until(p, "game.profile.settings.backdrop === 'auto'", `${name}: backdrop auto again`);
    ok("the turntable's backdrop (Auto · Track · Sunset, saved)");

    // ---- My Bikes: select, sell (confirm, trade value), unlock a bay ----
    // (My Bikes is the rail over the turntable: every bay's keys are on screen.)
    assert.equal(await $(p, "root.querySelectorAll('.dh-bikep .shop-rail .shop-bay').length"), 4, `${name}: the bay rail (two bikes, an empty bay, the expansion)`);
    await press("[data-ride='1']");
    await until(p, "game.profile.ride === 1", `${name}: Select bike`);
    assert.equal(await $(p, "root.querySelector('.shop-rail .shop-bay[data-on] [data-sell]').dataset.sell"), "1", `${name}: the selected bay is marked`);
    const c0 = (await prof(p)).credits;
    const sellText = await $(p, "root.querySelector(\"[data-sell='0']\").textContent");
    const value = +sellText.replace(/[^\d]/g, "");
    await press("[data-sell='0']");
    assert.match(await $(p, "root.querySelector(\"[data-sell='0']\").textContent"), /Sure/, `${name}: sell asks first`);
    assert.equal((await prof(p)).bikes.length, 2, `${name}: nothing sold yet`);
    await press("[data-sell='0']");
    await until(p, "game.profile.bikes.length === 1", `${name}: sold`);
    assert.equal((await prof(p)).credits, c0 + value, `${name}: paid its trade value (${value})`);
    ok("sell a bike (My Bikes, confirm, trade value)");
    ok("select the bike that rides (My Bikes › Select bike)");
    await press("[data-spot]");
    await until(p, "game.profile.slots === 4", `${name}: a bay unlocked`);
    ok("buy a garage bay (My Bikes › Garage expansion › Unlock)");
    // An empty bay's + Add bike goes to the showroom.
    await press(".shop-rail .shop-bay-add");
    await until(p, "!!root.querySelector('.shop-cat')", `${name}: + Add bike opens the showroom`);
    await press("[data-gtab=garage]");
    await until(p, "!!root.querySelector('[data-gsub]')", `${name}: back to the garage`);
    ok("+ Add bike (an empty bay on the rail → Showroom)");

    // ---- PARTS & MODS ----
    await press("[data-gmenu=tyre]");
    await until(p, "root.querySelectorAll('.shop-menu [data-tyre]').length === 3", `${name}: tyre compound menu`);
    await p.keyboard.press("Escape");
    await until(p, "!root.querySelector('.shop-menu')", `${name}: Escape closes the menu`);
    for (const c of ["soft", "hard", "med"]) {
      await press("[data-gmenu=tyre]");
      await press(`[data-tyre=${c}]`);
      await until(p, `game.profile.bikes[game.profile.ride].tyre === ${JSON.stringify(c)}`, `${name}: ${c} tyres`);
    }
    ok("a new set of tyres in each compound (Condition › Tyres ▾)");
    for (const k of ["chain", "motor", "susp", "brakes"]) {
      if (await has(p, `[data-service=${k}]:not(:disabled)`)) await press(`[data-service=${k}]`), await until(p, `game.profile.bikes[game.profile.ride].parts.${k} === 1`, `${name}: ${k}`);
    }
    ok("service / rebuild each part (Condition)");
    for (const k of ["bars", "plastics"]) await press(`[data-fix=${k}]`), await until(p, `game.profile.bikes[game.profile.ride].dmg.${k} === 0`, `${name}: fix ${k}`);
    assert.ok(await has(p, ".shop-soft"), `${name}: No crash damage`);
    ok("fix crash damage (Condition › Crash damage)");
    await press("[data-gsub=tune]");
    for (const [k, id] of await $(p, "[...root.querySelectorAll('[data-setup]')].map((e) => [e.dataset.setup, e.dataset.id])")) {
      await press(`[data-setup=${k}][data-id=${id}]`);
      await until(p, `game.profile.bikes[game.profile.ride][${JSON.stringify(k)}] === ${JSON.stringify(id)}`, `${name}: ${k} ${id}`);
    }
    assert.ok(await has(p, ".shop-feel"), `${name}: ride feel`);
    ok("every tune choice (Tuning), the ride feel");
    await press("[data-gsub=up]");
    const mods = await $(p, "[...root.querySelectorAll('[data-pv^=\"mod:\"]')].map((e) => e.dataset.pv.slice(4))");
    for (const m of mods) {
      const lv = (await b0()).mods[m] ?? 0;
      await press(`[data-pv='mod:${m}']`);
      if (!(await has(p, `.shop-preview [data-mod=${m}]`))) continue; // fitted or maxed
      await press(`.shop-preview [data-mod=${m}]`);
      await until(p, `(game.profile.bikes[game.profile.ride].mods[${JSON.stringify(m)}] ?? 0) === ${lv + 1}`, `${name}: ${m} stage ${lv + 1}`);
    }
    ok("every upgrade that fits, from its preview (Upgrades)");
    await press("[data-gsub=log]");
    await until(p, "root.querySelectorAll('.dh-log .shop-row').length >= 8 && root.querySelectorAll('.dh-log .shop-row .shop-badge svg').length >= 8", `${name}: the service log`);
    ok("the service log (Service log)");

    // ---- PAINT & KIT ----
    await press("[data-gtab=look]");
    await press("[data-look=bike]");
    // Find a slot's item that isn't worn (any page), try it on, cancel, then buy it (or switch: owned).
    const wear = async (slot, check) => {
      for (;;) {
        const id = await $(p, `root.querySelector('[data-dress=${slot}]:not([data-eq]):not([aria-pressed=true])')?.dataset.id ?? null`);
        if (id) {
          await press(`[data-dress=${slot}][data-id='${id}']`);
          if (await has(p, ".shop-pin")) {
            await p.keyboard.press("Escape");
            await until(p, "!root.querySelector('.shop-pin')", `${name}: Escape cancels the try-on`);
            await press(`[data-dress=${slot}][data-id='${id}']`);
            await press("[data-buytrial]");
          }
          await until(p, `(${check})(game.profile) === ${JSON.stringify(id)}`, `${name}: ${slot} ${id}`);
          return id;
        }
        if (!(await has(p, "[data-page='1']"))) assert.fail(`${name}: nothing to wear in ${slot}`);
        await press("[data-page='1']");
      }
    };
    const bk = (f) => `(q) => q.bikes[q.ride].look.${f}`, kt = (f) => `(q) => q.kit.${f}`;
    for (const slot of ["paint", "plastics", "graphics", "plate"]) {
      if (slot !== "paint") await press("[data-gmenu=slot]"), await press(`.shop-menu [data-gslot=${slot}]`);
      await wear(slot, bk(slot));
    }
    ok("paint scheme, plastics, graphics, plate decal (Bike › menu; try on, cancel, buy)");
    await press("[data-gmenu=slot]");
    await press(".shop-menu [data-gslot=paint]");
    if (await has(p, "[data-page='1']")) await press("[data-page='1']"), await until(p, "!!root.querySelector(\"[data-page='0']\")", `${name}: page 2`), await press("[data-page='0']");
    await press("[data-owned]");
    assert.ok(await $(p, "[...root.querySelectorAll('[data-dress=paint] small')].every((s) => s.hasAttribute('data-own'))"), `${name}: owned only`);
    await press("[data-owned]");
    ok("paging and the owned-only filter (Bike)");
    await press("[data-gmenu=slot]");
    await press(".shop-menu [data-gslot=number]");
    await p.locator(".dh-numin").fill("42");
    await press("[data-number]");
    await until(p, "game.profile.bikes[game.profile.ride].look.number === 42", `${name}: race number`);
    ok("race number (Bike › Race number)");
    await press("[data-look=rider]");
    await wear("helmet", kt("helmet"));
    for (const slot of ["helmetPaint", "visor", "jersey", "pattern", "pants", "boots", "gloves"]) await press(`.shop-chips [data-gslot=${slot}]`), await wear(slot, kt(slot));
    ok("helmet, helmet paint, visor, jersey, pattern, pants, boots, gloves (Rider gear)");
    await press("[data-look=outfit]");
    const of = await $(p, "root.querySelector('[data-dress=outfit]:not([data-eq])').dataset.id");
    await press(`[data-dress=outfit][data-id=${of}]`);
    if (await has(p, ".shop-pin")) await press("[data-buytrial]");
    await until(p, `game.profile.owned.includes("outfit:${of}") || !document`, `${name}: outfit`);
    ok("an outfit (Outfits)");

    // ---- the showroom: buy into the empty bay ----
    await press("[data-gtab=showroom]");
    const n0 = (await prof(p)).bikes.length;
    await press(".shop-cat-item:not([data-on]) [data-shop-pick]");
    await press("[data-shop-buy]:not(:disabled)");
    await until(p, `game.profile.bikes.length === ${n0 + 1}`, `${name}: bought a bike`);
    ok("buy a bike / trade in (Showroom)");
    assert.deepEqual(errs, [], `${name}: no page errors`);
    await ctx.close();
  }
  // ---- Day / Night with no page switch: the garage keeps its own key ----
  {
    const bare = await serve(".", { "/": page("dark").replace(", onTheme: () => { const h = document.documentElement; h.dataset.theme = h.dataset.theme === \"light\" ? \"dark\" : \"light\"; }", "") });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((s) => localStorage.setItem("holeshot:profile", s), JSON.stringify(SAVE));
    const p = await ctx.newPage();
    await p.goto(bare.url + "/");
    await until(p, "window.game && game.getSnapshot().screen === 'garage'", "bare: loads");
    assert.match(await $(p, "root.querySelector('.dh-theme').textContent"), /Night/, "bare: the key says Night");
    await p.locator(".dh-theme").click();
    await until(p, "root.querySelector('.dh').hasAttribute('data-day') && /Day/.test(root.querySelector('.dh-theme').textContent)", "bare: Day");
    done.push("Day / Night with no page switch (the game's own key)");
    await ctx.close();
    await bare.close();
  }
  // ---- the pit crew: a failed part, no credits → the free basic fix by LET'S RIDE ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((s) => localStorage.setItem("holeshot:profile", s), JSON.stringify({ ...SAVE, credits: 0, bikes: [bike("b1", "buzzline", { fail: "chain", parts: { tyres: 0.2, chain: 0, motor: 0.3, susp: 0.4, brakes: 0.5 } })] }));
    const p = await ctx.newPage();
    await p.goto(server.url + "/");
    await until(p, "window.game && game.getSnapshot().screen === 'garage'", "pit: loads");
    assert.ok(await has(p, ".dh-bikep .dh-pit"), "pit: the PIT CREW key in the bike panel");
    await p.locator(".dh-pit").click();
    await until(p, "!game.profile.bikes[0].fail", "pit: the crew fixed it");
    done.push("pit crew free fix (bike panel, under LET'S RIDE)");
    await ctx.close();
  }
  // ---- width and height: the content never wider than 1440 px and no sideways scroll at 1440, 1920
  // and 2560 wide; at 1440 × 900 the garage is one screen (the page itself never scrolls, the
  // turntable fills the bike panel's height) on every tab, and so are the showroom and LET'S RIDE ----
  for (const [w, h] of [[1440, 900], [1920, 1080], [2560, 1440]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript((s) => localStorage.setItem("holeshot:profile", s), JSON.stringify(SAVE));
    const p = await ctx.newPage();
    await p.goto(server.url + "/");
    await until(p, "window.game && game.getSnapshot().screen === 'garage'", `${w}: loads`);
    const fit = () => $(p, `(() => { const c = root.querySelector('.dh-cards'), d = document.scrollingElement, sel = '.dh-ghead > *, .dh-gwrap > *, .dh-rwrap'; const xs = [...root.querySelectorAll(sel)].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect()); const L = Math.min(...xs.map((r) => r.left)), R = Math.max(...xs.map((r) => r.right)); return { span: Math.round(R - L), centre: Math.round((L + R) / 2), sideways: c.scrollWidth > c.clientWidth + 1 || d.scrollWidth > innerWidth + 1, pageScroll: c.scrollHeight - c.clientHeight, docScroll: d.scrollHeight - innerHeight }; })()`);
    for (const [what, sel] of [["garage", "[data-gtab=bike]"], ["condition", "[data-gsub=cond]"], ["tuning", "[data-gsub=tune]"], ["upgrades", "[data-gsub=up]"], ["service log", "[data-gsub=log]"], ["paint & kit", "[data-gtab=look]"], ["showroom", "[data-gtab=showroom]"]]) {
      await p.evaluate(`${root}.querySelector(${JSON.stringify(sel)})?.click()`);
      await p.waitForTimeout(150);
      const F = await fit();
      assert.ok(F.span <= 1440 && Math.abs(F.centre - w / 2) <= 6, `${w}: ${what}: the content ≤ 1440 px, centred (${JSON.stringify(F)})`);
      assert.equal(F.sideways, false, `${w}: ${what}: no sideways scroll`);
      if (w === 1440) assert.ok(F.pageScroll <= 0 && F.docScroll <= 0, `${w}×${h}: ${what}: the page does not scroll (${JSON.stringify(F)})`);
    }
    if (w === 1440) {
      await p.evaluate(`${root}.querySelector('[data-gtab=garage]').click()`);
      await until(p, `!!${root}.querySelector('.dh-bikep .shop-turn')`, "back to the garage");
      const T = await $(p, "(() => { const k = root.querySelector('.dh-bikep').getBoundingClientRect(), t = root.querySelector('.dh-bikep .shop-turn').getBoundingClientRect(), c = root.querySelector('.dh-bikep .shop-cta-w').getBoundingClientRect(); return { panel: k.bottom, cta: c.bottom, turn: t.height, H: innerHeight }; })()");
      assert.ok(T.panel <= T.H && T.cta <= T.panel && T.turn >= 200, `${w}: the bike panel fits the screen and the turntable takes its height (${JSON.stringify(T)})`);
      await p.evaluate(`${root}.querySelector('[data-go=ride]').click()`);
      await until(p, "game.getSnapshot().screen === 'ride'", `${w}: LET'S RIDE`);
      const F = await fit();
      assert.ok(F.pageScroll <= 0 && F.docScroll <= 0 && !F.sideways && F.span <= 1440, `${w}: LET'S RIDE fits the screen (${JSON.stringify(F)})`);
      done.push("one screen at 1440 × 900 (garage, every tab, showroom, LET'S RIDE: no page scroll); content ≤ 1440 px centred at 1440, 1920 and 2560, no sideways scroll");
    }
    await ctx.close();
  }
  console.log(`Holeshot garage actions, every one reached and done (1440 and 390):\n  - ${done.join("\n  - ")}`);
} finally {
  await browser.close();
  await server.close();
}
