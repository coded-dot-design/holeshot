// LET'S RIDE, the shell's ride page (owner's design, 2026-11-19): the title row (your bike), four
// segmented tabs (Race · Endless · Free Ride · Track Day), each a "Choose a …" list of destinations,
// then a WITH FRIENDS card (its Play online opens the room card on the tab's kind) and the controls
// strip. Built only from the shop's pieces (./shop/): the page adds layout (./ride.css). Strings in, a
// string out, like ./series-ui.ts: the shell (./game.ts) owns the clicks (`data-rtab`, `data-mode`,
// `data-endless`, `data-map`, `data-circuit`, `data-go`, `data-venue`, `data-olkind` on `.ol-open`)
// and passes its header. Every number comes from the game: bests, best laps, seats, the online bonus.
import { BIOMES } from "./modes/desert/track.ts";
import { FREE_MAPS, FREE_SX, TRACK_DAY_MAPS } from "./modes/index.ts";
import type { Venue } from "./modes/race/venue.ts";
import { K_ENDLESS, K_JAM, K_RACE, K_TRACKDAY, SEATS } from "./net.ts";
import { ONLINE } from "./data/economy.ts";
import { KEYS } from "./data/controls.ts";
import { btn, card, esc, figure, footbar, heading, list, row, seg, title } from "./shop/index.ts";

export const VENUES: { id: Venue; name: string; where: string }[] = [
  { id: "mx", name: "MX", where: "Outdoor" },
  { id: "sx", name: "SX", where: "Stadium" },
];
export type RideTab = "race" | "endless" | "free" | "day";
export const RIDE_TABS: [RideTab, string][] = [["race", "Race"], ["endless", "Endless"], ["free", "Free Ride"], ["day", "Track Day"]];

export interface RideView {
  /** The tab shown. */
  tab: RideTab;
  /** The rider's bike: "Yamori Yowler 125 2T" and its plate. */
  bike: string;
  number: number;
  /** Each endless ground's best distance, in the rider's units ("desert", …, "city", "mashup"). */
  best: (key: string) => string;
  /** Track Day: the rider's best lap on a circuit ("0:18.4"), or "" for none. */
  lap: (circuit: string) => string;
  /** Test credits: online is off. */
  inf: boolean;
  note: string;
}

// The page's words (the owner's design); a destination's id → [name, line].
const WORDS: Record<string, [string, string]> = {
  desert: ["Endless Desert", "Dunes, bowls and natural kickers."],
  quarry: ["Deep Quarry", "Terraced faces, ledges and hill climbs."],
  forest: ["Endless Woods", "Wooded hills, log jumps and rock gardens."],
  "night-park": ["Night Park", "An open jump park with doubles and rollers."],
  city: ["Endless Wheelie City", "Open roads, towns and a neon patrol."],
  mashup: ["Endless Mashup", "One ride through the city, dunes, quarry and park."],
  "f:neon-park": ["Neon Loop", "Doubles, whoops, triple and tabletop."],
  "f:dune-sea": ["Dune Sea", "Open dunes, ridgelines and kickers."],
  "f:quarry": ["The Quarry", "Drop from the rim and climb the faces."],
  "f:forest": ["Forest Enduro", "Single track through roots and rocks."],
  "f:night-park": ["Night Park", "Jump line, wall ride and step-down."],
  "sx-floor": ["Stadium Floor", "Neon Dome · rhythm doubles and hairpins."],
  "sx-volt-floor": ["Volt Floor", "Volt Arena · tabletop, whoops and tight triple."],
  bigair: ["Big Air", "One minute of tricks. Five judges score the run."],
  "td-meridian": ["Meridian Ring", "Fast, flowing circuit with a long straight and a flat-out S."],
  "td-knotworks": ["Knotworks", "Two chicanes, a hairpin and a run of square corners."],
  "td-bottlecap": ["Bottlecap", "Tight kart circuit with two hairpins and a hook."],
};
/** A destination's words; the game's own name (title case) if the page has none. */
const words = (id: string, name: string, line: string): [string, string] => WORDS[id] ?? [name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()), line];

/** A destination: the whole row is the key. */
const dest = (attrs: string, w: [string, string], end = "", art = "") => row({ tag: "button", attrs: `type="button" ${attrs}`, title: esc(w[0]), sub: esc(w[1]), end: end || undefined, art: art || undefined, go: true });
/** A race row: its name and line, the MX · Outdoor and SX · Stadium keys. */
const venues = (name: string, line: string, attrs: string) =>
  row({ tag: "div", title: esc(name), sub: esc(line), end: `<span class="dh-venues" role="group" aria-label="${esc(name)}: MX or SX">${VENUES.map((v) => btn(`${v.name} · ${v.where}`, `${attrs} data-venue="${v.id}" aria-label="${esc(name)}, ${v.name} ${v.where.toLowerCase()}"`, false, "shop-btn-tile")).join("")}</span>` });
