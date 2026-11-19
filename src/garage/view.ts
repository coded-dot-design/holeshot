// The garage: the locker (../locker/) with HOLESHOT's adapters (./adapters.ts) and its layout. Left,
// the bike panel (My Bikes and its bays, the turntable with ‹ ›, the bike's name and pace, LET'S
// RIDE); right, PARTS & MODS (Condition with the tyre compound menu and crash damage, Tuning with
// the ride feel, Upgrades with a preview, Service log) and PAINT & KIT (the bike's paint menu and
// scheme grid, the rider's gear, outfits; anything not owned is tried on first and bought from the
// preview bar). The SHOWROOM is its own module, mounted by the shell (game.ts mountShowroom); the
// old showroom below stays as what it mounts until the new one lands. Also the "before you ride"
// card when a part may fail. HTML strings; the actions are ../model/garage.ts (pure), so this file
// only renders and routes.
import { CLASSES, MODELS, makerOf, model as modelOf } from "../data/roster.ts";
import { DAMAGE_NAME, FAIL, GARAGE_MAX, MODS, SETUPS, TYRES, UNLOCK, type DamageId, type ModId, type PartId, type SetupId, type TyreId } from "../data/economy.ts";
import { GRAPHICS, HELMETS, OUTFITS, PAINTS, PATTERNS, PLASTICS, PLATES, SWATCHES, VISORS } from "../data/looks.ts";
import { bar, esc, num } from "../html.ts";
import { portraitOf } from "./portrait.ts";
import { newBike, riding, type BikeSave, type Profile } from "../model/profile.ts";
import { tune, type Tuned } from "../model/tune.ts";
import { paceRow } from "../model/pace.ts";
import type { Units } from "../model/units.ts";
import { atRisk, failChance, failName, warnings } from "../model/upkeep.ts";
import { DIRT_LINE } from "../model/families.ts";
import { buyBike, buySpot, cosmeticPrice, choose, dress, fits, modPrice, repair, sell, service, setChoice, tradeValue, tryOn, unlocked, upgrade, type Buy, type Slot } from "../model/garage.ts";
import { baysSheet, condition, itemGrid, upgrades as upgradeList } from "../locker/flow.ts";
import { btn, card, chips, cta, drop, feel, heading, menu, pill, price, seg, stat, stats, table, tabs, title, turntable } from "../locker/ui.ts";
import { RIDER_SLOTS, SLOT_NAME, bays, bikeItems, bikeSlots, cap, damageRows, feelRows, isE, modKey, modName, modStage, outfitItems, pace, partName, riderItems, riderSlots, setups, tyreItems, upgradeItems, wearRows, words, type BikeSlot, type RiderSlot } from "./adapters.ts";

/** What the turntable can preview: a cosmetic (its slot), a mod's next level, or a showroom bike. */
export type Pv = [Slot | "mod" | "bike" | "own", string];
export interface GarageUI {
  tab: "bike" | "look" | "showroom";
  /** PARTS & MODS' tab. */
  sub: "cond" | "tune" | "up" | "log";
  look: "bike" | "rider" | "outfit";
  /** The slot shown in PAINT & KIT › Bike and › Rider gear. */
  slot: BikeSlot;
  rslot: RiderSlot;
  /** The scheme grid's page, and "owned only". */
  page: number;
  owned: boolean;
  /** The open popover: My Bikes (bays), the tyre compounds, the paint/kit menu. */
  menu: "" | "bays" | "tyre" | "slot";
  /** Pinned preview (tapped): shown on the turntable with BUY / CANCEL until bought or put back. */
  trial: Pv | null;
  /** Passing preview (hover or keyboard focus on a list item): wins over `trial` while it lasts. */
  peek: Pv | null;
  /** Test credits (../model/testcredits.ts): the showroom sells every bike, unlocks or not. */
  all: boolean;
}
export const garageUI = (all = false): GarageUI => ({ tab: "bike", sub: "cond", look: "bike", slot: "paint", rslot: "helmet", page: 0, owned: false, menu: "", trial: null, peek: null, all });

