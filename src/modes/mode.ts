// The mode interface: every way to ride (Race, Free Ride, Big Air, Wheelie City, and whatever comes
// next) plugs into the shell the same way. The shell tunes the player's bike (../model/tune.ts),
// calls `start(ctx)` with it, and the mode mounts its scene in `ctx.host`, rides it, and reports one
// RunStats through `ctx.end` when the event is over (or `ctx.quit` when the rider leaves). The shell
// turns the stats into credits and wear (../model/economy.ts `settle`), saves, and shows the result.
// A mode never touches the profile, the economy or the page outside its host.
import type { Engine } from "@fzlt/core/kernel";
import type { RigColors, RigHelmet } from "../bike/rig.ts";
import type { Tuned } from "../model/tune.ts";

export type ModeId = "race" | "freeride" | "bigair" | "wheelie";

/** What a ride did, for the payout and the wear. Every mode fills the common part. */
export interface RunStats {
  mode: ModeId;
  /** Seconds ridden, world units covered, seconds on the gas, in the air, up on one wheel. */
  seconds: number;
  distance: number;
  gas: number;
  air: number;
  wheelie: number;
  crashes: number;
  /** Landings harder than the economy's hardDrop. */
  hard: number;
  /** The event ran to its end (a finish, the clock) rather than being left. */
  finished: boolean;
  /** Race: finishing place (0 is 1st), time, best lap, whether it led every lap. */
  place?: number;
  time?: number;
  bestLap?: number;
  led?: boolean;
  /** Big Air: the judges' total (out of 100), flips. Wheelie City and Big Air: the score. */
  judges?: number;
  flips?: number;
  score?: number;
  /** A line for the result card (what happened, in words). */
  summary?: string;
  /** The map or track ridden (its id). */
  where?: string;
}

/** What the shell hands a mode. */
export interface ModeCtx {
  /** The element to mount in (absolutely filled; inside the game's shadow root). */
  host: HTMLElement;
  /** The player's bike, tuned (power, shape, rig kind). */
  bike: Tuned;
  /** The bike's and rider's colours, and the helmet. */
  look: Omit<RigColors, "seat" | "frame" | "tyre" | "rim" | "metal" | "pipe" | "glow">;
  helmet: RigHelmet;
  /** The plate number and the rider's name (the HUD). */
  number: number;
  name: string;
  /** The event's seed (rivals, judges, a generated track). */
  seed: number;
  /** Which map or track (a mode with several; its default if absent). */
  map?: string;
  /** Ride itself (the landing hero, the tests). */
  auto?: boolean;
  /** The landing hero: no HUD, no cards, loop forever on the autopilot. */
  attract?: boolean;
  reduced: boolean;
  sound: boolean;
  /** The event is over: its stats. */
  end(stats: RunStats): void;
  /** The rider left mid-event (the stats so far). */
  quit(stats: RunStats): void;
  /** Open the shell's pause card (the ❚❚ key, Escape, P). */
  menu(): void;
}

/** A running mode, for the shell and the tests. */
export interface ModeRun {
  engine: Engine;
  /** A snapshot for tests and harnesses (phase, clock, speed…). */
  readonly state: Record<string, unknown> & { phase: string; speed: number };
  /** The autopilot rides the player's bike. */
  auto: boolean;
  /** The camera's framing (for the no-zoom test): chase distance and the camera's field of view. */
  readonly camera: { dist: number; fov: number; view: string };
  /** End the event now (as if the clock ran out / the flag fell): `ctx.end` follows. */
  finish(): void;
  /** The stats so far (for leaving mid-event). */
  stats(): RunStats;
  pause(on: boolean): void;
  destroy(): void;
}

export interface Mode {
  id: ModeId;
  name: string;
  blurb: string;
  /** Maps or tracks it offers (id, name), the first is the default. */
  maps: { id: string; name: string }[];
  start(ctx: ModeCtx): ModeRun;
}

/** An empty RunStats for `mode` (a mode fills it as it rides). */
export const blankStats = (mode: ModeId): RunStats => ({ mode, seconds: 0, distance: 0, gas: 0, air: 0, wheelie: 0, crashes: 0, hard: 0, finished: false });
