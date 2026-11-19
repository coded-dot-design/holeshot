// LET'S RIDE, the shell's ride page (owner, 2026-11-19): every way to ride in four groups, each a
// shelf of tiles with a one-line description. RACE (the SERIES first, then a single RACE, each MX
// outdoor or SX indoor), ENDLESS (each endless ground, Endless Wheelie City, the mashup to come),
// FREE RIDE (the maps, Big Air) and TRACK DAY (street bikes on road circuits, to come). Riding online
// sits in the groups it belongs to (MX only: SX is solo). Strings in, a string out, like ./series-ui.ts: the shell
// (./game.ts) owns the clicks (`data-mode`, `data-endless`, `data-map`, `data-go`, `data-venue`,
// `data-olkind` on `.ol-open`) and passes its header.
import { BIOMES } from "./modes/desert/track.ts";
import { FREE_SX, mode as modeOf } from "./modes/index.ts";
import { mapTiles } from "./modes/freeride/picker.ts";
import type { Venue } from "./modes/race/venue.ts";
import { K_ENDLESS, K_JAM, K_RACE } from "./net.ts";
import { esc } from "./html.ts";

export const VENUES: { id: Venue; name: string; where: string }[] = [
  { id: "mx", name: "MX", where: "OUTDOOR" },
  { id: "sx", name: "SX", where: "STADIUM" },
];

export interface RideView {
  /** The rider's bike in words ("MAKER MODEL · #7"). */
  bike: string;
  /** Each endless ground's best distance, in the rider's units ("desert", …, "city"). */
  best: (key: string) => string;
  /** Test credits: online is off. */
  inf: boolean;
  note: string;
}

const tile = (attrs: string, name: string, line: string, meta = "", off = false) => `<li><button type="button" class="bui-key dh-tile" ${attrs}${off ? " disabled" : ""}><b>${name}</b><small>${line}</small>${meta ? `<em>${meta}</em>` : ""}</button></li>`;
/** A tile with an MX / SX choice: two keys under its name. */
const venues = (name: string, line: string, attrs: (v: Venue) => string) => `<li class="dh-tile dh-vtile"><b>${name}</b><small>${line}</small><span class="dh-vkeys" role="group" aria-label="${name}: MX or SX">${VENUES.map((v) => `<button type="button" class="bui-key dh-vk" ${attrs(v.id)} data-venue="${v.id}" aria-label="${name}, ${v.name} ${v.where.toLowerCase()}"><b>${v.name}</b><small>${v.where}</small></button>`).join("")}</span></li>`;
const soon = (name: string, line: string) => tile(`data-soon`, name, line, "COMING SOON", true);
const online = (kind: number, line: string, inf: boolean) => tile(`data-olkind="${kind}"`, "ONLINE", inf ? "Off with test credits: take ?credits=inf off the address to ride online." : line, inf ? "TEST CREDITS ∞" : "UP TO 4 · ONLINE ×1.5", inf).replace("dh-tile", "dh-tile dh-oltile ol-open");
const group = (id: string, name: string, line: string, tiles: string) => `<section class="dh-grp" data-grp="${id}" aria-labelledby="grp-${id}"><header><h2 class="dh-grph" id="grp-${id}">${name}</h2><p class="dh-sub">${line}</p></header><ul class="dh-tiles">${tiles}</ul></section>`;

/** The LET'S RIDE card (`head`: the shell's header with ← GARAGE). */
export function rideCard(head: string, v: RideView) {
  const race = group("race", "RACE", "Three rivals, places pay: a championship of new tracks, or one race.",
    venues("SERIES", "Four to six rounds, a points table and a title: new outdoor tracks (MX) or the stadiums (SX).", () => `data-go="series"`)
    + venues("RACE", `${esc(modeOf("race").blurb)}`, () => `data-mode="race"`)
    + online(K_RACE, "Race up to three friends, each on their own garage bike (MX; SX is solo for now).", v.inf));
  const endless = group("endless", "ENDLESS", "No edge, no clock: ride as far as you can, then pause and END & BANK.",
    BIOMES.map((b, i) => tile(`data-endless="${b.id}"`, i ? b.name.replace(/^THE /, "") : "ENDLESS DESERT", esc(b.blurb), `BEST ${v.best(b.id)}`)).join("")
    + tile(`data-mode="endcity"`, "ENDLESS WHEELIE CITY", "Roads, towns and fields that never end. Wheelie, lose the neon patrol.", `BEST ${v.best("city")}`)
    + online(K_ENDLESS, "Roam an endless ground or the city together.", v.inf)
    + soon("MASHUP", "Every kind of riding in one run."));
  const free = group("free", "FREE RIDE", "No laps, no clock: air, wheelies and tricks pay a little.",
    mapTiles("dh-tile")
    + FREE_SX.map((m) => tile(`data-map="${m.id}" data-venue="sx"`, m.name, esc(m.blurb), "SX · STADIUM")).join("")
    + tile(`data-mode="bigair"`, "BIG AIR", esc(modeOf("bigair").blurb), "A MINUTE · FIVE JUDGES")
    + online(K_JAM, "A Free Ride jam or Big Air with friends: the most points wins.", v.inf));
  const day = group("day", "TRACK DAY", "Street bikes on road circuits: lap times, braking points, knee down.",
    soon("ROAD CIRCUITS", "Street bikes on tarmac, lap after lap."));
  return `<div class="dh-card dh-ridec" data-screen="ride">${head}<p class="dh-sub">On your ${esc(v.bike)}.</p><div class="dh-grps">${race}${endless}${free}${day}</div><p class="dh-sub dh-keys">Keys: ↑/W lean forward · ↓/S lean back · ←→/AD steer · Space gas · K brake · L trick or hop · C combo trick (endless) · P pause</p>${v.note ? `<p class="dh-sub dh-note" role="status">${esc(v.note)}</p>` : ""}</div>`;
}
