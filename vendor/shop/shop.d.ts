// Generated: do not edit.
/** Escapes text for HTML. */
export declare const esc: (s: string) => string;
/** A whole number with thousands separators: 1,500. */
export declare const num: (n: number) => string;
/** A card (panel): `card(body)`; `card(body, "shop-soft")` for the tinted note card ("No crash damage"). */
export declare const card: (body: string, cls?: string, attrs?: string) => string;
/** A section heading with an optional right-hand meta: `heading("Bike condition")`, `heading("Bike paint", "22 schemes")`. */
export declare const heading: (title: string, meta?: string, level?: number) => string;
/** The big two-way toggle: `seg([["bike","Parts & Mods"],["look","Paint & Kit"]], ui.tab, "gtab", "Garage")`. */
export declare const seg: (items: readonly (readonly [string, string, string?])[], on: string, key: string, label: string) => string;
/** Underline tabs: `tabs([["parts","Condition"],…], ui.sub, "gsub", "Parts and mods")`; `big` for the header's Garage/Showroom. */
export declare const tabs: (items: readonly (readonly [string, string, string?])[], on: string, key: string, label: string, big?: boolean) => string;
/** A stat tile: `stat("0–30 mph", "0.88 s")`; with a change `stat("Top speed", "64 mph", { text: "−2 mph", good: false })`, or a before → after `stat(l, "0.88 s", null, "0.86 s")`. */
export declare const stat: (label: string, value: string, delta?: {
    text: string;
    good: boolean | null;
} | null, next?: string) => string;
/** A row of stat tiles: `stats([stat(…), stat(…), stat(…)], "Pace, measured")`; `small` for the showroom cards' row. */
export declare const stats: (tiles: string[], label: string, small?: boolean) => string;
/** A bar alone (0..1): `meter(0.9)`; `state` "worn" | "risk" | "failed" | "low" recolours it. */
export declare const meter: (v: number, state?: string, from?: number) => string;
/** A labelled bar row: `barRow({ label: "Tyres", sub, v: 0.9, action: price(…) })`; `attrs` go on the row. */
export declare const barRow: (o: {
    label: string;
    sub?: string;
    v: number;
    state?: string;
    tag?: string;
    action?: string;
    attrs?: string;
}) => string;
/** A list of bar rows, optionally under column heads: `bars(rows, ["Component", "Condition"])`; `loose` spaces each row as its own card (crash damage). */
export declare const bars: (rows: string[], head?: [string, string], loose?: boolean) => string;
/** Compact bars (ride feel, a card's Pull/Top/Light): `feel([["Pull", 0.36], …], 2)` in `cols` columns; a third item "hot" paints the bar pink. */
export declare const feel: (rows: [string, number, string?][], cols?: number) => string;
/** A price key: `price({ label: "Service", price: 80, attrs: 'data-service="chain"' })` → "Service · 80"; `done` shows a disabled state ("At 100%"); short of credits it is disabled. */
export declare const price: (o: {
    label: string;
    price?: number;
    credits?: number;
    attrs?: string;
    done?: string;
    go?: boolean;
    wide?: boolean;
    icon?: string;
}) => string;
/** A plain key (Cancel, + Add bike, Select bike, Compare bikes): `btn("Cancel", "data-untry")`; `on` marks the chosen one. */
export declare const btn: (label: string, attrs?: string, on?: boolean, cls?: string, ico?: string) => string;
/** The "N more credits needed" line under a price key: `need(1500, 714)` (empty when you have enough). */
export declare const need: (pr: number, credits: number) => string;
/** A popover menu (tyre compound, paint menu, filters): `menu({ title: "Tyre compound", items: [{ label: "Soft", meta: "145 credits", on, attrs }] })`. */
export declare const menu: (o: {
    title?: string;
    items: {
        label: string;
        meta?: string;
        on?: boolean;
        attrs?: string;
        icon?: string;
    }[];
    label: string;
    cls?: string;
}) => string;
/** A dropdown/filter key that opens a menu: `drop("Paint scheme", 'data-gmenu="paint"', open)` (tinted while open); `"shop-drop-text"` for the in-line text kind ("Hard compound ▾"). */
export declare const drop: (label: string, attrs: string, open?: boolean, cls?: string, ico?: string) => string;
/** A check toggle ("Owned only"): `check("Owned only", on, "data-owned")`. */
export declare const check: (label: string, on: boolean, attrs: string) => string;
/** A sheet: a popover on desktop, a bottom sheet with a grabber on phones: `sheet({ title: "My Bikes", sub, body, close: "data-bays" })`. */
export declare const sheet: (o: {
    title: string;
    sub?: string;
    body: string;
    close: string;
    label?: string;
    cls?: string;
}) => string;
/** A list row (a bay, a service log line, an upgrade): `row({ eyebrow: "Bay 1", title: "Yowler 125 2T  #7", end: "RIDES NEXT", on: true })`.
 *  `sub` is a line under the title, `art` a picture before it (a map's thumbnail); `tag: "button"` (with
 *  `type="button"` in attrs) makes the whole row a key, and `go` adds its chevron (a destination). */
