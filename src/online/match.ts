// An online match, headless: the frames every screen runs, the same on every screen. A match is one
// rollback link (./rollback.ts) over the room for as long as the room lasts, and its frames are:
//   HELLO  frames 0..HELLO_FRAMES-1 carry every seat's hello (../net.ts: name, garage bike, look);
//          nothing moves. On frame HELLO_FRAMES (once every hello is final) every screen builds the
//          same ride from the host's pick, the room's seed and those bikes.
//   RIDE   the ride: a race (../modes/race/course.ts, on a track generated from the seed at the host's
//          tier; AI rivals in the empty places), a Free Ride jam (../modes/freeride/jam.ts) or a score
//          run (Big Air, Wheelie City: each screen rides its own arena and its input bits carry its
//          score). Ends when the sim says so (every person past the flag or GRACE after the first;
//          the jam's clock; every score run done).
//   OVER   the result: the sim rolls on to a stop; when every seat is READY in one final frame the
//          next ride is built (a new seed, a new track) on that frame on every screen.
// The rollback saves and restores one arena of bytes: a header (phase, round, frames) and the ride's
// state (the sim's byte views and each person's ride meter), copied in and out around each frame
// (a few KB; nothing allocated). A ride is built only on a final frame (`sure`), so no correction
// ever reaches back past it: the sim object a frame runs on never changes under the rollback.
// `hooks.built` hears each new ride (the shell mounts its scene), `hooks.events` a frame's events the
// first time it runs (sound, stickers, FX), `hooks.over` the result on the final frame it happened.
import type { Engine } from "@fzlt/core/kernel";
import type { Transport } from "@fzlt/core/presence";
import { rollback, decode, hello as helloOf, helloBits, takeHello, readHello, unpackMode, B_GONE, B_READY, B_DONE, GONE, HELLO, HELLO_FRAMES, K_RACE, K_JAM, K_AIR, K_CITY, type Rider } from "../net.ts";
import { DONE, RACE, makeTrack, motoRace, MOTO_TRACK, type MotoRace, type Track } from "../modes/race/course.ts";
import { generateTrack } from "../modes/race/generate.ts";
import { freeJam, type FreeJam } from "../modes/freeride/jam.ts";
import { makeMap, RIDE_MAPS, type RideMap } from "../modes/freeride/maps.ts";
import { meter, type Meter } from "../modes/meter.ts";
import { tune, type Tuned } from "../model/tune.ts";
import { onGround } from "../model/families.ts";
import { difficulty, rivals as seriesRivals } from "../model/series.ts";
import { TIERS } from "../data/series.ts";
import type { Profile } from "../model/profile.ts";

/** Match phases (the header's first number). */
export const HELLO_P = 0, RIDE = 1, OVER = 2;
/** Bytes the rollback keeps per frame: the header, then the ride. */
export const ARENA = 8192, HEAD = 64;
/** A score run ends for everyone this long after it started (seconds), done or not (a stuck screen). */
export const SCORE_CAP = 150;
/** The Free Ride jam maps, in the host's order: the race loop, then the open maps. */
export const JAM_MAPS = [{ id: MOTO_TRACK.id, name: "NEON LOOP" }, ...RIDE_MAPS.map((d) => ({ id: d.id, name: d.name }))];

