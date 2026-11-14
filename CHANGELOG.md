# Changelog

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