const cost = (n: number, can: boolean) => (n ? `<small class="dh-price"${can ? "" : " data-short"}>◈ ${num(n)}</small>` : `<small class="dh-price">OWNED</small>`);
/** The rider's display units (miles and mph unless the settings say metric). */
const unitsOf = (p: Profile): Units => p.settings.units ?? "imperial";
/** PACE (old showroom cards): 0–a, 0–b and the top speed, measured on the sim (../model/pace.ts). */
const paceDl = (t: Tuned, u: Units, cls = "dh-pace") => `<dl class="${cls}" aria-label="Pace, measured">${paceRow(t, u).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;

/** The profile as the preview shows it: with the peek (or the pinned try-on) on. A mod shows its
 *  next level on the riding bike; a showroom bike stands in for it, new, in its maker's colours. */
export function shown(p: Profile, ui: GarageUI): Profile {
  const v = ui.peek ?? ui.trial;
  if (!v) return p;
  const [k, id] = v;
  if (k === "mod" || k === "bike" || k === "own") {
    const n = structuredClone(p), b = riding(n);
    if (!b) return p;
    if (k === "own") n.ride = Math.max(0, Math.min(n.bikes.length - 1, +id | 0));
    else if (k === "mod") { const M = MODS[id as ModId]; if (M && fits(b, id as ModId)) b.mods[id as ModId] = Math.min(M.max, (b.mods[id as ModId] ?? 0) + 1); }
    else n.bikes[n.ride] = newBike(id, "pv", "f-" + modelOf(id).maker, b.look.number);
    return n;
  }
  const t = tryOn(p, k, id);
  return typeof t === "string" ? p : t;
}
const isLook = (v: Pv | null): v is [Slot, string] => !!v && v[0] !== "mod" && v[0] !== "bike" && v[0] !== "own";
/** The preview an element in the lists stands for (`data-pv="kind:id"`), or null. */
export const pvOf = (el: Element | null): Pv | null => { const a = (el?.closest("[data-pv]") as HTMLElement | null)?.dataset.pv?.split(":"); return a && a.length === 2 ? (a as Pv) : null; };

/** A service-log entry in words. */
export function logLine(b: BikeSave, what: string) {
  const [k, a, c] = what.split(":");
  if (k === "svc") return a === "tyres" ? `NEW TYRES (${TYRES[c as TyreId]?.name ?? "MEDIUM"})` : a === "motor" ? (isE(b) ? "NEW CELLS" : `${partName(b, "motor")} REBUILT`) : `${partName(b, a as PartId) ?? a} SERVICED`;
  if (k === "mod") return `${modName(b, a as ModId)} ${MODS[a as ModId]?.max === 1 ? "FITTED" : "STAGE " + c + " FITTED"}`;
  if (k === "setup") return `${SETUPS[a as SetupId]?.name} CHANGED TO ${SETUPS[a as SetupId]?.opts.find((o) => o.id === c)?.name ?? c}`;
  if (k === "fix") return `${DAMAGE_NAME[a as DamageId]} FIXED`;
  if (k === "fail") return failName(b, a as PartId);
  return k === "crew" ? "PIT CREW FIX" : k === "new" ? "BOUGHT NEW" : what.toUpperCase();
}

// ---- PARTS & MODS ----
function condTab(p: Profile, b: BikeSave, ui: GarageUI) {
  const warn = warnings(b).filter((w) => w[1] !== "worn");
  const banner = warn.length ? `<p class="dh-alert" role="alert">${warn.map((w) => `<b>${partName(b, w[0] as PartId)}</b> ${esc(w[2])}`).join(" · ")}</p>` : "";
  const open = ui.menu === "tyre";
  const tyre = `<span class="lk-pop">${drop(`${cap(TYRES[b.tyre].name)} compound`, 'data-gmenu="tyre"', open, "lk-drop-text")}${open ? menu({ title: "Tyre compound", label: "Tyre compound", items: tyreItems(b) }) : ""}</span>`;
  const dmg = damageRows(b);
  return `${banner}${heading("Bike condition")}${card(condition(wearRows(b, tyre), p.credits, ["Component", "Condition"]), "dh-cond")}${heading("Crash damage", "", 3)}${dmg.length ? condition(dmg, p.credits, undefined, true) : card("No crash damage", "lk-soft")}`;
}
function tuneTab(p: Profile, b: BikeSave) {
  const t = tune(b);
  const rows = setups(b).map((s) => card(`<b class="lk-h4">${s.name}</b><div class="lk-opts">${s.opts.map((o) => (o.on ? btn(`${o.label} ✓`, o.attrs, true) : price({ label: o.label, price: o.price || undefined, credits: p.credits, attrs: o.attrs }))).join("")}</div><p class="lk-blurb">${esc(s.blurb)}</p>`)).join("");
  return `${heading("Tuning")}${rows}${heading("Ride feel", "", 3)}${card(feel(feelRows(t), 2), "dh-feelc")}`;
}
function upTab(p: Profile, b: BikeSave, ui: GarageUI) {
  const v = ui.trial && ui.trial[0] === "mod" ? (ui.trial[1] as ModId) : null, u = unitsOf(p);
  let preview = null;
  if (v && modPrice(b, v)) {
    const nb = structuredClone(b);
    nb.mods[v] = Math.min(MODS[v].max, (nb.mods[v] ?? 0) + 1);
    const a = pace(tune(b), u), z = pace(tune(nb), u);
    preview = { name: modStage(b, v), blurb: MODS[v].blurb, stats: a.map(([l, x], i) => [l, x, z[i]![1]] as [string, string, string]), key: { label: modKey(b, v), price: modPrice(b, v), attrs: `data-mod="${v}"` } };
  }
  return `${heading("Upgrades")}${upgradeList({ items: upgradeItems(b), on: v ?? undefined, preview, credits: p.credits })}${preview ? "" : `<p class="lk-sub">Point at an upgrade to see it on the bike; tap it to preview the numbers and buy.</p>`}`;
}
function logTab(b: BikeSave) {
  const rows = b.log.slice(0, 8).map(([e, w, c]) => [String(e), esc(cap(logLine(b, w))), c ? num(c) : ""]);
  return `${heading("Service log", rows.length ? `${rows.length} ${rows.length === 1 ? "entry" : "entries"} shown` : "")}${rows.length ? card(table(["Event", "Work completed", "Credits"], rows, "Service log"), "dh-log") : card(`<p class="lk-sub">Nothing yet. Every service, mod and fix lands here.</p>`, "dh-log")}`;
}

// ---- PAINT & KIT ----
function lookTab(p: Profile, b: BikeSave, ui: GarageUI) {
  const s = shown(p, { ...ui, peek: null }), tr = isLook(ui.trial) ? ui.trial : null, cr = p.credits;
  const trying = (list: { id: string }[], slot: string) => (tr && tr[0] === slot ? (list.find((x) => x.id === tr[1]) as ReturnType<typeof bikeItems>[number] | undefined) ?? null : null);
  const common = { page: ui.page, pageAttrs: (n: number) => `data-page="${n}"`, credits: cr, cancelAttrs: "data-untry", buyAttrs: "data-buytrial", ownedOnly: { on: ui.owned, attrs: "data-owned" }, menuAttrs: 'data-gmenu="slot"', open: ui.menu === "slot" };
  const sub = tabs([["bike", "Bike"], ["rider", "Rider gear"], ["outfit", "Outfits"]], ui.look, "look", "Paint and kit");
  if (ui.look === "bike") {
    const slots = bikeSlots(b);
    if (ui.slot === "number") return `${sub}${heading("Bike paint", `${PAINTS.length} schemes`)}<div class="lk-toolbar"><span class="lk-pop">${drop(SLOT_NAME.number!, common.menuAttrs, common.open)}${common.open ? menu({ label: "Bike paint", items: slots.map((x) => ({ label: x.name, meta: x.meta, on: x.id === "number", attrs: x.attrs })) }) : ""}</span><small class="lk-sub">Plastics, graphics, plate &amp; number</small></div>${card(`<b class="lk-h4">Race number</b><div class="lk-opts"><input class="dh-numin" type="number" min="1" max="99" value="${b.look.number}" aria-label="Plate number" />${price({ label: "Set", price: cosmeticPrice(p, "number", ""), credits: cr, attrs: "data-number" })}</div>`)}`;
    const items = bikeItems(p, ui.slot), name = SLOT_NAME[ui.slot]!;
    return sub + itemGrid({ ...common, title: "Bike paint", count: `${ui.slot === "paint" ? PAINTS.length + " schemes" : items.length + " " + name.toLowerCase()}`, slots, slot: ui.slot, note: "Plastics, graphics, plate & number", items, per: 12, cols: 4, pageWord: ui.slot === "paint" ? "schemes" : "items", trying: trying(items, ui.slot) });
  }
  if (ui.look === "rider") {
    const items = riderItems(p, s, ui.rslot), helm = ui.rslot === "helmet";
    const grid = itemGrid({ ...common, title: "Rider gear", count: "", slots: riderSlots(), slot: ui.rslot, note: helm ? `${HELMETS.length} helmet styles` : `${items.length} ${SLOT_NAME[ui.rslot]!.toLowerCase()} colours`, items, per: helm ? 6 : 12, cols: helm ? 3 : 4, big: helm, pageWord: "items", trying: trying(items, ui.rslot) });
    return `${sub}${grid}${heading("Customize rider", "", 3)}${chips(RIDER_SLOTS.filter((k) => k !== "helmet").map((k) => btn(SLOT_NAME[k]!, `data-gslot="${k}"`, k === ui.rslot)), "Customize rider")}`;
  }
  const items = outfitItems(p);
  return `${sub}${itemGrid({ ...common, title: "Outfits", count: `${OUTFITS.length} presets`, ownedOnly: undefined, slots: undefined, items, per: 6, cols: 3, big: true, pageWord: "outfits", trying: trying(items, "outfit") })}${tr && tr[0] === "outfit" ? "" : `<p class="lk-sub lk-rule">Select an outfit to preview it on your rider.</p>`}`;
}
/** What a cosmetic is called (the announcement). */
function nameOf(slot: Slot, id: string) {
  const L: Record<string, { id: string; name: string }[]> = { paint: PAINTS, graphics: GRAPHICS, plastics: PLASTICS, plate: PLATES, helmet: HELMETS, visor: VISORS, pattern: PATTERNS, outfit: OUTFITS };
  return (L[slot] ?? SWATCHES).find((x) => x.id === id)?.name ?? id;
}

// ---- the old SHOWROOM (what mountShowroom mounts until the new module lands) ----
/** The showroom's lists: your bikes (sell), then all nineteen by class (buy, trade in, locked). */
export function showroomView(p: Profile, all: boolean) {
  const full = p.bikes.length >= p.slots, me = riding(p), trade = tradeValue(me), u = unitsOf(p);
  const mine = p.bikes.map((x, i) => { const m = modelOf(x.model), v = tradeValue(x); return `<li class="dh-bc" data-pv="own:${i}"><span class="dh-bc-head"><i class="dh-maker" style="--a:${makerOf(m).colors[0]};--b:${makerOf(m).colors[1]}"></i><span class="dh-mod"><small>${CLASSES[m.cls].name} · #${x.look.number}${i === p.ride ? " · RIDES NEXT" : ""}</small><b>${makerOf(m).name} ${m.name}</b><small>Trade-in ◈ ${num(v)} · ${x.events} events</small></span></span><button type="button" class="bui-key dh-buy" data-sell="${i}" ${p.bikes.length > 1 ? "" : "disabled"}>SELL<small class="dh-price">+◈ ${num(v)}</small></button></li>`; }).join("");
  const cls = (Object.keys(CLASSES) as (keyof typeof CLASSES)[]).map((c) => `<li class="dh-class"><h3 class="dh-h2 dh-clh">${CLASSES[c].name} <small>${CLASSES[c].maker}</small></h3><ul class="dh-list dh-show">${MODELS.filter((x) => x.cls === c).map((x) => {
    const t = tune({ ...me, ...blank(x.id) });
    return `<li class="dh-bc" data-pv="bike:${x.id}"${all || unlocked(p, x) ? "" : " data-locked"}><span class="dh-bc-head"><i class="dh-maker" style="--a:${makerOf(x).colors[0]};--b:${makerOf(x).colors[1]}"></i><span class="dh-mod"><small>${CLASSES[x.cls].name} · ${makerOf(x).name}</small><b>${makerOf(x).name} ${x.name}</b><small class="dh-stars"><span aria-label="Tier ${x.tier} of 4">${"★".repeat(x.tier)}${"☆".repeat(4 - x.tier)}</span> · ◈ ${num(x.price)}</small></span></span>${bikeKey(p, x.id, all)}<small class="dh-blurb">${esc(x.blurb)}</small><span class="dh-mini-bars">${bar(t.feel.pull, "PULL")}${bar(t.feel.top, "TOP")}${bar(t.feel.light, "LIGHT")}</span>${paceDl(t, u, "dh-pace dh-pace-s")}</li>`;
  }).join("")}</ul></li>`).join("");
  const prog = `You: ${p.stats.events} events · ◈ ${num(p.stats.earned)} earned.`;
  return `<div class="dh-oldshow"><p class="dh-sub">${full ? `The garage holds ${p.slots} bikes: a new one trades in the bike that rides next (◈ ${num(trade)} off)${p.slots < GARAGE_MAX ? ", or unlock a bay (My Bikes)" : ""}, or sell one first.` : "A new bike goes in the empty bay and rides next. Each bike keeps its own parts, mods and paint."} ${prog} Point at a bike (or tap it) to see it on the turntable.</p><h3 class="dh-h2">YOUR BIKES</h3><ul class="dh-list dh-show dh-mine">${mine}</ul><ul class="dh-list dh-classes">${cls}</ul></div>`;
}
/** A showroom bike's key: BUY, TRADE IN (a full garage) or LOCKED (with what opens it). */
function bikeKey(p: Profile, id: string, all: boolean, go = "") {
  const x = modelOf(id), full = p.bikes.length >= p.slots, net = full ? Math.max(0, x.price - tradeValue(riding(p))) : x.price, cr = p.credits, u = UNLOCK[x.tier];
  return !(all || unlocked(p, x)) ? `<button type="button" class="bui-key dh-buy" disabled>LOCKED<small class="dh-price">${u!.events} EVENTS or ◈${num(u!.earned)} EARNED</small></button>`
    : full ? `<button type="button" class="bui-key dh-buy${go}" data-bike="${x.id}" data-trade="${p.ride}">TRADE IN${cost(net, cr >= net)}</button>`
    : `<button type="button" class="bui-key dh-buy${go}" data-bike="${x.id}">BUY${cost(x.price, cr >= x.price)}</button>`;
}
const blank = (id: string) => ({ model: id, parts: { tyres: 1, chain: 1, motor: 1, susp: 1, brakes: 1 }, mods: { power: 0, brakes: 0, weight: 0, travel: 0, cells: 0, wbar: 0, swap: 0, bore: 0, boost: 0 }, tyre: "med" as TyreId, gearing: "stock", spring: "stock", map: "std", dmg: { bars: 0, plastics: 0 } });

