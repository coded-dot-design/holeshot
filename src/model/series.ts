// The Race Series, headless: a championship of rounds on generated tracks. The save (a part of the
// profile: `profile.series`), which tiers are open, entering one, the next round's track (a seeded
// generator: the same championship always rides the same tracks), the rivals (named riders on bikes
// of the player's class, better with the tier), scoring a round into the points table, the
// standings, and the round's payout lines (../model/economy.ts `payout` calls `seriesLines`, so the
// prize money and the wear go through the same settle → apply as every other event).
import { POINTS, RIVAL_NAMES, TIERS, UNLOCK_TOP, tier, type TierId } from "../data/series.ts";
import { MODELS, type ClassId } from "../data/roster.ts";
import { generateTrack } from "../modes/race/generate.ts";
import type { TrackPlan } from "../modes/race/course.ts";
import type { RunStats } from "../modes/mode.ts";
import { newBike, type Profile } from "./profile.ts";
import { tune, type Tuned } from "./tune.ts";

/** A championship under way. Rider 0 is the player; 1..3 the rivals. */
export interface SeriesRun {
  tier: TierId;
  /** Its seed: the tracks, the rivals' names and plates follow from it. */
  seed: number;
  /** Rounds ridden so far (the next round's index). */
  round: number;
  /** Points per rider. */
  points: number[];
  /** Each ridden round's finishing order: place per rider (-1: left the round, no points). */
  results: number[][];
}
export interface SeriesSave {
  /** The best final place per tier (0 is champion). */
  best: Partial<Record<TierId, number>>;
  /** Championships won. */
  titles: number;
  run: SeriesRun | null;
  /** The last finished championship (its final table, for the result and the series screen). */
  last: SeriesRun | null;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const int = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);

export function freshSeries(): SeriesSave {
  return { best: {}, titles: 0, run: null, last: null };
}
/** Repair a saved series (anything → a valid SeriesSave). */
export function normSeries(raw: unknown): SeriesSave {
  const o = obj(raw), best: SeriesSave["best"] = {}, b = obj(o.best);
  for (const t of TIERS) if (typeof b[t.id] === "number") best[t.id] = int(b[t.id], 3, 0, 3);
  return { best, titles: int(o.titles, 0, 0, 1e6), run: normRun(o.run, false), last: normRun(o.last, true) };
}
function normRun(raw: unknown, done: boolean): SeriesRun | null {
  const r = obj(raw);
  let run: SeriesRun | null = null;
  if (typeof r.tier === "string" && TIERS.some((t) => t.id === r.tier)) {
    const T = tier(r.tier), round = done ? T.rounds : int(r.round, 0, 0, T.rounds - 1);
    const points = Array.isArray(r.points) ? r.points.slice(0, 4).map((v) => int(v, 0, 0, 9999)) : [];
    while (points.length < 4) points.push(0);
    const results = (Array.isArray(r.results) ? r.results : []).slice(0, round).map((x) => {
      const a = Array.isArray(x) ? x.slice(0, 4).map((v) => int(v, -1, -1, 3)) : [];
      while (a.length < 4) a.push(-1);
      return a;
    });
    while (results.length < round) results.push([-1, -1, -1, -1]);
    run = { tier: T.id, seed: int(r.seed, 1, 0, 0xffffffff), round, points, results };
  }
  return run;
}

/** Whether a tier can be entered: the first always, the next once the one before ended in the top two. */
export function unlocked(s: SeriesSave, id: TierId) {
  const T = tier(id);
  if (!T.after) return true;
  const b = s.best[T.after];
  return b !== undefined && b < UNLOCK_TOP;
}

/** Enter a tier (only one championship at a time; a locked tier can't be entered). */
export function enter(p: Profile, id: TierId, seed: number): Profile | null {
  if (p.series.run || !unlocked(p.series, id)) return null;
  return { ...p, series: { ...p.series, run: { tier: id, seed: seed >>> 0, round: 0, points: [0, 0, 0, 0], results: [] } } };
}
/** Retire from the championship under way (nothing is paid; the tier stays as it was). */
export function retire(p: Profile): Profile {
  return { ...p, series: { ...p.series, run: null } };
}

