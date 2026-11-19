// Holeshot's showroom: the shop's catalogue + compare screen (../../vendor/shop/) fed with the
// game's bikes. Every number is the game's: the price and tier from the roster (../data/roster.ts),
// Pull / Top / Light from the tuned bike's feel (../model/tune.ts), 0–30 / 0–60 and the top speed
// from the pace measured on the sim (../model/pace.ts, 0–50 / 0–100 km/h in Metric), the trade-in
// value and the unlocks from ../model/garage.ts. The thumbnails are stills from the game's own rig
// (./snap.ts). The shell gives the state and the actions through `ShowroomApi`.
import { CLASSES, MODELS, makerOf, model as modelOf, type Model } from "../data/roster.ts";
import { UNLOCK } from "../data/economy.ts";
import { newBike, riding, type Profile } from "../model/profile.ts";
import { tune } from "../model/tune.ts";
import { paceOf } from "../model/families.ts";
import { perHour } from "../model/units.ts";
import { baysOf, tradeValue, unlocked, type Buy } from "../model/garage.ts";
import { catalogueState, mountCatalogue, type CatalogueItem, type CatalogueSlot, type CatalogueState, type StatDef } from "../../vendor/shop/shop.js";
import { snap } from "./snap.ts";

/** What the showroom needs from the shell. */
export interface ShowroomApi {
  /** The profile now (bikes, bays, credits, units, progress). */
  profile(): Profile;
  /** Test credits: every bike for sale, unlocks or not. */
  all?: boolean;
  /** Night (dark) or day: the thumbnails' metal. */
  night(): boolean;
  /** Buy model `id` into bay `bay` (0-based; a bay with a bike trades it in): the shell applies the
   *  result (../model/garage.ts `buyInto`), saves, says it, and redraws. */
  buy(id: string, bay: number): Buy;
  /** The turntable: put the shell's preview into `host` showing model `id`, new. */
  turntable(host: HTMLElement, id: string): void;
  /** Called with a redraw to run whenever the profile changes; returns the unsubscribe. */
  onChange?(redraw: () => void): () => void;
  say?(s: string): void;
}

const per = (u: "imperial" | "metric") => perHour(1, u);
/** The pace tiles in the rider's units (the garage's own measure: ../model/pace.ts). */
export const paceStats = (u: "imperial" | "metric"): StatDef[] => u === "metric"
  ? [{ key: "a", label: "0–50 KM/H", short: "0–50 km/h", better: "low", unit: "s", digits: 2 }, { key: "b", label: "0–100 KM/H", short: "0–100 km/h", better: "low", unit: "s", digits: 2 }, { key: "top", label: "TOP SPEED", short: "Top speed", better: "high", unit: "km/h", digits: 0 }]
  : [{ key: "a", label: "0–30 MPH", short: "0–30 mph", better: "low", unit: "s", digits: 2 }, { key: "b", label: "0–60 MPH", short: "0–60 mph", better: "low", unit: "s", digits: 2 }, { key: "top", label: "TOP SPEED", short: "Top speed", better: "high", unit: "mph", digits: 0 }];
/** A tuned bike's pace as the tiles' numbers. */
function pace(t: ReturnType<typeof tune>, u: "imperial" | "metric") {
  const p = paceOf(t);
  return u === "metric" ? { a: p.k50, b: p.k100, top: Math.round(p.ups * per("metric")) } : { a: p.t30, b: p.t60, top: Math.round(p.ups * per("imperial")) };
}
/** A model as a catalogue card: new, stock. */
export function itemOf(m: Model, p: Profile, night: boolean): CatalogueItem {
  const t = tune(newBike(m.id, "sr")), u = p.settings.units ?? "imperial";
  return {
    id: m.id, brand: makerOf(m).name, type: CLASSES[m.cls].name, name: m.name, full: `${makerOf(m).name} ${m.name}`,
    tier: m.tier, tierMax: 4, price: m.price, blurb: m.blurb,
    bars: [{ label: "Pull", v: t.feel.pull }, { label: "Top", v: t.feel.top }, { label: "Light", v: t.feel.light, tone: "b" }],
    stats: pace(t, u), thumb: () => snap(m.id, p, night),
  };
}

export const showroomState = catalogueState;
/** Mount the showroom in `host` (the state `st` kept by the shell across redraws). */
export function mountShowroom(host: HTMLElement, api: ShowroomApi, st: CatalogueState = catalogueState()) {
  const P = () => api.profile(), units = () => P().settings.units ?? "imperial";
  const slots = (): CatalogueSlot[] => {
    const p = P(), B = baysOf(p), first = B.find((b) => !b.bike);
    // Bikes fill the bays in order: the first empty bay, then each bike's bay (a trade-in).
    return B.filter((b) => b.bike || b === first).map((b) => ({ index: b.index, label: `Bay ${b.index + 1}`, ...(b.bike ? { holds: `${modelOf(b.bike.model).name} #${b.bike.look.number}`, credit: tradeValue(b.bike) } : {}) }));
  };
  const view = mountCatalogue(host, {
    items: () => MODELS.map((m) => itemOf(m, P(), api.night())),
    filters: [{ key: "type", all: "All types" }, { key: "brand", all: "All brands" }],
    stats: () => paceStats(units()),
    credits: () => P().credits,
    current: () => { const p = P(), b = riding(p), m = modelOf(b.model); return { name: `${makerOf(m).name} ${m.name} #${b.look.number}`, stats: pace(tune(b), units()) }; },
    slots,
    offer: (it, s) => {
      const p = P(), m = modelOf(it.id), u = UNLOCK[m.tier];
      return { cost: Math.max(0, it.price - (s.credit ?? 0)), locked: api.all || unlocked(p, m) ? undefined : `Opens after ${u!.events} events or ${u!.earned.toLocaleString("en-US")} credits earned` };
    },
    buy: (it, s) => { const r = api.buy(it.id, s.index); return r.ok ? null : r.why; },
    preview: (h, it) => api.turntable(h, it.id),
    page: 4,
    say: api.say,
  }, st);
  const off = api.onChange?.(view.update);
  return { ...view, destroy: () => (off?.(), view.destroy()) };
}
