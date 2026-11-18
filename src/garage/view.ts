// The garage's card and its clicks: PARTS & MODS (condition with warnings, tyre compounds, crash
// damage, tune choices, mods, the feel, the service log), PAINT & KIT (the bike's look, the rider's
// kit, outfits; anything not owned is tried on first: the preview shows it before you buy) and the
// SHOWROOM (all nineteen bikes in five classes, tiers 3-4 opening with progress; sell a bike or trade one in). Also
// the "before you ride" card when a part may fail. HTML strings, like the rest of the shell's cards;
// the actions are ../model/garage.ts (pure), so this file only renders and routes.
import { CLASSES, MODELS, makerOf, model as modelOf } from "../data/roster.ts";
import { DAMAGE_NAME, FAIL, GARAGE_SLOTS, MODS, MOTOR_NAME, PARTS, PART_NAME, SERVICE_BELOW, SETUPS, TYRES, UNLOCK, type DamageId, type ModId, type PartId, type SetupId, type TyreId } from "../data/economy.ts";
import { GRAPHICS, HELMETS, OUTFITS, PAINTS, PATTERNS, PLASTICS, PLATES, SWATCHES, VISORS, paint as paintOf, swatch } from "../data/looks.ts";
import { bar, esc, num } from "../html.ts";
import { riding, type BikeSave, type Profile } from "../model/profile.ts";
import { tune } from "../model/tune.ts";
import { atRisk, failChance, failName, partState, warnings } from "../model/upkeep.ts";
import { DIRT_LINE, paceLine, paceOf } from "../model/families.ts";
/** The family upgrades (one per family: ../model/families.ts). */
const UPGRADES: ModId[] = ["wbar", "swap", "bore", "boost"];
import { buyBike, cosmeticPrice, choose, dress, fits, fixPrice, modPrice, partPrice, repair, sell, service, setChoice, setupPrice, tradeValue, tryOn, unlocked, upgrade, type Buy, type Slot } from "../model/garage.ts";

export interface GarageUI {
  tab: "bike" | "look" | "showroom";
  look: "bike" | "rider" | "outfit";
  /** A cosmetic being tried on (shown on the preview, not bought yet). */
  trial: [Slot, string] | null;
  /** Test credits (../model/testcredits.ts): the showroom sells every bike, unlocks or not. */
  all: boolean;
}
export const garageUI = (all = false): GarageUI => ({ tab: "bike", look: "bike", trial: null, all });

const isE = (b: BikeSave) => CLASSES[modelOf(b.model).cls].motor === "battery";
const partName = (b: BikeSave, k: PartId) => (k === "motor" ? MOTOR_NAME[modelOf(b.model).cls] : PART_NAME[k]);
const cost = (n: number, can: boolean) => (n ? `<small class="dh-price"${can ? "" : " data-short"}>◈ ${num(n)}</small>` : `<small class="dh-price">OWNED</small>`);
const SLOT_NAME: Record<string, string> = { paint: "PAINT SCHEME", graphics: "GRAPHICS", plastics: "PLASTICS", plate: "PLATE DECAL", helmet: "HELMET", helmetPaint: "HELMET PAINT", visor: "VISOR", jersey: "JERSEY", pants: "PANTS", pattern: "PATTERN", boots: "BOOTS", gloves: "GLOVES", outfit: "OUTFIT" };
const STATE_TAG: Record<string, string> = { worn: "WORN", risk: "MAY FAIL", failed: "FAILED" };

/** The profile as the preview shows it: with the try-on on. */
export function shown(p: Profile, ui: GarageUI): Profile {
  if (!ui.trial) return p;
  const t = tryOn(p, ui.trial[0], ui.trial[1]);
  return typeof t === "string" ? p : t;
}

