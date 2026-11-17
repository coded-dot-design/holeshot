// Walking the bike (src/bike/bike.ts `walk`), headless: stopped with no gas, the lean held (W/S, ↑/↓,
// the left stick up/down) pushes the bike slowly that way (backwards too), the steer turns the push;
// the gas rides on at once; never into a wall or a post, never up a slope past WALK_SLOPE; bit for bit
// the same twice (zero allocation: tests/alloc.test.mjs). And the modes: Free Ride's posts, the table edge, the race.
import test from "node:test";
import assert from "node:assert/strict";

const B = await import("../src/bike/bike.ts");
const { tune } = await import("../src/model/tune.ts");
const { newBike } = await import("../src/model/profile.ts");
const { freeRun } = await import("../src/modes/freeride/session.ts");
const { makeMap, RIDE_MAPS } = await import("../src/modes/freeride/maps.ts");
const C = await import("../src/modes/race/course.ts");
const t = tune(newBike("buzzline", "b1"));
const flat = { sample(x, z, o) { o[0] = 0; o[1] = 0; o[2] = 1; o[3] = 0; return 0; } };
/** A ramp along x: height x × tan(a) (a in radians, up toward +x). */
const ramp = (a) => { const s = Math.tan(a), l = Math.sqrt(1 + s * s); return { sample(x, z, o) { o[0] = x * s; o[1] = -s / l; o[2] = 1 / l; o[3] = 0; return 0; } }; };
const open = () => true;

function walker(ground = flat, walk = open) {
  const b = B.bike(ground, t.power, { ...t.shape, walk });
  b.reset(0, 0, 0);
  for (let i = 0; i < 60; i++) (b.set(0, 0, 0, 0), b.step(1 / 60), b.clear());
  return b;
}
const run = (b, gas, brake, lean, steer, n) => { for (let i = 0; i < n; i++) (b.set(gas, brake, lean, steer), b.step(1 / 60), b.clear()); };

test("walk: stopped, no gas, lean back → it walks backwards slowly", () => {
  const b = walker();
  run(b, 0, 0, 1, 0, 120);
  assert.ok(b.walking, "walking");
  assert.ok(b.speed < -1 && b.speed > -B.WALK_V - 0.01, `push ${b.speed}`);
  assert.ok(b.pos[0] < -1.5 && b.pos[0] > -2.6, `backwards along the heading: x ${b.pos[0]}`);
  assert.ok(!b.crashed && b.air === 0);
  run(b, 0, 0, 0, 0, 30);
  assert.ok(!b.walking && Math.abs(b.speed) < 0.05, "let go: it stops");
});

test("walk: lean forward → forwards; the steer turns the push; a short lean (under WALK_HOLD) never walks", () => {
  const b = walker();
  run(b, 0, 0, -1, 0, 6);
  assert.ok(!b.walking, "not before WALK_HOLD");
  run(b, 0, 0, -1, 0, 114);
  assert.ok(b.walking && b.speed > 1 && b.pos[0] > 1.5, `forwards: ${b.speed}, x ${b.pos[0]}`);
  const y0 = b.yaw;
  run(b, 0, 0, -1, 1, 90);
  assert.ok(Math.abs(B.wrap(b.yaw - y0)) > 0.3, `turned ${b.yaw - y0}`);
});

test("walk: the gas rides on at once; the brake holds it; already moving, the lean is only weight", () => {
  const b = walker();
  run(b, 0, 0, 1, 0, 60);
  assert.ok(b.walking);
  run(b, 1, 0, 1, 0, 1);
  assert.ok(!b.walking, "the gas: riding");
  run(b, 1, 0, 0, 0, 90);
  assert.ok(b.speed > 4, `riding ${b.speed}`);
  run(b, 0, 0, 1, 0, 30);
  assert.ok(!b.walking, "rolling at speed: no walk");
  const c = walker();
  run(c, 0, 1, 1, 0, 60);
  assert.ok(!c.walking && Math.abs(c.speed) < 0.1, "brake held: no walk");
});

