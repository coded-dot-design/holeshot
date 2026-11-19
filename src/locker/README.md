# locker: the customise / store / upgrade / compare template

The locker is the screen pattern a game reuses when the player owns a thing (a bike, a tank, a
character), dresses it, keeps it running, upgrades it and shops for another. It is game-agnostic:
nothing in `src/locker/` imports the game. HOLESHOT's garage and showroom are the first users; the
plan is to lift it into a Fizlet brick once a second game uses it.

| File | What |
|---|---|
| `ui.ts` | the pieces, as small HTML-string functions: card, heading, seg toggle, underline tabs, stat tile + row, meter, bar row + bars, feel bars, price key, plain key, "N more credits needed", popover menu, dropdown key, check toggle, sheet (popover on desktop, bottom sheet on phones), list row, table, grid tile + swatch + grid, chips, title (eyebrow, name, #number), turntable frame with ‹ ›, CTA, stars, pill, foot bar |
| `flow.ts` | the flows, data in: `itemGrid` (slots → paged grid → preview → buy / cancel), `condition` (wear rows with price keys), `upgrades` (list + preview with before → after stats), `baysSheet` (owned list, bays, expansion), `compare` |
| `ui.css` | the tokens (on `.lk`) and every piece's style; layout is the game's |

## The contract

- **The game owns state and rules.** The locker renders what it is given and never decides a price,
  an unlock or what is owned.
- **Actions are attributes.** Every key takes `attrs` (raw attribute text, e.g.
  `data-dress="paint" data-id="magma"`); the game's one click handler routes on them. Preview on
  hover/focus works the same way: the game reads its own attribute off the element under the pointer.
- **Words come in.** Labels, counts and copy are arguments; `COPY` in `flow.ts` holds the few words
  the flows add themselves ("credits", "Equipped", "Cancel", "Buy", …) and a game passes its own.
- **Theme through CSS variables.** Add class `lk` to the screen's root. Dark is the default; light
  applies under any ancestor with `[data-theme=light]` or `[data-day]`, or with `.lk-light`. A game
  re-points tokens in its own sheet: `.mygame .lk{--lk-bar:var(--my-teal);--lk-price:var(--my-pink)}`.
  Tokens: `--lk-bg --lk-panel --lk-tile --lk-line --lk-line2 --lk-go --lk-go-ink --lk-soft
  --lk-soft-ink --lk-bar --lk-track --lk-price --lk-warn --lk-ink --lk-mute --lk-off --lk-drop --lk-r --lk-mono`.
- **The stage is yours.** `turntable(inner)` frames whatever the game draws (a canvas slot, a
  diorama); its ‹ › keys carry `data-turn="-1|1"`.
- **Pay for what you use.** Import single pieces; each flow is its own export. Measured
  (esbuild --minify, gzip -9): all of `flow.ts` + `ui.ts` 2,758 B, `ui.css` 3,240 B.

## The shapes (from `flow.ts`)

```ts
interface Item { id; name; art /* HTML */; price; owned?; equipped?; attrs }
interface Slot { id; name; meta /* "22 schemes" */; attrs }
interface Wear { label; sub?; v /* 0..1 */; state? /* worn|risk|failed */; key: { label; price?; done? /* "At 100%" */; attrs } }
interface Upgrade { id; name; state /* "Stage 1 fitted" */; price?; attrs }
interface Bay { label /* "Bay 1" */; name?; on?; end /* HTML: a key or "RIDES NEXT" */; attrs? }
```

## Plugging in another game (a tank game)

```ts
import { itemGrid, condition, upgrades, baysSheet } from "../locker/flow.ts";
import { swatch, turntable, title, stats, stat, cta } from "../locker/ui.ts";

const camo = (t: Tank, ui: UI) => itemGrid({
  title: "Hull camo", count: `${CAMOS.length} schemes`, items: CAMOS.map((c) => ({
    id: c.id, name: c.name, art: swatch(c.a, c.b), price: c.cost, owned: t.owned.has(c.id),
    equipped: t.camo === c.id, attrs: `data-camo="${c.id}"`,
  })), page: ui.page, per: 12, cols: 4, pageAttrs: (p) => `data-page="${p}"`, pageWord: "schemes",
  trying: ui.trying, credits: save.gold, cancelAttrs: "data-untry", buyAttrs: "data-buytrial",
  copy: { ...COPY, credits: "gold" },
});
const tracks = (t: Tank) => condition([
  { label: "Tracks", v: t.wear.tracks, key: { label: "Re-link", price: 90, attrs: 'data-fix="tracks"' } },
  { label: "Turret ring", v: t.wear.ring, key: { label: "Grease", price: 40, attrs: 'data-fix="ring"' } },
], save.gold, ["Component", "Condition"]);
```

A character game maps the same way: slots are hair / top / boots, items are outfits, `condition`
becomes stamina or armour, `upgrades` are skills, the bays are the roster. Wrap the screen in
`<div class="lk">`, lay the pieces out in your grid, and route the attributes in your click handler.
