# Changelog

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
