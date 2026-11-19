// HOLESHOT online in Chromium (the built dist/holeshot.mjs): four pages, one room, through the game's
// own RIDE menu and room card against a stand-in fizlet-rooms server (tests/room-server.mjs). Two
// desktops (1440) and two phones (390, touch), each with its own garage (four different starters,
// paints, numbers, wear). A hosts a race (ROOKIE tier) for four and SEND LINK copies the link (no
// share sheet here); B (a phone) opens it and lands straight in the room after the code check; C (a
// desktop) types the room number and joins; D (a phone) opens the link and the room starts. The hello
// carries every rider's name and garage bike to every screen (the same names, the same models, the
// same tuned numbers). On phone links (the room server's latency shim: 60–150 ms round trips, ± 30 ms
// jitter, a 300 ms spike every few seconds) A and B ride by keys and each measures key → its own bike
// on screen (it never waits: the rollback runs each frame on a guess). Then everyone on the autopilot;
// D closes its tab mid-race: the AI rides its bike on the other three, which finish with no desync and
// agree on the standings. Each profile gets its own payout with the ONLINE BONUS line and its own
// wear; RIDE AGAIN on the three starts the next ride (a new track) on all three. B and C leave; A
// leaves the room (no pay for a ride left, the wear counts) and the page settles. Then a Free Ride jam
// for two (E hosts for three, F follows the link, START NOW), and a Big Air head-to-head for two:
// every screen agrees on the points and the result. Every room card key is 44 px or more and the
// ticket reads at 390. Waits on state, never on time. HS_VIDEO=<dir> records the four race windows.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";
import { CODE, roomServer } from "./room-server.mjs";
import { fresh, setup, riding, normalize, STORE_KEY } from "../src/model/profile.ts";
import { STARTERS } from "../src/data/roster.ts";