const mix = (a: number, b: number) => {
  let h = Math.imul((a ^ 0x9e3779b9) >>> 0, 0x85ebca6b) ^ Math.imul(b + 1, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  return (h ^ (h >>> 16)) >>> 0;
};
/** Ride n's seed in a room. */
export const rideSeed = (room: number, round: number) => mix(room >>> 0, 7000 + round);
const TRACKS = new Map<string, Track>(), MAPS = new Map<number, Track | RideMap>();
/** A race's track: generated from the ride's seed at the tier's difficulty (validated, kept once made). */
export function raceTrack(seed: number, tier: number, round: number): Track {
  const T = TIERS[tier] ?? TIERS[0]!, d = difficulty({ tier: T.id }, round % T.rounds), key = `${seed}:${d}`;
  let t = TRACKS.get(key);
  if (!t) {
    const plan = generateTrack(seed, d).plan;
    t = makeTrack({ ...plan, id: `online-${T.id}-${round + 1}` });
    if (TRACKS.size > 8) TRACKS.clear();
    TRACKS.set(key, t);
  }
  return t;
}
/** A jam's map by its index in JAM_MAPS (built once, kept). */
export function jamMap(i: number): Track | RideMap {
  const k = Math.max(0, Math.min(JAM_MAPS.length - 1, i));
  let m = MAPS.get(k);
  if (!m) MAPS.set(k, (m = k ? makeMap(RIDE_MAPS[k - 1]!) : makeTrack(MOTO_TRACK)));
  return m;
}

/** A score run's sim: each seat's score (as its bits carry it), done, and the clock. */
function scoreSim(H: number) {
  const SC = new Float64Array(H), DN = new Uint8Array(H), CL = new Float64Array(1);
  return {
    SC, DN, CL, humans: H,
    bytes: [SC, DN, CL].map((a) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength)),
    step(inputs: Uint32Array) {
      CL[0] = CL[0]! + 1 / 60;
      for (let p = 0; p < H; p++) {
        const b = inputs[p]!;
        // A seat that left keeps the score it had.
        if (!(b & B_GONE)) SC[p] = b & 0xffffff;
        if (b & B_DONE) DN[p] = 1;
      }
    },
    get done() {
      for (let p = 0; p < H; p++) if (!DN[p]) return CL[0]! >= SCORE_CAP;
      return true;
    },
    place(r: number) {
      let n = 0;
      for (let q = 0; q < H; q++) if (q !== r && (SC[q]! > SC[r]! || (SC[q] === SC[r] && q < r))) n++;
      return n;
    },
  };
}
export type ScoreSim = ReturnType<typeof scoreSim>;

/** One ride, as built on every screen. */
export interface Ride {
  kind: number;
  round: number;
  seed: number;
  /** Seats in the match, and each seat's rider and tuned bike (as the hellos carried them). */
  players: number;
  riders: Rider[];
  tuned: Tuned[];
  race: MotoRace | null;
  jam: FreeJam | null;
  score: ScoreSim | null;
  /** The track or map ridden (race, jam), the AI rivals' names and plates (race, the empty places). */
  track: Track | RideMap | null;
  ai: { name: string; number: number }[];
  /** Each person's ride meter (race, jam): seconds, distance, gas, air, wheelie, crashes, hard landings. */
  meters: Meter[];
  /** The race tier, or the jam's map index. */
  sub: number;
}
/** A seat's result, on the frame the ride ended. */
export interface SeatResult {
  place: number;
  /** Race: finished, time, best lap; jam: points, tricks, flips; score runs: the score. */
  finished: boolean;
  time: number;
  bestLap: number;
  points: number;
  tricks: number;
  flips: number;
  /** The meter: seconds, distance, gas, air, wheelie, crashes, hard. */
  M: number[];
}

export interface MatchOptions {
  transport: Transport;
  seat: number;
  players: number;
  /** The room's seed and the host's pick (../net.ts packMode). */
  seed: number;
  mode: number;
  /** This screen's profile (its hello: the riding bike, the look, the name). */
  profile: Profile;
  /** This screen's input bits for frame f once the hello is sent (riding bits, or a score run's;
   *  READY is added here while `ready` is set). */
  input(f: number): number;
  hooks?: {
    built?(r: Ride): void;
    events?(r: Ride): void;
    over?(r: Ride, res: SeatResult[], frame: number): void;
    rewind?(before: boolean): void;
  };
  window?: number;
  delay?: number;
  /** The jam's length (seconds; tests shorten it). */
  jam?: number;
}

