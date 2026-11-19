// The three naming tiers (src/data/names.ts, docs/names.md), headless: one set of ids, three sets of
// display names. The default is NOD; REAL only with ?names=real or test credits; SAFE is the data's own
// names. Every tier names every maker, model and maker paint; switching tiers changes display names
// only (ids, prices, the power and the paints' colours are untouched) and always comes back to the
// same names. docs/names.md lists every name of every tier. The SAFE build (HOLESHOT_NAMES=safe)
// carries none of the REAL or NOD names: built into a scratch directory and grepped.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const N = await import("../src/data/names.ts");
const { MAKERS, MODELS, CLASSES, makerOf } = await import("../src/data/roster.ts");
const { PAINTS } = await import("../src/data/looks.ts");
const { NOD } = await import("../src/data/names/nod.ts");
const { REAL } = await import("../src/data/names/real.ts");
const FACTORY = PAINTS.filter((p) => p.id.startsWith("f-"));
/** Every name a player reads in the tier shown now: makers, models, factory paints, class maker lines. */
const shown = () => ({
  makers: Object.values(MAKERS).map((m) => m.name), models: MODELS.map((m) => m.name), paints: FACTORY.map((p) => p.name),
  full: MODELS.map((m) => `${makerOf(m).name} ${m.name}`), classes: Object.values(CLASSES).map((c) => c.maker),
});
const at = (t) => (N.useNames(t), shown());

test("names: the default is NOD; REAL only with ?names=real or test credits (any ?credits= or ?money= inf value)", () => {
  assert.equal(N.BUILD, "nod");
  assert.equal(N.names(), "nod");
  assert.deepEqual(N.tiers(), ["safe", "nod", "real"]);
  for (const [q, t] of [["", "nod"], ["?names=real", "real"], ["?names=REAL", "real"], ["?money=inf", "real"], ["?credits=inf", "real"], ["?money=infinite", "real"], ["?credits=∞", "real"], ["?money=INFINITY", "real"], ["?names=safe", "nod"], ["?names=nod", "nod"], ["?money=1", "nod"]]) assert.equal(N.tierFor(q), t, q || "(none)");
});

