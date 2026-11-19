// The garage's actions, pure: each takes a profile and returns the next one (or why not). Prices
// come from ../data/economy.ts; a cosmetic bought once is owned (switching back to it is free), and
// so is a tune choice on the bike it was bought for. Every service, mod, fix and failure goes in the
// bike's service log (./upkeep.ts logIt).
import { COSMETIC, DAMAGE_PRICE, GARAGE_MAX, GARAGE_SLOTS, MODS, MOTOR_PRICE, PART_PRICE, SERVICE_BELOW, SETUPS, SPOT_PRICE, TRADE, TYRES, UNLOCK, type DamageId, type ModId, type PartId, type SetupId, type TyreId } from "../data/economy.ts";
import { GRAPHICS, HELMETS, OUTFITS, PAINTS, PATTERNS, PLASTICS, PLATES, SWATCHES, VISORS, type KitSlot, type LookSlot } from "../data/looks.ts";
import { CLASSES, model, MODELS, type Model } from "../data/roster.ts";
import { newBike, normalize, riding, type BikeSave, type Profile } from "./profile.ts";
import { logIt } from "./upkeep.ts";
import { fitsWhere } from "./families.ts";

export type Buy = { ok: true; profile: Profile; spent: number } | { ok: false; why: string };
const no = (why: string): Buy => ({ ok: false, why });
const r5 = (v: number) => Math.round(v / 5) * 5;
const isE = (b: BikeSave) => CLASSES[model(b.model).cls].motor === "battery";

/** What it costs to bring `part` back to new on `bike` (tyres: in compound `tyre`, default its own). */
export function partPrice(bike: BikeSave, part: PartId, tyre: TyreId = bike.tyre ?? "med") {
  const m = model(bike.model), base = part === "motor" ? MOTOR_PRICE[m.cls] : PART_PRICE[part];
  return r5(base * m.upkeep.cost * (part === "tyres" ? (TYRES[tyre] ?? TYRES.med).price : 1));
}
/** Service a part on the riding bike (new tyres, a rebuild, a fresh battery…). New tyres can be any
 *  compound: a different compound is a new set even when the old one is fresh. */
export function service(p: Profile, part: PartId, tyre?: TyreId): Buy {
  const n = normalize(p), b = riding(n);
  if (!b) return no("No bike.");
  const swap = part === "tyres" && tyre !== undefined && tyre !== b.tyre;
  if (b.parts[part] >= SERVICE_BELOW && !swap && b.fail !== part) return no("It's as good as new.");
  const cost = partPrice(b, part, part === "tyres" ? tyre : undefined);
  if (n.credits < cost) return no(`${cost} credits needed.`);
  b.parts[part] = 1;
  if (part === "tyres" && tyre) b.tyre = tyre;
  if (b.fail === part) b.fail = "";
  n.credits -= cost;
  logIt(b, `svc:${part}${part === "tyres" ? ":" + b.tyre : ""}`, cost);
  return { ok: true, profile: n, spent: cost };
}
/** Whether `mod` fits the bike (a battery pack or a motor swap only on an electric, a big bore kit on
 *  a gas dirt bike, a turbo on a street bike, a wheelie bar on the mini: ./families.ts). */
export const fits = (bike: BikeSave, mod: ModId) => fitsWhere(MODS[mod].only, model(bike.model));
/** The next level's price of `mod` on the riding bike, or 0 at the top (or when it doesn't fit). */
export function modPrice(bike: BikeSave, mod: ModId) {
  const lv = bike.mods[mod] ?? 0, M = MODS[mod];
  return lv >= M.max || !fits(bike, mod) ? 0 : M.price[lv + 1]!;
}
export function upgrade(p: Profile, mod: ModId): Buy {
  if (!MODS[mod]) return no("Not in the shop.");
  const n = normalize(p), b = riding(n), cost = modPrice(b, mod);
  if (!fits(b, mod)) return no("That doesn't fit this bike.");
  if (!cost) return no("That's the top level.");
  if (n.credits < cost) return no(`${cost} credits needed.`);
  b.mods[mod]++;
  n.credits -= cost;
  logIt(b, `mod:${mod}:${b.mods[mod]}`, cost);
  return { ok: true, profile: n, spent: cost };
}

/** A tune choice's price on the bike (0 when stock, bought before, or on). */
export function setupPrice(bike: BikeSave, k: SetupId, id: string) {
  const o = SETUPS[k].opts.find((x) => x.id === id);
  return !o || bike[k] === id || bike.setups.includes(k + ":" + id) ? 0 : o.price;
}
/** Switch a tune choice (gearing, springs, a motor map); paid the first time on each bike. */
export function setChoice(p: Profile, k: SetupId, id: string): Buy {
  const n = normalize(p), b = riding(n);
  if (SETUPS[k].only === "e" && !isE(b)) return no("That's for electric bikes.");
  if (!SETUPS[k].opts.some((x) => x.id === id)) return no("Not in the shop.");
  if (b[k] === id) return no("It's set like that already.");
  const cost = setupPrice(b, k, id);
  if (n.credits < cost) return no(`${cost} credits needed.`);
  b[k] = id;
  if (cost) b.setups.push(k + ":" + id), logIt(b, `setup:${k}:${id}`, cost);
  n.credits -= cost;
  return { ok: true, profile: n, spent: cost };
}

