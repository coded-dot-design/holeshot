# Holeshot: architecture

One rider, one garage, many ways to ride. This page is the map for anyone adding to the game: where
each piece lives, the contract between the shell and a mode, how a garage bike turns into what the
physics rides, where the economy's numbers live, and how to add a map or a mode.

## Modules

```
src/
  index.ts              the public entry: createHoleshot, MODES, the roster
  game.ts               the shell: profile, the screens (the garage is home; LET'S RIDE; ⚙ settings), pause and result cards, event lifecycle
  game.css              the shell's Board UI styles (each mode scene has its own sheet)
  html.ts               the cards' small HTML helpers (numbers, escaping, a condition bar)
  garage/
    view.ts             the garage card (parts & mods, paint & kit with try-on, showroom) and its clicks; "before you ride"
    look.ts             lookOf(profile): the rig's colours (paint, plastics, graphics, plate decal, number, damage)
    garage.css          the garage's sheet
  series-ui.ts          the SERIES screen, the standings on a round's result, starting a round
  ride-ui.ts            LET'S RIDE: the four groups (RACE, ENDLESS, FREE RIDE, TRACK DAY), MX/SX, SX_READY
  series.css            its sheet
  bike/
    bike.ts             the bike sim: a pure, fixed-step, deterministic dirt bike on a heightfield
    rig.ts              the bike and rider drawn with @fzlt/core/diorama (helmet shapes, colours)
    kit.ts              particle pools, the engine's voice, the gamepad read
  data/
    roster.ts           4 classes × 4 models from 6 makers: names, blurbs, Power curves, suspension, prices, upkeep
    economy.ts          every number of the economy: start credits, payouts, wear rates, prices, garage spots, the pit crew
    series.ts           the Race Series: tiers, rounds, points, prizes, bonuses, rivals' names and level
    looks.ts            paint schemes, the rider kit (helmets, visors, colours, patterns)
  model/
    profile.ts          the save: schema, normalize, migrate, load/save (localStorage), export/import code
    tune.ts             tune(bike) → what the sim rides (power, shape) and the garage's feel bars
    garage.ts           garage actions: service (tyre compounds), upgrade, tune choices, repair, try on / dress, buy, sell, trade in
    upkeep.ts           part states and warnings, the seeded failure roll, a ride's extra wear and damage, the service log
    economy.ts          settle(stats) → credits + wear; apply(profile, result); the pit crew
    series.ts           the championship: unlocks, enter/retire, round tracks, rivals, scoring, prize lines
  modes/
    mode.ts             the Mode interface, ModeCtx, ModeRun, RunStats
    meter.ts            the ride meter every mode ticks (seconds, distance, gas, air, wheelie, crashes, hard landings)
    index.ts            MODES (every mode; LET'S RIDE groups them: ../ride-ui.ts), TRACKS (race tracks), FREE_MAPS (free-ride maps)
    race/course.ts      TrackPlan → makeTrack(): centre line, profile, terrain, rival speeds; motoRace()
    race/generate.ts    the seeded track generator: draft → validate (shape + an autopilot race) → TrackPlan
    race/preview.ts     a track from above as an SVG string (the series screen)
    race/scene.ts       the track scene, shared by Race and Free Ride (mountTrack)
    freeride/session.ts freeRun(): one rider on a track's table or an open map, no laps; tricks
    freeride/maps.ts    the open maps (Dune Sea, the Quarry, Forest Enduro, Night Park): makeMap(def)
    freeride/scenery.ts each open map's look: palette, ground bands, neon lines, scenery, sky
    freeride/picker.ts  LET'S RIDE → FREE RIDE: a key per map with its preview (picker.css)
    bigair/show.ts      airShow(): the arena and the run; bigair/tricks.ts the air-trick scorer
    bigair/scene.ts     the arena scene (mountAir)
    wheelie/hoods.ts    the four neighbourhoods as data (layouts, humps, street graphs); wheelie/cops.ts the heat and the patrol
    wheelie/city.ts     the town's ground and the session; wheelie/ride.ts the ride adapter; wheelie/tricks.ts the scorer
    wheelie/scene.ts    the town scene (mountCity)
    freeride/jam.ts     freeJam(): the online Free Ride jam (2–4 freeRuns on one map, trick points, one clock)
  math.ts               deterministic sin, cos, tan, atan, atan2, pow, hypot (fdlibm's algorithms): every sim and generator uses them
  net.ts                online's wire: input bits, the host's pick (a byte), the hello (name, garage bike, look)
  online/
    rollback.ts         the rollback link (Dune Hop's): own input at once, predicted remote inputs, a snapshot ring, resim, hashes
    match.ts            the match every screen runs: hello → ride (race, jam, score run) → result → next ride, in one arena of bytes
    room.ts             the room card, the lobby's seats, the online standings (HTML)
    online.css          their sheet
```

