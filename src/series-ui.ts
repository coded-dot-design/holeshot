// The SERIES screen and a series round, for the shell (./game.ts): the tier pick (open, locked, best
// place, prizes), the championship under way (standings, the next round's track from above, RIDE
// ROUND / RETIRE), the standings on the result card after a round, and starting a round: a generated
// track (./model/series.ts) in the race scene with the tier's rivals. Strings in, strings out, plus
// one start function; the shell owns the profile and the clicks (`data-series-*`).
import { model as modelOf } from "./data/roster.ts";
import { POINTS, TIERS, UNLOCK_TOP, tier } from "./data/series.ts";
import type { ModeCtx, ModeRun } from "./modes/mode.ts";
import { makeTrack } from "./modes/race/course.ts";
import { trackSvg } from "./modes/race/preview.ts";
import { mountTrack } from "./modes/race/scene.ts";
import { riding, type Profile } from "./model/profile.ts";
import { difficulty, rivals, roundSeed, roundTrack, standings, unlocked, type SeriesRun } from "./model/series.ts";
import type { ModeResult } from "./model/economy.ts";

const num = (n: number) => Math.round(n).toLocaleString("en-US");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const ORD = ["1ST", "2ND", "3RD", "4TH"];
const KIND = ["", "DOUBLE", "WHOOPS", "TRIPLE", "TABLETOP", "STEP-UP", "STEP-DOWN", "FINISH JUMP"];

/** The riders of a championship: the player first, then the rivals (names, plates, bikes). */
function riders(p: Profile, run: Pick<SeriesRun, "tier" | "seed">) {
  const b = riding(p), m = modelOf(b.model);
  return [{ name: p.name || "YOU", number: b.look.number, bike: m.name, me: true }, ...rivals(run, m.cls, b.look.number).map((r) => ({ name: r.name, number: r.number, bike: r.bike.model.name, me: false }))];
}
/** The points table. */
function table(p: Profile, run: SeriesRun, caption: string) {
  const who = riders(p, run);
  const rows = standings(run).map((s, i) => {
    const w = who[s.rider]!, res = run.results.map((x) => (x[s.rider]! < 0 ? "–" : String(x[s.rider]! + 1))).join(" ");
    return `<tr${w.me ? ` class="ds-me"` : ""}><td>${i + 1}</td><th scope="row"><b>#${w.number} ${esc(w.name)}</b><small>${esc(w.bike)}</small></th><td class="ds-res">${res || "·"}</td><td class="ds-pts">${s.points}</td></tr>`;
  }).join("");
  return `<table class="ds-table"><caption>${caption}</caption><thead><tr><th scope="col">POS</th><th scope="col">RIDER</th><th scope="col">ROUNDS</th><th scope="col">PTS</th></tr></thead><tbody>${rows}</tbody></table>`;
}
/** The next round: its track from above and what is on it. */
function nextRound(run: SeriesRun) {
  const T = tier(run.tier), plan = roundTrack(run, run.round), t = makeTrack(plan), d = difficulty(run, run.round);
  const kinds = [...new Set(Array.from({ length: plan.features.length / 3 }, (_, k) => plan.features[k * 3]!))].map((k) => KIND[k]).join(" · ");
  const turns = plan.plan.filter((v) => typeof v !== "number") as { turn: number }[];
  const rights = turns.filter((x) => x.turn < 0).length, pins = turns.filter((x) => Math.abs(x.turn) > 1.4).length;
  const level = d < 0.34 ? "FLOWING" : d < 0.67 ? "TECHNICAL" : "BRUTAL";
  return `<section class="ds-next"><b class="dh-h2">ROUND ${run.round + 1} OF ${T.rounds} · ${esc(t.name)}</b><div class="ds-map">${trackSvg(t, { label: `Round ${run.round + 1}, ${t.name}` })}</div><p class="dh-sub">${level} · lap ${Math.round(t.LAP)} · ${turns.length} turns${rights ? ` (${rights} right)` : ""}${pins ? ` · ${pins} tight` : ""}</p><p class="dh-sub">${kinds}</p></section>`;
}

