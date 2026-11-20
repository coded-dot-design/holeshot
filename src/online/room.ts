// The online cards, as HTML (the shell, ../game.ts, wires them): the room card (YOUR NAME and the
// INVITE CODE, HOST or JOIN; the host's pick: what to ride, the tier, the map, the ground or the
// circuit, 2 / 3 / 4 players;
// JOIN's room number; the lobby's ticket, seats, SEND LINK and START NOW; the "lining up" while the
// hellos travel; a card for a room that's gone) and the online result's standings. The shop's keys and
// cards (../shop/), 44 px or more; the layout is ./online.css.
import { TIERS } from "../data/series.ts";
import { ONLINE } from "../data/economy.ts";
import { esc, num } from "../html.ts";
import { btn, heading } from "../../vendor/shop/shop.js";
import { words } from "../garage/adapters.ts";
import { JAM_MAPS, type Ride, type SeatResult } from "./match.ts";
import { K_RACE, K_JAM, K_AIR, K_ENDLESS, K_ENDCITY, K_TRACKDAY } from "../net.ts";
import { TRACK_DAY } from "../modes/race/circuits.ts";
import { BIOMES } from "../modes/desert/track.ts";
import { SB_DIST, SB_BEST, SB_BEST_ID, SB_COMBO, SB_DRAGS, SB_POINTS, trickName, type Board } from "./board.ts";
import { COMBOS } from "../modes/stunts.ts";
import { dist, type Units } from "../model/units.ts";

// Each kind speaks to what the group is for (owner, 2026-11-19): a race is a challenge, an endless
// ride is a ride out, a jam is a jam; `title` heads the room card, `head` the ride's cards and chip.
export const KINDS = [
  { k: K_RACE, name: "RACE", title: "Challenge your friends", head: "CHALLENGE", blurb: "A new generated track; AI rivals fill the empty places." },
  { k: K_JAM, name: "FREE RIDE JAM", title: "Jam with your friends", head: "JAM", blurb: "Three minutes on one map: the most trick points wins." },
  { k: K_AIR, name: "BIG AIR", title: "Big Air showdown", head: "SHOWDOWN", blurb: "A minute each in the arena; the judges' total wins." },
  { k: K_ENDLESS, name: "ENDLESS", title: "Ride out", head: "RIDE OUT", blurb: "Roam one endless ground together: the same world on every screen. G regroups to the host; END banks your ride." },
  { k: K_ENDCITY, name: "ENDLESS WHEELIE CITY", title: "Ride out", head: "RIDE OUT", blurb: "The open world together: every rider's own neon patrol, roads that never end. G regroups to the host; END banks your ride." },
  { k: K_TRACKDAY, name: "TRACK DAY", title: "Track Day", head: "TRACK DAY", blurb: "Three laps of a road circuit; street-bike rivals fill the empty places. Best laps count." },
];
/** A kind's entry (the room card's blurb, the pick's name). */
export const kindOf = (k: number) => KINDS.find((x) => x.k === k) ?? KINDS[0]!;
const ORD = ["1ST", "2ND", "3RD", "4TH"];

/** The room card (one element, kept: its fields keep what was typed): a page in the garage's design
 *  language (the shop's pieces; the shell puts its header in `.ol-head`). */