Headless pieces (`bike/bike.ts`, everything in `data/` and `model/`, `modes/*/course|session|show|city.ts`)
never touch the DOM; the tests run them in Node. Scenes and the shell are the only DOM code.

## The mode interface

A mode is an entry in `MODES` (`src/modes/index.ts`):

```ts
interface Mode {
  id: ModeId; name: string; blurb: string;
  maps: { id: string; name: string }[];   // the first is the default
  start(ctx: ModeCtx): ModeRun;
}
```

The shell calls `start(ctx)` with:

- `host`: the element to mount in (inside the game's shadow root; `modeStage(host, cls)` in
  `race/scene.ts` builds the two layers every scene sheet expects).
- `bike`: the player's bike, already tuned (`Tuned`: `power`, `shape`, `rig`, `sweet`, `hop`, `model`, `cls`).
- `look`, `helmet`, `number`, `name`: the bike's and rider's colours and the plate.
- `seed` (deterministic per event), `map`, `auto` / `attract` (the autopilot; the landing hero),
  `reduced` (prefers-reduced-motion), `sound`.
- `end(stats)` when the event is over, `quit(stats)` when the rider leaves, `menu()` to open the
  shell's pause card (the ❚❚ key, P, Escape).

It returns a `ModeRun`: its `engine`, a `state` snapshot (`phase`: `grid | ready | run | done`,
`speed`, mode-specific fields), `auto`, `camera` (`dist`, `fov`, `view`), `finish()` (end now: `end`
follows), `stats()` (so far), `pause(on)`, `destroy()`.

A mode reports **RunStats** and nothing else: it never reads or writes the profile, the economy or
the page outside its host. The common part comes from `meter(mode)`: tick it once per fixed step
while the event's clock runs (`m.tick(bike, dt)`), then `m.stats({ ...mode fields })`. Mode fields:
`place`, `time`, `bestLap`, `led` (race); `judges`, `flips` (Big Air); `score`; `summary` (a line for
the result card); `where` (map id, for best scores); `finished` (it ran to its end).

The shell then does `settle(stats, bike)` → `{ credits, lines, wear }`, `apply(profile, result)`,
saves, and shows the result card over the (settled) scene.

## The bike and tune()

`bike/bike.ts` is a rigid body in its own vertical plane on two sprung wheels. Its engine is data
(`Power`: mass, pitch inertia, a torque curve over the revs, gears, launch, rev and throttle rates,
air pitch, grip, brakes, voice) and its chassis is `BikeShape` (axles, wheel radius, travel, sag,
`damp`, `caseDrop`, gravity). Same inputs, same ride: own polynomial sine and arctangent, no
allocation per step.

A garage bike (`BikeSave`) is a model id, parts `{ tyres, chain, motor, susp, brakes }` (condition
0..1), mod levels `{ power, brakes, weight, travel, cells }`, tune choices (`tyre` compound,
`gearing`, `spring`, `map`, and the ones bought in `setups`), crash damage `dmg { bars, plastics }`,
a failed part `fail`, a service `log` and a look (paint, plastics, graphics, plate decal, number). `tune(bike)` is pure and is the only bridge
between the garage and the physics:

