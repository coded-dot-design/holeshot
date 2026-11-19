// The shop's catalogue + compare screen, game-agnostic: a filtered, paged list of item cards; a
// preview panel (the game's own preview mounted in a slot) that compares the item with the one the
// player has now, picks the slot it goes into and buys it there; and a side-by-side comparison of two
// items with a one-line summary. No game imports: everything comes through `CatalogueConfig` (the
// game's adapter: Holeshot's is ../garage/showroom.ts). HTML strings; one click and one keydown
// listener on the host; the state lives in `CatalogueState` (the shell keeps it across redraws).
// Composed only from the shop's pieces (./index.ts); ./catalogue.css is layout.
import { btn, card, compare as compareTable, drop, esc, feel, heading, menu, need, num, price, stars, stat, stats, title } from "./index.ts";

/** A number the screen shows: its label, how to write it, and which way is better (for deltas). */
export interface StatDef { key: string; label: string; short?: string; better: "low" | "high"; unit: string; digits: number }
/** One item in the catalogue. Every number is the game's own. */
export interface CatalogueItem {
  id: string;
  /** Brand and type (the eyebrow, "BRAND / TYPE"), the name, and the name with its brand. */
  brand: string; type: string; name: string; full: string;
  /** Tier (stars) of `max`. */
  tier: number; tierMax: number;
  price: number;
  blurb: string;
  /** 0..1 bars ("Pull 71%"); `tone` picks the bar's colour token. */
  bars: { label: string; v: number; tone?: "a" | "b" }[];
  /** Values by StatDef key (null: it never gets there). */
  stats: Record<string, number | null>;
  /** A picture (a URL), drawn lazily: `thumb()` is called for the cards on screen only. */
  thumb?: () => string;
}
/** The thing the player has now, to compare with. */
export interface CatalogueCurrent { name: string; stats: Record<string, number | null> }
/** A slot an item can go into (a bay, a garage spot): empty, or holding something (`holds`) that the
 *  purchase replaces (a trade-in: `credit` off the price). */
export interface CatalogueSlot { index: number; label: string; holds?: string; credit?: number }
/** What buying `item` into `slot` takes: the cost, and why not (locked, the slot can't take it). */
export interface CatalogueOffer { cost: number; locked?: string }

export interface CatalogueConfig {
  /** Every item, in catalogue order. */
  items(): CatalogueItem[];
  /** The filters: each a facet of the items (its values in item order) with its "all" label. */
  filters: { key: "type" | "brand"; all: string }[];
  /** The numbers on each card, the preview's tiles and the comparison (in that order). */
  stats(): StatDef[];
  /** The player's credits now. */
  credits(): number;
  current(): CatalogueCurrent;
  slots(): CatalogueSlot[];
  offer(item: CatalogueItem, slot: CatalogueSlot): CatalogueOffer;
  /** Buy it there: null when done, else why not. */
  buy(item: CatalogueItem, slot: CatalogueSlot): string | null;
  /** Show `item` in the preview: the game mounts its preview into `host`. */
  preview(host: HTMLElement, item: CatalogueItem): void;
  /** Cards per page ("More ↓" adds a page). */
  page: number;
  /** The words (a game's voice; defaults are the shop's). */
  text?: Partial<typeof TEXT>;
  /** Told when something is announced (a screen reader line). */
  say?(s: string): void;
}
export const TEXT = {
  title: "Showroom", models: "MODELS", eyebrow: "SHOWROOM PREVIEW", current: "COMPARE WITH YOUR BIKE", dest: "Destination",
  empty: "Empty", buy: "Buy bike", trade: "Trade in", needed: "more credits needed", credits: "credits", compare: "Compare bikes",
  compareWith: "Compare with", on: "On turntable", showing: "Showing", of: "of", more: "More bikes", compTitle: "Bike comparison",
  back: "Back to showroom", price: "Price", tier: "Tier", types: "Types", brands: "Brands", gains: "gains", over: "over the", sooner: "sooner than the", same: "match on every number", noStats: "Same",
};

export interface CatalogueState { type: string; brand: string; shown: number; pick: string; slot: number; compare: [string, string] | null; open: "" | "type" | "brand" | "slot" }
export const catalogueState = (): CatalogueState => ({ type: "", brand: "", shown: 0, pick: "", slot: -1, compare: null, open: "" });

