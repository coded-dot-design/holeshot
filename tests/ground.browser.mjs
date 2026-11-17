// Endless Wheelie City in Chromium: the ground never drops out under the chase camera. The owner's
// case (light mode): at some headings the lawn, the sidewalks and the roads around the bike vanished
// and the canal showed through. The diorama skips a face with any corner behind the camera's near plane,
// and the island's lawn (98 × 28), its top and the long roads and sidewalks were one face each. For two
// hoods × four spots (a street, a lawn, by the canal on the south bank, the east end by the gap) × 16
// headings, at 1440 and 390, the frame (buildings and the rider hidden) is sampled at ground points on
// the island around and ahead of the bike (off the hood's own water and terraces): none may show the
// canal's blue (bright: B over 150, 60 over red) or the bare sky behind (within 12 of its colour).
// MEDIA=<dir> saves the owner's angle (the frame as drawn) for the compare.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const full = `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Holeshot</title></head><body style="margin:0"><div id="game" style="position:fixed;inset:0"></div><script type="module">import { createHoleshot } from "/dist/holeshot.mjs"; window.game = createHoleshot({ host: document.getElementById("game"), seed: 5, sound: false }); game.setup({ starter: "sparkhound" });</script></body></html>`;
const server = await serve(".", { "/": full });
const browser = await chromium.launch(launchOptions());
const MEDIA = process.env.MEDIA;
if (MEDIA) mkdirSync(MEDIA, { recursive: true });
const until = (p, fn, arg, what, timeout = 20000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const SPOTS = [["street", 0, 8.5], ["lawn", -30, 0], ["canal bank", 20, -13], ["east end", 47.5, 0]];
const SKY = [0xff, 0xf3, 0xdc];

/** Place, draw without buildings or rider, read the samples: how many show water or sky. */
const look = (p, k, x, z, yaw) => p.evaluate(([k, x, z, yaw, SKY]) => {
  const r = game.run.probe, s = r.spot(k, x, z, yaw), cv = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas");
  r.draw(2, 0);
  const dpr = cv.width / cv.clientWidth, c2 = document.createElement("canvas");
  c2.width = cv.width; c2.height = cv.height;
  const g = c2.getContext("2d", { willReadFrequently: true });
  g.drawImage(cv, 0, 0);
  const px = g.getImageData(0, 0, c2.width, c2.height).data;
  let bad = 0, at = "";
  for (let i = 0; i < s.pts.length; i += 2) {
    const o = (Math.round(s.pts[i + 1] * dpr) * c2.width + Math.round(s.pts[i] * dpr)) * 4, R = px[o], G = px[o + 1], B = px[o + 2];
    const water = B > 150 && B > R + 60 && B > G + 20, sky = Math.abs(R - SKY[0]) + Math.abs(G - SKY[1]) + Math.abs(B - SKY[2]) < 12;
    if (water || sky) bad++, (at ||= `(${Math.round(s.pts[i])}, ${Math.round(s.pts[i + 1])}) rgb ${R},${G},${B}`);
  }
  r.draw(0, 1);
  return { n: s.pts.length / 2, bad, at, faces: s.faces, dropped: s.dropped };
}, [k, x, z, yaw, SKY]);

try {
  for (const [name, viewport, touch] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, colorScheme: "light" });
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(server.url + "/");
    await until(p, () => window.game && game.getSnapshot().screen !== "setup", null, `${name}: mounts`);
    await p.evaluate(() => game.start("endcity"));
    await until(p, () => game.run && game.getSnapshot().run.phase === "ready", null, `${name}: on the line`);
    const fails = [];
    let samples = 0, faces = 0, dropped = 0;
    for (const k of [0, 1]) for (const [spot, x, z] of SPOTS) for (let i = 0; i < 16; i++) {
      const yaw = (i * Math.PI) / 8, m = await look(p, k, x, z, yaw);
      samples += m.n; faces = Math.max(faces, m.faces); dropped += m.dropped;
      if (m.bad) fails.push(`slot ${k} ${spot} heading ${i}/16: ${m.bad} of ${m.n} ground points show water or sky, first at ${m.at}`);
    }
    if (MEDIA) for (const [tag, k, x, z, yaw] of [["owner", 0, 20, -9, 0.35], ["street", 0, 0, 8.5, Math.PI]]) {
      await p.evaluate(([k, x, z, yaw]) => game.run.probe.spot(k, x, z, yaw), [k, x, z, yaw]);
      const png = await p.evaluate(() => (game.run.probe.draw(0, 1), document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas").toDataURL("image/png")));
      writeFileSync(`${MEDIA}/ground-${name}-${tag}.png`, Buffer.from(png.split(",")[1], "base64"));
    }
    assert.deepEqual(errs, [], `${name}: no page errors`);
    assert.ok(samples > 1000, `${name}: enough ground sampled (${samples})`);
    assert.equal(dropped, 0, `${name}: no faces dropped over the budget`);
    assert.deepEqual(fails, [], `${name}: the ground under and ahead of the bike is drawn:\n${fails.join("\n")}`);
    console.log(`${name}: ${samples} ground samples over 2 hoods × ${SPOTS.length} spots × 16 headings, none water or sky; at most ${faces} faces a frame.`);
    await ctx.close();
  }
  console.log("Ground: the lawn, sidewalks and roads stay drawn under the chase camera at every heading; 1440 and 390.");
} finally {
  await browser.close();
  await server.close();
}
