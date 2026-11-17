// The player's profile: one rider, a garage of up to three bikes, credits, stats and settings, as a
// versioned plain object. Saved on the device (localStorage, every access in try/catch: a private
// window or blocked storage just means no save) and movable between devices as an export code.
// `migrate` takes anything that was ever saved (or typed in) and returns a valid current profile:
// each version step in MIGRATIONS runs in order, then `normalize` fills what is missing and clamps
// what is out of range, so a save from before a part or a field existed still loads.
import { model, STARTERS } from "../data/roster.ts";
import { PARTS, START_CREDITS, GARAGE_SLOTS, MODS, SETUPS, TYRES, LOG_MAX, ONLINE, type PartId, type ModId, type TyreId } from "../data/economy.ts";
import { PAINTS, SWATCHES, HELMETS, VISORS, PATTERNS, GRAPHICS, PLASTICS, PLATES } from "../data/looks.ts";
import { freshSeries, normSeries, type SeriesSave } from "./series.ts";

export const VERSION = 4;
/** The endless bests a profile keeps (world units): the ENDLESS grounds and Endless Wheelie City. */
export const FAR_KEYS = ["desert", "quarry", "forest", "night-park", "city"];
const farZero = () => Object.fromEntries(FAR_KEYS.map((k) => [k, 0])) as Record<string, number>;
export const STORE_KEY = "holeshot:profile";
/** Where the game saved before it was called HOLESHOT (it was "Dirt Hop"): read when STORE_KEY is
 *  empty, so a local save carries over; the next save writes STORE_KEY and the old key is left alone. */
export const OLD_STORE_KEYS = ["dirt-hop:profile"];

/** One bike in the garage: its model, each part's condition, its mod levels, its look. */
export interface BikeSave {
  /** Unique within the garage. */
  uid: string;
  model: string;
  parts: Record<PartId, number>;
  mods: Record<ModId, number>;
  look: { paint: string; number: number; graphics: string; plastics: string; plate: string };
  /** Odometer (world units) and events ridden. */
  odo: number;
  events: number;
  /** The garage (all filled by normalize when missing, no schema step): the tyres' compound, the tune
   *  choices (gearing, springs, an electric's motor map) and the ones bought (`setups`, "gearing:tall"),
   *  crash damage (0 new .. 1), the part that failed in an event (until replaced; "" none), and the
   *  service log, newest first: [the bike's event count, what ("svc:tyres:soft", "mod:power:2",
   *  "fail:chain", "fix:bars", "crew", "setup:gearing:tall", "new"), credits]. */
  tyre: TyreId;
  gearing: string;
  spring: string;
  map: string;
  setups: string[];
  dmg: { bars: number; plastics: number };
  fail: PartId | "";
  log: [number, string, number][];
}
/** The rider's kit. */
export interface RiderKit {
  helmet: string;
  helmetPaint: string;
  visor: string;
  jersey: string;
  pants: string;
  pattern: string;
  boots: string;
  gloves: string;
}
export interface Profile {
  v: number;
  /** Empty until the first-run setup is done. */
  name: string;
  credits: number;
  /** The bike that rides next (an index into bikes). */
  ride: number;
  bikes: BikeSave[];
  kit: RiderKit;
  /** What the shop has sold this rider (cosmetic ids by slot, so owned colours cost nothing again). */
  owned: string[];
  /** `far`: the best distance per endless mode (world units, about metres: "desert"). */
  stats: { events: number; wins: number; earned: number; best: Record<string, number>; far: Record<string, number> };
  /** Events since the pit crew last helped. */
  pit: number;
  settings: { sound: boolean; view: "chase" | "table" };
  /** The Race Series (./series.ts): best place per tier, titles, the championship under way. */
  series: SeriesSave;
  /** When the last online payouts were (ms since 1970, newest last): the online bonus's hourly cap
   *  (../data/economy.ts ONLINE). Filled by normalize (no schema step). */
  online: number[];
}

const clamp01 = (v: unknown, d: number) => (typeof v === "number" && isFinite(v) ? Math.max(0, Math.min(1, v)) : d);
const int = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);
const oneOf = (v: unknown, ids: string[], d: string) => (typeof v === "string" && ids.includes(v) ? v : d);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export const STARTER_KIT: RiderKit = { helmet: "peak", helmetPaint: "white", visor: "smoke", jersey: "cyan", pants: "ink", pattern: "stripe", boots: "white", gloves: "ink" };