// ---- pure: filters, paging, deltas, the summary (tests/showroom.test.mjs) ----
/** The distinct values of a facet, in item order. */
export const facet = (items: CatalogueItem[], k: "type" | "brand") => [...new Set(items.map((i) => i[k]))];
/** The items the filters let through. */
export const filtered = (items: CatalogueItem[], s: Pick<CatalogueState, "type" | "brand">) => items.filter((i) => (!s.type || i.type === s.type) && (!s.brand || i.brand === s.brand));
/** A stat's change from `from` to `to`: its sign as better/worse and the words ("−0.03 s"). */
export function delta(d: StatDef, from: number | null, to: number | null): { dir: "up" | "down" | "same"; text: string } {
  if (from === null || to === null) return from === to ? { dir: "same", text: "±0" } : { dir: to === null ? "down" : "up", text: to === null ? "never" : "reaches it" };
  const step = 10 ** -d.digits, v = Math.round((to - from) / step) * step;
  if (Math.abs(v) < step / 2) return { dir: "same", text: `±0 ${d.unit}`.trim() };
  return { dir: (d.better === "high" ? v > 0 : v < 0) ? "up" : "down", text: `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(d.digits)} ${d.unit}`.trim() };
}
export const fmt = (d: StatDef, v: number | null) => (v === null ? "—" : `${v.toFixed(d.digits)} ${d.unit}`.trim());
/** The comparison's one line: the first stat they differ on, said as the better one's gain
 *  ("Striker V4 gains 26 mph over the Crimson 250F", "… 0.42 s sooner than the …"). */
export function summary(a: CatalogueItem, b: CatalogueItem, stats: StatDef[], T = TEXT): string {
  for (const d of [...stats].sort((x, y) => +(y.better === "high") - +(x.better === "high"))) {
    const x = a.stats[d.key] ?? null, y = b.stats[d.key] ?? null;
    if (x === null || y === null) continue;
    const step = 10 ** -d.digits, gap = Math.round(Math.abs(y - x) / step) * step;
    if (gap < step / 2) continue;
    const bWins = d.better === "high" ? y > x : y < x, [w, l] = bWins ? [b, a] : [a, b];
    return d.better === "high" ? `${w.name} ${T.gains} ${gap.toFixed(d.digits)} ${d.unit} ${T.over} ${l.name}.` : `${w.name}: ${d.short ?? d.label} ${gap.toFixed(d.digits)} ${d.unit} ${T.sooner} ${l.name}.`;
  }
  return `${a.name} and ${b.name} ${T.same}.`;
}

// ---- the screen ----
type F = "type" | "brand";
const tiles = (D: StatDef[], it: CatalogueItem, cur: CatalogueCurrent | null, small: boolean, label: string) =>
  stats(D.map((d) => { const v = it.stats[d.key] ?? null, dl = cur ? delta(d, cur.stats[d.key] ?? null, v) : null; return stat(d.label, fmt(d, v), dl && { text: dl.text, good: dl.dir === "same" ? null : dl.dir === "up" }); }), label, small);
const bars = (it: CatalogueItem) => feel(it.bars.map((b) => [b.label, b.v, b.tone === "b" ? "hot" : undefined] as [string, number, string?]));
/** A dropdown key with its menu under it while open (the filters, the destination). */
const pop = (label: string, key: string, open: boolean, items: { label: string; meta?: string; on: boolean; v: string }[], title = label) =>
  `<span class="shop-pop">${drop(label, `data-shop-open="${key}"`, open)}${open ? menu({ label: title, items: items.map((i) => ({ label: i.label, meta: i.meta, on: i.on, attrs: `data-shop-set="${key}" data-v="${esc(i.v)}"` })) }) : ""}</span>`;
const thumb = (it: CatalogueItem, attrs: string) => `<button type="button" class="shop-cat-pic"${attrs}><img alt="" width="384" height="216" data-shop-thumb="${it.id}" /></button>`;

