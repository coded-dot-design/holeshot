# Holeshot

**One bike. Every kind of dirt.** A dirt bike game on a tabletop: pick one bike, race it, fly it,
wheelie it through town, and keep it alive in the garage with what you win. Tyres, rebuilds, mods,
paint and a rider kit. Neon at night, pastel by day.

By [Chris Cooley](https://coded.design/) · built on [Fizlet](https://github.com/coded-dot-design/fizlet) · MIT

- **Play:** https://holeshot.domvirus.com/play/
- **About:** https://holeshot.domvirus.com/

Holeshot grew out of three pieces in Fizlet's Daily (Moto Track, Big Air and Wheelie City), which
shared one bike. Now they share one garage.

## The game

**Your bike.** At the first run you pick one starter, the cheapest of each class: the **YAMADA
YX-125 2T** (a blue 2-stroke: light, little down low, a hard hit up top), the **HONDO REDLINE 150F**
(a red 4-stroke: heavy and torquey, slow to rotate), the **MAKFOX KIT FOX** (an orange e-bike:
light, quick to lift) or the **SURGE-ON LIGHT HORNET** (a light electric dirt bike: every newton at
once). Six makers in all (YAMADA, HONDO, KAWAZAKURA, STARKWOLF, SURGE-ON, MAKFOX), our own names. Paint it, number it,
pick your jersey and a name. That bike rides every event.

**Events** (RIDE on the menu), all on your bike:

- **Race**: the gate, three laps of the Neon Loop (bermed turns, a rhythm section, whoops, a triple,
  the finish tabletop) against three rivals on stock bikes of your class. Places pay.
- **Free Ride**: five maps to yourself (the Neon Loop, Dune Sea, the Quarry, Forest Enduro, Night
  Park), no laps, no clock; END banks the session (a little pay for saddle time, air, wheelies and
  tricks).
- **Big Air**: a minute in the arena, two steel kickers. Hold TRICK in the air and the stick picks
  one of four tricks; weight all the way back flips it. Five judges score the run and pay.
- **Wheelie City**: a minute on the block: wheelies, manuals, hops and stoppies, bonuses across
  crosswalks, through sprinklers and past a neighbour shaking a fist. Points pay.
- **Series**: three championship tiers (ROOKIE CUP, PRO CIRCUIT, NEON MASTERS) of four to six
  rounds; every round is a new generated track, harder round by round, against named rivals on
  modded bikes; points, prizes and a title bonus.

- **Online**: up to four riders, each on their own garage bike (its mods, its wear, its paint and
  your kit travel to every screen). The host picks a **race** on a new generated track (ROOKIE, PRO
  or MASTERS; AI rivals fill the empty places), a **Free Ride jam** on any of the five maps (most
  trick points in three minutes wins), or a **Big Air** or **Wheelie City** head-to-head (everyone
  rides their own minute; the best score wins). HOST, pick, 2 / 3 / 4, SEND LINK: the link drops a
  friend straight into the room. Your bike answers your keys at once on a phone's network (each
  screen runs ahead on a guess of the others' inputs and quietly corrects). RIDE AGAIN starts the next
  ride for the whole room; a rider who leaves is ridden by the AI. Online pays more: your own
  profile gets the payout and the wear for your own result, ×1.5, plus 75 for each rider you beat;
  the extra halves after six online rides in an hour (no farming).

**The garage.** Every event wears the bike: tyres lose grip, the chain stretches, a 2-stroke's top
end (or a 4-stroke's engine, or a battery) loses pull, seals blow and it cases sooner, brakes fade.
Condition bars show it; you feel it on the track. Buy new tyres, rebuild the motor, service the rest;
add mods (exhaust or controller, short gearing, suspension); buy another bike (the garage holds
three, each keeps its own parts, mods and paint) and pick which one rides; change the paint, the
number and the rider kit (helmet shape and paint, visor, jersey, pattern, pants, boots, gloves). A
2-stroke rebuilds cheap and often, a 4-stroke rarely and dear. Nobody gets stuck: every finished
event pays something, a worn bike still rides, and the pit crew fixes you up for free when you've
ridden a few events and can't pay.

**Controls.** Space or J gas, K or Shift brake, W/S or ↑/↓ your weight (back lifts the front; in the
air it pitches the bike), A/D or ←/→ steer, L trick (Big Air) or hop (Wheelie City), V camera, M
sound, P or Escape pause. A mouse: hold the track for gas, drag to steer and lean. Phones: the stick
under the left thumb leans and steers, GAS and BRAKE (and TRICK or HOP) under the right. A gamepad
works too. The look follows the page's `<html data-theme>`.

**Camera.** The chase camera's framing is set once at the start of an event and never zooms: not
with speed, not in the air. Resizes are debounced and only a change of width refits the framing; a
phone's address bar coming and going (a height-only resize) never moves the camera. The play
surface, the canvas and the pad are `touch-action: none`, so no pinch or double-tap zooms the page.

**Saving.** Your profile lives on the device (localStorage, a versioned schema). SETTINGS shows an
export code to carry it to another device (paste it into IMPORT there). No accounts.

## As a module

```js
import { createHoleshot } from "./dist/holeshot.mjs";
const game = createHoleshot({ host: document.querySelector("#stage") }); // setup or the menu
game.start("race");                         // or "freeride", "bigair", "wheelie"
createHoleshot({ host, attract: true });     // the landing hero: a race on the autopilot
createHoleshot();                            // a layer over the whole page; Escape gives it back
```

**Online play** needs a fizlet-rooms server (the same one Dune Hop uses): the play page passes
`ROOMS_URL` (a repo variable, built in as `PUBLIC_ROOMS_URL`; default
`wss://fizlet-rooms.fizlet.workers.dev`), and `?rooms=wss://…` on the page overrides it. The server
must list the site's origin (https://holeshot.domvirus.com) in its `ALLOWED_ORIGINS`. An invite code
gets you in. `createHoleshot({ rooms })` takes the URL when you mount the game yourself.

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
