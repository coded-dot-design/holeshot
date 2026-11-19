// The throttle rocker: gas and brake under one thumb on a touch screen (every mode's pad). One pill
// with three zones the thumb slides between without lifting: the top is GAS, the bottom is BRAKE (both
// square: as tall as the pill is wide, the pill's ends fully round), the middle SEAM is both at once
// (the wheelie and the feather: hold the gas, roll onto the brake). A second finger anywhere on the
// pill adds the brake while the first holds the gas. The zones light and press in at once (Board UI
// press language: the raised lip goes; icons only, the words are in the aria-labels); a short buzz on a
// zone change where the device has one (never with reduced motion). It drives `controls` intents
// through `press()` like the pad's own keys, so game code reads `down("gas")` / `down("brake")` and
// never knows.
//
// The bubbles (touch only; desktop and gamepads keep their keys): a mode's option actions (the TRICK,
// the HOP) are not keys of their own but round bubbles that pop out of the pill's side on a stretchy
// "slime" tether, only while they are any use (`want()`: the mode says so each frame: in the air, in a
// wheelie past 10 o'clock, on the ground for a hop). The thumb on the pill slides out onto a bubble
// WITHOUT lifting: while it is on the bubble the zone it left from keeps applying (gas, brake or both,
// still lit), so a wheelie or an air attitude holds; slid back onto the pill it is normal zone control
// again; lifted, everything lets go. A second finger can tap a bubble too. A bubble follows the finger
// a little (elastic) while held; its intent is held while a finger is on it (the trick out, the hop's
// press). A first-time hint ("slide to the middle to wheelie") stays until the seam is used once
// (remembered per browser, best effort).
import type { Controls } from "@fzlt/core/input";

/** The pill's zones top to bottom: 1 gas, 2 brake, 3 both (the seam). */
export const zoneOf = (y: number, top: number, bottom: number) => (y < top ? 1 : y > bottom ? 2 : 3);

export const ICON_GAS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z" fill="currentColor"/></svg>';
export const ICON_BRAKE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="5.6" r="1.3" fill="currentColor"/><circle cx="18.4" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="18.4" r="1.3" fill="currentColor"/><circle cx="5.6" cy="12" r="1.3" fill="currentColor"/></svg>';
export const ICON_SEAM = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18c2-7 5-11 13-13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="6" cy="19" r="3" fill="currentColor"/></svg>';
export const ICON_TRICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.6 6.2 6.7.6-5.1 4.4 1.6 6.6L12 16.3 6.2 19.8l1.6-6.6L2.7 8.8l6.7-.6z" fill="currentColor"/></svg>';
export const ICON_HOP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 5 12h4v6h6v-6h4z" fill="currentColor"/></svg>';
const HINT_KEY = "holeshot:rocker-seam";

/** Bubble slots round the pill (never on top of each other): TRICK at half past 10 off the gas end,
 *  HOP at 9 o'clock off the gas zone. Bits for `want()`. */
export const B_TRICK = 1, B_HOP = 2;
/** One option action as a bubble: its intent (held while a finger is on it), slot, icon, word, name. */
export interface Bubble { intent: string; slot: 0 | 1; icon: string; word: string; name: string }
/** How long a bubble lingers after the mode stops wanting it (ms: a bump's air does not blink it). */
const LINGER = 260;
/** The elastic follow: the share of the finger's offset the bubble takes, and the most it moves (px). */
const FOLLOW = 0.45, REACH = 18;

