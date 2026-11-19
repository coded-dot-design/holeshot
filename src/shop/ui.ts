// The shop's pieces (one source, no one-offs): small HTML-string functions over the tokens in
// ./ui.css, for any game's customise / store / upgrade / compare screens. Game-agnostic: no game
// import, every word and number comes in. Screens compose these and add layout only; a new look is
// a new variant here. Wrap a screen in an element with class "shop" (the tokens live there). `attrs` is raw attribute text (e.g. `data-service="chain"`), already escaped.
// Every key keeps the shell's routing: the click handler reads the data-* attributes it carries.
/** Escapes text for HTML. */
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/** A whole number with thousands separators: 1,500. */
export const num = (n: number) => Math.round(n).toLocaleString("en-US");

const at = (a = "") => (a ? " " + a : "");

/** A card (panel): `card(body)`; `card(body, "shop-soft")` for the tinted note card ("No crash damage"). */
export const card = (body: string, cls = "", attrs = "") => `<section class="shop-card${cls ? " " + cls : ""}"${at(attrs)}>${body}</section>`;

/** A section heading with an optional right-hand meta: `heading("Bike condition")`, `heading("Bike paint", "22 schemes")`. */
export const heading = (title: string, meta = "", level = 2) => `<div class="shop-heading"><h${level} class="shop-h${level}">${esc(title)}</h${level}>${meta ? `<small class="shop-meta">${esc(meta)}</small>` : ""}</div>`;

/** The big two-way toggle: `seg([["bike","Parts & Mods"],["look","Paint & Kit"]], ui.tab, "gtab", "Garage")`. */
export const seg = (items: readonly (readonly [string, string])[], on: string, key: string, label: string) =>
  `<nav class="shop-seg" aria-label="${esc(label)}">${items.map(([id, t]) => `<button type="button" class="shop-seg-k" data-${key}="${id}" aria-pressed="${id === on}">${esc(t)}</button>`).join("")}</nav>`;

/** Underline tabs: `tabs([["parts","Condition"],…], ui.sub, "gsub", "Parts and mods")`; `big` for the header's Garage/Showroom. */
export const tabs = (items: readonly (readonly [string, string])[], on: string, key: string, label: string, big = false) =>
  `<nav class="shop-tabs${big ? " shop-tabs-big" : ""}" aria-label="${esc(label)}">${items.map(([id, t]) => `<button type="button" class="shop-tab" data-${key}="${id}" aria-pressed="${id === on}">${esc(t)}</button>`).join("")}</nav>`;

/** A stat tile: `stat("0–30 mph", "0.88 s")`; with a change `stat("Top speed", "64 mph", { text: "−2 mph", good: false })`, or a before → after `stat(l, "0.88 s", null, "0.86 s")`. */
export const stat = (label: string, value: string, delta?: { text: string; good: boolean | null } | null, next = "") =>
  `<div class="shop-stat"><dt>${esc(label)}</dt><dd>${next ? `<span>${esc(value)}</span><i aria-hidden="true">→</i><b${next === value ? "" : " data-d"}>${esc(next)}</b>` : esc(value)}${delta ? `<em data-d="${delta.good === null ? "same" : delta.good ? "up" : "down"}">${esc(delta.text)}</em>` : ""}</dd></div>`;

/** A row of stat tiles: `stats([stat(…), stat(…), stat(…)], "Pace, measured")`; `small` for the showroom cards' row. */
export const stats = (tiles: string[], label: string, small = false) => `<dl class="shop-stats${small ? " shop-stats-s" : ""}" aria-label="${esc(label)}">${tiles.join("")}</dl>`;

/** A bar alone (0..1): `meter(0.9)`; `state` "worn" | "risk" | "failed" | "low" recolours it. */
export const meter = (v: number, state = "") => `<i class="shop-meter" style="--v:${Math.max(0, Math.min(1, v)).toFixed(3)}"${state ? ` data-state="${state}"` : ""}></i>`;

/** A labelled bar row: `barRow({ label: "Tyres", sub, v: 0.9, action: price(…) })`; `attrs` go on the row. */
export const barRow = (o: { label: string; sub?: string; v: number; state?: string; tag?: string; action?: string; attrs?: string }) =>
  `<li class="shop-barrow"${at(o.attrs)}><span class="shop-barrow-l"><b>${esc(o.label)}</b>${o.sub ?? ""}${o.tag ?? ""}</span>${meter(o.v, o.state)}<b class="shop-pct">${Math.round(o.v * 100)}%</b>${o.action ? `<span class="shop-barrow-a">${o.action}</span>` : ""}</li>`;

/** A list of bar rows, optionally under column heads: `bars(rows, ["Component", "Condition"])`; `loose` spaces each row as its own card (crash damage). */
export const bars = (rows: string[], head?: [string, string], loose = false) =>
  `<ul class="shop-bars${loose ? " shop-bars-loose" : ""}">${head ? `<li class="shop-colhead" aria-hidden="true"><span>${esc(head[0])}</span><span>${esc(head[1])}</span></li>` : ""}${rows.join("")}</ul>`;

