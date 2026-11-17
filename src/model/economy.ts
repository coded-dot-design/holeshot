// The economy's logic: a finished ride's stats → credits (with the lines that make them up) and the
// wear on each part; applying that to the profile; the pit crew. The numbers are ../data/economy.ts.
import { ONLINE, PARTS, PAYOUT, WEAR, PIT_CREW, type PartId } from "../data/economy.ts";
import { model } from "../data/roster.ts";
import type { RunStats } from "../modes/mode.ts";
import { normalize, riding, type BikeSave, type Profile } from "./profile.ts";
import { partPrice } from "./garage.ts";
import { seriesLines } from "./series.ts";
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
  } else if (s.mode === "series") {
    L.push(...seriesLines(s));
  } else if (s.mode === "bigair") {
    const P = PAYOUT.bigair, j = Math.round((s.judges ?? 0) * P.perJudge), f = (s.flips ?? 0) * P.perFlip;
    L.push([`JUDGES ${(s.judges ?? 0).toFixed(1)}`, Math.max(P.min, j)]);
    if (f) L.push([`${s.flips} ${s.flips === 1 ? "FLIP" : "FLIPS"}`, f]);
  } else if (s.mode === "wheelie") {
    const P = PAYOUT.wheelie;
    L.push(["SESSION", P.base]);
    const pts = Math.min(P.cap - P.base, Math.round((s.score ?? 0) * P.perPoint));
    if (pts > 0) L.push([`${Math.round(s.score ?? 0).toLocaleString("en-US")} PTS`, pts]);
    const esc = s.escapes ?? 0, tix = s.tickets ?? 0;
    if (esc > 0) L.push([`${esc} ${esc === 1 ? "ESCAPE" : "ESCAPES"}`, esc * P.escape]);
    if (tix > 0) {
      const sum = L.reduce((a, l) => a + l[1], 0);
      L.push([`${tix} ${tix === 1 ? "TICKET" : "TICKETS"}`, -Math.min(tix * P.ticket, Math.max(0, sum - P.floor))]);
    }
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
    if (s.far) add(`${(s.far / 1000).toFixed(2)} KM`, Math.round((s.far / 1000) * P.perKm));
    add(`${s.air.toFixed(1)}s AIR`, a);
    add(`${s.wheelie.toFixed(1)}s WHEELIE`, w);
    const fl = s.flips ?? 0, tr = Math.max(0, (s.tricks ?? 0) - fl);
    add(`${tr} BIG ${tr === 1 ? "AIR" : "AIRS"}`, tr * P.perTrick);
    add(`${fl} ${fl === 1 ? "FLIP" : "FLIPS"}`, fl * P.perFlip);
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
  // Endless: the best distance (kept apart from the scores: ./profile.ts `stats.far`).
  if (r.stats.far !== undefined && r.stats.far > (n.stats.far[r.stats.mode] ?? 0)) n.stats.far[r.stats.mode] = Math.round(r.stats.far);
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

/** The online bonus's share now (1 full .. 0 none) for a profile that was paid online at `times`
 *  (ms): full for the first ONLINE.full rides in the rolling hour, then halving; and how many came first. */
export function onlineShare(times: readonly number[], now: number) {
  const k = times.filter((t) => t > now - ONLINE.window && t <= now).length;
  const f = k < ONLINE.full ? 1 : ONLINE.fade ** (k - ONLINE.full + 1);
  return { share: f < ONLINE.floor ? 0 : f, before: k };
}
/** An online result: the ride's solo payout and wear (settle), then the online lines: the bonus on
 *  the solo payout and `beat` per person beaten, both × the hourly share. `beat`: the people (still
 *  in the room) this rider finished ahead of. */
export function settleOnline(s: RunStats, bike: BikeSave, o: { beat: number; times: readonly number[]; now: number }): ModeResult & { share: number } {
  const r = settle(s, bike), ok = s.finished && s.seconds >= ONLINE.minSeconds, { share, before } = onlineShare(o.times, o.now);
  if (!ok) return { ...r, share: 0 };
  const extra = Math.round(r.credits * (ONLINE.bonus - 1) * share), beat = Math.round(o.beat * ONLINE.beat * share);
  const tag = share >= 1 ? "" : share > 0 ? ` (${Math.round(share * 100)}%: ONLINE RIDE ${before + 1} THIS HOUR)` : " (HOURLY CAP REACHED)";
  const lines: [string, number][] = [...r.lines, [`ONLINE BONUS ×${ONLINE.bonus}${tag}`, extra]];
  if (o.beat > 0) lines.push([`BEAT ${o.beat} ${o.beat === 1 ? "RIDER" : "RIDERS"}${share < 1 ? tag : ""}`, beat]);
  return { ...r, lines, credits: r.credits + extra + beat, share };
}
/** The profile after an online result: as `apply`, and the payout's time kept for the hourly cap. */
export function applyOnline(p: Profile, r: ModeResult, now: number): Profile {
  const n = apply(p, r);
  if (r.stats.finished) n.online = [...n.online.filter((t) => t > now - ONLINE.window), now].slice(-ONLINE.keep);
  return n;
}
