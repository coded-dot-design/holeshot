# Changelog

## Unreleased

- **No tan speck beside the bike (Endless Wheelie City) and no stray cactus arms, crowns, pylon tips
  or camps (the endless grounds).** The same cause as the miniature buildings, in two more places:
  diorama's `hidden` hides only the object itself, never its parts. In the city the dog, hidden
  with `hidden` alone while no yard was near, drew its body, legs, head and tail 50 units under the
  start: a few tan pixels beside the bike out in the fields that never grew. On the endless grounds
  (Dune Sea, Deep Quarry, Endless Woods, Night Park) the scenery pool let go of cacti, trees,
  pylons and camps the same way, leaving their arms, crowns, neon tips, tents, beacon poles and
  lamps where they stood and under the start. Both now go to alpha 0 (the whole of it) and back to
  the hide spot. Render only. Test `tests/artifacts.browser.mjs` now also checks that every drawn
  part is owned (`probe.orphans`: its whole chain shown, its top a thing the ride has live: the
  bike, a placed pool object, the dog at its yard, a neighbour out, a sprinkler on, a patrol unit),
  in the city's owner's view and its 20 km ride, and on a 4 km seeded autopilot ride in each endless
  ground (before: the dog's 10 parts every frame; 1,490 to 4,106 stray parts per ground).
- **Miles by default, km as a setting.** SETTINGS → UNITS: Imperial (miles, mph; the default) or
  Metric (km, km/h), saved in the profile (schema v6: every existing save migrates to Imperial).
  Applied wherever a distance shows: the Endless Wheelie City and endless-ground HUD chips (e.g.
  "1.70 MI"), the BEST lines, the endless picker's bests, the ride summaries and the payout's
  distance line. Display only: physics, payouts and saved distances stay in world units
  (1 km = 0.621371 mi, `src/model/units.ts`). Under `?money=inf` the switch is not saved, as every
  setting there. Tests: `tests/units.test.mjs` (conversions, default, migration, payout label),
  `tests/units.browser.mjs` (1440 and 390: MI by default, METRIC shows KM and persists across a
  reload, not saved under test credits).
- **No more stray miniature buildings in Endless Wheelie City.** Out in the fields a tiny gas
  station (a canopy, pumps, a sign; roofs and windows too) floated near the start and never grew as
  the bike rode at it. The scenery pool hid an object it had not placed with diorama's `hidden`,
  which hides only the object itself, never its parts: every pool object never placed drew its
  parts in a heap 50 units under the start (seen from above as a miniature), and a tower or silo let
  go half in the haze left its parts standing. A pool object let go now goes to alpha 0 (the whole
  of it) and back to its hide spot, and a slot that takes another item starts unghosted; a building
  the bike is up against is never faded out completely by the occlusion ghost (at most ghosted and
  outlined), so the bike is never stuck on nothing. Render only; riding unchanged. Test
  `tests/artifacts.browser.mjs`: a 20 km seeded autopilot ride (65+ towns, 21 hops into the fields
  at new headings, 1440 dark and 390 light, on `?money=inf`) audits every frame: no strays (before:
  256 at the start, about 14,000 on screen over 3 km), no outline without its building, every
  placed object at its world record, every solid within 12 units drawn, drawn building heights =
  world heights, the frame's pixels the same with every unplaced object forced out.
- **Test credits: `/play/?credits=inf` (or `?money=inf`).** For trying every bike: the garage shows
  ◈ ∞ and a TEST CREDITS ∞ chip, the showroom sells every bike (unlocks open), every part, mod, tune
  and cosmetic is free (buying never subtracts). The session plays a copy of the saved profile in
  memory and saves nothing, so taking the param off loads the real profile exactly as it was (the
  export code stays the real one). ONLINE is off while it is on, so a free-bought bike never rides
  against other people. No effect without the param; rides unchanged (`src/model/testcredits.ts`;
  tests: `tests/testcredits.test.mjs`, `tests/testcredits.browser.mjs`).
- **Clean road edges in Endless Wheelie City.** The asphalt, the gravel shoulder, the sidewalk and
  the roundabouts' rings and islands were coloured onto the ground's triangles, so their edges
  zigzagged along the grid (worst far off, where the ground is drawn coarser). They are ribbons now
  (`src/modes/wheelie/ribbons.ts`): strips along each road's true curve at its true width (the
  world's own road polyline, mitred at the joints; the rings as circles), every corner on the ground
  the bike rides, shaded by slope with the terrain's rule, clipped at the near plane, painted under
  the lane paint; the ground under them is drawn as what lies round them (grass, or lawn in town), so
  no stair-step shows past an edge, near or far. Riding is unchanged (heights and face kinds are the
  same; render only). Zero allocation per frame (a new alloc test). Measured on the edge test
  (`tests/roads.browser.mjs`, a straight and the most curved open road, 1440 and 390, near and far):
  drawn edges within 0.51 px of the true edge (were off by up to 57 px). Frame time under 4×
  throttle unchanged within noise (1440: 90–91 frames in 8 s vs 83–93 before; 390: 255–268 vs
  257–264); the bundle +3,291 B gzip (budget 184,000).
- **Endless Wheelie City is an open world.** The row of hood slots is gone: the city is now roads,
  towns and fields that never end, in every direction, on the desert's streaming approach (a window
  of the ground round the rider sliding in whole steps, a coarse far ring to the horizon, the haze).
  Everything is a pure function of the seed and the place (`src/modes/wheelie/open.ts`), so the same
  spot is the same world on every screen. **Roads:** one jittered junction per 120-unit lattice cell,
  each joined to the next east and west (every third row a highway, wider, a double centre line) and
  north or south on most columns (always on every fourth), each join a smooth cubic whose tangent runs
  through the junctions either side, so roads sweep through junctions instead of turning corners;
  some junctions are roundabouts; every junction has at least two roads (no dead ends). Roads lie
  level across and smoothed along on gently rolling fields, blended in over a 6-unit shoulder, with a
  kicker now and then on the crown of an open road; lane paint (edge lines, dashes, crosswalk zebras,
  the rings) is painted on the ground. **Towns:** about two junctions in five (always the start):
  lots along every road out of the junction, set back and facing the street (shops, a diner, a gas
  station, flats and a tower near the middle; houses with mailboxes, sprinklers and one dog's yard
  further out; warehouses on the edge), lamps, benches, parked cars, crosswalks, a sign on the way
  in ("ENTERING …": fictional names from bike words). **Fields:** grass, ploughed dirt and crops in
  skewed plots, tree rows and fences along the roads, trees, pines, rocks, hay bales, farmsteads.
  The scene draws the ground with `terrainView` (each triangle takes the kind most of its corners
  have) and a fixed pool of buildings and props placed from the same gather the sim uses.
