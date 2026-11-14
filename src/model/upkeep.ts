// Upkeep beyond the economy's wear: what the garage reads off a bike (each part's state: fine, worn,
// may fail; the crash damage), what a ride does on top of ../model/economy.ts `settle` (the tyre
// compound's and the motor map's wear, crash damage, a part that fails in the event) and what that
// leaves on the bike (`after`: the damage, the failed part, the service log). Pure; the numbers are
// ../data/economy.ts (WARN, FAIL, DAMAGE, TYRES, SETUP_FX, MOD_FX).
//
// Fair failures: a part only fails once it is under FAIL.at, which the garage shows in red ("MAY
// FAIL") and the ride screen asks about before every event; the chance is rolled from the event's
// seed (the same event fails the same way), grows from 0 at the line to FAIL.max at 0, and at most
// one part goes per event. A failure costs part of that event's payout and leaves the part at 0 until
// it is replaced; if the rider can't pay, the pit crew helps at once (../model/economy.ts pitReady).
import { DAMAGE, FAIL, FAIL_NAME, LOG_MAX, MOD_FX, PARTS, SETUP_FX, TYRES, WARN, type DamageId, type PartId } from "../data/economy.ts";
import { CLASSES, model } from "../data/roster.ts";
import { normalize, riding, type BikeSave, type Profile } from "./profile.ts";
import type { ModeResult } from "./economy.ts";

export type PartState = "ok" | "worn" | "risk" | "failed";
/** A part's state: fine, worn (under WARN: you feel it), at risk (under FAIL.at: it may fail), failed. */
export function partState(b: BikeSave, k: PartId): PartState {
  return b.fail === k ? "failed" : b.parts[k] < FAIL.at ? "risk" : b.parts[k] < WARN ? "worn" : "ok";
}
/** The chance `part` fails in the next event (0 above the line). */
export function failChance(b: BikeSave, k: PartId) {
  const c = b.parts[k];
  return b.fail === k || c >= FAIL.at ? 0 : FAIL.max * (1 - c / FAIL.at);
}
/** The parts that may fail next event, worst first. */
export const atRisk = (b: BikeSave): PartId[] => PARTS.filter((k) => failChance(b, k) > 0).sort((x, y) => b.parts[x] - b.parts[y]);
/** A part's name for a failure line (the motor's by class). */
export function failName(b: BikeSave, k: PartId) {
  if (k !== "motor") return FAIL_NAME[k];
  const m = CLASSES[model(b.model).cls].motor;
  return m === "battery" ? "BATTERY CUT OUT" : m === "topend" ? "TOP END SEIZED" : FAIL_NAME.motor;
}

/** A number 0..1 from the seed and a salt: integer maths, the same everywhere. */
function roll(seed: number, salt: number) {
  let h = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** The part that fails in the event with `seed` (or ""): each part at risk rolls in turn, the worst first. */
export function failure(b: BikeSave, seed: number): PartId | "" {
  for (const k of atRisk(b)) if (roll(seed, PARTS.indexOf(k)) < failChance(b, k)) return k;
  return "";
}

/** The ride's result after the garage: the economy's wear scaled by the tyre compound, the motor
 *  map and the battery pack; the crash damage; a failure (its line takes FAIL.pay of the payout). */
export interface GarageResult extends ModeResult {
  fail: PartId | "";
  dmg: Record<DamageId, number>;
}
export function ride(r: ModeResult, b: BikeSave, seed: number): GarageResult {
  const m = model(b.model), e = CLASSES[m.cls].motor === "battery", s = r.stats;
  const wear = { ...r.wear };
  wear.tyres = Math.round(wear.tyres * (TYRES[b.tyre] ?? TYRES.med).wear * 1e4) / 1e4;
  if (e) {
    const heat = (SETUP_FX.map[b.map as keyof typeof SETUP_FX.map] ?? SETUP_FX.map.std).heat * (1 - MOD_FX.cells.heat * (b.mods.cells ?? 0));
    wear.motor = Math.round(wear.motor * heat * 1e4) / 1e4;
  }
  const dmg = { bars: s.crashes * DAMAGE.crash.bars + s.hard * DAMAGE.hard.bars, plastics: s.crashes * DAMAGE.crash.plastics + s.hard * DAMAGE.hard.plastics };
  const fail = s.seconds >= FAIL.minSeconds ? failure(b, seed) : "";
  const lines = r.lines.slice();
  let credits = r.credits;
  if (fail) {
    const cut = Math.round(credits * FAIL.pay);
    lines.push([`${failName(b, fail)} · TOWED IN`, -cut]);
    credits -= cut;
    wear[fail] = 1;
  }
  return { ...r, lines, credits, wear, fail, dmg };
}

/** A log entry on bike `b` (newest first, at most LOG_MAX). */
export function logIt(b: BikeSave, what: string, cost = 0) {
  b.log.unshift([b.events, what, cost]);
  if (b.log.length > LOG_MAX) b.log.length = LOG_MAX;
}
/** The profile after ../model/economy.ts `apply`: the damage and a failure on the bike that rode. */
export function after(p: Profile, r: GarageResult): Profile {
  const n = normalize(p), b = riding(n);
  if (!b) return n;
  b.dmg.bars = Math.min(1, b.dmg.bars + r.dmg.bars);
  b.dmg.plastics = Math.min(1, b.dmg.plastics + r.dmg.plastics);
  if (r.fail) (b.fail = r.fail), (b.parts[r.fail] = 0), logIt(b, "fail:" + r.fail);
  return n;
}

/** The garage's warnings for bike `b`, worst first: [part or damage id, level, words]. */
export function warnings(b: BikeSave): [string, PartState, string][] {
  const out: [string, PartState, string][] = [];
  for (const k of PARTS) {
    const st = partState(b, k);
    if (st === "failed") out.push([k, st, `${failName(b, k)}: replace it`]);
    else if (st === "risk") out.push([k, st, `may fail next event (${Math.round(failChance(b, k) * 100)}%)`]);
    else if (st === "worn") out.push([k, st, "worn: you can feel it"]);
  }
  const order = { failed: 0, risk: 1, worn: 2, ok: 3 };
  return out.sort((x, y) => order[x[1]] - order[y[1]]);
}