/** Compact bars (ride feel, a card's Pull/Top/Light): `feel([["Pull", 0.36], …], 2)` in `cols` columns; a third item "hot" paints the bar pink. */
export const feel = (rows: [string, number, string?][], cols = 1) =>
  `<ul class="shop-feel" style="--cols:${cols}">${rows.map(([l, v, s]) => `<li><span>${esc(l)}</span>${meter(v, s)}<b>${Math.round(v * 100)}%</b></li>`).join("")}</ul>`;

/** A price key: `price({ label: "Service", price: 80, attrs: 'data-service="chain"' })` → "Service · 80"; `done` shows a disabled state ("At 100%"); short of credits it is disabled. */
export const price = (o: { label: string; price?: number; credits?: number; attrs?: string; done?: string; go?: boolean; wide?: boolean }) => {
  const short = o.price !== undefined && o.credits !== undefined && o.credits < o.price;
  const off = !!o.done || short;
  return `<button type="button" class="shop-btn${o.go ? " shop-btn-go" : ""}${o.wide ? " shop-btn-wide" : ""}"${at(o.attrs)}${off ? " disabled" : ""}${short ? " data-short" : ""}>${o.done ? esc(o.done) : `${esc(o.label)}${o.price !== undefined ? `<span class="shop-dot" aria-hidden="true">·</span><span class="shop-num">${num(o.price)}</span>` : ""}`}</button>`;
};
/** A plain key (Cancel, + Add bike, Select bike, Compare bikes): `btn("Cancel", "data-untry")`; `on` marks the chosen one. */
export const btn = (label: string, attrs = "", on = false, cls = "") => `<button type="button" class="shop-btn${cls ? " " + cls : ""}"${at(attrs)}${on ? ' aria-pressed="true"' : ""}>${esc(label)}</button>`;
/** The "N more credits needed" line under a price key: `need(1500, 714)` (empty when you have enough). */
export const need = (pr: number, credits: number) => (pr > credits ? `<p class="shop-need">${num(pr - credits)} more credits needed</p>` : "");

/** A popover menu (tyre compound, paint menu, filters): `menu({ title: "Tyre compound", items: [{ label: "Soft", meta: "145 credits", on, attrs }] })`. */
export const menu = (o: { title?: string; items: { label: string; meta?: string; on?: boolean; attrs?: string }[]; label: string; cls?: string }) =>
  `<div class="shop-menu${o.cls ? " " + o.cls : ""}" role="menu" aria-label="${esc(o.label)}">${o.title ? `<b class="shop-h3">${esc(o.title)}</b>` : ""}${o.items.map((i) => `<button type="button" class="shop-menu-i" role="menuitemradio" aria-checked="${!!i.on}"${at(i.attrs)}><span>${esc(i.label)}${i.on ? ' <i aria-hidden="true">✓</i>' : ""}</span>${i.meta ? `<small>${esc(i.meta)}</small>` : ""}</button>`).join("")}</div>`;

/** A dropdown/filter key that opens a menu: `drop("Paint scheme", 'data-gmenu="paint"', open)` (tinted while open); `"shop-drop-text"` for the in-line text kind ("Hard compound ▾"). */
export const drop = (label: string, attrs: string, open = false, cls = "") => `<button type="button" class="shop-drop${cls ? " " + cls : ""}" aria-haspopup="menu" aria-expanded="${open}"${at(attrs)}>${esc(label)} <i aria-hidden="true">▾</i></button>`;

/** A check toggle ("Owned only"): `check("Owned only", on, "data-owned")`. */
export const check = (label: string, on: boolean, attrs: string) => `<button type="button" class="shop-btn shop-check" role="checkbox" aria-checked="${on}"${at(attrs)}><i aria-hidden="true">${on ? "✓" : ""}</i>${esc(label)}</button>`;

/** A sheet: a popover on desktop, a bottom sheet with a grabber on phones: `sheet({ title: "My Bikes", sub, body, close: "data-bays" })`. */
export const sheet = (o: { title: string; sub?: string; body: string; close: string; label?: string; cls?: string }) =>
  `<div class="shop-sheet${o.cls ? " " + o.cls : ""}" role="dialog" aria-label="${esc(o.label ?? o.title)}"><i class="shop-grab" aria-hidden="true"></i><div class="shop-sheet-h"><b class="shop-h2">${esc(o.title)}</b><button type="button" class="shop-x" ${o.close} aria-label="Close">✕</button></div>${o.sub ? `<p class="shop-sub">${esc(o.sub)}</p>` : ""}${o.body}</div>`;

/** A list row (a bay, a service log line, an upgrade): `row({ eyebrow: "Bay 1", title: "Yowler 125 2T  #7", end: "RIDES NEXT", on: true })`; `cells` makes a table row instead. */
export const row = (o: { eyebrow?: string; title: string; mid?: string; end?: string; on?: boolean; attrs?: string; tag?: string }) =>
  `<${o.tag ?? "li"} class="shop-row"${o.on ? " data-on" : ""}${at(o.attrs)}><span class="shop-row-t">${o.eyebrow ? `<small class="shop-eyebrow">${esc(o.eyebrow)}</small>` : ""}<b>${o.title}</b></span>${o.mid !== undefined ? `<span class="shop-row-m">${o.mid}</span>` : ""}${o.end !== undefined ? `<span class="shop-row-e">${o.end}</span>` : ""}</${o.tag ?? "li"}>`;
