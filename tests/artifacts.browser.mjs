// Endless Wheelie City in Chromium: no stray building parts. The owner's case (dark and light, on
// ?money=inf): tiny miniature buildings (a gas station's canopy, pumps and sign; roofs, windows)
// floating out in the fields that never grew as the bike rode at them, and the bike stuck on
// nothing in a field (a farm building it was up against faded out: the chase camera was inside it). The pool's objects were
// hidden when not placed, but diorama's `hidden` hides only the object itself, never its parts: every
// pool object never placed drew its parts in a heap 50 units under the start (seen from above as a
// miniature, nearly the same size from anywhere near the start), and a tower or silo let go while
// half in the haze left its parts standing where it was. A long seeded autopilot ride (ROAD_KM of
// road, several headings, hops into the fields) checks every frame: no pool object that is not
// placed may draw (no strays), no occlusion outline without its building, no building the bike is up against faded out
// completely (at most ghosted and outlined), every placed object sits
// at its world record (pos, footprint: fully reset on recycle; no key placed twice), and every solid
// the bike can hit within 12 units is placed (drawn). Sampled frames also check, at 1440 and 390,
// that the frame drawn as it is equals the frame with every unplaced object forced out (pixels), and
// that each placed building's drawn height on screen matches its world height at its depth.
// Every drawn part must also be owned (probe.orphans): its whole chain shown and its top a thing the
// ride has live (the bike, a placed pool object, the dog at its yard, a neighbour out, a sprinkler on,
// a patrol unit); particles are points with their own live count, the ground and ribbons are not
// objects. The owner's second case: a tan speck a few px across beside the bike out in the fields,
// never growing: the dog, hidden with `hidden` (the group only) while no yard was near, its body,
// legs, head and tail drawn 50 units under the start.
// The endless grounds' own scenery pool (src/modes/desert/look.ts) gets the same check on a ride in each.
// DIST=<url path> runs another build (the one before); REPORT=1 only prints. MEDIA=<dir> saves the owner's view (the start, looking back over the heap) as drawn.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const DIST = process.env.DIST || "/dist";
const ROAD_KM = Number(process.env.ROAD_KM || 20), ENDLESS_KM = Number(process.env.ENDLESS_KM || 4), MEDIA = process.env.MEDIA, REPORT = !!process.env.REPORT;
const page = (theme) => `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "${DIST}/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false }); game.setup({ starter: "sparkhound" });</script></body></html>`;
const server = await serve(".", { "/": page("dark"), "/light/": page("light") });
const browser = await chromium.launch(launchOptions());
if (MEDIA) mkdirSync(MEDIA, { recursive: true });
const until = (p, fn, arg, what, timeout = 20000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const NAMES = ["strays", "strays on screen", "outlines without a building", "placed off their record", "solids not drawn", "items placed twice", "buildings touched but gone"];
const ZERO = [0, 0, 0, 0, 0, 0, 0];

/** Frame diff: drawn as it is vs with every unplaced pool object forced out; the pixels that differ. */
const strayPx = (p) => p.evaluate(() => {
  const r = game.run.probe, cv = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas"), c2 = document.createElement("canvas");
  c2.width = cv.width; c2.height = cv.height;
  const g = c2.getContext("2d", { willReadFrequently: true });
  const grab = (on) => (r.bareStrays(on), g.clearRect(0, 0, c2.width, c2.height), g.drawImage(cv, 0, 0), g.getImageData(0, 0, c2.width, c2.height).data);
  const A = grab(0), B = grab(1);
  let n = 0;
  for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 24) n++;
  return n;
});

