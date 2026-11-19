// Holeshot, the shell: one rider, one garage, every kind of riding. It owns the profile (load, save,
// export and import), the garage (your bikes, their parts and mods, the paint and the rider kit),
// the screens (the GARAGE is home: LET'S RIDE → the ride groups → an event → the result → back to the
// garage; ⚙ settings beside the theme key) and the cards round an event (pause, the result).
// An event is a mode (./modes/index.ts) started on your tuned bike in the mode layer; when it ends
// the shell settles it (credits in, wear on the bike) and saves. Board UI stickers in a shadow root,
// so the page and the game never touch each other's styles. Every page write goes through the
// kernel's ledger: Recall gives the page back.
import { dist } from "./model/units.ts";
import { createEngine } from "@fzlt/core/kernel";
import { mount as buiMount } from "@fzlt/core/ui";
import { diorama } from "@fzlt/core/diorama";
import { bike as makeBike } from "./bike/bike.ts";
import { rig, type RigColors } from "./bike/rig.ts";
import { CLASSES, STARTERS, makerOf, model as modelOf } from "./data/roster.ts";
import { MOTOR_NAME, PARTS, PART_NAME } from "./data/economy.ts";
import { PAINTS, SWATCHES } from "./data/looks.ts";
import { tierFor, useNames } from "./data/names.ts";
import { KEYS, PAD, TOUCH, TOUCH_LINE } from "./data/controls.ts";
import { touchLog } from "./debug/touchlog.ts";
import { lapClock, mode as modeOf, trackDayBest } from "./modes/index.ts";
import type { ModeCtx, ModeId, ModeRun, RunStats } from "./modes/mode.ts";
import { venueOf, type Venue } from "./modes/race/venue.ts";
import { paintMaps } from "./modes/freeride/picker.ts";
import { rideCard as rideScreen } from "./ride-ui.ts";
import { WORDMARK } from "./logo.ts";
import { exportCode, importCode, load, local, newBike, ready, riding, save, setup, fresh, type Profile, type Store, type RiderKit } from "./model/profile.ts";
import { testCredits, topUp } from "./model/testcredits.ts";
import { tune } from "./model/tune.ts";
import { dirtWarning, onGround } from "./model/families.ts";
import { apply, pitFix, pitReady, settle, type ModeResult } from "./model/economy.ts";
import type { Buy } from "./model/garage.ts";
import { after, ride as garageRide } from "./model/upkeep.ts";
import { portraitOf } from "./garage/portrait.ts";
import { bayInfo, garageCard as garageView, garageClick, garageUI, pvName, pvOf, riskCard, showroomView, shown, type Pv } from "./garage/view.ts";
import { cta as lkCta, tabs as lkTabs } from "./locker/ui.ts";
import { lookOf } from "./garage/look.ts";
import { bar, esc, num } from "./html.ts";
import { enter as enterSeries, recordRound, retire as retireSeries, roundStats } from "./model/series.ts";
import { seriesCard as seriesScreen, seriesKeys, seriesName, seriesResult, startRound } from "./series-ui.ts";
import type { TierId } from "./data/series.ts";
import type { Transport } from "@fzlt/core/presence";
import { blankStats } from "./modes/mode.ts";
import { ICON } from "./modes/keys.ts";
import { mountTrack, type NetRun, type NetView } from "./modes/race/scene.ts";
import { applyOnline, settleOnline } from "./model/economy.ts";
import { match, OVER, type Match, type Ride, type SeatResult } from "./online/match.ts";
import { joinRoom, cleanName, encode, scoreBits, packMode, unpackMode, B_AUTO, B_RESET, B_DONE, B_REGROUP, B_HOP, B_COMBO, C_END, C_REGROUP, C_HOP, C_COMBO, SEATS, K_RACE, K_JAM, K_AIR, K_ENDLESS, K_ENDCITY } from "./net.ts";
import { JOIN_TITLE, kindOf, pickName, rideTitle, roomCard, roomTitle, seatsHTML, standingsHTML, boardHTML } from "./online/room.ts";
import { mountCity } from "./modes/wheelie/scene.ts";
export { lookOf };

export interface HoleshotOptions {
  /** Mount inside this element (absolutely filled; give it a size). Default: a layer over the page. */
  host?: HTMLElement | null;
  /** The landing hero: a race on the autopilot, no menus, no saving. */
  attract?: boolean;
  /** Seed for the events (each event's seed follows from it and the rider's event count). */
  seed?: number;
  /** Where the profile lives (default localStorage; tests pass their own). */
  store?: Store;
  /** Sound on (default: the profile's setting; silent until a gesture anyway). */
  sound?: boolean;
  theme?: "dark" | "light";
  /** The fizlet-rooms server for online play (wss://…); `?rooms=` on the page overrides it. */
  rooms?: string;
  /** The page's light/dark switch: given, the game shows a theme key (in the menus' header and a
   *  ride's corner keys) that calls it; the game follows `data-theme` on <html> either way. */
  onTheme?: () => void;
}

/** The screens. The garage is home ("menu" is its old name: `show("menu")` still lands there). */
type Screen = "setup" | "garage" | "ride" | "series" | "settings" | "controls" | "event" | "result" | "online";

