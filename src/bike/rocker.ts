// The throttle rocker: gas and brake under one thumb on a touch screen (every mode's pad). One tall
// pill with three zones the thumb slides between without lifting: the top is GAS, the bottom is
// BRAKE, the middle SEAM is both at once (the wheelie and the feather: hold the gas, roll onto the
// brake). A second finger anywhere on the pill adds the brake while the first holds the gas. The
// zones light at once (icons only; the words are in the aria-labels); a short buzz on a zone change
// where the device has one (never with reduced motion). It drives `controls` intents through
// `press()` like the pad's own keys, so game code reads `down("gas")` / `down("brake")` and never
// knows. With `combo` (the endless modes) a COMBO button slides out from the gas side while the gas is
// held, at 10 to 12 o'clock round the top of the pill: tap it with a second finger, or slide the gas
// thumb onto it (the gas stays on while it is over the button) and back. Desktop keys are untouched. A first-time hint ("slide to the middle to wheelie") stays
// until the seam is used once (remembered per browser, best effort).
import type { Controls } from "@fzlt/core/input";

/** Zones of the pill, top to bottom, as fractions of its height: gas above SEAM0, brake below SEAM1. */
export const SEAM0 = 0.4, SEAM1 = 0.62;
/** What a finger at fraction `f` (0 top .. 1 bottom) of the pill asks for: 1 gas, 2 brake, 3 both. */
export const zoneAt = (f: number) => (f < SEAM0 ? 1 : f > SEAM1 ? 2 : 3);

export const ICON_GAS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z" fill="currentColor"/></svg>';
export const ICON_BRAKE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="5.6" r="1.3" fill="currentColor"/><circle cx="18.4" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="18.4" r="1.3" fill="currentColor"/><circle cx="5.6" cy="12" r="1.3" fill="currentColor"/></svg>';
export const ICON_SEAM = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18c2-7 5-11 13-13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="6" cy="19" r="3" fill="currentColor"/></svg>';
export const ICON_COMBO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.6 6.2 6.7.6-5.1 4.4 1.6 6.6L12 16.3 6.2 19.8l1.6-6.6L2.7 8.8l6.7-.6z" fill="currentColor"/></svg>';
const HINT_KEY = "holeshot:rocker-seam";

/** Mount the rocker in `host` (the pad's element): drives `gas` and `brake` on `c`. */
export function rocker(c: Controls, host: HTMLElement, o: { reduced?: boolean; signal?: AbortSignal; gas?: string; brake?: string; combo?: string } = {}) {
  const gi = o.gas ?? "gas", bi = o.brake ?? "brake", ci = o.combo ?? "";
  const el = document.createElement("div");
  el.className = "hs-rocker";
  el.setAttribute("role", "group");
  el.setAttribute("aria-label", "Throttle: slide up for gas, down for brake, the middle for both (a wheelie)");
  el.innerHTML = `<span class="hs-rz hs-rz-gas" role="img" aria-label="Gas">${ICON_GAS}</span><span class="hs-rz hs-rz-seam" role="img" aria-label="Gas and brake together: wheelie">${ICON_SEAM}</span><span class="hs-rz hs-rz-brake" role="img" aria-label="Brake">${ICON_BRAKE}</span><b class="hs-rhint" hidden>slide to the middle to wheelie</b>`;
  host.append(el);
  const hint = el.lastElementChild as HTMLElement;
  // The combo button (only where the mode has one).
  let cb: HTMLElement | null = null;
  if (ci) {
    cb = document.createElement("b");
    cb.className = "hs-rcombo";
    cb.setAttribute("role", "img");
    cb.setAttribute("aria-label", "Combo trick: tap, or slide the gas thumb onto it; hold for more points (C)");
    cb.innerHTML = ICON_COMBO + "<i>COMBO</i>";
    el.classList.add("hs-hascombo");
    el.append(cb);
  }
  const onCombo = (x: number, y: number) => {
    if (!cb || !gas) return false;
    const r = cb.getBoundingClientRect(), p = 10;
    return x >= r.left - p && x <= r.right + p && y >= r.top - p && y <= r.bottom + p;
  };
  // The combo: a finger of its own on it (CID), or a rocker finger slid over it (OV).
  const CID = new Int32Array([-1]), OV = new Uint8Array(2);
  let combo = false;
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
    const cm = !!ci && (CID[0]! >= 0 || (ID[0]! >= 0 && OV[0] === 1) || (ID[1]! >= 0 && OV[1] === 1));
    if (cm !== combo) (combo = cm), c.press(ci, cm), el.dataset.combo = cm ? "1" : "";
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
  const frac = (y: number) => {
    const r = el.getBoundingClientRect();
    return r.height > 0 ? (y - r.top) / r.height : 0;
  };
  const slot = (id: number) => (ID[0] === id ? 0 : ID[1] === id ? 1 : -1);
  const opt = o.signal ? { signal: o.signal } : undefined;
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (CID[0]! < 0 && onCombo(e.clientX, e.clientY)) {
      CID[0] = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
      return apply();
    }
    const k = ID[0]! < 0 ? 0 : ID[1]! < 0 ? 1 : -1;
    if (k < 0) return;
    ID[k] = e.pointerId;
    OV[k] = 0;
    Z[k] = zoneAt(frac(e.clientY));
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    apply();
  }, opt);
  el.addEventListener("pointermove", (e) => {
    const k = slot(e.pointerId);
    if (k < 0) return;
    // Slid onto the combo button: the gas stays on (the zone is kept) while it is over it.
    OV[k] = onCombo(e.clientX, e.clientY) ? 1 : 0;
    if (!OV[k]) Z[k] = zoneAt(frac(e.clientY));
    apply();
  }, opt);
  const up = (e: PointerEvent) => {
    if (CID[0] === e.pointerId) return void ((CID[0] = -1), apply());
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
    get combo() { return combo; },
    /** The combo button (null without one). */
    comboEl: cb,
    /** Let go (a pause, leaving). */
    release() { ID[0] = ID[1] = CID[0] = -1; OV[0] = OV[1] = 0; apply(); },
  };
}
export type Rocker = ReturnType<typeof rocker>;
