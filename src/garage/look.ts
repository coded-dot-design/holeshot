// The profile's looks → the rig's colours: the riding bike's paint scheme, its plastics colour, its
// graphics kit and plate decal (with the rider's number on the side plates), the crash damage (bent
// bars, cracked plastics dull the colour), and the rider's kit. Used by every scene (ModeCtx.look)
// and the garage's preview (with a try-on applied first).
import type { RigHelmet } from "../bike/rig.ts";
import { HELMETS, paint as paintOf, PLASTICS, PLATES, swatch, visor as visorOf } from "../data/looks.ts";
import type { ModeCtx } from "../modes/mode.ts";
import { riding, type Profile } from "../model/profile.ts";

/** Mix `hex` toward `to` by t (0..1). */
export function mix(hex: string, to: string, t: number) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16), c = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return "#" + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
}

/** The bike's and rider's colours for the rig, from the profile. */
export function lookOf(p: Profile): { look: ModeCtx["look"]; helmet: RigHelmet; number: number } {
  const b = riding(p), pt = paintOf(b?.look.paint ?? "gridline"), k = p.kit, L = b?.look;
  const jersey = swatch(k.jersey).hex, pants = swatch(k.pants).hex, helmet = swatch(k.helmetPaint).hex, gloves = swatch(k.gloves).hex, vis = visorOf(k.visor).hex;
  const stripe = k.pattern === "stripe" ? helmet : k.pattern === "split" ? pants : k.pattern === "accent" ? gloves : k.pattern === "neon" ? vis : jersey;
  const own = L && L.plastics !== "scheme" ? PLASTICS.find((x) => x.id === L.plastics)?.hex : "";
  const decal = PLATES.find((x) => x.id === (L?.plate ?? "scheme"));
  const crack = b?.dmg.plastics ?? 0, dull = (c: string) => (crack > 0.05 ? mix(c, "#6b6880", 0.35 * crack) : c);
  const plate = decal?.plate || pt.plate, ink = decal?.ink || pt.ink;
  return {
    look: {
      plastic: dull(own || pt.plastic), plastic2: dull(pt.plastic2), plate, ink, jersey, pants, helmet, stripe, visor: vis, boots: swatch(k.boots).hex, gloves,
      gfx: L?.graphics ?? "none", graphic: pt.plastic2 === (own || pt.plastic) ? pt.plate : pt.plastic2, side: plate, sideInk: ink, num: L?.number ?? 7,
      bend: b?.dmg.bars ?? 0, cracks: crack,
    },
    helmet: (HELMETS.find((h) => h.id === k.helmet)?.id ?? "peak") as RigHelmet,
    number: L?.number ?? 7,
  };
}
