// HOLESHOT onto the shop (../../vendor/shop/): its bikes, wear, crash damage, tune, mods, paint,
// helmets and outfits as the shop's plain data. Every number comes from the game's own model
// (../model/garage.ts prices, ../model/tune.ts feel, ../model/pace.ts pace); nothing here decides a
// rule. The `attrs` are the garage's routing (./view.ts garageClick).
import { CLASSES, model as modelOf } from "../data/roster.ts";
import { DAMAGE_NAME, GARAGE_MAX, MODS, MOTOR_NAME, PARTS, PART_NAME, SERVICE_BELOW, SETUPS, TYRES, type DamageId, type ModId, type PartId, type SetupId, type TyreId } from "../data/economy.ts";
import { GRAPHICS, HELMETS, OUTFITS, PAINTS, PATTERNS, PLASTICS, PLATES, SWATCHES, VISORS, paint as paintOf, swatch as swatchOf } from "../data/looks.ts";
import type { RigHelmet } from "../bike/rig.ts";
import { riding, type BikeSave, type Profile } from "../model/profile.ts";
import { paceRow } from "../model/pace.ts";
import type { Tuned } from "../model/tune.ts";
import type { Units } from "../model/units.ts";
import { atRisk, failChance, partState } from "../model/upkeep.ts";
import { cosmeticPrice, fits, fixPrice, modPrice, partPrice, setupPrice, spotPrice, tradeValue, type Slot } from "../model/garage.ts";
import { helmetSVG } from "./portrait.ts";
import { helmetOf } from "./look.ts";
import type { Item, RailBay, Slot as LkSlot, Upgrade, Wear } from "../../vendor/shop/shop.js";
import { btn, esc, pill, price, swatch } from "../../vendor/shop/shop.js";

