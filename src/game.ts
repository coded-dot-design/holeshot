// Dirt Hop, the shell: one rider, one garage, every kind of riding. It owns the profile (load, save,
// export and import), the garage (your bikes, their parts and mods, the paint and the rider kit),
// the menus (GARAGE · RIDE · SERIES · SETTINGS) and the cards round an event (pause, the result).
// An event is a mode (./modes/index.ts) started on your tuned bike in the mode layer; when it ends
// the shell settles it (credits in, wear on the bike) and saves. Board UI stickers in a shadow root,
// so the page and the game never touch each other's styles. Every page write goes through the
// kernel's ledger: Recall gives the page back.
import { createEngine } from "@fzlt/core/kernel";
import { mount as buiMount } from "@fzlt/core/ui";
import { diorama } from "@fzlt/core/diorama";
import { bike as makeBike } from "./bike/bike.ts";
import { rig, type RigColors, type RigHelmet } from "./bike/rig.ts";
import { CLASSES, MODELS, SHOP_MODELS, STARTERS, model as modelOf } from "./data/roster.ts";
import { GARAGE_SLOTS, MODS, MOTOR_NAME, PARTS, PART_NAME, SERVICE_BELOW, type ModId, type PartId } from "./data/economy.ts";
import { HELMETS, PAINTS, PATTERNS, SWATCHES, VISORS, paint as paintOf, swatch, visor as visorOf, type KitSlot } from "./data/looks.ts";
import { MODES, mode as modeOf } from "./modes/index.ts";
import type { ModeCtx, ModeId, ModeRun, RunStats } from "./modes/mode.ts";
import { mapsCard, paintMaps } from "./modes/freeride/picker.ts";
import { exportCode, importCode, load, local, ready, riding, save, setup, fresh, type Profile, type Store, type RiderKit } from "./model/profile.ts";
import { tune } from "./model/tune.ts";
import { apply, pitFix, pitReady, settle, type ModeResult } from "./model/economy.ts";
import { buyBike, choose, cosmeticPrice, dress, modPrice, partPrice, service, upgrade, type Buy } from "./model/garage.ts";

export interface DirtHopOptions {
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
}

type Screen = "setup" | "menu" | "garage" | "ride" | "maps" | "series" | "settings" | "event" | "result";
const num = (n: number) => Math.round(n).toLocaleString("en-US");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const bar = (v: number, label: string) => `<span class="dh-bar" style="--v:${Math.max(0, Math.min(1, v)).toFixed(3)}" ${v < 0.35 ? " data-low" : ""}><em>${label}</em><i></i><b>${Math.round(v * 100)}%</b></span>`;
const SLOT_NAME: Record<KitSlot, string> = { helmet: "HELMET", helmetPaint: "HELMET PAINT", visor: "VISOR", jersey: "JERSEY", pants: "PANTS", pattern: "PATTERN", boots: "BOOTS", gloves: "GLOVES" };

/** The bike's and rider's colours for the rig, from the profile. */
export function lookOf(p: Profile): { look: ModeCtx["look"]; helmet: RigHelmet; number: number } {
  const b = riding(p), pt = paintOf(b?.look.paint ?? "gridline"), k = p.kit;
  const jersey = swatch(k.jersey).hex, pants = swatch(k.pants).hex, helmet = swatch(k.helmetPaint).hex;
  const stripe = k.pattern === "stripe" ? helmet : k.pattern === "split" ? pants : jersey;
  return {
    look: { plastic: pt.plastic, plastic2: pt.plastic2, plate: pt.plate, ink: pt.ink, jersey, pants, helmet, stripe, visor: visorOf(k.visor).hex, boots: swatch(k.boots).hex, gloves: swatch(k.gloves).hex },
    helmet: (HELMETS.find((h) => h.id === k.helmet)?.id ?? "peak") as RigHelmet,
    number: b?.look.number ?? 7,
  };
}