const full = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), sound: false });</script></body></html>`;
const LAG = { rtt: [60, 150, 100, 120], jitter: 30, spike: 300, spikeEvery: 5000, seed: 3 };
const site = await serve(".", { "/": full }), rooms = await roomServer({ max: 4, lag: LAG });
const browser = await chromium.launch(launchOptions());
const errors = [], t0 = Date.now(), VIDEO = process.env.HS_VIDEO;
const until = (p, fn, arg, what, timeout = 30000) => p.waitForFunction(fn, arg, { timeout, polling: 100 }).catch(async () => assert.fail(`${what}: timed out (${await p.evaluate(() => { const s = game.getSnapshot(); return JSON.stringify({ screen: s.screen, mode: s.mode, online: s.online, run: s.run && { phase: s.run.phase, clock: s.run.clock } }); }).catch((e) => e.message)})`));
const snap = (p) => p.evaluate(() => game.getSnapshot());
const sr = "document.querySelector('[data-fizlet-host]').shadowRoot";
const click = (p, s) => p.evaluate(([sr, s]) => eval(sr).querySelector(s)?.click(), [sr, s]);
const text = (p, s) => p.evaluate(([sr, s]) => eval(sr).querySelector(s)?.textContent ?? "", [sr, s]);
const ms = () => `${((Date.now() - t0) / 1000).toFixed(1)} s`;
/** Four garages: a starter of each class, their own paint, number, wear. */
const garages = STARTERS.map((m, i) => {
  const p = normalize(setup(fresh(), { starter: m.id, paint: ["acid", "pinkout", "gridline", "sodium"][i], number: 11 * (i + 1), name: ["Ana", "Bo", "Cy", "Dee", "Eve", "Fin"][i], kit: { jersey: ["lime", "pink", "cyan", "orange"][i] } }));
  riding(p).parts.tyres = 0.5 + i * 0.1;
  p.credits = 500;
  return p;
});
try {
  const open = async (path, vp, touch, name, garage, video = false) => {
    const ctx = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, ...(VIDEO && video ? { recordVideo: { dir: VIDEO, size: vp.width > 500 ? { width: 960, height: 600 } : { width: 390, height: 844 } } } : {}) });
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
    ctx.setDefaultTimeout(30000);
    await ctx.addInitScript(([k, v]) => { try { if (!localStorage.getItem(k)) localStorage.setItem(k, v); } catch {} }, [STORE_KEY, JSON.stringify(garage)]);
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
    await p.goto(path.startsWith("http") ? path : `${site.url}${path}${path.includes("?") ? "&" : "?"}rooms=${encodeURIComponent(rooms.url)}`);
    await until(p, () => window.game && ["garage", "online"].includes(game.getSnapshot().screen), null, `${name} mounts on its garage`);
    return p;
  };
  /** RIDE → ONLINE: the name and the code. */
  const toRoom = async (p, name) => {
    await click(p, "[data-go=ride]");
    await click(p, ".ol-open");
    const room = p.locator("[data-fizlet-host] .ol-room");
    await room.locator("input[name=who]").fill(name.toLowerCase());
    await room.locator("input[name=code]").fill(CODE.toLowerCase());
    return room;
  };
  const host = async (p, name, kind, sub, size) => {
    const r = await toRoom(p, name);
    await r.locator(".ol-host").click();
    await until(p, (sr) => !eval(sr).querySelector(".ol-room [data-for=host]").hidden, sr, `${name} picks the ride`);
    await r.locator(`[data-olkind='${kind}']`).click();
    if (kind === 0) await r.locator(`[data-oltier='${sub}']`).click();
    if (kind === 1) await r.locator(`[data-olmap='${sub}']`).click();
    await r.locator(`[data-olsize='${size}']`).click();
    await until(p, (sr) => /Waiting for/.test(eval(sr).querySelector(".ol-wait-say").textContent), sr, `${name} waits in its room`);
    await p.bringToFront();
    await click(p, ".ol-share");
    await until(p, (sr) => eval(sr).querySelector(".ol-share").textContent === "LINK COPIED", sr, "the link is copied");
    return { room: Number(await text(p, ".ol-t-room")), link: (await p.evaluate(() => navigator.clipboard.readText())).replace(/^https?:\/\/[^/]+\//, `${site.url}/`) };
  };
  const A = await open("/", { width: 1440, height: 900 }, false, "A", garages[0], true);
  const { room, link } = await host(A, "Ana", 0, 0, 4);
  assert.equal(await text(A, ".ol-t-code"), CODE, "the ticket shows the code");
  assert.equal(await A.evaluate((sr) => eval(sr).querySelectorAll(".ol-seats li").length, sr), 4, "four seats in the lobby");
  assert.match(link, new RegExp(`[?&]room=${room}(&|$)`), `the link has the room: ${link}`);
  assert.match(link, /[?&]code=HOLESHOT-TEST-CODE/, "and the code");
  console.log(`✓ A hosts room ${room} (a ROOKIE race for four); SEND LINK copies ${link.replace(/^https?:\/\/[^/]+/, "").replace(/rooms=[^&]+&?/, "")} (${ms()})`);

  const B = await open(link, { width: 390, height: 844 }, true, "B", garages[1], true);
  await until(A, (sr) => /Waiting for 2 more/.test(eval(sr).querySelector(".ol-wait-say").textContent), sr, "B is in (by the link)");
  const phone = await B.evaluate((sr) => {
    const r = eval(sr), t = r.querySelector(".ol-t-room").getBoundingClientRect(), keys = [...r.querySelectorAll(".ol-room button")].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect());
    return { room: parseFloat(getComputedStyle(r.querySelector(".ol-t-room")).fontSize), code: parseFloat(getComputedStyle(r.querySelector(".ol-t-code")).fontSize), fits: t.right <= innerWidth && r.querySelector(".dh-cards").scrollWidth <= innerWidth + 1, keys: keys.length > 1 && keys.every((k) => Math.min(k.width, k.height) >= 44), say: r.querySelector(".ol-wait-say").textContent };
  }, sr);
  assert.ok(phone.room >= 32 && phone.code >= 18 && phone.fits && phone.keys, `the ticket reads at 390 and every key is ≥ 44 px: ${JSON.stringify(phone)}`);
  console.log(`✓ B (390) followed the link straight in: "${phone.say}" (room ${phone.room} px, code ${phone.code} px) (${ms()})`);
  const C = await open("/", { width: 1440, height: 900 }, false, "C", garages[2], true);
  const rc = await toRoom(C, "Cy");
  await rc.locator(".ol-joink").click();
  await until(C, (sr) => !eval(sr).querySelector(".ol-room [data-for=join]").hidden, sr, "C picks the room");
  const at = Number(await C.evaluate((sr) => eval(sr).querySelector("output[name=roomShow]").value, sr));
  for (let i = 0; i < (room - at + 16) % 16; i++) await rc.locator("[data-olroom='1']").click();
  await rc.locator(".ol-join").click();
  await until(A, (sr) => /Waiting for 1 more/.test(eval(sr).querySelector(".ol-wait-say").textContent), sr, "C is in");
  const D = await open(link, { width: 390, height: 844 }, true, "D", garages[3], true);
  const all = [A, B, C, D];
  for (const p of all) await until(p, () => game.getSnapshot().online?.phase === "ride" && game.getSnapshot().screen === "event", null, "all four on the grid", 60000);
  const s0 = await Promise.all(all.map(snap));
  assert.deepEqual(s0.map((s) => s.online.seat), [0, 1, 2, 3], "seats in arrival order: A hosts");
  for (const s of s0) assert.deepEqual([s.online.names, s.online.models], [["ANA", "BO", "CY", "DEE"], garages.map((g) => riding(g).model)], "every rider's own name and garage bike, on every screen");
  assert.ok(s0.every((s) => s.mode === "race" && s.run.riders === 4 && s.run.map === s0[0].run.map && s.run.map === "online-rookie-1"), `one generated ROOKIE track everywhere: ${s0.map((s) => s.run.map)}`);
  console.log(`✓ room full: a race for four on ${s0[0].run.map}; every screen rides ANA / BO / CY / DEE on their own bikes (${s0[0].online.models.join(", ")}) (${ms()})`);

  // A (1440) and B (390) ride by keys through the start; each screen times its own key → the first
  // frame its bike's front wheel shows it, and counts the frames the ride didn't move.
  await Promise.all(all.map((p) => until(p, () => game.getSnapshot().run.phase === "run", null, "the gate drops", 60000)));
  for (const p of [C, D]) await p.evaluate(() => (game.auto = true));
  const watch = (p) => p.evaluate(() => {
    const w = (window.__w = { lat: [], frames: 0, still: 0, worst: 0, run: 0, t: -1, want: 0, last: game.net.frame, c0: game.net.corrections, s0: game.net.stalls });
    addEventListener("keydown", (e) => (e.code === "KeyA" || e.code === "KeyD") && !e.repeat && ((w.t = performance.now()), (w.want = e.code === "KeyA" ? -1 : 1)), true);
    const tick = () => {
      if (!game.net) return;
      const f = game.net.frame, s = game.getSnapshot();
      w.frames++;
      if (f === w.last) w.still++, w.run++, (w.worst = Math.max(w.worst, w.run));
      else w.run = 0;
      w.last = f;
      if (w.t >= 0 && Math.sign(s.run.steerAngle) === w.want) w.lat.push(performance.now() - w.t), (w.t = -1);
      if (!w.done) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const drivers = [A, B];
  await Promise.all(drivers.map(watch));
  await Promise.all(drivers.map((p) => p.keyboard.down("Space")));
  for (let i = 0; i < 16; i++) {
    const k = i % 2 ? "KeyD" : "KeyA";
    await Promise.all(drivers.map((p) => p.keyboard.down(k)));
    await Promise.all(drivers.map((p) => p.waitForFunction(() => window.__w.t < 0, null, { timeout: 5000, polling: "raf" }).catch(() => 0)));
    await Promise.all(drivers.map((p) => p.waitForTimeout(140 + (i % 3) * 60)));
    await Promise.all(drivers.map((p) => p.keyboard.up(k)));
  }
  await Promise.all(drivers.map((p) => p.keyboard.up("Space")));
  const feel = await Promise.all(drivers.map((p) => p.evaluate(() => {
    const w = window.__w, l = w.lat.slice().sort((a, b) => a - b);
    w.done = true;
    return { keys: l.length, p50: Math.round(l[l.length >> 1]), p90: Math.round(l[Math.floor(l.length * 0.9)]), max: Math.round(l[l.length - 1]), frames: w.frames, still: w.still, worst: w.worst, corrections: game.net.corrections - w.c0, stalls: game.net.stalls - w.s0, delay: game.net.delay };
  })));
  for (const [i, f] of feel.entries()) {
    // (The tail is the host's too: four software-rendered Chromium pages share this machine; p50 is the feel.)
    assert.ok(f.keys >= 12 && f.p50 <= 80 && f.p90 <= 160, `${"AB"[i]}: key → screen ${JSON.stringify(f)}`);
    assert.ok(f.stalls === 0 && f.worst <= 4, `${"AB"[i]}: the ride never waited: ${JSON.stringify(f)}`);
  }
  console.log(`✓ on phone links (RTT ${LAG.rtt.join("/")} ms ± ${LAG.jitter}, ${LAG.spike} ms spikes) your own bike answers at once: key → screen p50 ${feel.map((f) => f.p50).join(" / ")} ms (p90 ${feel.map((f) => f.p90).join(" / ")}, max ${feel.map((f) => f.max).join(" / ")}), delay ${feel.map((f) => f.delay).join("/")} frames; ${feel.map((f) => f.still).join(" / ")} of ${feel.map((f) => f.frames).join(" / ")} screen frames without a new ride frame (longest run ${feel.map((f) => f.worst).join("/")}), 0 stalls, ${feel.map((f) => f.corrections).join(" / ")} corrections (A 1440, B 390) (${ms()})`);

  // Everyone on the autopilot; D closes its tab once the race is on.
  for (const p of all) await p.evaluate(() => (game.auto = true));
  await until(A, () => game.getSnapshot().run.clock > 12, null, "the race is on", 60000);
  const credits0 = await Promise.all([A, B, C].map(async (p) => (await snap(p)).credits));
  await D.context().close();
  const stay = [A, B, C];
  await Promise.all(stay.map((p) => until(p, () => game.getSnapshot().online?.left === 8, null, "D's seat left: the AI rides it")));
  console.log(`✓ D left mid-race: the AI rides its bike on the other three (${ms()})`);
  await Promise.all(stay.map((p) => until(p, () => game.getSnapshot().screen === "result" && game.getSnapshot().online?.phase === "over", null, "the result card", 240000)));
  const s1 = await Promise.all(stay.map(snap));
  if (process.env.HS_DEBUG) console.log(JSON.stringify(s1.map((s) => [s.result, s.online.standings, s.run])));
  for (const s of s1) assert.deepEqual(s.online.standings, s1[0].online.standings, "every screen agrees on the standings");
  assert.deepEqual(s1.map((s) => s.online.desync), [-1, -1, -1], "no desync");
  for (const [i, s] of s1.entries()) {
    assert.ok(s.result.finished && s.result.lines.some(([k, v]) => k.startsWith("ONLINE BONUS") && v > 0), `${"ABC"[i]}: the online bonus is paid: ${JSON.stringify(s.result.lines)}`);
    assert.equal(s.credits, credits0[i] + s.result.credits, `${"ABC"[i]}: its own profile got its own payout`);
    assert.ok(Object.values(s.result.wear).some((w) => w > 0), "and its own wear");
  }
  const stand = await A.evaluate((sr) => [...eval(sr).querySelectorAll(".ol-stand li")].map((li) => li.textContent), sr);
  console.log(`✓ the race finished in step on the three: ${stand.join(" / ")}; payouts ${s1.map((s) => s.result.credits).join(" / ")} credits with the online bonus (${ms()})`);

  // RIDE AGAIN on the three (the leaver's seat counts as ready): the next ride, a new track.
  for (const p of stay) await click(p, ".ol-ready");
  await Promise.all(stay.map((p) => until(p, () => game.getSnapshot().online?.round === 1 && game.getSnapshot().screen === "event", null, "the next ride starts", 60000)));
  const s2 = await Promise.all(stay.map(snap));
  assert.ok(s2.every((s) => s.run.map === "online-rookie-2" && s.online.left === 8), "the next ride on one new track, D's bike on the AI");
  console.log(`✓ RIDE AGAIN on the three: ride 2 on ${s2[0].run.map} on all three (${ms()})`);

  // B and C leave; A leaves the room too: no pay for a ride left, its wear counts; the page settles.
  await B.context().close();
  await C.context().close();
  await until(A, () => game.getSnapshot().online?.left === 14, null, "A hears B and C left");
  await A.evaluate(() => game.leave());
  await until(A, () => game.getSnapshot().screen === "garage" && !game.getSnapshot().online, null, "A is back in the garage");
  await until(A, () => game.engine.paused.includes("settled"), null, "and A settles");
  console.log(`✓ B and C leave, A leaves the room: back on the RIDE menu, the page settles (${ms()})`);
  await A.context().close();

  // A Free Ride jam: E hosts for three on the Dune Sea, F follows the link, E presses START NOW.
  const E = await open("/", { width: 1440, height: 900 }, false, "E", { ...garages[0], name: "EVE" });
  const j = await host(E, "Eve", 1, 1, 3);
  const F = await open(j.link, { width: 390, height: 844 }, true, "F", { ...garages[3], name: "FIN" });
  await until(E, (sr) => !eval(sr).querySelector(".ol-gonow").hidden, sr, "START NOW shows with two in");
  await click(E, ".ol-gonow");
  for (const p of [E, F]) await until(p, () => game.getSnapshot().online?.phase === "ride" && game.getSnapshot().mode === "freeride", null, "a jam for two", 60000);
  for (const p of [E, F]) await p.evaluate(() => (game.auto = true));
  await Promise.all([E, F].map((p) => until(p, () => game.getSnapshot().run.phase === "run" && game.getSnapshot().run.clock > 20, null, "the jam runs", 60000)));
  const js = await Promise.all([E, F].map(snap));
  assert.deepEqual(js.map((s) => [s.online.players, s.run.map, s.online.desync]), [[2, "dune-sea", -1], [2, "dune-sea", -1]], "a jam for two on the Dune Sea, in step");
  console.log(`✓ a room of three started early (START NOW): a Free Ride jam for two on the Dune Sea, in step (points ${js.map((s) => s.run.points).join(" / ")}) (${ms()})`);
  await F.context().close();
  await until(E, () => game.getSnapshot().online?.left === 2, null, "E hears F left");
  await E.evaluate(() => game.leave());
  await E.context().close();

  // Big Air head to head: G hosts for two, H follows the link; both ride their minute (the autopilot);
  // the result waits for both, and both agree.
  const G = await open("/", { width: 1440, height: 900 }, false, "G", { ...garages[1], name: "GUS" });
  const g = await host(G, "Gus", 2, 0, 2);
  const Hp = await open(g.link, { width: 390, height: 844 }, true, "H", { ...garages[2], name: "HAL" });
  for (const p of [G, Hp]) await until(p, () => game.getSnapshot().online?.phase === "ride" && game.getSnapshot().mode === "bigair", null, "Big Air for two", 60000);
  for (const p of [G, Hp]) await p.evaluate(() => (game.auto = true));
  await until(G, (sr) => eval(sr).querySelectorAll(".ol-board li").length === 2, sr, "the score board shows both");
  await Promise.all([G, Hp].map((p) => until(p, () => game.getSnapshot().screen === "result" && game.getSnapshot().online?.phase === "over", null, "the Big Air result", 120000)));
  const bs = await Promise.all([G, Hp].map(snap));
  assert.deepEqual(bs[0].online.standings, bs[1].online.standings, "both agree on who won");
  assert.ok(bs.every((s) => s.result.lines.some(([k]) => k.startsWith("JUDGES")) && s.result.lines.some(([k]) => k.startsWith("ONLINE BONUS"))), "the judges pay, with the online bonus");
  console.log(`✓ Big Air head to head: both rode their minute, the result waited for both: standings ${bs[0].online.standings} on both; ${bs.map((s) => s.result.credits).join(" / ")} credits (${ms()})`);
  assert.deepEqual(errors, [], "no page errors");
  console.log(`HOLESHOT online (four riders): green in ${ms()}`);
} catch (e) {
  if (errors.length) console.error("page errors:", errors);
  throw e;
} finally {
  await browser.close();
  rooms.close();
  await site.close();
}
