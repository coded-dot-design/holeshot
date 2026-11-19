// HOLESHOT online: two to four screens over a fizlet-rooms room (@fzlt/core/presence's `join` for the
// room and its lobby, the same room server Dune Hop, Salvo Bay and Battlefield Blitz use). The sims
// are deterministic, so only inputs travel: each frame every seat's inputs packed in 32 bits, the
// room's 12-byte INPUT message. @fzlt/core/presence/rollback runs each frame at once with this screen's own
// input and a guess for the others'; ./online/match.ts is the match those frames run (the hello, the
// ride, the result, the next ride). This file is the wire: the input bits, the host's pick (one byte,
// on the room's START), and the hello: the first HELLO_FRAMES frames carry three bytes each of every
// seat's name, garage bike and look (the room relays 12-byte messages only, so a profile can't ride
// one JSON message: 33 bytes in 11 frames, under 0.2 s), so every screen simulates the same bikes.
import { join, hash32 } from "@fzlt/core/presence";
import { MODELS, STARTERS } from "./data/roster.ts";
import { PARTS, MODS, SETUPS, TYRES, type ModId, type TyreId } from "./data/economy.ts";
import { PAINTS, SWATCHES, HELMETS, VISORS, PATTERNS, GRAPHICS, PLASTICS, PLATES } from "./data/looks.ts";
import { fresh, newBike, riding, type BikeSave, type Profile, type RiderKit } from "./model/profile.ts";

/** Input bits (riding): gas 0..15 (bits 0–3), brake 0..15 (4–7), lean 1..255 (8–15, 128 level),
 *  steer 1..255 (16–23, 128 straight); the autopilot (24), ready for the next ride (25), the seat left
 *  (26), done (27: a score run finished), reset (28). A score run's frames carry the score in bits 0–23 instead;
 *  the hello frames carry three bytes of the seat's hello there. */
export const B_AUTO = 1 << 24, B_READY = 1 << 25, B_GONE = 1 << 26, B_DONE = 1 << 27;
/** Reset to the last good place (../modes/unstuck.ts): the sims read it as IN[4] === 2. */
export const B_RESET = 1 << 28;
/** The endless rides together (K_ENDLESS, K_ENDCITY): a hop (Endless Wheelie City's L), and REGROUP
 *  (the host's: everyone to the host; anyone else's: to the host). B_DONE there is END (banked). */
export const B_HOP = 1 << 29, B_REGROUP = 1 << 30;
/** The combo button held (../modes/stunts.ts: every endless mode), the last free bit. */
export const B_COMBO = 0x80000000;
/** The endless rides' commands (../modes/freeride/jam.ts, ../modes/wheelie/jam.ts `CMD`): END, REGROUP, HOP, COMBO. */
export const C_END = 1, C_REGROUP = 2, C_HOP = 4, C_COMBO = 8;
/** Seat r's commands from its bits (a seat that left: END, so its ride is banked). */
export const cmdOf = (bits: number) => (bits & B_DONE ? C_END : 0) | (bits & B_REGROUP && !(bits & B_GONE) ? C_REGROUP : 0) | (bits & B_HOP && !(bits & B_GONE) ? C_HOP : 0) | (bits & B_COMBO && !(bits & B_GONE) ? C_COMBO : 0);
/** At most this many seats in a room, and this many name characters. */
export const SEATS = 4, NAME = 8;
/** A seat that left plays these bits from the frame after its last input (every screen the same):
 *  the autopilot rides its bike, it is ready for the next ride and done with a score run. */
export const GONE = (B_GONE | B_AUTO | B_READY | B_DONE) >>> 0;
const q4 = (v: number) => Math.max(0, Math.min(15, Math.round(v * 15)));
const q8 = (v: number) => Math.max(1, Math.min(255, Math.round(v * 127) + 128));

/** Pack one seat's riding inputs (gas, brake, lean +back, steer +right) and flags into 32 bits. */
export const encode = (gas: number, brake: number, lean: number, steer: number, flags = 0) => (q4(gas) | (q4(brake) << 4) | (q8(lean) << 8) | (q8(steer) << 16) | flags) >>> 0;
/** Unpack seat r's bits into IN (five a rider: the sims' gas, brake, lean, steer, trick) and AUTO. */
export function decode(bits: number, r: number, IN: Float64Array, AUTO: Uint8Array) {
  const q = r * 5;
  IN[q] = (bits & 15) / 15;
  IN[q + 1] = ((bits >>> 4) & 15) / 15;
  IN[q + 2] = (((bits >>> 8) & 255) - 128) / 127;
  IN[q + 3] = (((bits >>> 16) & 255) - 128) / 127;
  IN[q + 4] = bits & B_RESET && !(bits & B_GONE) ? 2 : 0;
  AUTO[r] = bits & (B_AUTO | B_GONE) ? 1 : 0;
}
/** A score run's bits: the score so far (0..16,777,215) and done. */
export const scoreBits = (score: number, done: boolean, flags = 0) => ((Math.max(0, Math.min(0xffffff, Math.round(score))) | (done ? B_DONE : 0) | flags) >>> 0);