/** The SERIES screen. */
export function seriesCard(p: Profile, head: string, tabs: string, note: string) {
  const S = p.series, run = S.run;
  if (run) {
    const T = tier(run.tier);
    return `<div class="dh-card ds" data-screen="series">${head}${tabs}<b class="dh-h">${T.name}</b><p class="dh-sub">Round ${run.round + 1} of ${T.rounds} · a win pays ◈ ${num(T.prize[0]!)} · champion ◈ ${num(T.bonus[0]!)}. Points ${POINTS.join(" · ")}.</p><div class="ds-cols">${nextRound(run)}<section>${table(p, run, "STANDINGS")}</section></div><p class="dh-row"><button type="button" class="bui-key dh-go" data-series-go>RIDE ROUND ${run.round + 1}</button><button type="button" class="bui-key" data-series-retire>RETIRE</button></p><p class="dh-sub dh-note" role="status">${esc(note)}</p></div>`;
  }
  const tiers = TIERS.map((T) => {
    const open = unlocked(S, T.id), best = S.best[T.id], after = T.after ? tier(T.after).name : "";
    const status = best === 0 ? "CHAMPION" : best !== undefined ? `BEST ${ORD[best]}` : open ? "OPEN" : `LOCKED · TOP ${UNLOCK_TOP} IN ${after}`;
    return `<li class="ds-tier"${open ? "" : " data-locked"}><span class="dh-mod"><small>${T.rounds} ROUNDS · ${status}</small><b>${T.name}</b><small>${esc(T.blurb)}</small><small>Win ◈ ${num(T.prize[0]!)} a round · champion ◈ ${num(T.bonus[0]!)}</small></span><button type="button" class="bui-key dh-buy" data-series-enter="${T.id}" ${open ? "" : "disabled"}>${open ? "ENTER" : "LOCKED"}</button></li>`;
  }).join("");
  const last = S.last ? `<section>${table(p, S.last, `LAST: ${tier(S.last.tier).name} · FINAL`)}</section>` : "";
  return `<div class="dh-card ds" data-screen="series">${head}${tabs}<b class="dh-h">RACE SERIES</b><p class="dh-sub">A championship of rounds on your ${esc(modelOf(riding(p).model).name)}. Every round is a new track, built for the race and ridden before you get it. Points after each round; prize money every round and a bonus for the championship.${S.titles ? ` Titles: ${S.titles}.` : ""}</p><ul class="dh-list ds-tiers">${tiers}</ul>${last}<p class="dh-sub dh-note" role="status">${esc(note)}</p></div>`;
}

/** The standings block on the result card after a round (or the final table). */
export function seriesResult(p: Profile, r: ModeResult) {
  const s = r.stats.series;
  if (!s) return "";
  const done = !p.series.run, run = done ? p.series.last : p.series.run;
  if (!run) return "";
  const me = standings(run).findIndex((x) => x.rider === 0);
  const head = done ? (me === 0 ? `${tier(s.tier).name} CHAMPION` : `${tier(s.tier).name} · FINAL ${ORD[me]}`) : `AFTER ROUND ${s.round + 1} OF ${s.rounds}`;
  return `<section class="ds-after">${table(p, run, head)}</section>`;
}
/** The result card's keys after a round. */
export const seriesKeys = (p: Profile) => `<button type="button" class="bui-key dh-go" data-go="series">${p.series.run ? `ROUND ${p.series.run.round + 1}` : "SERIES"}</button><button type="button" class="bui-key" data-go="garage">GARAGE</button>`;

/** Start the championship's next round on the player's bike. */
export function startRound(ctx: ModeCtx, p: Profile): ModeRun {
  const run = p.series.run!, T = tier(run.tier), plan = roundTrack(run, run.round);
  const riv = rivals(run, ctx.bike.cls, ctx.number);
  return mountTrack({ ...ctx, seed: roundSeed(run, run.round) }, makeTrack(plan), false, riv.map((x) => x.bike.power), { nerve: T.rivals.nerve });
}
export const seriesName = (p: Profile) => (p.series.run ? `${tier(p.series.run.tier).name} · ROUND ${p.series.run.round + 1}` : "SERIES");
