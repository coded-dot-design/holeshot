// The speed chip on a ride's HUD: the player's speed in the rider's units (../model/units.ts: mph by
// default, km/h with Metric). Physics speeds are world units a second (about metres). Written only
// when the whole number changes.
import { far, type Units } from "../model/units.ts";

/** A speed chip after `after` (the distance chip, or the HUD's first), classes `<p>-chip <p>-speed`. */
export function speedo(after: Element, p: string, units: Units = "imperial") {
  const chip = document.createElement("b");
  chip.className = `${p}-chip ${p}-speed`;
  chip.innerHTML = `<span>0</span><i>${units === "metric" ? "KM/H" : "MPH"}</i>`;
  after.after(chip);
  const out = chip.firstChild as HTMLElement;
  let was = 0;
  /** Write the speed (world units a second, either way along the heading). */
  return (ups: number) => {
    const v = Math.round(far(Math.abs(ups) * 3600, units));
    if (v !== was) (was = v), (out.textContent = "" + v);
  };
}