/** A service-log entry in words. */
export function logLine(b: BikeSave, what: string) {
  const [k, a, c] = what.split(":");
  if (k === "svc") return a === "tyres" ? `NEW TYRES (${TYRES[c as TyreId]?.name ?? "MEDIUM"})` : a === "motor" ? (isE(b) ? "NEW CELLS" : `${partName(b, "motor")} REBUILT`) : `${PART_NAME[a as PartId] ?? a} SERVICED`;
  if (k === "mod") return `${modName(b, a as ModId)} ${MODS[a as ModId]?.max === 1 ? "FITTED" : "STAGE " + c}`;
  if (k === "setup") return `${SETUPS[a as SetupId]?.name}: ${SETUPS[a as SetupId]?.opts.find((o) => o.id === c)?.name ?? c}`;
  if (k === "fix") return `${DAMAGE_NAME[a as DamageId]} FIXED`;
  if (k === "fail") return failName(b, a as PartId);
  return k === "crew" ? "PIT CREW FIX" : k === "new" ? "BOUGHT NEW" : what.toUpperCase();
}
const modName = (b: BikeSave, k: ModId) => (k === "power" && isE(b) ? MODS[k].e : MODS[k].name);

function partsTab(p: Profile, b: BikeSave) {
  const t = tune(b), cr = p.credits;
  const warn = warnings(b).filter((w) => w[1] !== "worn");
  const banner = warn.length ? `<p class="dh-alert" role="alert">${warn.map((w) => `<b>${partName(b, w[0] as PartId)}</b> ${esc(w[2])}`).join(" · ")}</p>` : "";
  const parts = PARTS.map((k) => {
    const v = b.parts[k], st = partState(b, k), price = partPrice(b, k), need = v < SERVICE_BELOW || st === "failed";
    const label = k === "tyres" ? "NEW SET" : k === "motor" ? (isE(b) ? "NEW CELLS" : "REBUILD") : "SERVICE";
    const tag = st !== "ok" ? `<small class="dh-tag" data-state="${st}">${STATE_TAG[st]}${st === "risk" ? " " + Math.round(failChance(b, k) * 100) + "%" : ""}</small>` : "";
    const tyres = k === "tyres" ? `<span class="dh-chips" role="group" aria-label="Tyre compound">${(Object.keys(TYRES) as TyreId[]).map((c) => { const pr = partPrice(b, "tyres", c), on = c === b.tyre; return `<button type="button" class="bui-key dh-mini" data-tyre="${c}" aria-pressed="${on}" title="${esc(TYRES[c].blurb)}"${on && !need ? " disabled" : ""}>${TYRES[c].name}<small>◈${pr}</small></button>`; }).join("")}</span>` : "";
    return `<li data-part="${k}"><span class="dh-pcol">${bar(v, partName(b, k), st === "ok" ? "" : st)}${tag}${tyres}</span><button type="button" class="bui-key dh-buy" data-service="${k}" ${need ? "" : "disabled"}>${label}${need ? cost(price, cr >= price) : "<small>NEW</small>"}</button></li>`;
  }).join("");
  const dmg = (Object.keys(DAMAGE_NAME) as DamageId[]).map((k) => { const v = b.dmg[k], pr = fixPrice(b, k); return `<li>${bar(1 - v, DAMAGE_NAME[k], v > 0.5 ? "worn" : "")}<button type="button" class="bui-key dh-buy" data-fix="${k}" ${pr ? "" : "disabled"}>FIX${pr ? cost(pr, cr >= pr) : "<small>OK</small>"}</button></li>`; }).join("");
  const setups = (Object.keys(SETUPS) as SetupId[]).filter((k) => SETUPS[k].only !== "e" || isE(b)).map((k) => `<li class="dh-setup"><b class="dh-h3">${SETUPS[k].name}</b><span class="dh-chips">${SETUPS[k].opts.map((o) => { const pr = setupPrice(b, k, o.id); return `<button type="button" class="bui-key dh-mini" data-setup="${k}" data-id="${o.id}" aria-pressed="${b[k] === o.id}" title="${esc(o.blurb)}">${o.name}${pr ? `<small${cr >= pr ? "" : " data-short"}>◈${pr}</small>` : ""}</button>`; }).join("")}</span><small class="dh-blurb">${esc(SETUPS[k].opts.find((o) => o.id === b[k])?.blurb ?? "")}</small></li>`).join("");
  const mods = (Object.keys(MODS) as ModId[]).filter((k) => fits(b, k)).map((k) => {
    const M = MODS[k], lv = b.mods[k] ?? 0, price = modPrice(b, k);
    // A family upgrade: its pace before → after, measured on the sim for this bike as it is now.
    const pc = UPGRADES.includes(k) ? `<small class="dh-pace-up" aria-label="Pace before and after">${paceLine(paceOf(tune({ ...b, mods: { ...b.mods, [k]: 0 } })))} → <b>${paceLine(paceOf(tune({ ...b, mods: { ...b.mods, [k]: 1 } })))}</b></small>` : "";
    return `<li><span class="dh-mod"><b>${modName(b, k)}</b><small>${esc(M.blurb)}</small>${pc}<i aria-label="Level ${lv} of ${M.max}">${"◆".repeat(lv)}${"◇".repeat(M.max - lv)}</i></span><button type="button" class="bui-key dh-buy" data-mod="${k}" ${price ? "" : "disabled"}>${price ? (lv || M.max === 1 ? (M.max === 1 ? "FIT" : "UPGRADE") : "STAGE 1") + cost(price, cr >= price) : M.max === 1 ? "FITTED" : "MAXED"}</button></li>`;
  }).join("");
  const log = b.log.length ? `<ol class="dh-log">${b.log.slice(0, 8).map(([e, w, c]) => `<li><small>EVENT ${e}</small><span>${logLine(b, w)}</span><b>${c ? "◈" + num(c) : ""}</b></li>`).join("")}</ol>` : `<p class="dh-sub">Nothing yet. Every service, mod and fix lands here.</p>`;
  return `${banner}<div class="dh-cols"><section><b class="dh-h2">CONDITION</b><ul class="dh-list">${parts}</ul><b class="dh-h2">CRASH DAMAGE</b><ul class="dh-list">${dmg}</ul><b class="dh-h2">SERVICE LOG</b>${log}</section><section><b class="dh-h2">TUNE</b><ul class="dh-list">${setups}</ul><b class="dh-h2">MODS</b><ul class="dh-list">${mods}</ul><b class="dh-h2">FEEL</b><div class="dh-feel">${bar(t.feel.pull, "PULL")}${bar(t.feel.top, "TOP SPEED")}${bar(t.feel.grip, "GRIP")}${bar(t.feel.susp, "SUSPENSION")}${bar(t.feel.brakes, "BRAKES")}${bar(t.feel.light, "LIGHT")}</div></section></div>`;
}