/** A new bike of `modelId`: every part new, no mods. */
export function newBike(modelId: string, uid: string, paint = "gridline", number = 7): BikeSave {
  return {
    uid, model: model(modelId).id, parts: { tyres: 1, chain: 1, motor: 1, susp: 1, brakes: 1 }, mods: { power: 0, brakes: 0, weight: 0, travel: 0, cells: 0 },
    look: { paint, number, graphics: "none", plastics: "scheme", plate: "scheme" }, odo: 0, events: 0,
    tyre: "med", gearing: "stock", spring: "stock", map: "std", setups: [], dmg: { bars: 0, plastics: 0 }, fail: "", log: [],
  };
}
/** A profile before the first-run setup: no name, no bike yet. */
export function fresh(): Profile {
  return { v: VERSION, name: "", credits: START_CREDITS, ride: 0, bikes: [], kit: { ...STARTER_KIT }, owned: [], stats: { events: 0, wins: 0, earned: 0, best: {}, far: farZero() }, pit: 0, settings: { sound: true, view: "chase" }, series: freshSeries(), online: [] };
}
/** The first-run setup: your one starter bike, its paint and number, your name and kit colours. */
export function setup(p: Profile, o: { starter: string; paint: string; number: number; name: string; kit?: Partial<RiderKit> }): Profile {
  const starter = STARTERS.find((m) => m.id === o.starter) ?? STARTERS[0]!;
  const n = normalize({ ...p, name: o.name.trim() || "RIDER", bikes: [newBike(starter.id, "b1", o.paint, o.number)], ride: 0, kit: { ...p.kit, ...o.kit } });
  return n;
}
export const ready = (p: Profile) => p.bikes.length > 0;
/** The bike that rides next. */
export const riding = (p: Profile): BikeSave => p.bikes[Math.min(p.ride, p.bikes.length - 1)]!;