const mix = (a: number, b: number) => {
  let h = Math.imul((a ^ 0x9e3779b9) >>> 0, 0x85ebca6b) ^ Math.imul(b + 1, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  return (h ^ (h >>> 16)) >>> 0;
};
/** A round's track difficulty: up through the tier's range, round by round. */
export const difficulty = (run: Pick<SeriesRun, "tier">, round: number) => {
  const T = tier(run.tier), u = T.rounds > 1 ? round / (T.rounds - 1) : 0;
  return T.diff[0] + (T.diff[1] - T.diff[0]) * u;
};
/** A round's seed (the race's and the track's). */
export const roundSeed = (run: Pick<SeriesRun, "seed">, round: number) => mix(run.seed, round);

const TRACKS = new Map<string, TrackPlan>();
/** A round's track (generated, validated; the same every time; kept once made). */
export function roundTrack(run: Pick<SeriesRun, "tier" | "seed">, round: number): TrackPlan {
  const seed = roundSeed(run, round), d = difficulty(run, round), key = `${seed}:${d}`;
  let p = TRACKS.get(key);
  if (!p) {
    p = generateTrack(seed, d).plan;
    p = { ...p, name: p.name, id: `series-${run.tier}-${round + 1}` };
    if (TRACKS.size > 24) TRACKS.clear();
    TRACKS.set(key, p);
  }
  return p;
}

/** The rivals: names and plates from the championship's seed; bikes of the player's class at the tier's level. */
export function rivals(run: Pick<SeriesRun, "tier" | "seed">, cls: ClassId, avoid = 0): { name: string; number: number; bike: Tuned }[] {
  const T = tier(run.tier), names = [...RIVAL_NAMES], out: { name: string; number: number; bike: Tuned }[] = [], used = new Set([avoid]);
  const same = MODELS.filter((m) => m.cls === cls).sort((a, b) => a.tier - b.tier);
  for (let k = 0; k < 3; k++) {
    const name = names.splice(mix(run.seed, 100 + k) % names.length, 1)[0]!;
    let number = 2 + (mix(run.seed, 200 + k) % 98);
    while (used.has(number)) number = (number % 99) + 1;
    used.add(number);
    const m = same[Math.min(same.length, T.rivals.tiers[k]!) - 1]!, b = newBike(m.id, "r" + k);
    // The tier's mod level, as the garage reads a 0.1.0 bike's mods (profile normalize): stage `mods`
    // power, short gearing, the long travel kit, stiff springs from level 2.
    const lv = T.rivals.mods;
    b.mods.power = lv;
    if (lv) (b.gearing = "short"), (b.mods.travel = 1);
    if (lv >= 2) b.spring = "stiff";
    out.push({ name, number, bike: tune(b) });
  }
  return out;
}

/** Points so far, best first: [rider, points, wins] (ties: more wins, then the better last round). */
export function standings(run: SeriesRun): { rider: number; points: number; wins: number }[] {
  const rows = [0, 1, 2, 3].map((r) => ({ rider: r, points: run.points[r]!, wins: run.results.filter((x) => x[r] === 0).length }));
  const last = run.results[run.results.length - 1];
  return rows.sort((a, b) => b.points - a.points || b.wins - a.wins || (last ? (last[a.rider]! < 0 ? 9 : last[a.rider]!) - (last[b.rider]! < 0 ? 9 : last[b.rider]!) : a.rider - b.rider));
}

/** A round's finishing order from the race's stats: place per rider; a rider who left is -1 and the
 *  rivals close up behind (their places in the race, ranked among themselves). */
export function roundOrder(s: RunStats): number[] {
  const pl = s.place ?? 3, o = s.order && s.order.length === 4 ? s.order.slice() : [pl, ...[0, 1, 2, 3].filter((q) => q !== pl)];
  if (s.finished) return o;
  const rv = [1, 2, 3].sort((a, b) => o[a]! - o[b]!), out = [-1, 0, 0, 0];
  rv.forEach((r, k) => (out[r] = k));
  return out;
}

/** The series fields for a round's stats (the shell adds them before settle): the tier, the round,
 *  how many, and on the last round the player's final championship place. */
export function roundStats(p: Profile, s: RunStats): RunStats {
  const run = p.series.run;
  if (!run) return s;
  const T = tier(run.tier), order = roundOrder(s), last = run.round + 1 >= T.rounds;
  const series: NonNullable<RunStats["series"]> = { tier: run.tier, round: run.round, rounds: T.rounds };
  if (last) series.champ = standings(scored(run, order)).findIndex((x) => x.rider === 0);
  return { ...s, mode: "series", where: undefined, order, series };
}
function scored(run: SeriesRun, order: number[]): SeriesRun {
  return { ...run, round: run.round + 1, points: run.points.map((v, r) => v + (order[r]! >= 0 ? POINTS[order[r]!]! : 0)), results: [...run.results, order] };
}

/** A round's prize lines (economy `payout` calls this for mode "series"; a round left pays nothing). */
export function seriesLines(s: RunStats): [string, number][] {
  const L: [string, number][] = [];
  if (!s.finished || !s.series) return L;
  const T = tier(s.series.tier), pl = Math.max(0, Math.min(3, s.place ?? 3));
  L.push([`ROUND ${s.series.round + 1} · ${["1ST", "2ND", "3RD", "4TH"][pl]}`, T.prize[pl]!]);
  if (!s.crashes) L.push(["CLEAN ROUND", T.clean]);
  if (s.series.champ !== undefined && T.bonus[s.series.champ]! > 0) L.push([s.series.champ ? `CHAMPIONSHIP ${["", "2ND", "3RD"][s.series.champ]}` : `${T.name} CHAMPION`, T.bonus[s.series.champ]!]);
  return L;
}

/** After a round (the stats from roundStats): the points, the round count; at the end the best
 *  place, a title, and the run closes. */
export function recordRound(p: Profile, s: RunStats): { profile: Profile; done: boolean; champ: number } {
  const run = p.series.run;
  if (!run) return { profile: p, done: false, champ: -1 };
  const next = scored(run, s.order ?? roundOrder(s)), T = tier(run.tier);
  if (next.round < T.rounds) return { profile: { ...p, series: { ...p.series, run: next } }, done: false, champ: -1 };
  const champ = standings(next).findIndex((x) => x.rider === 0), was = p.series.best[run.tier];
  const best = { ...p.series.best, [run.tier]: was === undefined ? champ : Math.min(was, champ) };
  return { profile: { ...p, series: { best, titles: p.series.titles + (champ === 0 ? 1 : 0), run: null, last: next } }, done: true, champ };
}