test("walk: never through a wall", () => {
  const b = walker(flat, (p) => p[0] > -1);
  run(b, 0, 0, 1, 0, 240);
  assert.ok(b.pos[0] > -1 && b.pos[0] < -0.4, `stopped at the wall: x ${b.pos[0]}`);
  run(b, 0, 0, -1, 0, 120);
  assert.ok(b.pos[0] > 0.5, `walks away from it: x ${b.pos[0]}`);
});

test("walk: up a gentle slope, slower; not up a steep one; down either", () => {
  const g = walker(ramp(0.15));
  run(g, 0, 0, -1, 0, 120);
  assert.ok(g.pos[0] > 0.8 && g.speed < B.WALK_V, `up a gentle slope: x ${g.pos[0]}, ${g.speed}`);
  const s = walker(ramp(0.5));
  const x0 = s.pos[0];
  run(s, 0, 0, -1, 0, 180);
  assert.ok(s.pos[0] - x0 < 0.2, `not up past WALK_SLOPE: moved ${s.pos[0] - x0}`);
  const d = walker(ramp(0.5));
  const d0 = d.pos[0];
  run(d, 0, 0, 1, 0, 120);
  assert.ok(d.pos[0] < d0 - 1 && !d.crashed, `down it, backwards: ${d.pos[0] - d0}`);
});

test("walk: deterministic, bit for bit; a bike with no `walk` never walks", () => {
  const ride = () => { const b = walker(ramp(0.1)); for (let i = 0; i < 900; i++) (b.set(i % 300 > 250 ? 1 : 0, 0, i % 200 < 100 ? 1 : -1, Math.sin(i * 0.03)), b.step(1 / 60), b.clear()); return Buffer.from(b.state).toString("hex"); };
  assert.equal(ride(), ride());
  const n = B.bike(flat, t.power, t.shape);
  n.reset(0, 0, 0);
  run(n, 0, 0, 1, 0, 120);
  assert.ok(!n.walking && Math.abs(n.pos[0]) < 0.05);
});

test("walk in the modes: Free Ride walks back, never into a post; a race lets a person walk", () => {
  const def = RIDE_MAPS.find((d) => makeMap(d).NP > 0) ?? RIDE_MAPS[0], map = makeMap(def), fr = freeRun(map, { power: t.power, shape: t.shape }), I = new Float64Array(5);
  for (let i = 0; i < 30; i++) (fr.step(1 / 60, I), fr.clear());
  const b = fr.riders[0], x0 = b.pos[0], z0 = b.pos[2];
  I[2] = 1;
  for (let i = 0; i < 120; i++) (fr.step(1 / 60, I), fr.clear());
  const back = (b.pos[0] - x0) * b.cy - (b.pos[2] - z0) * b.sy;
  assert.ok(b.walking && back < -1, `walked back ${back}`);
  // Walk at a post: it stops short of it, no crash.
  if (map.NP) {
    const px = map.POSTS[0], pz = map.POSTS[1];
    b.reset(px - 3, pz, 0);
    I[2] = -1;
    let crashed = false;
    for (let i = 0; i < 60 * 6; i++) (fr.step(1 / 60, I), (crashed ||= b.crashed), fr.clear());
    assert.ok(!crashed && b.pos[0] < px, `stopped short of the post at ${px}: x ${b.pos[0]}`);
  }
  const r = C.motoRace(5, C.makeTrack(C.MOTO_TRACK), { power: t.power, shape: t.shape }), J = new Float64Array(5);
  r.go(t.power);
  for (let i = 0; i < 60 * 4; i++) (r.step(1 / 60, J, false), r.clear());
  J[2] = 1;
  for (let i = 0; i < 60 * 2; i++) (r.step(1 / 60, J, false), r.clear());
  assert.ok(r.riders[0].walking, "the person walks in a race");
});