type Swk = { id: string; name: string; a: string; b?: string };
function lookTab(p: Profile, b: BikeSave, ui: GarageUI) {
  const k = p.kit, pt = paintOf(b.look.paint), s = shown(p, ui), sb = riding(s), tr = ui.trial;
  const row = (slot: Slot, list: Swk[], on: string) => `<li><b class="dh-h3">${SLOT_NAME[slot]}</b><span class="dh-swrow">${list.map((x) => { const pr = cosmeticPrice(p, slot, x.id), trying = !!tr && tr[0] === slot && tr[1] === x.id; return `<button type="button" class="dh-swk" data-dress="${slot}" data-id="${x.id}" aria-pressed="${x.id === on}"${trying ? " data-try" : ""} style="--a:${x.a};--b:${x.b ?? x.a}" aria-label="${x.name}${pr ? `, ${pr} credits` : ""}"><i></i><small>${x.name}</small>${pr ? `<em>◈${pr}</em>` : ""}</button>`; }).join("")}</span></li>`;
  const sw = (on: (x: (typeof SWATCHES)[number]) => Swk = (x) => ({ id: x.id, name: x.name, a: x.hex })) => SWATCHES.map(on);
  let rows = "";
  if (ui.look === "bike") {
    rows = row("paint", PAINTS.map((x) => ({ id: x.id, name: x.name, a: x.plastic, b: x.plastic2 })), sb.look.paint)
      + row("plastics", PLASTICS.map((x) => ({ id: x.id, name: x.name, a: x.hex || pt.plastic, b: x.hex || pt.plastic2 })), sb.look.plastics)
      + row("graphics", GRAPHICS.map((x) => ({ id: x.id, name: x.name, a: pt.plastic, b: x.id === "none" ? pt.plastic : pt.plastic2 })), sb.look.graphics)
      + row("plate", PLATES.map((x) => ({ id: x.id, name: x.name, a: x.plate || pt.plate, b: x.ink || pt.ink })), sb.look.plate)
      + `<li><b class="dh-h3">NUMBER</b><span class="dh-swrow"><input class="dh-numin" type="number" min="1" max="99" value="${b.look.number}" aria-label="Plate number" /><button type="button" class="bui-key dh-buy" data-number>SET${cost(cosmeticPrice(p, "number", ""), true)}</button></span></li>`;
  } else if (ui.look === "rider") {
    const sk = s.kit;
    rows = row("helmet", HELMETS.map((h) => ({ id: h.id, name: h.name, a: swatch(sk.helmetPaint).hex })), sk.helmet) + row("helmetPaint", sw(), sk.helmetPaint) + row("visor", VISORS.map((x) => ({ id: x.id, name: x.name, a: x.hex })), sk.visor)
      + row("jersey", sw(), sk.jersey) + row("pattern", PATTERNS.map((x) => ({ id: x.id, name: x.name, a: swatch(sk.jersey).hex, b: x.id === "solid" ? swatch(sk.jersey).hex : x.id === "stripe" ? swatch(sk.helmetPaint).hex : x.id === "split" ? swatch(sk.pants).hex : x.id === "accent" ? swatch(sk.gloves).hex : "#7fe9ff" })), sk.pattern)
      + row("pants", sw(), sk.pants) + row("boots", sw(), sk.boots) + row("gloves", sw(), sk.gloves);
  } else {
    rows = row("outfit", OUTFITS.map((o) => ({ id: o.id, name: o.name, a: swatch(o.kit.jersey).hex, b: swatch(o.kit.helmetPaint).hex })), OUTFITS.find((o) => Object.entries(o.kit).every(([q, v]) => k[q as keyof typeof k] === v))?.id ?? "");
  }
  const trying = tr ? `<p class="dh-try" role="status"><span>TRYING ON · ${SLOT_NAME[tr[0]]}: <b>${esc(nameOf(tr[0], tr[1]))}</b></span><button type="button" class="bui-key dh-go" data-buytrial>BUY${cost(cosmeticPrice(p, tr[0], tr[1]), p.credits >= cosmeticPrice(p, tr[0], tr[1]))}</button><button type="button" class="bui-key" data-untry>PUT IT BACK</button></p>` : `<p class="dh-sub">Tap anything to try it on: the preview shows it first. What you own switches for free.</p>`;
  const seg = `<nav class="dh-seg" aria-label="Paint and kit">${([["bike", "BIKE"], ["rider", "RIDER KIT"], ["outfit", "OUTFITS"]] as const).map(([v, t]) => `<button type="button" class="bui-key" data-look="${v}" aria-pressed="${v === ui.look}">${t}</button>`).join("")}</nav>`;
  return `${seg}${trying}<ul class="dh-list dh-looks">${rows}</ul>`;
}
function nameOf(slot: Slot, id: string) {
  const L: Record<string, { id: string; name: string }[]> = { paint: PAINTS, graphics: GRAPHICS, plastics: PLASTICS, plate: PLATES, helmet: HELMETS, visor: VISORS, pattern: PATTERNS, outfit: OUTFITS };
  return (L[slot] ?? SWATCHES).find((x) => x.id === id)?.name ?? id;
}

