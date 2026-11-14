// The garage's actions, pure: each takes a profile and returns the next one (or why not). Prices
// come from ../data/economy.ts; a cosmetic bought once is owned (switching back to it is free).
import { COSMETIC, GARAGE_SLOTS, MODS, MOTOR_PRICE, PART_PRICE, SERVICE_BELOW, type ModId, type PartId } from "../data/economy.ts";
import { PAINTS, SWATCHES, HELMETS, VISORS, PATTERNS, type KitSlot } from "../data/looks.ts";
import { model, MODELS, SHOP_MODELS } from "../data/roster.ts";
import { newBike, normalize, riding, type BikeSave, type Profile } from "./profile.ts";

export type Buy = { ok: true; profile: Profile; spent: number } | { ok: false; why: string };
const no = (why: string): Buy => ({ ok: false, why });

/** What it costs to bring `part` back to new on `bike`. */
export function partPrice(bike: BikeSave, part: PartId) {
  const m = model(bike.model), base = part === "motor" ? MOTOR_PRICE[m.cls] : PART_PRICE[part];
  return Math.round((base * m.upkeep.cost) / 5) * 5;
}
/** Service a part on the riding bike (new tyres, a rebuild, a fresh battery…). */
export function service(p: Profile, part: PartId): Buy {
  const n = normalize(p), b = riding(n);
  if (!b) return no("No bike.");
  if (b.parts[part] >= SERVICE_BELOW) return no("It's as good as new.");
  const cost = partPrice(b, part);
  if (n.credits < cost) return no(`${cost} credits needed.`);
  b.parts[part] = 1;
  n.credits -= cost;
  return { ok: true, profile: n, spent: cost };
}
/** The next level's price of `mod` on the riding bike, or 0 at the top. */
export function modPrice(bike: BikeSave, mod: ModId) {
  const lv = bike.mods[mod], M = MODS[mod];
  return lv >= M.max ? 0 : M.price[lv + 1]!;
}
export function upgrade(p: Profile, mod: ModId): Buy {
  const n = normalize(p), b = riding(n), cost = modPrice(b, mod);
  if (!cost) return no("That's the top level.");
  if (n.credits < cost) return no(`${cost} credits needed.`);
  b.mods[mod]++;
  n.credits -= cost;
  return { ok: true, profile: n, spent: cost };
}

/** A cosmetic's price (0 when owned or already on). */
export function cosmeticPrice(p: Profile, slot: KitSlot | "paint" | "number", id: string) {
  if (slot === "number") return COSMETIC.number;
  if (p.owned.includes(slot + ":" + id)) return 0;
  if (slot === "paint") {
    const b = riding(p);
    if (b && b.look.paint === id) return 0;
    return COSMETIC.paint[PAINTS.find((x) => x.id === id)?.tier ?? 0]!;
  }
  if (p.kit[slot] === id) return 0;
  const tier = (slot === "helmet" ? HELMETS : slot === "visor" ? VISORS : slot === "pattern" ? PATTERNS : SWATCHES).find((x) => x.id === id)?.tier ?? 0;
  return COSMETIC[slot][tier]!;
}
/** Wear a cosmetic: a paint scheme or number on the riding bike, or a piece of the rider's kit. */
export function dress(p: Profile, slot: KitSlot | "paint" | "number", id: string): Buy {
  const n = normalize(p), cost = cosmeticPrice(n, slot, id), b = riding(n);
  if (n.credits < cost) return no(`${cost} credits needed.`);
  if (slot === "number") {
    const v = Math.round(Number(id));
    if (!(v >= 1 && v <= 99)) return no("A number from 1 to 99.");
    if (b.look.number === v) return no("That's your number already.");
    b.look.number = v;
  } else if (slot === "paint") {
    if (!PAINTS.some((x) => x.id === id)) return no("No such paint.");
    b.look.paint = id;
  } else {
    const list = slot === "helmet" ? HELMETS : slot === "visor" ? VISORS : slot === "pattern" ? PATTERNS : SWATCHES;
    if (!list.some((x) => x.id === id)) return no("Not in the shop.");
    n.kit[slot] = id;
  }
  if (slot !== "number" && !n.owned.includes(slot + ":" + id)) n.owned.push(slot + ":" + id);
  n.credits -= cost;
  return { ok: true, profile: n, spent: cost };
}

/** Buy a new bike into a free garage slot (it becomes the one that rides). */
export function buyBike(p: Profile, modelId: string, all = false): Buy {
  const n = normalize(p), m = MODELS.find((x) => x.id === modelId);
  if (!m || (!all && !SHOP_MODELS.includes(m.id))) return no("Not in the shop.");
  if (n.bikes.length >= GARAGE_SLOTS) return no(`The garage holds ${GARAGE_SLOTS} bikes.`);
  if (n.credits < m.price) return no(`${m.price.toLocaleString("en-US")} credits needed.`);
  let i = n.bikes.length + 1;
  while (n.bikes.some((b) => b.uid === "b" + i)) i++;
  n.bikes.push(newBike(m.id, "b" + i, riding(n)?.look.paint ?? "gridline", riding(n)?.look.number ?? 7));
  n.ride = n.bikes.length - 1;
  n.credits -= m.price;
  return { ok: true, profile: n, spent: m.price };
}
/** Pick which bike rides next. */
export function choose(p: Profile, index: number): Profile {
  const n = normalize(p);
  n.ride = Math.max(0, Math.min(n.bikes.length - 1, index | 0));
  return n;
}
