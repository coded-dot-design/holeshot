// ⚙ SETTINGS and CONTROLS · HOW TO, the shell's own pages, in the garage's and LET'S RIDE's design
// language: the shell's header (with ← back), a page title, then cards of rows and keys built only from
// the shop's pieces (./shop/); the layout lives in ./pages.css. Strings in, a string out, like
// ./ride-ui.ts: the shell (./game.ts) owns the clicks (`.dh-units`, `.dh-sound`, `data-go`,
// `.dh-copy`, `.dh-import`, `.dh-reset`) and passes the header.
import { KEYS, PAD, TOUCH, TOUCH_LINE } from "./data/controls.ts";
import { btn, card, esc, heading, list, pill, row } from "../vendor/shop/shop.js";

/** A page: the header, the title row (`aside` on its right), the body. `cls` names the screen's hook. */
export const page = (screen: string, cls: string, head: string, h1: string, body: string, aside = "") =>
  `<div class="dh-card dh-pg ${cls} shop" data-screen="${screen}">${head}<div class="dh-pwrap"><div class="dh-ptitle"><h1 class="shop-h1 dh-title">${h1}</h1>${aside}</div>${body}</div></div>`;

export interface SettingsView { metric: boolean; sound: boolean; code: string; inf: boolean; note: string }

/** ⚙ SETTINGS: the game (units, sound, controls, test credits), the profile (export, import), starting over. */
export function settingsPage(head: string, v: SettingsView) {
  const game = card(heading("Game", "", 2) + list([
    row({ tag: "div", title: "Units", sub: "Distances and speeds in every ride.", end: btn(v.metric ? "Km · km/h" : "Mi · mph", `aria-label="Units: ${v.metric ? "metric, km and km/h" : "imperial, miles and mph"}"`, false, "dh-units") }),
    row({ tag: "div", title: "Sound", sub: "Engines, landings and the crowd.", end: btn(v.sound ? "On" : "Off", `aria-pressed="${v.sound}"`, false, "dh-sound") }),
    row({ tag: "button", attrs: 'type="button" data-go="controls"', title: "Controls · How to", sub: "Keyboard, gamepad and phone.", go: true }).replace('"shop-row"', '"shop-row dh-ctl-go"'),
    row({ tag: "div", title: "Test credits", sub: v.inf ? "On for this visit: every bike and part is free, nothing is saved, online is off." : "Add ?credits=inf to the address to try everything for free. Nothing is saved.", end: pill(v.inf ? "On" : "Off", v.inf ? "" : "plain") }),
  ], null, "Game settings"), "dh-sgame");
  const move = card(heading("Move your profile", "", 2) + `<p class="shop-sub">Your garage lives on this device. Copy the code to carry it to another one; nothing leaves the device unless you do.</p>${v.inf ? `<p class="shop-need dh-warn">Test credits are on: nothing here is saved, and the code is your saved profile, as it was.</p>` : ""}`
    + `<label class="dh-field"><span class="shop-eyebrow">Export code</span><textarea class="dh-code" readonly rows="3">${v.code}</textarea></label><p class="dh-row">${btn("Copy code", "", false, "dh-copy")}</p>`
    + `<label class="dh-field"><span class="shop-eyebrow">Import a code</span><textarea class="dh-codein" rows="3" spellcheck="false" placeholder="DH1-…"></textarea></label><p class="dh-row">${btn("Load it", "", false, "dh-import")}</p>`, "dh-smove");
  const reset = card(heading("Start over", "", 2) + `<p class="shop-sub">A new rider and a new first bike. Every bike, credit and title on this device goes.</p><p class="dh-row">${btn("Start over", "", false, "dh-reset")}</p>`, "dh-sreset");
  return page("settings", "dh-set", head, "Settings", `<div class="dh-pcols dh-scols">${game}${move}${reset}</div><p class="shop-sub dh-note" role="status">${esc(v.note)}</p>`);
}

/** CONTROLS · HOW TO (from settings): the game's real bindings, the same facts as the landing's
 *  Controls section (./data/controls.ts). */
export function controlsPage(head: string) {
  const caps = (ks: string[]) => `<span class="dh-caps">${ks.map((k) => (k === "+" ? "<i>+</i>" : `<kbd>${esc(k)}</kbd>`)).join("")}</span>`;
  const keys = card(heading("Keyboard") + KEYS.map((g) => `<h3 class="shop-eyebrow dh-cgrp">${esc(g.group)}</h3>` + list(g.rows.map(([ks, what, nb]) => row({ tag: "div", title: esc(what), sub: nb ? esc(nb) : undefined, end: caps(ks) })), null, g.group)).join(""), "dh-ckeys");
  const two = (rows: [string, string][], label: string) => list(rows.map(([k, v]) => row({ tag: "div", title: esc(k), sub: esc(v) })), null, label);
  const pad = card(heading("Gamepad") + two(PAD, "Gamepad"));
  const phone = card(heading("Phone") + `<p class="shop-sub">${esc(TOUCH_LINE)}</p>` + two(TOUCH, "Phone"));
  return page("controls", "dh-ctl", head, "Controls · How to", `<p class="shop-sub dh-lede">Your bike rides every event: Let’s Ride from the garage. Every mode pays credits; spend them on tyres, rebuilds, mods and paint.</p><div class="dh-pcols">${keys}<div class="dh-pcol">${pad}${phone}</div></div>`);
}