function showroomTab(p: Profile, all: boolean) {
  const full = p.bikes.length >= GARAGE_SLOTS, me = riding(p), trade = tradeValue(me), cr = p.credits;
  const mine = p.bikes.map((x, i) => { const m = modelOf(x.model), v = tradeValue(x); return `<li><span class="dh-mod"><small>${CLASSES[m.cls].name} · #${x.look.number}${i === p.ride ? " · RIDES NEXT" : ""}</small><b>${makerOf(m).name} ${m.name}</b><small>Trade-in ◈ ${num(v)} · ${x.events} events</small></span><button type="button" class="bui-key dh-buy" data-sell="${i}" ${p.bikes.length > 1 ? "" : "disabled"}>SELL<small class="dh-price">+◈ ${num(v)}</small></button></li>`; }).join("");
  const cls = (Object.keys(CLASSES) as (keyof typeof CLASSES)[]).map((c) => `<li class="dh-class"><b class="dh-h2">${CLASSES[c].name} · ${CLASSES[c].maker}</b><ul class="dh-list dh-show">${MODELS.filter((x) => x.cls === c).map((x) => {
    const open = all || unlocked(p, x), u = UNLOCK[x.tier], net = full ? Math.max(0, x.price - trade) : x.price, t = tune({ ...me, ...blank(x.id) });
    const btn = !open ? `<button type="button" class="bui-key dh-buy" disabled>LOCKED<small class="dh-price">${u!.events} EVENTS or ◈${num(u!.earned)} EARNED</small></button>`
      : full ? `<button type="button" class="bui-key dh-buy" data-bike="${x.id}" data-trade="${p.ride}">TRADE IN${cost(net, cr >= net)}</button>`
      : `<button type="button" class="bui-key dh-buy" data-bike="${x.id}">BUY${cost(x.price, cr >= x.price)}</button>`;
    return `<li${open ? "" : " data-locked"}><span class="dh-mod"><small>${"★".repeat(x.tier)}${"☆".repeat(4 - x.tier)} · ◈ ${num(x.price)}</small><b><i class="dh-maker" style="--a:${makerOf(x).colors[0]};--b:${makerOf(x).colors[1]}"></i>${makerOf(x).name} ${x.name}</b><small>${esc(x.blurb)}</small><span class="dh-mini-bars">${bar(t.feel.pull, "PULL")}${bar(t.feel.top, "TOP")}${bar(t.feel.light, "LIGHT")}</span></span>${btn}</li>`;
  }).join("")}</ul></li>`).join("");
  const prog = `You: ${p.stats.events} events · ◈ ${num(p.stats.earned)} earned.`;
  return `<p class="dh-sub">${full ? `The garage holds ${GARAGE_SLOTS} bikes: a new one trades in the bike that rides next (◈ ${num(trade)} off), or sell one first.` : "A new bike goes in the empty bay and rides next. Each bike keeps its own parts, mods and paint."} ${prog}</p><b class="dh-h2">YOUR BIKES</b><ul class="dh-list">${mine}</ul><ul class="dh-list dh-classes">${cls}</ul>`;
}
const blank = (id: string) => ({ model: id, parts: { tyres: 1, chain: 1, motor: 1, susp: 1, brakes: 1 }, mods: { power: 0, brakes: 0, weight: 0, travel: 0, cells: 0, wbar: 0, swap: 0, bore: 0, boost: 0 }, tyre: "med" as TyreId, gearing: "stock", spring: "stock", map: "std", dmg: { bars: 0, plastics: 0 } });