/** Mount the screen in `host`; redraws on its own clicks and on `update()` (the game's state changed). */
export function mountCatalogue(host: HTMLElement, cfg: CatalogueConfig, st: CatalogueState = catalogueState()) {
  const T = { ...TEXT, ...cfg.text };
  let drawn = 0;
  const all = () => cfg.items(), byId = (id: string) => all().find((i) => i.id === id);
  function pickNow() {
    if (!byId(st.pick)) st.pick = (filtered(all(), st)[0] ?? all()[0])!.id;
    return byId(st.pick)!;
  }
  function slotNow() {
    const S = cfg.slots(), s = S.find((x) => x.index === st.slot) ?? S.find((x) => !x.holds) ?? S[0]!;
    st.slot = s.index;
    return { S, s };
  }
  const slotName = (x: CatalogueSlot) => `${x.label} · ${x.holds ? `${T.trade} ${x.holds}` : T.empty}`;
  function left(it: CatalogueItem) {
    const D = cfg.stats(), cur = cfg.current(), { S, s } = slotNow(), o = cfg.offer(it, s), cr = cfg.credits();
    const dest = S.length > 1 ? pop(slotName(s), "slot", st.open === "slot", S.map((x) => ({ label: slotName(x), meta: x.credit ? `−${num(x.credit)}` : "", on: x.index === s.index, v: "" + x.index })), T.dest) : `<b>${esc(slotName(s))}</b>`;
    const key = `data-shop-buy="${it.id}"`, label = s.holds ? T.trade : T.buy;
    const buy = o.locked ? price({ label, done: `${label} · ${num(o.cost)}`, wide: true, attrs: key }) + `<p class="shop-need">${esc(o.locked)}</p>` : price({ label, price: o.cost, credits: cr, attrs: key, go: true, wide: true }) + need(o.cost, cr);
    return card(`${title({ eyebrow: T.eyebrow, name: it.full, small: true })}<div class="shop-cat-stage" data-shop-stage></div>
      <div class="shop-cat-cmp">${title({ eyebrow: T.current, name: cur.name, small: true })}${tiles(D, it, cur, false, T.current)}
      <div class="shop-cat-dest"><span class="shop-sub">${T.dest}</span>${dest}</div>${buy}</div>`, "shop-cat-pv", `aria-label="${T.eyebrow}"`);
  }
  function item(it: CatalogueItem, pick: CatalogueItem, D: StatDef[], cr: number) {
    const on = it.id === pick.id;
    return `<li class="shop-cat-item"${on ? " data-on" : ""} data-shop-id="${it.id}">${card(`${thumb(it, ` data-shop-pick="${it.id}" aria-pressed="${on}" aria-label="Show ${esc(it.full)} on the turntable"`)}
      ${title({ maker: it.brand, kind: it.type, name: it.name, small: true })}<p class="shop-cat-row">${stars(it.tier, it.tierMax)}<b class="shop-cat-price"${it.price > cr ? " data-short" : ""}>${num(it.price)} ${T.credits}</b></p><p class="shop-sub">${esc(it.blurb)}</p>
      ${bars(it)}${tiles(D, it, null, true, it.name)}${on ? btn(`✓ ${T.on}`, "data-shop-on disabled", true, "shop-btn-wide") : btn(`${T.compareWith} ${pick.name}`, `data-shop-cmp="${pick.id},${it.id}"`, false, "shop-btn-wide")}`)}</li>`;
  }
  function right(pick: CatalogueItem) {
    const items = all(), list = filtered(items, st), D = cfg.stats(), cr = cfg.credits(), n = Math.min(list.length, st.shown || cfg.page);
    const f = (k: F, lab: string, word: string) => pop(st[k] || lab, k, st.open === k, [{ label: lab, on: !st[k], v: "" }, ...facet(items, k).map((v) => ({ label: v, on: st[k] === v, v }))], word);
    const other = list.find((i) => i.id !== pick.id) ?? items.find((i) => i.id !== pick.id)!;
    return `<section class="shop-cat-list" aria-label="${T.title}">${heading(T.title, `${items.length} ${T.models}`, 1)}
      <div class="shop-cat-tools">${cfg.filters.map((x) => f(x.key, x.all, x.key === "type" ? T.types : T.brands)).join("")}${btn(T.compare, `data-shop-cmp="${pick.id},${other.id}"`, false, "shop-cat-end")}</div>
      <ul class="shop-cat-grid">${list.slice(0, n).map((i) => item(i, pick, D, cr)).join("")}</ul>
      <div class="shop-cat-foot"><small class="shop-sub" role="status">${T.showing} ${n} ${T.of} ${list.length} ${T.models.toLowerCase()}</small>${n < list.length ? btn(`${T.more} ↓`, "data-shop-more", false, "shop-link") : ""}</div></section>`;
  }
  function compare(a: CatalogueItem, b: CatalogueItem) {
    const D = cfg.stats(), head = (i: CatalogueItem) => `<div>${thumb(i, ` data-shop-pick="${i.id}" aria-label="Show ${esc(i.full)} on the turntable"`)}${title({ maker: i.brand, kind: i.type, name: i.name, small: true })}</div>`;
    const rows = [
      { label: T.price, values: [`${num(a.price)} ${T.credits}`, `${num(b.price)} ${T.credits}`] },
      { label: T.tier, values: [`${a.tier} of ${a.tierMax}`, `${b.tier} of ${b.tierMax}`] },
      ...a.bars.map((x, i) => { const y = b.bars[i]?.v ?? 0; return { label: x.label, values: [`${Math.round(x.v * 100)}%`, `${Math.round(y * 100)}%`], nums: [Math.round(x.v * 100), Math.round(y * 100)], better: 1 as const }; }),
      ...D.map((d) => { const x = a.stats[d.key] ?? null, y = b.stats[d.key] ?? null; return { label: d.short ?? d.label, values: [fmt(d, x), fmt(d, y)], ...(x !== null && y !== null ? { nums: [x, y], better: (d.better === "high" ? 1 : -1) as 1 | -1 } : {}) }; }),
    ];
    return `<section class="shop-cat-list" aria-label="${T.compTitle}"><div class="shop-cat-tools">${heading(T.compTitle, "", 1)}${btn(`‹ ${T.back}`, "data-shop-back", false, "shop-cat-end")}</div>
      ${card(`<div class="shop-cat-heads">${head(a)}${head(b)}</div>${compareTable({ names: [a.name, b.name], rows, label: T.compTitle })}<p class="shop-cat-sum" role="status">${esc(summary(a, b, D, T))}</p>`, "shop-cat-cmpcard")}</section>`;
  }
  function draw() {
    const pick = pickNow(), [a, b] = st.compare ? st.compare.map(byId) : [];
    host.innerHTML = `<div class="shop shop-cat">${left(pick)}${a && b ? compare(a, b) : right(pick)}</div>`;
    cfg.preview(host.querySelector<HTMLElement>("[data-shop-stage]")!, pick);
    // The pictures after the paint, one a frame (a first draw can take a while; kept ones are instant).
    const gen = ++drawn, ims = [...host.querySelectorAll<HTMLImageElement>("[data-shop-thumb]")];
    const next = () => {
      if (gen !== drawn) return;
      const im = ims.shift();
      if (!im) return;
      const t = byId(im.dataset.shopThumb!)?.thumb?.();
      if (t) im.src = t;
      requestAnimationFrame(next);
    };
    requestAnimationFrame(next);
  }
  const focus = (sel: string) => host.querySelector<HTMLElement>(sel)?.focus({ preventScroll: true });
  const onClick = (e: Event) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("button");
    if (!t || !host.contains(t)) return;
    const d = t.dataset, was = st.open;
    st.open = "";
    if (d.shopOpen) return (st.open = was === d.shopOpen ? "" : (d.shopOpen as CatalogueState["open"])), draw(), focus(st.open ? `[data-shop-set="${d.shopOpen}"][aria-checked=true]` : `[data-shop-open="${d.shopOpen}"]`);
    if (d.shopSet) {
      if (d.shopSet === "slot") st.slot = +d.v!;
      else (st[d.shopSet as F] = d.v!), (st.shown = 0);
      return draw(), focus(`[data-shop-open="${d.shopSet}"]`);
    }
    if (d.shopPick) return (st.pick = d.shopPick), (st.compare = null), draw(), cfg.say?.(`${byId(d.shopPick)!.full} on the turntable`), focus(`[data-shop-pick="${d.shopPick}"]`);
    if (d.shopCmp) return (st.compare = d.shopCmp.split(",") as [string, string]), draw(), focus("[data-shop-back]");
    if (d.shopBack !== undefined) return (st.compare = null), draw(), focus("[data-shop-cmp]");
    if (d.shopMore !== undefined) {
      const was = Math.min(filtered(all(), st).length, st.shown || cfg.page);
      st.shown = was + cfg.page;
      draw();
      return focus(`.shop-cat-grid > li:nth-child(${was + 1}) [data-shop-pick]`);
    }
    if (d.shopBuy) {
      // (Bought, the destination goes back to the first empty slot: the game redraws, its state changed.)
      const s = slotNow().s;
      st.slot = -1;
      const why = cfg.buy(byId(d.shopBuy)!, s);
      if (why) (st.slot = s.index), cfg.say?.(why);
      return;
    }
    if (was) draw();
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && st.open) { const k = st.open; st.open = ""; draw(); focus(`[data-shop-open="${k}"]`); e.stopPropagation(); } };
  host.addEventListener("click", onClick);
  host.addEventListener("keydown", onKey);
  draw();
  return { update: draw, state: st, destroy: () => (drawn++, host.removeEventListener("click", onClick), host.removeEventListener("keydown", onKey)) };
}