export declare const row: (o: {
    eyebrow?: string;
    title: string;
    sub?: string;
    art?: string;
    mid?: string;
    end?: string;
    on?: boolean;
    attrs?: string;
    tag?: string;
    go?: boolean;
}) => string;
/** A number with its label above it (a row's end: BEST 1.52 mi): `figure("Best", "1.52 mi")`; an empty value shows "—". */
export declare const figure: (label: string, value: string) => string;
/** Rows in one panel, ruled between, under optional column heads (Track Day's circuits): `list(rows, ["Road circuit", "Best lap"], "Circuits")`. */
export declare const list: (rows: string[], head: [string, string] | null, label: string) => string;
/** A table: `table(["Event", "Work completed", "Credits"], [["47", "Exhaust stage 2 fitted", "1,250"]])` (the service log); cells are HTML. */
export declare const table: (head: string[], rows: string[][], label: string) => string;
/** A grid tile (paint scheme, helmet, outfit): `tile({ name, art: swatch(a, b), price: 60, equipped, on, attrs })`; `big` for the art tiles (helmets, outfits). */
export declare const tile: (o: {
    name: string;
    art: string;
    price?: number;
    equipped?: boolean;
    owned?: boolean;
    on?: boolean;
    attrs?: string;
    big?: boolean;
}) => string;
/** A two-colour swatch band (a scheme's main and second colour): `swatch("#ff8a1f", "#14122a")`. */
export declare const swatch: (a: string, b?: string) => string;
/** A grid of tiles: `grid(tiles, 4)`. */
export declare const grid: (tiles: string[], cols: number, label: string) => string;
/** Chips (the rider's customise keys): `chips([btn(…), …], "Customize rider")`. */
export declare const chips: (keys: string[], label: string) => string;
/** The bike's title block: `title({ maker: "Yamori", kind: "2-stroke", name: "Yowler 125 2T", number: 7 })`; `eyebrow` replaces maker / kind (SHOWROOM PREVIEW). */
export declare const title: (o: {
    maker?: string;
    kind?: string;
    eyebrow?: string;
    name: string;
    number?: number;
    small?: boolean;
}) => string;
/** The turntable frame with ‹ › keys either side: `turntable("<canvas-slot></canvas-slot>", "data-turn")` (the keys carry `data-turn="-1"` / `"1"`); `arrows` false for one item; `extra` overlays (a chip). */
export declare const turntable: (inner: string, key?: string, label?: string, arrows?: boolean, extra?: string) => string;
/** A small chip over a frame's corner (the turntable's BACKDROP · Auto): `chip("Backdrop", "Auto", 'data-backdrop')`. */
export declare const chip: (label: string, value: string, attrs: string) => string;
/** A small pick over a frame's corner (the turntable's backdrop: Auto · Track · Sunset): `chipSeg("Backdrop", [["auto", "Auto"], …], "auto", "backdrop")` (the keys carry `data-backdrop="auto"`…). Each key is a 44 px hit area round a small pill; `label` names the group for screen readers; `cls` places it (`shop-chipseg-top`: the top-left corner). */
export declare const chipSeg: (label: string, items: readonly (readonly [string, string])[], on: string, key: string, cls?: string) => string;
/** The main call to action: `cta("LET'S RIDE", 'class-extra', "Race · Endless · Free ride · Track day")`; `cls` adds the screen's hook class. */
export declare const cta: (label: string, cls?: string, sub?: string, attrs?: string) => string;
/** Stars: `stars(2)` → ★★☆☆ (of 4, with its words for screen readers). */
export declare const stars: (n: number, of?: number) => string;
/** A small pill tag: `pill("Preview")`, `pill("Rides next", "plain")`; `cls` adds a hook class. */
export declare const pill: (t: string, kind?: string, cls?: string) => string;
/** A bar along the bottom of a panel (the pinned preview: "Previewing Gridline" · Cancel · Buy): `footbar("Previewing Gridline", keys)`. */
export declare const footbar: (text: string, keys: string, attrs?: string) => string;
/** The icon names (tests, a game's own check). */
export declare const ICONS: string[];
/** A line icon beside a label: `icon("tyre")` (aria-hidden; the label says it). */
export declare const icon: (name: string, cls?: string) => string;
/** An icon on a small tinted square (a part, an upgrade, a log line): `badge("chain")`. */
export declare const badge: (name: string) => string;
/** Stages as diamonds, filled vs empty (◆◆◇): `stages(2, 3)`; `next` outlines the stage a preview
 *  would fit; every stage fitted reads as maxed (data-max). Its words are for screen readers. */