| Input | Effect |
|---|---|
| tyres | `grip` × (floor 0.7 → 1); Wheelie City's balance window narrows |
| chain | drive force × (0.9 → 1) |
| motor (top end, engine or battery) | drive force × (0.72 → 1); a battery also sags the top speed |
| susp (seals) | `damp` × (0.55 → 1), `caseDrop` × (0.85 → 1); the hop |
| brakes | `brake` × (0.65 → 1) |
| motor, also | top speed × (0.94 → 1) (`TIRED.top`); a battery × (0.86 → 1), raised by cells |
| susp, also | travel × (0.78 → 1): cooked seals bottom out (`TIRED.travel`) |
| mod power (exhaust / controller, stages 1–3) | force +4.5 %/level, the curve +3.5 %/level toward the limiter |
| mod brakes (1–2) | brake +12 %/level |
| mod weight (1–2) | mass −4 %, pitch inertia −3 % per level |
| mod travel (long travel kit) | travel ×1.18, case line ×1.1, pitch inertia ×1.03, hop ×0.95 |
| mod cells (electric, 1–2) | the top speed's sag floor +4.5 %/level, mass +0.025/level; motor heat −15 %/level |
| gearing short / stock / tall | gears ×0.94 / 1 / 1.06, force ×1.08 / 1 / 0.93 |
| spring soft / stock / stiff | damping ×0.82 / 1 / 1.18, case line ×0.94 / 1 / 1.07, grip ×1.03 / 1 / 0.97 |
| motor map eco / std / race (electric) | force ×0.9 / 1 / 1.1 (race: gears ×1.03); battery wear ×0.7 / 1 / 1.6 |
| tyre compound soft / med / hard | grip ×1.08 / 1 / 0.92; tyre wear ×1.7 / 1 / 0.55 |
| damage: bent bars | air pitch × (1 − 0.1·bars), Wheelie City's window × (1 − 0.2·bars) |
| damage: cracked plastics | top speed × (1 − 0.02·plastics); the colours dull |

The floors (`WORN_FLOOR`, `TIRED` in `data/economy.ts`) keep a wrecked bike rideable. Every
number in the table is in `data/economy.ts` (`MOD_FX`, `SETUP_FX`, `TYRES`, `DAMAGE_FX`).

Upkeep (`model/upkeep.ts`): a part reads worn under `WARN` and may fail under `FAIL.at`; the garage
shows both, and RIDE asks before every event while one is at risk. The shell runs a finished ride
through `ride(settle(stats), bike, seed)` (the compound's and the map's wear, crash damage, a
failure rolled from the event's seed: half that event's payout, the part dead until replaced) and
`after(apply(profile, result), result)`. The pit crew helps at once after a failure you can't pay for. `tune()` also returns
the garage's `feel` bars. A new effect (a weight mod, a tyre compound, a battery cell count) is a
field in `BikeSave` (with a default in `normalize`), a line in `tune()`, a price in the economy, a
row in the garage UI and a test in `tests/tune.test.mjs`.

## The roster, the garage, the rider kit

`data/roster.ts` holds the models from nine maker ids (`MAKERS`, each with factory colours;
`makerOf(model)`), with their Power, suspension, price, `upkeep`
(wear and cost multipliers) and Wheelie City feel; e-bikes have a shorter `frame`. The cheapest of
each class is a starter. The showroom sells all 16: tiers 1–2 always, tiers 3–4 once `UNLOCK`
(events ridden or credits earned) says so; a new bike comes in its maker's factory paint. The garage holds `GARAGE_SLOTS` (3) bikes; each
keeps its own parts, mods and paint; `profile.ride` is the one that rides next.

