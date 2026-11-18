// REAL names: the real makers and models the roster nods to. Shown only with `?names=real` or
// `?money=inf` on the page (the owner's private family test link), never the default, never saved
// (../names.ts tierFor), and stripped from a SAFE build. Logos and art stay our own in every tier.
// Revisit before any wider promotion: docs/names.md.
import type { NameSet } from "../names.ts";

export const REAL: NameSet = {
  makers: {
    yamada: { name: "YAMAHA" }, hondo: { name: "HONDA" }, kawazakura: { name: "KAWASAKI" }, starkwolf: { name: "STARK" },
    surgeon: { name: "SUR-RON" }, makfox: { name: "MACFOX" }, curbcat: { name: "HONDA" }, nightglass: { name: "YAMAHA" }, ironjaw: { name: "DUCATI" },
  },
  models: {
    buzzline: { name: "YZ125" }, razorhive: { name: "KX 2-STROKE" }, "nectar-burn": { name: "YZ 2-STROKE" }, hivequeen: { name: "YZ250" },
    anvil: { name: "CRF150R" }, forgeback: { name: "CRF250R" }, "slag-ox": { name: "KX450" }, bulkhead: { name: "CRF450R WORKS EDITION" },
    glidewire: { name: "KIT FOX" }, "pulse-pedal": { name: "RED FOX" }, arclight: { name: "ARCTIC FOX" }, nightloop: { name: "SILVER FOX" },
    sparkhound: { name: "LIGHT BEE" }, gridrat: { name: "ULTRA BEE" }, overcharge: { name: "VARG MX" }, "feral-coil": { name: "VARG ALPHA" },
    "curb-pup": { name: "GROM" }, tidebreaker: { name: "R6" }, "bare-knuckle": { name: "STREETFIGHTER V4" },
  },
  paints: {
    "f-yamada": { name: "YAMAHA BLUE" }, "f-hondo": { name: "HONDA RED" }, "f-kawazakura": { name: "KAWASAKI GREEN" }, "f-starkwolf": { name: "STARK GREY" },
    "f-surgeon": { name: "SUR-RON BLACK" }, "f-makfox": { name: "MACFOX ORANGE" }, "f-curbcat": { name: "HONDA STREET RED" }, "f-nightglass": { name: "YAMAHA STREET BLUE" },
    "f-ironjaw": { name: "DUCATI RED" },
  },
};