/** "CHAIN & SPROCKETS" → "Chain & sprockets" (the design's sentence case). */
export const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
/** "PINK OUT" → "Pink Out", "YOWLER 125 2T" → "Yowler 125 2T" (names of things). */
/** A name in title case; model codes and the class letters stay capitals (YOWLER 125 2T → Yowler 125 2T, MX PEAK → MX Peak). */
export const words = (s: string) => s.split(" ").map((w) => (/\d|^(MX|SX|KX|YZ|GP|TT)$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(" ");

export const isE = (b: BikeSave) => CLASSES[modelOf(b.model).cls].motor === "battery";
export const partName = (b: BikeSave, k: PartId) => (k === "motor" ? MOTOR_NAME[modelOf(b.model).cls] : PART_NAME[k]);
export const modName = (b: BikeSave, k: ModId) => (k === "power" && isE(b) ? MODS[k].e : MODS[k].name);
const STATE_TAG: Record<string, string> = { worn: "WORN", risk: "MAY FAIL", failed: "FAILED" };
/** Each thing's icon (the shop's set, ../../vendor/shop/ icon): parts, crash damage, tune, mods, slots. */
export const partIcon = (b: BikeSave, k: PartId) => (k === "motor" ? (isE(b) ? "battery" : "piston") : ({ tyres: "tyre", chain: "chain", susp: "shock", brakes: "disc" } as Record<string, string>)[k]!);
export const DMG_ICON: Record<DamageId, string> = { bars: "bars", plastics: "plastics" };
export const SETUP_ICON: Record<string, string> = { gearing: "sprocket", spring: "shock", map: "map" };
export const MOD_ICON: Record<string, string> = { power: "exhaust", brakes: "disc", weight: "feather", travel: "travel", cells: "battery", wbar: "wheelie", swap: "trade", bore: "bore", boost: "turbo" };
export const SLOT_ICON: Record<string, string> = { paint: "paint", plastics: "plastics", graphics: "graphics", plate: "plate", number: "number", helmet: "helmet", helmetPaint: "paint", visor: "visor", jersey: "jersey", pattern: "pattern", pants: "pants", boots: "boots", gloves: "gloves", outfit: "jersey" };

/** PACE as stat tiles' words: [label, value] in the design's case ("0–30 MPH", "0.88 s", "TOP SPEED", "66 mph"). */
export const pace = (t: Pick<Tuned, "power" | "shape">, u: Units): [string, string][] => paceRow(t, u).map(([k, v]) => [k === "TOP" ? "TOP SPEED" : k, v === "NEVER" ? "—" : v.toLowerCase()]);

/** CONDITION: the five parts (tyres carry the compound key), from the bike's wear. */
export function wearRows(b: BikeSave, tyreKey: string): Wear[] {
  return PARTS.map((k) => {
    const v = b.parts[k], st = partState(b, k), pr = partPrice(b, k), need = v < SERVICE_BELOW || st === "failed";
    const label = k === "tyres" ? "New set" : k === "motor" ? (isE(b) ? "New cells" : "Rebuild") : "Service";
    const tag = st !== "ok" ? `<small class="dh-tag" data-state="${st}">${STATE_TAG[st]}${st === "risk" ? " " + Math.round(failChance(b, k) * 100) + "%" : ""}</small>` : "";
    return { label: cap(partName(b, k)), icon: partIcon(b, k), sub: k === "tyres" ? tyreKey : undefined, v, state: st === "ok" ? "" : st, tag, attrs: `data-part="${k}"`, key: { label, price: need ? pr : undefined, done: need ? undefined : `At ${Math.round(v * 100)}%`, attrs: `data-service="${k}"` } };
  });
}
/** The tyre compounds as menu items (a new set of each, its price; the fitted one ticked). */
export const tyreItems = (b: BikeSave) => (Object.keys(TYRES) as TyreId[]).map((c) => ({ label: cap(TYRES[c].name), meta: `${partPrice(b, "tyres", c)} credits`, on: c === b.tyre, attrs: `data-tyre="${c}" title="${esc(TYRES[c].blurb)}"` }));
/** CRASH DAMAGE: only what is damaged (none → the "No crash damage" card). */
export const damageRows = (b: BikeSave): Wear[] => (Object.keys(DAMAGE_NAME) as DamageId[]).filter((k) => b.dmg[k] > 0.005).map((k) => ({ label: cap(DAMAGE_NAME[k]), icon: DMG_ICON[k], v: 1 - b.dmg[k], state: b.dmg[k] > 0.5 ? "worn" : "", key: { label: "Fix", price: fixPrice(b, k), attrs: `data-fix="${k}"` } }));

/** TUNING: each setup with its options (price, or ticked when fitted) and the fitted one's blurb. */
export const setups = (b: BikeSave) => (Object.keys(SETUPS) as SetupId[]).filter((k) => SETUPS[k].only !== "e" || isE(b)).map((k) => ({
  id: k, icon: SETUP_ICON[k] ?? "wrench", name: cap(SETUPS[k].name), blurb: SETUPS[k].opts.find((o) => o.id === b[k])?.blurb ?? "",
  opts: SETUPS[k].opts.map((o) => ({ label: cap(o.name), on: b[k] === o.id, price: setupPrice(b, k, o.id), attrs: `data-setup="${k}" data-id="${o.id}" title="${esc(o.blurb)}"` })),
}));
/** RIDE FEEL: the six feel numbers as bars (0..1). */
export const feelRows = (t: Tuned): [string, number][] => [["Pull", t.feel.pull], ["Top speed", t.feel.top], ["Grip", t.feel.grip], ["Suspension", t.feel.susp], ["Brakes", t.feel.brakes], ["Light", t.feel.light]];

/** UPGRADES: every mod that fits, its stage in words and the next stage's price (or a tick). */
export const upgradeItems = (b: BikeSave): Upgrade[] => (Object.keys(MODS) as ModId[]).filter((k) => fits(b, k)).map((k) => {
  const M = MODS[k], lv = b.mods[k] ?? 0, pr = modPrice(b, k);
  return { id: k, name: cap(modName(b, k)), icon: k === "power" && isE(b) ? "map" : MOD_ICON[k], stage: [lv, M.max], state: !lv ? "Available" : M.max === 1 ? "Fitted" : `Stage ${lv} fitted`, price: pr || undefined, attrs: `data-pv="mod:${k}" tabindex="0" role="button"` };
});
/** The next stage's key label: Fit, Stage 1 or Upgrade. */
export const modKey = (b: BikeSave, k: ModId) => (MODS[k].max === 1 ? "Fit" : (b.mods[k] ?? 0) ? "Upgrade" : "Stage 1");
/** The upgrade preview's name: "Weight saving · Stage 2". */
export const modStage = (b: BikeSave, k: ModId) => `${cap(modName(b, k))}${MODS[k].max > 1 ? ` · Stage ${Math.min(MODS[k].max, (b.mods[k] ?? 0) + 1)}` : ""}`;

/** The bike's look slots and the rider's kit slots (the dropdown and the chips). */
export type BikeSlot = "paint" | "plastics" | "graphics" | "plate" | "number";
export type RiderSlot = "helmet" | "helmetPaint" | "visor" | "jersey" | "pattern" | "pants" | "boots" | "gloves";
export const SLOT_NAME: Record<string, string> = { paint: "Paint scheme", plastics: "Plastics", graphics: "Graphics", plate: "Plate decal", number: "Race number", helmet: "Helmet", helmetPaint: "Helmet paint", visor: "Visor", jersey: "Jersey", pattern: "Pattern", pants: "Pants", boots: "Boots", gloves: "Gloves", outfit: "Outfit" };
export const RIDER_SLOTS: RiderSlot[] = ["helmet", "helmetPaint", "visor", "jersey", "pattern", "pants", "boots", "gloves"];
/** The bike slots as menu rows: name and a count line from the lists. */
export const bikeSlots = (b: BikeSave): LkSlot[] => [
  { id: "paint", name: SLOT_NAME.paint!, meta: `${PAINTS.length} schemes`, attrs: 'data-gslot="paint"', icon: "paint" },
  { id: "plastics", name: SLOT_NAME.plastics!, meta: "Factory & colors", attrs: 'data-gslot="plastics"', icon: "plastics" },
  { id: "graphics", name: SLOT_NAME.graphics!, meta: `${GRAPHICS.length} graphics`, attrs: 'data-gslot="graphics"', icon: "graphics" },
  { id: "plate", name: SLOT_NAME.plate!, meta: `${PLATES.length} decals`, attrs: 'data-gslot="plate"', icon: "plate" },
  { id: "number", name: SLOT_NAME.number!, meta: `#${b.look.number}`, attrs: 'data-gslot="number"', icon: "number" },
];
export const riderSlots = (): LkSlot[] => RIDER_SLOTS.map((k) => ({ id: k, name: SLOT_NAME[k]!, meta: "", attrs: `data-gslot="${k}"`, icon: SLOT_ICON[k] }));

/** A cosmetic as a shop item: its art, price (0 when owned or free), worn or not. */
const item = (p: Profile, slot: Slot, id: string, name: string, art: string, on: string): Item => {
  const pr = cosmeticPrice(p, slot, id);
  return { id, name: words(name), art, price: pr, owned: !pr, equipped: id === on, attrs: `data-dress="${slot}" data-id="${id}" data-pv="${slot}:${id}"` };
};
/** A bike slot's items (paint schemes, plastics, graphics, plate decals). */
export function bikeItems(p: Profile, slot: BikeSlot): Item[] {
  const b = riding(p), pt = paintOf(b.look.paint), L = b.look;
  if (slot === "paint") return PAINTS.map((x) => item(p, slot, x.id, x.name, swatch(x.plastic, x.plastic2), L.paint));
  if (slot === "plastics") return PLASTICS.map((x) => item(p, slot, x.id, x.name, swatch(x.hex || pt.plastic, x.hex || pt.plastic2), L.plastics));
  if (slot === "graphics") return GRAPHICS.map((x) => item(p, slot, x.id, x.name, swatch(pt.plastic, x.id === "none" ? pt.plastic : pt.plastic2), L.graphics));
  if (slot === "plate") return PLATES.map((x) => item(p, slot, x.id, x.name, swatch(x.plate || pt.plate, x.ink || pt.ink), L.plate));
  return [];
}
/** A rider slot's items: helmet shapes drawn in your helmet's colours, else swatches. */
export function riderItems(p: Profile, shown: Profile, slot: RiderSlot): Item[] {
  const k = p.kit, sk = shown.kit, hc = helmetOf(sk), sw = (s: RiderSlot) => SWATCHES.map((x) => item(p, s, x.id, x.name, swatch(x.hex), k[s]));
  if (slot === "helmet") return HELMETS.map((h) => item(p, slot, h.id, h.name, helmetSVG(hc, h.id as RigHelmet), k.helmet));
  if (slot === "visor") return VISORS.map((x) => item(p, slot, x.id, x.name, swatch(x.hex), k.visor));
  if (slot === "pattern") return PATTERNS.map((x) => item(p, slot, x.id, x.name, swatch(swatchOf(sk.jersey).hex, x.id === "solid" ? swatchOf(sk.jersey).hex : x.id === "stripe" ? swatchOf(sk.helmetPaint).hex : x.id === "split" ? swatchOf(sk.pants).hex : x.id === "accent" ? swatchOf(sk.gloves).hex : "#7fe9ff"), k.pattern));
  return sw(slot);
}
/** A jersey and pants, drawn flat in an outfit's colours (the outfit tiles' art). */
const kitArt = (j: string, a: string, pants: string) => `<svg class="dh-kitart" viewBox="0 0 64 64" aria-hidden="true"><path d="M21 4 6 12l5 15 7-3v16h28V24l7 3 5-15L43 4c-2 4-6 6-11 6S23 8 21 4Z" fill="${j}" stroke="#0b0a14" stroke-width="1.5" stroke-linejoin="round"/><path d="M18 26l28-7v6l-28 7Z" fill="${a}"/><path d="M18 42h28v20h-9l-5-12-5 12h-9Z" fill="${pants}" stroke="#0b0a14" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
/** OUTFITS: the presets (the one you wear is the one whose every piece matches). */
export function outfitItems(p: Profile): Item[] {
  const k = p.kit, on = OUTFITS.find((o) => Object.entries(o.kit).every(([q, v]) => k[q as keyof typeof k] === v))?.id ?? "";
  return OUTFITS.map((o) => item(p, "outfit", o.id, o.name, kitArt(swatchOf(o.kit.jersey ?? k.jersey).hex, swatchOf(o.kit.helmetPaint ?? k.helmetPaint).hex, swatchOf(o.kit.pants ?? k.pants).hex), on));
}

/** MY BIKES: every bay you own (your bikes, each with its picture from `art`, then the empty ones),
 *  and the next bay for sale. */
export function bays(p: Profile, art: (b: BikeSave) => string = () => ""): { bays: RailBay[]; sub: string; line: string; expand: { title: string; line: string; key: { label: string; price: number; attrs: string } } | null } {
  const n = p.bikes.length, empty = p.slots - n;
  const list: RailBay[] = [];
  for (let i = 0; i < p.slots; i++) {
    const b = p.bikes[i];
    if (!b) { list.push({ label: `Bay ${i + 1}`, add: 'data-gtab="showroom" aria-label="Add a bike: to the showroom"' }); continue; }
    const warn = atRisk(b).length || b.fail ? ` <span class="dh-warn" title="A part may fail" aria-label="a part may fail">⚠</span>` : "";
    const sellKey = n > 1 ? price({ label: "Sell", price: tradeValue(b), attrs: `data-sell="${i}" aria-label="Sell for ${tradeValue(b)} credits"` }) : "";
    const pic = art(b);
    list.push({ label: `Bay ${i + 1}`, name: `${esc(words(modelOf(b.model).name))} #${b.look.number}${warn}`, art: pic ? `<img alt="" src="${pic}" />` : "", on: i === p.ride, keys: (i === p.ride ? pill("Rides next", "plain") : btn("Select", `data-ride="${i}" aria-label="Select bike ${i + 1}"`)) + sellKey });
  }
  const pr = spotPrice(p), pl = (k: number, w: string) => `${k} ${w}${k === 1 ? "" : "s"}`;
  return {
    bays: list,
    sub: `${pl(n, "bike")} · ${pl(empty, "empty bay")} · ${p.slots} unlocked`,
    line: n > 1 ? `Bike ${p.ride + 1} of ${n}${empty ? ` · ${pl(empty, "empty bay")}` : ""}` : `${pl(n, "bike")}${empty ? ` · ${pl(empty, "empty bay")}` : ""}`,
    expand: pr ? { title: "Garage expansion", line: `Bay ${p.slots + 1} of ${GARAGE_MAX}`, key: { label: "Unlock", price: pr, attrs: "data-spot" } } : null,
  };
}