Names come in three tiers (`data/names.ts`, [names.md](names.md)): the data holds the SAFE names,
`data/names/nod.ts` (the default build) and `data/names/real.ts` (only `?names=real` or
`?money=inf`, never saved) dress the same records by id, and `HOLESHOT_NAMES=safe` builds without
either table. Display names only: ids, saves and the net are the same in every tier.

The rider kit (`profile.kit`: helmet shape, helmet paint, visor, jersey, pants, pattern, boots,
gloves) and bike paint come from `data/looks.ts`; prices by tier are `COSMETIC` in
`data/economy.ts`; anything bought once is in `profile.owned` and free to switch back to.
`lookOf(profile)` turns it into the rig's colours; the rig draws the helmet shapes.

## The economy file

`src/data/economy.ts` is every number: `START_CREDITS`, `GARAGE_SLOTS`, `PART_PRICE` and
`MOTOR_PRICE` (× the model's `upkeep.cost`), `WEAR` (per 100 units ridden, per second of gas, per
second of wheelie, of air, per hard landing, per crash; the motor's per-class rate; all × the
model's `upkeep.wear`), `PAYOUT` (race places and bonuses, Big Air per judge point and flip, Wheelie
City per point with a cap, per escape and less per ticket, never under a floor, Free Ride per second, of air and wheelie and per trick landed, with a cap, the share paid on leaving), `MODS`,
`COSMETIC`, `PIT_CREW` and `WORN_FLOOR`. Balancing is a diff to this file; the tests read the same
numbers. Nobody is ever stuck: every finished event pays something, a worn bike still rides, and the
pit crew fixes the riding bike to `PIT_CREW.to` for free once `PIT_CREW.every` events have passed
and something is worn past `below` that the rider can't pay for.

## The profile and its schema

`model/profile.ts`: `Profile` is a plain object with `v` (the schema version, `VERSION`). Saved as
JSON under `holeshot:profile` in localStorage (every access in try/catch); when that key is empty,
`load` reads the key from before the rename (`OLD_STORE_KEYS`), so an old local save carries over. `migrate(raw)` runs each
step in `MIGRATIONS[from]` up to `VERSION`, then `normalize` fills missing fields with defaults and
clamps everything (a new field with a default needs no step; a rename or reshape bumps `VERSION`
and adds a step). A save from a newer version is never overwritten. `exportCode` /
`importCode`: `HS<version>-<base64url JSON>-<checksum>` (codes from before the rename, `DH1-`/`DH2-`,
still import).

## Scenes, the camera, input

