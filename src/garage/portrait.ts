// The racer's profile picture: their helmet in the game art's style (the box art's and the icon's
// helmet, side profile, facing right): flat colours with the art's ink outline, coloured live from
// the kit (the shell's paint, the stripe on the peak, the goggle's band and the visor tint with its
// glint) in the kit's shape (../bike/rig.ts RigHelmet). An SVG string, no images; the same shapes the
// 3D rig draws, so the chip, the garage and the turntable agree.
import { bandOf, strapOf, type RigHelmet } from "../bike/rig.ts";
import { helmetOf, mix } from "./look.ts";

import type { Profile } from "../model/profile.ts";

const INK = "#0b0a14";
/** Shells: the MX full face (its chin bar jutting forward and down, as in the art), the street dome
 *  (round, a flush rounded chin), the open face (the jaw open under the goggle). */
const SHELL = "M-44 20L-46-10Q-44-42-8-46H14Q40-42 44-14L46 2 74 24 58 46 10 42-30 38Z";
const DOME = "M-46 18Q-52-40 0-50Q46-48 54-8L58 18Q56 40 30 43L-30 40Z";
const OPEN = "M-44 20L-46-10Q-44-42-8-46H14Q40-42 44-14L44-2 24 4Q16 20 22 38H-30Z";
/** Peaks: off the crown's front, raked up, thick at the root and still thick at the tip (the art's). */
const PEAK: Partial<Record<RigHelmet, string>> = {
  peak: "M-10-44L40-54 78-62 76-40 34-26Z",
  duck: "M-10-44L40-52 98-52 96-34 34-26Z",
  retro: "M2-44L36-50 56-48 54-36 20-32Z",
  fin: "M-10-44L40-54 78-62 76-40 34-26Z",
  spike: "M-10-44L40-54 78-62 76-40 34-26Z",
};

/** The helmet portrait for colours `c` (`#rrggbb`: the shell, the stripe, the visor) in shape `shape`;
 *  `label` names it for assistive tech (empty: decorative, hidden). */
export function helmetSVG(c: { helmet: string; stripe: string; visor: string }, shape: RigHelmet, label = "") {
  const band = bandOf(c.helmet, c.stripe), glint = mix(c.visor, "#ffffff", 0.72), dome = shape === "dome", open = shape === "retro";
  const o = `stroke="${INK}" stroke-width="5" stroke-linejoin="round"`;
  const top = shape === "fin" ? `<path d="M-34-40L6-48-24-70Z" fill="${c.stripe}" ${o}/>`
    : shape === "spike" ? [-28, -12, 4].map((x) => `<path d="M${x - 7}-44L${x}-64 ${x + 7}-46Z" fill="${c.stripe}" ${o}/>`).join("") : "";
  const face = dome
    // The street dome's big visor in its rim, a stripe over the crown.
    ? `<path d="M-30-38Q-10-50 20-46" fill="none" stroke="${c.stripe}" stroke-width="7" stroke-linecap="round"/><path d="M0-28Q30-36 54-22L57 8Q30 14 2 8Z" fill="${c.visor}" stroke="${band}" stroke-width="6" stroke-linejoin="round"/><path d="M0-28Q30-36 54-22L57 8Q30 14 2 8Z" fill="none" ${o}/>`
    : `<path d="M-46-10H14V3H-46Z" fill="${strapOf(c.helmet, band)}" ${o}/><rect x="8" y="-23" width="46" height="32" rx="7" fill="${band}" ${o}/><rect x="13" y="-18" width="36" height="22" rx="5" fill="${c.visor}"/>`;
  // The open face: the face under the goggle, in the shell's opening.
  const skin = open ? `<path d="M24 4H44Q52 18 44 30Q38 38 24 38Q16 20 24 4Z" fill="#2a2233" ${o}/>` : "";
  const peak = PEAK[shape];
  return `<svg class="dh-helm" viewBox="-58 -78 156 124" ${label ? `role="img" aria-label="${label}"` : `aria-hidden="true"`} data-helmet="${shape}"><g>${top}<path d="${dome ? DOME : open ? OPEN : SHELL}" fill="${c.helmet}" ${o}/>${skin}${face}<rect x="${dome ? 38 : 36}" y="${dome ? -24 : -15}" width="9" height="5" rx="1.5" fill="${glint}"/>${peak ? `<path d="${peak}" fill="${c.stripe}" ${o}/>` : ""}</g></svg>`;
}

/** The racer's portrait from their kit. */
export const portraitOf = (k: Profile["kit"], label = "") => { const h = helmetOf(k); return helmetSVG(h, h.shape, label); };