test("names: every tier names every maker, model and factory paint, and the approved rows read as approved", () => {
  for (const set of [NOD, REAL]) {
    assert.deepEqual(Object.keys(set.makers).sort(), Object.keys(MAKERS).sort());
    assert.deepEqual(Object.keys(set.models).sort(), MODELS.map((m) => m.id).sort());
    assert.deepEqual(Object.keys(set.paints).sort(), FACTORY.map((p) => p.id).sort());
  }
  const safe = at("safe"), nod = at("nod"), real = at("real");
  const row = (id) => MODELS.findIndex((m) => m.id === id);
  // Rows of the owner-approved table (docs/names.md): SAFE · NOD · REAL.
  for (const [id, s, n, r] of [
    ["buzzline", "BLUEWAKE RIPPER 125", "YAMORI YOWLER 125 2T", "YAMAHA YZ125"],
    ["hivequeen", "BLUEWAKE RIPPER 250", "YAMORI YOWLER 250 2T", "YAMAHA YZ250"],
    ["razorhive", "LIMEJET SPRITE 150", "KAWAZAKURA KRAKEN JR 150 2T", "KAWASAKI KX 2-STROKE"],
    ["bulkhead", "EMBERLINE BLAZE 450 PRO", "HONZO CRIMSON 450 FACTORY", "HONDA CRF450R WORKS EDITION"],
    ["slag-ox", "LIMEJET BRUTE 450", "KAWAZAKURA KRAKEN 450F", "KAWASAKI KX450"],
    ["glidewire", "TRAILKIT CUB", "MACVIX KIT FOX", "MACFOX KIT FOX"],
    ["sparkhound", "BUZZWORKS DART", "SURGE-ON LIGHT BUZZ", "SUR-RON LIGHT BEE"],
    ["gridrat", "BUZZWORKS DART MAX", "SURGE-ON ULTRA BUZZ", "SUR-RON ULTRA BEE"],
    ["overcharge", "VOLTHOWL GREYWOLF", "STARHOWL GREYWOLF MX", "STARK VARG MX"],
    ["feral-coil", "VOLTHOWL ALPHA", "STARHOWL ALPHA WOLF", "STARK VARG ALPHA"],
    ["curb-pup", "EMBERLINE BLOCK PUP 125", "HONZO GROWL 125", "HONDA GROM"],
    ["tidebreaker", "BLUEWAKE TIDEBREAKER 600", "YAMORI RIPTIDE 600", "YAMAHA R6"],
    ["bare-knuckle", "IRONJAW BARE KNUCKLE V4", "DUCELLI STRIKER V4", "DUCATI STREETFIGHTER V4"],
  ]) assert.deepEqual([safe.full[row(id)], nod.full[row(id)], real.full[row(id)]], [s, n, r], id);
  assert.deepEqual([safe, nod, real].map((x) => x.paints[FACTORY.findIndex((p) => p.id === "f-yamada")]), ["BLUEWAKE BLUE", "YAMORI BLUE", "YAMAHA BLUE"]);
  assert.deepEqual([safe, nod, real].map((x) => x.paints[FACTORY.findIndex((p) => p.id === "f-surgeon")]), ["BUZZWORKS TEAL", "SURGE-ON BUZZ", "SUR-RON TEAL"], "no Sting");
  assert.deepEqual([safe, nod, real].map((x) => x.classes.at(-1)), ["EMBERLINE · BLUEWAKE · IRONJAW", "HONZO · YAMORI · DUCELLI", "HONDA · YAMAHA · DUCATI"], "the street class's makers follow the tier");
  // No name of one tier leaks into another's (the shared fox and wolf words aside: every full name differs).
  for (const [a, b] of [[safe, nod], [safe, real], [nod, real]]) for (let i = 0; i < MODELS.length; i++) assert.notEqual(a.full[i], b.full[i], MODELS[i].id);
  // No "Sting" (a real e-moto's name) in any tier; the naked V4 is red in every tier.
  for (const t of ["safe", "nod", "real"]) {
    N.useNames(t);
    assert.ok(![...Object.values(MAKERS).map((m) => m.motto), ...MODELS.map((m) => m.blurb), ...PAINTS.map((p) => p.name)].some((x) => /sting/i.test(x)), t);
  }
  assert.equal(MAKERS.ironjaw.colors[0], PAINTS.find((p) => p.id === "f-ironjaw").plastic);
  assert.ok(/^#d/.test(MAKERS.ironjaw.colors[0]) && MAKERS.ironjaw.colors[0] !== MAKERS.hondo.colors[0], "its own red");
  N.useNames("nod");
});

test("names: switching tiers changes display names only, and comes back to the same names", () => {
  const ids = () => JSON.stringify([Object.keys(MAKERS), MODELS.map((m) => [m.id, m.maker, m.price, m.power]), PAINTS.map((p) => [p.id, p.plastic, p.plastic2, p.plate, p.ink])]);
  const before = ids(), nod = at("nod");
  for (const t of ["real", "safe", "real", "nod"]) N.useNames(t);
  assert.equal(ids(), before);
  assert.deepEqual(shown(), nod);
  assert.equal(N.useNames("bogus"), "nod", "an unknown tier shows the build's");
});

test("names: docs/names.md lists every name of every tier", () => {
  const doc = readFileSync(new URL("../docs/names.md", import.meta.url), "utf8");
  for (const t of ["safe", "nod", "real"]) {
    const s = at(t);
    for (const x of [...s.makers, ...s.full, ...s.paints]) assert.ok(doc.includes(x), `${t}: ${x}`);
  }
  N.useNames("nod");
});

test("names: a SAFE build (HOLESHOT_NAMES=safe) carries none of the REAL or NOD names", () => {
  const out = mkdtempSync(join(tmpdir(), "holeshot-safe-"));
  try {
    execFileSync(process.execPath, ["scripts/build.mjs"], { env: { ...process.env, HOLESHOT_NAMES: "safe", HOLESHOT_OUT: out }, stdio: "pipe" });
    const safe = at("safe"), mine = new Set([...safe.makers, ...safe.models, ...safe.paints]);
    // Every REAL and NOD display string the SAFE tier does not share (the fox and wolf words).
    const theirs = [NOD, REAL].flatMap((s) => [...Object.values(s.makers), ...Object.values(s.models), ...Object.values(s.paints)].flatMap((e) => [e.name, e.motto, e.blurb])).filter((x) => x && !mine.has(x));
    for (const f of ["holeshot.mjs", "holeshot.js"]) {
      const js = readFileSync(join(out, f), "utf8");
      assert.ok(js.includes('"BLUEWAKE"') && js.includes('"BARE KNUCKLE V4"'), `${f}: the SAFE names are in it`);
      // Short names (R6, YZ125, GROM) could match minified code: look for them as string literals.
      const hits = theirs.filter((x) => (x.length < 6 ? js.includes(`"${x}"`) || js.includes(`\`${x}\``) : js.includes(x)));
      assert.deepEqual(hits, [], `${f}: no REAL or NOD names`);
      for (const w of ["YAMAHA", "HONDA", "KAWASAKI", "DUCATI", "STARK", "SUR-RON", "MACFOX", "YAMORI", "HONZO", "KAWAZAKURA", "STARHOWL", "SURGE-ON", "MACVIX", "DUCELLI"]) assert.ok(!js.includes(w), `${f}: ${w}`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
    N.useNames("nod");
  }
});