Each scene is a Fizlet engine (fixed step, settle, the ledger) on a `diorama` canvas with a Board
UI HUD. The chase camera's framing is fixed for the event: set once from the stage's shape at the
start, no zoom with speed or air. Resizes are debounced and only a change of width refits the table
framing; a height-only change (a phone's URL bar) resizes the canvas and nothing else. The canvas,
the play surface and the pad are `touch-action: none` (no pinch or double-tap zoom). Keys: Space or
J gas, K or Shift brake, W/S or ↑/↓ the rider's weight, A/D or ←/→ steer, L trick (Big Air) or hop
(Wheelie City), V camera, M sound, P or Escape pause; the pad: a stick for weight and steering, GAS
and BRAKE (and TRICK or HOP) under the right thumb; a gamepad; hold-and-drag on the play surface.

## Add a map

- **A race track** is a `TrackPlan` (`modes/race/course.ts`): a closed loop of straights and turns
  (`plan`: a length, `-1` for a 90° left of radius `RAD`, or a `Turn` `{ turn, r, berm }` of any
  angle, + left or − right), an optional `start` (x, z, heading), features placed by section and
  offset (`features`: 1 double, 2 whoops, 3 triple, 4 tabletop, 5 step-up, 6 step-down, 7 finish
  jump; each gives the lap back past its own length, so doubles in a row are a rhythm section), the
  gate and the lap line, the table size and the dirt's seed.
  `makeTrack(plan)` builds the centre line, the profile, the terrain (`course()`), the edges and the
  rivals' target speeds. Add it to `TRACKS` in `modes/index.ts`. **The track generator**
  (`modes/race/generate.ts`) is `generateTrack(seed, difficulty)`: corners round an ellipse (a
  hairpin is a spike of two parallel legs to a tight U; a dent is a right between two lefts, an
  S), arcs filleted into the corners, the straights given the features with room to run in and
  roll out (the finish jump last before the line), the loop turned and centred on the smallest
  table that holds it. `validate()` = `checkShape()` (closes, no self-overlap within `GEN.sep`, on
  the table with a margin, features inside their straights) + `checkRide()` (the 2-stroke starter
  rides three laps clean on the autopilot against the other three starters, who each get two laps
  in). A draft that fails is thrown away and the next one tries; `tests/generate.test.mjs` checks
  500 seeds at each of three difficulties on its own terms (worker threads, about 2 minutes).
- **A free-ride map** is an entry in `FREE_MAPS` (`modes/index.ts`): map 1 is the race loop (a
  `TrackPlan`); maps 2–5 are open maps, a `RideMapDef` in `modes/freeride/maps.ts` that
  `makeMap(def)` turns into the map object `freeRun` and `mountTrack` ride:
  - `ground(t, HX, HZ)`: the terrain before the line (noise, benches, a lot);
  - `line`: a closed polygon of control points `[x, z, y, …]` with rounded corners (`radius`,
    `radii`), carved into the ground (`follow`: the floor follows the ground, smoothed; else the
    points' heights, a drop of more than 0.45 between close points kept as a ledge). It is the
    trail (`trail` paints it), the path the autopilot and the ghost ride, and where a crash puts
    you back;
  - `features`: `[kind, corner, offset into the straight after it, …]` (doubles, tables, kickers,
    the gap, the step-down, whoops, rollers, roots, logs, rocks; jumps go on straights: the tests
    check), `banks` round corners (berms, the wall ride), `posts` (trees: a crash), `spawns`;
  - the result has `course()` (pure), `near()`, `SPAWN`, `POSTS`, `WANT` (the line's speeds: turns
    by curvature, a speed into each feature, braking ahead) and the race Track's names for the line.
  `freeRun` starts on the first spawn; a crash by the line puts you back on it with a run-up to the
  feature, in the open where you fell, off the table on the nearest spawn. Its autopilot rides
  round a big jump it is too slow for. The look (`modes/freeride/scenery.ts`, `mapLook`) is the
  palette over the track scene's, the ground bands, the neon lines and the scenery builder that
  `mountTrack` calls instead of the race track's. Then: a look, a `FREE_MAPS` entry (it is in the
  picker), and `tests/maps.test.mjs` covers it (built the same, spawns on the ground, the ghost rides
  every class round it without falling through, allocation, the browser rides it).

## Add a mode

1. A headless sim (no DOM) that steps the player's `Bike` (built from `ctx.bike.power` and
   `ctx.bike.shape`) at the engine's fixed step, with an autopilot for the tests and the hero.
2. A scene: `modeStage(ctx.host, "<prefix>")`, `createEngine`, the diorama, the rig
   (`rig(dio, id, { ...kit, ...ctx.look }, ctx.bike.rig, ctx.helmet)`), the HUD with VIEW, mute and ❚❚
   (`ctx.menu()`), the fixed chase framing, a `meter`, and `ctx.end(m.stats({...}))` when it is over.
   Its stylesheet goes in `src/modes/<mode>/scene.css` and in the list in `scripts/build.mjs`.
3. An entry in `MODES`; its payout in `PAYOUT` and `payout()` (`model/economy.ts`); its `ModeId`.
4. Tests: the sim ends and pays on each starter class (`tests/modes.test.mjs`), allocation
   (`tests/alloc.test.mjs`), and the browser test starts and ends it on the player's bike.