/** What a preview is, in words (the PREVIEW tag and the announcement). */
export function pvName(p: Profile, v: Pv) {
  const [k, id] = v, b = riding(p);
  if (k === "mod") return `${modName(b, id as ModId)}${MODS[id as ModId].max > 1 ? " STAGE " + Math.min(MODS[id as ModId].max, (b.mods[id as ModId] ?? 0) + 1) : ""}`;
  if (k === "bike" || k === "own") { const m = modelOf(k === "own" ? p.bikes[+id]?.model ?? b.model : id); return `${makerOf(m).name} ${m.name}`; }
  return `${SLOT_NAME[k]?.toUpperCase()}: ${nameOf(k, id)}`;
}
/** A pace number's change, preview vs now: "−0.12 s" (quicker) or "+3 mph" (faster), better/worse. */
function delta(now: string, next: string, top: boolean): { text: string; good: boolean | null } | null {
  const a = parseFloat(now), b = parseFloat(next), d = b - a, unit = next.replace(/^[\d.\s]+/, "").trim();
  if (!isFinite(d)) return isFinite(a) === isFinite(b) ? null : { text: isFinite(b) ? "now reaches it" : "no longer reaches it", good: isFinite(b) };
  if (Math.abs(d) < (top ? 0.5 : 0.005)) return { text: "±0", good: null };
  return { text: `${d > 0 ? "+" : "−"}${top ? Math.round(Math.abs(d)) : Math.abs(d).toFixed(2)} ${unit}`, good: top ? d > 0 : d < 0 };
}
/** The bike panel's info under the turntable: the bike shown (PREVIEW when it isn't yours as it is),
 *  its name and number, and its pace against yours when previewing. Redrawn on every peek. */
