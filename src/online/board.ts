// The shared session scoreboard (online endless: an ENDLESS ground, Endless Wheelie City): one row of
// numbers a rider, kept in the ride's state, so every screen shows the same board on the same frame
// and a rollback puts it back with the rest. What a ride scores comes in through one door, `feed`:
// the endless sims feed their tricks, combos and hand drags into it as they happen and set the
// distance each frame, so a new way to score (a trick list, a combo button, a new callout) only
// needs a new `feed` call with its points (and, for the best trick, its id): the board, the result
// and the standings follow. Zero allocation (one Float64Array, made once).

/** A row's numbers: distance ridden, the best trick's points and its id, combo points, hand drags,
 *  tricks landed, the session's points (what places it: tricks + combos + drags + bonuses). */
export const SB_DIST = 0, SB_BEST = 1, SB_BEST_ID = 2, SB_COMBO = 3, SB_DRAGS = 4, SB_TRICKS = 5, SB_POINTS = 6, SB_N = 8;
/** What a feed is: a trick landed (points, its id), a combo banked (points), a hand drag banked
 *  (points), a bonus (points: an escape, a crosswalk; nothing else). */
export const F_TRICK = 1, F_COMBO = 2, F_DRAG = 3, F_BONUS = 4;

export function board(H: number) {
  const B = new Float64Array(H * SB_N);
  return {
    B, humans: H,
    bytes: new Uint8Array(B.buffer, B.byteOffset, B.byteLength),
    reset: () => void B.fill(0),
    /** Rider r's number k. */
    get: (r: number, k: number) => B[r * SB_N + k]!,
    /** The distance ridden (world units: the sims set it each frame). */
    dist(r: number, d: number) {
      B[r * SB_N + SB_DIST] = d;
    },
    /** A sim whose own scorer is the truth (Endless Wheelie City's: tickets take points away) sets
     *  the points each frame after its feeds. */
    score(r: number, v: number) {
      B[r * SB_N + SB_POINTS] = v;
    },
    /** The one door in: rider r scored `pts` by `what` (F_TRICK with the trick's `id`). */
    feed(r: number, what: number, pts: number, id = 0) {
      const o = r * SB_N;
      if (what === F_TRICK) {
        B[o + SB_TRICKS] = B[o + SB_TRICKS]! + 1;
        if (pts > B[o + SB_BEST]!) (B[o + SB_BEST] = pts), (B[o + SB_BEST_ID] = id);
      } else if (what === F_COMBO) B[o + SB_COMBO] = B[o + SB_COMBO]! + pts;
      else if (what === F_DRAG) B[o + SB_DRAGS] = B[o + SB_DRAGS]! + 1;
      B[o + SB_POINTS] = B[o + SB_POINTS]! + pts;
    },
    /** Rider r's place by points, then distance (0 is first; ties: the lower seat). */
    place(r: number) {
      let n = 0;
      const p = B[r * SB_N + SB_POINTS]!, d = B[r * SB_N + SB_DIST]!;
      for (let q = 0; q < H; q++) {
        if (q === r) continue;
        const pq = B[q * SB_N + SB_POINTS]!, dq = B[q * SB_N + SB_DIST]!;
        if (pq > p || (pq === p && (dq > d || (dq === d && q < r)))) n++;
      }
      return n;
    },
  };
}
export type Board = ReturnType<typeof board>;
