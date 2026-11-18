// The garage in Chromium (the built dist/holeshot.mjs), at 1440 (mouse) and 390 (touch), from a
// saved profile with a part past its limit, worn tyres and crash damage: the garage says so (MAY
// FAIL, the alert); RIDE asks before the event ("before you ride") and TO THE GARAGE goes back;
// service the chain, a new set of soft tyres, straighten the bars, tall gearing, stage 1; the
// service log shows each; PAINT & KIT: a paint scheme is tried on first (the preview changes, the
// credits don't), BUY pays and owns it, switching back is free; graphics and a plate decal; a helmet
// shape; an outfit; the SHOWROOM: tier 3-4 locked, buy a bike, sell one. Every key 44 px or more,
// no sideways scroll. The preview's turntable turns by drag, swipe and the arrow keys. With MEDIA set, screenshots of each step go there.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const MEDIA = process.env.MEDIA;
if (MEDIA) mkdirSync(MEDIA, { recursive: true });
const page = (theme) => `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false });</script></body></html>`;
const server = await serve(".", { "/": page("dark"), "/day": page("light") });
const browser = await chromium.launch(launchOptions());
const SAVE = {
  v: 1, name: "KIP", credits: 6000, ride: 0, owned: [], pit: 0, stats: { events: 3, wins: 0, earned: 900, best: {} },
  kit: { helmet: "peak", helmetPaint: "white", visor: "smoke", jersey: "lime", pants: "ink", pattern: "stripe", boots: "white", gloves: "ink" },
  bikes: [{ uid: "b1", model: "sparkhound", parts: { tyres: 0.3, chain: 0.08, motor: 0.8, susp: 0.7, brakes: 0.9 }, look: { paint: "acid", number: 23 }, dmg: { bars: 0.6, plastics: 0.5 }, odo: 3000, events: 3 }],
};
const root = "document.querySelector('[data-fizlet-host]').shadowRoot";
const $ = (p, fn, arg) => p.evaluate(`((root, arg) => (${fn}))(${root}, ${JSON.stringify(arg ?? null)})`);
const click = (p, sel) => $(p, "root.querySelector(arg).click()", sel);
const until = (p, fn, what, timeout = 20000) => p.waitForFunction(`((root) => (${fn}))(${root})`, null, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const prof = (p) => p.evaluate(() => JSON.parse(JSON.stringify(game.profile)));
const ink = (p) => $(p, "(() => { const c = root.querySelector('.dh-preview'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 64) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0; return h; })()");
const shot = async (p, name) => {
  if (!MEDIA) return;
  await p.waitForTimeout(120);
  await p.screenshot({ path: `${MEDIA}/${name}.png` });
};
const layout = (p) => $(p, "(() => { const keys = [...root.querySelectorAll('.dh-garage button, .dh-risk button')].filter((e) => e.getClientRects().length); const small = keys.filter((k) => { const r = k.getBoundingClientRect(); return Math.min(r.width, r.height) < 43.5; }).map((k) => k.textContent.trim().slice(0, 20)); return { small, sideways: root.querySelector('.dh-cards').scrollWidth > innerWidth + 1 }; })()");

try {
  for (const [name, viewport, touch, path] of [["desktop", { width: 1440, height: 900 }, false, "/"], ["phone", { width: 390, height: 844 }, true, "/day"]]) {
    const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, recordVideo: MEDIA && name === "phone" ? { dir: MEDIA, size: viewport } : undefined });
    await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) localStorage.setItem("holeshot:profile", s), sessionStorage.setItem("seeded", "1"); }, JSON.stringify(SAVE));
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(server.url + path);
    await until(p, "window.game && game.getSnapshot().screen === 'menu'", `${name}: the saved profile loads`);
    // ---- before you ride: the chain may fail ----
    await click(p, "[data-go=ride]");
    await click(p, "[data-mode=race]");
    await until(p, "!!root.querySelector('.dh-risk')", `${name}: RIDE asks first`);
    assert.match(await $(p, "root.querySelector('.dh-risk').textContent"), /CHAIN & SPROCKETS.*past its limit.*chance it fails/s);
    assert.equal((await p.evaluate(() => game.getSnapshot())).screen, "ride", `${name}: nothing started`);
    assert.deepEqual((await layout(p)).small, [], `${name}: risk card keys`);
    await shot(p, `${name}-1-before-you-ride`);
    await click(p, ".dh-risk [data-go=garage]");
    await until(p, "game.getSnapshot().screen === 'garage'", `${name}: to the garage`);
    await until(p, "root.querySelector('.dh-preview').width > 50", `${name}: the preview draws`);
    // ---- the turntable: drag (mouse) or swipe (touch) turns the bike; ← → with focus; Home resets ----
    {
      const turnAt = () => $(p, "+root.querySelector('.dh-preview').getAttribute('aria-valuenow')");
      const a0 = await turnAt(), i0 = await ink(p);
      const box = await $(p, "(() => { const r = root.querySelector('.dh-preview').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()");
      if (touch) await $(p, "(() => { const c = root.querySelector('.dh-preview'); const ev = (t, x) => c.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: arg.y, bubbles: true })); ev('pointerdown', arg.x); for (let i = 1; i <= 8; i++) ev('pointermove', arg.x - i * 15); ev('pointerup', arg.x - 120); })()", box);
      else await p.mouse.move(box.x, box.y), await p.mouse.down(), await p.mouse.move(box.x - 120, box.y, { steps: 8 }), await p.mouse.up();
      await until(p, `+root.querySelector('.dh-preview').getAttribute('aria-valuenow') !== ${a0}`, `${name}: a drag turns the turntable`);
      const a1 = await turnAt();
      assert.notEqual(await ink(p), i0, `${name}: the turned bike is drawn`);
      await $(p, "root.querySelector('.dh-preview').focus()");
      await p.keyboard.press("ArrowRight");
      assert.equal((((await turnAt()) - a1 + 15) % 360 + 360) % 360, 0, `${name}: → turns it 15°`);
      await p.keyboard.press("Home");
      assert.equal(await turnAt(), a0, `${name}: Home faces it front-quarter again`);
      assert.equal((await p.evaluate(() => game.getSnapshot())).screen, "garage", `${name}: still in the garage`);
      await shot(p, `${name}-0-turntable`);
    }
    assert.match(await $(p, "root.querySelector('.dh-alert').textContent"), /may fail next event/);
    assert.equal(await $(p, "root.querySelector('[data-part=chain] .dh-tag').dataset.state"), "risk");
    assert.equal(await $(p, "root.querySelector('[data-part=tyres] .dh-tag').dataset.state"), "worn");
    const L0 = await layout(p);
    assert.deepEqual(L0, { small: [], sideways: false }, `${name}: garage keys ≥ 44 px, no sideways scroll`);
    await shot(p, `${name}-2-garage-warnings`);
    // ---- service, tyres, damage, a tune choice, a mod ----
    // ---- PACE: measured 0–30 / 0–60 mph and the top (as shown, mph by default); the gearing moves it ----
    const pace = () => $(p, "[...root.querySelectorAll('.dh-garage .dh-pace:not(.dh-pace-s) dd')].map((d) => d.textContent)");
    const P0 = await pace();
    assert.equal(P0.length, 3, `${name}: three pace numbers`);
    assert.match(P0[2], /^\d+ MPH$/, `${name}: top speed in mph`);
    let q = await prof(p), c = q.credits;
    await click(p, "[data-service=chain]");
    q = await prof(p);
    assert.ok(q.bikes[0].parts.chain === 1 && q.credits < c, `${name}: chain serviced`);
    await click(p, "[data-tyre=soft]");
    q = await prof(p);
    assert.deepEqual([q.bikes[0].tyre, q.bikes[0].parts.tyres], ["soft", 1], `${name}: soft tyres`);
    await click(p, "[data-fix=bars]");
    await click(p, "[data-setup=gearing][data-id=tall]");
    await click(p, "[data-mod=power]");
    q = await prof(p);
    assert.deepEqual([q.bikes[0].dmg.bars, q.bikes[0].gearing, q.bikes[0].mods.power], [0, "tall", 1], `${name}: bars, gearing, stage 1`);
    assert.ok(parseInt((await pace())[2]) > parseInt(P0[2]), `${name}: tall gearing (and fixes) raise the measured top: ${P0[2]} → ${(await pace())[2]}`);
    assert.deepEqual(q.bikes[0].log.slice(0, 5).map((l) => l[1]), ["mod:power:1", "setup:gearing:tall", "fix:bars", "svc:tyres:soft", "svc:chain"], `${name}: the service log`);
    assert.match(await $(p, "root.querySelector('.dh-log').textContent"), /CONTROLLER STAGE 1.*GEARING: TALL.*BENT BARS FIXED.*NEW TYRES \(SOFT\).*CHAIN & SPROCKETS SERVICED/s);
    await $(p, "root.querySelector('.dh-garage').scrollIntoView()");
    await shot(p, `${name}-3-serviced`);
    // ---- paint & kit: try on, then buy ----
    await click(p, "[data-gtab=look]");
    await until(p, "root.querySelector('.dh-preview').width > 50", `${name}: preview on the look tab`);
    await p.waitForTimeout(150);
    const ink0 = await ink(p);
    c = (await prof(p)).credits;
    await click(p, "[data-dress=paint][data-id=magma]");
    await until(p, "!!root.querySelector('.dh-try')", `${name}: trying on`);
    await p.waitForTimeout(200);
    assert.notEqual(await ink(p), ink0, `${name}: the preview shows the paint before you buy`);
    q = await prof(p);
    assert.deepEqual([q.credits, q.bikes[0].look.paint], [c, "acid"], `${name}: trying on is free`);
    await shot(p, `${name}-4-try-on`);
    await click(p, "[data-buytrial]");
    q = await prof(p);
    assert.ok(q.bikes[0].look.paint === "magma" && q.credits < c && q.owned.includes("paint:magma"), `${name}: bought`);
    await click(p, "[data-dress=paint][data-id=acid]");
    await click(p, "[data-dress=paint][data-id=magma]");
    q = await prof(p);
    assert.ok(!(await $(p, "!!root.querySelector('.dh-try')")) && q.bikes[0].look.paint === "magma", `${name}: owned: switches back for free`);
    for (const [slot, id] of [["graphics", "circuit"], ["plate", "neon"]]) await click(p, `[data-dress=${slot}][data-id=${id}]`), await click(p, "[data-buytrial]");
    await click(p, "[data-look=rider]");
    await click(p, "[data-dress=helmet][data-id=spike]");
    await click(p, "[data-buytrial]");
    await click(p, "[data-look=outfit]");
    await click(p, "[data-dress=outfit][data-id=nightshift]");
    await shot(p, `${name}-5-outfit-try-on`);
    await click(p, "[data-buytrial]");
    q = await prof(p);
    assert.deepEqual([q.bikes[0].look.graphics, q.bikes[0].look.plate, q.kit.helmet, q.kit.jersey], ["circuit", "neon", "spike", "ink"], `${name}: graphics, plate, helmet, outfit`);
    await shot(p, `${name}-6-dressed`);
    // ---- the showroom: locked tiers, buy, sell ----
    await click(p, "[data-gtab=showroom]");
    const locked = await $(p, "root.querySelectorAll('.dh-show li[data-locked]').length");
    assert.equal(locked, 10, `${name}: tiers 3 and 4 are locked at 3 events (eight dirt bikes, two street)`);
    await shot(p, `${name}-7-showroom`);
    assert.equal(await $(p, "root.querySelectorAll('.dh-show .dh-pace-s').length"), 19, `${name}: every showroom bike shows its pace (all nineteen, the street bikes too)`);
    c = (await prof(p)).credits;
    await click(p, "[data-bike=pulse-pedal]");
    q = await prof(p);
    assert.ok(q.bikes.length === 2 && q.bikes[q.ride].model === "pulse-pedal" && q.credits === c - 2600, `${name}: bought a bike`);
    await click(p, "[data-sell='0']");
    assert.match(await $(p, "root.querySelector(\"[data-sell='0']\").textContent"), /SURE/);
    await click(p, "[data-sell='0']");
    q = await prof(p);
    assert.ok(q.bikes.length === 1 && q.bikes[0].model === "pulse-pedal" && q.credits > c - 2600, `${name}: sold the old one`);
    assert.deepEqual(await layout(p), { small: [], sideways: false }, `${name}: showroom keys ≥ 44 px, no sideways scroll`);
    // ---- and the ride goes now: nothing at risk ----
    await click(p, "[data-go=ride]");
    await click(p, "[data-mode=bigair]");
    await until(p, "game.getSnapshot().screen === 'event'", `${name}: no risk, straight in`);
    await p.waitForTimeout(1200);
    await shot(p, `${name}-8-riding`);
    await p.evaluate(() => game.finish());
    await until(p, "game.getSnapshot().screen === 'result'", `${name}: the result`);
    assert.deepEqual(errs, [], `${name}: no page errors`);
    await ctx.close();
  }
  console.log("Holeshot garage: warnings and the before-you-ride card, service, tyre compounds, damage, tune, mods, the service log, try-on then buy, graphics, plate, helmet, outfits, the showroom (locked tiers, buy, sell); 1440 and 390.");
} finally {
  await browser.close();
  await server.close();
}
