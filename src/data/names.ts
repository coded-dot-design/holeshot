// The three naming tiers (docs/names.md): one set of ids, three sets of display names for every
// maker, model and maker paint. Display names only: ids, saves and the net stay the same in all three.
// - SAFE: fully original names (an app-store build). They are the data's own names (./roster.ts,
//   ./looks.ts), so a SAFE build needs no table at all.
// - NOD: recognisable near-names (the public web, the default build): ./names/nod.ts.
// - REAL: the real makers and models, only with `?names=real` or `?money=inf` on the page (the
//   private family test link; any test-credits param: ?credits= or ?money= inf, infinite, infinity
//   or ∞), never the default, never saved: ./names/real.ts.
// The build picks the tier (scripts/build.mjs: HOLESHOT_NAMES=safe → __NAMES__ "safe"); in a SAFE
// build both tables fold away (`BUILD === "safe"` is a constant there) and none of their strings ship.
import { NOD } from "./names/nod.ts";
import { REAL } from "./names/real.ts";
import { testCredits } from "../model/testcredits.ts";

export type NameTier = "safe" | "nod" | "real";
/** A tier's names over the data's own (SAFE): by maker id, model id and paint id. */
export interface NameSet {
  makers: Record<string, { name: string; motto?: string }>;
  models: Record<string, { name: string; blurb?: string }>;
  paints: Record<string, { name: string }>;
}

/** Baked in at build (scripts/build.mjs); elsewhere (Node, the site) HOLESHOT_NAMES, else NOD. */
declare const __NAMES__: string;
declare const process: { env: Record<string, string | undefined> } | undefined;
const env = typeof process === "object" && process ? process.env.HOLESHOT_NAMES : undefined;
/** The build's tier: what every page shows unless a URL asks for REAL. */
export const BUILD: "nod" | "safe" = (typeof __NAMES__ === "string" ? __NAMES__ : env) === "safe" ? "safe" : "nod";
/** The tiers this build carries (a SAFE build carries no other). The test is written out again, not
 *  `BUILD === "safe"`, so the bundler folds it to a constant and drops both tables. */
const SETS: Partial<Record<NameTier, NameSet>> = (typeof __NAMES__ === "string" ? __NAMES__ : env) === "safe" ? {} : { nod: NOD, real: REAL };
export const tiers = (): NameTier[] => ["safe", ...(Object.keys(SETS) as NameTier[])];

/** The tier a page asks for: REAL with `?names=real` or test credits (`?credits=inf`, `?money=inf`, …:
 *  ../model/testcredits.ts) if the build carries it, else the build's. */
export function tierFor(search: string | URLSearchParams): NameTier {
  const q = typeof search === "string" ? new URLSearchParams(search) : search;
  const real = (q.get("names") ?? "").trim().toLowerCase() === "real" || testCredits(q);
  return real && SETS.real ? "real" : BUILD;
}

// The data that wears names (./roster.ts, ./looks.ts) hands its records in here; each record's own
// (SAFE) fields are kept, so switching tiers back and forth always starts from them.
type Dress = (set: NameSet | undefined) => void;
const dressers: Dress[] = [];
let now: NameTier = BUILD;
/** The tier the names are in now. */
export const names = (): NameTier => now;
/** Put `items` in each tier's names: `pick` finds an item's entry in a set, `fields` are the ones it may set. */
export function wear<T extends { id: string }>(items: T[], pick: (set: NameSet, item: T) => Partial<Record<string, string>> | undefined, fields: (keyof T & string)[], after?: () => void): void {
  const own = items.map((it) => fields.map((f) => it[f] as unknown as string));
  const dress: Dress = (set) => {
    items.forEach((it, i) => {
      const e = set && pick(set, it);
      fields.forEach((f, j) => ((it as Record<string, unknown>)[f] = e?.[f] ?? own[i]![j]));
    });
    after?.();
  };
  dressers.push(dress);
  dress(SETS[now]);
}
/** Show tier `t` (a tier this build does not carry shows the build's). Never saved. */
export function useNames(t: NameTier): NameTier {
  now = t === "safe" || SETS[t] ? t : BUILD;
  for (const d of dressers) d(SETS[now]);
  return now;
}