export declare const stages: (n: number, of: number, next?: boolean, word?: string) => string;
/** A wear tile (a part as a card: icon, name, its tag, the bar at a fixed width, the %, the key on the
 *  right): `wearTile({ label: "Tyres", icon: "tyre", v: 0.9, action: price(…) })`. */
export declare const wearTile: (o: {
    label: string;
    icon?: string;
    sub?: string;
    v: number;
    state?: string;
    tag?: string;
    action?: string;
    attrs?: string;
}) => string;
/** A wear tile that is itself the key (the Board UI key's raise): a part that needs work stands up with
 *  its price chip and one press does the work (`verb`: Service, Rebuild, Fix…); done, it sits pressed in,
 *  calm and disabled. Short of credits it stays raised but disabled, with what's needed. `extra` is a
 *  small control of its own (a tyre compound menu) laid over the tile, outside the key, so it never
 *  presses it. `pct` replaces the % (crash damage says "24% damage"); `from` animates the bar from the
 *  old value after a press; `cur` prefixes the price chip (a game's credit mark). */
export declare const wearKey: (o: {
    label: string;
    icon?: string;
    v: number;
    state?: string;
    tag?: string;
    verb: string;
    price?: number;
    credits: number;
    attrs: string;
    done?: boolean;
    doneWord?: string;
    pct?: string;
    extra?: string;
    from?: number;
    cur?: string;
    li?: string;
}) => string;
/** A key tile: the whole tile is one raised key, the Board UI key's base straight down; one press does
 *  its thing. `down` sits it pressed in (the work done, the option fitted, the one picked) and `pick`
 *  rings it in the go colour (the chosen one); `off` disables it (raised but short of credits). `body`
 *  is its content: words, a picture, a price chip; never another key (put those beside it). */
export declare const keyTile: (o: {
    body: string;
    attrs?: string;
    label?: string;
    down?: boolean;
    pick?: boolean;
    off?: boolean;
    pressed?: boolean;
    cls?: string;
}) => string;
/** A price chip on a key tile ("◈ 80"): `chipPrice(80, "◈ ")`; `short` greys it (can't pay). */
export declare const chipPrice: (n: number, cur?: string, short?: boolean) => string;
/** An option as a key tile (a tuning step): the big line is its price or its state (Fitted ✓, Owned,
 *  Free), the small line its name; fitted, it is pressed in and ringed. */
export declare const optKey: (o: {
    name: string;
    state: "fitted" | "owned" | "free" | "price";
    price?: number;
    credits: number;
    attrs: string;
    cur?: string;
    words?: {
        fitted?: string;
        owned?: string;
        free?: string;
    };
}) => string;
/** Words the flows use; a game overrides any of them (its language, its tone). */
export interface ShopCopy {
    credits: string;
    equipped: string;
    owned: string;
    cancel: string;
    buy: string;
    need: string;
}
export declare const COPY: ShopCopy;
/** One thing you can own and wear/fit/paint: a scheme, a helmet, an outfit, a tank skin. */
export interface Item {
    id: string;
    name: string;
    art: string;
    price: number;
    owned?: boolean;
    equipped?: boolean;
    attrs: string;
}
/** A slot (paint scheme, plastics, helmet…): the menu row and its count line. */
export interface Slot {
    id: string;
    name: string;
    meta: string;
    attrs: string;
    icon?: string;
}
/** SLOTS → ITEM GRID (paged) → PREVIEW → BUY / CANCEL. `page` is 0-based; `trying` the item on the stage
 *  (pinned, not yet owned); `open` shows the slot menu; `big` uses the art tiles (helmets, outfits). */