export function createDirtHop(o: DirtHopOptions = {}) {
  const dropIn = !o.host, store = o.store ?? local;
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wrap = document.createElement("div");
  wrap.setAttribute("data-fizlet-host", "dirt-hop");
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
  let profile = loaded.profile;
  const newer = loaded.newer;
  if (o.attract) profile = setup(profile, { starter: STARTERS[0]!.id, paint: "pinkout", number: 7, name: "DEMO" });
  const keep = () => !o.attract && save(profile, store, newer);

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

  let screen: Screen = "menu", run: ModeRun | null = null, runMode: ModeId = "race", runMap: string | undefined, paused = false, result: ModeResult | null = null, note = "";
  let garageTab: "bike" | "look" | "showroom" = "bike";

  // ---- the garage's bike preview: the rig on a turntable, drawn on change (no loop) ----
  const pv = document.createElement("canvas");
  pv.className = "dh-preview";
  pv.setAttribute("aria-hidden", "true");
  const pdio = diorama(pv, { light: [-0.4, 1, 0.6], ambient: 0.55, background: () => (pageTheme() === "dark" ? "#1a1636" : "#fbeee0") });
  const flat = { sample(_x: number, _z: number, out: { [i: number]: number }) { out[0] = 0; out[1] = 0; out[2] = 1; out[3] = 0; return 0; } };
  let pvKey = "";
  function preview() {
    if (!pv.isConnected || !ready(profile)) return;
    const r = pv.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height);
    if (w < 10 || h < 10) return;
    const b = riding(profile), t = tune(b), L2 = lookOf(profile), key = JSON.stringify([w, h, b.model, b.look, profile.kit, pageTheme()]);
    if (key === pvKey) return;
    pvKey = key;
    pdio.resize(w, h, Math.min(2, devicePixelRatio || 1));
    pdio.clear();
    const night = pageTheme() === "dark";
    const kit = night ? { seat: "#14121f", frame: "#2b2a3d", tyre: "#0f0f16", rim: "#9aa0c8", metal: "#c9cde6", pipe: "#7e86a8", glow: "#ff2e88" } : { seat: "#2a2833", frame: "#3a3a4c", tyre: "#24232b", rim: "#d9dbe6", metal: "#eceef7", pipe: "#9aa0b8", glow: "#ff3b30" };
    pdio.add({ shape: "cyl", sides: 24, size: [3.2, 0.12, 3.2], pos: [0, -0.06, 0], color: night ? "#1d1838" : "#f2e2cf", pick: false });
    pdio.add({ shape: "cyl", sides: 24, size: [3.3, 0.04, 3.3], pos: [0, -0.1, 0], color: night ? "#22e6ff" : "#ff7a59", emissive: night, pick: false });
    const g = rig(pdio, "pv", { ...kit, ...L2.look } as RigColors, t.rig, L2.helmet), bk = makeBike(flat, t.power, t.shape);
    bk.reset(0, 0, 0);
    g.pose(bk, 0.6);
    Object.assign(pdio.cam, { yaw: -0.6, pitch: 0.26, dist: 5.2, tx: 0, ty: 0.55, tz: 0, ox: 0, oy: 0, fov: 0.55 });
    pdio.draw();
  }
  const pro = new ResizeObserver(() => ((pvKey = ""), preview()));
  pro.observe(pv);
  engine.signal.addEventListener("abort", () => pro.disconnect(), { once: true });

  // ---- rendering the cards ----
  const head = () => `<header class="dh-top"><b class="dh-logo">DIRT HOP</b><span class="dh-chip dh-cr" title="Credits">◈ ${num(profile.credits)}</span>${profile.name ? `<span class="dh-chip">${esc(profile.name)}</span>` : ""}</header>`;
  const tabs = (on: Screen) => `<nav class="dh-tabs" aria-label="Menu">${([["garage", "GARAGE"], ["ride", "RIDE"], ["series", "SERIES"], ["settings", "SETTINGS"]] as const).map(([s, t]) => `<button type="button" class="bui-key" data-go="${s}" aria-pressed="${s === on}">${t}</button>`).join("")}</nav>`;
  const bikeLine = () => {
    const b = riding(profile), m = modelOf(b.model);
    return `${CLASSES[m.cls].maker} ${m.name} · #${b.look.number}`;
  };
  const cost = (n: number, can: boolean) => (n ? `<small class="dh-price"${can ? "" : " data-short"}>◈ ${num(n)}</small>` : `<small class="dh-price">OWNED</small>`);

  function setupCard() {
    const starters = STARTERS.map((m, i) => {
      const t = tune({ uid: "x", model: m.id, parts: { tyres: 1, chain: 1, motor: 1, susp: 1, brakes: 1 }, mods: { power: 0, gearing: 0, susp: 0 }, look: { paint: "gridline", number: 7 }, odo: 0, events: 0 });
      return `<label class="dh-pick"><input type="radio" name="starter" value="${m.id}" ${i ? "" : "checked"} /><span><small>${CLASSES[m.cls].name} · ${CLASSES[m.cls].maker}</small><b>${m.name}</b><em>${esc(m.blurb)}</em>${bar(t.feel.pull, "PULL")}${bar(t.feel.top, "TOP SPEED")}${bar(t.feel.light, "LIGHT")}${bar(t.feel.susp, "SUSPENSION")}</span></label>`;
    }).join("");
    const paints = PAINTS.filter((p) => !p.tier).map((p, i) => `<label class="dh-sw" style="--a:${p.plastic};--b:${p.plastic2}"><input type="radio" name="paint" value="${p.id}" ${i ? "" : "checked"} /><span>${p.name}</span></label>`).join("");
    const jerseys = SWATCHES.filter((s) => !s.tier && s.id !== "ink").map((s, i) => `<label class="dh-sw" style="--a:${s.hex};--b:${s.hex}"><input type="radio" name="jersey" value="${s.id}" ${i ? "" : "checked"} /><span>${s.name}</span></label>`).join("");
    return `<form class="dh-card dh-setup" data-screen="setup" novalidate><b class="dh-h">YOUR BIKE</b><p class="dh-sub">One bike to start. It rides every event, wears every lap, and the credits you earn keep it fast.</p>
      <fieldset class="dh-picks"><legend>STARTER</legend>${starters}</fieldset>
      <fieldset class="dh-sws"><legend>PAINT</legend>${paints}</fieldset>
      <fieldset class="dh-sws"><legend>JERSEY</legend>${jerseys}</fieldset>
      <p class="dh-row"><label class="dh-field">RIDER NAME<input name="name" maxlength="12" autocomplete="nickname" autocapitalize="characters" spellcheck="false" placeholder="RIDER" /></label><label class="dh-field dh-numf">NUMBER<input name="number" type="number" inputmode="numeric" min="1" max="99" value="7" /></label></p>
      <p class="dh-row"><button type="submit" class="bui-key dh-go">TO THE GARAGE</button></p>${newer ? `<p class="dh-sub dh-warn">A save from a newer Dirt Hop is on this device. It is kept as it is; this profile won't be saved over it.</p>` : ""}</form>`;
  }
  function menuCard() {
    const b = riding(profile), m = modelOf(b.model), t = tune(b);
    const low = PARTS.filter((k) => b.parts[k] < 0.35);
    return `<div class="dh-card dh-home" data-screen="menu">${head()}<div class="dh-hero2"><canvas-slot></canvas-slot><div><small>${CLASSES[m.cls].name} · ${CLASSES[m.cls].maker}</small><b class="dh-big">${m.name} <i>#${b.look.number}</i></b>${bar(Math.min(...PARTS.map((k) => b.parts[k])), "WORST PART")}${bar(t.feel.pull, "PULL")}${low.length ? `<p class="dh-sub dh-warn">Worn: ${low.map((k) => (k === "motor" ? MOTOR_NAME[m.cls] : PART_NAME[k])).join(", ")}. Service it in the GARAGE.</p>` : ""}</div></div>${tabs("menu")}${pitReady(profile) ? `<p class="dh-row"><button type="button" class="bui-key dh-pit">PIT CREW: FREE BASIC FIX</button></p>` : ""}<p class="dh-sub">Keys: ↑/W lean forward · ↓/S lean back · ←→/AD steer · Space gas · K brake · L trick or hop · P pause</p></div>`;
  }
  function garageCard() {
    const b = riding(profile), m = modelOf(b.model), t = tune(b);
    const bikes = profile.bikes.map((x, i) => { const mm = modelOf(x.model); return `<button type="button" class="bui-key dh-slot-k" data-ride="${i}" aria-pressed="${i === profile.ride}"><small>${CLASSES[mm.cls].name}</small><b>${mm.name}</b><small>#${x.look.number}</small></button>`; }).join("") + (profile.bikes.length < GARAGE_SLOTS ? `<button type="button" class="bui-key dh-slot-k dh-empty" data-gtab="showroom"><small>EMPTY BAY</small><b>+ BIKE</b></button>` : "");
    let body = "";
    if (garageTab === "bike") {
      const parts = PARTS.map((k) => {
        const v = b.parts[k], price = partPrice(b, k), need = v < SERVICE_BELOW, name = k === "motor" ? MOTOR_NAME[m.cls] : PART_NAME[k];
        return `<li>${bar(v, name)}<button type="button" class="bui-key dh-buy" data-service="${k}" ${need ? "" : "disabled"}>${k === "tyres" ? "NEW SET" : k === "motor" ? (CLASSES[m.cls].motor === "battery" ? "NEW CELLS" : "REBUILD") : "SERVICE"}${need ? cost(price, profile.credits >= price) : "<small>NEW</small>"}</button></li>`;
      }).join("");
      const mods = (Object.keys(MODS) as ModId[]).map((k) => {
        const M = MODS[k], lv = b.mods[k], price = modPrice(b, k), e = CLASSES[m.cls].motor === "battery";
        return `<li><span class="dh-mod"><b>${k === "power" && e ? M.e : M.name}</b><small>${M.blurb}</small><i>${"◆".repeat(lv)}${"◇".repeat(M.max - lv)}</i></span><button type="button" class="bui-key dh-buy" data-mod="${k}" ${price ? "" : "disabled"}>${price ? "UPGRADE" + cost(price, profile.credits >= price) : "MAXED"}</button></li>`;
      }).join("");
      body = `<div class="dh-cols"><section><b class="dh-h2">CONDITION</b><ul class="dh-list">${parts}</ul></section><section><b class="dh-h2">MODS</b><ul class="dh-list">${mods}</ul><b class="dh-h2">FEEL</b><div class="dh-feel">${bar(t.feel.pull, "PULL")}${bar(t.feel.top, "TOP SPEED")}${bar(t.feel.grip, "GRIP")}${bar(t.feel.susp, "SUSPENSION")}${bar(t.feel.brakes, "BRAKES")}${bar(t.feel.light, "LIGHT")}</div></section></div>`;
    } else if (garageTab === "look") {
      const row = (slot: KitSlot | "paint", list: { id: string; name: string; hex?: string; plastic?: string; plastic2?: string }[], on: string) => `<li><b class="dh-h3">${slot === "paint" ? "BIKE PAINT" : SLOT_NAME[slot]}</b><span class="dh-swrow">${list.map((x) => { const pr = cosmeticPrice(profile, slot, x.id); return `<button type="button" class="dh-swk" data-dress="${slot}" data-id="${x.id}" aria-pressed="${x.id === on}" style="--a:${x.hex ?? x.plastic};--b:${x.hex ?? x.plastic2}" aria-label="${x.name}${pr ? `, ${pr} credits` : ""}"><i></i><small>${x.name}</small>${pr ? `<em>◈${pr}</em>` : ""}</button>`; }).join("")}</span></li>`;
      const k = profile.kit;
      const shapes = HELMETS.map((h) => ({ id: h.id, name: h.name, hex: swatch(k.helmetPaint).hex }));
      const pats = PATTERNS.map((p) => ({ id: p.id, name: p.name, hex: p.id === "solid" ? swatch(k.jersey).hex : p.id === "stripe" ? swatch(k.helmetPaint).hex : swatch(k.pants).hex }));
      body = `<ul class="dh-list dh-looks">${row("paint", PAINTS, b.look.paint)}<li><b class="dh-h3">NUMBER</b><span class="dh-swrow"><input class="dh-numin" type="number" min="1" max="99" value="${b.look.number}" aria-label="Plate number" /><button type="button" class="bui-key dh-buy" data-number>SET${cost(cosmeticPrice(profile, "number", ""), true)}</button></span></li>${row("helmet", shapes, k.helmet)}${row("helmetPaint", SWATCHES, k.helmetPaint)}${row("visor", VISORS, k.visor)}${row("jersey", SWATCHES, k.jersey)}${row("pattern", pats, k.pattern)}${row("pants", SWATCHES, k.pants)}${row("boots", SWATCHES, k.boots)}${row("gloves", SWATCHES, k.gloves)}</ul>`;
    } else {
      const full = profile.bikes.length >= GARAGE_SLOTS;
      body = `<p class="dh-sub">${full ? `The garage holds ${GARAGE_SLOTS} bikes.` : "A new bike goes in the empty bay and rides next. Each bike keeps its own parts, mods and paint."}</p><ul class="dh-list dh-show">${MODELS.filter((x) => SHOP_MODELS.includes(x.id)).map((x) => `<li><span class="dh-mod"><small>${CLASSES[x.cls].name} · ${CLASSES[x.cls].maker}</small><b>${x.name}</b><small>${esc(x.blurb)}</small></span><button type="button" class="bui-key dh-buy" data-bike="${x.id}" ${full ? "disabled" : ""}>BUY${cost(x.price, profile.credits >= x.price)}</button></li>`).join("")}</ul>`;
    }
    return `<div class="dh-card dh-garage" data-screen="garage">${head()}${tabs("garage")}<div class="dh-bay"><canvas-slot></canvas-slot><div><small>${CLASSES[m.cls].name} · ${CLASSES[m.cls].maker}</small><b class="dh-big">${m.name} <i>#${b.look.number}</i></b><p class="dh-sub">${esc(m.blurb)}</p><div class="dh-slots" role="group" aria-label="Your bikes">${bikes}</div></div></div><nav class="dh-seg" aria-label="Garage">${([["bike", "PARTS & MODS"], ["look", "PAINT & KIT"], ["showroom", "SHOWROOM"]] as const).map(([v, tx]) => `<button type="button" class="bui-key" data-gtab="${v}" aria-pressed="${v === garageTab}">${tx}</button>`).join("")}</nav>${body}<p class="dh-sub dh-note" role="status">${esc(note)}</p></div>`;
  }
  function rideCard() {
    return `<div class="dh-card dh-ridec" data-screen="ride">${head()}${tabs("ride")}<p class="dh-sub">On your ${bikeLine()}.</p><ul class="dh-modes">${MODES.map((md) => `<li><button type="button" class="bui-key dh-modek" data-mode="${md.id}"><b>${md.name}</b><small>${md.blurb}</small><em>${md.maps.length > 1 ? `${md.maps.length} MAPS` : md.maps[0]!.name}</em></button></li>`).join("")}</ul></div>`;
  }
  function seriesCard() {
    return `<div class="dh-card" data-screen="series">${head()}${tabs("series")}<b class="dh-h">SERIES · COMING</b><p class="dh-sub">Championships of rounds, a new track every race, rivals and a points table. Not yet: ride RACE to get your bike ready.</p></div>`;
  }
  function settingsCard() {
    return `<div class="dh-card dh-set" data-screen="settings">${head()}${tabs("settings")}<p class="dh-row"><button type="button" class="bui-key dh-sound" aria-pressed="${profile.settings.sound}">SOUND ${profile.settings.sound ? "ON" : "OFF"}</button></p>
      <b class="dh-h2">MOVE YOUR PROFILE</b><p class="dh-sub">Your garage lives on this device. Copy the code to carry it to another one; nothing leaves the device unless you do.</p>
      <label class="dh-field">EXPORT CODE<textarea class="dh-code" readonly rows="3">${exportCode(profile)}</textarea></label><p class="dh-row"><button type="button" class="bui-key dh-copy">COPY CODE</button></p>
      <label class="dh-field">IMPORT A CODE<textarea class="dh-codein" rows="3" spellcheck="false" placeholder="DH1-…"></textarea></label><p class="dh-row"><button type="button" class="bui-key dh-import">LOAD IT</button><button type="button" class="bui-key dh-reset">START OVER</button></p><p class="dh-sub dh-note" role="status">${esc(note)}</p></div>`;
  }
  function pauseCard() {
    return `<div class="dh-card dh-pause" data-screen="pause" role="dialog" aria-label="Paused"><b class="dh-h">PAUSED</b><p class="dh-sub">${modeOf(runMode).name} on your ${bikeLine()}. Leaving now pays nothing; the wear so far still counts.</p><p class="dh-row"><button type="button" class="bui-key dh-go dh-resume">RESUME</button><button type="button" class="bui-key dh-leave">LEAVE</button></p></div>`;
  }
  function resultCard() {
    const r = result!, b = riding(profile), m = modelOf(b.model);
    const lines = r.lines.map(([k, v]) => `<li><span>${k}</span><b>+${num(v)}</b></li>`).join("") || `<li><span>NO PAYOUT</span><b>0</b></li>`;
    const wear = PARTS.map((k) => `<li>${bar(b.parts[k], k === "motor" ? MOTOR_NAME[m.cls] : PART_NAME[k])}<small>−${(r.wear[k] * 100).toFixed(1)}%</small></li>`).join("");
    return `<div class="dh-card dh-result" data-screen="result" role="dialog" aria-label="Result"><b class="dh-h">${r.stats.finished ? modeOf(r.stats.mode).name + " · DONE" : "LEFT EARLY"}</b><p class="dh-sub">${esc(r.stats.summary ?? "")}</p><div class="dh-cols"><section><b class="dh-h2">PAYOUT</b><ul class="dh-pay">${lines}<li class="dh-total"><span>TOTAL</span><b>◈ ${num(r.credits)}</b></li></ul></section><section><b class="dh-h2">WEAR</b><ul class="dh-list dh-wear">${wear}</ul></section></div>${pitReady(profile) ? `<p class="dh-row"><button type="button" class="bui-key dh-pit">PIT CREW: FREE BASIC FIX</button></p>` : ""}<p class="dh-row"><button type="button" class="bui-key dh-go dh-again">RIDE AGAIN</button><button type="button" class="bui-key" data-go="garage">GARAGE</button><button type="button" class="bui-key" data-go="ride">MENU</button></p></div>`;
  }

  function show(s: Screen) {
    screen = s;
    if (s !== "event" && s !== "result" && run) run.destroy(), (run = null), (modeEl.textContent = "");
    const html = s === "setup" ? setupCard() : s === "menu" ? menuCard() : s === "garage" ? garageCard() : s === "ride" ? rideCard() : s === "maps" ? mapsCard(head(), tabs("ride")) : s === "series" ? seriesCard() : s === "settings" ? settingsCard() : s === "result" ? resultCard() : paused ? pauseCard() : "";
    cards.innerHTML = html;
    cards.hidden = !html;
    stage.toggleAttribute("data-menu", s !== "event" && s !== "result");
    const slot = cards.querySelector("canvas-slot");
    if (slot) slot.replaceWith(pv), (pvKey = ""), requestAnimationFrame(preview);
    if (s === "maps") paintMaps(cards, pageTheme() === "dark");
    note = "";
    const first = cards.querySelector<HTMLElement>(".dh-go, [aria-pressed=true], button, input");
    if (s !== "event") first?.focus({ preventScroll: true });
    engine.wake();
  }
  const did = (r: Buy, what: string) => {
    if (r.ok) (profile = r.profile), keep(), (note = `${what} · ◈ ${num(r.spent)}`), say(note);
    else (note = r.why), say(r.why);
    const n = note;
    show(screen);
    note = n;
    const el = cards.querySelector(".dh-note");
    if (el) el.textContent = n;
  };

  // ---- an event ----
  function startEvent(id: ModeId, opt: { map?: string; seed?: number; auto?: boolean } = {}) {
    if (!ready(profile)) return show("setup");
    run?.destroy();
    paused = false;
    result = null;
    runMode = id;
    runMap = opt.map;
    const L2 = lookOf(profile), b = riding(profile);
    const ctx: ModeCtx = {
      host: modeEl,
      bike: tune(b),
      look: L2.look, helmet: L2.helmet, number: L2.number, name: profile.name,
      seed: opt.seed ?? ((o.seed ?? 20261114) + profile.stats.events * 7919) >>> 0,
      map: opt.map,
      auto: opt.auto ?? !!o.attract,
      attract: !!o.attract,
      reduced,
      sound: o.sound ?? profile.settings.sound,
      end: (s) => finishEvent(s),
      quit: (s) => finishEvent(s),
      menu: () => setPaused(true),
    };
    screen = "event";
    cards.innerHTML = "";
    cards.hidden = true;
    stage.removeAttribute("data-menu");
    run = modeOf(id).start(ctx);
    say(`${modeOf(id).name} on your ${bikeLine()}`);
  }
  function finishEvent(s: RunStats) {
    if (!run || o.attract) return;
    const r = settle(s, riding(profile));
    profile = apply(profile, r);
    keep();
    result = r;
    paused = false;
    show("result");
    say(`${r.credits} credits`);
  }
  function setPaused(on: boolean) {
    if (!run || screen !== "event" || o.attract) return;
    paused = on;
    run.pause(on);
    show("event");
  }
  function leave() {
    if (!run) return;
    run.pause(false);
    const s = { ...run.stats(), finished: false };
    finishEvent(s);
  }

  // ---- input on the cards ----
  cards.addEventListener("click", (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>("button");
    if (!t) return;
    const d = t.dataset;
    if (d.go) return show(d.go as Screen);
    if (d.gtab) return (garageTab = d.gtab as typeof garageTab), show("garage");
    if (d.ride) return (profile = choose(profile, +d.ride)), keep(), show("garage");
    if (d.service) return did(service(profile, d.service as PartId), "Serviced");
    if (d.mod) return did(upgrade(profile, d.mod as ModId), "Upgraded");
    if (d.dress) return did(dress(profile, d.dress as KitSlot, d.id!), "Done");
    if (d.number !== undefined) return did(dress(profile, "number", (cards.querySelector<HTMLInputElement>(".dh-numin")!).value), "Number set");
    if (d.bike) return did(buyBike(profile, d.bike), "Bought");
    if (d.mode) return d.mode === "freeride" ? show("maps") : startEvent(d.mode as ModeId);
    if (d.map) return startEvent("freeride", { map: d.map });
    if (t.classList.contains("dh-resume")) return setPaused(false);
    if (t.classList.contains("dh-leave")) return leave();
    if (t.classList.contains("dh-again")) return startEvent(runMode, { map: runMap });
    if (t.classList.contains("dh-pit")) return (profile = pitFix(profile)), keep(), say("The pit crew fixed it up"), show(screen === "result" ? "result" : "menu");
    if (t.classList.contains("dh-sound")) return (profile = { ...profile, settings: { ...profile.settings, sound: !profile.settings.sound } }), keep(), show("settings");
    if (t.classList.contains("dh-copy")) {
      const code = exportCode(profile);
      void navigator.clipboard?.writeText(code).then(() => say("Copied"), () => {});
      (cards.querySelector(".dh-code") as HTMLTextAreaElement | null)?.select();
      return;
    }
    if (t.classList.contains("dh-import")) {
      const r = importCode((cards.querySelector(".dh-codein") as HTMLTextAreaElement).value);
      if ("error" in r) return (note = r.error), show("settings"), (cards.querySelector(".dh-note")!.textContent = r.error);
      profile = r.profile;
      keep();
      return show(ready(profile) ? "menu" : "setup");
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
    const f = ev.target as HTMLFormElement, v = (n: string) => (f.elements.namedItem(n) as RadioNodeList | HTMLInputElement | null)?.value ?? "";
    const kit: Partial<RiderKit> = { jersey: v("jersey") || "cyan" };
    profile = setup(profile, { starter: v("starter"), paint: v("paint"), number: Math.max(1, Math.min(99, Math.round(+v("number") || 7))), name: v("name"), kit });
    keep();
    show("garage");
  }, sig);

  // ---- keys: P / Escape pause (Escape gives the page back when dropped onto a page) ----
  const src = (e: Event) => (e.composedPath?.()[0] ?? e.target) as Element | null;
  window.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || o.attract) return;
    const typing = !!src(e)?.closest?.("input,textarea,select");
    if (e.code === "Escape") {
      if (dropIn && screen !== "event") return void (e.preventDefault(), api.destroy());
      if (screen === "event") return void (e.preventDefault(), setPaused(!paused));
      return;
    }
    if (e.code === "KeyP" && !typing && screen === "event") return void (e.preventDefault(), setPaused(!paused));
  }, sig);
  if (dropIn) L.style(document.documentElement, "overflow", "hidden");

  if (o.attract) startEvent("race", { auto: true, seed: o.seed ?? 20261114 });
  else show(ready(profile) ? "menu" : "setup");
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
      show("menu");
    },
    exportCode: () => exportCode(profile),
    importCode(code: string) {
      const r = importCode(code);
      if ("profile" in r) (profile = r.profile), keep(), show(ready(profile) ? "menu" : "setup");
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
        bike: b ? { model: b.model, parts: { ...b.parts }, mods: { ...b.mods }, number: b.look.number } : null,
        bikes: profile.bikes.length,
        result: result ? { credits: result.credits, lines: result.lines, wear: result.wear, finished: result.stats.finished } : null,
      };
    },
    destroy() {
      if (!engine.signal.aborted) engine.destroy();
    },
  };
  return api;
}
export type DirtHop = ReturnType<typeof createDirtHop>;
