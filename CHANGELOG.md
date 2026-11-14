# Changelog

## Unreleased

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