export function createHoleshot(o: HoleshotOptions = {}) {
  const dropIn = !o.host, store = o.store ?? local;
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wrap = document.createElement("div");
  wrap.setAttribute("data-fizlet-host", "holeshot");
  wrap.style.cssText = dropIn ? "position:fixed;inset:0;z-index:2147483000" : "position:absolute;inset:0";
  const engine = createEngine({ root: wrap, settle: 0.5, seed: o.seed ?? 1 });
  const L = engine.ledger, sig = { signal: engine.signal };
  L.add(wrap);
  (o.host ?? document.body).append(wrap);
  const pageTheme = () => o.theme ?? (document.documentElement.dataset.theme === "light" ? "light" : "dark");
  const root = buiMount(wrap, __KIT_CSS__ + __GAME_CSS__, { theme: pageTheme() });
  const stage = document.createElement("div");
  stage.className = "dh";
  root.append(stage);
  const paintTheme = () => ((root.dataset.theme = pageTheme()), stage.toggleAttribute("data-day", pageTheme() === "light"));
  paintTheme();
  const mo = new MutationObserver(() => (paintTheme(), preview()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  engine.signal.addEventListener("abort", () => (mo.disconnect(), run?.destroy()), { once: true });

  // ---- the profile ----
  const loaded = o.attract ? { profile: fresh(), newer: false } : load(store);
  const newer = loaded.newer;
  // Test credits (?credits=inf or ?money=inf: ./model/testcredits.ts): the session plays a copy of
  // the saved profile with its credits topped up after every change, and nothing is saved; the
  // export code stays the real profile's. Online is off with it.
  const inf = !o.attract && testCredits(typeof location === "object" ? location.search : "");
  // The names shown (./data/names.ts): REAL only with ?names=real or test credits, else the build's; never saved.
  useNames(tierFor(typeof location === "object" ? location.search : ""));
  if (!o.attract) touchLog(typeof location === "object" ? location.search : "");
  const real = inf ? structuredClone(loaded.profile) : null;
  let profile = inf ? topUp(loaded.profile) : loaded.profile;
  if (o.attract) profile = setup(profile, { starter: STARTERS[0]!.id, paint: "pinkout", number: 7, name: "DEMO" });
  const keep = () => (inf ? void (profile = topUp(profile)) : !o.attract && save(profile, store, newer));
  const code = () => exportCode(real ?? profile);

  // ---- the layers: the mode (an event), the cards over it ----
  const modeEl = document.createElement("div");
  modeEl.className = "dh-mode";
  const cards = document.createElement("div");
  cards.className = "dh-cards";
  const live = document.createElement("p");
  live.className = "dh-live";
  live.setAttribute("aria-live", "polite");
  stage.append(modeEl, cards, live);
  const say = (s: string) => (live.textContent = s === live.textContent ? s + " " : s);

  let screen: Screen = "setup", run: ModeRun | null = null, runMode: ModeId = "race", runMap: string | undefined, paused = false, result: ModeResult | null = null, note = "";
  const gui = garageUI(inf);
  type StartOpt = { map?: string; seed?: number; auto?: boolean; venue?: Venue };
  /** The garage key just pressed (its data attributes), to give the focus back after the redraw. */
  let refocus = "";
  let pending: [ModeId, StartOpt] | null = null, sure = false, runSeed = 0, runVenue: Venue = "mx", seriesVenue: Venue = "mx";
  /** Where ⚙ settings goes back to (the screen it was opened from). */
  let setFrom: Screen = "garage";

  // ---- the garage's bike preview: the rig on a turntable, drawn on change (no loop). Drag or swipe
  // it sideways to turn it; with focus, ← and → turn it by 15°, Home faces it front-quarter again. ----
  const pv = document.createElement("canvas");
  pv.className = "dh-preview";
  pv.tabIndex = 0;
  pv.setAttribute("role", "slider");
  pv.setAttribute("aria-label", "Turn the bike: drag, or the left and right arrow keys");
  pv.setAttribute("aria-valuemin", "0");
  pv.setAttribute("aria-valuemax", "359");
  const YAW0 = -0.15;
  let pvYaw = YAW0;
  const turn = (to: number) => {
    pvYaw = to - Math.PI * 2 * Math.floor(to / (Math.PI * 2));
    const deg = Math.round((pvYaw * 180) / Math.PI) % 360;
    pv.setAttribute("aria-valuenow", "" + deg);
    pv.setAttribute("aria-valuetext", deg + "°");
    preview();
  };
  const pdio = diorama(pv, { light: [-0.4, 1, 0.6], ambient: 0.55, background: () => (pageTheme() === "dark" ? "#1a1636" : "#fbeee0") });
  const flat = { sample(_x: number, _z: number, out: { [i: number]: number }) { out[0] = 0; out[1] = 0; out[2] = 1; out[3] = 0; return 0; } };
  let pvKey = "";
  function preview() {
    if (!pv.isConnected || !ready(profile)) return;
    const r = pv.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height);
    if (w < 10 || h < 10) return;
    const P2 = screen === "garage" ? shown(profile, gui) : profile, b = riding(P2), t = tune(b), L2 = lookOf(P2), close = screen === "garage" && gui.tab === "look" && gui.look !== "bike", key = JSON.stringify([w, h, b.model, b.look, b.dmg, b.mods, P2.kit, pageTheme(), pvYaw, close]);
    if (key === pvKey) return;
    pvKey = key;
    pdio.resize(w, h, Math.min(2, devicePixelRatio || 1));
    pdio.clear();
    const night = pageTheme() === "dark";
    const kit = night ? { seat: "#14121f", frame: "#2b2a3d", tyre: "#0f0f16", rim: "#9aa0c8", metal: "#c9cde6", pipe: "#7e86a8", glow: "#ff2e88" } : { seat: "#2a2833", frame: "#3a3a4c", tyre: "#24232b", rim: "#d9dbe6", metal: "#eceef7", pipe: "#9aa0b8", glow: "#ff3b30" };
    // The plinth: a lifted top with a lighter lip, on an edge glow (the palette's cyan by night, hot
    // pink by day): 3:1 or more against the preview's background in both themes (tests/garage-ux).
    pdio.add({ shape: "cyl", sides: 24, size: [3.2, 0.12, 3.2], pos: [0, -0.06, 0], color: night ? "#a49bf0" : "#6f5a8e", pick: false });
    pdio.add({ shape: "cyl", sides: 24, size: [2.96, 0.13, 2.96], pos: [0, -0.055, 0], color: night ? "#7a70cc" : "#8b74a8", pick: false });
    pdio.add({ shape: "cyl", sides: 24, size: [3.34, 0.05, 3.34], pos: [0, -0.11, 0], color: night ? "#22e6ff" : "#d81b72", emissive: night, pick: false });
    const g = rig(pdio, "pv", { ...kit, ...L2.look } as RigColors, t.rig, L2.helmet, t.model.id), bk = makeBike(flat, t.power, t.shape);
    bk.reset(0, 0, 0);
    g.pose(bk, 0.6);
    // Dressing the rider (RIDER KIT, OUTFITS), the turntable closes in on them: helmet, kit and boots.
    Object.assign(pdio.cam, close ? { yaw: pvYaw, pitch: 0.16, dist: 3, tx: 0.05, ty: 0.96, tz: 0, ox: 0, oy: 0, fov: 0.55 } : { yaw: pvYaw, pitch: 0.2, dist: 4.9, tx: 0, ty: 0.55, tz: 0, ox: 0, oy: 0, fov: 0.55 });
    pdio.draw();
  }
  let grip = -1, gx = 0;
  pv.addEventListener("pointerdown", (e) => {
    grip = e.pointerId; gx = e.clientX;
    try {
      pv.setPointerCapture(e.pointerId);
    } catch {}
  }, sig);
  pv.addEventListener("pointermove", (e) => {
    if (e.pointerId !== grip) return;
    const dx = e.clientX - gx;
    gx = e.clientX;
    if (dx) turn(pvYaw - dx * 0.012);
  }, sig);
  for (const t of ["pointerup", "pointercancel"]) pv.addEventListener(t, (e) => (e as PointerEvent).pointerId === grip && (grip = -1), sig);
  pv.addEventListener("keydown", (e) => {
    const k = e.key === "ArrowLeft" ? 1 : e.key === "ArrowRight" ? -1 : 0;
    if (k) turn(pvYaw + (k * Math.PI) / 12);
    else if (e.key === "Home") turn(YAW0);
    else return;
    e.preventDefault();
    e.stopPropagation();
  }, sig);
  turn(YAW0);
  const pro = new ResizeObserver(() => ((pvKey = ""), preview()));
  pro.observe(pv);
  engine.signal.addEventListener("abort", () => pro.disconnect(), { once: true });

  // ---- rendering the cards ----
  /** The header: HOLESHOT on the garage (home), else ← back and the screen's name; then the credits,
   *  the name, ⚙ settings and the theme key. Sticky, so the way back stays in reach. */
  const head = (back?: [Screen, string, string]) => `<header class="dh-top${back ? " dh-sticky" : ""}">${back ? `<button type="button" class="bui-key dh-back" data-go="${back[0]}">← ${back[1]}</button><b class="dh-h dh-title">${back[2]}</b>` : WORDMARK}${inf ? `<span class="dh-chip dh-cr" title="Test credits: nothing is saved">◈ ∞</span><span class="dh-chip dh-test" title="?credits=inf: nothing is saved, online is off">TEST CREDITS ∞</span>` : `<span class="dh-chip dh-cr" title="Credits">◈ ${num(profile.credits)}</span>`}${profile.name ? `<span class="dh-chip dh-who">${portraitOf(profile.kit)}${esc(profile.name)}</span>` : ""}${screen === "settings" || screen === "controls" ? "" : `<button type="button" class="bui-key dh-icon dh-cog" data-go="settings" aria-label="Settings">${ICON.cog}</button>`}${o.onTheme ? `<button type="button" class="bui-key dh-icon dh-theme" aria-label="Light or dark">${ICON.theme}</button>` : ""}</header>`;
  /** The garage's one main action. */
  const letsRide = lkCta("LET'S RIDE", "dh-letsride", "RACE · ENDLESS · FREE RIDE · TRACK DAY", 'data-go="ride"');
  /** The garage's header: the logo with the version and the byline, the Garage / Showroom tabs, the
   *  credits, the rider (to the rider's gear), ⚙ settings (the CONTROLS / HOW TO card lives there)
   *  and the Day / Night key. */
  const garageHead = () => {
    const day = pageTheme() === "light";
    return `<header class="dh-top dh-ghead"><span class="dh-brand">${WORDMARK}<small class="lk-eyebrow">V${__VERSION__}<i aria-hidden="true">·</i>BY DAVID COOLEY</small></span>${lkTabs([["garage", "Garage"], ["showroom", "Showroom"]], gui.tab === "showroom" ? "showroom" : "garage", "gtab", "Garage or showroom", true)}<span class="dh-hkeys">${inf ? `<span class="dh-chip dh-cr" title="Test credits: nothing is saved">◆ ∞</span><span class="dh-chip dh-test" title="?credits=inf: nothing is saved, online is off">TEST CREDITS ∞</span>` : `<span class="dh-chip dh-cr" title="Credits">◆ ${num(profile.credits)}</span>`}<button type="button" class="lk-btn dh-who" data-rider aria-label="Rider gear">${portraitOf(profile.kit)}<span>${esc(profile.name ? profile.name.charAt(0) + profile.name.slice(1).toLowerCase() : "Rider")}</span></button><button type="button" class="lk-btn dh-icon dh-cog" data-go="settings" aria-label="Settings">${ICON.cog}</button>${o.onTheme ? `<button type="button" class="lk-btn dh-theme" aria-label="Light or dark"><i aria-hidden="true">${day ? "☀" : "☾"}</i>${day ? "Day" : "Night"}</button>` : ""}</span></header>`;
  };
  const bikeLine = () => {
    const b = riding(profile), m = modelOf(b.model);
    return `${makerOf(m).name} ${m.name} · #${b.look.number}`;
  };
  const cost = (n: number, can: boolean) => (n ? `<small class="dh-price"${can ? "" : " data-short"}>◈ ${num(n)}</small>` : `<small class="dh-price">OWNED</small>`);

  function setupCard() {
    const starters = STARTERS.map((m, i) => {
      const t = tune(newBike(m.id, "x"));
      return `<label class="dh-pick"><input type="radio" name="starter" value="${m.id}" ${i ? "" : "checked"} /><span><small>${CLASSES[m.cls].name} · ${makerOf(m).name}</small><b>${m.name}</b><em>${esc(m.blurb)}</em>${bar(t.feel.pull, "PULL")}${bar(t.feel.top, "TOP SPEED")}${bar(t.feel.light, "LIGHT")}${bar(t.feel.susp, "SUSPENSION")}</span></label>`;
    }).join("");
    const paints = PAINTS.filter((p) => !p.tier).map((p, i) => `<label class="dh-sw" style="--a:${p.plastic};--b:${p.plastic2}"><input type="radio" name="paint" value="${p.id}" ${i ? "" : "checked"} /><span>${p.name}</span></label>`).join("");
    const jerseys = SWATCHES.filter((s) => !s.tier && s.id !== "ink").map((s, i) => `<label class="dh-sw" style="--a:${s.hex};--b:${s.hex}"><input type="radio" name="jersey" value="${s.id}" ${i ? "" : "checked"} /><span>${s.name}</span></label>`).join("");
    return `<form class="dh-card dh-setup" data-screen="setup" novalidate><b class="dh-h">YOUR BIKE</b><p class="dh-sub">One bike to start. It rides every event, wears every lap, and the credits you earn keep it fast.</p>
      <fieldset class="dh-picks"><legend>STARTER</legend>${starters}</fieldset>
      <fieldset class="dh-sws"><legend>PAINT</legend>${paints}</fieldset>
      <fieldset class="dh-sws"><legend>JERSEY</legend>${jerseys}</fieldset>
      <p class="dh-row"><label class="dh-field">RIDER NAME<input name="name" maxlength="12" autocomplete="nickname" autocapitalize="characters" spellcheck="false" placeholder="RIDER" /></label><label class="dh-field dh-numf">NUMBER<input name="number" type="number" inputmode="numeric" min="1" max="99" value="7" /></label></p>
      <p class="dh-row"><button type="submit" class="bui-key dh-go">TO THE GARAGE</button></p>${newer ? `<p class="dh-sub dh-warn">A save from a newer Holeshot is on this device. It is kept as it is; this profile won't be saved over it.</p>` : ""}</form>`;
  }
  const pitKey = () => (pitReady(profile) ? `<p class="dh-row"><button type="button" class="bui-key dh-pit">PIT CREW: FREE BASIC FIX</button></p>` : "");
  // (The lockup, "by David Cooley", sits above LET'S RIDE where the dock has room: ./garage/garage.css.)
  const garageCard = () => garageView(profile, gui, garageHead(), letsRide, note, pitKey());
  /** THE SHOWROOM SEAM: the Showroom tab mounts whatever showroom the game has into its host. Swap
   *  the module here (render + init with the host and the state accessors); nothing else changes. */
  const mountShowroom = (host: HTMLElement) => { host.innerHTML = showroomView(profile, gui.all); };
  const rideCard = () => rideScreen(head(["garage", "GARAGE", "LET'S RIDE"]), { bike: bikeLine(), best: (k) => km(profile.stats.far[k] ?? 0), lap: (c) => lapClock(trackDayBest(profile.stats.best, c)), inf, note });
  /** The series shown: the championship under way's venue, else the one picked on LET'S RIDE. */
  const seriesAt = (): Venue => (profile.series.run ? venueOf(profile.series.run.venue) : seriesVenue);
  const seriesCard = () => seriesScreen(profile, head(["ride", "LET'S RIDE", `SERIES · ${seriesAt().toUpperCase()}`]), "", note, seriesAt());
  /** A mode's name for the cards (a series round is a race on the series' track). */
  /** The profile key of a ride's best distance: the biome (ENDLESS), "city" (Endless Wheelie City). */
  const farKey = (id: ModeId, map?: string) => (id === "endcity" ? "city" : id === "desert" ? map ?? "desert" : id);
  const km = (u: number) => dist(u, profile.settings.units);
  const modeName = (id: ModeId) => (id === "series" ? seriesName(profile) : modeOf(id).name);
  function settingsCard() {
    return `<div class="dh-card dh-set" data-screen="settings">${head([setFrom, setFrom === "ride" ? "LET'S RIDE" : setFrom === "series" ? "SERIES" : "GARAGE", "SETTINGS"])}<p class="dh-row"><button type="button" class="bui-key dh-sound" aria-pressed="${profile.settings.sound}">SOUND ${profile.settings.sound ? "ON" : "OFF"}</button><button type="button" class="bui-key dh-units" aria-label="Units: ${profile.settings.units === "metric" ? "metric, km and km/h" : "imperial, miles and mph"}">UNITS ${profile.settings.units === "metric" ? "KM · KM/H" : "MI · MPH"}</button><button type="button" class="bui-key dh-ctl-go" data-go="controls">CONTROLS · HOW TO</button></p>
      <b class="dh-h2">MOVE YOUR PROFILE</b><p class="dh-sub">Your garage lives on this device. Copy the code to carry it to another one; nothing leaves the device unless you do.</p>${inf ? `<p class="dh-sub dh-warn">Test credits are on: nothing here is saved, and the code is your saved profile, as it was.</p>` : ""}
      <label class="dh-field">EXPORT CODE<textarea class="dh-code" readonly rows="3">${code()}</textarea></label><p class="dh-row"><button type="button" class="bui-key dh-copy">COPY CODE</button></p>
      <label class="dh-field">IMPORT A CODE<textarea class="dh-codein" rows="3" spellcheck="false" placeholder="DH1-…"></textarea></label><p class="dh-row"><button type="button" class="bui-key dh-import">LOAD IT</button><button type="button" class="bui-key dh-reset">START OVER</button></p><p class="dh-sub dh-note" role="status">${esc(note)}</p></div>`;
  }
  /** CONTROLS · HOW TO (from settings): the game's real bindings, the same facts as the landing's
   *  Controls section (./data/controls.ts). One card, so it moves with the menus as they change. */
  function controlsCard() {
    const caps = (ks: string[]) => ks.map((k) => (k === "+" ? "<i>+</i>" : `<kbd>${esc(k)}</kbd>`)).join("");
    const keys = KEYS.map((g) => `<b class="dh-h3">${g.group}</b><ul class="dh-list">${g.rows.map(([ks, what, nb]) => `<li><span class="dh-caps">${caps(ks)}</span><span><b>${what}</b>${nb ? ` <small>${esc(nb)}</small>` : ""}</span></li>`).join("")}</ul>`).join("");
    const two = (rows: [string, string][]) => `<ul class="dh-list">${rows.map(([k, v]) => `<li><span><b>${esc(k)}</b> <small>${esc(v)}</small></span></li>`).join("")}</ul>`;
    return `<div class="dh-card dh-ctl" data-screen="controls">${head(["settings", "SETTINGS", "CONTROLS"])}<p class="dh-sub">Your bike rides every event: LET'S RIDE from the garage. Every mode pays credits; spend them on tyres, rebuilds, mods and paint.</p><div class="dh-cols"><section><b class="dh-h2">KEYBOARD</b>${keys}</section><section><b class="dh-h2">GAMEPAD</b>${two(PAD)}<b class="dh-h2">PHONE</b><p class="dh-sub">${TOUCH_LINE}</p>${two(TOUCH)}</section></div></div>`;
  }
  /** Rides with no finish line end when you say so, and pay for what you rode (the pause card's END & BANK). */
  const banks = () => runMode === "freeride" || runMode === "desert" || runMode === "endcity" || runMode === "mashup";
  function pauseCard() {
    // Online, the endless rides together bank too: END &amp; BANK rides this screen's END bit.
    const roamBank = N.on && (N.pick.kind === K_ENDLESS || N.pick.kind === K_ENDCITY);
    if (N.on) return `<div class="dh-card dh-pause" data-screen="pause" role="dialog" aria-label="Paused"><b class="dh-h">${rideTitle(N.pick.kind, N.pick.sub)}</b><p class="dh-sub">The ride goes on for everyone (your bike rolls to a stop). ${roamBank ? "END &amp; BANK banks your ride (the room's result comes when everyone has); leaving" : "Leaving"} the room now pays nothing; the wear so far still counts.</p><p class="dh-row"><button type="button" class="bui-key dh-go dh-resume">RESUME</button>${roamBank ? `<button type="button" class="bui-key dh-bank" aria-label="End the ride and bank it (E)">END &amp; BANK</button>` : ""}<button type="button" class="bui-key dh-leave">LEAVE ROOM</button></p></div>`;
    return `<div class="dh-card dh-pause" data-screen="pause" role="dialog" aria-label="Paused"><b class="dh-h">PAUSED</b><p class="dh-sub">${modeName(runMode)} on your ${bikeLine()}. ${banks() ? "END &amp; BANK pays for what you rode; leaving pays nothing" : "Leaving now pays nothing"}; the wear so far still counts.</p><p class="dh-row"><button type="button" class="bui-key dh-go dh-resume">RESUME</button>${banks() ? `<button type="button" class="bui-key dh-bank" aria-label="End the ride and bank it (E)">END &amp; BANK</button>` : ""}<button type="button" class="bui-key dh-leave">LEAVE</button></p></div>`;
  }
  function resultCard() {
    const r = result!, b = riding(profile), m = modelOf(b.model);
    if (N.on && N.res) return netResultCard(r, b, m);
    const lines = r.lines.map(([k, v]) => `<li${v < 0 ? " data-loss" : ""}><span>${k}</span><b>${v < 0 ? "−" : "+"}${num(Math.abs(v))}</b></li>`).join("") || `<li><span>NO PAYOUT</span><b>0</b></li>`;
    const wear = PARTS.map((k) => `<li>${bar(b.parts[k], k === "motor" ? MOTOR_NAME[m.cls] : PART_NAME[k])}<small>−${(r.wear[k] * 100).toFixed(1)}%</small></li>`).join("");
    return `<div class="dh-card dh-result" data-screen="result" role="dialog" aria-label="Result"><b class="dh-h">${r.stats.finished ? (r.stats.series ? `ROUND ${r.stats.series.round + 1}` : modeOf(r.stats.mode).name) + " · DONE" : "LEFT EARLY"}</b><p class="dh-sub">${esc(r.stats.summary ?? "")}</p><div class="dh-cols"><section><b class="dh-h2">PAYOUT</b><ul class="dh-pay">${lines}<li class="dh-total"><span>TOTAL</span><b>◈ ${num(r.credits)}</b></li></ul></section><section><b class="dh-h2">WEAR</b><ul class="dh-list dh-wear">${wear}</ul></section></div>${seriesResult(profile, r)}${pitReady(profile) ? `<p class="dh-row"><button type="button" class="bui-key dh-pit">PIT CREW: FREE BASIC FIX</button></p>` : ""}<p class="dh-row">${r.stats.mode === "series" ? seriesKeys(profile) : `<button type="button" class="bui-key dh-go" data-go="garage">GARAGE</button><button type="button" class="bui-key dh-again">RIDE AGAIN</button>`}<button type="button" class="bui-key" data-go="ride">LET'S RIDE</button></p></div>`;
  }

  function show(to: Screen | "menu") {
    const s: Screen = to === "menu" ? "garage" : to, was = screen;
    if (s === "settings" && screen !== "settings" && (screen === "ride" || screen === "series" || screen === "garage")) setFrom = screen;
    screen = s;
    if (s !== "event" && s !== "result" && run) run.destroy(), (run = null), (modeEl.textContent = "");
    if (s === "online") {
      stage.toggleAttribute("data-menu", true);
      cards.textContent = "";
      cards.append(roomC);
      cards.hidden = false;
      engine.wake();
      return;
    }
    const html = s === "setup" ? setupCard() : s === "garage" ? garageCard() : s === "ride" ? rideCard() : s === "series" ? seriesCard() : s === "settings" ? settingsCard() : s === "controls" ? controlsCard() : s === "result" ? resultCard() : paused ? pauseCard() : "";
    cards.innerHTML = html;
    cards.hidden = !html;
    stage.toggleAttribute("data-menu", s !== "event" && s !== "result");
    const slot = cards.querySelector("canvas-slot");
    if (slot) slot.replaceWith(pv), (pvKey = ""), requestAnimationFrame(preview);
    const sr = s === "garage" ? cards.querySelector<HTMLElement>(".dh-showroom") : null;
    if (sr) mountShowroom(sr);
    if (s === "ride") paintMaps(cards, pageTheme() === "dark");
    note = "";
    // (Into the garage from elsewhere, LET'S RIDE takes the focus: its one main action.)
    // (Within the garage, the focus stays on the key that was pressed, redrawn: or the open menu's first row.)
    const again = s === "garage" && was === "garage" ? (gui.menu ? cards.querySelector<HTMLElement>(".lk-menu-i, .lk-sheet .lk-x") : refocus ? cards.querySelector<HTMLElement>(refocus) : null) : null;
    refocus = "";
    const first = again ?? (s === "garage" && was !== "garage" ? cards.querySelector<HTMLElement>(".dh-letsride") : null) ?? cards.querySelector<HTMLElement>(".dh-go, [aria-pressed=true], button, input");
    if (s !== "event") first?.focus({ preventScroll: true });
    engine.wake();
  }
  const did = (r: Buy, what: string) => {
    if (r.ok) (profile = r.profile), keep(), (note = `${what} · ${r.spent < 0 ? "+" : ""}◈ ${num(Math.abs(r.spent))}`), say(note);
    else (note = r.why), say(r.why);
    const n = note;
    show(screen);
    note = n;
    const el = cards.querySelector(".dh-note");
    if (el) el.textContent = n;
  };

  // ---- an event ----
  function startEvent(id: ModeId, opt: StartOpt = {}) {
    if (!ready(profile)) return show("setup");
    if (id === "series" && !profile.series.run) return show("series");
    // A part that may fail (or has): say so before the ride; RIDE ANYWAY goes on.
    // (A street bike on the dirt asks too: ride anyway or pick another. ./model/families.ts)
    const risk = !o.attract && !opt.auto && !sure ? riskCard(profile, `${modeName(id)} on your ${bikeLine()}.`, dirtWarning(modelOf(riding(profile).model), id)) : "";
    (pending = risk ? [id, opt] : null), (sure = false);
    if (risk) return (cards.innerHTML = risk), (cards.hidden = false), cards.querySelector<HTMLElement>(".dh-risk-go")?.focus();
    run?.destroy();
    paused = false;
    result = null;
    runMode = id;
    runMap = opt.map;
    runVenue = opt.venue ?? "mx";
    const L2 = lookOf(profile), b = riding(profile);
    const ctx: ModeCtx = {
      host: modeEl,
      bike: onGround(tune(b), id),
      look: L2.look, helmet: L2.helmet, number: L2.number, name: profile.name,
      seed: opt.seed ?? ((o.seed ?? 20261114) + profile.stats.events * 7919) >>> 0,
      map: opt.map,
      venue: runVenue,
      best: id === "trackday" ? trackDayBest(profile.stats.best, opt.map) : profile.stats.far[farKey(id, opt.map)] ?? 0,
      units: profile.settings.units,
      auto: opt.auto ?? !!o.attract,
      attract: !!o.attract,
      reduced,
      sound: o.sound ?? profile.settings.sound,
      end: (s) => finishEvent(s),
      quit: (s) => finishEvent(s),
      menu: () => setPaused(true), theme: o.onTheme,
    };
    runSeed = ctx.seed;
    screen = "event";
    cards.innerHTML = "";
    cards.hidden = true;
    stage.removeAttribute("data-menu");
    run = id === "series" ? startRound(ctx, profile) : modeOf(id).start(ctx);
    say(`${modeName(id)} on your ${bikeLine()}`);
  }
  function finishEvent(s: RunStats) {
    if (!run || o.attract) return;
    // A series round: its tier and round on the stats (the prize lines), then the points table.
    if (runMode === "series") s = roundStats(profile, s);
    const r = garageRide(settle(s, riding(profile), profile.settings.units), riding(profile), runSeed);
    profile = after(apply(profile, r), r);
    if (s.mode === "series") profile = recordRound(profile, s).profile;
    keep();
    result = r;
    paused = false;
    show("result");
    say(`${r.credits} credits`);
  }
  function setPaused(on: boolean) {
    if (!run || screen !== "event" || o.attract) return;
    paused = on;
    // (Online the ride goes on under the card: a race or a jam lets go of the bike, a score run's
    // own minute keeps running.)
    if (!N.on || !N.ride?.score) run.pause(on);
    show("event");
  }
  function leave() {
    if (N.on) return netLeave();
    if (!run) return;
    run.pause(false);
    const s = { ...run.stats(), finished: false };
    finishEvent(s);
  }

  // ---- the garage's live preview: pointing at (or focusing) a paint, a kit piece, a mod or a bike
  // shows it on the turntable at once, with its pace against yours; leaving puts yours back (or the
  // pinned one). Tapping a mod or a bike card pins it: BUY / APPLY / CANCEL in the dock. ----
  const peek = (v: Pv | null, tell = false) => {
    const a = gui.peek;
    if (screen !== "garage" || (a === v || (a && v && a[0] === v[0] && a[1] === v[1]))) return;
    gui.peek = v;
    const el = cards.querySelector(".dh-pvinfo");
    if (el) el.innerHTML = bayInfo(profile, gui);
    if (tell && v) say(`Preview: ${pvName(profile, v)}`);
    preview();
  };
  cards.addEventListener("pointerover", (e) => e.pointerType !== "touch" && peek(pvOf(e.target as Element)), sig);
  cards.addEventListener("pointerleave", () => peek(null), sig);
  cards.addEventListener("focusin", (e) => peek(pvOf(e.target as Element), true), sig);
  cards.addEventListener("focusout", (e) => !cards.contains(e.relatedTarget as Node) && peek(null), sig);
  cards.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && screen === "garage" && gui.menu) return e.stopPropagation(), (gui.menu = ""), show("garage");
    if (e.key !== "Escape" || screen !== "garage" || !gui.trial) return;
    gui.trial = gui.peek = null;
    say("Preview cancelled");
    show("garage");
  }, sig);

  // ---- input on the cards ----
  cards.addEventListener("click", (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>("button");
    if (!t) {
      const v = screen === "garage" ? pvOf(ev.target as Element) : null;
      if (v && (v[0] === "mod" || v[0] === "bike" || v[0] === "own")) (gui.trial = v), (gui.peek = null), show("garage"), say(`Preview: ${pvName(profile, v)}. ${v[0] === "own" ? "Apply" : "Buy"} or cancel.`);
      return;
    }
    const d = t.dataset;
    if (t.classList.contains("dh-theme")) return o.onTheme?.();
    if (d.go === "series" && d.venue) seriesVenue = d.venue as Venue;
    if (d.go) return show(d.go as Screen);
    refocus = [...t.attributes].filter((a) => a.name.startsWith("data-") && a.name !== "data-sure").map((a) => `[${a.name}="${CSS.escape(a.value)}"]`).join("");
    const g = screen === "garage" ? garageClick(profile, gui, t, cards) : null;
    if (g) return g.buy ? did(g.buy[0], g.buy[1]) : (g.profile && ((profile = g.profile), keep()), show("garage"));
    if (t.classList.contains("dh-risk-go") && pending) return (sure = true), startEvent(pending[0], pending[1]);
    if (t.classList.contains("ol-open")) return openRoom(d.olkind ? Number(d.olkind) : undefined);
    if (d.mode) return startEvent(d.mode as ModeId, d.venue ? { venue: d.venue as Venue } : {});
    if (d.endless) return startEvent("desert", { map: d.endless });
    if (d.circuit) return startEvent("trackday", { map: d.circuit });
    if (d.map) return startEvent("freeride", { map: d.map, venue: d.venue === "sx" ? "sx" : "mx" });
    if (d.seriesEnter) {
      const p = enterSeries(profile, d.seriesEnter as TierId, ((o.seed ?? 20261114) ^ Math.imul(profile.stats.events + 1, 0x9e3779b1) ^ Math.imul(profile.series.titles + 7, 0x85ebca6b)) >>> 0, seriesVenue);
      if (p) (profile = p), keep();
      return show("series");
    }
    if (d.seriesGo !== undefined) return startEvent("series", { venue: seriesAt() });
    if (d.seriesRetire !== undefined) {
      if (t.dataset.sure === undefined) return (t.dataset.sure = ""), (t.textContent = "SURE? TAP AGAIN");
      return (profile = retireSeries(profile)), keep(), show("series");
    }
    if (t.classList.contains("dh-resume")) return setPaused(false);
    if (t.classList.contains("dh-leave")) return leave();
    if (t.classList.contains("dh-bank")) return run && (setPaused(false), run.finish());
    if (t.classList.contains("dh-again")) return startEvent(runMode, { map: runMap, venue: runVenue });
    if (t.classList.contains("dh-pit")) return (profile = pitFix(profile)), keep(), say("The pit crew fixed it up"), show(screen === "result" ? "result" : "garage");
    if (t.classList.contains("dh-units")) return (profile = { ...profile, settings: { ...profile.settings, units: profile.settings.units === "metric" ? "imperial" : "metric" } }), keep(), show("settings");
    if (t.classList.contains("dh-sound")) return (profile = { ...profile, settings: { ...profile.settings, sound: !profile.settings.sound } }), keep(), show("settings");
    if (t.classList.contains("dh-copy")) {
      void navigator.clipboard?.writeText(code()).then(() => say("Copied"), () => {});
      (cards.querySelector(".dh-code") as HTMLTextAreaElement | null)?.select();
      return;
    }
    if (t.classList.contains("dh-import")) {
      const r = importCode((cards.querySelector(".dh-codein") as HTMLTextAreaElement).value);
      if ("error" in r) return (note = r.error), show("settings"), (cards.querySelector(".dh-note")!.textContent = r.error);
      profile = r.profile;
      keep();
      return show(ready(profile) ? "garage" : "setup");
    }
    if (t.classList.contains("dh-reset")) {
      if (t.dataset.sure === undefined) return (t.dataset.sure = ""), (t.textContent = "SURE? TAP AGAIN");
      profile = fresh();
      keep();
      return show("setup");
    }
  }, sig);
  cards.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (!(ev.target as HTMLElement).classList.contains("dh-setup")) return;
    const f = ev.target as HTMLFormElement, v = (n: string) => (f.elements.namedItem(n) as RadioNodeList | HTMLInputElement | null)?.value ?? "";
    const kit: Partial<RiderKit> = { jersey: v("jersey") || "cyan" };
    profile = setup(profile, { starter: v("starter"), paint: v("paint"), number: Math.max(1, Math.min(99, Math.round(+v("number") || 7))), name: v("name"), kit });
    keep();
    // A join link waits for the first-run setup: then straight into its room.
    if (linkJoin) return openRoom();
    show("garage");
  }, sig);

  // ---- online: the room, the match (./online/match.ts: one rollback link for as long as the room
  // lasts), each ride on every screen, the result with the online bonus, the next ride, leaving ----
  const qs = new URLSearchParams(typeof location === "object" ? location.search : "");
  const ROOMS_URL = qs.get("rooms") ?? o.rooms ?? "", ROOM_N = 16;
  const COLORS = ["#22e6ff", "#ff4fa8", "#b6ff3b", "#ff8a3d"];
  const roomC = document.createElement("div");
  roomC.className = "dh-card ol-room";
  roomC.setAttribute("role", "dialog");
  roomC.setAttribute("aria-label", "Online");
  roomC.innerHTML = roomCard();
  const netChip = document.createElement("p");
  netChip.className = "ol-chip";
  netChip.hidden = true;
  netChip.innerHTML = "<i></i><span></span>";
  const board = document.createElement("ol");
  board.className = "ol-board";
  board.hidden = true;
  board.setAttribute("aria-label", "Scores");
  stage.append(netChip, board);
  const $r = <T extends Element = HTMLElement>(sel: string) => roomC.querySelector(sel) as T;
  const N = {
    on: false,
    seat: 0,
    players: 2,
    room: Math.min(ROOM_N - 1, Math.max(0, Number(qs.get("room")) | 0)),
    code: "",
    /** Seats per room: what the room server allows (its /invite says), at most SEATS. */
    size: SEATS,
    pick: { kind: K_RACE, sub: 0 },
    abort: null as AbortController | null,
    go: null as (() => void) | null,
    m: null as Match | null,
    ride: null as Ride | null,
    /** The ride's result (every seat's), once it is over; this screen's score run, once it ended. */
    res: null as SeatResult[] | null,
    mine: null as RunStats | null,
    final: 0,
    leftSeen: 0,
    /** The chip's and the board's last text (repainted only on a change). */
    chip: "",
    boardKey: "",
    readySeen: -1,
  };
  let myName = cleanName(profile.name || "");
  const field = (n: string) => roomC.querySelector(`[name="${n}"]`) as HTMLInputElement;
  const roomSay = (t: string) => roomC.querySelectorAll(".ol-say").forEach((el) => (el.textContent = t));
  const showRoomN = () => (($r<HTMLOutputElement>("output[name=roomShow]")).value = String(N.room));
  showRoomN();
  type Step = "pick" | "host" | "join" | "wait" | "hello" | "gone";
  function roomStep(st: Step) {
    roomC.dataset.step = st;
    // The header: the host's pick says what it's for; a joiner's says whose ride (the pick comes at LINING UP).
    if (st === "pick" || st === "host" || st === "join") $r(".ol-room-h").textContent = st === "join" ? JOIN_TITLE : roomTitle(N.pick.kind);
    for (const el of roomC.querySelectorAll<HTMLElement>("[data-for]")) el.hidden = el.dataset.for !== st;
    roomC.querySelector<HTMLElement>(`[data-for="${st}"] :is(input, button:not([hidden]))`)?.focus({ preventScroll: true });
  }
  /** A link with a room and a code (the play page takes the code out of the address bar first and
   *  hands it over as window.__holeshotInvite) drops the rider straight into that room, once. */
  let linkJoin = false;
  {
    const w = (typeof window === "object" ? window : {}) as { __holeshotInvite?: string }, linked = qs.get("code") || w.__holeshotInvite || "";
    field("code").value = linked || (() => { try { return sessionStorage.getItem("holeshot:code") || ""; } catch { return ""; } })();
    delete w.__holeshotInvite;
    linkJoin = qs.get("mode") === "online" && qs.has("room") && !!linked;
  }
  /** The room card; `kind` (a LET'S RIDE group's ONLINE tile) picks what the host rides first. */
  function openRoom(kind?: number) {
    if (inf) return say("Online is off with test credits"), show("ride");
    if (!ready(profile)) return show("setup");
    show("online");
    roomStep("pick");
    if (kind !== undefined) roomC.querySelector<HTMLElement>(`[data-olkind="${kind}"]`)?.click();
    if (!field("who").value) field("who").value = cleanName(profile.name);
    $r(".ol-share").textContent = "SEND LINK";
    roomSay(ROOMS_URL ? "" : "Online play needs a room server: this build has none set.");
    if (linkJoin && ROOMS_URL) (linkJoin = false), void pickGo("link");
  }
  /** Is the code on the list? {ok, players} (the seats a room may have), "slow", or null (no server). */
  async function checkCode(code: string) {
    const r = await fetch(`${ROOMS_URL.replace(/^ws/, "http")}/invite`, { method: "POST", body: code, referrerPolicy: "no-referrer" }).catch(() => null);
    if (!r) return null;
    if (r.status === 429) return "slow" as const;
    const j = (await r.json().catch(() => ({}))) as { players?: number };
    return { ok: r.ok, players: Number(j.players) || 2 };
  }
  /** HOST, JOIN or a join link: the name and the code first. */
  async function pickGo(how: "host" | "join" | "link") {
    if (!ROOMS_URL) return roomSay("Online play needs a room server: this build has none set.");
    myName = cleanName(field("who").value) || cleanName(profile.name);
    field("who").value = myName;
    const code = field("code").value.trim().toUpperCase();
    if (code.length < 6) return roomSay("Enter the invite code you were sent."), field("code").focus();
    roomSay("Checking the code…");
    const ok = await checkCode(code);
    if (ok === null) return roomSay("Can't reach the game server. Check your connection and try again.");
    if (ok === "slow") return roomSay("Too many tries. Wait a minute, then try again.");
    if (!ok.ok) return roomSay("That invite code isn't on the list.");
    roomSay("");
    N.code = code;
    N.size = Math.max(2, Math.min(SEATS, ok.players));
    try {
      sessionStorage.setItem("holeshot:code", code);
    } catch {}
    if (how === "link") return enterRoom(false, N.size);
    if (how === "join") return showRoomN(), roomStep("join");
    for (const b of roomC.querySelectorAll<HTMLButtonElement>("[data-olsize]")) b.hidden = Number(b.dataset.olsize) > N.size;
    roomStep("host");
  }
  const press = (sel: string, v: string, attr: string) => roomC.querySelectorAll<HTMLButtonElement>(sel).forEach((b) => b.setAttribute("aria-pressed", "" + (b.dataset[attr] === v)));
  roomC.addEventListener("click", (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!t) return;
    const d = t.dataset;
    if (d.olkind !== undefined) {
      N.pick.kind = Number(d.olkind);
      press("[data-olkind]", d.olkind, "olkind");
      $r(".ol-tiers").hidden = N.pick.kind !== K_RACE;
      $r(".ol-maps").hidden = N.pick.kind !== K_JAM;
      $r(".ol-biomes").hidden = N.pick.kind !== K_ENDLESS;
      press("[data-olbiome]", "0", "olbiome");
      N.pick.sub = 0;
      press("[data-oltier]", "0", "oltier");
      press("[data-olmap]", "0", "olmap");
      $r(".ol-kind-sub").textContent = kindOf(N.pick.kind).blurb;
      $r(".ol-room-h").textContent = roomTitle(N.pick.kind);
    } else if (d.oltier !== undefined) (N.pick.sub = Number(d.oltier)), press("[data-oltier]", d.oltier, "oltier");
    else if (d.olmap !== undefined) (N.pick.sub = Number(d.olmap)), press("[data-olmap]", d.olmap, "olmap");
    else if (d.olbiome !== undefined) (N.pick.sub = Number(d.olbiome)), press("[data-olbiome]", d.olbiome, "olbiome");
    else if (d.olsize) (N.room = (Math.random() * ROOM_N) | 0), void enterRoom(true, Number(d.olsize));
    else if (d.olroom) (N.room = (N.room + Number(d.olroom) + ROOM_N) % ROOM_N), showRoomN();
    else if (t.classList.contains("ol-back")) netEnd(), show("ride");
    else if (t.classList.contains("ol-topick")) roomStep("pick");
    else if (t.classList.contains("ol-again")) roomStep("pick");
    else if (t.classList.contains("ol-cancel")) N.abort?.abort(), (N.go = null), roomStep("pick");
    else if (t.classList.contains("ol-gonow")) N.go?.();
    else if (t.classList.contains("ol-share")) void share();
  }, sig);
  $r<HTMLFormElement>(".ol-pick").addEventListener("submit", (ev) => {
    ev.preventDefault();
    void pickGo((ev as SubmitEvent).submitter?.classList.contains("ol-joink") ? "join" : "host");
  }, sig);
  $r<HTMLFormElement>('form[data-for="join"]').addEventListener("submit", (ev) => (ev.preventDefault(), void enterRoom(false, N.size)), sig);
  async function share() {
    const url = `${location.origin}${location.pathname}?mode=online&room=${N.room}${qs.get("rooms") ? `&rooms=${encodeURIComponent(ROOMS_URL)}` : ""}${N.code ? `&code=${encodeURIComponent(N.code)}` : ""}`, k = $r(".ol-share");
    try {
      if (navigator.share) await navigator.share({ title: "HOLESHOT · online", text: `Ride me in HOLESHOT: room ${N.room}.`, url });
      else await navigator.clipboard.writeText(url), (k.textContent = "LINK COPIED");
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        k.textContent = "LINK COPIED";
      } catch {
        k.textContent = "COPY FAILED";
      }
    }
  }
  async function enterRoom(host: boolean, wantN: number) {
    roomStep("wait");
    $r(".ol-t-code").textContent = N.code;
    $r(".ol-t-ride").textContent = host ? pickName(N.pick.kind, N.pick.sub) : "";
    if (!host) $r(".ol-room-h").textContent = JOIN_TITLE;
    $r(".ol-room-sub").textContent = "CONNECTING";
    $r(".ol-wait-say").textContent = host ? "Opening a room…" : `Joining room ${N.room}…`;
    $r(".ol-gonow").hidden = true;
    $r(".ol-seats").innerHTML = "";
    N.abort = new AbortController();
    const signal = N.abort.signal, mine = packMode(N.pick.kind, N.pick.sub);
    for (let tries = 0; ; tries++) {
      $r(".ol-t-room").textContent = "" + N.room;
      const one = new AbortController(), stop = () => one.abort();
      signal.addEventListener("abort", stop, { once: true });
      let busy = false;
      try {
        const st = await joinRoom(ROOMS_URL, N.room, N.size, N.code, {
          want: wantN, mode: mine, signal: one.signal,
          lobby(seat, seated, n, go) {
            // HOST wants a room of its own: someone is in this one, so try the next.
            if (host && seat !== 0) return void ((busy = true), one.abort());
            N.go = seat === 0 ? go : null;
            const size = seat === 0 ? Math.min(n, wantN) : n, left = Math.max(0, size - seated);
            $r(".ol-seats").innerHTML = seatsHTML(seat, seated, size, myName, COLORS);
            $r(".ol-room-sub").textContent = `ROOM ${N.room} · ${seated} OF ${size} IN`;
            $r(".ol-wait-say").textContent = seat === 0 ? (left ? `Waiting for ${left} more…` : "Starting…") : "You're in. The host starts the ride.";
            $r(".ol-gonow").hidden = !(seat === 0 && seated > 1 && left > 0);
          },
        });
        signal.removeEventListener("abort", stop);
        if (signal.aborted || engine.signal.aborted) return st.transport.close();
        N.abort = null;
        return begin(st);
      } catch {
        signal.removeEventListener("abort", stop);
        if (signal.aborted || engine.signal.aborted) return;
        N.go = null;
        if (host && tries < ROOM_N) {
          N.room = (N.room + 1) % ROOM_N;
          if (!busy) await new Promise((ok) => setTimeout(ok, 300));
          continue;
        }
        if (tries >= 2) return roomStep("gone"), ($r(".ol-gone-say").textContent = host ? "Every room is busy right now. Try again in a minute." : `Room ${N.room} is full, mid-ride or closed. Check the number with the host.`);
        await new Promise((ok) => setTimeout(ok, 1200));
      }
    }
  }

  /** The room started: the match on this seat (the same frames on every screen). */
  function begin(st: { transport: Transport; slot: number; players: number; seed: number; mode: number }) {
    N.on = true;
    N.seat = st.slot;
    N.players = Math.max(2, Math.min(SEATS, st.players));
    N.pick = unpackMode(st.mode);
    N.leftSeen = 0;
    N.go = null;
    N.res = N.mine = null;
    N.chip = N.boardKey = "";
    roomStep("hello");
    $r(".ol-room-sub").textContent = `ROOM ${N.room} · ${pickName(N.pick.kind, N.pick.sub)}`;
    $r(".ol-room-h").textContent = roomTitle(N.pick.kind);
    N.m = match(engine, {
      transport: st.transport, seat: st.slot, players: N.players, seed: st.seed, mode: st.mode, profile: { ...profile, name: myName || profile.name },
      input: netInput,
      hooks: {
        built: netBuilt,
        events: () => (run as NetRun | null)?.events?.(),
        over: netOver,
        rewind: (before) => (run as NetRun | null)?.rewind?.(before),
      },
    });
    say(`Online, room ${N.room}: lining up`);
    // (The shell's engine may have settled on the room card: the match keeps it awake from here.)
    engine.wake();
    engine.busy();
  }
  /** This screen's bits for frame f: its riding (the autopilot as a bit), or a score run's score. */
  function netInput() {
    const r = N.ride;
    if (!r || !run || (screen !== "event" && screen !== "result")) return 0;
    if (r.score) {
      const done = !!N.mine;
      return scoreBits(done ? N.final : Number(run.state.score) || 0, done);
    }
    const I = (run as NetRun).input(), k = (run as NetRun).cmd?.() ?? 0;
    // The endless rides' commands: END (banked), REGROUP, a hop (Endless Wheelie City), the combo button.
    const cmd = (k & C_END ? B_DONE : 0) | (k & C_REGROUP ? B_REGROUP : 0) | (k & C_HOP ? B_HOP : 0) | (k & C_COMBO ? B_COMBO : 0);
    return encode(I[0]!, I[1]!, I[2]!, I[3]!, (run.auto ? B_AUTO : 0) | (I[4] === 2 ? B_RESET : 0) | cmd);
  }
  /** Each rider's tag: people's names ("· AI" once they left), the race's AI rivals'. */
  function tags() {
    const r = N.ride!, left = N.m?.link.left ?? 0, out = r.riders.map((x, p) => (p === N.seat ? "" : x.name + (left & (1 << p) ? " · AI" : "")));
    for (const a of r.ai) out.push(a.name);
    return out;
  }
  /** A ride was built (every screen on the same frame): mount it on this screen's seat. */
  function netBuilt(r: Ride) {
    N.ride = r;
    N.res = N.mine = null;
    N.boardKey = "";
    run?.destroy();
    modeEl.textContent = "";
    const me = r.riders[N.seat]!, L2 = lookOf(me.profile), t = r.tuned[N.seat]!;
    const ctx: ModeCtx = {
      host: modeEl, bike: t, look: L2.look, helmet: L2.helmet, number: L2.number, name: me.name, seed: r.seed,
      auto: false, attract: false, reduced, sound: o.sound ?? profile.settings.sound, units: profile.settings.units,
      // (A score run ends on this screen first; the result waits for everyone.)
      end: (st) => netScoreEnd(st), quit: (st) => netScoreEnd(st), menu: () => setPaused(true), theme: o.onTheme,
    };
    paused = false;
    result = null;
    const view: NetView = { ride: r, seat: N.seat, names: tags(), looks: r.riders.map((x, i) => { const l = lookOf(x.profile); return { look: l.look, helmet: l.helmet, rig: r.tuned[i]!.rig, model: r.tuned[i]!.model.id, number: l.number }; }) };
    if (r.city) {
      // Endless Wheelie City together: this seat's own run (its window, its patrol), every rider drawn.
      runMode = "endcity";
      ctx.best = profile.stats.far.city ?? 0;
      run = mountCity(ctx, view);
    } else if (r.race || r.jam) {
      runMode = r.race ? "race" : r.board ? "desert" : "freeride";
      // An endless ground together: this seat's own track (its window of the same world).
      const own = r.board ? r.jam!.runs[N.seat]!.track : r.track!;
      if (r.board) ctx.best = profile.stats.far[(own as { id: string }).id] ?? 0;
      run = mountTrack(ctx, own, !!r.jam, [], {}, view);
    } else {
      // (Online offers Big Air as its score run: Wheelie City's ninety-second session went with the
      // fixed city; Endless Wheelie City has no clock to race to.)
      runMode = "bigair";
      run = modeOf(runMode).start(ctx);
    }
    runMap = undefined;
    runSeed = r.seed;
    screen = "event";
    cards.textContent = "";
    cards.hidden = true;
    stage.removeAttribute("data-menu");
    board.hidden = !r.score && !r.board;
    // (The endless rides' board sits high on a phone, clear of the pad; the online result hides the pad.)
    stage.toggleAttribute("data-olboard", !!r.board);
    stage.removeAttribute("data-olres");
    say(`${pickName(r.kind, r.sub)}, ride ${r.round + 1}, on your ${bikeLine()}`);
  }
  /** A score run ended on this screen: its stats wait for everyone's (the result needs them all). */
  function netScoreEnd(st: RunStats) {
    if (N.mine || !N.ride?.score) return;
    N.mine = st;
    N.final = N.ride.kind === K_AIR ? Math.round((st.judges ?? 0) * 10) : Math.round(st.score ?? 0);
    cards.innerHTML = `<div class="dh-card dh-result" role="status"><b class="dh-h">${N.ride.kind === K_AIR ? `JUDGES ${(N.final / 10).toFixed(1)}` : `${N.final.toLocaleString("en-US")} PTS`}</b><p class="dh-sub">Waiting for the others to finish their run…</p></div>`;
    cards.hidden = false;
  }
  /** The ride is over (the same final frame on every screen): this rider's own payout and wear. */
  function netOver(r: Ride, res: SeatResult[], _f: number) {
    if (!N.on) return;
    const me = res[N.seat]!, left = N.m!.link.left, M = me.M, now = Date.now();
    const beat = res.filter((x, p) => p !== N.seat && !(left & (1 << p)) && x.place > me.place).length;
    const common = { seconds: M[0]!, distance: M[1]!, gas: M[2]!, air: M[3]!, wheelie: M[4]!, crashes: M[5]!, hard: M[6]! };
    const ORD = ["1ST", "2ND", "3RD", "4TH"], clock = (v: number) => `${(v / 60) | 0}:${(v % 60).toFixed(1).padStart(4, "0")}`;
    let st: RunStats;
    // (A rider still out when the grace time ran out is placed by how far they got, and paid for it.)
    if (r.race) st = { ...blankStats("race"), ...common, place: me.place, time: me.time, bestLap: me.bestLap, finished: true, led: false, where: "online", summary: `Online · ${ORD[me.place]} of ${r.race.riders.length}${me.finished ? ` · ${clock(me.time)}` : " · didn't finish"} · best lap ${clock(me.bestLap)}` };
    else if (r.board) {
      // The endless rides: the distance (each ground's best, kept as riding it alone), the session's points.
      const where = r.city ? "city" : (r.jam!.runs[N.seat]!.track as { id: string }).id, what = r.city ? "Endless Wheelie City" : pickName(r.kind, r.sub);
      st = { ...blankStats(r.city ? "endcity" : "desert"), ...common, finished: true, tricks: me.tricks, flips: me.flips, score: me.points, far: me.far, farKey: where, where: "online-endless", summary: `Online · ${what} · ${ORD[me.place]} of ${r.players} · ${km(me.far)} · ${me.points.toLocaleString("en-US")} points${me.drags ? ` · ${me.drags} hand drag${me.drags === 1 ? "" : "s"}` : ""}` };
    } else if (r.jam) st = { ...blankStats("freeride"), ...common, finished: true, tricks: me.tricks, flips: me.flips, score: me.points, where: "online-jam", summary: `Online jam · ${ORD[me.place]} of ${r.players} · ${me.points.toLocaleString("en-US")} trick points` };
    else {
      const s0 = N.mine ?? { ...(run?.stats() ?? blankStats(runMode)), finished: false };
      st = { ...s0, summary: `Online · ${ORD[me.place]} of ${r.players} · ${s0.summary ?? ""}` };
    }
    const r0 = settleOnline(st, riding(profile), { beat, times: profile.online, now, units: profile.settings.units }), rr = garageRide(r0, riding(profile), r.seed);
    profile = after(applyOnline(profile, rr, now), rr);
    keep();
    result = rr;
    N.res = res;
    N.readySeen = -1;
    paused = false;
    run?.pause(false);
    board.hidden = true;
    stage.toggleAttribute("data-olres", true);
    show("result");
    say(`${ORD[me.place]}. ${rr.credits} credits`);
  }
  function netResultCard(r: NonNullable<typeof result>, b: ReturnType<typeof riding>, m: ReturnType<typeof modelOf>) {
    const ride = N.ride!, names = ride.riders.map((x, p) => (p === N.seat ? `${x.name} (YOU)` : x.name));
    const lines = r.lines.map(([k, v]) => `<li${v < 0 ? " data-loss" : ""}><span>${esc(k)}</span><b>${v < 0 ? "−" : "+"}${num(Math.abs(v))}</b></li>`).join("") || `<li><span>NO PAYOUT</span><b>0</b></li>`;
    const wear = PARTS.map((k) => `<li>${bar(b.parts[k], k === "motor" ? MOTOR_NAME[m.cls] : PART_NAME[k])}<small>−${(r.wear[k] * 100).toFixed(1)}%</small></li>`).join("");
    const others = ((1 << N.players) - 1) & ~(1 << N.seat), alone = (N.m!.link.left & others) === others;
    return `<div class="dh-card dh-result ol-result" data-screen="result" role="dialog" aria-label="Result"><b class="dh-h">${rideTitle(ride.kind, ride.sub)}</b><p class="dh-sub">${esc(r.stats.summary ?? "")}</p>${standingsHTML(ride, N.res!, N.seat, names, profile.settings.units)}<div class="dh-cols"><section><b class="dh-h2">PAYOUT</b><ul class="dh-pay">${lines}<li class="dh-total"><span>TOTAL</span><b>◈ ${num(r.credits)}</b></li></ul></section><section><b class="dh-h2">WEAR</b><ul class="dh-list dh-wear">${wear}</ul></section></div>${pitReady(profile) ? `<p class="dh-row"><button type="button" class="bui-key dh-pit">PIT CREW: FREE BASIC FIX</button></p>` : ""}<p class="dh-row">${alone ? "" : `<button type="button" class="bui-key dh-go ol-ready" aria-pressed="${N.m!.ready}">${N.m!.ready ? "WAITING…" : "RIDE AGAIN"}</button>`}<button type="button" class="bui-key dh-leave">LEAVE ROOM</button></p><p class="dh-sub ol-ready-say" aria-live="polite">${alone ? "Everyone else left the room." : ""}</p></div>`;
  }
  cards.addEventListener("click", (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>(".ol-ready");
    if (!t || !N.m) return;
    N.m.ready = !N.m.ready;
    t.setAttribute("aria-pressed", "" + N.m.ready);
    t.textContent = N.m.ready ? "WAITING…" : "RIDE AGAIN";
    N.readySeen = -1;
  }, sig);
  /** Leave the room mid-ride or after it: no pay for a ride left, its wear still counts. */
  function netLeave() {
    if (run && screen === "event" && N.ride && !N.res) {
      const st = N.ride.race || N.ride.jam ? { ...run.stats(), finished: false } : { ...(N.mine ?? run.stats()), finished: false };
      const r = garageRide(settle(st, riding(profile), profile.settings.units), riding(profile), N.ride.seed);
      profile = after(apply(profile, r), r);
      keep();
      note = "Left the room. A ride left pays nothing; its wear counts.";
    }
    netEnd();
    paused = false;
    const n = note;
    show("garage");
    note = n;
  }
  /** The match is over for this screen (left, lost, out of sync). */
  function netEnd() {
    N.abort?.abort();
    N.abort = null;
    N.go = null;
    const was = N.on;
    N.on = false;
    try {
      N.m?.destroy();
    } catch {}
    N.m = null;
    N.ride = null;
    N.res = N.mine = null;
    netChip.hidden = board.hidden = true;
    stage.removeAttribute("data-olres");
    stage.removeAttribute("data-olboard");
    if (was && run) run.destroy(), (run = null), (modeEl.textContent = "");
  }
  function netGone(text: string) {
    if (N.ride && !N.res && run && screen === "event") {
      // Mid-ride: the wear so far counts, no pay (as leaving).
      const st = { ...run.stats(), finished: false }, r = garageRide(settle(st, riding(profile), profile.settings.units), riding(profile), N.ride.seed);
      profile = after(apply(profile, r), r);
      keep();
    }
    netEnd();
    show("online");
    roomStep("gone");
    $r(".ol-gone-say").textContent = text;
    say(text);
  }
  const popcount = (b: number) => {
    let n = 0;
    for (; b; b &= b - 1) n++;
    return n;
  };
  // Every frame while online: the link's news (a seat left, reconnecting, out of sync), the chip,
  // the score board, the rematch count. Text is written only when it changes.
  const SB = new Float64Array(SEATS);
  engine.add({
    step(e) {
      if (!N.on || !N.m) return;
      e.busy();
      const L2 = N.m.link, others = ((1 << N.players) - 1) & ~(1 << N.seat);
      if (L2.lost & (1 << N.seat)) return netGone("Lost the connection to the room.");
      if (L2.desync >= 0) return netGone("The screens fell out of sync. Start a new room.");
      if (L2.left !== N.leftSeen) {
        for (let p = 0; p < N.players; p++) if (L2.left & ~N.leftSeen & (1 << p)) say(`${N.ride?.riders[p]?.name ?? "P" + (p + 1)} left; the AI rides their bike`);
        N.leftSeen = L2.left;
        if (N.ride && run && "tags" in run) (run as NetRun).tags(tags());
        if (screen === "result" && N.res) show("result");
        // Everyone else gone before the ride: nothing to ride for.
        if ((L2.left & others) === others && !N.ride) return netGone(N.players > 2 ? "Everyone else left the room." : "The other rider left the room.");
      }
      const away = L2.away & ~(1 << N.seat);
      let chip = `${kindOf(N.pick.kind).head} · ONLINE · ROOM ${N.room} · ${myName || "YOU"}`;
      for (let p = 0; p < N.players; p++) if (away & (1 << p)) chip += ` · ${N.ride?.riders[p]?.name ?? "P" + (p + 1)} RECONNECTING`;
      if (L2.away & (1 << N.seat)) chip += " · RECONNECTING";
      if (chip !== N.chip) (N.chip = chip), (netChip.lastElementChild!.textContent = chip), (netChip.dataset.conn = L2.away ? "wait" : "live"), netChip.toggleAttribute("data-quiet", !L2.away);
      netChip.hidden = !N.ride || screen !== "event";
      const bd = N.ride?.board;
      if (bd && screen === "event") {
        // The endless rides' session scoreboard: repainted when a number on it moves (points, tens of metres).
        let key = "";
        for (let p = 0; p < N.players; p++) key += `${bd.get(p, 6)}:${Math.floor(bd.get(p, 0) / 10)}:${bd.get(p, 1)}:${bd.get(p, 4)};`;
        if (key !== N.boardKey) (N.boardKey = key), (board.innerHTML = boardHTML(bd, N.seat, N.ride!.riders.map((x) => x.name), N.ride!.riders.map((x) => lookOf(x.profile).look.plastic), profile.settings.units));
      }
      const sc = N.ride?.score;
      if (sc && screen === "event") {
        let changed = N.boardKey === "";
        for (let p = 0; p < N.players; p++) if (SB[p] !== sc.SC[p]! + sc.DN[p]! * 0.5) (SB[p] = sc.SC[p]! + sc.DN[p]! * 0.5), (changed = true);
        if (changed) {
          N.boardKey = "x";
          const air = N.ride!.kind === K_AIR;
          board.innerHTML = N.ride!.riders.map((x, p) => `<li${p === N.seat ? " data-me" : ""}><i style="background:${lookOf(x.profile).look.plastic}"></i><span>${esc(x.name)}</span><b>${sc.DN[p] ? (air ? `J ${(sc.SC[p]! / 10).toFixed(1)}` : num(sc.SC[p]!)) + " ✓" : num(sc.SC[p]!)}</b></li>`).join("");
        }
      }
      if (screen === "result" && N.res) {
        const rb = L2.left | (N.m.ready ? 1 << N.seat : 0), key = rb * 16 + (N.m.ready ? 1 : 0);
        if (key !== N.readySeen) {
          N.readySeen = key;
          const el = cards.querySelector(".ol-ready-say");
          if (el && (L2.left & others) !== others) el.textContent = N.m.ready ? `Ready. The next ride starts when everyone is (${popcount(rb)} of ${N.players}).` : "RIDE AGAIN: a new ride for the whole room when everyone presses it.";
        }
      }
    },
  });
  engine.signal.addEventListener("abort", () => netEnd(), { once: true });

  // ---- keys: P / Escape pause (Escape gives the page back when dropped onto a page) ----
  const src = (e: Event) => (e.composedPath?.()[0] ?? e.target) as Element | null;
  window.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || o.attract) return;
    const typing = !!src(e)?.closest?.("input,textarea,select");
    if (e.code === "Escape") {
      // Escape steps back a screen (controls, settings, the series, LET'S RIDE); from the garage it gives the
      // page back when dropped onto one.
      const up: Screen | null = screen === "controls" ? "settings" : screen === "settings" ? setFrom : screen === "series" ? "ride" : screen === "ride" ? "garage" : null;
      if (up && !(screen === "settings" && typing)) return void (e.preventDefault(), show(up));
      if (dropIn && screen !== "event") return void (e.preventDefault(), api.destroy());
      if (screen === "event") return void (e.preventDefault(), setPaused(!paused));
      return;
    }
    if (e.code === "KeyP" && !typing && screen === "event") return void (e.preventDefault(), setPaused(!paused));
  }, sig);
  if (dropIn) L.style(document.documentElement, "overflow", "hidden");

  if (o.attract) startEvent("race", { auto: true, seed: o.seed ?? 20261114 });
  // A join link (?mode=online&room=N&code=…) opens the room card and joins (after the setup, for a new rider).
  else if (linkJoin && ready(profile)) openRoom();
  else show(ready(profile) ? "garage" : "setup");
  engine.start();

  const api = {
    engine,
    /** The running event (its engine, state, camera), or null. */
    get run() {
      return run;
    },
    get profile(): Readonly<Profile> {
      return profile;
    },
    get result() {
      return result;
    },
    /** Show a screen. */
    show,
    /** Start an event on the riding bike now. */
    start: startEvent,
    /** End the running event now (the result follows). */
    finish: () => run?.finish(),
    pause: () => setPaused(true),
    resume: () => setPaused(false),
    leave,
    /** The first-run setup, done in code (tests). */
    setup(opt: { starter: string; paint?: string; number?: number; name?: string }) {
      profile = setup(profile, { paint: "gridline", number: 7, name: "RIDER", ...opt });
      keep();
      show("garage");
    },
    exportCode: code,
    importCode(code: string) {
      const r = importCode(code);
      if ("profile" in r) (profile = r.profile), keep(), show(ready(profile) ? "garage" : "setup");
      return r;
    },
    getSnapshot() {
      const b = profile.bikes.length ? riding(profile) : null;
      return {
        status: !engine.signal.aborted ? (screen === "event" ? (paused ? "paused" : "running") : screen) : "destroyed",
        screen, paused, mode: run ? runMode : null,
        run: run ? run.state : null,
        camera: run ? run.camera : null,
        credits: profile.credits,
        /** ?credits=inf: the session's copy, never saved. */
        testCredits: inf,
        bike: b ? { model: b.model, parts: { ...b.parts }, mods: { ...b.mods }, number: b.look.number } : null,
        bikes: profile.bikes.length,
        series: profile.series.run ? { tier: profile.series.run.tier, round: profile.series.run.round, points: [...profile.series.run.points] } : null,
        seriesBest: { ...profile.series.best }, titles: profile.series.titles,
        result: result ? { credits: result.credits, lines: result.lines, wear: result.wear, finished: result.stats.finished } : null,
        online: N.on && N.m ? { seat: N.seat, players: N.players, room: N.room, phase: N.m.phase === OVER ? "over" : N.ride ? "ride" : "hello", round: N.m.round, kind: N.pick.kind, sub: N.pick.sub, names: N.m.riders.map((r) => r.name), models: N.m.riders.map((r) => r.bike.model), frame: N.m.link.frame, final: N.m.link.final, desync: N.m.link.desync, left: N.m.link.left, ready: N.m.ready, standings: N.res ? N.res.map((x) => x.place) : null, pos: N.ride ? (N.ride.jam ?? N.ride.city ?? N.ride.race)?.riders.slice(0, N.players).map((b) => [Math.round(b.pos[0]!), Math.round(b.pos[2]!)]) ?? null : null } : null,
      };
    },
    /** The online link (frames, corrections, stalls, delay, desync), or null. */
    get net() {
      return N.m?.link ?? null;
    },
    /** The autopilot rides this screen's bike (tests, harnesses; online too: it rides as an input bit). */
    get auto() {
      return !!run?.auto;
    },
    set auto(on: boolean) {
      if (run) run.auto = on;
    },
    /** Open the online room card. */
    online: () => openRoom(),
    destroy() {
      if (!engine.signal.aborted) engine.destroy();
    },
  };
  return api;
}
export type Holeshot = ReturnType<typeof createHoleshot>;