export function bayInfo(p: Profile, ui: GarageUI) {
  const v = ui.peek ?? ui.trial, s = shown(p, ui), b = riding(s), m = modelOf(b.model), u = unitsOf(p);
  const now = pace(tune(riding(p)), u), next = v ? pace(tune(b), u) : now;
  const tiles = stats(next.map(([k, val], i) => stat(k, val, v ? delta(now[i]![1], val, i === 2) : null)), v ? "Pace of the preview, against yours" : "Pace, measured");
  // Dressing the rider: their helmet portrait (the racer's profile picture), from the kit as shown.
  const face = ui.tab === "look" && ui.look !== "bike" ? `<figure class="dh-face">${portraitOf(s.kit, "Your helmet")}<figcaption>${esc(p.name || "RIDER")}</figcaption></figure>` : "";
  const tag = v ? `${pill("Preview", "", "dh-pvtag")} ${esc(v[0] === "bike" ? "Showroom" : v[0] === "own" ? "Your bikes" : words(pvName(p, v)))}` : "";
  return `${face}${tag ? `<small class="dh-bayline">${tag}</small>` : ""}${title({ maker: words(makerOf(m).name), kind: CLASSES[m.cls].name, name: words(m.name), number: b.look.number })}<div class="dh-pace-bay">${tiles}</div>`;
}
/** A pinned showroom bike or one of yours: its bar under the bike (BUY / APPLY, CANCEL). */
function pinBar(p: Profile, ui: GarageUI) {
  const v = ui.trial;
  if (!v || (v[0] !== "bike" && v[0] !== "own")) return "";
  const [k, id] = v;
  const go = k === "own" ? `<button type="button" class="lk-btn lk-btn-go" data-ride="${id}"${+id === p.ride ? " disabled" : ""}>${+id === p.ride ? "Rides next" : "Ride this one"}</button>` : bikeKey(p, id, ui.all, " dh-go");
  return `<div class="lk-pin dh-pin" role="group" aria-label="Preview"><div class="lk-foot"><b>${pill("Preview", "", "dh-pvtag")} ${esc(words(pvName(p, v)))}</b><span>${btn("Cancel", "data-untry")}${go}</span></div></div>`;
}