- **Every city mechanic rides along** (`src/modes/wheelie/roam.ts`): wheelies, manuals, hops,
  stoppies, the hand drag (×10), the combo and its bonuses, neighbours, sprinklers, the dog, the
  heat, walk-the-bike, unstuck, occlusion, the chase camera. **The patrol is bound to each town:** it
  spawns only inside a town's limits (46 units from its junction, plus 3), paths on that town's
  streets (`townGraph`) and stops at the limits; ride out of town with them on you and you lose them
  (LOST THEM!, the points, the combo up). A ticket still only when caught stopped or down. The
  distance is how far out from the start (the furthest so far); `stats.far.city` keeps the best (its
  shape is unchanged: no profile step). The VIEW key's second view is a high map view over the bike.
- **The fixed table stays headless only** (`cityRun`, its tests and goldens unchanged); the shared
  rules moved to `src/modes/wheelie/rules.ts` and the patrol no longer imports the hoods, so the game's
  bundle carries only the open world. The slot row (`slotKind`, `PITCH`, the endless `town`, the
  scene's hood moves) is deleted.
- **Goldens:** only "endless wheelie city ride" changes (a new world and session: two minutes on the
  autopilot through the open world); every fixed-table and other hash is unchanged.
- Size: 176,994 B gzip (holeshot.js; round 4 measured 174,039 on its own, the last committed build 174,076): +2.9 KB
  for the open world and its scene, with the fixed table's hoods and session out of the bundle; the
  178,000 B budget holds (no change).
- Perf (the round-2 harness, autopilot, 4× CPU throttle, 8 s): 1440 frame p50 116.6 ms (the slot row
  116.7), faces p50 456 (3,490); 390 frame p50 33.4 ms (50.1), faces p50 294 (3,680). A window slide
  (8 units of new ground, heights and kinds) costs about 4 ms unthrottled; zero allocation per step.
- Tests: `tests/endless.test.mjs` (chunks pure and cache-independent; roads continuous, smooth along,
  level across, no dead ends, never far; towns along and facing their roads; a 20 km ride along the
  roads in random directions never leaves the streamed window, passes towns, allocates nothing; the
  same inputs, the same bytes), `tests/cops.test.mjs` (units never past the town limits, none out of
  town, leaving town ends the chase), the hand drag, unstuck and alloc tests on the open world, and
  the browser tests (`wheelie`, `occlusion`, `ground`) rewritten for it.

- **Wheelie City's ground no longer drops out.** At some headings the lawn, sidewalks and roads around
  the bike vanished and the canal showed through (the owner, light mode). The diorama skips a face with
  any corner behind the camera's near plane, and the island's lawn (98 × 28), its top and the long
  roads and sidewalks were one face each, so with the chase camera over one the whole piece went.
  Under every ground piece longer than 4 units the same top now lies in tiles of at most 4 (top faces
  only, a hair lower in the sort): hidden under the piece while it draws (no seams), there when it is
  skipped. Render only, built once with the scene (nothing per frame); about 1.5 to 2.1× the faces in
  a frame (at most 6,252 measured, budget 16,384, none dropped). Test: `tests/ground.browser.mjs`
  (2 hoods × 4 spots incl. the canal bank × 16 headings, 1440 and 390: no water or sky on the island
  around and ahead of the bike; before the fix, 100+ cases failed); a `probe.spot` for it.

- **The far leg goes behind the bike.** The rider's legs and arms drew over the whole bike (one layer
  above every bike part), so at many camera angles the far leg and arm showed over the frame, tank and
  seat, as if both legs were on the near side (a scooter look; plain when walking it). Each side's leg
  and arm now hang from a side group at the hip's offset across the bike, which drops under every bike
  part while it is on the far side (the diorama's `behind`, judged from the eye each draw): every yaw
  and view (chase, garage turntable), every pose (seated, standing, wheelie, hand drag, walking,
  crashed). Render only, no allocation per frame; physics and golden hashes unchanged. Test:
  `tests/legs.browser.mjs` (16 yaws × 2 pitches × 6 poses: the far limbs 0 % drawn over the bike where
  they overlap it, the near ones ≥ 83 % over it; before the fix, up to 100 %).

- **Walk the bike.** Stopped (under 1.5 m/s), no gas, no brake, the weight held (W/S, ↑/↓, the pad's
  stick) for 0.15 s: the rider puts a foot down and pushes the bike at 1.25 m/s that way, backwards
  too, the steer turning the push; let go and the feet stop it, the gas rides on at once. Slower up a
  slope, none past 0.42 rad; never through a post, a wall or off the table (each mode's own check). In
  Free Ride, Endless, the jam, Endless Wheelie City, Race and Big Air (people only). Its numbers live
  in the bike's state (a spare slot and the spare byte: the state size is unchanged), so it is
  deterministic online and after a rollback; every golden hash is unchanged (no golden case walks).
  The rig walks astride it, boots on the ground; a WALK chip; a one-time phone hint. Tests:
  `tests/walk.test.mjs`, `tests/walk.browser.mjs`, an alloc case.

- **Credit: Holeshot is by David Cooley (game creator).** The landing (its eyebrow, the "by" panel
  with one creator line, the meta description), the /play/ header (V0.x · BY DAVID COOLEY), the
  footer, README, package.json's author and description; his name links to
  https://fizlet.com/people/david-cooley/. "Built on Fizlet" stays. The LICENSE's copyright line and
  the bundle's MIT banner are unchanged (a licence matter, not a credit), as is `site/game.json`
  (generated from the factory's spec).
- **One Wheelie City: Endless.** The fixed ninety-second Wheelie City (its tile, its landing entry,
  its online head-to-head) is gone; Endless Wheelie City stays, on the same four hoods. The RIDE menu
  and the landing derive from the mode list (five ways to ride). Online's score run is Big Air (the
  endless city has no clock to race to). Profile v5: the fixed city's best score
  (`best["wheelie:city"]`) carries into Endless Wheelie City's (`"endcity:city"`) when higher; the
  old key loads and is kept as it was. The scene's fixed-table drawing (the plinth, the table
  framing, the session clock on the HUD) is gone; the sim's fixed table stays (it is where each hood
  is built before it moves to its slot, and the headless patrol and unstuck tests ride it). Golden:
  the four fixed-session hashes go, one "endless wheelie city ride" comes; every other hash is as it
  was.
