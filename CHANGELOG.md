# Changelog

## Unreleased

- **New icon and share image.** The app icon is a lime setting sun with pink stripes and a wheelie silhouette on a cyan horizon (all icon sizes, maskable and Apple touch); the share image is the new launch cover's landscape cut; the cover art is in `site/public/shots/cover.jpg`.

## 0.5.6 — 2026-11-19

- **Big Air is an endless line.** No more oval: a roll-in deck and a hill down for speed, then a
  steel kicker and a tabletop landing every so often, forever, with banks either side and a stadium
  wall past them, so a fast bike never flies off the side or has to turn round. The jumps are sized
  by the bike's top speed (every length and height × (top / 17.5)²: the same flight on any bike, a
  bigger one for a faster bike): at full gas every bike in the garage lands every jump on the
  down ramp over 2 km (tests/venue.test.mjs: 26 jumps on the fastest, 67 on the slowest, no crash).
  The ground streams round the rider (a strip that slides along the line: the desert's pattern),
  deterministic per bike, zero allocation per step. Tricks, flips, the TRICK key, the minute and the
  judges are as they were; crowd stands, light towers, posts and flags ride along with the jumps.
  The Big Air golden (`big air run`) changes: it is a new course.
- **MX and SX venues** for Race, Series and Free Ride (`game.start(id, { venue: "mx" | "sx" })`, MX
  by default). **MX** is today's outdoor tracks made bigger for the fast bikes: straights and turn
  radii × 1.3, the track 4.6 wide (was 3.4), the berms higher to match (the jumps keep their size).
  A fast rider (full gas to the bike's top, braking for each turn by its radius) on four tracks goes
  off the track 46 times across the six fastest classes today and 10 times on MX (supersport 7 → 0,
  naked 15 → 0, the fast 2-stroke 5 → 0, the fast e-moto 19 → 10). **SX** is two original stadium
  tracks (NEON DOME, VOLT ARENA): a near-flat floor under the lights between walls with lit panels and
  lighting trusses, short straights and hairpins, rhythm doubles, whoops, a tight triple, a narrower
  track; every starter finishes three of each clean. Free Ride SX rides their floors.
- **Series per venue**: an MX and an SX championship (`enter(profile, tier, seed, venue)`); SX rounds
  take the stadium tracks in turn. A saved series is MX (its best places stay; SX's start empty:
  `series.bestSx`, added on load, no profile version change).
- Online races ride MX (deterministic as before); the online jam keeps today's loop; SX is solo for now.
- Size: +2,139 B gzip (205,943 → 208,082, the .mjs): the budget goes 207,300 → 210,000 (scripts/size.mjs).
- Perf (390 px, 4× CPU throttle, the autopilot): a race on MX draws about the same terrain faces a
  frame as today's loop (2,296 vs 2,205, MX and SX step their detail down sooner) at the same frame
  p50 (66.7 ms); SX 2,583 faces, p50 66.7 ms; Big Air's p50 50 ms as before.

## 0.5.5 — 2026-11-19

- **Every endless ride has the same controls as Endless Wheelie City.** The Endless Desert and each
  endless Free Ride ground now hop: a quick back-then-forward flick of the pad's stick (within
  0.35 s, only started with both wheels down, so balancing a wheelie never hops), L on a keyboard,
  or a gamepad's X, Y or right bumper. The hop is your bike's own (the garage's hop: suspension and
  travel count), it lands as a HOP ground trick, and it rides online too (the jam's HOP bit). One
  hop for both modes (src/bike/hop.ts) and one flick reader (src/bike/flick.ts). Race and Big Air
  keep their controls. Size: +364 B gzip (205,943 B, inside the 207,300 budget).

## 0.5.4 — 2026-11-19

- **The bunny hop is a stick flick** in Wheelie City, as on a real bike: a quick pull back (the front
  comes up), then a push forward, the whole flick within 0.35 s. It only starts with both wheels
  down, so balancing a wheelie (rocking back and forth with the front up) never hops, and holding
  back is still just leaning. L still hops on a keyboard. The HOP button is gone from the pedal.

## 0.5.3 — 2026-11-19

- **The gas never gets stuck dead on a phone.** iOS can end a touch without telling the rocker the
  finger lifted (a card over the pad, a lost capture); its two finger slots then stayed taken and
  every new press was ignored. A lost capture now ends the finger, and a new press always lands
  (stale slots are cleared first).
- **HOP stuck to the gas pedal** in Wheelie City, beside COMBO: tap it, or slide the gas thumb onto
  it (the gas stays on). No separate HOP key in the middle of the screen.
- **The pedal per the asks:** gas and brake square (round top and bottom ends), the seam between,
  a held zone lights and presses in (its lip goes; the pill itself does not move). A smaller pill on
  short screens (a phone on its side) so it never runs off the bottom, and the play area fits a
  landscape phone (it had a 420 px floor, taller than the screen).

## 0.5.2 — 2026-11-19

- **Gas and brake back to 0.4.0's rocker on phones.** The 0.5.0 rocker (the TRICK/HOP bubbles on a
  slime tether, square zones) did not answer on iPhone Safari: presses reached it but never became
  gas or brake. It is rolled back to 0.4.0's rocker, which worked there: the COMBO button slides out
  of the gas side again, Wheelie City has its HOP key and Big Air its TRICK key. The rest of 0.5.0's
  phone work stays (the ☰ menu, the chips up top, cards clear of the controls, the callout fix, Add
  to Home Screen). The bubbles come back once they are proven on a real iPhone;
  `tests/controls.browser.mjs` (their spec) is out of `test:browser` until then.
- **`?touchlog`** on the page shows an on-screen log of touches, what they hit and what the rocker
  made of them (for debugging controls on a real phone).

## 0.5.1 — 2026-11-19

- **Solid wheels.** Each tyre is one closed band (tread and both sidewalls); the rim ring, a solid
  dish, three spokes and the hub sit thin on each sidewall and drop under the tyre on the far side, so
  no wheel reads see-through and the rim stays inside the tyre from any angle (side, 3/4, head-on).
  Render only: the sim and its goldens are unchanged.
- **Gas and brake on iPhone.** The rocker's slime tether (an SVG) is pinned to 1×1 and kept out of
  hit testing, so Safari can't size it to its default 300×150 box over the pill and swallow the
  thumb.

## 0.5.0 — 2026-11-18

Three naming tiers (REAL on the private test links, NOD by default, SAFE for app stores) and the
naked bike a red V4; a garage that keeps the bike in view with live previews; phone controls with
the TRICK and HOP bubbles off the rocker, one ☰ menu key and Add to Home Screen. Sections below.

### Names

- **Three naming tiers** ([docs/names.md](docs/names.md)): every maker, model and maker paint has
  one id and three display names. **NOD** (the default build, the web) are owner-approved
  near-names: YAMORI, HONZO, KAWAZAKURA, STARHOWL, SURGE-ON, MACVIX and DUCELLI (the YAMORI YOWLER
  250 2T, the HONZO CRIMSON 450 FACTORY, the DUCELLI STRIKER V4, …). **REAL** names show only with
  `?names=real` or test credits (`?credits=inf` or `?money=inf`, also infinite, infinity or ∞) on
  the page (private testing), never by default and never saved.
  **SAFE** names are fully original (BLUEWAKE, EMBERLINE, LIMEJET, VOLTHOWL, BUZZWORKS, TRAILKIT,
  IRONJAW) and `HOLESHOT_NAMES=safe npm run build` builds an app-store bundle with neither the REAL
  nor the NOD table in it (`tests/names.test.mjs` builds one and greps it). Ids, saves, export codes
  and the online hello are unchanged. The street bikes now wear the makers they nod to (the mini a
  HONZO, the supersport a YAMORI, the naked a DUCELLI); the class headings list their makers from
  the models. Size: +1.2 KB gzip (the NOD and REAL tables).
- **The naked street bike is a red V4**: four cylinders (two banks of two) and four headers, side
  wings and a slim twin lamp, in its own factory red (not HONZO's red), where it was a lime twin.
- **No more "Sting"** (a real e-moto's name): the SURGE-ON paint is SURGE-ON BUZZ, and its blurbs
  say buzz.

### Garage

- **The bike stays in view.** The garage's turntable, the bike's name and pace, your bikes and the
  PARTS & MODS / PAINT & KIT / SHOWROOM tabs sit in a dock that stays at the top of the card while
  the lists scroll under it (1440, 1024, 390 and 844×390; on short screens it compacts: a smaller
  turntable, the info on one line).
- **Live preview.** Pointing at (or focusing) a paint, a kit piece, a mod or a showroom bike shows it
  on the turntable at once, with the pace chips against yours (+/−); moving away puts your bike back.
  Tapping a mod, a showroom bike or one of your bikes pins it: PREVIEW with BUY (or APPLY) and CANCEL
  (Esc too). Previews are announced.
- **A plinth that stands out.** A lifted top with a lighter lip on an edge glow (cyan by night, hot
  pink by day): 3.8:1 (dark) and 3.9:1 (light) against the preview's background, measured.
- **Tidier lists.** Every bike is one card shape (maker swatch, name, class and maker, stars and
  price, the key top-right, blurb, bars, pace), two across on wide screens; class headings with their
  makers; the header's credits, test-credits, rider and theme chips one height. On the game page the
  header handle no longer overlaps the card's top edge.
- Tests: `tests/garage-ux.browser.mjs` (the dock in view while the list scrolls; tap → the turntable
  changes, CANCEL restores it; hover and focus; plinth contrast); `tests/site.mjs` checks the handle.

### Phone controls

- **The TRICK bubble.** On a touch screen the option actions are no longer keys of their own: a round
  TRICK bubble pops out of the throttle rocker's side on a stretchy slime tether only while a trick
  is on (in the air; in a wheelie past 10 o'clock; Big Air: in the air), and in Endless Wheelie City a
  HOP bubble while on the ground. The thumb slides out onto it without lifting; while it is there the
  rocker zone it left (gas, brake or both) keeps applying and stays lit, so a wheelie or an air
  attitude holds; slid back, normal zone control; lifted, everything lets go. The bubble leans after
  the finger a little. It drives the same intents as the keys (combo, hop, trick), so online it rides
  the existing input bits (no new wire bits). Desktop keys and gamepads are unchanged.
- **No standalone JUMP (or TRICK) key** in any mode: it meant letting go of the stick or the gas.
- **The rocker:** GAS and BRAKE zones square (as tall as the pill is wide, 72 px), the seam 44 px, the
  pill's ends fully round; 194 px tall instead of 216 in portrait. A held zone presses in (its raised
  lip goes, the pill sinks) instead of only lighting up. The first-time seam hint moved down so it
  never sits under a bubble.
- **The stick** is the same size in landscape as in portrait (94 px, was 81 in landscape) and has
  the rocker's bottom and side safe-area buffer (it was cut off at the bottom on iPhones in landscape).
  In landscape the tach sticker moves up clear of it.
- **One ☰ key on phones.** The corner keys (regroup, reset, view, mute, light/dark) fold into one menu
  key beside PAUSE; tapped, they open downward as a column (same icon keys, labels and pressed states);
  tapped again or anywhere else, it closes. The chip bar now sits against the top edge (safe-area
  aware) with the hint under it, portrait and landscape. Desktop keeps its row.
- **Cards clear of the controls:** while a card is over the ride (pause, the result) the stick, the
  rocker and its bubbles are hidden, so the rocker no longer covers the result card's third key.
- **Fixed: an empty yellow pill mid-screen** in every endless ride: the trick callout's `hidden` was
  overridden by its own `display:grid`, so its empty name and points boxes showed at rest.
- **Add to Home Screen:** a web app manifest (full screen, starts at /play/, any orientation, icons
  192/512 + maskable, an Apple touch icon) and, on a phone browser in landscape, a one-time tip with the
  platform's how-to (iOS: Share → Add to Home Screen; Android: the menu → Install app, or an INSTALL
  key where the browser offers it). Dismissible, remembered per browser, never on desktop or once
  installed.
- Tests: `tests/controls.browser.mjs` (390×844 and 844×390: stick sizes and safe area, no pad keys,
  square zones, the brake pressed in, the bubbles' context and one-touch paths gas → HOP → gas,
  seam → HOP, gas → TRICK → gas, lift releases, Big Air's TRICK in the air, the ☰ column, the chip
  bar up top, cards hiding the controls, the result card's keys fitting; desktop unchanged);
  `tests/hud.browser.mjs` (no empty HUD boxes at rest in any mode at 1440 and 390); the stunts test
  reaches the combo through the bubble; the site test checks the manifest and the tip.

### Size

- **Budget 207,300 B gzip** (was 203,000): the three rounds together measure 205,309 B
  (holeshot.js; +5,246 B over 0.4.0's 200,063: the phone controls' bubbles, tether, ☰ column, CSS
  and Home Screen tip +1,627 on their own; the NOD and REAL name tables +1,196; the garage dock,
  live preview and card layout +2,246), plus about 2 KB of room (`scripts/size.mjs`).

## 0.4.0 — 2026-11-18

Endless Wheelie City becomes an open world, the endless grounds join ENDLESS, and both ride online
with friends; new tricks and the COMBO button; bike families (gas, electric, street) with their own
bodies and upgrades; a garage turntable, measured pace and a speed chip; icon-only keys. Sections
below; the newest work first in each.

### Endless Wheelie City: the open world

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

### ENDLESS: the endless grounds

- **Smooth crests (ENDLESS grounds), on Fizlet 0.26.0.** `@fzlt/core` ^0.25.0 → ^0.26.0; the
  endless grounds' `terrainView` draws with `split: "adaptive"` (each cell along the diagonal whose
  ends are closer in height; a tie keeps the fixed one), and the window's own `height` / `normal` /
  `sample` (`src/modes/desert/world.ts` `face()`) use the same rule, so the bike rides exactly the
  drawn face: a dune's crest is one straight fold, not stair-steps. Test
  (`tests/desert.test.mjs`): on every ground (45–61 % of the window's cells flipped), the
  bike's height equals the brick's adaptive terrain at six points a cell and the normals match.
  No golden hash changed (no golden case rides the endless window; the race, maps, jams, Big Air
  and the city keep the fixed split).
- **ENDLESS** (the old ENDLESS DESERT tile): a picker card with the Dune Sea (default) and an endless
  version of each other open Free Ride map, on the desert's streaming window and far ring: THE DEEP
  QUARRY (terraced benches and faces), THE ENDLESS WOODS (wooded hills, log jumps, roots, trees you
  can hit) and THE NIGHT PARK (flat, doubles and rollers, pylons, light towers), in their maps' colours,
  each its own seed and its own best (`stats.far.quarry`, `.forest`, `.night-park`). One tile with a
  picker rather than four: on a phone four near-identical tiles would push the rest of the menu down.
  The Neon Loop has no endless version (it is a race loop, not a ground). The desert's ground is
  bit-for-bit as it was.
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

### Online with friends: endless

- **Online: the endless rides with friends.** ONLINE now offers ENDLESS (pick the ground: the Dune
  Sea, the Deep Quarry, the Endless Woods or the Night Park) and ENDLESS WHEELIE CITY for up to four,
  on the same invite link and code. Everyone rides the same seeded world (each screen streams its own
  window of it round each rider, so friends can roam apart), sees the others' names over their heads,
  and an arrow on the screen's edge (with the name and how far) points at a friend off the screen.
  G (or TO HOST / REGROUP on the HUD) brings you to the host; the host's brings everyone. Riders bump
  each other, as in the race. In Endless Wheelie City every rider has their own neon patrol: a cop
  only chases and tickets the rider it is after. A shared session scoreboard (points, distance, best
  trick, combo points, hand drags) is the same on every screen, fed through one scoring door
  (`src/online/board.ts` `feed`) that new tricks plug into; friends' tricks show as callouts over
  their heads. END banks your ride; the room's result comes when everyone has. Deterministic and
  rollback-identical: two and four headless screens ride each endless mode for three minutes (90 s for four in `npm test`) over a
  jittery link and end byte for byte on the no-latency run (`tests/online-endless.test.mjs`); the
  browser test joins a room in every endless mode (`tests/online-endless.browser.mjs`). The open
  world's window now slides with a little give (a rider weaving on a slide line, a crash, a
  rollback's frames run again no longer slide it back and forth: 625 → 69 slides on a weaving
  minute). Its gather now records, in the state, which gather the live neighbours, sprinklers and
  dog were mapped onto, so a rollback that lands on a gather a guessed future already made can't
  leave them mapped for a moment that never happened (the offline ride is byte for byte as before;
  the golden hash moves only for the two new numbers). The host's pick byte is now kind (3 bits) and sub (3 bits).
  **With this release's tricks:** the COMBO button rides the wire (input bit 31, decoded like HOP)
  and both endless rides step it for every rider; every trick feeds the shared board (ground tricks
  and the combo's share, the drags, the combo button's tricks banked on the spot, an air banked on a
  landing), and its best-trick column names the trick (SEAT TAP, MANUAL, FLIP, AIR COMBO...);
  friends' tricks, drags, whips and banks pop over their heads; a friend's trick pose, double hand
  drag and whip show on their bike (read from their run's stunts, which is ride state, so every
  screen draws the same and a rollback puts it back); a wheelie bar's cap holds online too. With the
  END key gone from the HUD, the online pause card has END & BANK in the endless rides (E still
  banks); REGROUP is an icon key (G). Test: `tests/online-endless.test.mjs` ("the combo button
  online"). CI rides the online endless test for one minute (`ENDLESS_MINUTES=1` in
  `.github/workflows/ci.yml`; the default, 3 min for two screens and 90 s for four, stays local).

### Tricks

- **Tricks everywhere, new tricks, the COMBO button (R8).** Both endless modes (the ENDLESS grounds:
  dune sea, quarry, woods, night park; and Endless Wheelie City) now ride the same trick set
  (`src/modes/stunts.ts`, on top of the city's ground-trick scorer): wheelies, manuals, hops and
  stoppies with the combo, and past 12 o'clock the **drag ladder**: the hand drag (×10), held 1.5 s
  more the **double hand drag** (both hands down, ×20), and leaned on to about 2 o'clock the **fender
  drag** (the rear fender on the road, sparks, ×40; the fender props the bike, but on the gas it still
  goes over). Banked back under 12, lost on a loop-out; the loop-out moved from about 1 o'clock to just
  past the fender drag (about a quarter past 2). **Whip:** left or right in the air kicks the bike
  sideways; back to straight it counts, chained whips are each worth more; landed still kicked out it
  is a crash. **COMBO button** (C on a keyboard, LB on a gamepad; on a touch screen it slides out of
  the throttle rocker's gas side while the gas is held, at 10 to 12 o'clock, tap it or slide the gas
  thumb onto it and the gas stays on): SEAT TAP, KNEE KNOCKER, SIDE KICK, CAN-CAN, then at random
  NAC-NAC, HEEL CLICKER, SKY DIVER, STARFISH (seeded); held longer pays more, ×2 in a wheelie, ×3 in
  the air (banked on a clean landing; still out at the landing it is a bail). A big trick-name callout
  pops with the points. The ENDLESS HUD gains a points chip and an at-risk drag chip; Endless trick
  points pay inside Free Ride's session cap. Size: +5,182 B gzip measured on top of r6 and r7. Tests: `tests/stunts.test.mjs`; golden: the Endless Wheelie City ride's hash (its
  loop-out moved).
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

### Bikes and upgrades

- **Bike families: gas dirt, electric, street.** Every class belongs to a family and every bike
  looks like its family (`src/bike/bodies.ts`): electrics lose the tank and the exhaust (an e-bike is
  a pedal bike with thin tubes, a battery on the down tube, cranks and a saddle; an electric dirt bike
  is a moto frame round a big glowing battery box, the motor at the pivot). Three original **street
  bikes** in a new STREET class from three new makers of the city's own (no nod to any real maker):
  CURBCAT BLOCK PUP 125 (a red street mini), NIGHTGLASS TIDEBREAKER 600 (a fully faired supersport)
  and IRONJAW BARE KNUCKLE 900 (a naked superbike), each with its factory paint. Road tyres, short
  stiff springs, five-plus gears: the fastest bikes on the flat (measured, as shown: TIDEBREAKER 84 mph and
  BARE KNUCKLE 90 mph stock against 73 mph for the fastest dirt bike, the YX-250 2T) and best in Endless Wheelie City. On the dirt they slide and case
  (grip ×0.72, travel ×0.8, case line ×0.85, brakes ×0.8: `src/model/families.ts`), and picking one
  for a dirt mode asks first: "Street bike on dirt? It won't perform well." (RIDE ANYWAY / PICK
  ANOTHER). Online rides use the same rules. Never a starter; the showroom sells them (the mini from
  day one, the big two with the tier 3-4 unlocks).
- **Family upgrades, the late-game goals** (one per family, the dearest things in the shop): a
  WHEELIE BAR for the street mini (◈ 5,200: past 12 it sits on its bar and never loops out, the
  balance window ×1.6; the trade: the hand drag pays ×5, not ×10), a MOTOR SWAP for the electrics
  (◈ 7,400: +30 % drive, +14 % top gear, the battery heats 1.6× faster), a BIG BORE KIT for the gas
  dirt bikes (◈ 7,800: +12 % drive, +3.5 % top gear, a deeper note) and a TURBO for the street bikes
  (◈ 24,000, dearer than any bike: +22 % drive with boost from the middle revs, +16 % top gear). Each
  shows on the bike (a bar with two little wheels, a bigger motor and a second battery, deep cylinder
  fins, a charger and intake on the right), is saved with the bike, rides the online hello (one bit
  each) and shows its pace before → after in the garage, read off the same measure as the PACE
  row (`src/model/pace.ts`; speeds as shown). Measured (`tests/families.test.mjs` prints the table):
  YX-250 2T big bore 0–30 0.74 → 0.70 s, top 72.6 → 75.3 mph; REDLINE 450 WORKS 0.76 → 0.70 s,
  69.7 → 72.4 mph; LIGHT HORNET motor swap 0.67 → 0.54 s, 56.1 → 64.0 mph; ALPHA WOLF 0.52 → 0.43 s,
  66.9 → 76.4 mph; KIT FOX 0–20 0.48 → 0.37 s, 46.0 → 52.5 mph; TIDEBREAKER turbo 0.79 → 0.65 s,
  84.1 → 97.9 mph; BARE KNUCKLE turbo 0–60 1.95 → 1.34 s, 89.8 → 104.6 mph. The wheelie bar leaves
  the pace as it is. Sound hooks for the voice code: a big bore lowers the voice's pitch (in
  `power.voice`), `tuned.sound.whistle` marks a turbo for a boost whistle and blow-off (not voiced
  yet). The wheelie bar caps every drag in both endless modes at its ×5 (the double hand drag too),
  and with it the fender never reaches the road (`src/modes/stunts.ts` `bar`; test
  `tests/stunts.test.mjs`).
- **The faster bikes are a little faster, and every bike has its own pace.** The torque is as it
  was (the curves and the lower gears untouched); the top gear stretches with the tier (×1, ×1.025,
  ×1.05, ×1.08: `TOP_STRETCH` in `src/data/roster.ts`), so a tier 4 bike runs about 7 % further at
  the top and a starter is unchanged. Measured on the sim (full gas on the flat; stock, new), 0–30 /
  0–60 mph / top as shown: YX-125 0.91 / 2.18 s / 63 mph … YX-250 0.74 / 1.55 s / 73 mph (was 68);
  REDLINE 150F 0.92 / 2.90 s / 61 … 450 WORKS 0.76 / 2.12 s / 70 (was 65); KIT FOX 0.87 s / never /
  46 … SILVER FOX 0.61 s / never / 58 (was 53); LIGHT HORNET 0.67 s / never / 56 … ALPHA WOLF 0.52 /
  1.10 s / 67 (was 62). The fastest bike is under 20 % over the slowest gas starter, so stock races
  of one class stay close. The garage's TOP SPEED bar now reads against 21 units/s (was 19), so the
  quicker bikes don't all pin it.
- **Gear changes you can hear.** The gas bikes shift out loud: an upshift cuts the ignition for
  70 ms while the revs fall to the next gear, a downshift blips the revs. The electric bikes are one
  smooth whine that follows the road speed (an e-bike's hub gears are never heard). Mute silences it
  all (`src/bike/kit.ts` `voice`; tests: `tests/voice.test.mjs`).

### Garage and speed

- **The garage turntable turns.** Drag or swipe the bike preview sideways; with focus, ← and → turn
  it 15° and Home faces it front-quarter again (a slider for assistive tech, in degrees). Tested in
  `tests/garage.browser.mjs` (mouse at 1440, touch at 390, keys).
- **PACE in the garage.** PARTS & MODS shows the riding bike's 0–30 mph, 0–60 mph and top speed as
  tuned (wear, gearing, motor map and mods all move it; NEVER when it can't reach 60), and every
  showroom card shows the model's new numbers; 0–50 / 0–100 km/h when the units are metric. Each
  number is measured on the sim once per tuned bike (about 4 ms; `src/model/pace.ts`), not guessed;
  tests: `tests/pace.test.mjs` (every model and setup).
- **Speed on the HUD.** A small chip next to the distance (lap, points, air; next to the clock in Big
  Air) shows your speed in mph, or km/h with Metric (the UNITS setting, `src/model/units.ts`).
- **Speed readouts are scaled for feel; physics unchanged.** The table is small (1 unit ≈ 1 m),
  so every speed shown reads ×1.6 (`SPEED_DISPLAY` in `src/model/units.ts`): a top-tier bike reads
  70+ mph. Display only: the sim, the measurements, distances and saved numbers are untouched.
- **Miles by default, km as a setting.** SETTINGS → UNITS: Imperial (miles, mph; the default) or
  Metric (km, km/h), saved in the profile (schema v6: every existing save migrates to Imperial).
  Applied wherever a distance shows: the Endless Wheelie City and endless-ground HUD chips (e.g.
  "1.70 MI"), the BEST lines, the endless picker's bests, the ride summaries and the payout's
  distance line. Display only: physics, payouts and saved distances stay in world units
  (1 km = 0.621371 mi, `src/model/units.ts`). Under `?money=inf` the switch is not saved, as every
  setting there. Tests: `tests/units.test.mjs` (conversions, default, migration, payout label),
  `tests/units.browser.mjs` (1440 and 390: MI by default, METRIC shows KM and persists across a
  reload, not saved under test credits).
- **Test credits: `/play/?credits=inf` (or `?money=inf`).** For trying every bike: the garage shows
  ◈ ∞ and a TEST CREDITS ∞ chip, the showroom sells every bike (unlocks open), every part, mod, tune
  and cosmetic is free (buying never subtracts). The session plays a copy of the saved profile in
  memory and saves nothing, so taking the param off loads the real profile exactly as it was (the
  export code stays the real one). ONLINE is off while it is on, so a free-bought bike never rides
  against other people. No effect without the param; rides unchanged (`src/model/testcredits.ts`;
  tests: `tests/testcredits.test.mjs`, `tests/testcredits.browser.mjs`).

### Controls

- **In-game keys, icon only.** One corner row in every mode: reset, the view (a chase-cam icon,
  pressed in and lit with the map icon while the map view is on), mute (raised while the sound is
  on, pressed in with no drop shadow while muted), light/dark (on /play/), pause; each with an
  aria-label, 44 px, one row at 390. The END key is gone: pause has END & BANK in Free Ride, ENDLESS
  and Endless Wheelie City (E still banks from the keyboard). `onTheme` in `createHoleshot()` options
  adds the theme key (in the menus' header too).
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
- **Walk the bike.** Stopped (under 1.5 m/s), no gas, no brake, the weight held (W/S, ↑/↓, the pad's
  stick) for 0.15 s: the rider puts a foot down and pushes the bike at 1.25 m/s that way, backwards
  too, the steer turning the push; let go and the feet stop it, the gas rides on at once. Slower up a
  slope, none past 0.42 rad; never through a post, a wall or off the table (each mode's own check). In
  Free Ride, Endless, the jam, Endless Wheelie City, Race and Big Air (people only). Its numbers live
  in the bike's state (a spare slot and the spare byte: the state size is unchanged), so it is
  deterministic online and after a rollback; every golden hash is unchanged (no golden case walks).
  The rig walks astride it, boots on the ground; a WALK chip; a one-time phone hint. Tests:
  `tests/walk.test.mjs`, `tests/walk.browser.mjs`, an alloc case.
- **Unstuck in Race, Big Air and Wheelie City** (the same watch and timings as Free Ride: the prompt
  at 2 s, an automatic reset at 4 s, R / ↺ / a gamepad's Back). Race: back on the line behind where
  you were, the progress taken back, held 1.2 s; it never gains a place (tested). Big Air: the run-in
  of the current jump. Wheelie City: the last good spot on the street. Tests: `tests/unstuck.test.mjs`.
- **Unstuck** (Free Ride, Endless Desert, the Free Ride jam): a ring of the last ten good places, a
  stuck prompt after two seconds without half a unit of progress with the controls held, an automatic
  reset after four, and a manual reset (R, the ↺ key on the HUD, a gamepad's Back/Select; online the
  input bit `B_RESET`). The reset never lands within two units of the trap, needs gentle ground and
  six units of clear run-up, nudges a unit or two sideways if the place itself is blocked, and blinks
  the bike for 1.2 s (no tree or cactus hits meanwhile). Tests: a wedged bike gets the prompt and then
  the reset, lands upright behind the trap and rides more than 2 units in a second; R resets.
- **/play/ is all game.** The site header is tucked away behind a small HOLESHOT handle at the top
  (desktop; phones already hid it), and on /play/ it has no GitHub, Play or theme keys: the theme
  key is in the game.

### Fixes

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
- **The bike draws in the right order.** Every part has its layer: a wheel sits under the body from
  the side, over it at its own end of the bike and under it at the far end (two nested `behind`
  groups per wheel); each fender rides with its wheel's level, always over its tyre; the fork legs,
  swingarm arms, exhaust and side number plates hang from near/far side groups (from 6 over
  everything to 1 under everything), so the far plate and far parts never show through. The rims and
  spokes show again (the tyres used to cover them). Measured by `tests/layers.browser.mjs`: all 16
  bikes × 16 yaws × 2 pitches × 4 poses (seated, wheelie, steered, squashed): fenders 100 % over their
  tyres (2,604 cases), far-side parts 0.0 % over the bike (1,792), near-side parts 100 % over the
  wheels (1,792). The far leg test still holds (168 cases, 0.0 %).
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

### Site, build, tests and size

- **Credit: Holeshot is by David Cooley (game creator).** The landing (its eyebrow, the "by" panel
  with one creator line, the meta description), the /play/ header (V0.x · BY DAVID COOLEY), the
  footer, README, package.json's author and description; his name links to
  https://fizlet.com/people/david-cooley/. "Built on Fizlet" stays. The LICENSE's copyright line and
  the bundle's MIT banner are unchanged (a licence matter, not a credit), as is `site/game.json`
  (generated from the factory's spec).
- **Release tags.** CI tags `vX.Y.Z` on `main` when `package.json`'s version has no tag yet (the
  `tag-version` job, after the checks); how to cut a release and the commands that backfill v0.1.0 to
  v0.3.0 are in CONTRIBUTING.md.
- **Size budget 203,000 B gzip** (was 184,000): this release measures 200,063 B (holeshot.js;
  +17,603 B over main before these five rounds, 182,460: the bike layers, turntable, speed chip and
  icon keys; the measured pace, PACE rows, top-gear stretch and gear-change voice; the stunts,
  callout and COMBO button; the family bodies, street bikes and upgrades; the endless rides with
  friends and their trick wiring), plus about 2.9 KB of room.
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
- Size: 174,328 B gzip (holeshot.js, +4,140 B), budget 174,000 → 178,000 B (scripts/size.mjs has
  the reasons).
- Profile v4: the endless bests (v3 → v4 seeds them at 0; the desert's carries over).
- Size: 170,188 B gzip (+4,124 B), budget 168,000 → 174,000 B (scripts/size.mjs has the reasons).
- The town's ground now boxes fewer doubles a step (hypot's arithmetic inline in `roadGap`, the hump
  height through the scratch array): the same bits, about half the young-generation GCs.
- Size: 166,064 B gzip (+2,427 B: the far ring and its painter, unstuck in three more modes), under the 168,000 B budget.
- The golden file: the online race of four (its people's watch is in the race's bytes) and the four
  Wheelie City sessions (the ring is in the session's bytes) change; every other hash is unchanged.
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
