// The locker's flows, data-driven: the screens a "customise it, buy it, upgrade it, compare it" game
// shares, built from ./ui.ts. Game-agnostic: the game hands in plain data through these types (its
// items, prices, credits, owned state, stats, labels) and the attributes its click handler routes on
// (`attrs`); the locker never owns the state or the rules. Each flow is its own export, so a game
// that ships only the item grid pays only for the item grid.
import { barRow, bars, btn, drop, esc, footbar, grid, heading, menu, need, num, pill, price, row, sheet, stat, stats, table, tile } from "./ui.ts";

/** Words the flows use; a game overrides any of them (its language, its tone). */
export interface LockerCopy { credits: string; equipped: string; owned: string; cancel: string; buy: string; need: string }
export const COPY: LockerCopy = { credits: "credits", equipped: "Equipped", owned: "Owned", cancel: "Cancel", buy: "Buy", need: "more credits needed" };

/** One thing you can own and wear/fit/paint: a scheme, a helmet, an outfit, a tank skin. */
export interface Item { id: string; name: string; art: string; price: number; owned?: boolean; equipped?: boolean; attrs: string }
/** A slot (paint scheme, plastics, helmet…): the menu row and its count line. */
export interface Slot { id: string; name: string; meta: string; attrs: string }

/** SLOTS → ITEM GRID (paged) → PREVIEW → BUY / CANCEL. `page` is 0-based; `trying` the item on the stage
 *  (pinned, not yet owned); `open` shows the slot menu; `big` uses the art tiles (helmets, outfits). */
export function itemGrid(o: {
  title: string; count: string; slots?: Slot[]; slot?: string; open?: boolean; menuAttrs?: string; note?: string;
  ownedOnly?: { on: boolean; attrs: string }; items: Item[]; page: number; per: number; cols: number; big?: boolean;
  pageAttrs: (page: number) => string; pageWord: string; trying?: Item | null; credits: number; cancelAttrs: string; buyAttrs: string; empty?: string; copy?: LockerCopy;
}) {
  const c = o.copy ?? COPY, list = o.ownedOnly?.on ? o.items.filter((x) => x.owned || x.equipped || !x.price) : o.items;
  const pages = Math.max(1, Math.ceil(list.length / o.per)), pg = Math.min(o.page, pages - 1), from = pg * o.per, shown = list.slice(from, from + o.per);
  const cur = o.slots?.find((s) => s.id === o.slot);
  const bar = o.slots || o.note || o.ownedOnly ? `<div class="lk-toolbar">${o.slots ? `<span class="lk-pop">${drop(cur?.name ?? o.title, o.menuAttrs ?? "", !!o.open)}${o.open ? menu({ label: o.title, items: o.slots.map((s) => ({ label: s.name, meta: s.meta, on: s.id === o.slot, attrs: s.attrs })) }) : ""}</span>` : ""}${o.note ? `<small class="lk-sub">${esc(o.note)}</small>` : ""}${o.ownedOnly ? `<span class="lk-toolbar-end">${checkKey(c.owned + " only", o.ownedOnly)}</span>` : ""}</div>` : "";
  const tiles = shown.map((x) => tile({ name: x.name, art: x.art, price: x.price, owned: x.owned, equipped: x.equipped, on: o.trying?.id === x.id, attrs: x.attrs, big: o.big }));
  const left = list.length - from - shown.length;
  const paging = pages > 1 ? `<div class="lk-paging"><small class="lk-sub">${from + 1}–${from + shown.length} of ${list.length} ${esc(o.pageWord)}</small>${pg < pages - 1 ? btn(`Next ${Math.min(o.per, left)} ${o.pageWord} ›`, o.pageAttrs(pg + 1)) : btn(`‹ Previous ${o.per}`, o.pageAttrs(pg - 1))}</div>` : "";
  const t = o.trying, foot = t ? footbar(`Previewing ${esc(t.name)}`, btn(c.cancel, o.cancelAttrs) + price({ label: c.buy, price: t.price, credits: o.credits, attrs: o.buyAttrs, go: true }), 'role="group" aria-label="Preview"') + need(t.price, o.credits) : "";
  return `${heading(o.title, o.count)}${bar}${shown.length ? grid(tiles, o.cols, o.title) : `<p class="lk-sub">${esc(o.empty ?? "Nothing here yet.")}</p>`}${paging}${foot}`;
}
const checkKey = (label: string, o: { on: boolean; attrs: string }) => `<button type="button" class="lk-btn lk-check" role="checkbox" aria-checked="${o.on}" ${o.attrs}><i aria-hidden="true">${o.on ? "✓" : ""}</i>${esc(label)}</button>`;

