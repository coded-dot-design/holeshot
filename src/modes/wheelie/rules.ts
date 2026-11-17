// Wheelie City's shared rules, headless: the phases, the events, the hand drag's and the heat's
// numbers, what the neighbours shout, the autopilot's gains, the sprinklers' reach. The fixed table
// (./city.ts) and Endless Wheelie City's open world (./roam.ts) both ride by them; this module holds
// no world, so the game's bundle carries only the one it rides.
export const SESSION = 90;
export const READY = 0, RUN = 1, CRASH = 2, DONE = 3;
/** Events (one ring, read and cleared each step): what, and a value. */
export const E_START = 1, E_TRICK = 2, E_CRASH = 3, E_RESPAWN = 4, E_GRUMP = 5, E_BARK = 6, E_SPLASH = 7, E_BONUS = 8, E_END = 9, E_HOP = 10, E_AIR = 11,
  E_JUMP = 12, E_LAND = 13, E_TICKET = 14, E_ESCAPE = 15, E_STARS = 16, E_UNIT = 17, E_CLEAR = 18,
  /** Unstuck: the prompt (1 up, 0 down); a reset to the last good spot on the street (1 asked for, 2 automatic). */
  E_STUCK = 19, E_RESET = 20,
  /** The hand drag: it starts (value 1); banked (its points) when the nose comes back under 12; lost (the points it had) on a loop-out. */
  E_DRAG = 21, E_BANKED = 22, E_LOST = 23;
/** The hand drag: hold the nose past 12 o'clock HAND_T seconds and the rider drops a hand to the road;
 *  while it drags it earns DRAG_RATE a second ×DRAG_X (× the combo), plus STREAK × seconds² when banked. */
export const HAND_T = 1.5, DRAG_RATE = 40, DRAG_X = 10, STREAK = 120;
/** Heat: a neighbour out, a sprinkler, the dog, per second on a lawn, per point of a banked trick (capped). */
export const HEAT_FROM = { grump: 10, splash: 9, bark: 3, lawn: 7, perPoint: 1 / 150, trickCap: 10 };

/** What they shout (comic and generic, never mean). */
export const LINES = ["HEY! MY LAWN!", "SLOW DOWN!", "I JUST MOWED THAT!", "WHEELS DOWN, KID!", "NOT THE PETUNIAS!", "IT'S SUNDAY!", "BACK IN MY DAY…", "KEEP IT ON THE ROAD!", "I'M CALLING IT IN!", "SOME OF US WORK NIGHTS!"];
/** The autopilot's gains (tuned headless): under the balance point by, gas at rest, nose rate per radian off, most nose rate, gas per rate error, gas per unit of speed under the target, lean per rate error, target speed, brake dead band, brake gain. */
export const AP = [0.008, 0.077, 33.317, 2.172, 0.387, 0.04, 0.729, 3.383, 0.391, 1.244];
/** A sprinkler's reach. */
export const SP_REACH = 2.6;