export function roomCard() {
  const seg = (attr: string, list: { v: number; t: string }[]) => list.map((x, i) => btn(words(x.t), `data-${attr}="${x.v}" aria-pressed="${i === 0}"`)).join("");
  const pick = (cls: string, title: string, attr: string, list: { v: number; t: string }[], hidden = true) => `<div class="${cls}"${hidden ? " hidden" : ""}><h3 class="shop-eyebrow">${title}</h3><p class="ol-seg ol-mapseg" role="group" aria-label="${title}">${seg(attr, list)}</p></div>`;
  const back = (cls: string, t = "Back") => btn(t, "", false, cls);
  return `<div class="ol-head"></div><div class="dh-pwrap"><div class="dh-ptitle"><h1 class="shop-h1 ol-room-h">${roomTitle(KINDS[0]!.k)}</h1><small class="shop-eyebrow ol-room-sub">Up to four riders · each on their own garage bike · online pays ×${ONLINE.bonus}</small></div>
    <form class="shop-card ol-pick" data-for="pick" novalidate>${heading("Who's riding", "", 2)}<div class="ol-fields"><label class="dh-field"><span class="shop-eyebrow">Your name</span><input name="who" autocomplete="nickname" autocapitalize="characters" spellcheck="false" maxlength="8" placeholder="RIDER" /></label><label class="dh-field"><span class="shop-eyebrow">Invite code</span><input name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="64" placeholder="XXXX-XXXX-XXXX" /></label></div>
      <p class="ol-hostjoin"><button type="submit" class="shop-btn shop-btn-go dh-go ol-host" value="host"><b>Host</b><small>Open a room, pick the ride, send the link</small></button><button type="submit" class="shop-btn ol-joink" value="join"><b>Join</b><small>Type the room number from the host</small></button></p>
      <p class="ol-say" role="alert"></p></form>
    <div class="shop-card" data-for="host" hidden>${heading("What to ride", "", 2)}<p class="ol-seg ol-kinds" role="group" aria-label="Ride">${seg("olkind", KINDS.map((x) => ({ v: x.k, t: x.name })))}</p><p class="shop-sub ol-kind-sub">${KINDS[0]!.blurb}</p>
      ${pick("ol-tiers", "Tier", "oltier", TIERS.map((t, i) => ({ v: i, t: t.name })), false)}${pick("ol-maps", "Map", "olmap", JAM_MAPS.map((m, i) => ({ v: i, t: m.name })))}${pick("ol-circuits", "Circuit", "olcircuit", TRACK_DAY.map((t, i) => ({ v: i, t: t.name })))}${pick("ol-biomes", "Ground", "olbiome", BIOMES.map((b, i) => ({ v: i, t: b.name.replace(/^THE /, "") })))}
      <h3 class="shop-eyebrow">How many riders?</h3><p class="ol-sizes" role="group" aria-label="Riders">${btn("2", 'data-olsize="2"')}${btn("3", 'data-olsize="3"')}${btn("4", 'data-olsize="4"', false, "shop-btn-go dh-go")}</p><p class="shop-sub">It starts when everyone's in, or when you press Start now.</p><p class="dh-row">${back("ol-topick")}</p></div>
    <form class="shop-card" data-for="join" hidden novalidate>${heading("Which room?", "", 2)}<p class="ol-rooms">${btn("−", 'data-olroom="-1" aria-label="Previous room"')}<output name="roomShow" aria-live="polite">0</output>${btn("+", 'data-olroom="1" aria-label="Next room"')}</p>
      <p class="shop-sub">The room number is on the host's screen (it's in their link too).</p><p class="dh-row"><button type="submit" class="shop-btn shop-btn-go dh-go ol-join">Join room</button>${back("ol-topick")}</p><p class="ol-say" role="alert"></p></form>
    <div class="shop-card" data-for="wait" hidden><p class="ol-ticket"><span><small class="shop-eyebrow">Room</small><b class="ol-t-room">0</b></span><span><small class="shop-eyebrow">Code</small><b class="ol-t-code"></b></span></p><p class="shop-sub ol-t-ride"></p><ol class="ol-seats" aria-label="Seats"></ol><p class="shop-h3 ol-wait-say" aria-live="polite">Waiting for riders.</p>
      <p class="dh-row">${btn("Send link", "", false, "shop-btn-go dh-go ol-share")}<button type="button" class="shop-btn ol-gonow" hidden>Start now</button>${back("ol-cancel", "Cancel")}</p><p class="shop-sub">Send the link: it has the room and the code, so it drops them straight in.</p></div>
    <div class="shop-card" data-for="hello" hidden><h2 class="shop-h2">Lining up</h2><p class="shop-sub ol-hello-say" aria-live="polite">Swapping bikes: every screen rides every rider's own garage bike.</p></div>
    <div class="shop-card" data-for="gone" hidden><p class="shop-h3 ol-gone-say"></p><p class="dh-row">${btn("Try again", "", false, "shop-btn-go dh-go ol-again")}${back("ol-back", "Let's Ride")}</p></div></div>`;
}

/** The room card's header for a kind: what the group is for, and that it's online. */
export const roomTitle = (kind: number) => `${kindOf(kind).title} online`;
/** The room card's header for a rider joining a friend's room (their pick comes with the hellos). */
export const JOIN_TITLE = "Join your friends online";
/** The ride's cards' header (pause, result): the use, the pick, online ("RIDE OUT · ENDLESS · THE DESERT · ONLINE"). */
export const rideTitle = (kind: number, sub: number) => `${kindOf(kind).head} · ${pickName(kind, sub)} · ONLINE`;