/** The WITH FRIENDS card: what the tab rides together, its line, seats and pay, Play online (the room card on `kind`). */
function friends(kind: number, name: string, line: string, inf: boolean) {
  const meta = `Up to ${SEATS} · ×${ONLINE.bonus}`;
  const say = inf ? "Off with test credits: take ?credits=inf off the address to ride online." : line;
  return `<h2 class="shop-eyebrow dh-rfh">With friends</h2>${card(`<div class="dh-rf-t"><b class="shop-h3">${esc(name)}</b><p class="shop-sub">${esc(say)}</p></div><small class="shop-meta">${esc(meta)}</small>${btn("Play online →", `data-olkind="${kind}"${inf ? " disabled" : ""}`, false, "ol-open dh-olgo")}`, "shop-tint dh-rf")}`;
}
/** The controls strip, from the one source (./data/controls.ts): each binding's letter keys (the arrows
 *  and the full card live in ⚙ → CONTROLS · HOW TO), in words: the page is the game's own, no links. */
const strip = () => KEYS.flatMap((g) => g.rows).map(([ks, what]) => {
  const k = ks.filter((x) => !/^[↑↓←→]$/.test(x));
  return `<span><kbd>${esc(k.includes("+") ? k.join("") : k.join("/"))}</kbd> ${esc(what.toLowerCase())}</span>`;
}).join("");

/** The LET'S RIDE page (`head`: the shell's header with ← Garage). */
export function rideCard(head: string, v: RideView) {
  const best = (k: string) => figure("Best", v.best(k).toLowerCase());
  let body: string;
  if (v.tab === "race")
    body = heading("Choose a race") + `<p class="shop-sub">Race three rivals. Places pay.</p>`
      + `<div class="shop-rows dh-rlist">${venues("Single race", "Three laps against rivals on stock bikes in your class.", `data-mode="race"`)}${venues("Series", "Four to six rounds for points and a championship title.", `data-go="series"`)}</div>`
      + friends(K_RACE, "Challenge your friends", "Race friends on an outdoor MX track. Each rider brings their own garage bike. SX is solo for now.", v.inf);
  else if (v.tab === "endless")
    body = heading("Choose a world") + `<p class="shop-sub">Ride as far as you can. Pause and select End &amp; Bank to finish.</p>`
      + `<div class="shop-rows dh-rgrid">${BIOMES.map((b) => dest(`data-endless="${b.id}"`, words(b.id, b.name, b.blurb), best(b.id))).join("")}${dest(`data-mode="endcity"`, words("city", "", ""), best("city"))}${dest(`data-mode="mashup"`, words("mashup", "", ""), best("mashup"))}</div>`
      + friends(K_ENDLESS, "Ride Out", "Meet up in an endless world or roam Wheelie City together.", v.inf);
  else if (v.tab === "free")
    body = heading("Choose a spot") + `<p class="shop-sub">Practice at your own pace, or enter Big Air for a judged run.</p>`
      + `<div class="shop-rows dh-rgrid">${FREE_MAPS.map((m) => dest(`data-map="${m.id}"`, words("f:" + m.id, m.name, m.blurb), "", `<canvas class="dh-thumb" data-prev="${m.id}" aria-hidden="true"></canvas>`)).join("")}${FREE_SX.map((m) => dest(`data-map="${m.id}" data-venue="sx"`, words(m.id, m.name, m.blurb))).join("")}${dest(`data-mode="bigair"`, words("bigair", "", ""))}</div>`
      + friends(K_JAM, "Jam with your friends", "Choose a Free Ride jam or a Big Air showdown. Highest score wins.", v.inf);
  else
    body = heading("Choose a circuit") + `<p class="shop-sub">Three laps on asphalt against three rivals. Each circuit keeps your best lap.</p>`
      + list(TRACK_DAY_MAPS.map((m) => dest(`data-circuit="${m.id}"`, words(m.id, m.name, m.blurb), figure("", v.lap(m.id)))), ["Road circuit", "Best lap"], "Road circuits")
      + friends(K_TRACKDAY, "Track Day Online", "Pick a road circuit and ride three laps with friends.", v.inf);
  const keys = footbar("Controls", strip(), 'aria-label="Controls"');
  return `<div class="dh-card dh-ride shop" data-screen="ride" data-tab="${v.tab}">${head}<div class="dh-rwrap"><div class="dh-rtitle"><h1 class="shop-h1">Let’s Ride</h1>${title({ maker: "Your bike", kind: `#${v.number}`, name: v.bike, small: true })}</div><div class="dh-rtabs">${seg(RIDE_TABS, v.tab, "rtab", "Ways to ride")}</div><section class="dh-rbody" aria-label="${esc(RIDE_TABS.find((t) => t[0] === v.tab)![1])}">${body}</section>${v.note ? `<p class="shop-sub dh-note" role="status">${esc(v.note)}</p>` : ""}<div class="dh-keys">${keys}</div></div></div>`;
}