function normBike(b: unknown, i: number): BikeSave | null {
  const o = obj(b);
  if (typeof o.model !== "string") return null;
  const parts = obj(o.parts), mods = obj(o.mods), look = obj(o.look);
  const out = newBike(o.model, typeof o.uid === "string" && o.uid ? o.uid.slice(0, 16) : "b" + (i + 1));
  for (const k of PARTS) out.parts[k] = clamp01(parts[k], 1);
  for (const k of Object.keys(MODS) as ModId[]) out.mods[k] = int(mods[k], 0, 0, MODS[k].max);
  out.look.paint = oneOf(look.paint, PAINTS.map((p) => p.id), "gridline");
  out.look.number = int(look.number, 7, 1, 99);
  out.look.graphics = oneOf(look.graphics, GRAPHICS.map((g) => g.id), "none");
  out.look.plastics = oneOf(look.plastics, PLASTICS.map((g) => g.id), "scheme");
  out.look.plate = oneOf(look.plate, PLATES.map((g) => g.id), "scheme");
  out.odo = int(o.odo, 0, 0, 1e9);
  out.events = int(o.events, 0, 0, 1e7);
  // The garage's fields. A 0.1.0 bike had mods { power, gearing 0..2 (short), susp 0..3 }: short
  // gearing becomes the SHORT choice, a suspension mod the long travel kit (stiff springs from 2).
  const ids = (k: keyof typeof SETUPS) => SETUPS[k].opts.map((x) => x.id);
  const oldGear = int(mods.gearing, 0, 0, 9), oldSusp = int(mods.susp, 0, 0, 9);
  if (oldSusp && mods.travel === undefined) out.mods.travel = 1;
  out.tyre = oneOf(o.tyre, Object.keys(TYRES), "med") as TyreId;
  out.gearing = oneOf(o.gearing, ids("gearing"), oldGear ? "short" : "stock");
  out.spring = oneOf(o.spring, ids("spring"), oldSusp >= 2 ? "stiff" : "stock");
  out.map = oneOf(o.map, ids("map"), "std");
  const valid = (Object.keys(SETUPS) as (keyof typeof SETUPS)[]).flatMap((k) => ids(k).map((v) => k + ":" + v));
  out.setups = Array.isArray(o.setups) ? [...new Set(o.setups.filter((x): x is string => typeof x === "string" && valid.includes(x)))] : [];
  for (const k of ["gearing", "spring", "map"] as const) if (out[k] !== SETUPS[k].opts[1]!.id && !out.setups.includes(k + ":" + out[k])) out.setups.push(k + ":" + out[k]);
  const dmg = obj(o.dmg);
  out.dmg = { bars: clamp01(dmg.bars, 0), plastics: clamp01(dmg.plastics, 0) };
  out.fail = oneOf(o.fail, PARTS, "") as PartId | "";
  out.log = (Array.isArray(o.log) ? o.log : [])
    .filter((e): e is [number, string, number] => Array.isArray(e) && typeof e[1] === "string")
    .slice(0, LOG_MAX)
    .map((e) => [int(e[0], 0, 0, 1e7), e[1].slice(0, 32), int(e[2], 0, 0, 1e7)]);
  return out;
}
/** Fill what is missing and clamp what is out of range (a current-version profile, possibly partial). */
export function normalize(raw: unknown): Profile {
  const o = obj(raw), f = fresh(), k = obj(o.kit), st = obj(o.stats), set = obj(o.settings);
  const sw = SWATCHES.map((s) => s.id);
  const bikes = (Array.isArray(o.bikes) ? o.bikes : []).map(normBike).filter((b): b is BikeSave => !!b).slice(0, GARAGE_SLOTS);
  // Unique uids.
  bikes.forEach((b, i) => bikes.slice(0, i).some((a) => a.uid === b.uid) && (b.uid = "b" + (i + 1) + "x"));
  const best: Record<string, number> = {};
  for (const [key, v] of Object.entries(obj(st.best))) if (typeof v === "number" && isFinite(v)) best[key.slice(0, 32)] = v;
  const far: Record<string, number> = farZero();
  for (const [key, v] of Object.entries(obj(st.far))) if (typeof v === "number" && isFinite(v) && v >= 0) far[key.slice(0, 16)] = Math.min(1e9, v);
  return {
    v: VERSION,
    name: typeof o.name === "string" ? o.name.replace(/[^\w .\-]/g, "").slice(0, 12).toUpperCase() : "",
    credits: int(o.credits, f.credits, 0, 9_999_999),
    ride: int(o.ride, 0, 0, Math.max(0, bikes.length - 1)),
    bikes,
    kit: {
      helmet: oneOf(k.helmet, HELMETS.map((h) => h.id), STARTER_KIT.helmet),
      helmetPaint: oneOf(k.helmetPaint, sw, STARTER_KIT.helmetPaint),
      visor: oneOf(k.visor, VISORS.map((v) => v.id), STARTER_KIT.visor),
      jersey: oneOf(k.jersey, sw, STARTER_KIT.jersey),
      pants: oneOf(k.pants, sw, STARTER_KIT.pants),
      pattern: oneOf(k.pattern, PATTERNS.map((p) => p.id), STARTER_KIT.pattern),
      boots: oneOf(k.boots, sw, STARTER_KIT.boots),
      gloves: oneOf(k.gloves, sw, STARTER_KIT.gloves),
    },
    owned: Array.isArray(o.owned) ? o.owned.filter((s): s is string => typeof s === "string").slice(0, 400) : [],
    stats: { events: int(st.events, 0, 0, 1e9), wins: int(st.wins, 0, 0, 1e9), earned: int(st.earned, 0, 0, 1e12), best, far },
    pit: int(o.pit, 0, 0, 1e6),
    settings: { sound: set.sound !== false, view: set.view === "table" ? "table" : "chase" },
    series: normSeries(o.series),
    online: (Array.isArray(o.online) ? o.online : []).filter((t): t is number => typeof t === "number" && isFinite(t) && t > 0).slice(-ONLINE.keep),
  };
}

