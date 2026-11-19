// The racer's profile picture: their helmet in the game art's style (the box art's and the icon's
// helmet, side profile, facing right): flat colours with the art's ink outline, coloured live from
// the kit (the shell's paint, the stripe on the peak, the goggle's band and the visor tint with its
// glint) in the kit's shape (../bike/rig.ts RigHelmet). An SVG string, no images; the same shapes the
// 3D rig draws, so the chip, the garage and the turntable agree.
import { bandOf, type RigHelmet } from "../bike/rig.ts";
import { helmetOf, mix } from "./look.ts";
import type { Profile } from "../model/profile.ts";

const INK = "#0b0a14";
/** Shells (the chin bar's shape is the shape's): a full-face MX shell, the street dome, the open face. */
const SHELL = "M-44 20L-46-10Q-44-42-8-46H14Q40-42 44-14L46 6 64 18 54 40H10L-30 38Z";
const DOME = "M-44 20L-46-10Q-44-44-4-48H10Q42-44 46-14L50 8 54 24 44 40H10L-30 38Z";
const OPEN = "M-44 20L-46-10Q-44-42-8-46H14Q40-42 44-14L46 6 34 14 24 38H-30Z";
/** Peaks, raking forward and up off the crown. */
const PEAK: Partial<Record<RigHelmet, string>> = {
  peak: "M-8-46L42-52 88-66 86-50 32-30Z",
  duck: "M-8-46L42-52 104-62 100-46 32-30Z",
  retro: "M0-46L40-48 60-44 56-36 20-34Z",
  fin: "M-8-46L42-52 88-66 86-50 32-30Z",
  spike: "M-8-46L42-52 88-66 86-50 32-30Z",
};

/** The helmet portrait for colours `c` (`#rrggbb`: the shell, the stripe, the visor) in shape `shape`;
 *  `label` names it for assistive tech (empty: decorative, hidden). */
export function helmetSVG(c: { helmet: string; stripe: string; visor: string }, shape: RigHelmet, label = "") {
  const band = bandOf(c.helmet, c.stripe), glint = mix(c.visor, "#ffffff", 0.72), dome = shape === "dome", open = shape === "retro";
  const o = `stroke="${INK}" stroke-width="5" stroke-linejoin="round"`;
  const top = shape === "fin" ? `<path d="M-34-40L6-48-24-70Z" fill="${c.stripe}" ${o}/>`
    : shape === "spike" ? [-28, -12, 4].map((x) => `<path d="M${x - 7}-44L${x}-64 ${x + 7}-46Z" fill="${c.stripe}" ${o}/>`).join("") : "";
  const face = dome
    ? `<path d="M-14-30Q-4-40 12-40" fill="none" stroke="${c.stripe}" stroke-width="7" stroke-linecap="round"/><rect x="4" y="-24" width="50" height="32" rx="7" fill="${band}" ${o}/><rect x="10" y="-19" width="40" height="22" rx="5" fill="${c.visor}"/>`
    : `<path d="M-45-22H14V-4H-46Z" fill="${band}" ${o}/><rect x="8" y="-23" width="46" height="32" rx="7" fill="${band}" ${o}/><rect x="13" y="-18" width="36" height="22" rx="5" fill="${c.visor}"/>`;
  const skin = open ? `<path d="M30 12L44 10 36 34H18Z" fill="#2a2233" ${o}/>` : "";
  const peak = PEAK[shape];
  return `<svg class="dh-helm" viewBox="-56 -76 168 124" ${label ? `role="img" aria-label="${label}"` : `aria-hidden="true"`} data-helmet="${shape}"><g>${top}<path d="${dome ? DOME : open ? OPEN : SHELL}" fill="${c.helmet}" ${o}/>${skin}${face}<rect x="${dome ? 34 : 36}" y="-15" width="9" height="5" rx="1.5" fill="${glint}"/>${peak ? `<path d="${peak}" fill="${c.stripe}" ${o}/>` : ""}</g></svg>`;
}

/** The racer's portrait from their kit. */
export const portraitOf = (k: Profile["kit"], label = "") => { const h = helmetOf(k); return helmetSVG(h, h.shape, label); };