/** The garage card: the header and tabs (the shell's), the bay (the preview slot, your bikes), the
 *  three garage tabs, the note line. */
export function garageCard(p: Profile, ui: GarageUI, head: string, tabs: string, note: string) {
  const b = riding(p), m = modelOf(b.model);
  const bikes = p.bikes.map((x, i) => { const mm = modelOf(x.model), w = atRisk(x).length || x.fail; return `<button type="button" class="bui-key dh-slot-k" data-ride="${i}" aria-pressed="${i === p.ride}"><small>${CLASSES[mm.cls].name}${w ? ' <em class="dh-warn">⚠</em>' : ""}</small><b>${mm.name}</b><small>#${x.look.number}</small></button>`; }).join("") + (p.bikes.length < GARAGE_SLOTS ? `<button type="button" class="bui-key dh-slot-k dh-empty" data-gtab="showroom"><small>EMPTY BAY</small><b>+ BIKE</b></button>` : "");
  const body = ui.tab === "bike" ? partsTab(p, b) : ui.tab === "look" ? lookTab(p, b, ui) : showroomTab(p, ui.all);
  return `<div class="dh-card dh-garage" data-screen="garage">${head}${tabs}<div class="dh-bay"><canvas-slot></canvas-slot><div><small>${CLASSES[m.cls].name} · ${makerOf(m).name}</small><b class="dh-big">${m.name} <i>#${b.look.number}</i></b><p class="dh-sub">${esc(m.blurb)}</p><div class="dh-slots" role="group" aria-label="Your bikes">${bikes}</div></div></div><nav class="dh-seg" aria-label="Garage">${([["bike", "PARTS & MODS"], ["look", "PAINT & KIT"], ["showroom", "SHOWROOM"]] as const).map(([v, tx]) => `<button type="button" class="bui-key" data-gtab="${v}" aria-pressed="${v === ui.tab}">${tx}</button>`).join("")}</nav>${body}<p class="dh-sub dh-note" role="status">${esc(note)}</p></div>`;
}