/** The garage card: the header (the shell's), the bike panel on the left (My Bikes, the turntable,
 *  the bike shown and its pace, LET'S RIDE) and PARTS & MODS / PAINT & KIT on the right; the
 *  SHOWROOM tab leaves an empty `.dh-showroom` host for the shell to mount into. */
export function garageCard(p: Profile, ui: GarageUI, head: string, go: string, note: string, extra = "") {
  const b = riding(p), B = bays(p);
  const sheet = ui.menu === "bays" ? baysSheet({ title: "My Bikes", sub: B.sub, bays: B.bays, expand: B.expand, credits: p.credits, close: "data-bays", empty: "Empty bay" }) : "";
  const left = `<aside class="lk-card dh-bikep"><div class="lk-toolbar dh-bikebar"><span class="lk-pop dh-bays">${drop("My Bikes", "data-bays", ui.menu === "bays")}${sheet}</span><small class="lk-sub">${esc(B.line)}</small></div>${p.bikes.length > 1 ? turntable("<canvas-slot></canvas-slot>", "data-turn") : `<div class="lk-turn"><canvas-slot></canvas-slot></div>`}<div class="dh-pvinfo">${bayInfo(p, ui)}</div>${pinBar(p, ui)}${go}${extra}</aside>`;
  const right = ui.tab === "showroom" ? `<div class="dh-showroom"></div>`
    : `${seg([["bike", "Parts & Mods"], ["look", "Paint & Kit"]], ui.tab, "gtab", "Garage")}${ui.tab === "bike" ? tabs([["cond", "Condition"], ["tune", "Tuning"], ["up", "Upgrades"], ["log", "Service log"]], ui.sub, "gsub", "Parts and mods") + (ui.sub === "cond" ? condTab(p, b, ui) : ui.sub === "tune" ? tuneTab(p, b) : ui.sub === "up" ? upTab(p, b, ui) : logTab(b)) : lookTab(p, b, ui)}`;
  return `<div class="dh-card dh-garage lk" data-screen="garage" data-tab="${ui.tab}">${head}<div class="dh-gwrap">${left}<div class="dh-gbody">${right}<p class="lk-sub dh-note" role="status">${esc(note)}</p></div></div></div>`;
}

