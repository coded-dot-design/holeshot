// The speed chip on a ride's HUD: the player's speed through ../model/units.ts's `speed` formatter
// (the rider's units: mph by default, km/h with Metric; any display scale lives there too). Physics
// speeds are world units a second (about metres). Formatted only when the speed moves by a tenth.
import { speed, type Units } from "../model/units.ts";

/** A speed chip after `after` (the distance chip, or the HUD's first), classes `<p>-chip <p>-speed`. */
export function speedo(after: Element, p: string, units: Units = "imperial") {
  const chip = document.createElement("b");
  chip.className = `${p}-chip ${p}-speed`;
  chip.innerHTML = `<span></span><i></i>`;
  after.after(chip);
  const num = chip.firstChild as HTMLElement, unit = chip.lastChild as HTMLElement;
  let was = NaN, shown = "";
  /** Write the speed (world units a second, either way along the heading). */
  const write = (ups: number) => {
    const q = Math.round(Math.abs(ups) * 10);
    if (q === was) return;
    was = q;
    const s = speed(q / 10, units), cut = s.lastIndexOf(" ");
    if (s === shown) return;
    shown = s;
    num.textContent = s.slice(0, cut);
    unit.textContent = s.slice(cut + 1);
  };
  write(0);
  return write;
}
