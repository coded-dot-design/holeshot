// A ride's corner keys, icon only (each with its aria-label): reset, the view (chase cam or map:
// pressed in and lit while the map is up), mute (pressed in while muted), light/dark (when the page
// gives the game its theme switch), pause. Board UI press language: raised is off, pressed in (no
// drop shadow) is on. One row for every mode; class `<p>-key` plus `<p>-reset`, `-view`, `-mute`,
// `-theme`, `-menu`; online in the endless rides together, `-regroup` first (to the host, or everyone
// to the host).
const svg = (d: string) => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const ICON = {
  reset: svg(`<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>`),
  chase: svg(`<rect x="3" y="7" width="13" height="10" rx="2"/><path d="m16 11 5-3v8l-5-3z"/>`),
  map: svg(`<path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>`),
  sound: svg(`<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>`),
  muted: svg(`<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="m16 9 5 6m0-6-5 6"/>`),
  theme: svg(`<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>`),
  pause: svg(`<path d="M8 5v14M16 5v14"/>`),
  regroup: svg(`<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20a5 5 0 0 1 10 0M11 20a5 5 0 0 1 10 0"/>`),
};

/** The keys' HTML for prefix `p` (`view`: show the view key; `theme`: the page gave a theme switch). */
export function keysHTML(p: string, o: { reset: string; view?: boolean; theme?: boolean; regroup?: string }) {
  const k = (c: string, label: string, icon: string, extra = "") => `<button type="button" class="${p}-key ${p}-${c}" aria-label="${label}"${extra}>${icon}</button>`;
  return (o.regroup ? k("regroup", o.regroup, ICON.regroup) : "") + k("reset", o.reset, ICON.reset) + k("view", "Map view (V)", ICON.chase, ` aria-pressed="false"${o.view === false ? " hidden" : ""}`) + k("mute", "Mute (M)", ICON.sound, ` aria-pressed="false"`) + (o.theme ? k("theme", "Light or dark", ICON.theme) : "") + k("menu", "Pause (P)", ICON.pause);
}
/** Paint the view key: pressed in and lit on the map (`map` true), raised in chase. */
export function paintView(k: HTMLElement, map: boolean) {
  k.innerHTML = map ? ICON.map : ICON.chase;
  k.setAttribute("aria-pressed", "" + map);
}
/** Paint the mute key: pressed in while muted. */
export function paintMute(k: HTMLElement, on: boolean) {
  k.innerHTML = on ? ICON.sound : ICON.muted;
  k.setAttribute("aria-pressed", "" + !on);
}