/** A click in the garage: a purchase to report ([result, what]), a new profile, or just a redraw
 *  (`{}`); null when the click is not the garage's. */
export function garageClick(p: Profile, ui: GarageUI, t: HTMLElement, root: ParentNode): { buy?: [Buy, string]; profile?: Profile } | null {
  const d = t.dataset;
  if (d.gtab) return (ui.tab = d.gtab as GarageUI["tab"]), (ui.trial = null), {};
  if (d.look) return (ui.look = d.look as GarageUI["look"]), (ui.trial = null), {};
  if (d.ride) return (ui.trial = null), { profile: choose(p, +d.ride) };
  if (d.tyre) return { buy: [service(p, "tyres", d.tyre as TyreId), `New ${TYRES[d.tyre as TyreId].name.toLowerCase()} tyres`] };
  if (d.service) return { buy: [service(p, d.service as PartId), "Serviced"] };
  if (d.fix) return { buy: [repair(p, d.fix as DamageId), "Fixed"] };
  if (d.setup) return { buy: [setChoice(p, d.setup as SetupId, d.id!), "Set"] };
  if (d.mod) return { buy: [upgrade(p, d.mod as ModId), "Upgraded"] };
  if (d.dress) {
    const slot = d.dress as Slot, id = d.id!;
    // Free or owned: on at once. Anything else is tried on first.
    if (!cosmeticPrice(p, slot, id)) return (ui.trial = null), { buy: [dress(p, slot, id), "Done"] };
    return (ui.trial = [slot, id]), {};
  }
  if (d.buytrial !== undefined && ui.trial) { const [s, id] = ui.trial; ui.trial = null; return { buy: [dress(p, s, id), "Bought"] }; }
  if (d.untry !== undefined) return (ui.trial = null), {};
  if (d.number !== undefined) return { buy: [dress(p, "number", root.querySelector<HTMLInputElement>(".dh-numin")!.value), "Number set"] };
  if (d.bike) return { buy: [buyBike(p, d.bike, ui.all, d.trade !== undefined ? +d.trade : undefined), d.trade !== undefined ? "Traded in" : "Bought"] };
  if (d.sell) {
    if (d.sure === undefined) return (d.sure = ""), (t.firstChild!.textContent = "SURE? TAP AGAIN"), null;
    return { buy: [sell(p, +d.sell), "Sold"] };
  }
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
