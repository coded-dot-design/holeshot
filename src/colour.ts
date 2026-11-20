// Colours as "#rrggbb" strings: the one mix the bike's bodies, the rig and the garage's looks share.
/** Mix `hex` toward `to` by t (0..1). */
export function mix(hex: string, to: string, t: number) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16), c = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return "#" + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
}