try {
  for (const [name, viewport, touch, path] of [["desktop dark", { width: 1440, height: 900 }, false, "/?money=inf"], ["phone light", { width: 390, height: 844 }, true, "/light/?money=inf"]]) {
    const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(server.url + path);
    await until(p, () => window.game && game.getSnapshot().screen !== "setup", null, `${name}: mounts`);
    await p.evaluate(() => game.start("endcity"));
    await until(p, () => game.run && game.getSnapshot().run.phase === "ready", null, `${name}: on the line`);
    // ---- the owner's view: the first half minute out of the start town into the fields (autopilot), every half second drawn ----
    let ownerPx = 0, owner = ZERO, at = 0, orphans = 0, orphan = "";
    await p.evaluate(() => (game.run.auto = true));
    for (let f = 30; f <= 1800; f += 30) {
      await p.evaluate(() => (game.run.probe.tick(30), game.run.probe.draw(0, 1)));
      const a = await p.evaluate(() => game.run.probe.audit()), px = await strayPx(p), o = await p.evaluate(() => game.run.probe.orphans());
      if (o.length) (orphans += o.length / 3), orphan || (orphan = `frame ${f}: ${JSON.stringify(o.slice(0, 9))}`);
      if (a[0] > owner[0] || px > ownerPx || f === 30) {
        if (px >= ownerPx) (ownerPx = px), (at = f);
        if (a[0] > owner[0] || f === 30) owner = a;
        if (MEDIA && px >= ownerPx) {
          await p.evaluate(() => game.run.probe.draw(0, 1));
          const png = await p.evaluate(() => document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas").toDataURL("image/png"));
          writeFileSync(`${MEDIA}/${name.replace(" ", "-")}-field.png`, Buffer.from(png.split(",")[1], "base64"));
        }
      }
    }
    console.log(`${name}: the owner's view (out of the start, 30 s): most ${owner.map((v, i) => `${NAMES[i]} ${v}`).join(", ")}; stray pixels ${ownerPx} (most at frame ${at}); parts drawn without a live owner ${orphans}${orphan ? ` (first ${orphan})` : ""}`);
    // ---- the long ride: autopilot from the start, hops into the fields and new headings on the way ----
    const res = await p.evaluate(async ([km, touch]) => {
      const r = game.run, pr = r.probe, tot = [0, 0, 0, 0, 0, 0, 0], first = [-1, -1, -1, -1, -1, -1, -1];
      let heights = 0, orphans = 0, orphan = null;
      let frames = 0, dist = 0, hops = 0, lx = r.state.x, lz = r.state.z, towns = 0;
      r.auto = true;
      const bad = [];
      while (dist < km * 1000 && frames < 400000) {
        pr.tick(1);
        frames++;
        const s = r.state;
        const d = Math.hypot(s.x - lx, s.z - lz);
        dist += d < 50 ? d : 0;
        lx = s.x; lz = s.z; towns = Math.max(towns, s.towns);
        const a = pr.audit();
        for (let i = 0; i < 7; i++) if (a[i]) (tot[i] += a[i]), first[i] < 0 && (first[i] = frames);
        // Every 1.5 km or so: a hop off the road into the field beside it, a new heading.
        if (frames % 5400 === 0) {
          hops++;
          const yaw = hops * 2.1, ox = Math.cos(yaw + 1.2) * 70, oz = -Math.sin(yaw + 1.2) * 70;
          pr.spot(s.x + ox, s.z + oz, yaw);
          lx = r.state.x; lz = r.state.z;
          r.auto = true;
        }
        if (frames % 600 === 0) {
          // A drawn frame: each placed building on screen, drawn from its world size at its depth.
          pr.draw(0, 1);
          const o = pr.orphans();
          if (o.length) (orphans += o.length / 3), orphan || (orphan = [frames, ...o.slice(0, 9)]);
          const h = pr.heights();
          heights += h.length / 3;
          for (let q = 0; q < h.length; q += 3) if (Math.abs(h[q + 1] - h[q + 2]) > Math.max(1.5, h[q + 2] * 0.02)) bad.push([frames, h[q], h[q + 1], h[q + 2]]);
        }
      }
      r.auto = false;
      return { frames, dist, hops, towns, tot, first, bad: bad.slice(0, 10), nbad: bad.length, heights, orphans, orphan };
    }, [ROAD_KM, touch]);
    console.log(`${name}: ${(res.dist / 1000).toFixed(1)} km, ${res.frames} frames, ${res.towns} towns, ${res.hops} hops: ${res.tot.map((v, i) => `${NAMES[i]} ${v}${v ? ` (first at frame ${res.first[i]})` : ""}`).join(", ")}; buildings measured on screen ${res.heights}, heights off ${res.nbad}; parts drawn without a live owner ${res.orphans}${res.orphan ? ` (first ${JSON.stringify(res.orphan)})` : ""}`);
    await p.evaluate(() => game.run.probe.draw(0, 1));
    const after = await strayPx(p), afterOrphans = await p.evaluate(() => game.run.probe.orphans());
    if (!REPORT) {
      assert.deepEqual(owner, ZERO, `${name}: the owner's view: ${owner}`);
      assert.equal(ownerPx, 0, `${name}: the owner's view: no stray pixels`);
      assert.equal(orphans, 0, `${name}: the owner's view: every drawn part has a live owner (${orphan})`);
      assert.equal(res.orphans, 0, `${name}: the ride: every drawn part has a live owner (${JSON.stringify(res.orphan)})`);
      assert.deepEqual(afterOrphans, [], `${name}: after the ride, every drawn part has a live owner`);
      assert.ok(res.dist >= ROAD_KM * 1000 * 0.95, `${name}: rode ${res.dist}`);
      assert.ok(res.towns >= 3, `${name}: many towns (${res.towns})`);
      assert.deepEqual(res.tot, ZERO, `${name}: every frame clean: ${res.tot}`);
      assert.ok(res.heights > 50, `${name}: buildings measured (${res.heights})`);
      assert.equal(res.nbad, 0, `${name}: drawn heights match world heights: ${JSON.stringify(res.bad)}`);
      assert.equal(after, 0, `${name}: after the ride, no stray pixels`);
      assert.deepEqual(errs, [], `${name}: no page errors`);
    }
    await ctx.close();
  }
  // ---- the endless grounds (Dune Sea, Deep Quarry, Endless Woods, Night Park): their own scenery pool
  // (cacti, rocks, a camp per cell: tent or hopper or cabin, beacon pole, lamp) let go with `hidden`
  // alone left a camp's parts standing where it was and under the start. A seeded autopilot ride in
  // each, every 300 frames drawn: no part drawn under a hidden object.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(server.url + "/?money=inf");
    await until(p, () => window.game && game.getSnapshot().screen !== "setup", null, "endless: mounts");
    for (const id of ["desert", "quarry", "forest", "night-park"]) {
      await p.evaluate((id) => game.start("desert", { map: id, auto: true }), id);
      await until(p, (id) => game.run && game.run.probe && game.getSnapshot().run.map === id, id, `${id}: starts`);
      const res = await p.evaluate((km) => {
        const r = game.run, pr = r.probe;
        let frames = 0, orphans = 0, orphan = null, dist = 0, lx = r.state.x, lz = r.state.z, draws = 0;
        r.auto = true;
        while (dist < km * 1000 && frames < 120000) {
          pr.tick(1);
          frames++;
          const s = r.state, d = Math.hypot(s.x - lx, s.z - lz);
          dist += d < 50 ? d : 0;
          lx = s.x; lz = s.z;
          if (frames % 300 === 0) {
            pr.draw();
            draws++;
            const o = pr.orphans();
            if (o.length) (orphans += o.length / 3), orphan || (orphan = [frames, ...o.slice(0, 9)]);
          }
        }
        return { frames, dist, draws, orphans, orphan };
      }, ENDLESS_KM);
      console.log(`${id}: ${(res.dist / 1000).toFixed(1)} km, ${res.frames} frames, ${res.draws} drawn: parts drawn under a hidden object ${res.orphans}${res.orphan ? ` (first ${JSON.stringify(res.orphan)})` : ""}`);
      if (!REPORT) {
        assert.ok(res.dist >= ENDLESS_KM * 1000 * 0.9, `${id}: rode ${res.dist}`);
        assert.equal(res.orphans, 0, `${id}: every drawn part has a shown chain (${JSON.stringify(res.orphan)})`);
      }
      await p.evaluate(() => game.leave());
    }
    if (!REPORT) assert.deepEqual(errs, [], "endless: no page errors");
    await ctx.close();
  }
  console.log("artifacts.browser: ok");
} finally {
  await browser.close();
  await server.close();
}
