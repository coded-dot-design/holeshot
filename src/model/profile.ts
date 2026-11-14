// The player's profile: one rider, a garage of up to three bikes, credits, stats and settings, as a
// versioned plain object. Saved on the device (localStorage, every access in try/catch: a private
// window or blocked storage just means no save) and movable between devices as an export code.
// `migrate` takes anything that was ever saved (or typed in) and returns a valid current profile:
// each version step in MIGRATIONS runs in order, then `normalize` fills what is missing and clamps
// what is out of range, so a save from before a part or a field existed still loads.
import { model, STARTERS } from "../data/roster.ts";
import { PARTS, START_CREDITS, GARAGE_SLOTS, MODS, type PartId, type ModId } from "../data/economy.ts";
import { PAINTS, SWATCHES, HELMETS, VISORS, PATTERNS } from "../data/looks.ts";

export const VERSION = 1;
export const STORE_KEY = "dirt-hop:profile";

/** One bike in the garage: its model, each part's condition, its mod levels, its look. */
export interface BikeSave {
  /** Unique within the garage. */
  uid: string;
  model: string;
  parts: Record<PartId, number>;
  mods: Record<ModId, number>;
  look: { paint: string; number: number };
  /** Odometer (world units) and events ridden. */
  odo: number;
  events: number;
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
  stats: { events: number; wins: number; earned: number; best: Record<string, number> };
  /** Events since the pit crew last helped. */
  pit: number;
  settings: { sound: boolean; view: "chase" | "table" };
}

const clamp01 = (v: unknown, d: number) => (typeof v === "number" && isFinite(v) ? Math.max(0, Math.min(1, v)) : d);
const int = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);
const oneOf = (v: unknown, ids: string[], d: string) => (typeof v === "string" && ids.includes(v) ? v : d);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export const STARTER_KIT: RiderKit = { helmet: "peak", helmetPaint: "white", visor: "smoke", jersey: "cyan", pants: "ink", pattern: "stripe", boots: "white", gloves: "ink" };

/** A new bike of `modelId`: every part new, no mods. */
export function newBike(modelId: string, uid: string, paint = "gridline", number = 7): BikeSave {
  return { uid, model: model(modelId).id, parts: { tyres: 1, chain: 1, motor: 1, susp: 1, brakes: 1 }, mods: { power: 0, gearing: 0, susp: 0 }, look: { paint, number }, odo: 0, events: 0 };
}
/** A profile before the first-run setup: no name, no bike yet. */
export function fresh(): Profile {
  return { v: VERSION, name: "", credits: START_CREDITS, ride: 0, bikes: [], kit: { ...STARTER_KIT }, owned: [], stats: { events: 0, wins: 0, earned: 0, best: {} }, pit: 0, settings: { sound: true, view: "chase" } };
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
  out.odo = int(o.odo, 0, 0, 1e9);
  out.events = int(o.events, 0, 0, 1e7);
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
    stats: { events: int(st.events, 0, 0, 1e9), wins: int(st.wins, 0, 0, 1e9), earned: int(st.earned, 0, 0, 1e12), best },
    pit: int(o.pit, 0, 0, 1e6),
    settings: { sound: set.sound !== false, view: set.view === "table" ? "table" : "chase" },
  };
}

/** A version step: takes a profile of version `from` and returns one of `from + 1`. */
export type Migration = (old: Record<string, unknown>) => Record<string, unknown>;
/** Steps by the version they upgrade from. Version 1 is the first released schema: none yet. A
 *  change that renames or reshapes a field adds a step here (and bumps VERSION); a new field with a
 *  default needs no step (normalize fills it). */
export const MIGRATIONS: Record<number, Migration> = {};

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
  const s = store.get(STORE_KEY);
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

// ---- the export code: DH1-<base64url of the JSON>-<checksum> ----
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
  return `DH${VERSION}-${body}-${sum(body)}`;
}
/** A code back into a profile, or an error to show. */
export function importCode(code: string): { profile: Profile } | { error: string } {
  const m = /^DH(\d+)-([A-Za-z0-9_-]+)-([0-9A-Z]{6})$/.exec(code.replace(/\s+/g, ""));
  if (!m) return { error: "That doesn't look like a Dirt Hop code." };
  if (sum(m[2]!) !== m[3]) return { error: "The code has a typo in it (the check doesn't match)." };
  let raw: unknown;
  try {
    raw = JSON.parse(unb64(m[2]!));
  } catch {
    return { error: "The code is damaged." };
  }
  const p = migrate(raw);
  if (!p) return { error: "That code is from a newer Dirt Hop. Update the game first." };
  return { profile: p };
}
