# Changelog

## Unreleased

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
