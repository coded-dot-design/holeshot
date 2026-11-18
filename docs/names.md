# Bike names: three tiers

Every maker, model and maker paint in Holeshot has one id and three display names. The ids
(`yamada`, `buzzline`, `f-yamada`, …) never change: saves, export codes and the online hello carry
ids, so a player's garage is the same in every tier. Only the names a player reads change. Logos,
badges and art are our own in every tier.

| Tier | What it is | When it is OK | How it is chosen |
|---|---|---|---|
| **REAL** | The real makers and models the roster nods to. | Private testing only (a link shared with family and friends). Revisit before any wider promotion. | `?names=real` on the page, or `?money=inf` (the test-credits link). Never the default, never saved: drop the parameter and the build's names are back. Not in a SAFE build at all. |
| **NOD** (default) | Near-names: each a nod by sound, meaning and colour, never the real name, model code or logo. | The public web (the default build, the site). | The default build (`npm run build`). |
| **SAFE** | Fully original names. | App stores, and anywhere trademark-sensitive. | `HOLESHOT_NAMES=safe npm run build`: the REAL and NOD tables are left out of the bundle entirely. |

Where the names live: `src/data/roster.ts` and `src/data/looks.ts` hold the SAFE names (the data's
own); `src/data/names/nod.ts` and `src/data/names/real.ts` hold the other two, keyed by id;
`src/data/names.ts` picks the tier and dresses the data. A class's maker line (the garage's class
heading, the site's card) is built from its models' makers in the tier shown. Maker mottos and model
blurbs are the same in every tier and name no maker (no "Sting": that is a real e-moto's name).

## A trademark complaint: ship SAFE fast

1. `HOLESHOT_NAMES=safe npm run build` (writes `dist/` with SAFE names; about a second after the
   typecheck). To build somewhere else: `HOLESHOT_OUT=<dir>`.
2. Check it: `node --test tests/names.test.mjs` (its last test builds SAFE into a scratch directory
   and fails on any REAL or NOD name in the bundle), or grep the bundle for the name in question.
3. Commit that `dist/` and release as usual. To drop just one name instead, change that row in
   `src/data/names/nod.ts` (and this table: the test checks every name here) and rebuild.

The ids are internal and stay in every build (some of them are older nod-style words: `yamada`,
`hondo`, `kawazakura`, `starkwolf`, `makfox`); they are never shown.

## The table

Owner-approved 2026-11-18. Not checked: trademark registers. Search a NOD name as a bike or vehicle
mark before any wider promotion.

### Makers

| id | REAL | NOD (default) | SAFE |
|---|---|---|---|
| `yamada` | YAMAHA | YAMORI | BLUEWAKE |
| `hondo` | HONDA | HONZO | EMBERLINE |
| `kawazakura` | KAWASAKI | KAWAZAKURA | LIMEJET |
| `starkwolf` | STARK | STARHOWL | VOLTHOWL |
| `surgeon` | SUR-RON | SURGE-ON | BUZZWORKS |
| `makfox` | MACFOX | MACVIX | TRAILKIT |
| `curbcat` | HONDA | HONZO | EMBERLINE |
| `nightglass` | YAMAHA | YAMORI | BLUEWAKE |
| `ironjaw` | DUCATI | DUCELLI | IRONJAW |

### Bikes (maker + model, as the garage shows them)

| id | class | REAL | NOD (default) | SAFE |
|---|---|---|---|---|
| `buzzline` | 2-STROKE | YAMAHA YZ125 | YAMORI YOWLER 125 2T | BLUEWAKE RIPPER 125 |
| `razorhive` | 2-STROKE | KAWASAKI KX 2-STROKE | KAWAZAKURA KRAKEN JR 150 2T | LIMEJET SPRITE 150 |
| `nectar-burn` | 2-STROKE | YAMAHA YZ 2-STROKE | YAMORI YOWLER 200 2T | BLUEWAKE RIPPER 200 |
| `hivequeen` | 2-STROKE | YAMAHA YZ250 | YAMORI YOWLER 250 2T | BLUEWAKE RIPPER 250 |
| `anvil` | 4-STROKE | HONDA CRF150R | HONZO CRIMSON 150F | EMBERLINE BLAZE 150 |
| `forgeback` | 4-STROKE | HONDA CRF250R | HONZO CRIMSON 250F | EMBERLINE BLAZE 250 |
| `slag-ox` | 4-STROKE | KAWASAKI KX450 | KAWAZAKURA KRAKEN 450F | LIMEJET BRUTE 450 |
| `bulkhead` | 4-STROKE | HONDA CRF450R WORKS EDITION | HONZO CRIMSON 450 FACTORY | EMBERLINE BLAZE 450 PRO |
| `glidewire` | E-BIKE | MACFOX KIT FOX | MACVIX KIT FOX | TRAILKIT CUB |
| `pulse-pedal` | E-BIKE | MACFOX RED FOX | MACVIX RED FOX | TRAILKIT RED |
| `arclight` | E-BIKE | MACFOX ARCTIC FOX | MACVIX ARCTIC FOX | TRAILKIT FROST |
| `nightloop` | E-BIKE | MACFOX SILVER FOX | MACVIX SILVER FOX | TRAILKIT SILVER |
| `sparkhound` | ELECTRIC DIRT | SUR-RON LIGHT BEE | SURGE-ON LIGHT BUZZ | BUZZWORKS DART |
| `gridrat` | ELECTRIC DIRT | SUR-RON ULTRA BEE | SURGE-ON ULTRA BUZZ | BUZZWORKS DART MAX |
| `overcharge` | ELECTRIC DIRT | STARK VARG MX | STARHOWL GREYWOLF MX | VOLTHOWL GREYWOLF |
| `feral-coil` | ELECTRIC DIRT | STARK VARG ALPHA | STARHOWL ALPHA WOLF | VOLTHOWL ALPHA |
| `curb-pup` | STREET | HONDA GROM | HONZO GROWL 125 | EMBERLINE BLOCK PUP 125 |
| `tidebreaker` | STREET | YAMAHA R6 | YAMORI RIPTIDE 600 | BLUEWAKE TIDEBREAKER 600 |
| `bare-knuckle` | STREET | DUCATI STREETFIGHTER V4 | DUCELLI STRIKER V4 | IRONJAW BARE KNUCKLE V4 |

### Factory paints

| id | REAL | NOD (default) | SAFE |
|---|---|---|---|
| `f-yamada` | YAMAHA BLUE | YAMORI BLUE | BLUEWAKE BLUE |
| `f-hondo` | HONDA RED | HONZO RED | EMBERLINE RED |
| `f-kawazakura` | KAWASAKI GREEN | KAWAZAKURA LIME | LIMEJET LIME |
| `f-starkwolf` | STARK GREY | STARHOWL GREY | VOLTHOWL GREY |
| `f-surgeon` | SUR-RON BLACK | SURGE-ON BUZZ | BUZZWORKS BLACK |
| `f-makfox` | MACFOX ORANGE | MACVIX ORANGE | TRAILKIT ORANGE |
| `f-curbcat` | HONDA STREET RED | HONZO STREET RED | EMBERLINE STREET RED |
| `f-nightglass` | YAMAHA STREET BLUE | YAMORI STREET BLUE | BLUEWAKE STREET BLUE |
| `f-ironjaw` | DUCATI RED | DUCELLI RED | IRONJAW RED |

