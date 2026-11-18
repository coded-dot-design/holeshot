// NOD names (the default web build): recognisable near-names, each a nod by sound, meaning and colour
// to a maker riders love, never the real name, model code or logo. Owner-approved 2026-11-18;
// the table with all three tiers: docs/names.md. Keyed by the data's ids (../roster.ts, ../looks.ts).
import type { NameSet } from "../names.ts";

export const NOD: NameSet = {
  makers: {
    yamada: { name: "YAMORI" }, hondo: { name: "HONZO" }, kawazakura: { name: "KAWAZAKURA" }, starkwolf: { name: "STARHOWL" },
    surgeon: { name: "SURGE-ON" }, makfox: { name: "MACVIX" }, curbcat: { name: "HONZO" }, nightglass: { name: "YAMORI" }, ironjaw: { name: "DUCELLI" },
  },
  models: {
    buzzline: { name: "YOWLER 125 2T" }, razorhive: { name: "KRAKEN JR 150 2T" }, "nectar-burn": { name: "YOWLER 200 2T" }, hivequeen: { name: "YOWLER 250 2T" },
    anvil: { name: "CRIMSON 150F" }, forgeback: { name: "CRIMSON 250F" }, "slag-ox": { name: "KRAKEN 450F" }, bulkhead: { name: "CRIMSON 450 FACTORY" },
    glidewire: { name: "KIT FOX" }, "pulse-pedal": { name: "RED FOX" }, arclight: { name: "ARCTIC FOX" }, nightloop: { name: "SILVER FOX" },
    sparkhound: { name: "LIGHT BUZZ" }, gridrat: { name: "ULTRA BUZZ" }, overcharge: { name: "GREYWOLF MX" }, "feral-coil": { name: "ALPHA WOLF" },
    "curb-pup": { name: "GROWL 125" }, tidebreaker: { name: "RIPTIDE 600" }, "bare-knuckle": { name: "STRIKER V4" },
  },
  paints: {
    "f-yamada": { name: "YAMORI BLUE" }, "f-hondo": { name: "HONZO RED" }, "f-kawazakura": { name: "KAWAZAKURA LIME" }, "f-starkwolf": { name: "STARHOWL GREY" },
    "f-surgeon": { name: "SURGE-ON BUZZ" }, "f-makfox": { name: "MACVIX ORANGE" }, "f-curbcat": { name: "HONZO STREET RED" }, "f-nightglass": { name: "YAMORI STREET BLUE" },
    "f-ironjaw": { name: "DUCELLI RED" },
  },
};