export declare function itemGrid(o: {
    title: string;
    count: string;
    slots?: Slot[];
    slot?: string;
    open?: boolean;
    menuAttrs?: string;
    note?: string;
    ownedOnly?: {
        on: boolean;
        attrs: string;
    };
    items: Item[];
    page: number;
    per: number;
    cols: number;
    big?: boolean;
    pageAttrs: (page: number) => string;
    pageWord: string;
    trying?: Item | null;
    credits: number;
    cancelAttrs: string;
    buyAttrs: string;
    empty?: string;
    copy?: ShopCopy;
}): string;
/** A thing that wears and gets serviced (a part, a track, armour): its condition 0..1 and its key. */
export interface Wear {
    label: string;
    icon?: string;
    pct?: string;
    sub?: string;
    v: number;
    state?: string;
    tag?: string;
    key: {
        label: string;
        price?: number;
        done?: string;
        attrs: string;
    };
    attrs?: string;
}
/** CONDITION: rows of bars with a price key each; `loose` lays each row out as its own card. */
export declare const condition: (rows: Wear[], credits: number, head?: [string, string], loose?: boolean) => string;
/** An upgrade line: name, its state in words ("Stage 1 fitted"), and its price or a tick. */
export interface Upgrade {
    id: string;
    name: string;
    state: string;
    price?: number;
    attrs: string;
    icon?: string;
    stage?: [number, number];
}
/** UPGRADES: the list, and the one under preview with its stats before → after. */
export declare function upgrades(o: {
    items: Upgrade[];
    on?: string;
    preview?: UpgradePreview | null;
    credits: number;
    copy?: ShopCopy;
}): string;
/** An upgrade under preview: its stats before → after and its key. */
export interface UpgradePreview {
    name: string;
    blurb: string;
    stats: [string, string, string][];
    key: {
        label: string;
        price: number;
        attrs: string;
    };
}
/** One bay (garage spot, hangar, wardrobe slot): what's in it and its key. */
export interface Bay {
    label: string;
    name?: string;
    on?: boolean;
    end: string;
    attrs?: string;
}
/** OWNED: the bays sheet with its expansion (the next bay for sale, or none). Desktop popover, phone bottom sheet. */
export declare function baysSheet(o: {
    title: string;
    sub: string;
    bays: Bay[];
    expand?: {
        title: string;
        line: string;
        key: {
            label: string;
            price: number;
            attrs: string;
        };
    } | null;
    credits: number;
    close: string;
    empty: string;
}): string;
/** COMPARE: stats side by side for two or more things; `better` says which way wins per row (1 up, −1 down, 0 none). */
export declare function compare(o: {
    names: string[];
    rows: {
        label: string;
        values: string[];
        nums?: number[];
        better?: 1 | -1 | 0;
    }[];
    label: string;
}): string;
/** CONDITION as cards: a tile per part (icon, name, tag, the bar at a fixed width, the %, the key on
 *  the right), in a grid that takes two columns where it has the room. */
export declare const wearGrid: (rows: Wear[], credits: number, label: string) => string;
/** UPGRADES as tiles: each mod a card (icon, name, its stages as diamonds with the next one outlined,
 *  its state, the next stage's price or MAXED), the one under preview marked; the preview below. */
export declare function upgradeGrid(o: {
    items: Upgrade[];
    on?: string;
    preview?: UpgradePreview | null;
    credits: number;
    maxed?: string;
    copy?: ShopCopy;
}): string;
/** One bay on the rail: a bike (its picture, name; `pick` the attrs that select it; `keys` any keys
 *  beside the tile, such as Sell) or an empty bay (`add`, its add key's attrs). */
export interface RailBay {
    label: string;
    name?: string;
    art?: string;
    on?: boolean;
    pick?: string;
    keys?: string;
    attrs?: string;
    add?: string;
}
/** MY BIKES as a rail: each bike a key tile (press it to ride it; the one that rides pressed in and
 *  ringed), then one side column: a single "+ Add bike" tile for every empty bay (its count) over the
 *  expansion, itself a key with its price. Part of the screen, not a popover; it wraps, never scrolls. */
export declare function bayRail(o: {
    title: string;
    line: string;
    bays: RailBay[];
    add: string;
    expand?: {
        title: string;
        line: string;
        key: {
            label: string;
            price: number;
            attrs: string;
        };
    } | null;
    credits: number;
    cur?: string;
    rides?: string;
    select?: string;
}): string;
/** CONDITION as keys: each part's tile is its own key (./ui.ts wearKey): raised when it needs work,
 *  pressed in when it doesn't. `just` names the key just pressed (its attrs) and the bar's old value,
 *  so the bar fills from there. */