/** A click in the garage: a purchase to report ([result, what]), a new profile, or just a redraw
 *  (`{}`); null when the click is not the garage's. */
export function garageClick(p: Profile, ui: GarageUI, t: HTMLElement, root: ParentNode): { buy?: [Buy, string]; profile?: Profile } | null {
  const d = t.dataset, was = ui.menu;
  ui.peek = null;
  ui.menu = "";
  if (d.gtab) return (ui.tab = d.gtab === "garage" ? (ui.tab === "showroom" ? "bike" : ui.tab) : (d.gtab as GarageUI["tab"])), (ui.trial = null), {};
  if (d.gsub) return (ui.sub = d.gsub as GarageUI["sub"]), (ui.trial = null), {};
  if (d.look) return (ui.look = d.look as GarageUI["look"]), (ui.trial = null), (ui.page = 0), {};
  if (d.gslot) return ui.look === "rider" ? (ui.rslot = d.gslot as RiderSlot) : (ui.slot = d.gslot as BikeSlot), (ui.trial = null), (ui.page = 0), {};
  if (d.gmenu) return (ui.menu = was === d.gmenu ? "" : (d.gmenu as GarageUI["menu"])), {};
  if (d.bays !== undefined) return (ui.menu = was === "bays" ? "" : "bays"), {};
  if (d.page) return (ui.page = Math.max(0, +d.page | 0)), {};
  if (d.owned !== undefined) return (ui.owned = !ui.owned), (ui.page = 0), {};
  if (d.rider !== undefined) return (ui.tab = "look"), (ui.look = "rider"), (ui.trial = null), {};
  if (d.turn) return (ui.trial = null), { profile: choose(p, (p.ride + +d.turn + p.bikes.length) % p.bikes.length) };
  if (d.ride) return (ui.trial = null), { profile: choose(p, +d.ride) };
  if (d.tyre) return { buy: [service(p, "tyres", d.tyre as TyreId), `New ${TYRES[d.tyre as TyreId].name.toLowerCase()} tyres`] };
  if (d.service) return { buy: [service(p, d.service as PartId), "Serviced"] };
  if (d.fix) return { buy: [repair(p, d.fix as DamageId), "Fixed"] };
  if (d.setup) return { buy: [setChoice(p, d.setup as SetupId, d.id!), "Set"] };
  if (d.mod) return (ui.trial = null), { buy: [upgrade(p, d.mod as ModId), "Upgraded"] };
  if (d.dress) {
    const slot = d.dress as Slot, id = d.id!;
    // Free or owned: on at once. Anything else is tried on first.
    if (!cosmeticPrice(p, slot, id)) return (ui.trial = null), { buy: [dress(p, slot, id), "Done"] };
    return (ui.trial = [slot, id]), {};
  }
  if (d.buytrial !== undefined && isLook(ui.trial)) { const [s, id] = ui.trial; ui.trial = null; return { buy: [dress(p, s, id), "Bought"] }; }
  if (d.untry !== undefined) return (ui.trial = null), {};
  if (d.number !== undefined) return { buy: [dress(p, "number", root.querySelector<HTMLInputElement>(".dh-numin")!.value), "Number set"] };
  if (d.spot !== undefined) return { buy: [buySpot(p), "Garage bay unlocked"] };
  if (d.bike) return (ui.trial = null), { buy: [buyBike(p, d.bike, ui.all, d.trade !== undefined ? +d.trade : undefined), d.trade !== undefined ? "Traded in" : "Bought"] };
  if (d.sell) {
    if (d.sure === undefined) return (d.sure = ""), (t.firstChild!.textContent = "SURE? TAP AGAIN"), null;
    return { buy: [sell(p, +d.sell), "Sold"] };
  }
  ui.menu = was;
  return null;
}

