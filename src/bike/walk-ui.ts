// Walking the bike, on the HUD (every mode's scene): a small WALK chip while the rider pushes it
// (./bike.ts `walking`), and on a touch screen a one-time hint the first time the bike, ridden, sits
// stopped with no gas ("No gas? Stick back to walk it out"): it goes once the bike has been walked (remembered
// per browser, best effort). Cosmetic: reads the bike, writes nothing back.
import type { Bike } from "./bike.ts";

const HINT_KEY = "holeshot:walk-hint";

/** Mount the chip and the hint in `hud`; `touch`: the pad is showing (the hint is for thumbs). */
export function walkUi(hud: HTMLElement, touch: () => boolean) {
  const chip = document.createElement("b"), hint = document.createElement("p");
  chip.className = "hs-walk";
  chip.textContent = "WALK";
  chip.hidden = true;
  chip.setAttribute("aria-hidden", "true");
  hint.className = "hs-walkhint";
  hint.textContent = "No gas? Stick back to walk it out";
  hint.hidden = true;
  hud.append(chip, hint);
  let seen = false, rode = false;
  try { seen = localStorage.getItem(HINT_KEY) === "1"; } catch { seen = false; }
  /** Each frame: the bike ridden. */
  function update(b: Bike) {
    const w = b.walking;
    if (chip.hidden === w) chip.hidden = !w;
    if (w && !seen) {
      seen = true;
      try { localStorage.setItem(HINT_KEY, "1"); } catch { /* private mode: shown again next time */ }
    }
    // Ridden, then stopped on the ground with no gas (stuck against something, overshot): the hint.
    const sp = b.speed < 0 ? -b.speed : b.speed;
    if (sp > 2) rode = true;
    const show = !seen && rode && touch() && !b.crashed && b.air === 0 && b.throttle < 0.02 && sp < 0.3;
    if (hint.hidden === show) hint.hidden = !show;
  }
  return { chip, hint, update };
}
