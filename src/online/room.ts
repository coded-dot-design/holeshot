// The online cards, as HTML (the shell, ../game.ts, wires them): the room card (YOUR NAME and the
// INVITE CODE, HOST or JOIN; the host's pick: what to ride, the tier, the map, the ground or the
// circuit, 2 / 3 / 4 players;
// JOIN's room number; the lobby's ticket, seats, SEND LINK and START NOW; the "lining up" while the
// hellos travel; a card for a room that's gone) and the online result (your payout and wear with the
// online bonus, and the standings of everyone in the room). Board UI keys, 44 px or more.
import { TIERS } from "../data/series.ts";
import { ONLINE } from "../data/economy.ts";
import { esc, num } from "../html.ts";
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
  { k: K_RACE, name: "RACE", title: "CHALLENGE YOUR FRIENDS", head: "CHALLENGE", blurb: "A new generated track; AI rivals fill the empty places." },
  { k: K_JAM, name: "FREE RIDE JAM", title: "JAM WITH YOUR FRIENDS", head: "JAM", blurb: "Three minutes on one map: the most trick points wins." },
  { k: K_AIR, name: "BIG AIR", title: "BIG AIR SHOWDOWN", head: "SHOWDOWN", blurb: "A minute each in the arena; the judges' total wins." },
  { k: K_ENDLESS, name: "ENDLESS", title: "RIDE OUT", head: "RIDE OUT", blurb: "Roam one endless ground together: the same world on every screen. G regroups to the host; END banks your ride." },
  { k: K_ENDCITY, name: "ENDLESS WHEELIE CITY", title: "RIDE OUT", head: "RIDE OUT", blurb: "The open world together: every rider's own neon patrol, roads that never end. G regroups to the host; END banks your ride." },
  { k: K_TRACKDAY, name: "TRACK DAY", title: "TRACK DAY", head: "TRACK DAY", blurb: "Three laps of a road circuit; street-bike rivals fill the empty places. Best laps count." },
];
/** A kind's entry (the room card's blurb, the pick's name). */
export const kindOf = (k: number) => KINDS.find((x) => x.k === k) ?? KINDS[0]!;
const ORD = ["1ST", "2ND", "3RD", "4TH"];

/** The room card (one element, kept: its fields keep what was typed). */
export function roomCard() {
  const seg = (attr: string, list: { v: number; t: string }[]) => list.map((x, i) => `<button type="button" class="bui-key" data-${attr}="${x.v}" aria-pressed="${i === 0}">${x.t}</button>`).join("");
  return `<b class="dh-h ol-room-h">${roomTitle(KINDS[0]!.k)}</b><p class="dh-sub ol-room-sub">UP TO FOUR RIDERS · EACH ON THEIR OWN GARAGE BIKE · ONLINE PAYS ×${ONLINE.bonus}</p>
    <form class="ol-pick" data-for="pick" novalidate><label class="dh-field">YOUR NAME<input name="who" autocomplete="nickname" autocapitalize="characters" spellcheck="false" maxlength="8" placeholder="RIDER" /></label><label class="dh-field">INVITE CODE<input name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="64" placeholder="XXXX-XXXX-XXXX" /></label>
      <p class="ol-hostjoin"><button type="submit" class="bui-key dh-go ol-host" value="host"><b>HOST</b><small>Open a room, pick the ride, send the link</small></button><button type="submit" class="bui-key ol-joink" value="join"><b>JOIN</b><small>Type the room number from the host</small></button></p>
      <p class="ol-say" role="alert"></p><p class="dh-row"><button type="button" class="bui-key ol-back">BACK</button></p></form>
    <div data-for="host" hidden><b class="dh-h2">WHAT TO RIDE</b><p class="ol-seg ol-kinds" role="group" aria-label="Ride">${seg("olkind", KINDS.map((x) => ({ v: x.k, t: x.name })))}</p><p class="dh-sub ol-kind-sub">${KINDS[0]!.blurb}</p>
      <div class="ol-tiers"><b class="dh-h2">TIER</b><p class="ol-seg" role="group" aria-label="Tier">${seg("oltier", TIERS.map((t, i) => ({ v: i, t: t.name })))}</p></div>
      <div class="ol-maps" hidden><b class="dh-h2">MAP</b><p class="ol-seg ol-mapseg" role="group" aria-label="Map">${seg("olmap", JAM_MAPS.map((m, i) => ({ v: i, t: m.name })))}</p></div>
      <div class="ol-circuits" hidden><b class="dh-h2">CIRCUIT</b><p class="ol-seg ol-mapseg" role="group" aria-label="Circuit">${seg("olcircuit", TRACK_DAY.map((t, i) => ({ v: i, t: t.name })))}</p></div>
      <div class="ol-biomes" hidden><b class="dh-h2">GROUND</b><p class="ol-seg ol-mapseg" role="group" aria-label="Ground">${seg("olbiome", BIOMES.map((b, i) => ({ v: i, t: b.name.replace(/^THE /, "") })))}</p></div>
      <b class="dh-h2">HOW MANY RIDERS?</b><p class="ol-sizes" role="group" aria-label="Riders"><button type="button" class="bui-key" data-olsize="2">2</button><button type="button" class="bui-key" data-olsize="3">3</button><button type="button" class="bui-key dh-go" data-olsize="4">4</button></p><p class="dh-sub">It starts when everyone's in, or when you press START NOW.</p><p class="dh-row"><button type="button" class="bui-key ol-topick">BACK</button></p></div>
    <form data-for="join" hidden novalidate><b class="dh-big">WHICH ROOM?</b><p class="ol-rooms"><button type="button" class="bui-key" data-olroom="-1" aria-label="Previous room">−</button><output name="roomShow" aria-live="polite">0</output><button type="button" class="bui-key" data-olroom="1" aria-label="Next room">+</button></p>
      <p class="dh-sub">The room number is on the host's screen (it's in their link too).</p><p class="dh-row"><button type="submit" class="bui-key dh-go ol-join">JOIN ROOM</button><button type="button" class="bui-key ol-topick">BACK</button></p><p class="ol-say" role="alert"></p></form>
    <div data-for="wait" hidden><p class="ol-ticket"><span><small>ROOM</small><b class="ol-t-room">0</b></span><span><small>CODE</small><b class="ol-t-code"></b></span></p><p class="dh-sub ol-t-ride"></p><ol class="ol-seats" aria-label="Seats"></ol><p class="dh-big ol-wait-say" aria-live="polite">Waiting for riders.</p>
      <p class="dh-row"><button type="button" class="bui-key dh-go ol-share">SEND LINK</button><button type="button" class="bui-key ol-gonow" hidden>START NOW</button><button type="button" class="bui-key ol-cancel">CANCEL</button></p><p class="dh-sub">Send the link: it has the room and the code, so it drops them straight in.</p></div>
    <div data-for="hello" hidden><b class="dh-big">LINING UP</b><p class="dh-sub ol-hello-say" aria-live="polite">Swapping bikes: every screen rides every rider's own garage bike.</p></div>
    <div data-for="gone" hidden><p class="dh-big ol-gone-say"></p><p class="dh-row"><button type="button" class="bui-key dh-go ol-again">TRY AGAIN</button><button type="button" class="bui-key ol-back">MENU</button></p></div>`;
}

/** The room card's header for a kind: what the group is for, and that it's online. */
export const roomTitle = (kind: number) => `${kindOf(kind).title} · ONLINE`;
/** The room card's header for a rider joining a friend's room (their pick comes with the hellos). */
export const JOIN_TITLE = "JOIN YOUR FRIENDS · ONLINE";
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