/** Online modes: a race on a generated track, a Free Ride jam, Big Air and Wheelie City score runs,
 *  and the endless rides together: an ENDLESS ground (sub: the biome) and Endless Wheelie City. */
export const K_RACE = 0, K_JAM = 1, K_AIR = 2, K_CITY = 3, K_ENDLESS = 4, K_ENDCITY = 5;
/** The host's pick as one byte: the kind (bits 0–2), the race tier, the jam's map or the biome (3–5). */
export const packMode = (kind: number, sub: number) => (kind & 7) | ((sub & 7) << 3);
export const unpackMode = (m: number) => ({ kind: m & 7, sub: (m >> 3) & 7 });

// Names: A–Z, 0–9 and a space, one byte a character (0 ends the name).
const ABC = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";
/** A name as the room keeps it: upper case, letters, digits and spaces, at most NAME characters. */
export const cleanName = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 ]+/g, "").replace(/\s+/g, " ").trim().slice(0, NAME).trim();

// ---- the hello: a seat's name, garage bike and look in HELLO bytes ----
/** Bytes in a hello (a version byte last), and the frames that carry it (three bytes a frame). */
export const HELLO = 33, HELLO_FRAMES = 11;
const idx = (list: { id: string }[], id: string) => Math.max(0, list.findIndex((x) => x.id === id));
const optIdx = (k: keyof typeof SETUPS, id: string) => Math.max(0, SETUPS[k].opts.findIndex((o) => o.id === id));
const TYRE_IDS = Object.keys(TYRES) as TyreId[];
const q255 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));

/** The profile's riding bike, its look and the rider's name and kit, as HELLO bytes. */
export function hello(p: Profile, out = new Uint8Array(HELLO)) {
  out.fill(0);
  const name = cleanName(p.name), b = riding(p), k = p.kit;
  for (let i = 0; i < NAME; i++) out[i] = i < name.length ? Math.max(0, ABC.indexOf(name[i]!, 1)) : 0;
  out[8] = idx(MODELS, b.model);
  PARTS.forEach((pt, i) => (out[9 + i] = q255(b.parts[pt])));
  const M = b.mods;
  out[14] = (M.power & 3) | ((M.brakes & 3) << 2) | ((M.weight & 3) << 4) | ((M.travel & 1) << 6);
  out[15] = (M.cells & 3) | ((TYRE_IDS.indexOf(b.tyre) & 3) << 2) | ((optIdx("gearing", b.gearing) & 3) << 4) | ((optIdx("spring", b.spring) & 3) << 6);
  // (Bits 2-5: the family upgrades, one bit each: every screen tunes the same bike.)
  out[16] = (optIdx("map", b.map) & 3) | ((M.wbar & 1) << 2) | ((M.swap & 1) << 3) | ((M.bore & 1) << 4) | ((M.boost & 1) << 5);
  out[17] = q255(b.dmg.bars);
  out[18] = q255(b.dmg.plastics);
  out[19] = b.look.number;
  out[20] = idx(PAINTS, b.look.paint);
  out[21] = idx(GRAPHICS, b.look.graphics);
  out[22] = idx(PLASTICS, b.look.plastics);
  out[23] = idx(PLATES, b.look.plate);
  out[24] = idx(HELMETS, k.helmet);
  out[25] = idx(SWATCHES, k.helmetPaint);
  out[26] = idx(VISORS, k.visor);
  out[27] = idx(SWATCHES, k.jersey);
  out[28] = idx(SWATCHES, k.pants);
  out[29] = idx(PATTERNS, k.pattern);
  out[30] = idx(SWATCHES, k.boots);
  out[31] = idx(SWATCHES, k.gloves);
  out[32] = 1;
  return out;
}
/** Hello frame f's bits (f < HELLO_FRAMES): three bytes of the hello. */
export const helloBits = (h: Uint8Array, f: number) => (h[f * 3]! | (h[f * 3 + 1]! << 8) | (h[f * 3 + 2]! << 16)) >>> 0;
/** Put hello frame f's bits back into the hello bytes. */
export function takeHello(h: Uint8Array, f: number, bits: number) {
  h[f * 3] = bits & 255;
  h[f * 3 + 1] = (bits >>> 8) & 255;
  h[f * 3 + 2] = (bits >>> 16) & 255;
}
/** A seat as every screen rides it: a name, a garage bike (as the hello carried it: quantized, so
 *  every screen tunes the very same numbers, this one too) and a profile-shaped look for lookOf. */