- **Smooth crests (ENDLESS grounds), on Fizlet 0.26.0.** `@fzlt/core` ^0.25.0 → ^0.26.0; the
  endless grounds' `terrainView` draws with `split: "adaptive"` (each cell along the diagonal whose
  ends are closer in height; a tie keeps the fixed one), and the window's own `height` / `normal` /
  `sample` (`src/modes/desert/world.ts` `face()`) use the same rule, so the bike rides exactly the
  drawn face: a dune's crest is one straight fold, not stair-steps. Test
  (`tests/desert.test.mjs`): on every ground (45–61 % of the window's cells flipped), the
  bike's height equals the brick's adaptive terrain at six points a cell and the normals match.
  No golden hash changed (no golden case rides the endless window; the race, maps, jams, Big Air
  and the city keep the fixed split).
- Size: 174,328 B gzip (holeshot.js, +4,140 B), budget 174,000 → 178,000 B (scripts/size.mjs has
  the reasons).
- **The throttle rocker (every mode, touch).** Gas and brake leave the round keys for one tall pill
  under the right thumb (`src/bike/rocker.ts`, at least 72 × 150 px, safe-area aware): the top is
  GAS, the bottom BRAKE, the middle SEAM both at once (gas and brake together is the wheelie, and the
  feather that holds it); the thumb slides between them without lifting, the zone lights at once,
  a short buzz on a change where there is one (never with reduced motion), and a second finger on
  the pill adds the brake. Icons only (flame, brake disc, the seam's curve; Big Air's TRICK a star,
  Wheelie City's HOP an arrow), every one with its words in an aria-label. A first-time hint ("slide
  to the middle to wheelie") until the seam is used. Desktop keys unchanged. Test:
  `tests/rocker.browser.mjs` (390 portrait, 844 landscape: one finger gas → seam → brake → gas never
  lifted, two fingers, icons and labels, the size, the hint; the hand drag reached and held with the
  rocker alone; Race and Big Air ride on it). Endless Wheelie City's start toast no longer says
  "ninety seconds".
- **The hand drag (Endless Wheelie City).** The city's bikes now go back past 12 o'clock (vertical)
  to about 1 (`LOOP_AT`: 30° past; `BikeShape.loop`, the shared bike's new option, default as
  before so every other mode is bit for bit the same); past the balance point the rear brake has more
  say (`PAST_BRAKE`), so feathered it holds the nose up there, but it drifts over if you let it. Hold
  it past 12 for 1.5 s (`HAND_T`) and the rider drops the left hand to the road: HAND DRAG! (sparks
  off the glove, a star burst, a cheer, a ×10 chip with the points AT RISK pulsing; a charge ring
  while you hold). It earns 40 a second ×10 (× the combo); back under 12 it BANKS (plus a streak
  bonus, 120 × seconds², the combo one up); loop out and the drag's points are LOST. The rig gets a
  ninth trick-pose channel (the hand down to the road). Tests: `tests/handdrag.test.mjs` (past 12
  reachable and the loop-out at the limit, the drag after 1.5 s held, ×10, banked on the way down,
  lost on a loop-out, determinism, no allocation).
- **The neon patrol's new rules (Endless Wheelie City).** A TICKET only when a unit catches you
  stopped (under 1 m/s for 1 s) or down after a crash, in range; ride on and you never get one,
  however close they are. Running heats it up: while a unit is on your tail (within 9 units) the heat
  climbs 3.2 a second, so more join: a patrol bike, a cart, then neon DRONE cops (a neon ring and
  eye), up to six units at five stars; from three stars the drones put a searchlight on you. Every
  unit is bound to its hood's slot: it never leaves the hood's rectangle, so the chase ends at the
  canal; a hump into the next hood is LOST THEM! (+150 a star, the combo kept and one up), and the
  next hood's own patrol takes 3 s to come out. END now stops the run (the bike rolls to a stop, the
  patrol peels off, the result settles: it kept riding before). Tests (`tests/cops.test.mjs`): no
  ticket at speed with a unit alongside, a ticket stopped (after 1 s) or down, heat and units rising
  with the chase to the cap (bike, cart, drone order), no chasing unit ever past its hood's edge over
  150 s of endless riding, the chase over at every canal, determinism. The headless alloc and unstuck
  tests ride the endless city now.
- **See-through buildings (Endless Wheelie City).** The chase camera's occlusion pattern: each step
  the segments from the eye to five points on the rider's silhouette are tested against the
  buildings' boxes in the two hoods drawn (a box-vs-box reject first); a building in the way fades
  to a ghost (alpha 0.16 with a thin outline over the frame) in 0.15 s and back when clear; one the
  eye is inside or all but touching fades out completely. Reduced motion: at once. Render only (the
  run never reads it), no allocation per step. Test: `tests/occlusion.browser.mjs` reproduces the
  owner's case (a downtown tower filling the screen in front of the camera, the bike hidden behind
  it): drawn solid the tower covers 99 % of the bike's pixels; ghosted ≥ 80 % of them read as the
  bike (measured 100 %), at 1440 and 390, and solid again when clear.