/** Mount the rocker in `host` (the pad's element): drives `gas` and `brake` on `c`, plus each bubble's intent. */
export function rocker(c: Controls, host: HTMLElement, o: { reduced?: boolean; signal?: AbortSignal; gas?: string; brake?: string; bubbles?: Bubble[] } = {}) {
  const gi = o.gas ?? "gas", bi = o.brake ?? "brake", BB = o.bubbles ?? [];
  const el = document.createElement("div");
  el.className = "hs-rocker";
  el.setAttribute("role", "group");
  el.setAttribute("aria-label", "Throttle: slide up for gas, down for brake, the middle for both (a wheelie)");
  el.innerHTML = `<span class="hs-rz hs-rz-gas" role="img" aria-label="Gas">${ICON_GAS}</span><span class="hs-rz hs-rz-seam" role="img" aria-label="Gas and brake together: wheelie">${ICON_SEAM}</span><span class="hs-rz hs-rz-brake" role="img" aria-label="Brake">${ICON_BRAKE}</span><b class="hs-rhint" hidden>slide to the middle to wheelie</b>`;
  host.append(el);
  const seamEl = el.children[1] as HTMLElement, hint = el.children[3] as HTMLElement;
  // The bubbles and their tethers (one SVG under them, drawn in the pill's own pixels).
  const NB = BB.length, bEl: HTMLElement[] = [], tEl: SVGPathElement[] = [];
  let tether: SVGSVGElement | null = null;
  if (NB) {
    el.classList.add("hs-hasbub");
    tether = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    tether.setAttribute("class", "hs-tether");
    tether.setAttribute("aria-hidden", "true");
    // Safari: an outer <svg> without width/height can take its default 300×150 box and sit over the
    // pill; pin it to 1×1 (the paths overflow it) and keep it out of hit testing.
    tether.setAttribute("width", "1");
    tether.setAttribute("height", "1");
    tether.setAttribute("overflow", "visible");
    tether.setAttribute("pointer-events", "none");
    el.prepend(tether);
    for (const b of BB) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("class", "hs-slime");
      p.dataset.slot = "" + b.slot;
      tether.append(p);
      tEl.push(p);
      const e = document.createElement("b");
      e.className = "hs-bub";
      e.dataset.slot = "" + b.slot;
      e.setAttribute("role", "img");
      e.setAttribute("aria-label", b.name);
      e.innerHTML = b.icon + `<i>${b.word}</i>`;
      el.append(e);
      bEl.push(e);
    }
  }
  // Per bubble: shown (0/1), on (a finger on it), the last time the mode wanted it, its elastic offset.
  const SHOWN = new Uint8Array(NB), ON = new Uint8Array(NB), LAST = new Float64Array(NB), OFF = new Float32Array(NB * 2);
  // The bubbles' fingers of their own (−1 free), and which bubble each rocker finger is over (0 none, i+1).
  const CID = new Int32Array(NB).fill(-1), OV = new Uint8Array(2);
  let seen = false;
  try { seen = localStorage.getItem(HINT_KEY) === "1"; } catch { seen = false; }
  hint.hidden = seen;
  // Two fingers at most: their ids (−1 free) and the first one's zone.
  const ID = new Int32Array([-1, -1]), Z = new Uint8Array(2);
  let gas = false, brake = false, zone = 0;
  const apply = () => {
    const z0 = ID[0]! >= 0 ? Z[0]! : 0, two = ID[0]! >= 0 && ID[1]! >= 0;
    const g = (z0 & 1) === 1, b = (z0 & 2) === 2 || two;
    const zz = (g ? 1 : 0) | (b ? 2 : 0);
    if (g !== gas) (gas = g), c.press(gi, g);
    if (b !== brake) (brake = b), c.press(bi, b);
    for (let i = 0; i < NB; i++) {
      const on = CID[i]! >= 0 || (ID[0]! >= 0 && OV[0] === i + 1) || (ID[1]! >= 0 && OV[1] === i + 1) ? 1 : 0;
      if (on !== ON[i]) {
        ON[i] = on;
        c.press(BB[i]!.intent, on === 1);
        bEl[i]!.classList.toggle("hs-on", on === 1);
        if (!on) (OFF[i * 2] = OFF[i * 2 + 1] = 0), place(i);
        paint(i);
      }
    }
    el.dataset.bub = ON.includes(1) ? "1" : "";
    if (zz !== zone) {
      if (zone !== 0 && zz !== 0 && !o.reduced && typeof navigator.vibrate === "function") try { navigator.vibrate(8); } catch { /* none */ }
      zone = zz;
      el.dataset.zone = "" + zz;
      if (zz === 3 && !seen) {
        seen = true;
        hint.hidden = true;
        try { localStorage.setItem(HINT_KEY, "1"); } catch { /* private mode: it shows again next time */ }
      }
    }
  };
  // ---- the bubbles: where they sit, the slime between, the elastic follow ----
  /** The bubble's rest centre and the tether's anchor on the pill, in the pill's pixels (slot 0: half
   *  past 10 off the top end; slot 1: 9 o'clock off the gas zone). */
  const geo = (slot: number, out: Float32Array) => {
    const w = el.clientWidth, r = w / 2;
    if (slot === 0) (out[0] = r - (r + 48) * 0.66), (out[1] = r - (r + 48) * 0.75), (out[2] = r - r * 0.66), (out[3] = r - r * 0.75);
    else (out[0] = -58), (out[1] = w * 0.95), (out[2] = 0), (out[3] = w * 0.95);
  };
  const G = new Float32Array(4);
  const place = (i: number) => {
    const e = bEl[i]!;
    geo(BB[i]!.slot, G);
    e.style.left = G[0]! + OFF[i * 2]! + "px";
    e.style.top = G[1]! + OFF[i * 2 + 1]! + "px";
  };
  const paint = (i: number) => {
    const p = tEl[i]!;
    if (!SHOWN[i] && !ON[i]) return void p.setAttribute("d", "");
    geo(BB[i]!.slot, G);
    const ax = G[2]!, ay = G[3]!, bx = G[0]! + OFF[i * 2]!, by = G[1]! + OFF[i * 2 + 1]!;
    const dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / L, ny = dx / L;
    // Thick at both ends, a neck in the middle that thins as it stretches.
    const r1 = 11, r2 = 15, neck = Math.max(2.5, 7 - (L - 40) * 0.08), mx = (ax + bx) / 2, my = (ay + by) / 2;
    const f = (v: number) => v.toFixed(1);
    p.setAttribute("d", `M${f(ax + nx * r1)} ${f(ay + ny * r1)}Q${f(mx + nx * neck)} ${f(my + ny * neck)} ${f(bx + nx * r2)} ${f(by + ny * r2)}L${f(bx - nx * r2)} ${f(by - ny * r2)}Q${f(mx - nx * neck)} ${f(my - ny * neck)} ${f(ax - nx * r1)} ${f(ay - ny * r1)}Z`);
  };
  /** Which shown (or held) bubble is under (x, y): its index, −1 none. */
  const bubAt = (x: number, y: number) => {
    for (let i = 0; i < NB; i++) {
      if (!SHOWN[i] && !ON[i]) continue;
      const r = bEl[i]!.getBoundingClientRect(), p = 10;
      if (x >= r.left - p && x <= r.right + p && y >= r.top - p && y <= r.bottom + p) return i;
    }
    return -1;
  };
  /** A finger held on bubble `i` at (x, y): the bubble leans toward it (elastic, up to REACH px). */
  const follow = (i: number, x: number, y: number) => {
    if (o.reduced) return;
    const r = el.getBoundingClientRect();
    geo(BB[i]!.slot, G);
    let dx = (x - r.left - G[0]!) * FOLLOW, dy = (y - r.top - G[1]!) * FOLLOW;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > REACH) (dx *= REACH / d), (dy *= REACH / d);
    OFF[i * 2] = dx;
    OFF[i * 2 + 1] = dy;
    place(i);
    paint(i);
  };
  for (let i = 0; i < NB; i++) place(i);
  const zoneY = (y: number) => {
    const s = seamEl.getBoundingClientRect();
    return zoneOf(y, s.top, s.bottom);
  };
  const slot = (id: number) => (ID[0] === id ? 0 : ID[1] === id ? 1 : -1);
  const opt = o.signal ? { signal: o.signal } : undefined;
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const bi = bubAt(e.clientX, e.clientY);
    if (bi >= 0 && CID[bi]! < 0) {
      CID[bi] = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
      apply();
      return follow(bi, e.clientX, e.clientY);
    }
    if (bi >= 0) return;
    const k = ID[0]! < 0 ? 0 : ID[1]! < 0 ? 1 : -1;
    if (k < 0) return;
    ID[k] = e.pointerId;
    OV[k] = 0;
    Z[k] = zoneY(e.clientY);
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    apply();
  }, opt);
  el.addEventListener("pointermove", (e) => {
    for (let i = 0; i < NB; i++) if (CID[i] === e.pointerId) return follow(i, e.clientX, e.clientY);
    const k = slot(e.pointerId);
    if (k < 0) return;
    // Slid onto a bubble: the zone it left from is kept (still lit, still applied) while it is there.
    const bi = bubAt(e.clientX, e.clientY);
    OV[k] = bi + 1;
    if (bi < 0) Z[k] = zoneY(e.clientY);
    apply();
    if (bi >= 0) follow(bi, e.clientX, e.clientY);
  }, opt);
  const up = (e: PointerEvent) => {
    for (let i = 0; i < NB; i++) if (CID[i] === e.pointerId) return void ((CID[i] = -1), apply());
    const k = slot(e.pointerId);
    if (k < 0) return;
    if (k === 0 && ID[1]! >= 0) (ID[0] = ID[1]!), (Z[0] = Z[1]!), (OV[0] = OV[1]!), (ID[1] = -1), (OV[1] = 0);
    else (ID[k] = -1), (OV[k] = 0);
    apply();
  };
  el.addEventListener("pointerup", up, opt);
  el.addEventListener("pointercancel", up, opt);
  el.addEventListener("contextmenu", (e) => e.preventDefault(), opt);
  return {
    el,
    /** Gas and brake as the rocker has them now. */
    get gas() { return gas; },
    get brake() { return brake; },
    /** Bubble `i`'s element (its slot's), for tests and looks. */
    bubbles: bEl,
    /** Each frame: which bubbles the moment wants (B_TRICK | B_HOP by slot bit). Shown ones pop out,
     *  the rest fade after a short linger; a bubble with a finger on it stays. No allocation. */
    want(mask: number) {
      if (!NB) return;
      const now = performance.now();
      for (let i = 0; i < NB; i++) {
        const w = (mask >> BB[i]!.slot) & 1;
        if (w) LAST[i] = now;
        const s = w || ON[i] || (SHOWN[i] && now - LAST[i]! < LINGER) ? 1 : 0;
        if (s !== SHOWN[i]) (SHOWN[i] = s), bEl[i]!.classList.toggle("hs-out", s === 1), paint(i);
      }
    },
    /** Let go (a pause, leaving). */
    release() { ID[0] = ID[1] = -1; CID.fill(-1); OV[0] = OV[1] = 0; apply(); },
  };
}
export type Rocker = ReturnType<typeof rocker>;
