# Dirt Hop: architecture

One rider, one garage, many ways to ride. This page is the map for anyone adding to the game: where
each piece lives, the contract between the shell and a mode, how a garage bike turns into what the
physics rides, where the economy's numbers live, and how to add a map or a mode.

## Modules

```
src/
  index.ts              the public entry: createDirtHop, MODES, the roster
  game.ts               the shell: profile, menus, garage UI, pause and result cards, event lifecycle
  game.css              the shell's Board UI styles (each mode scene has its own sheet)
  html.ts               the cards' small HTML helpers (numbers, escaping, a condition bar)
  garage/
    view.ts             the garage card (parts & mods, paint & kit with try-on, showroom) and its clicks; "before you ride"
    look.ts             lookOf(profile): the rig's colours (paint, plastics, graphics, plate decal, number, damage)
    garage.css          the garage's sheet
  bike/
    bike.ts             the bike sim: a pure, fixed-step, deterministic dirt bike on a heightfield
    rig.ts              the bike and rider drawn with @fzlt/core/diorama (helmet shapes, colours)
    kit.ts              particle pools, the engine's voice, the gamepad read
  data/
    roster.ts           4 classes × 4 models from 6 makers: names, blurbs, Power curves, suspension, prices, upkeep
    economy.ts          every number of the economy: start credits, payouts, wear rates, prices, the pit crew
    looks.ts            paint schemes, the rider kit (helmets, visors, colours, patterns)
  model/
    profile.ts          the save: schema, normalize, migrate, load/save (localStorage), export/import code
    tune.ts             tune(bike) → what the sim rides (power, shape) and the garage's feel bars
    garage.ts           garage actions: service (tyre compounds), upgrade, tune choices, repair, try on / dress, buy, sell, trade in
    upkeep.ts           part states and warnings, the seeded failure roll, a ride's extra wear and damage, the service log
    economy.ts          settle(stats) → credits + wear; apply(profile, result); the pit crew
  modes/
    mode.ts             the Mode interface, ModeCtx, ModeRun, RunStats
    meter.ts            the ride meter every mode ticks (seconds, distance, gas, air, wheelie, crashes, hard landings)
    index.ts            MODES (the RIDE menu), TRACKS (race tracks), FREE_MAPS (free-ride maps)
    race/course.ts      TrackPlan → makeTrack(): centre line, profile, terrain, rival speeds; motoRace()
    race/scene.ts       the track scene, shared by Race and Free Ride (mountTrack)
    freeride/session.ts freeRun(): one rider on a track's table, no laps
    bigair/show.ts      airShow(): the arena and the run; bigair/tricks.ts the air-trick scorer
    bigair/scene.ts     the arena scene (mountAir)
    wheelie/city.ts     the block and the session; wheelie/ride.ts the ride adapter; wheelie/tricks.ts the scorer
    wheelie/scene.ts    the town scene (mountCity)
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

`data/roster.ts` holds 16 models in 4 classes from six original makers (`MAKERS`, each with factory
colours: YAMADA and KAWAZAKURA 2-strokes, HONDO and KAWAZAKURA 4-strokes, MAKFOX e-bikes, SURGE-ON
and STARKWOLF electric dirt bikes; `makerOf(model)`), with their Power, suspension, price, `upkeep`
(wear and cost multipliers) and Wheelie City feel; e-bikes have a shorter `frame`. The cheapest of
each class is a starter. The showroom sells all 16: tiers 1–2 always, tiers 3–4 once `UNLOCK`
(events ridden or credits earned) says so; a new bike comes in its maker's factory paint. The garage holds `GARAGE_SLOTS` (3) bikes; each
keeps its own parts, mods and paint; `profile.ride` is the one that rides next.

The rider kit (`profile.kit`: helmet shape, helmet paint, visor, jersey, pants, pattern, boots,
gloves) and bike paint come from `data/looks.ts`; prices by tier are `COSMETIC` in
`data/economy.ts`; anything bought once is in `profile.owned` and free to switch back to.
`lookOf(profile)` turns it into the rig's colours; the rig draws the helmet shapes.

## The economy file

`src/data/economy.ts` is every number: `START_CREDITS`, `GARAGE_SLOTS`, `PART_PRICE` and
`MOTOR_PRICE` (× the model's `upkeep.cost`), `WEAR` (per 100 units ridden, per second of gas, per
second of wheelie, of air, per hard landing, per crash; the motor's per-class rate; all × the
model's `upkeep.wear`), `PAYOUT` (race places and bonuses, Big Air per judge point and flip, Wheelie
City per point with a cap, Free Ride per second with a cap, the share paid on leaving), `MODS`,
`COSMETIC`, `PIT_CREW` and `WORN_FLOOR`. Balancing is a diff to this file; the tests read the same
numbers. Nobody is ever stuck: every finished event pays something, a worn bike still rides, and the
pit crew fixes the riding bike to `PIT_CREW.to` for free once `PIT_CREW.every` events have passed
and something is worn past `below` that the rider can't pay for.

## The profile and its schema

`model/profile.ts`: `Profile` is a plain object with `v` (the schema version, `VERSION`). Saved as
JSON under `dirt-hop:profile` in localStorage (every access in try/catch). `migrate(raw)` runs each
step in `MIGRATIONS[from]` up to `VERSION`, then `normalize` fills missing fields with defaults and
clamps everything (a new field with a default needs no step; a rename or reshape bumps `VERSION`
and adds a step). A save from a newer version is never overwritten. `exportCode` /
`importCode`: `DH<version>-<base64url JSON>-<checksum>`.

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

- **A race track** is a `TrackPlan` (`modes/race/course.ts`): a closed loop of straights and 90°
  left turns (`plan`), features placed by section and offset (`features`: 1 double, 2 whoops,
  3 triple, 4 tabletop), the gate and the lap line, the table size and the dirt's seed.
  `makeTrack(plan)` builds the centre line, the profile, the terrain (`course()`), the edges and the
  rivals' target speeds. Add it to `TRACKS` in `modes/index.ts`. A **track generator** is a seeded
  function returning a `TrackPlan`; validate it before racing: the loop closes (`makeTrack(p).TRACK`
  first and last points meet), every feature sits on a straight and inside the table, and the
  autopilot finishes three laps without a crash (the same check `tests/modes.test.mjs` runs).
- **A free-ride map** is an entry in `FREE_MAPS`: today a `TrackPlan` (the loop is there to follow;
  respawns go to the nearest point on it). A map with no loop needs its own terrain builder and a
  respawn rule: give `freeRun` (`modes/freeride/session.ts`) a map object with `course()`, `near()`
  and spawn points instead of a `Track`, and its scenery builder to `mountTrack`.

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

## Tests

`npm test` (headless: bike, tune, profile, every mode on every starter, the economy, allocation in a
process of its own), `npm run test:settle`, `npm run test:browser` (1440 and 390), `npm run
site:build && npm run test:site`. CHROMIUM_PATH points them at a Chromium of your own.
