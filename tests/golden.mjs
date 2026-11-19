// The golden cases (tests/golden.test.mjs in Node, tests/golden.browser.mjs in a browser): generated
// tracks at three difficulties, the race loop, Track Day's circuits, the four open maps, and fixed rides (Endless Wheelie City's among them), each hashed.
// Imports only the game's headless modules, so it bundles for any browser.
import { hash32 } from "@fzlt/core/presence";
import * as C from "../src/modes/race/course.ts";
import { generateTrack } from "../src/modes/race/generate.ts";
import { makeMap, RIDE_MAPS } from "../src/modes/freeride/maps.ts";
import { freeJam } from "../src/modes/freeride/jam.ts";
import { airShow, DONE as AIR_DONE } from "../src/modes/bigair/show.ts";
import * as W from "../src/modes/wheelie/city.ts";
import * as OR from "../src/modes/wheelie/roam.ts";
import { tune } from "../src/model/tune.ts";
import { newBike } from "../src/model/profile.ts";
import { STARTERS } from "../src/data/roster.ts";
import * as N from "../src/net.ts";
import { TRACK_DAY, trackDayRivals } from "../src/modes/race/circuits.ts";
import { onGround, roadPower } from "../src/model/families.ts";

const bytes = (a) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
const h = (...arrays) => {
  let v = 2166136261;
  for (const a of arrays) v = hash32(a instanceof Uint8Array ? a : bytes(a instanceof Float64Array || ArrayBuffer.isView(a) ? a : Float64Array.from(a)), v);
  return (v >>> 0).toString(16).padStart(8, "0");
};
const text = (s) => new TextEncoder().encode(s);
const bikes = STARTERS.map((m) => tune(newBike(m.id, "g")));
const street = ["curb-pup", "tidebreaker"].map((id) => onGround(tune(newBike(id, "g")), "trackday"));
const trackHash = (t) => h(t.TRACK, t.YAW, t.course().h);

/** Every case's hash, by name. */
export function compute() {
  const out = {};
  for (const d of [0.1, 0.5, 0.9])
    for (let seed = 1; seed <= 8; seed++) {
      const g = generateTrack(seed * 7919, d);
      out[`track ${seed * 7919} @${d}`] = h(text(JSON.stringify(g.plan)), text(trackHash(C.makeTrack(g.plan))));
    }
  out["the race loop"] = trackHash(C.makeTrack(C.MOTO_TRACK));
  // Track Day's circuits, and a race of four on each on the autopilot (street bikes: the mini, the supersport).
  for (const [k, p] of TRACK_DAY.entries()) {
    const t = C.makeTrack(p), me = street[k === 2 ? 0 : 1], r = C.motoRace(31 + k, t, me, trackDayRivals(me.model, roadPower)), I = new Float64Array(5);
    out[`track day ${p.id}`] = h(t.TRACK, t.YAW, t.course().h, t.course().kind);
    r.go(me.power);
    for (let f = 0; f < 60 * 70; f++) (r.step(1 / 60, I, true), r.clear());
    out[`track day race ${p.id}`] = h(...r.bytes);
  }
  for (const def of RIDE_MAPS) {
    const m = makeMap(def);
    out[`map ${def.id}`] = h(m.TRACK, m.YAW, m.SPAWN, m.POSTS, m.terrain.h);
  }
  // A race of four on the autopilot (one person, three rivals), on three generated tracks.
  for (const [seed, d] of [[11, 0.2], [12, 0.6], [13, 0.95]]) {
    const r = C.motoRace(seed, C.makeTrack(generateTrack(seed, d).plan), bikes[seed % 4], [bikes[1].power, bikes[2].power, bikes[3].power]), I = new Float64Array(5);
    r.go(bikes[seed % 4].power);
    for (let f = 0; f < 60 * 70; f++) (r.step(1 / 60, I, true), r.clear());
    out[`race ${seed} @${d}`] = h(...r.bytes);
  }
  // Online: four people on scripted inputs (every seat its own bike), and a jam of four.
  const drive = (f, p) => N.encode(f % 400 < 370 ? 1 : 0, f % 400 >= 370 ? 1 : 0, (((f + p * 23) % 80) - 40) / 80, ((f * 37 + p * 101) % 255) / 127 - 1, f > 2000 ? N.B_AUTO : 0);
  {
    const r = C.motoRace(21, C.makeTrack(generateTrack(21, 0.5).plan), bikes[0], [], { humans: 4, bikes });
    r.go(bikes[0].power);
    for (let f = 0; f < 60 * 60; f++) {
      for (let p = 0; p < 4; p++) N.decode(drive(f, p), p, r.IN, r.AUTO);
      r.stepAll(1 / 60);
      r.clear();
    }
    out["online race of four"] = h(...r.bytes);
  }
  for (const k of [0, 2]) {
    const j = freeJam(k ? makeMap(RIDE_MAPS[k - 1]) : C.makeTrack(C.MOTO_TRACK), bikes, 40);
    for (let f = 0; f < 60 * 45; f++) {
      for (let p = 0; p < 4; p++) N.decode(drive(f, p), p, j.IN, j.AUTO);
      j.step(1 / 60);
      j.clear();
    }
    out[`jam of four, map ${k}`] = h(...j.bytes);
  }
  {
    const sh = airShow(5, bikes[1]), I = new Float64Array(6);
    sh.go(bikes[1].power);
    for (let f = 0; f < 60 * 62 && sh.phase !== AIR_DONE; f++) (sh.step(1 / 60, I, true), sh.clear());
    out["big air run"] = h(sh.S, sh.b.state, Float64Array.of(sh.sc.JD[5], sh.S[0]));
  }
  {
    const t = bikes[2];
    // Endless Wheelie City: two minutes on the autopilot through the open world (the roads, the towns, the heat, the patrol, the tricks): every byte the run keeps.
    const run = OR.openRun([{ id: "x", name: "x", kind: "", blurb: "", bars: [3, 3, 3], power: t.power, shape: t.shape, sweet: t.sweet, hop: t.hop }], 9), I = new Float64Array(5);
    for (let f = 0; f < 60 * 120; f++) (run.autopilot(I), run.step(1 / 60, I[0], I[1], I[2], I[3], I[4]), run.clear());
    out["endless wheelie city ride"] = h(...run.bytes);
  }
  return out;
}

