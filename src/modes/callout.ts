// The trick callout: a big trick-name pop with its points over the ride (every endless mode's HUD),
// and the reader for the stunts' own events (../modes/stunts.ts: the combo button's tricks, the whip,
// the air banked on a landing). The drags come through each mode's own events; the scene calls
// `show` for them too. The pop is CSS (stunts.css); with reduced motion it just appears. No
// allocation per frame: text is set only on an event.
import { COMBOS, ST_TRICK, ST_DONE, ST_WHIP, ST_LANDED, type Stunts } from "./stunts.ts";

export function callout(host: HTMLElement, reduced: boolean) {
  const el = document.createElement("p");
  el.className = "hs-call" + (reduced ? " hs-still" : "");
  el.setAttribute("aria-hidden", "true");
  el.hidden = true;
  el.innerHTML = "<b></b><i></i>";
  host.append(el);
  const name = el.firstChild as HTMLElement, pts = el.lastChild as HTMLElement;
  const T = new Float64Array(1);
  return {
    el,
    /** Pop `title` (and a points line) for `secs`. `kind`: go (gold), air (cyan), bad (red). */
    show(title: string, line: string, kind = "go", secs = 1.6) {
      name.textContent = title;
      pts.textContent = line;
      el.dataset.kind = kind;
      el.hidden = false;
      if (!reduced) (el.classList.remove("hs-pop"), void el.offsetWidth, el.classList.add("hs-pop"));
      T[0] = secs;
    },
    /** Each frame: true while it is up (the scene keeps drawing). */
    step(dt: number) {
      if (T[0]! <= 0) return false;
      T[0] = T[0]! - dt;
      if (T[0]! <= 0) el.hidden = true;
      return true;
    },
    hide() { T[0] = 0; el.hidden = true; },
    get up() { return T[0]! > 0; },
  };
}
export type Callout = ReturnType<typeof callout>;

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
/** The stunts' events since the last clear: callouts and what the screen reader hears. */
export function stuntCalls(st: Stunts, call: Callout, say: (s: string) => void, cue: (name: string) => void) {
  for (let k = 0; k < st.n; k++) stuntCall(st.ev[k * 2]!, st.ev[k * 2 + 1]!, st, call, say, cue);
}
/** One stunts event (type `ty`, value `v`, of `st`): its callout (online, the jams forward them). */
export function stuntCall(ty: number, v: number, st: Stunts, call: Callout, say: (s: string) => void, cue: (name: string) => void) {
  if (ty === ST_TRICK) call.show(COMBOS[v]!, "HOLD IT", "go", 9), cue("trick");
  else if (ty === ST_DONE && v === 0) call.hide();
  else if (ty === ST_DONE) {
    const air = st.WH[4] === 1, nm = COMBOS[st.CO[6]!]!;
    call.show(nm, air ? `+${fmt(v)} · LAND IT` : `+${fmt(v)}`, air ? "air" : "go");
    say(`${nm}, ${fmt(v)} points${air ? ": land it" : ""}`);
  } else if (ty === ST_WHIP) call.show(v > 1 ? `WHIP ×${v}` : "WHIP!", "STRAIGHTEN IT BEFORE YOU LAND", "air", 1.2), cue("trick"), say(v > 1 ? `Whip times ${v}` : "Whip");
  else if (ty === ST_LANDED) call.show("LANDED!", `+${fmt(v)}`, "go"), cue("cheer"), say(`Landed it: ${fmt(v)} points`);
}
/** A friend's stunts event as the short line over their head (online), or "" for none. */
export function friendStunt(ty: number, v: number, st: Stunts) {
  if (ty === ST_TRICK) return COMBOS[v]!;
  if (ty === ST_DONE && v > 0) return `${COMBOS[st.CO[6]!]!} +${fmt(v)}`;
  if (ty === ST_WHIP) return v > 1 ? `WHIP ×${v}` : "WHIP!";
  if (ty === ST_LANDED) return `LANDED +${fmt(v)}`;
  return "";
}