export interface Rider { name: string; bike: BikeSave; profile: Profile }
/** HELLO bytes back into a Rider; a hello that never came whole (the seat left first) rides a stock starter. */
export function readHello(h: Uint8Array, seat: number): Rider {
  const ok = h[32] === 1;
  let name = "";
  for (let i = 0; i < NAME && ok && h[i]; i++) name += ABC[h[i]!] ?? "";
  name = name.trim() || "P" + (seat + 1);
  const b: BikeSave = newBike(ok ? MODELS[h[8]!]?.id ?? STARTERS[0]!.id : STARTERS[0]!.id, "net" + seat);
  if (ok) {
    PARTS.forEach((pt, i) => (b.parts[pt] = h[9 + i]! / 255));
    const lv = (k: ModId, v: number) => Math.min(MODS[k].max, v);
    b.mods = { power: lv("power", h[14]! & 3), brakes: lv("brakes", (h[14]! >> 2) & 3), weight: lv("weight", (h[14]! >> 4) & 3), travel: lv("travel", (h[14]! >> 6) & 1), cells: lv("cells", h[15]! & 3), wbar: (h[16]! >> 2) & 1, swap: (h[16]! >> 3) & 1, bore: (h[16]! >> 4) & 1, boost: (h[16]! >> 5) & 1 };
    b.tyre = TYRE_IDS[(h[15]! >> 2) & 3] ?? "med";
    b.gearing = SETUPS.gearing.opts[(h[15]! >> 4) & 3]?.id ?? "stock";
    b.spring = SETUPS.spring.opts[(h[15]! >> 6) & 3]?.id ?? "stock";
    b.map = SETUPS.map.opts[h[16]! & 3]?.id ?? "std";
    b.dmg = { bars: h[17]! / 255, plastics: h[18]! / 255 };
    b.look = { number: Math.max(1, Math.min(99, h[19]!)), paint: PAINTS[h[20]!]?.id ?? "gridline", graphics: GRAPHICS[h[21]!]?.id ?? "none", plastics: PLASTICS[h[22]!]?.id ?? "scheme", plate: PLATES[h[23]!]?.id ?? "scheme" };
  } else b.look.number = seat + 1;
  const s = (i: number, d: string) => (ok ? SWATCHES[h[i]!]?.id ?? d : d);
  const kit: RiderKit = { helmet: ok ? HELMETS[h[24]!]?.id ?? "peak" : "peak", helmetPaint: s(25, "white"), visor: ok ? VISORS[h[26]!]?.id ?? "smoke" : "smoke", jersey: s(27, "cyan"), pants: s(28, "ink"), pattern: ok ? PATTERNS[h[29]!]?.id ?? "stripe" : "stripe", boots: s(30, "white"), gloves: s(31, "ink") };
  return { name, bike: b, profile: { ...fresh(), name, bikes: [b], ride: 0, kit } };
}

/** A hash of a sim's state (its byte views), for presence's desync check. */
export function hashOf(bytes: Uint8Array[]) {
  let h = 2166136261;
  for (const b of bytes) h = hash32(b, h);
  return h >>> 0;
}
export { rollback, type Rollback } from "@fzlt/core/presence/rollback";

/** The room: `url` (wss://…), room `room`, `size` seats (every screen asks the same size: the room
 *  refuses a different one), an invite code. `want` seats start it (the host's ask: 0 waits for the
 *  host's `go`), `mode` is the host's pick. Resolves on the start with the transport, your seat, the
 *  seat count, the shared seed and the host's pick. `lobby` hears who is in while you wait; its
 *  `go()` (the host's) starts with the seats taken. (Dune Hop's, as it is.) */
export function joinRoom(
  url: string,
  room: number,
  size: number,
  code: string,
  o: { want: number; mode: number; signal?: AbortSignal; retry?: number; lobby?: (seat: number, seated: number, size: number, go: () => void) => void },
) {
  let asked = 0;
  return join(`${url}/room/${room}?players=${size}`, o.signal, ["fizlet-rooms", "invite." + code], {
    ...(o.retry !== undefined ? { retry: o.retry } : {}),
    lobby(start, seat, seated, n) {
      // The host asks once for its count (the room starts by itself when that many are in).
      if (seat === 0 && asked !== o.want && o.want > 1) (asked = o.want), start(o.want, o.mode & 255);
      o.lobby?.(seat, seated, n, () => seat === 0 && seated > 1 && start(0, o.mode & 255));
    },
  });
}
