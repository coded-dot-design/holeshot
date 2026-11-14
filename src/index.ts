// Dirt Hop: one dirt bike, one garage, every kind of riding, on a tabletop. Built on Fizlet, by Chris Cooley.
//   createDirtHop({ host })                 mount in an element (the play page)
//   createDirtHop({ host, attract: true })  the landing hero: a race on the autopilot
//   createDirtHop()                         a layer over the whole page; Escape gives the page back
export { createDirtHop, lookOf, type DirtHop, type DirtHopOptions } from "./game.ts";
export { MODES } from "./modes/index.ts";
export { MODELS, CLASSES, STARTERS } from "./data/roster.ts";
