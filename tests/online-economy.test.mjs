// HOLESHOT online, the economy: every person's own profile gets the payout and the wear for their own
// result; online pays the solo payout × ONLINE.bonus plus ONLINE.beat per person beaten; the extra
// halves past ONLINE.full rides an hour and stops (the farm cap); the solo part always pays; a ride
// left early or too short pays no extra; the times are kept on the profile (and survive a save).
import test from "node:test";
import assert from "node:assert/strict";

const { settle, settleOnline, applyOnline, onlineShare } = await import("../src/model/economy.ts");
const { ONLINE, PAYOUT, PARTS } = await import("../src/data/economy.ts");
const { fresh, setup, riding, normalize, exportCode, importCode } = await import("../src/model/profile.ts");
const { blankStats } = await import("../src/modes/mode.ts");

const p0 = setup(fresh(), { starter: "sparkhound", paint: "acid", number: 7, name: "kip" });
const won = { ...blankStats("race"), seconds: 140, distance: 900, gas: 110, air: 6, crashes: 1, finished: true, place: 0, time: 140, led: false };
const H = 3_600_000, T0 = 1_800_000_000_000;

test("online pays more: the solo payout × bonus plus a bonus per person beaten; the wear is the solo wear", () => {
  const solo = settle(won, riding(p0)), on = settleOnline(won, riding(p0), { beat: 3, times: [], now: T0 });
  assert.equal(solo.credits, PAYOUT.race.place[0], "solo: a win with a crash");
  assert.equal(on.credits, Math.round(PAYOUT.race.place[0] * ONLINE.bonus) + 3 * ONLINE.beat, `online: ${on.lines.map((l) => l.join(" ")).join(", ")}`);
  assert.equal(on.credits, 900, "a win against three people pays twice the solo win");
  assert.deepEqual(on.wear, solo.wear, "the same wear");
  const last = settleOnline({ ...won, place: 3 }, riding(p0), { beat: 0, times: [], now: T0 });
  assert.equal(last.credits, Math.round(PAYOUT.race.place[3] * ONLINE.bonus), "4th of four people: the bonus, nobody beaten");
  // A jam (a Free Ride session) and a score run take the same lines.
  const jam = settleOnline({ ...blankStats("freeride"), seconds: 180, air: 12, wheelie: 9, tricks: 6, flips: 1, finished: true }, riding(p0), { beat: 1, times: [], now: T0 });
  assert.ok(jam.lines.some((l) => l[0].startsWith("ONLINE BONUS")) && jam.lines.some((l) => l[0] === "BEAT 1 RIDER"), JSON.stringify(jam.lines));
});

test("the farm cap: full for ONLINE.full rides an hour, then halving, then nothing; the solo part always pays; the hour rolls", () => {
  let p = p0, now = T0;
  const got = [];
  for (let i = 0; i < 12; i++) {
    const r = settleOnline(won, riding(p), { beat: 3, times: p.online, now });
    got.push(r.credits);
    p = applyOnline(p, r, now);
    now += 4 * 60_000; // a race every four minutes
  }
  const solo = PAYOUT.race.place[0], full = 900;
  assert.deepEqual(got.slice(0, ONLINE.full), Array(ONLINE.full).fill(full), "the first six an hour: full");
  assert.deepEqual(got.slice(ONLINE.full, 10), [0.5, 0.25, 0.125, 0.0625].map((f) => solo + Math.round(solo * 0.5 * f) + Math.round(3 * ONLINE.beat * f)), `then halving: ${got}`);
  assert.deepEqual(got.slice(10), [solo, solo], "then the solo payout only (never less than alone)");
  assert.ok(p.online.length <= ONLINE.keep, "the profile keeps a bounded list");
  // An hour later the oldest have rolled out of the window.
  assert.equal(onlineShare(p.online, now + H).share, 1, "after an hour off: full again");
  // 12 races in 48 minutes: what the cap holds an hour of farming to.
  const total = got.reduce((a, b) => a + b, 0);
  console.log(`HOLESHOT online: 12 won races in 48 min pay ${total.toLocaleString("en-US")} credits (alone: ${(12 * solo).toLocaleString("en-US")}; uncapped it would be ${(12 * full).toLocaleString("en-US")}).`);
  assert.ok(total < 6 * full + 6 * solo + 450 && total > 12 * solo, "capped (six full rides and a little), still more than alone");
});

test("no extra for a ride left early or too short; each person's own profile; the times survive a save and an export", () => {
  const left = settleOnline({ ...won, finished: false }, riding(p0), { beat: 3, times: [], now: T0 });
  assert.equal(left.credits, 0, "left early: nothing (as alone)");
  const short = settleOnline({ ...won, seconds: 10 }, riding(p0), { beat: 3, times: [], now: T0 });
  assert.equal(short.credits, PAYOUT.race.place[0], "under 30 s: the solo payout only");
  const r = settleOnline(won, riding(p0), { beat: 2, times: [], now: T0 }), p = applyOnline(p0, r, T0);
  assert.equal(p.credits, p0.credits + r.credits);
  for (const k of PARTS) assert.ok(riding(p).parts[k] <= riding(p0).parts[k], `${k} wore`);
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(p))).online, [T0], "kept through a save");
  assert.deepEqual(importCode(exportCode(p)).profile.online, [T0], "and an export code");
  assert.deepEqual(normalize({ ...p, online: undefined }).online, [], "an older save: none yet");
});
