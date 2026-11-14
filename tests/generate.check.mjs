// The generator's validity, checked on the test's own terms (not generate.ts's): tests/generate.test.mjs
// and its workers. check(plan, G, C) → what is wrong with the track, or "".
/** The independent checks (not the generator's own): returns what is wrong, or "". */
export function check(plan, G, C) {
  const t = C.makeTrack(plan), { TRACK, NT, HX, HZ, LAP } = t;
  if (Math.hypot(TRACK[0] - TRACK[(NT - 1) * 2], TRACK[1] - TRACK[(NT - 1) * 2 + 1]) > 1) return "loop open";
  for (let i = 0; i < NT; i++) if (Math.abs(TRACK[i * 2]) > HX - 4 || Math.abs(TRACK[i * 2 + 1]) > HZ - 4) return "off the table";
  const far = Math.ceil(11 / (LAP / NT));
  for (let i = 0; i < NT; i += 2) for (let j = i + far; j < NT - far + i; j += 2) if (Math.hypot(TRACK[i * 2] - TRACK[j * 2], TRACK[i * 2 + 1] - TRACK[j * 2 + 1]) < G.GEN.sep - 0.05) return `overlap ${i}/${j}`;
  const kinds = new Set(), F = plan.features, n = plan.plan.length;
  let last = -1, lastKind = 0;
  for (let k = 0; k < F.length; k += 3) {
    const v = plan.plan[F[k + 1]];
    if (typeof v !== "number" || v < 0 || F[k + 2] < 0 || F[k + 2] + C.FEATURE_LEN[F[k]] > v) return "feature off its straight";
    kinds.add(F[k]);
    const s = t.FEATURES[(k / 3) * 2 + 1];
    if (s > last) (last = s), (lastKind = F[k]);
  }
  if (!(kinds.has(1) || kinds.has(2))) return "no rhythm or whoops";
  if (!(kinds.has(1) || kinds.has(3))) return "no double or triple";
  if (!(kinds.has(4) || kinds.has(5) || kinds.has(6))) return "no tabletop or step";
  if (lastKind !== 7 || F[F.length - 2] !== n - 2) return "the finish jump is not last";
  return "";
}