/** A version step: takes a profile of version `from` and returns one of `from + 1`. */
export type Migration = (old: Record<string, unknown>) => Record<string, unknown>;
/** Steps by the version they upgrade from. A change that renames or reshapes a field adds a step
 *  here (and bumps VERSION); a new field with a default needs no step (normalize fills it).
 *  1 → 2: the Race Series. A v1 save gets an empty series record; a rider who already won races on
 *  the fixed track has proved the Rookie Cup's level, so three wins or more open the Pro Circuit.
 *  2 → 3: Endless Desert. Best distances get their own record (`stats.far`, by mode); a v2 save
 *  starts it at 0 for the desert, and its other stats carry over untouched.
 *  3 → 4: Endless Wheelie City and the endless grounds. Each gets its own best (`stats.far.city`,
 *  `.quarry`, `.forest`, `.night-park`), from 0; the desert's best carries over as it was. */
export const MIGRATIONS: Record<number, Migration> = {
  1: (o) => {
    const wins = typeof (o.stats as { wins?: unknown } | undefined)?.wins === "number" ? ((o.stats as { wins: number }).wins) : 0;
    return { ...o, series: { best: wins >= 3 ? { rookie: 1 } : {}, titles: 0, run: null, last: null } };
  },
  2: (o) => {
    const st = obj(o.stats);
    return { ...o, stats: { ...st, far: { desert: 0, ...obj(st.far) } } };
  },
  3: (o) => {
    const st = obj(o.stats);
    return { ...o, stats: { ...st, far: { ...farZero(), ...obj(st.far) } } };
  },
};

/** Anything ever saved → a current profile, or null when it is not a profile at all or comes from a
 *  newer version of the game (which must not be overwritten: the caller keeps it and plays fresh). */
export function migrate(raw: unknown, steps: Record<number, Migration> = MIGRATIONS, version = VERSION): Profile | null {
  let o = obj(raw);
  if (!Object.keys(o).length) return null;
  let v = typeof o.v === "number" ? o.v : 0;
  if (v > version) return null;
  while (v < version) {
    const step = steps[v];
    if (step) o = step(o);
    v++;
    o = { ...o, v };
  }
  return normalize(o);
}

/** The store: localStorage if it works, else nothing (try/catch on every access). */
export interface Store { get(k: string): string | null; set(k: string, v: string): void }
export const local: Store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};
/** Load from the store: the profile, and whether a newer save sits there untouched. */
export function load(store: Store = local): { profile: Profile; newer: boolean } {
  let s = store.get(STORE_KEY);
  for (const k of OLD_STORE_KEYS) s ||= store.get(k);
  if (!s) return { profile: fresh(), newer: false };
  let raw: unknown = null;
  try {
    raw = JSON.parse(s);
  } catch {}
  const p = migrate(raw);
  if (p) return { profile: p, newer: false };
  const newer = typeof obj(raw).v === "number" && (obj(raw).v as number) > VERSION;
  return { profile: fresh(), newer };
}
/** Save (unless `newer`: a save from a newer game is never overwritten). */
export function save(p: Profile, store: Store = local, newer = false) {
  if (!newer) store.set(STORE_KEY, JSON.stringify(p));
}

// ---- the export code: HS<version>-<base64url of the JSON>-<checksum> ----
// Codes from before the rename start DH (DH1-, DH2-) and still import.
const b64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64 = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
};
/** FNV-1a over the text, 6 base-36 digits: catches a typo, not a forger (there is nothing to win). */
const sum = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36).padStart(7, "0").slice(-6).toUpperCase();
};
/** The profile as a code to copy to another device. */
export function exportCode(p: Profile) {
  const body = b64(JSON.stringify(normalize(p)));
  return `HS${VERSION}-${body}-${sum(body)}`;
}
/** A code back into a profile, or an error to show. */
export function importCode(code: string): { profile: Profile } | { error: string } {
  const m = /^(?:HS|DH)(\d+)-([A-Za-z0-9_-]+)-([0-9A-Z]{6})$/.exec(code.replace(/\s+/g, ""));
  if (!m) return { error: "That doesn't look like a Holeshot code." };
  if (sum(m[2]!) !== m[3]) return { error: "The code has a typo in it (the check doesn't match)." };
  let raw: unknown;
  try {
    raw = JSON.parse(unb64(m[2]!));
  } catch {
    return { error: "The code is damaged." };
  }
  const p = migrate(raw);
  if (!p) return { error: "That code is from a newer Holeshot. Update the game first." };
  return { profile: p };
}
