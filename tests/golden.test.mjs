// The golden hashes: every engine must build the same tracks and maps and ride the same rides, to the
// bit (an iPhone's WebKit and desktop Chrome in one online room run one sim). The cases are in
// tests/golden.mjs: generated tracks at three difficulties, the race loop, the four open maps (their
// centre lines, headings, spawns, posts and every terrain height), then fixed rides: a race of four on
// the autopilot on generated tracks, an online race of four people and two Free Ride jams of four on
// scripted inputs, a Big Air run and two minutes of Endless Wheelie City. Each is hashed and compared to
// tests/golden.json (written on Node, V8, and committed): a different engine, or a change to the
// maths, shows up here. tests/golden.browser.mjs runs the same cases in a browser (Chromium here; with
// --serve, any phone on the network). Every number on these paths comes from + − × ÷, square roots
// and src/math.ts (tests/math.test.mjs guards the modules).
// Rewrite the file on purpose only: GOLDEN=write node --test tests/golden.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { compute } from "./golden.mjs";

const FILE = new URL("./golden.json", import.meta.url);

test("golden: generated tracks, the maps and fixed rides hash the same as the committed golden file", () => {
  const got = compute();
  if (process.env.GOLDEN === "write") {
    writeFileSync(FILE, JSON.stringify({ about: "tests/golden.test.mjs: written on Node (V8); every engine must match", hashes: got }, null, 1) + "\n");
    console.log(`golden: wrote ${Object.keys(got).length} hashes`);
  }
  const want = JSON.parse(readFileSync(FILE, "utf8")).hashes;
  assert.deepEqual(Object.keys(got), Object.keys(want), "the same cases");
  const diff = Object.keys(want).filter((k) => got[k] !== want[k]);
  assert.deepEqual(diff, [], `differs from the golden hashes: ${diff.join(", ")}`);
  console.log(`golden: ${Object.keys(got).length} tracks, maps and rides match, bit for bit.`);
});
