// Holeshot: one dirt bike, one garage, every kind of riding, on a tabletop. Built on Fizlet, by Chris Cooley.
//   createHoleshot({ host })                 mount in an element (the play page)
//   createHoleshot({ host, attract: true })  the landing hero: a race on the autopilot
//   createHoleshot()                         a layer over the whole page; Escape gives the page back
export { createHoleshot, lookOf, type Holeshot, type HoleshotOptions } from "./game.ts";
export { MODES } from "./modes/index.ts";
export { MODELS, CLASSES, STARTERS } from "./data/roster.ts";