/** "Before you ride": a part may fail, or one already has; or a street bike is going on the dirt
 *  (`street`: RIDE ANYWAY or PICK ANOTHER, ../model/families.ts). Empty when the bike is fine. */
export function riskCard(p: Profile, what: string, street = false) {
  const b = riding(p), risky = atRisk(b);
  if (!risky.length && !b.fail && !street) return "";
  if (street && !risky.length && !b.fail) return `<div class="dh-card dh-risk" data-screen="risk" role="dialog" aria-label="Before you ride"><b class="dh-h">BEFORE YOU RIDE</b><p class="dh-sub">${esc(what)}</p><p class="dh-alert dh-street"><b>${esc(DIRT_LINE)}</b> Road tyres slide on the dirt and short springs case the landings. It's built for Endless Wheelie City.</p><p class="dh-row"><button type="button" class="bui-key dh-pick-other" data-go="garage">PICK ANOTHER</button><button type="button" class="bui-key dh-risk-go">RIDE ANYWAY</button></p></div>`;
  const lines = [...(street ? [`<b>${esc(DIRT_LINE)}</b> Road tyres slide on the dirt; short springs case the landings.`] : []), ...(b.fail ? [`Your <b>${partName(b, b.fail)}</b> failed (${failName(b, b.fail)}): it rides at its worst until you replace it.`] : []), ...risky.map((k) => `Your <b>${partName(b, k)}</b> is past its limit (${Math.round(b.parts[k] * 100)}%): a <b>${Math.round(failChance(b, k) * 100)}%</b> chance it fails in this event.`)];
  return `<div class="dh-card dh-risk" data-screen="risk" role="dialog" aria-label="Before you ride"><b class="dh-h">BEFORE YOU RIDE</b><p class="dh-sub">${esc(what)}</p>${lines.map((l) => `<p class="dh-alert">${l}</p>`).join("")}<p class="dh-sub">A failure costs ${Math.round(FAIL.pay * 100)}% of the payout (the tow) and leaves the part dead. Nothing above ${Math.round(FAIL.at * 100)}% ever fails.</p><p class="dh-row"><button type="button" class="bui-key" data-go="garage">TO THE GARAGE</button><button type="button" class="bui-key dh-risk-go">RIDE ANYWAY</button></p></div>`;
}