/** The host's pick in words (the lobby, the chip). */
export const pickName = (kind: number, sub: number) => (kind === K_RACE ? `RACE · ${TIERS[sub]?.name ?? TIERS[0]!.name}` : kind === K_JAM ? `FREE RIDE JAM · ${JAM_MAPS[sub]?.name ?? JAM_MAPS[0]!.name}` : kind === K_ENDLESS ? `ENDLESS · ${BIOMES[sub]?.name ?? BIOMES[0]!.name}` : kind === K_TRACKDAY ? `TRACK DAY · ${TRACK_DAY[sub]?.name ?? TRACK_DAY[0]!.name}` : kindOf(kind).name);

/** The lobby's seats: who is in (the room only says how many), the open places. */
export function seatsHTML(seat: number, seated: number, n: number, me: string, colors: string[]) {
  let h = "";
  for (let i = 0; i < n; i++) {
    const mine = i === seat, inn = i < seated;
    h += `<li class="${mine ? "ol-me" : inn ? "ol-in" : ""}"><i style="background:${colors[i % colors.length]}"></i><b>${mine && me ? esc(me) : "P" + (i + 1)}</b><small>${mine ? (seat === 0 ? "YOU · HOST" : "YOU") : inn ? (i === 0 ? "HOST" : "IN") : "OPEN"}</small></li>`;
  }
  return h;
}

/** The standings of a finished ride: every person (and the race's AI), best first. */
export function standingsHTML(r: Ride, res: SeatResult[], seat: number, names: string[], units?: Units) {
  const rows = res.map((x, p) => ({ p, x })).sort((a, b) => a.x.place - b.x.place);
  const clock = (s: number) => `${(s / 60) | 0}:${(s % 60).toFixed(1).padStart(4, "0")}`;
  const what = (x: SeatResult) => (r.board ? `${num(x.points)} PTS · ${dist(x.far, units)}` : r.race ? (x.finished ? clock(x.time) : "DNF") : r.jam ? `${num(x.points)} PTS` : r.kind === K_AIR ? `JUDGES ${(x.points / 10).toFixed(1)}` : `${num(x.points)} PTS`);
  const ai = r.race ? r.ai.map((a, i) => ({ name: a.name, place: r.race!.place(r.players + i) })) : [];
  const all = [...rows.map(({ p, x }) => ({ html: `<li${p === seat ? " data-me" : ""}><b>${ORD[x.place] ?? x.place + 1}</b><span>${esc(names[p] ?? "P" + (p + 1))}</span><em>${what(x)}</em></li>`, place: x.place })), ...ai.map((a) => ({ html: `<li data-ai><b>${ORD[a.place]}</b><span>${esc(a.name)} · AI</span><em></em></li>`, place: a.place }))].sort((a, b) => a.place - b.place);
  return `<ol class="ol-stand" aria-label="Standings">${all.map((a) => a.html).join("")}</ol>`;
}

/** The endless rides' session scoreboard (every screen the same): name, points, distance, best
 *  trick, combo points, hand drags; best first. `names` and `colors` by seat. */
export function boardHTML(B: Board, seat: number, names: string[], colors: string[], units?: Units) {
  const rows: number[] = [];
  for (let p = 0; p < B.humans; p++) rows.push(p);
  rows.sort((a, b) => B.place(a) - B.place(b));
  return rows.map((p) => `<li${p === seat ? " data-me" : ""}><i style="background:${colors[p]}"></i><span>${esc(names[p] ?? "P" + (p + 1))}</span><b>${num(B.get(p, SB_POINTS))}</b><small>${dist(B.get(p, SB_DIST), units)} · BEST ${B.get(p, SB_BEST) ? `${trickName(B.get(p, SB_BEST_ID), COMBOS)} ` : ""}${num(B.get(p, SB_BEST))}${B.get(p, SB_COMBO) ? ` · COMBO ${num(B.get(p, SB_COMBO))}` : ""}${B.get(p, SB_DRAGS) ? ` · ${B.get(p, SB_DRAGS)} DRAG${B.get(p, SB_DRAGS) === 1 ? "" : "S"}` : ""}</small></li>`).join("");
}