export declare const wearKeys: (rows: Wear[], credits: number, label: string, o?: {
    cur?: string;
    just?: [string, number] | null;
    doneWord?: string;
}) => string;
/** A number the screen shows: its label, how to write it, and which way is better (for deltas). */
export interface StatDef {
    key: string;
    label: string;
    short?: string;
    better: "low" | "high";
    unit: string;
    digits: number;
}
/** One item in the catalogue. Every number is the game's own. */
export interface CatalogueItem {
    id: string;
    /** Brand and type (the eyebrow, "BRAND / TYPE"), the name, and the name with its brand. */
    brand: string;
    type: string;
    name: string;
    full: string;
    /** Tier (stars) of `max`. */
    tier: number;
    tierMax: number;
    price: number;
    blurb: string;
    /** 0..1 bars ("Pull 71%"); `tone` picks the bar's colour token. */
    bars: {
        label: string;
        v: number;
        tone?: "a" | "b";
    }[];
    /** Values by StatDef key (null: it never gets there). */
    stats: Record<string, number | null>;
    /** A picture (a URL), drawn lazily: `thumb()` is called for the cards on screen only. */
    thumb?: () => string;
}
/** The thing the player has now, to compare with. */
export interface CatalogueCurrent {
    name: string;
    stats: Record<string, number | null>;
}
/** A slot an item can go into (a bay, a garage spot): empty, or holding something (`holds`) that the
 *  purchase replaces (a trade-in: `credit` off the price). */
export interface CatalogueSlot {
    index: number;
    label: string;
    holds?: string;
    credit?: number;
    art?: string;
}
/** What buying `item` into `slot` takes: the cost, and why not (locked, the slot can't take it). */
export interface CatalogueOffer {
    cost: number;
    locked?: string;
}
export interface CatalogueConfig {
    /** Every item, in catalogue order. */
    items(): CatalogueItem[];
    /** The filters: each a facet of the items (its values in item order) with its "all" label. */
    filters: {
        key: "type" | "brand";
        all: string;
    }[];
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
    /** (Unused: every item the filters let through shows; kept so a game's config still fits.) */
    page?: number;
    /** The words (a game's voice; defaults are the shop's). */
    text?: Partial<typeof TEXT>;
    /** Told when something is announced (a screen reader line). */
    say?(s: string): void;
}
export declare const TEXT: {
    title: string;
    models: string;
    eyebrow: string;
    current: string;
    dest: string;
    empty: string;
    buy: string;
    trade: string;
    needed: string;
    credits: string;
    compare: string;
    compareWith: string;
    on: string;
    showing: string;
    of: string;
    more: string;
    compTitle: string;
    back: string;
    price: string;
    tier: string;
    types: string;
    brands: string;
    gains: string;
    over: string;
    sooner: string;
    same: string;
    noStats: string;
};
export interface CatalogueState {
    type: string;
    brand: string;
    shown: number;
    pick: string;
    slot: number;
    compare: [string, string] | null;
    open: "" | "type" | "brand" | "slot";
}
export declare const catalogueState: () => CatalogueState;
/** The distinct values of a facet, in item order. */
export declare const facet: (items: CatalogueItem[], k: "type" | "brand") => string[];
/** The items the filters let through. */
export declare const filtered: (items: CatalogueItem[], s: Pick<CatalogueState, "type" | "brand">) => CatalogueItem[];
/** A stat's change from `from` to `to`: its sign as better/worse and the words ("−0.03 s"). */
export declare function delta(d: StatDef, from: number | null, to: number | null): {
    dir: "up" | "down" | "same";
    text: string;
};
export declare const fmt: (d: StatDef, v: number | null) => string;
/** The comparison's one line: the first stat they differ on, said as the better one's gain
 *  ("Striker V4 gains 26 mph over the Crimson 250F", "… 0.42 s sooner than the …"). */
export declare function summary(a: CatalogueItem, b: CatalogueItem, stats: StatDef[], T?: {
    title: string;
    models: string;
    eyebrow: string;
    current: string;
    dest: string;
    empty: string;
    buy: string;
    trade: string;
    needed: string;
    credits: string;
    compare: string;
    compareWith: string;
    on: string;
    showing: string;
    of: string;
    more: string;
    compTitle: string;
    back: string;
    price: string;
    tier: string;
    types: string;
    brands: string;
    gains: string;
    over: string;
    sooner: string;
    same: string;
    noStats: string;
}): string;
/** Mount the screen in `host`; redraws on its own clicks and on `update()` (the game's state changed). */
export declare function mountCatalogue(host: HTMLElement, cfg: CatalogueConfig, st?: CatalogueState): {
    update: () => void;
    state: CatalogueState;
    destroy: () => void;
};
