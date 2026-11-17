// The throttle rocker: gas and brake under one thumb on a touch screen (every mode's pad). One tall
// pill with three zones the thumb slides between without lifting: the top is GAS, the bottom is
// BRAKE, the middle SEAM is both at once (the wheelie and the feather: hold the gas, roll onto the
// brake). A second finger anywhere on the pill adds the brake while the first holds the gas. The
// zones light at once (icons only; the words are in the aria-labels); a short buzz on a zone change
// where the device has one (never with reduced motion). It drives `controls` intents through
// `press()` like the pad's own keys, so game code reads `down("gas")` / `down("brake")` and never
// knows. Desktop keys are untouched. A first-time hint ("slide to the middle to wheelie") stays
// until the seam is used once (remembered per browser, best effort).
import type { Controls } from "@fzlt/core/input";

/** Zones of the pill, top to bottom, as fractions of its height: gas above SEAM0, brake below SEAM1. */
export const SEAM0 = 0.4, SEAM1 = 0.62;
/** What a finger at fraction `f` (0 top .. 1 bottom) of the pill asks for: 1 gas, 2 brake, 3 both. */
export const zoneAt = (f: number) => (f < SEAM0 ? 1 : f > SEAM1 ? 2 : 3);

export const ICON_GAS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z" fill="currentColor"/></svg>';
export const ICON_BRAKE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="5.6" r="1.3" fill="currentColor"/><circle cx="18.4" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="18.4" r="1.3" fill="currentColor"/><circle cx="5.6" cy="12" r="1.3" fill="currentColor"/></svg>';
export const ICON_SEAM = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18c2-7 5-11 13-13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="6" cy="19" r="3" fill="currentColor"/></svg>';
const HINT_KEY = "holeshot:rocker-seam";

/** Mount the rocker in `host` (the pad's element): drives `gas` and `brake` on `c`. */
export function rocker(c: Controls, host: HTMLElement, o: { reduced?: boolean; signal?: AbortSignal; gas?: string; brake?: string } = {}) {
  const gi = o.gas ?? "gas", bi = o.brake ?? "brake";
  const el = document.createElement("div");
  el.className = "hs-rocker";
  el.setAttribute("role", "group");
  el.setAttribute("aria-label", "Throttle: slide up for gas, down for brake, the middle for both (a wheelie)");
  el.innerHTML = `<span class="hs-rz hs-rz-gas" role="img" aria-label="Gas">${ICON_GAS}</span><span class="hs-rz hs-rz-seam" role="img" aria-label="Gas and brake together: wheelie">${ICON_SEAM}</span><span class="hs-rz hs-rz-brake" role="img" aria-label="Brake">${ICON_BRAKE}</span><b class="hs-rhint" hidden>slide to the middle to wheelie</b>`;
  host.append(el);
  const hint = el.lastElementChild as HTMLElement;
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
    const k = ID[0]! < 0 ? 0 : ID[1]! < 0 ? 1 : -1;
    if (k < 0) return;
    ID[k] = e.pointerId;
    Z[k] = zoneAt(frac(e.clientY));
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    apply();
  }, opt);
  el.addEventListener("pointermove", (e) => {
    const k = slot(e.pointerId);
    if (k < 0) return;
    Z[k] = zoneAt(frac(e.clientY));
    apply();
  }, opt);
  const up = (e: PointerEvent) => {
    const k = slot(e.pointerId);
    if (k < 0) return;
    if (k === 0 && ID[1]! >= 0) (ID[0] = ID[1]!), (Z[0] = Z[1]!), (ID[1] = -1);
    else ID[k] = -1;
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
    /** Let go (a pause, leaving). */
    release() { ID[0] = ID[1] = -1; apply(); },
  };
}
export type Rocker = ReturnType<typeof rocker>;
