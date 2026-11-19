// The controls, one source: the landing's Controls section and the game's CONTROLS card both read
// these. The keyboard from the game's own bindings (src/modes/*/scene.ts MAP), the gamepad from
// src/bike/kit.ts gamepad(), the phone from the touch controls (the stick and the throttle rocker).

/** Keyboard groups: each row is the keys (a "+" between keys pressed together), what it does, a note. */
export const KEYS: { group: string; rows: [string[], string, string?][] }[] = [
  { group: "RIDE", rows: [[["Space", "J"], "Gas"], [["K", "Shift"], "Brake"], [["W", "S", "↑", "↓"], "Lean", "back lifts the front; in the air it pitches the bike"], [["A", "D", "←", "→"], "Steer"], [["Space", "+", "K"], "Wheelie", "gas and brake together"]] },
  { group: "TRICKS", rows: [[["L"], "Hop", "every endless ride"], [["C"], "Trick", "hold for more; in Big Air the trick ladder (L or E too)"], [["R"], "Reset", "back to the last good spot"]] },
  { group: "GAME", rows: [[["V"], "View", "chase cam or the map"], [["M"], "Mute"], [["P", "Esc"], "Pause"]] },
];
/** The gamepad: the button, what it does. */
export const PAD: [string, string][] = [["Left stick", "lean and steer"], ["RT or A", "gas"], ["LT or B", "brake"], ["X, Y or RB", "trick or hop"], ["LB", "combo"], ["Back", "reset"]];
/** The phone, in a line. */
export const TOUCH_LINE = "The stick under your left thumb leans and steers. Under your right: one throttle rocker. Slide, never lift.";
/** The phone: the stick under the left thumb, the throttle rocker under the right; each step, what it does. */
export const TOUCH: [string, string][] = [
  ["Thumb on GAS", "the top zone lights: go."],
  ["Slide to the middle", "the seam is gas and brake at once: a wheelie."],
  ["Slide onto COMBO", "it pops out of the gas side; the gas stays held."],
  ["Slide back", "onto the gas, never lifting."],
  ["Flick the stick", "back, then forward, fast: a bunny hop."],
];