/** A thing that wears and gets serviced (a part, a track, armour): its condition 0..1 and its key. */
export interface Wear { label: string; sub?: string; v: number; state?: string; tag?: string; key: { label: string; price?: number; done?: string; attrs: string }; attrs?: string }
/** CONDITION: rows of bars with a price key each; `loose` lays each row out as its own card. */
export const condition = (rows: Wear[], credits: number, head?: [string, string], loose = false) =>
  bars(rows.map((r) => barRow({ label: r.label, sub: r.sub, v: r.v, state: r.state, tag: r.tag, attrs: r.attrs, action: price({ label: r.key.label, price: r.key.price, credits, done: r.key.done, attrs: r.key.attrs }) })), head, loose);

/** An upgrade line: name, its state in words ("Stage 1 fitted"), and its price or a tick. */
export interface Upgrade { id: string; name: string; state: string; price?: number; attrs: string }
/** UPGRADES: the list, and the one under preview with its stats before → after. */
export function upgrades(o: { items: Upgrade[]; on?: string; preview?: { name: string; blurb: string; stats: [string, string, string][]; key: { label: string; price: number; attrs: string } } | null; credits: number; copy?: LockerCopy }) {
  const list = `<ul class="lk-rows lk-rows-tight">${o.items.map((u) => row({ title: esc(u.name), mid: esc(u.state), end: u.price ? num(u.price) : `<span class="lk-tick" aria-label="Done">✓</span>`, on: u.id === o.on, attrs: u.attrs })).join("")}</ul>`;
  const p = o.preview;
  const pv = p ? `<section class="lk-card lk-preview" aria-label="Preview">${`<div class="lk-preview-h">${pill("Preview")}<b class="lk-h3">${esc(p.name)}</b></div>`}<p class="lk-sub">${esc(p.blurb)}</p>${stats(p.stats.map(([l, a, b]) => stat(l, a, null, b)), "Before and after")}<div class="lk-foot">${need(p.key.price, o.credits) || "<span></span>"}<span>${price({ label: p.key.label, price: p.key.price, credits: o.credits, attrs: p.key.attrs, go: true })}</span></div></section>` : "";
  return list + pv;
}

/** One bay (garage spot, hangar, wardrobe slot): what's in it and its key. */
export interface Bay { label: string; name?: string; on?: boolean; end: string; attrs?: string }
/** OWNED: the bays sheet with its expansion (the next bay for sale, or none). Desktop popover, phone bottom sheet. */
export function baysSheet(o: { title: string; sub: string; bays: Bay[]; expand?: { title: string; line: string; key: { label: string; price: number; attrs: string } } | null; credits: number; close: string; empty: string }) {
  const rows = o.bays.map((b) => row({ eyebrow: b.label, title: b.name ? esc(b.name) : esc(o.empty), end: b.end, on: b.on, attrs: b.attrs }));
  const ex = o.expand ? `<div class="lk-expand"><div><b class="lk-h4">${esc(o.expand.title)}</b><b>${esc(o.expand.line)}</b></div>${price({ label: o.expand.key.label, price: o.expand.key.price, credits: o.credits, attrs: o.expand.key.attrs })}${need(o.expand.key.price, o.credits)}</div>` : "";
  return sheet({ title: o.title, sub: o.sub, close: o.close, body: `<ul class="lk-rows">${rows.join("")}</ul>${ex}` });
}

/** COMPARE: stats side by side for two or more things; `better` says which way wins per row (1 up, −1 down, 0 none). */
export function compare(o: { names: string[]; rows: { label: string; values: string[]; nums?: number[]; better?: 1 | -1 | 0 }[]; label: string }) {
  return table(["", ...o.names], o.rows.map((r) => {
    const best = r.nums && r.better ? (r.better > 0 ? Math.max(...r.nums) : Math.min(...r.nums)) : NaN;
    return [esc(r.label), ...r.values.map((v, i) => (r.nums?.[i] === best ? `<b data-best>${esc(v)}</b>` : esc(v)))];
  }), o.label);
}
