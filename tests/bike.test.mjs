// The bike (src/bike/bike.ts), headless: the same inputs give the same ride, bit for bit; a peaky
// 2-stroke's hit pops the front, a 4-stroke pulls with it down; weight back on the gas loops it out;
// the rear brake saves a wheelie past the balance point; in the air the weight pitches it and nosing
// in crashes; the suspension options (damping, case tolerance) do what they say. (Allocation:
// tests/alloc.test.mjs, in a process of its own.)
import test from "node:test";
import assert from "node:assert/strict";

const B = await import("../src/bike/bike.ts");
const flat = { sample(x, z, o) { o[0] = 0; o[1] = 0; o[2] = 1; o[3] = 0; return 0; } };

function ride(p, secs, ctl, shape) {
  const b = B.bike(flat, p, shape), ev = [];
  b.reset(0, 0, 0);
  let maxRel = 0;
  for (let i = 0; i < secs * 60; i++) {
    const [g, br, l] = ctl(i / 60, b);
    b.set(g, br, l, 0);
    b.step(1 / 60);
    for (let k = 0; k < b.n; k++) ev.push([b.ev[k * 2], b.ev[k * 2 + 1]]);
    b.clear();
    if (!b.crashed) maxRel = Math.max(maxRel, b.rel);
  }
  return { b, ev, maxRel };
}

test("bike: deterministic, bit for bit", () => {
  const ctl = (t) => [t < 2 ? 1 : 0.3, t > 3 ? 0.5 : 0, Math.sin(t * 3), 0];
  const a = ride(B.TWO_STROKE, 4, ctl).b, c = ride(B.TWO_STROKE, 4, ctl).b;
  assert.deepEqual([...a.pos, ...a.rot, a.speed, a.rpm], [...c.pos, ...c.rot, c.speed, c.rpm]);
});

test("bike: the 4-stroke pulls with the front down; the 2-stroke's hit pops it; weight back on the gas loops it", () => {
  const four = ride(B.FOUR_STROKE, 3, () => [1, 0, 0]);
  assert.ok(four.maxRel < 0.15 && !four.b.crashed && four.b.speed > 15, `4-stroke: front down (${four.maxRel.toFixed(2)}), pulls (${four.b.speed.toFixed(1)})`);
  const two = ride(B.TWO_STROKE, 3, () => [1, 0, 0]);
  assert.ok(two.ev.some((e) => e[0] === B.B_WHEELIE) && !two.b.crashed, "2-stroke: the hit lifts the front and it comes down");
  for (const p of [B.TWO_STROKE, B.FOUR_STROKE]) {
    const loop = ride(p, 3, () => [1, 0, 1]);
    assert.ok(loop.b.crashed && loop.b.crash === B.LOOP, `${p.name}: weight back and the gas loops it out`);
  }
});

test("bike: the rear brake saves a wheelie past the balance point", () => {
  for (const p of [B.TWO_STROKE, B.FOUR_STROKE]) {
    let braked = 0;
    const save = ride(p, 4, (t, b) => {
      if (b.balance > 1.05) braked = 1;
      return braked ? [0, b.contact[1] ? 0 : 1, 0] : [1, 0, 1];
    });
    assert.ok(braked && !save.b.crashed && save.b.contact[1], `${p.name}: the brake brings it down`);
  }
});

const ramp = { sample(x, z, o) { const on = x > 0 && x < 6, s = on ? 0.5 : 0, l = Math.hypot(1, s); o[0] = on ? x * 0.5 : 0; o[1] = -s / l; o[2] = 1 / l; o[3] = 0; return 0; } };
function jump(lean, shape, speed = 13) {
  const b = B.bike(ramp, B.TWO_STROKE, shape);
  b.reset(-6, 0, 0, speed);
  let air = 0, mid = 0, kind = 0;
  for (let i = 0; i < 240; i++) {
    b.set(b.air > 0 ? 0 : 0.6, 0, b.air > 0 ? lean : 0, 0);
    b.step(1 / 60);
    if (b.air > 0) air = Math.max(air, b.air);
    if (b.air > 0.35 && !mid) mid = b.pitch;
    if (b.crashed && !kind) kind = b.crash;
    b.clear();
  }
  return { air, mid, kind, drop: b.landDrop };
}

test("bike: in the air the weight pitches it; nosing in crashes, level lands", () => {
  const fwd = jump(-1), level = jump(0.15), back = jump(1);
  assert.ok(level.air > 0.6, `off the lip: ${level.air.toFixed(2)} s of air`);
  assert.ok(fwd.mid < level.mid && level.mid < back.mid, "forward pitches it down, back up");
  assert.equal(fwd.kind, B.ENDO, "nosed in: over the bars");
  assert.equal(level.kind, 0, "near level: rides away");
});

test("bike: the case line and the damping are options (tune() wears and mods them)", () => {
  const ok = jump(0.15, {}), tight = jump(0.15, { caseDrop: 4 });
  assert.equal(ok.kind, 0, "the stock case line: it lands");
  assert.equal(tight.kind, B.CASE, "a case line under the landing's speed: cased");
  // Softer damping: the bike bounces longer after a drop onto the flat.
  const settleT = (damp) => {
    const b = B.bike(flat, B.FOUR_STROKE, { damp });
    b.reset(0, 0, 0);
    b.pos[1] += 0.25;
    let last = 0;
    for (let i = 0; i < 240; i++) (b.set(0, 1, 0, 0), b.step(1 / 60), b.clear(), Math.abs(b.vy) > 0.05 && (last = i));
    return last;
  };
  assert.ok(settleT(0.3) > settleT(0.62), "worn damping settles later");
});