/** What fixing crash damage costs on `bike` (0 when there's none). */
export const fixPrice = (bike: BikeSave, k: DamageId) => (bike.dmg[k] > 0.005 ? r5(DAMAGE_PRICE[k] * model(bike.model).upkeep.cost * (0.4 + 0.6 * bike.dmg[k])) : 0);
/** Straighten the bars or replace the plastics on the riding bike. */
export function repair(p: Profile, k: DamageId): Buy {
  const n = normalize(p), b = riding(n), cost = fixPrice(b, k);
  if (!cost) return no("Nothing to fix.");
  if (n.credits < cost) return no(`${cost} credits needed.`);
  b.dmg[k] = 0;
  n.credits -= cost;
  logIt(b, "fix:" + k, cost);
  return { ok: true, profile: n, spent: cost };
}

/** Every cosmetic slot: the bike's look and the rider's kit, plus whole outfits. */
export type Slot = KitSlot | LookSlot | "outfit";
const LISTS: Record<Exclude<Slot, "number" | "outfit">, { id: string; tier: number }[]> = {
  paint: PAINTS, graphics: GRAPHICS, plastics: PLASTICS, plate: PLATES, helmet: HELMETS, visor: VISORS, pattern: PATTERNS,
  helmetPaint: SWATCHES, jersey: SWATCHES, pants: SWATCHES, boots: SWATCHES, gloves: SWATCHES,
};
const BIKE_LOOK = ["paint", "graphics", "plastics", "plate"] as const;
const onNow = (p: Profile, slot: Slot, id: string) => {
  if (slot === "outfit") { const o = OUTFITS.find((x) => x.id === id); return !!o && Object.entries(o.kit).every(([k, v]) => p.kit[k as KitSlot] === v); }
  if (slot === "number") return false;
  const b = riding(p);
  return (BIKE_LOOK as readonly string[]).includes(slot) ? !!b && b.look[slot as (typeof BIKE_LOOK)[number]] === id : p.kit[slot as KitSlot] === id;
};
/** A cosmetic's price (0 when owned, already on, or the scheme's own). */
export function cosmeticPrice(p: Profile, slot: Slot, id: string) {
  if (slot === "number") return COSMETIC.number;
  if (p.owned.includes(slot + ":" + id) || onNow(p, slot, id)) return 0;
  if (slot === "outfit") {
    const o = OUTFITS.find((x) => x.id === id);
    if (!o) return 0;
    // Pieces already owned come off the bundle's price (never under half).
    const have = Object.entries(o.kit).filter(([k, v]) => p.owned.includes(k + ":" + v) || p.kit[k as KitSlot] === v).length;
    return r5(COSMETIC.outfit[o.tier]! * Math.max(0.5, 1 - have / 6));
  }
  if ((slot === "graphics" || slot === "plastics" || slot === "plate") && (id === "none" || id === "scheme")) return 0;
  const tier = LISTS[slot].find((x) => x.id === id)?.tier ?? 0;
  return COSMETIC[slot][tier]!;
}
/** The profile wearing a cosmetic, with no charge: the garage's try-on preview, and `dress`. */
export function tryOn(p: Profile, slot: Slot, id: string): Profile | string {
  const n = normalize(p), b = riding(n);
  if (slot === "number") {
    const v = Math.round(Number(id));
    if (!(v >= 1 && v <= 99)) return "A number from 1 to 99.";
    if (b.look.number === v) return "That's your number already.";
    b.look.number = v;
    return n;
  }
  if (slot === "outfit") {
    const o = OUTFITS.find((x) => x.id === id);
    if (!o) return "Not in the shop.";
    Object.assign(n.kit, o.kit);
    return n;
  }
  if (!LISTS[slot].some((x) => x.id === id)) return "Not in the shop.";
  if ((BIKE_LOOK as readonly string[]).includes(slot)) b.look[slot as (typeof BIKE_LOOK)[number]] = id;
  else n.kit[slot as KitSlot] = id;
  return n;
}
/** Wear a cosmetic and pay for it: a paint scheme, graphics, plastics, plate decal or number on the
 *  riding bike, a piece of the rider's kit, or a whole outfit (each piece owned from then on). */