## Wheelie City: the hoods, the humps, the patrol

`modes/wheelie/hoods.ts` holds four neighbourhoods on one footprint (98 × 28, local coordinates),
laid out 2 × 2 on the table (`CX`, `CZ`) with canals between: THE BLOCK (the gallery piece's
suburb), HILLCREST (cul-de-sacs, turning circles `rings`, terraces), DOWNTOWN (towers, the plaza)
and NEON MARINA (the boardwalk and the sand as `surf` kinds, the sea as water `terr`). A hood is a
short list of streets (`roads`, `rings`); its houses, driveways, sprinklers, trees and lamps are
placed by rule (`frontage`, `scatter`), dropped wherever they would sit on a street or another
building. Each hood has the autopilot's loop (`route`) and a street graph (`nodes`, `edges`; all-pairs
next hops in `GRAPH`). `HUMPS` pairs eight ramps across the canals (hump `i`'s partner is `i ^ 1`);
`ENTRY` says where the autopilot picks up the loop after landing, `BRANCH` where an escaping one turns
off for the hump.

`modes/wheelie/city.ts` is the ground over all four (each hood's own rects; the bank and the canal
off them; the hump ramps), the session (ninety seconds) and the flight: on a hump's deck at
`FLY_V` or more along it, the heading is squared to the hump and the speed set so the jump lands
`LAND_AT` past the far lip in `FLY_T`; in the air the bike is held level for the far ramp, so it
lands upright; the fence (the hood's edge) is skipped until it lands. Too slow, it bumps the fence.
`modes/wheelie/cops.ts`: the heat (0..100, five stars) from neighbours shouting, sprinklers, lawns
and banked tricks (`HEAT_FROM` in city.ts); it cools `COOL` a second after `COOL_AFTER` clean and
out of a unit's sight. Units by stars (`UNITS`: bike, cart, drone, bike) spawn on a junction away from
the rider, picked by a seeded roll, path on the graph to the rider's street, then straight at the
rider (a drone flies straight). Within `CATCH`: a ticket (the combo, `TICKET_SHARE` of the points
banked while the heat was on). Landing in another hood is an escape (`ESCAPE_PTS` × stars into the
score; the units peel off; the heat drops). All of it is plain numbers in typed arrays and a seeded
xorshift (`cops(seed)`, `cityRun(specs, seed)`), the bike's own polynomial trig (no builtin sine or
arctangent in the sim), stepped at the engine's fixed step; `cityRun().bytes` is the whole session as
byte views (the session, neighbours, sprinklers, dog, scorer, patrol, ride adapter, bike), so it can
join a rollback (tests/cops.test.mjs restores one mid-chase and rides on the same). Online, each
screen rides its own session (a score run). The stats carry `escapes` and `tickets`; `PAYOUT.wheelie` pays them.

## The Race Series

Tiers in `data/series.ts` (ROOKIE CUP 4 rounds, PRO CIRCUIT 5, NEON MASTERS 6): each round's track
is `generateTrack(roundSeed(run, round), difficulty(run, round))` (the difficulty climbs through the
tier's range round by round; the same championship always rides the same tracks), the rivals ride
models of the player's class at the tier's level with its mods and nerve (`RaceOpts.nerve` in
`motoRace`). The shell starts a round with `startRound` (the race scene on the generated track),
and on its end adds the series fields to the stats (`roundStats`: mode `series`, the order of all
four, on the last round the final place), then `settle` → `apply` as every event (the prize lines
come from `seriesLines`, called by `payout`), then `recordRound` (points `POINTS`, the round count;
at the end the best place, a title, `last`). Leaving a round scores nothing and pays nothing (the
wear counts). A tier opens when the one before it ends in the top two. Saved as `profile.series`
(schema v2; v1 saves migrate: an empty record, three race wins open the Pro Circuit).

## Online

Two to four screens in one fizlet-rooms room (@fzlt/core/presence `join`: the room card's HOST /
JOIN, the lobby, START NOW; the server relays 12-byte messages only). The sims are deterministic and
only inputs travel, 32 bits a seat a frame (`net.ts`). `online/rollback.ts` runs each frame at once
with this screen's own input (1–3 frames of delay, picked from the measured latency) and a guess for
everyone else's (their last); a real input that differs takes the state back to that frame (a
preallocated ring of snapshots) and runs the frames again. Sound, stickers and FX play only the
first time a frame runs; remote riders are drawn easing from where they were to where they are
after a correction; every 30 final frames each screen's state hash is compared (a desync shows, it
never drifts). A seat that leaves is ridden by the autopilot from the frame after its last input,
the same on every screen.