export function match(e: Engine, o: MatchOptions) {
  const P = o.players, me = o.seat, pick = unpackMode(o.mode), hooks = o.hooks ?? {};
  const arena = new Uint8Array(ARENA), H = new Int32Array(arena.buffer, 0, HEAD / 4);
  const mine = helloOf(o.profile), hellos = Array.from({ length: P }, (_, p) => (p === me ? mine.slice() : new Uint8Array(HELLO)));
  // Results ring (outside the arena): the frame a ride ended and each seat's numbers then.
  const RT = new Int32Array(128).fill(-1), RV = new Float64Array(128 * 64);
  let ride: Ride | null = null, views: Uint8Array[] = [], riders: Rider[] = [], tunedAll: Tuned[] = [];
  let ready = false;
  const pack = () => {
    let at = HEAD;
    for (const v of views) arena.set(v, at), (at += v.length);
  };
  // (subarray views of the arena per ride, made once a ride: unpacking allocates nothing.)
  let parts: Uint8Array[] = [];
  const unpack = () => {
    for (let i = 0; i < views.length; i++) views[i]!.set(parts[i]!);
  };

  /** Build ride `round` (on a final frame): the same on every screen. */
  function build(round: number) {
    if (!riders.length) (riders = hellos.map((h, p) => readHello(h, p))), (tunedAll = riders.map((r) => tune(r.bike)));
    const seed = rideSeed(o.seed, round), kind = pick.kind;
    // Each bike as it rides this kind's ground (a street bike on the dirt: ../model/families.ts), the same on every screen.
    const tuned = tunedAll.map((t) => onGround(t, kind === K_CITY ? "wheelie" : kind === K_JAM ? "freeride" : kind === K_AIR ? "bigair" : "race"));
    let race: MotoRace | null = null, jam: FreeJam | null = null, score: ScoreSim | null = null, track: Track | RideMap | null = null, ai: Ride["ai"] = [];
    const meters: Meter[] = [];
    if (kind === K_RACE) {
      const tier = Math.min(TIERS.length - 1, pick.sub), T = TIERS[tier]!, t = raceTrack(seed, tier, round);
      const riv = seriesRivals({ tier: T.id, seed }, tuned[0]!.cls).slice(0, Math.max(0, 4 - P));
      ai = riv.map((r) => ({ name: r.name, number: r.number }));
      race = motoRace(seed, t, { power: tuned[0]!.power, shape: tuned[0]!.shape }, riv.map((r) => r.bike.power), { nerve: T.rivals.nerve, humans: P, bikes: tuned.map((x) => ({ power: x.power, shape: x.shape })) });
      race.go(tuned[0]!.power);
      race.clear();
      track = t;
      for (let p = 0; p < P; p++) meters.push(meter("race"));
    } else if (kind === K_JAM) {
      track = jamMap(pick.sub);
      jam = freeJam(track, tuned.map((x) => ({ power: x.power, shape: x.shape })), o.jam);
      jam.clear();
      for (let p = 0; p < P; p++) meters.push(meter("freeride"));
    } else score = scoreSim(P);
    ride = { kind, round, seed, players: P, riders, tuned, race, jam, score, track, ai, meters, sub: pick.sub };
    views = [...(race ?? jam ?? score)!.bytes, ...meters.map((m) => new Uint8Array(m.M.buffer, m.M.byteOffset, m.M.byteLength))];
    let at = HEAD;
    parts = views.map((v) => ((at += v.length), arena.subarray(at - v.length, at)));
    if (at > ARENA) throw new RangeError(`online: a ride's state is ${at} bytes, over the arena's ${ARENA}`);
    arena.fill(0, at);
    pack();
    H[0] = RIDE;
    H[1] = round;
    ready = false;
    hooks.built?.(ride);
  }
  /** Is the ride over (by its own state)? */
  const over = (r: Ride) => (r.race ? r.race.phase === DONE : r.jam ? r.jam.phase === DONE : r.score!.done);
  /** Each seat's numbers now, into results slot k. */
  function record(r: Ride, k: number) {
    for (let p = 0; p < P; p++) {
      const q = k * 64 + p * 16, m = r.meters[p];
      if (r.race) (RV[q] = r.race.place(p)), (RV[q + 1] = r.race.finished(p) ? 1 : 0), (RV[q + 2] = r.race.finishTime(p)), (RV[q + 3] = r.race.bestLap(p));
      else if (r.jam) (RV[q] = r.jam.place(p)), (RV[q + 1] = 1), (RV[q + 4] = r.jam.points(p)), (RV[q + 5] = r.jam.tricks(p)), (RV[q + 6] = r.jam.flips(p));
      else (RV[q] = r.score!.place(p)), (RV[q + 1] = r.score!.DN[p]!), (RV[q + 4] = r.score!.SC[p]!);
      for (let i = 0; i < 7; i++) RV[q + 8 + i] = m ? m.M[i]! : 0;
    }
  }
  function results(k: number): SeatResult[] {
    return Array.from({ length: P }, (_, p) => {
      const q = k * 64 + p * 16;
      return { place: RV[q]!, finished: RV[q + 1] === 1, time: RV[q + 2]!, bestLap: RV[q + 3]!, points: RV[q + 4]!, tricks: RV[q + 5]!, flips: RV[q + 6]!, M: Array.from(RV.subarray(q + 8, q + 15)) };
    });
  }

  const link = rollback(e, {
    transport: o.transport, slot: me, players: P, gone: GONE, bytes: [arena], window: o.window, delay: o.delay,
    input: (f) => (f < HELLO_FRAMES ? helloBits(mine, f) : (o.input(f) | (ready ? B_READY : 0)) >>> 0),
    step(inputs, f, live, sure) {
      RT[f & 127] = -1;
      if (H[0] === HELLO_P) {
        if (f < HELLO_FRAMES) return;
        if (!sure) return false;
        return void build(0);
      }
      const r = ride!;
      unpack();
      if (H[0] === OVER) {
        let rb = 0;
        for (let p = 0; p < P; p++) if (inputs[p]! & B_READY) rb |= 1 << p;
        if (rb === (1 << P) - 1) {
          if (!sure) return false;
          return void build(H[1]! + 1);
        }
      }
      const sim = r.race ?? r.jam;
      if (sim) {
        for (let p = 0; p < P; p++) decode(H[0] === OVER ? inputs[p]! & ~0xffffff : inputs[p]!, p, sim.IN, sim.AUTO);
        const ph = sim.phase;
        if (r.race) r.race.stepAll(1 / 60);
        else r.jam!.step(1 / 60);
        if (ph === RACE)
          for (let p = 0; p < P; p++) {
            const done = r.race ? r.race.finished(p) : r.jam!.runs[p]!.phase === DONE;
            if (!done && H[0] === RIDE) r.meters[p]!.tick(sim.riders[p]!, 1 / 60);
          }
        if (live) hooks.events?.(r);
        sim.clear();
      } else r.score!.step(inputs);
      if (H[0] === RIDE && over(r)) {
        H[0] = OVER;
        H[2] = f;
        RT[f & 127] = f;
        record(r, f & 127);
      }
      pack();
    },
    confirm(inputs, f) {
      if (f < HELLO_FRAMES) {
        for (let p = 0; p < P; p++) if (p !== me) takeHello(hellos[p]!, f, inputs[p]! & B_GONE ? 0 : inputs[p]!);
        return;
      }
      if (RT[f & 127] === f && ride) hooks.over?.(ride, results(f & 127), f);
    },
    rewind: hooks.rewind,
  });
  return {
    link,
    get ride() {
      return ride;
    },
    /** The match's phase now (HELLO_P, RIDE, OVER) and the ride's number. */
    get phase() {
      return H[0]!;
    },
    get round() {
      return H[1]!;
    },
    /** Ask for the next ride (READY rides every frame's bits from now until it starts). */
    set ready(on: boolean) {
      ready = on;
    },
    get ready() {
      return ready;
    },
    /** The riders as the hellos carried them (empty until the hello is final). */
    get riders() {
      return riders;
    },
    /** The arena (the rollback's whole state: tests compare it byte for byte). */
    arena,
    destroy: () => link.destroy(),
  };
}
export type Match = ReturnType<typeof match>;
