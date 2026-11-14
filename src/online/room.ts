// The online cards, as HTML (the shell, ../game.ts, wires them): the room card (YOUR NAME and the
// INVITE CODE, HOST or JOIN; the host's pick: what to ride, the tier or the map, 2 / 3 / 4 players;
// JOIN's room number; the lobby's ticket, seats, SEND LINK and START NOW; the "lining up" while the
// hellos travel; a card for a room that's gone) and the online result (your payout and wear with the
// online bonus, and the standings of everyone in the room). Board UI keys, 44 px or more.
import { TIERS } from "../data/series.ts";
import { ONLINE } from "../data/economy.ts";
import { esc, num } from "../html.ts";
import { JAM_MAPS, type Ride, type SeatResult } from "./match.ts";
import { K_RACE, K_JAM, K_AIR, K_CITY } from "../net.ts";

export const KINDS = [
  { k: K_RACE, name: "RACE", blurb: "A new generated track; AI rivals fill the empty places." },
  { k: K_JAM, name: "FREE RIDE JAM", blurb: "Three minutes on one map: the most trick points wins." },
  { k: K_AIR, name: "BIG AIR", blurb: "A minute each in the arena; the judges' total wins." },
  { k: K_CITY, name: "WHEELIE CITY", blurb: "A minute each on the block; the most points wins." },
];
const ORD = ["1ST", "2ND", "3RD", "4TH"];

/** The room card (one element, kept: its fields keep what was typed). */
export function roomCard() {
  const seg = (attr: string, list: { v: number; t: string }[]) => list.map((x, i) => `<button type="button" class="bui-key" data-${attr}="${x.v}" aria-pressed="${i === 0}">${x.t}</button>`).join("");
  return `<b class="dh-h">ONLINE</b><p class="dh-sub ol-room-sub">UP TO FOUR RIDERS · EACH ON THEIR OWN GARAGE BIKE · ONLINE PAYS ×${ONLINE.bonus}</p>
    <form class="ol-pick" data-for="pick" novalidate><label class="dh-field">YOUR NAME<input name="who" autocomplete="nickname" autocapitalize="characters" spellcheck="false" maxlength="8" placeholder="RIDER" /></label><label class="dh-field">INVITE CODE<input name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="64" placeholder="XXXX-XXXX-XXXX" /></label>
      <p class="ol-hostjoin"><button type="submit" class="bui-key dh-go ol-host" value="host"><b>HOST</b><small>Open a room, pick the ride, send the link</small></button><button type="submit" class="bui-key ol-joink" value="join"><b>JOIN</b><small>Type the room number from the host</small></button></p>
      <p class="ol-say" role="alert"></p><p class="dh-row"><button type="button" class="bui-key ol-back">BACK</button></p></form>
    <div data-for="host" hidden><b class="dh-h2">WHAT TO RIDE</b><p class="ol-seg ol-kinds" role="group" aria-label="Ride">${seg("olkind", KINDS.map((x) => ({ v: x.k, t: x.name })))}</p><p class="dh-sub ol-kind-sub">${KINDS[0]!.blurb}</p>
      <div class="ol-tiers"><b class="dh-h2">TIER</b><p class="ol-seg" role="group" aria-label="Tier">${seg("oltier", TIERS.map((t, i) => ({ v: i, t: t.name })))}</p></div>
      <div class="ol-maps" hidden><b class="dh-h2">MAP</b><p class="ol-seg ol-mapseg" role="group" aria-label="Map">${seg("olmap", JAM_MAPS.map((m, i) => ({ v: i, t: m.name })))}</p></div>
      <b class="dh-h2">HOW MANY RIDERS?</b><p class="ol-sizes" role="group" aria-label="Riders"><button type="button" class="bui-key" data-olsize="2">2</button><button type="button" class="bui-key" data-olsize="3">3</button><button type="button" class="bui-key dh-go" data-olsize="4">4</button></p><p class="dh-sub">It starts when everyone's in, or when you press START NOW.</p><p class="dh-row"><button type="button" class="bui-key ol-topick">BACK</button></p></div>
    <form data-for="join" hidden novalidate><b class="dh-big">WHICH ROOM?</b><p class="ol-rooms"><button type="button" class="bui-key" data-olroom="-1" aria-label="Previous room">−</button><output name="roomShow" aria-live="polite">0</output><button type="button" class="bui-key" data-olroom="1" aria-label="Next room">+</button></p>
      <p class="dh-sub">The room number is on the host's screen (it's in their link too).</p><p class="dh-row"><button type="submit" class="bui-key dh-go ol-join">JOIN ROOM</button><button type="button" class="bui-key ol-topick">BACK</button></p><p class="ol-say" role="alert"></p></form>
    <div data-for="wait" hidden><p class="ol-ticket"><span><small>ROOM</small><b class="ol-t-room">0</b></span><span><small>CODE</small><b class="ol-t-code"></b></span></p><p class="dh-sub ol-t-ride"></p><ol class="ol-seats" aria-label="Seats"></ol><p class="dh-big ol-wait-say" aria-live="polite">Waiting for riders.</p>
      <p class="dh-row"><button type="button" class="bui-key dh-go ol-share">SEND LINK</button><button type="button" class="bui-key ol-gonow" hidden>START NOW</button><button type="button" class="bui-key ol-cancel">CANCEL</button></p><p class="dh-sub">Send the link: it has the room and the code, so it drops them straight in.</p></div>
    <div data-for="hello" hidden><b class="dh-big">LINING UP</b><p class="dh-sub ol-hello-say" aria-live="polite">Swapping bikes: every screen rides every rider's own garage bike.</p></div>
    <div data-for="gone" hidden><p class="dh-big ol-gone-say"></p><p class="dh-row"><button type="button" class="bui-key dh-go ol-again">TRY AGAIN</button><button type="button" class="bui-key ol-back">MENU</button></p></div>`;
}

/** The host's pick in words (the lobby, the chip). */
export const pickName = (kind: number, sub: number) => (kind === K_RACE ? `RACE · ${TIERS[sub]?.name ?? TIERS[0]!.name}` : kind === K_JAM ? `FREE RIDE JAM · ${JAM_MAPS[sub]?.name ?? JAM_MAPS[0]!.name}` : KINDS[kind]!.name);

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
export function standingsHTML(r: Ride, res: SeatResult[], seat: number, names: string[]) {
  const rows = res.map((x, p) => ({ p, x })).sort((a, b) => a.x.place - b.x.place);
  const clock = (s: number) => `${(s / 60) | 0}:${(s % 60).toFixed(1).padStart(4, "0")}`;
  const what = (x: SeatResult) => (r.race ? (x.finished ? clock(x.time) : "DNF") : r.jam ? `${num(x.points)} PTS` : r.kind === K_AIR ? `JUDGES ${(x.points / 10).toFixed(1)}` : `${num(x.points)} PTS`);
  const ai = r.race ? r.ai.map((a, i) => ({ name: a.name, place: r.race!.place(r.players + i) })) : [];
  const all = [...rows.map(({ p, x }) => ({ html: `<li${p === seat ? " data-me" : ""}><b>${ORD[x.place] ?? x.place + 1}</b><span>${esc(names[p] ?? "P" + (p + 1))}</span><em>${what(x)}</em></li>`, place: x.place })), ...ai.map((a) => ({ html: `<li data-ai><b>${ORD[a.place]}</b><span>${esc(a.name)} · AI</span><em></em></li>`, place: a.place }))].sort((a, b) => a.place - b.place);
  return `<ol class="ol-stand" aria-label="Standings">${all.map((a) => a.html).join("")}</ol>`;
}
