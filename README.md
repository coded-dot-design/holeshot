# Holeshot

**One bike. Every kind of dirt.** A dirt bike game on a tabletop: pick one bike, race it, fly it,
wheelie it through town, and keep it alive in the garage with what you win. Tyres, rebuilds, mods,
paint and a rider kit. Neon at night, pastel by day.

By [David Cooley](https://fizlet.com/people/david-cooley/) (game creator) · built on [Fizlet](https://github.com/coded-dot-design/fizlet) · MIT

- **Play:** https://holeshot.domvirus.com/play/
- **About:** https://holeshot.domvirus.com/

Holeshot grew out of three pieces in Fizlet's Daily (Moto Track, Big Air and Wheelie City), which
shared one bike. Now they share one garage.

## The game

**Your bike.** At the first run you pick one starter, the cheapest of each class: the **YAMORI
YOWLER 125 2T** (a blue 2-stroke: light, little down low, a hard hit up top), the **HONZO CRIMSON 150F**
(a red 4-stroke: heavy and torquey, slow to rotate), the **MACVIX KIT FOX** (an orange e-bike:
light, quick to lift) or the **SURGE-ON LIGHT BUZZ** (a light electric dirt bike: every newton at
once). Seven makers in all (YAMORI, HONZO, KAWAZAKURA, STARHOWL, SURGE-ON, MACVIX, DUCELLI), our own
names: near-names on the web, fully original ones in an app-store build ([docs/names.md](docs/names.md)). Paint it, number it,
pick your jersey and a name. That bike rides every event.

**Getting around.** The GARAGE is home: you land there after the first-run setup and on every
load, and come back to it after every ride. Its one main key, **LET'S RIDE**, opens the ride page
(← GARAGE top-left, always in view; Escape steps back too). ⚙ beside the light/dark key opens
SETTINGS. The ride page has four groups, each a line and a shelf of tiles (side by side on a wide
screen, stacked on a phone): **RACE** (the SERIES first, then a single RACE, each MX outdoor or SX
stadium), **ENDLESS** (each endless ground, Endless Wheelie City, a MASHUP to come), **FREE RIDE**
(each map, the two SX stadium floors, Big Air) and **TRACK DAY**
(street bikes on road circuits, to come). Each riding group has its own ONLINE tile (the room card,
with that group's kind picked; online rides MX, SX is solo). `?mode=<id>` on /play/ still starts that event at once.

**Events**, all on your bike:

- **Race**: the gate, three laps of the Neon Loop (bermed turns, a rhythm section, whoops, a triple,
  the finish tabletop) against three rivals on stock bikes of your class. Places pay.
- **Free Ride**: five maps to yourself (the Neon Loop, Dune Sea, the Quarry, Forest Enduro, Night
  Park), no laps, no clock; END banks the session (a little pay for saddle time, air, wheelies and
  tricks).
- **Endless**: ground that never ends; pick it on the ENDLESS card (each keeps its own best). THE
  DUNE SEA (below, the default), and one endless version of each other open Free Ride map on the same
  streaming window: THE DEEP QUARRY (benches 1.1 high cut into a broad rise, each riser a steep face,
  broken rock; ledges, rubble, boulders, light rigs), THE ENDLESS WOODS (long wooded hills; log
  jumps, roots, rock gardens and stands of neon trees you can hit) and THE NIGHT PARK (nearly flat;
  doubles, rollers, pylon rows, light towers), each in its Free Ride map's colours and its own seed.
  Each ground is its own tile in LET'S RIDE's ENDLESS group. The desert, as it was:
- **The Dune Sea** (Endless): a dune sea that never ends. Big rolling dunes across the wind, sharp crests,
  witches'-hat peaks and bowls, and now and then a kicker, a whoop section, a cactus clump, a rock pile
  or a camp with a beacon to ride to; a neon grid over the sand, a haze over the near window and
  behind it ridgelines layered out to 250 units (the same ground on a coarse far ring, five bands,
  hazier the further), so the dune sea runs to the horizon and there is never an edge. The ground is a pure function of the seed and the place
  (the same dune is always the same dune); the bike rides an 80 × 80 unit window of it that slides
  with you. The HUD counts the distance in miles, or kilometres with UNITS set to Metric in SETTINGS (a
  unit is about a metre: the bike's wheelbase is 1.5), and your best distance is kept in the profile. END banks it (Free Ride's pay, plus 20 a km, under its cap).
- **Big Air**: a minute down an endless straight in a stadium: a roll-in deck and a hill down for
  speed, then a steel kicker and a tabletop landing every so often, forever, banks either side and a
  stadium wall past them (you never leave the line or turn round). The jumps are sized by your bike's
  top speed (every length and height × (top / 17.5)², so the flight is the same shape on any bike): a
  full-gas jump lands on the landing's down ramp, a short one on its deck. Hold TRICK in the air and
  the stick picks one of four tricks; weight all the way back flips it. Five judges score the run and pay.
- **Endless Wheelie City**: an open world of roads, towns and fields that never ends, in every
  direction (the same world on every screen): long smooth roads sweep across rolling fields
  (highways, smaller roads branching off, junctions and roundabouts, kickers now and then on the
  crown of the open road), towns strung along them (shops, a diner, a gas station, flats and a tower
  round the middle, houses with lawns, sprinklers and a dog further out, warehouses on the edge) and
  farmland between (ploughed plots, crops, tree rows, fences, hay bales, farmsteads). Wheelies,
  manuals, hops and stoppies, bonuses across crosswalks, through sprinklers and past a neighbour
  shaking a fist. Too loud in town and the neon patrol comes (comic, no weapons); ride out of the
  town's limits and you lose them. No clock: how far out from the start? Kilometres on the HUD, END
  banks it, the best is kept. **The patrol** tickets you only when it
catches you stopped (or down after a crash); keep riding and the heat climbs instead: more units
join, a cart, then neon drone cops with searchlights, up to six; they are bound to their town, so
riding out past its limits loses them (LOST THEM! points, the combo up). **The hand drag:** the city's
bikes go back past 12 o'clock to about 1; hold it past 12 for a second and a half and the rider
drags a hand on the road: ×10 points while it lasts, banked when you come back under 12, lost if
you loop out. A building between the chase camera
  and the bike fades to a ghost (outlined) and comes back when the bike is clear; one the camera is
  all but inside fades out completely.
- **Series**: three championship tiers (ROOKIE CUP, PRO CIRCUIT, NEON MASTERS) of four to six
  rounds, at either venue: **MX** (outdoors: every round a new generated track, harder round by
  round) or **SX** (the stadium tracks in turn); against named rivals on modded bikes; points, prizes
  and a title bonus. Each venue unlocks its own tiers.
- **Venues (MX and SX)**: Race, Series and Free Ride ride either. **MX** is the outdoor tracks made
  bigger for the fast bikes: straights and turn radii × 1.3, the track 4.6 wide (was 3.4), the
  berms as high as it is wider; the jumps keep their size. **SX** is two original stadium tracks
  (NEON DOME, VOLT ARENA): a near-flat floor under the lights between walls, short straights joined by
  hairpins, rhythm doubles, whoops, a tight triple, a 3.2-wide track; Free Ride SX rides their floors.
  Online rides MX.

- **Online**: up to four riders, each on their own garage bike (its mods, its wear, its paint and
  your kit travel to every screen). The host picks a **race** on a new generated track (ROOKIE, PRO
  or MASTERS; AI rivals fill the empty places), a **Free Ride jam** on any of the five maps (most
  trick points in three minutes wins), or a **Big Air** head-to-head (everyone
  rides their own minute; the best score wins). HOST, pick, 2 / 3 / 4, SEND LINK: the link drops a
  friend straight into the room. Your bike answers your keys at once on a phone's network (each
  screen runs ahead on a guess of the others' inputs and quietly corrects). RIDE AGAIN starts the next
  ride for the whole room; a rider who leaves is ridden by the AI. Online pays more: your own
  profile gets the payout and the wear for your own result, ×1.5, plus 75 for each rider you beat;
  the extra halves after six online rides in an hour (no farming).

**The garage.** Every event wears the bike: tyres lose grip, the chain stretches, a 2-stroke's top
end (or a 4-stroke's engine, or a battery) loses pull, seals blow and it cases sooner, brakes fade.
Condition bars show it; you feel it on the track. Buy new tyres, rebuild the motor, service the rest;
add mods (exhaust or controller, short gearing, suspension); buy another bike (the garage has
three spots; + BUY SPOT by your bikes adds a 4th, 5th and 6th for ◈ 2,500, 5,000 and 10,000; each
bike keeps its own parts, mods and paint) and pick which one rides; change the paint, the
number and the rider kit (helmet shape and paint, visor, jersey, pattern, pants, boots, gloves). A
2-stroke rebuilds cheap and often, a 4-stroke rarely and dear. Nobody gets stuck: every finished
event pays something, a worn bike still rides, and the pit crew fixes you up for free when you've
ridden a few events and can't pay.

**Controls.** Space or J gas, K or Shift brake, W/S or ↑/↓ your weight (back lifts the front; in the
air it pitches the bike), A/D or ←/→ steer, L trick (Big Air) or hop (Endless Wheelie City and every endless ground), V
camera, M sound, P or Escape pause, R reset (every mode you ride yourself; the ↺ key on the HUD, a
gamepad's Back/Select). Every endless ride has the same hop: L, a gamepad's X, Y or right bumper, or
on the pad's stick a quick pull back then push forward (within 0.35 s, only started with both wheels
down, so balancing a wheelie never hops).

**Walk the bike.** Stopped (under 1.5 m/s) with no gas and no brake, hold W/S or ↑/↓ (on a phone,
the pad's stick forward or back) and the rider puts a foot down and walks the bike that way at about
1.25 m/s, backwards too; A/D steer the push. Let go and it stops; the gas rides on at once. It works
on slopes up to about 24° (no further up a cliff), never through trees, posts, walls or off the table,
in every mode you ride yourself (Free Ride, Endless, the jam, Endless Wheelie City, Race and Big Air;
rivals never walk). A WALK chip shows while you push; a phone shows "No gas? Stick back to walk it
out" once. It is the first way out; the reset below is still there.

**Stuck?** In Free Ride and Endless Desert the game keeps the last good places you rode (on the
ground, upright, moving, clear of trees, cactus and rocks; one a second). Barely moving for two
seconds with your hands on the controls brings up "STUCK? Hold R / tap ↺ to reset"; four seconds
and it resets on its own. A reset puts you upright and still on the newest of those places that is
clear, on gentle ground with six units of run-up ahead and at least two units from where you got
stuck (so never back into the same trap), facing the way you were going, with a short blink. It is
an input of the frame (online, every screen does the same). The same watch runs in Race, Big Air and
Wheelie City: a race reset puts you back on the line behind where you were (the crash respawn), takes
that progress back and holds you 1.2 s while the field rides on, so it can never gain a place; Big Air
puts you at the run-in of the current jump; Wheelie City at the last good spot (never a
lawn, the sand or the water). A mouse: hold the track for gas, drag to steer and lean. Phones: the stick
under the left thumb leans and steers (the same size in portrait and landscape); under the right,
the **throttle rocker**, one pill with square GAS and BRAKE zones: slide the thumb up for gas, down
for brake, and onto the middle seam for both at once (the wheelie and the feather), never lifting; a
second finger on the pill adds the brake too. A held zone presses in. There are no other touch keys
over the ride: the **TRICK** bubble (in the air, or in a wheelie past 10 o'clock) and the **HOP**
bubble (Wheelie City, on the ground) pop out of the rocker's side on a slime tether only when they
are any use; slide the thumb out onto one without lifting and the zone it left (gas, brake or both)
stays on while it is there, then slide back. The corner keys fold into one ☰ key beside PAUSE; a card
over the ride (pause, the result) hides the touch controls. In a phone browser held sideways, a
one-time tip offers to add Holeshot to the Home Screen (it launches full screen). A gamepad works too. The look follows the page's `<html data-theme>`.

**Camera.** The chase camera's framing is set once at the start of an event and never zooms: not
with speed, not in the air. Resizes are debounced and only a change of width refits the framing; a
phone's address bar coming and going (a height-only resize) never moves the camera. The play
surface, the canvas and the pad are `touch-action: none`, so no pinch or double-tap zooms the page.

**Saving.** Your profile lives on the device (localStorage, a versioned schema). SETTINGS shows an
export code to carry it to another device (paste it into IMPORT there). No accounts.

**Units.** Distances and speeds show in miles and mph by default; SETTINGS → UNITS switches to
Metric (km, km/h), saved in the profile (display only: the game measures in world units, about a
metre each; 1 km = 0.621371 mi). Under `?credits=inf` the switch shows but is not saved.

## As a module

```js
import { createHoleshot } from "./dist/holeshot.mjs";
const game = createHoleshot({ host: document.querySelector("#stage") }); // setup or the garage
game.start("race");                         // or "freeride", "bigair", "wheelie"
game.start("race", { venue: "sx" });         // Race, Series and Free Ride: venue "mx" (default) or "sx"
createHoleshot({ host, attract: true });     // the landing hero: a race on the autopilot
createHoleshot();                            // a layer over the whole page; Escape gives it back
```

**Online play** needs a fizlet-rooms server (the same one Dune Hop uses): the play page passes
`ROOMS_URL` (a repo variable, built in as `PUBLIC_ROOMS_URL`; default
`wss://fizlet-rooms.fizlet.workers.dev`), and `?rooms=wss://…` on the page overrides it. The server
must list the site's origin (https://holeshot.domvirus.com) in its `ALLOWED_ORIGINS`. An invite code
gets you in. `createHoleshot({ rooms })` takes the URL when you mount the game yourself.

## Testing

**Infinite money:** open `/play/?credits=inf` (or `?money=inf`): ◈ ∞ and a TEST CREDITS ∞ chip, every bike, part and upgrade free and unlocked, nothing saved (take the param off and your real profile is back exactly), online off.

## Size

The whole game, its Fizlet bricks (kernel, diorama, terrain, drive, input, pad, sound, ui, presence) and the
Board UI styles: `dist/build.json` holds the measured gzip size of each build (`npm run size`
checks it against the budget). No runtime dependencies: `@fzlt/core` is a dev dependency, bundled at
build.

## Develop

```sh
npm ci
npm run check         # typecheck, build dist/ (committed), size
npm test              # headless: the bike, tune(), the profile (save, load, migrate, the code),
                      # every mode on every starter class, the economy (payouts, wear, the pit
                      # crew, the online bonus and its cap), allocation, online sync and rollback, the determinism guard
                      # and the golden hashes (tracks, maps and rides, bit for bit)
npm run test:settle   # the menus and the hero sleep, a race never does, off screen pauses, Recall
npm run test:browser  # Chromium at 1440 and 390: setup, garage, every mode on your bike, pause,
                      # leaving, reload, the export code, the camera through URL-bar resizes;
                      # online: four pages in one room (a stand-in room server), race, jam, Big Air
node tests/golden.browser.mjs --serve  # the golden hashes on a phone: open the URL it prints (MATCH)
npm run test:net      # online on phone links (60–150 ms round trips, jitter, spikes): key → screen,
                      # stalls, frame rate, every screen byte for byte (--net lockstep: the before)
npm run site:build    # the site (landing + /play/) into artifacts/pages
npm run test:site     # the site at 1440 and 390, light and dark
node scripts/shots.mjs  # the hero's still poster and the share image, from the game
```

How the pieces fit (the mode interface, the bike and `tune()`, the economy file, adding a map or a
mode): [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). CHROMIUM_PATH points the tests at a Chromium of
your own.

Custom domain: `pages.yml` builds with `SITE_URL=https://holeshot.domvirus.com` and `SITE_BASE=/`
(repo variables override) and writes the `CNAME` from it.

## Licence

MIT © Chris Cooley / coded.design