export function dress(p: Profile, slot: Slot, id: string): Buy {
  const cost = cosmeticPrice(normalize(p), slot, id);
  if (p.credits < cost) return no(`${cost} credits needed.`);
  const n = tryOn(p, slot, id);
  if (typeof n === "string") return no(n);
  const own = (k: string) => !n.owned.includes(k) && n.owned.push(k);
  if (slot === "outfit") {
    own("outfit:" + id);
    for (const [k, v] of Object.entries(OUTFITS.find((x) => x.id === id)!.kit)) own(k + ":" + v);
  } else if (slot !== "number") own(slot + ":" + id);
  n.credits -= cost;
  return { ok: true, profile: n, spent: cost };
}

/** Whether the showroom sells `m` to this rider yet (tiers 3-4 open with events ridden or credits earned). */
export function unlocked(p: Profile, m: Model) {
  const u = UNLOCK[m.tier];
  return !u || p.stats.events >= u.events || p.stats.earned >= u.earned;
}
/** What the showroom gives for `bike` against a new one: a share of its new price by condition
 *  (worst part, damage) plus a share of its mods. */
export function tradeValue(bike: BikeSave) {
  const m = model(bike.model), worst = Math.min(...Object.values(bike.parts)), dmg = (bike.dmg.bars + bike.dmg.plastics) / 2;
  let mods = 0;
  for (const k of Object.keys(MODS) as ModId[]) for (let l = 1; l <= (bike.mods[k] ?? 0); l++) mods += MODS[k].price[l]!;
  const v = m.price * TRADE.base * (1 - TRADE.wornLoss * (1 - worst) - TRADE.damageLoss * dmg) + mods * TRADE.mods;
  return Math.max(0, Math.round(v / 10) * 10);
}
/** Sell bike `index` (never the last one: nobody is left without a bike). */
export function sell(p: Profile, index: number): Buy {
  const n = normalize(p), b = n.bikes[index | 0];
  if (!b) return no("No such bike.");
  if (n.bikes.length < 2) return no("You need a bike to ride: buy another first.");
  const v = tradeValue(b);
  n.bikes.splice(index | 0, 1);
  if (n.ride >= n.bikes.length || n.ride > index) n.ride = Math.max(0, n.ride - 1);
  n.credits += v;
  return { ok: true, profile: n, spent: -v };
}
/** Buy a new bike (it becomes the one that rides): into a free garage slot, or trading in bike
 *  `trade` (its value comes off the price). `all` skips the showroom's unlocks (tests, tools). */
export function buyBike(p: Profile, modelId: string, all = false, trade?: number): Buy {
  let n = normalize(p);
  const m = MODELS.find((x) => x.id === modelId);
  if (!m) return no("Not in the shop.");
  if (!all && !unlocked(n, m)) { const u = UNLOCK[m.tier]!; return no(`Opens after ${u.events} events or ${u.earned.toLocaleString("en-US")} credits earned.`); }
  const was = riding(n), credit = trade !== undefined && n.bikes[trade] ? tradeValue(n.bikes[trade]!) : 0;
  if (trade === undefined && n.bikes.length >= n.slots) return no(n.slots < GARAGE_MAX ? `The garage holds ${n.slots} bikes: buy a spot or trade one in.` : `The garage holds ${GARAGE_MAX} bikes, the most it can: trade one in.`);
  const cost = Math.max(0, m.price - credit);
  if (n.credits < cost) return no(`${cost.toLocaleString("en-US")} credits needed.`);
  if (trade !== undefined && n.bikes[trade]) {
    n.bikes.splice(trade, 1);
    n.ride = 0;
  }
  let i = n.bikes.length + 1;
  while (n.bikes.some((b) => b.uid === "b" + i)) i++;
  // A new bike comes in its maker's factory colours (owned from then on) and the rider's number.
  const nb = newBike(m.id, "b" + i, "f-" + m.maker, was?.look.number ?? 7);
  if (!n.owned.includes("paint:f-" + m.maker)) n.owned.push("paint:f-" + m.maker);
  logIt(nb, "new", cost);
  n.bikes.push(nb);
  n.ride = n.bikes.length - 1;
  n.credits -= cost;
  n = normalize(n);
  return { ok: true, profile: n, spent: cost };
}
/** Pick which bike rides next. */
export function choose(p: Profile, index: number): Profile {
  const n = normalize(p);
  n.ride = Math.max(0, Math.min(n.bikes.length - 1, index | 0));
  return n;
}
/** The next garage spot's price (0: the garage is as big as it gets). */
export const spotPrice = (p: Profile) => (p.slots < GARAGE_MAX ? SPOT_PRICE[Math.max(0, p.slots - GARAGE_SLOTS)] ?? 0 : 0);
/** Buy one more bike spot (up to GARAGE_MAX), at SPOT_PRICE. */
export function buySpot(p: Profile): Buy {
  const n = normalize(p), cost = spotPrice(n);
  if (!cost) return no(`The garage holds ${GARAGE_MAX} bikes, the most it can.`);
  if (n.credits < cost) return no(`${cost.toLocaleString("en-US")} credits needed.`);
  n.slots++;
  n.credits -= cost;
  return { ok: true, profile: n, spent: cost };
}