/** A table: `table(["Event", "Work completed", "Credits"], [["47", "Exhaust stage 2 fitted", "1,250"]])` (the service log); cells are HTML. */
export const table = (head: string[], rows: string[][], label: string) =>
  `<table class="shop-table" aria-label="${esc(label)}"><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

/** A grid tile (paint scheme, helmet, outfit): `tile({ name, art: swatch(a, b), price: 60, equipped, on, attrs })`; `big` for the art tiles (helmets, outfits). */
export const tile = (o: { name: string; art: string; price?: number; equipped?: boolean; owned?: boolean; on?: boolean; attrs?: string; big?: boolean }) =>
  `<button type="button" class="shop-tile${o.big ? " shop-tile-big" : ""}"${o.on ? ' aria-pressed="true"' : ' aria-pressed="false"'}${o.equipped ? " data-eq" : ""}${at(o.attrs)}><span class="shop-tile-art">${o.art}</span><b>${esc(o.name)}</b><small${o.equipped || o.owned || !o.price ? " data-own" : ""}>${o.equipped ? "✓ Equipped" : o.owned || !o.price ? "Owned" : `${num(o.price)} credits`}</small></button>`;
/** A two-colour swatch band (a scheme's main and second colour): `swatch("#ff8a1f", "#14122a")`. */
export const swatch = (a: string, b = a) => `<i class="shop-swatch" style="--a:${a};--b:${b}"></i>`;
/** A grid of tiles: `grid(tiles, 4)`. */
export const grid = (tiles: string[], cols: number, label: string) => `<div class="shop-grid" style="--cols:${cols}" role="group" aria-label="${esc(label)}">${tiles.join("")}</div>`;
/** Chips (the rider's customise keys): `chips([btn(…), …], "Customize rider")`. */
export const chips = (keys: string[], label: string) => `<div class="shop-chips" role="group" aria-label="${esc(label)}">${keys.join("")}</div>`;

/** The bike's title block: `title({ maker: "Yamori", kind: "2-stroke", name: "Yowler 125 2T", number: 7 })`; `eyebrow` replaces maker / kind (SHOWROOM PREVIEW). */
export const title = (o: { maker?: string; kind?: string; eyebrow?: string; name: string; number?: number; small?: boolean }) =>
  `<div class="shop-title${o.small ? " shop-title-s" : ""}"><small class="shop-eyebrow">${o.eyebrow ? esc(o.eyebrow) : `${esc(o.maker ?? "")}<i aria-hidden="true">/</i>${esc(o.kind ?? "")}`}</small><b class="shop-name">${esc(o.name)}${o.number !== undefined ? `<span class="shop-no">#${o.number}</span>` : ""}</b></div>`;

/** The turntable frame with ‹ › keys either side: `turntable("<canvas-slot></canvas-slot>", "data-turn")` (the keys carry `data-turn="-1"` / `"1"`). */
export const turntable = (inner: string, key = "data-turn", label = "bike") =>
  `<div class="shop-turn">${inner}<button type="button" class="shop-arrow shop-arrow-l" ${key}="-1" aria-label="Previous ${esc(label)}">‹</button><button type="button" class="shop-arrow shop-arrow-r" ${key}="1" aria-label="Next ${esc(label)}">›</button></div>`;

/** The main call to action: `cta("LET'S RIDE", 'class-extra', "Race · Endless · Free ride · Track day")`; `cls` adds the screen's hook class. */
export const cta = (label: string, cls = "", sub = "", attrs = "") =>
  `<div class="shop-cta-w"><button type="button" class="shop-cta${cls ? " " + cls : ""}"${at(attrs)}><b>${esc(label)}</b><i aria-hidden="true">→</i></button>${sub ? `<small class="shop-cta-sub">${sub}</small>` : ""}</div>`;

/** Stars: `stars(2)` → ★★☆☆ (of 4, with its words for screen readers). */
export const stars = (n: number, of = 4) => `<span class="shop-stars" role="img" aria-label="Tier ${n} of ${of}">${"★".repeat(n)}<i>${"☆".repeat(Math.max(0, of - n))}</i></span>`;

/** A small pill tag: `pill("Preview")`, `pill("Rides next", "plain")`; `cls` adds a hook class. */
export const pill = (t: string, kind = "", cls = "") => `<b class="shop-pill${cls ? " " + cls : ""}"${kind ? ` data-kind="${kind}"` : ""}>${esc(t)}</b>`;

/** A bar along the bottom of a panel (the pinned preview: "Previewing Gridline" · Cancel · Buy): `footbar("Previewing Gridline", keys)`. */
export const footbar = (text: string, keys: string, attrs = "") => `<div class="shop-foot"${at(attrs)}><b>${text}</b><span>${keys}</span></div>`;