- **Endless Wheelie City, a new mode.** The four hoods as reused SLOTS in a row along +x, canal to
  canal: slot k sits at k × 106 units and its hood kind is `slotKind(k)` (pure, seeded: k + 2·bit, so
  two neighbours are never the same kind and one built hood a kind is enough: only the slot you are
  over and the one you near are drawn). Every slot has a hump at both ends of its south street, lined
  up with the next slot's: the road runs to the hump on both sides of every join and the hump flies
  the canal (the fixed city's flight, landing on the far ramp, the patrol lost). The neon patrol,
  neighbours, sprinklers, crosswalks and the dog move with their hood. No clock: the HUD counts
  kilometres, END banks it (Free Ride's pay with its per-km line), and the best is kept as
  `stats.far.city`. A haze over the far ground and a distance fade on what stands up. The fixed
  Wheelie City runs on the same code (`town(false)`: its four hoods at their table places) and every
  golden hash is unchanged. Tests: `tests/endless.test.mjs` (the slots, seamless joins over 120 slots,
  10 km on the autopilot: one hump a slot, no rescue, never off the row, determinism).
- **ENDLESS** (the old ENDLESS DESERT tile): a picker card with the Dune Sea (default) and an endless
  version of each other open Free Ride map, on the desert's streaming window and far ring: THE DEEP
  QUARRY (terraced benches and faces), THE ENDLESS WOODS (wooded hills, log jumps, roots, trees you
  can hit) and THE NIGHT PARK (flat, doubles and rollers, pylons, light towers), in their maps' colours,
  each its own seed and its own best (`stats.far.quarry`, `.forest`, `.night-park`). One tile with a
  picker rather than four: on a phone four near-identical tiles would push the rest of the menu down.
  The Neon Loop has no endless version (it is a race loop, not a ground). The desert's ground is
  bit-for-bit as it was.
- Profile v4: the endless bests (v3 → v4 seeds them at 0; the desert's carries over).
- Size: 170,188 B gzip (+4,124 B), budget 168,000 → 174,000 B (scripts/size.mjs has the reasons).
- The town's ground now boxes fewer doubles a step (hypot's arithmetic inline in `roadGap`, the hump
  height through the scratch array): the same bits, about half the young-generation GCs.

- **Endless Desert to the horizon.** A far ring: the same `heightAt` on a coarse window (4-unit
  cells, 544 units a side, view only, sliding 16 units at a time) drawn as five bands of ridgelines
  from 34 to 250 units, each hazier than the last (the lit sand into the sky's horizon colour) with a
  lighter crest line, and each only above the near sand's silhouette (sampled down the same screen
  column), so a near dune always stands in front. The near haze now runs 20 to 35 units and fades into
  the first band. Light-mode grid a darker coral (#c8431f) at 0.62 (was #ff7a59 at 0.4). The palette,
  dunes, handling, LOD and camera are round 1's. Measured in headless Chromium (autopilot, 8 s from
  4 s in, dpr 1, 4× CPU throttle): frame p50 at 390 33.4 → 33.4 ms, at 1440 100 → 117 ms; faces a
  frame p50 at 1440 2,848 → 2,873 (the far ring adds 5 polygons and 5 crest lines a frame, not
  faces). A finer LOD to smooth the crests ([14, 30]: stride 4 only inside the haze) was measured
  and left out: +8 % faces and 390 throttled p50 33 → 50 ms.
- Size: 166,064 B gzip (+2,427 B: the far ring and its painter, unstuck in three more modes), under the 168,000 B budget.
- **Unstuck in Race, Big Air and Wheelie City** (the same watch and timings as Free Ride: the prompt
  at 2 s, an automatic reset at 4 s, R / ↺ / a gamepad's Back). Race: back on the line behind where
  you were, the progress taken back, held 1.2 s; it never gains a place (tested). Big Air: the run-in
  of the current jump. Wheelie City: the last good spot on the street. Tests: `tests/unstuck.test.mjs`.
- The golden file: the online race of four (its people's watch is in the race's bytes) and the four
  Wheelie City sessions (the ring is in the session's bytes) change; every other hash is unchanged.
- **Endless Desert, a new mode.** A dune sea that never ends: big ridged dunes across the wind, a
  second smaller set, ripples, witches'-hat peaks and bowls on a 72-unit lattice, and sparse
  features on a 40-unit lattice (half the cells are open sand; the rest a kicker, a whoop section, a
  cactus clump, a rock pile or a camp with a beacon). The ground is `heightAt(seed, x, z)`, pure and
  deterministic (integer hashes, + − × ÷, floors and square roots; no builtin transcendentals); the
  bike rides a 160 × 160 cell window (80 × 80 units) that slides 8 units at a time, copying what it
  keeps and computing only the new strip, so where the window is never changes a height. A neon grid
  over the sand (world-fixed, so it slides under you) and a haze from 16 to 33 units ahead fades the
  far sand into the sky's horizon colour: no edge. Scenery comes from a fixed pool placed on the 3 × 3
  lattice cells round you. Measured headless (`tests/desert.test.mjs`): 10 km on the autopilot, the
  rider never closer than 24 units to the window's edge, zero young-generation GCs over 3,000 steps;
  in Chromium (headless, the autopilot, 8 s to 100 s in) the terrain drew 2,513–3,205 faces a frame at
  1440 and 1,247–2,142 at 390. Free Ride is
  unchanged.
- **Best distance** in the profile: `stats.far` (by mode), profile version 3 (a v2 save gets
  `far.desert = 0`, everything else carries over). The HUD shows km and your best; the result pays
  20 a km within Free Ride's cap.
- **Unstuck** (Free Ride, Endless Desert, the Free Ride jam): a ring of the last ten good places, a
  stuck prompt after two seconds without half a unit of progress with the controls held, an automatic
  reset after four, and a manual reset (R, the ↺ key on the HUD, a gamepad's Back/Select; online the
  input bit `B_RESET`). The reset never lands within two units of the trap, needs gentle ground and
  six units of clear run-up, nudges a unit or two sideways if the place itself is blocked, and blinks
  the bike for 1.2 s (no tree or cactus hits meanwhile). Tests: a wedged bike gets the prompt and then
  the reset, lands upright behind the trap and rides more than 2 units in a second; R resets.
- The golden file: the two Free Ride jam hashes change (a jam's bytes now carry each rider's
  distance and unstuck ring); every other hash is unchanged.
- Size budget 168,000 B gzip (163,637 B measured, +7,794 B: the desert's ground, window, grid, haze
  and scenery, the unstuck ring and reset, best distance and the profile's v3 step).

## 0.3.0

- **Wheelie City: four neighbourhoods and the neon patrol.** THE BLOCK (the suburb strip),
  HILLCREST (cul-de-sacs with turning circles, houses perched on retaining walls under a ridge),
  DOWNTOWN (a grid of neon towers round a plaza with a fountain) and NEON MARINA (a beach road, a
  boardwalk over the sand, shacks, palms, showers, the sea), islands on the table with canals
  between them, linked by eight humps: hit one at speed and you fly into the next hood (the flight
  lands on the far ramp, upright); too slow and you bump the fence. A session is ninety seconds.
  Stunt too loud near the neighbours, ride through a sprinkler or across a lawn and the heat rises
  (five stars): patrol bikes, a cart and a drone come after you with lights and a two-tone whoop,
  pathing on each hood's street graph. Caught is a TICKET (the combo and half the points banked
  while the heat was on); a hump into another hood loses them (an escape: points, and credits).
  Heat cools when you ride clean. Payout: +45 an escape, −15 a ticket, never under 20. Deterministic
  and seeded on `src/math.ts` (no builtin transcendentals in the town, the patrol or the layouts);
  the whole session is byte views (`cityRun().bytes`) for a snapshot. Online, Wheelie City is
  ninety seconds each across the four hoods. The golden file: the Wheelie City session's hash
  changes (the new town) and three sessions are added (one per new hood); the other 36 hashes are
  unchanged. Size budget 160,000 B gzip (155,843 B measured).

## 0.2.1

- **The same bits on every engine** (an iPhone in a room with desktop Chrome): every track and map
  builder and every sim now uses `src/math.ts` (fdlibm's sin, cos, tan, atan, atan2 and pow, V8's
  hypot) instead of the builtins, which may differ between engines in the last bit (V8's
  `Math.pow` is the platform's libm). sin, cos, tan, atan, atan2 and hypot match V8 bit for bit; pow
  was the platform's, so jump faces move by a last bit, and 2 of 540 seeds measured now generate a
  different track (a championship under way may see a different track in a later round on such a
  seed). `tests/math.test.mjs` guards the sim and generator modules against builtin transcendental
  maths (render code allow-listed); `tests/golden.test.mjs` hashes 24 generated tracks, the race
  loop, the four open maps and fixed rides against `tests/golden.json`, and
  `tests/golden.browser.mjs` runs them in Chromium (`--serve` to check a phone). Size budget
  145,000 B gzip (141,265 B measured).

## 0.2.0

- **Online for up to four.** RIDE → ONLINE: YOUR NAME and the INVITE CODE, then HOST (pick the
  ride, 2 / 3 / 4 riders, SEND LINK: the share sheet, or the link copied) or JOIN (the room number);
  a link `/play/?mode=online&room=N&code=…` drops a friend straight in (the code is taken out of the
  address bar first). Every rider rides their own garage bike: a hello in the first 11 frames
  carries each rider's name, bike (model, parts, mods, tune choices, damage) and look to every
  screen, so every screen simulates the same bikes. Rides: a race on a new generated track (the
  host picks ROOKIE, PRO or MASTERS; AI rivals fill the empty places; 30 s after the first person
  is past the flag the rest are placed where they are), a Free Ride jam on any of the five maps
  (three minutes, trick points: big air, flips, long wheelies), and Big Air and Wheelie City
  head-to-head (each screen rides its own minute; the score travels in the input bits). The
  rollback link from Dune Hop (own input at once, predicted remote inputs, resim on a mismatch, FX
  only on a frame's first run, remote riders eased after a correction, 1–3 frames of adaptive
  delay, a desync hash); a rider who leaves is ridden by the AI; RIDE AGAIN starts the next ride for
  the whole room. Online pays more: each profile gets the payout and the wear for its own result,
  ×1.5, plus 75 a person beaten; the extra halves after six online rides in a rolling hour and stops
  after ten (no farming; `data/economy.ts` ONLINE). The bike's state is one buffer
  (`state`, `save`, `load`). The room server: `ROOMS_URL` (repo variable) → `PUBLIC_ROOMS_URL`,
  default `wss://fizlet-rooms.fizlet.workers.dev`, `?rooms=` overrides. Size budget 142,000 B gzip
  (137,888 B measured).
- **Renamed: Dirt Hop is now HOLESHOT.** Package `@coded-design/holeshot`, the build
  `dist/holeshot.mjs` / `dist/holeshot.js` (`createHoleshot`, global `holeshot`), the site at
  holeshot.domvirus.com. A local save under the old key loads and is saved under
  `holeshot:profile`; export codes now start `HS2-`, and old `DH1-`/`DH2-` codes still import.
- Phase 2 merged: the Race Series (a seeded, validated track generator; three championship tiers;
  profile schema v2), four open Free Ride maps (Dune Sea, the Quarry, Forest Enduro, Night Park;
  map 1 is the Neon Loop) and the full garage (tune choices, tyre compounds, five mods, wear,
  failures and crash damage, the service log, a 16-bike showroom with trade-ins, six makers,
  graphics, plates and outfits). Size budget 125,000 B gzip.

## 0.1.0

- First playable: one bike, one garage, four events. A first-run setup (one starter of four
  classes, paint, number, jersey, name); the garage (condition bars for tyres, chain, motor,
  suspension and brakes; new tyres, rebuilds and service; three mods; paint, number and the rider
  kit; a showroom; up to three bikes, pick which one rides); Race (three laps against three rivals of
  your class), Free Ride (the park, END banks it), Big Air (a minute, five judges) and Wheelie City
  (a minute on the block), all on your bike, all paying out and wearing parts. `tune()` turns wear
  and mods into what the physics rides. The profile is saved on the device with a versioned schema,
  and an export code moves it to another device. The roster: 16 original bikes from four makers.
  The camera never zooms; no page zoom on the play surface. A landing page with a race as its hero.
