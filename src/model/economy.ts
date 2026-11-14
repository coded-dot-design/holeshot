// The economy's logic: a finished ride's stats → credits (with the lines that make them up) and the
// wear on each part; applying that to the profile; the pit crew. The numbers are ../data/economy.ts.
import { PARTS, PAYOUT, WEAR, PIT_CREW, type PartId } from "../data/economy.ts";
import { model } from "../data/roster.ts";
import type { RunStats } from "../modes/mode.ts";
import { normalize, riding, type BikeSave, type Profile } from "./profile.ts";
import { partPrice } from "./garage.ts";
import { logIt } from "./upkeep.ts";

export interface ModeResult {
  stats: RunStats;
  credits: number;
  /** Payout lines: [label, credits]. */
  lines: [string, number][];
  /** Condition lost per part (0..1). */
  wear: Record<PartId, number>;
}

/** What a ride pays. */
export function payout(s: RunStats): [string, number][] {
  const L: [string, number][] = [];
  if (!s.finished) {
    if (PAYOUT.quit > 0) L.push(["LEFT EARLY", 0]);
    return L;
  }
  if (s.mode === "race") {
    const pl = s.place ?? 3, P = PAYOUT.race;
    L.push([`FINISHED ${["1ST", "2ND", "3RD", "4TH"][pl] ?? "4TH"}`, P.place[pl] ?? P.place[P.place.length - 1]!]);
    if (!s.crashes) L.push(["CLEAN RACE", P.clean]);
    if (s.led && pl === 0) L.push(["LED EVERY LAP", P.led]);
  } else if (s.mode === "bigair") {
    const P = PAYOUT.bigair, j = Math.round((s.judges ?? 0) * P.perJudge), f = (s.flips ?? 0) * P.perFlip;
    L.push([`JUDGES ${(s.judges ?? 0).toFixed(1)}`, Math.max(P.min, j)]);
    if (f) L.push([`${s.flips} ${s.flips === 1 ? "FLIP" : "FLIPS"}`, f]);
  } else if (s.mode === "wheelie") {
    const P = PAYOUT.wheelie;
    L.push(["SESSION", P.base]);
    const pts = Math.min(P.cap - P.base, Math.round((s.score ?? 0) * P.perPoint));
    if (pts > 0) L.push([`${Math.round(s.score ?? 0).toLocaleString("en-US")} PTS`, pts]);
  } else {
    const P = PAYOUT.freeride;
    const t = Math.round(s.seconds * P.perSecond), a = Math.round(s.air * P.perAir), w = Math.round(s.wheelie * P.perWheelie);
    let left = P.cap;
    const add = (k: string, v: number) => {
      const c = Math.max(0, Math.min(left, v));
      left -= c;
      if (c > 0) L.push([k, c]);
    };
    add("SADDLE TIME", t);
    add(`${s.air.toFixed(1)}s AIR`, a);
    add(`${s.wheelie.toFixed(1)}s WHEELIE`, w);
  }
  return L;
}

/** The wear a ride puts on `bike` (by its class and model upkeep). */
export function wear(s: RunStats, bike: BikeSave): Record<PartId, number> {
  const m = model(bike.model), k = m.upkeep.wear, out = {} as Record<PartId, number>;
  for (const p of PARTS) {
    const motorGas = p === "motor" ? WEAR.motorGas[m.cls] : 0;
    const v = (s.distance / 100) * WEAR.distance[p] + s.gas * (WEAR.gas[p] + motorGas) + s.wheelie * WEAR.wheelie[p] + s.air * WEAR.air[p] + s.hard * WEAR.hard[p] + s.crashes * WEAR.crash[p];
    out[p] = Math.round(v * k * 1e4) / 1e4;
  }
  return out;
}

/** Stats → the result (credits, lines, wear) for the bike that rode. */
export function settle(s: RunStats, bike: BikeSave): ModeResult {
  const lines = payout(s);
  return { stats: s, lines, credits: lines.reduce((a, l) => a + l[1], 0), wear: wear(s, bike) };
}

/** The profile after a result: credits in, wear on the bike that rode, the stats, the pit counter. */
export function apply(p: Profile, r: ModeResult): Profile {
  const n = normalize(p), b = riding(n);
  for (const k of PARTS) b.parts[k] = Math.max(0, b.parts[k] - r.wear[k]);
  b.odo += Math.round(r.stats.distance);
  b.events++;
  n.credits += r.credits;
  n.stats.events++;
  n.stats.earned += r.credits;
  if (r.stats.mode === "race" && r.stats.finished && r.stats.place === 0) n.stats.wins++;
  const key = r.stats.mode + (r.stats.where ? ":" + r.stats.where : "");
  const best = r.stats.mode === "race" ? r.stats.time : r.stats.mode === "bigair" ? r.stats.judges : r.stats.score;
  if (r.stats.finished && best !== undefined && best > 0) {
    const was = n.stats.best[key];
    if (was === undefined || (r.stats.mode === "race" ? best < was : best > was)) n.stats.best[key] = best;
  }
  n.pit++;
  return n;
}

/** The cheapest service the riding bike needs (a part under the crew's line), or 0. */
function needed(p: Profile) {
  const b = riding(p);
  let lo = 0;
  for (const k of PARTS) if (b.parts[k] < PIT_CREW.below) lo = lo ? Math.min(lo, partPrice(b, k)) : partPrice(b, k);
  return lo;
}
/** The pit crew will help: enough events since last time (or at once after a part failed), something
 *  worn under the line, and you can't pay for it. */
export function pitReady(p: Profile) {
  if (!p.bikes.length || (p.pit < PIT_CREW.every && !riding(p).fail)) return false;
  const need = needed(p);
  return need > 0 && p.credits < need;
}
/** The pit crew's free basic fix: every part on the riding bike back to at least PIT_CREW.to. */
export function pitFix(p: Profile): Profile {
  if (!pitReady(p)) return p;
  const n = normalize(p), b = riding(n);
  for (const k of PARTS) b.parts[k] = Math.max(b.parts[k], PIT_CREW.to);
  b.fail = "";
  logIt(b, "crew");
  n.pit = 0;
  return n;
}
