// Endless Wheelie City in Chromium: the ground never drops out under the chase camera. The owner's
// case (light mode, on the old row of hoods): at some headings the ground round the bike vanished and
// what was under it showed through. The open world's ground is one streamed heightfield (terrainView:
// small faces near the camera, never a big face it can skip whole). For spots on a road, in a town, on
// a junction and out in the fields × 16 headings, at 1440 and 390, the frame (buildings and the rider
// hidden) is sampled at ground points round and ahead of the bike: none may show the bare sky.
// MEDIA=<dir> saves a frame as drawn for the compare.
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

const SKY = [0xff, 0xf3, 0xdc];

/** Place, draw without buildings or rider, read the samples: how many show water or sky. */
const look = (p, x, z, yaw) => p.evaluate(([x, z, yaw, SKY]) => {
  const r = game.run.probe, s = r.spot(x, z, yaw), cv = document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas");
  r.draw(2, 0);
  const dpr = cv.width / cv.clientWidth, c2 = document.createElement("canvas");
  c2.width = cv.width; c2.height = cv.height;
  const g = c2.getContext("2d", { willReadFrequently: true });
  g.drawImage(cv, 0, 0);
  const px = g.getImageData(0, 0, c2.width, c2.height).data;
  let bad = 0, at = "";
  for (let i = 0; i < s.pts.length; i += 2) {
    const o = (Math.round(s.pts[i + 1] * dpr) * c2.width + Math.round(s.pts[i] * dpr)) * 4, R = px[o], G = px[o + 1], B = px[o + 2];
    const water = false, sky = Math.abs(R - SKY[0]) + Math.abs(G - SKY[1]) + Math.abs(B - SKY[2]) < 12;
    if (water || sky) bad++, (at ||= `(${Math.round(s.pts[i])}, ${Math.round(s.pts[i + 1])}) rgb ${R},${G},${B}`);
  }
  r.draw(0, 1);
  return { n: s.pts.length / 2, bad, at, faces: s.faces, dropped: s.dropped };
}, [x, z, yaw, SKY]);

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
    // The spots: on the first town's main road, at its junction, out on the open road, in a field off it.
    const SPOTS = await p.evaluate(() => {
      const r = game.run.probe, n = r.node(0, 0), a = r.road(0, 0, 0, 30), b = r.road(0, 0, 0, 70), c = r.road(1, 0, 1, 40) ?? r.road(1, 0, 0, 40);
      return [["town road", a[0], a[1]], ["junction", n[0] + 2, n[1] + 1], ["open road", b[0], b[1]], ["field", c[0] + 14, c[1] + 14]];
    });
    for (const [spot, x, z] of SPOTS) for (let i = 0; i < 16; i++) {
      const yaw = (i * Math.PI) / 8, m = await look(p, x, z, yaw);
      samples += m.n; faces = Math.max(faces, m.faces); dropped += m.dropped;
      if (m.bad) fails.push(`${spot} heading ${i}/16: ${m.bad} of ${m.n} ground points show the sky, first at ${m.at}`);
    }
    if (MEDIA) for (const [tag, i] of [["town", 0], ["field", 3]]) {
      const [, x, z] = SPOTS[i];
      await p.evaluate(([x, z]) => game.run.probe.spot(x, z, 0.35), [x, z]);
      const png = await p.evaluate(() => (game.run.probe.draw(0, 1), document.querySelector("[data-fizlet-host]").shadowRoot.querySelector("canvas").toDataURL("image/png")));
      writeFileSync(`${MEDIA}/ground-${name}-${tag}.png`, Buffer.from(png.split(",")[1], "base64"));
    }
    assert.deepEqual(errs, [], `${name}: no page errors`);
    assert.ok(samples > 1000, `${name}: enough ground sampled (${samples})`);
    assert.equal(dropped, 0, `${name}: no faces dropped over the budget`);
    assert.deepEqual(fails, [], `${name}: the ground under and ahead of the bike is drawn:\n${fails.join("\n")}`);
    console.log(`${name}: ${samples} ground samples over 4 spots × 16 headings, none the sky; at most ${faces} faces a frame.`);
    await ctx.close();
  }
  console.log("Ground: the roads, towns and fields stay drawn under the chase camera at every heading; 1440 and 390.");
} finally {
  await browser.close();
  await server.close();
}