**The same bits on every engine.** An iPhone (WebKit) and desktop Chrome (V8) in one room run one
sim, and the builtins (`Math.sin`, `Math.pow`, …) may differ between engines in the last bit (V8's
`Math.pow` is the platform libm's). So nothing that builds a track or a map, steps a sim or lands in
the snapshot calls a builtin transcendental: they use `src/math.ts` (fdlibm 5.3's sin, cos, tan,
atan, atan2 and pow, V8's two-argument hypot: + − × ÷, square roots and bit reads only; sin, cos,
tan, atan, atan2 and hypot match V8's builtins bit for bit) and the bike's own polynomials. Drawing,
FX, cameras, sound and cards may use the builtins. `tests/math.test.mjs` scans `src/` for builtin
transcendentals outside an allow-list of render files; `tests/golden.test.mjs` hashes 24 generated
tracks, the race loop, the four open maps and fixed rides (races, an online race of four, jams,
Big Air, Wheelie City) against `tests/golden.json`; `tests/golden.browser.mjs` runs the same cases
in a browser (`--serve`: open it on an iPhone; the page says MATCH).

`online/match.ts` is what those frames run, one link for as long as the room lasts. The first 11
frames carry every seat's **hello** (33 bytes: the name, the riding bike's model, parts, mods, tune
choices, damage and look, and the rider's kit): every screen, this one too, tunes the bikes from the
hello's bytes, so each rides their own garage bike and every screen simulates the same numbers. On
frame 11 (once every hello is final) the ride is built from the host's pick, the room's seed and the
bikes: a race (`motoRace` with `humans`, each person's own bike; a track generated at the tier's
difficulty; AI rivals in the empty places), a jam (`freeJam`) or a score run (each screen rides its
own Big Air or Wheelie City minute; the input bits carry the score). The rollback saves one arena of
bytes: a header (phase, round) and the ride's state (the sim's byte views: every bike is one buffer,
`bike.state` / `save` / `load`; each person's ride meter), copied in and out around each frame. A
ride is built only on a final frame, so no correction reaches back past it. When the ride is over
(the same final frame everywhere) each screen settles its own rider: `settleOnline` (the solo payout
× ONLINE.bonus, ONLINE.beat per person beaten, the hourly cap in `data/economy.ts`) and the wear, on
its own profile. RIDE AGAIN sets READY; the next ride is built on the final frame where every seat is
ready (a seat that left always is).

## Tests

`npm test` (headless: bike, tune, profile, every mode on every starter, the economy, allocation in a
process of its own, the generator over 1,500 seeds, the series; online: the wire and the hello, the
bike's snapshot, the determinism guard and the golden hashes, sync and rollback for two and four screens in a race and a jam with a leaver, the
online bonus and its cap), `npm run test:settle`, `npm run test:browser` (1440 and 390; the series in
`tests/series.browser.mjs`; online with four pages against `tests/room-server.mjs` in
`tests/online.browser.mjs`), `npm run test:net` (phone links, measured), `npm run
site:build && npm run test:site`. CHROMIUM_PATH points them at a Chromium of your own.
