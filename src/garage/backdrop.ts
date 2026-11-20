// The turntable's backdrops, redrawn in code from the owner's two carousel designs (1200 × 840 art,
// the spec; the references sit in tests/fixtures/ for the fidelity test, never shipped). Two layers:
// the BACKGROUND (this file's scenes: flat shapes painted once per scene and size into a canvas of
// its own, laid under the bike in a fixed cluster: a redraw costs one drawImage) and the CAROUSEL
// (`plinth`: a 3D disc in the turntable's diorama, so it turns under the bike), both seen by ONE
// fixed camera (`camOf`) that puts the disc exactly where the art draws it. No zoom, no change of
// perspective on any tab; the art is fitted to the frame (`fitOf`) so the disc and the bike always
// show whole.
// TRACK (day): a light sky, soft green hills, a faceted field, the dirt track with its cream edge and
// tabletops, three marker poles, the orange boundary line; an orange disc on a cream ring.
// SUNSET (night): banded sky, a few stars, the striped sun upper right behind two mountain ranges, a
// pink horizon line, the dark floor with its cyan line; a violet disc on a cyan rim.
// One entry per scene in `BACKDROPS`: its palette as data and one paint function in the art's own
// coordinates (1200 × 840). Repaint a scene by editing its entry. AUTO follows Day / Night.

/** The art's size and its disc (the carousel's top): centre, half width, half height, in art px. */
const AW = 1200, AH = 840, DX = 596.5, DY = 611, DA = 526.5, DB = 86.5;
/** The carousel: one radius; the side's and the ring's heights (solved once against the art). */
const R = 2;

/** One backdrop: its key, its name on the picker, the colour past the art's edges (the turntable's
 *  clear colour), its carousel (top, side, ring; a glowing ring by night) and its paint function. */
export interface Backdrop { id: string; name: string; sky: string; ground: string; disc: { top: string; side: string; ring: string; glow: boolean }; paint: (c: CanvasRenderingContext2D) => void }

type Pt = readonly [number, number];
/** A filled polygon in art px. Where it runs along the art's left, right or bottom edge it runs on
 *  past it (a frame wider or taller than the art sees more of the same). */
const poly = (c: CanvasRenderingContext2D, color: string, P: readonly Pt[]) => {
  const out = (x: number, y: number): Pt => [x < 2 ? -4e3 : x > AW - 3 ? AW + 4e3 : x, y > AH - 3 ? AH + 4e3 : y];
  const edge = (p: Pt) => p[0] < 2 || p[0] > AW - 3 || p[1] > AH - 3;
  c.fillStyle = color;
  c.beginPath();
  P.forEach((p, i) => {
    const q = P[(i + 1) % P.length]!;
    c.lineTo(p[0], p[1]);
    if (edge(p) && edge(q)) c.lineTo(...out(...p)), c.lineTo(...out(...q));
  });
  c.fill();
};
/** A band across the whole width (and past it), y0 to y1. */
const band = (c: CanvasRenderingContext2D, color: string, y0: number, y1: number) => ((c.fillStyle = color), c.fillRect(-4e3, y0, AW + 8e3, y1 - y0));

// The day field, traced from the art: a palette and polygons, each a palette index then x, y pairs
// in two base-64 digits (art px), the biggest first.
const B64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
const DAY_PAL = ["#76bf84", "#ecedd5", "#ccaf81", "#f4884a", "#83cc90", "#79c48f"];
const DAY_FIELD = "0Il5QID5VGo6BGk67FJ6BEp6KC76N6Q7760741R7P1M7K127O0-7a0r7O0Y7O0V7A0c74076r006_007G047I007R0A7S067f097o007s009F049I009O00D7IlD7Il9mId9lId9XIl9UIl8dG_8GDZ7j8_7aBG7CFF7JHe75Il7K 5Il2oHj2-H02tFp2XEM2dCm2dBO2y9s2r8t367i2z6z385m2p4O2k2-301d2n06360034003k0_3q1A3v0342054A0H430M4B0b4B0t4T0W4T0M4O0C4X0G4j0L4l0v4c104P0v4O0t4I0-4715471E4F1F4O144P1E4U1P4N2M4G2V432V3V2P3P2V3E2g3J2b3V2c3j2g3f353d3E3n3E3c443W4R3Z4P3e4L3b4O3g4J3p3P3p3L3w3O4A3T4B3a473y4A4L484Q434a454d414V3-4Q3q4U3k503n5E3c553Y5B3U763U783M733D77387H3B7H3Z7K3U7l3S7o3X7q3S9E3P9V3R9W3Z9Q3Z9O3U9C3V913b933f9B3i973a9H3Z9f3m9V3b9c3V9r3ZA93UA83OAY3OAT3UAT3mAJ3rAE3mA43oBd3xBp3uBC3pB13aAj3PBm3FDD3LDH3GDs3AED3FEU37EW3NEX30ET2uEX2qEg2vEd3IEf3AEz34FN36Fe2_Go2-HF3GIZ3GIl3D 5Il41Ig3yIi3tGH3vG440G23wFO3wDX3jDG3qDW3rDb3xDY43584i3t4r3S4z3b5447596d4v7K4k8O4eAV4cB-4NEN4DEQ49FL4BFT47FY4CFk4CFt47F-4DG047G547G94DHi4J9d5L7V5H6W5O6V5R7U5W7j5R7v5b7j5l7d5e7L5d6F5o705s9M5sBS5mFD5OIA4uIl4k 2Hx3bHa3cGo36Fi36FS3CEz3ZDY3dCv3uCF3-A5449X3s7s3u7E3-6k3m5F3n4X4G224T114m0V550M500O560H5B0A540E4_0657175N3b5h585p5L5l6l5i715e6w5a6I5a3i5G2_572s4z3B4p4E4eDS3yDU3tD93vDB3pDm3d 4Hh4JGI4CEQ4AEN4EB-4OAh4c8O4f7K4l6V4x3x586O5R7V5G9d5K 4Il4xEN5kB85-7o648F678X6E8f6B8o6N906Q916a9P6R9T6f9O6hCK6LEp6JFJ6AGp68ID5UIl5P 4Il8cIi8KI28MHu8EI67_Il7_Il7qIh7nIl7hIl7LHr79Hx7CHr7KHO7SHM7EHf7EHj77FF7KBG7D907YDZ7iGV8BGY80Ga8C 0006j1K6a4F6R7h654q5y305n245o0062 45_74486S1K6b006k0H6v1U7O 59S6f9P6S916b8_6Q8o6O8f6C8X6F7t65496S5-736O76 3Il4mI24yG85EEc5YCB5m945w585q1z5W0K5E0157005H1n5d495t7o639o61Eg5hIC53Il4w 1DZ3xDV3uDO3-4E4f3B4q2w4w2t503A59485J7f5e7r5Z4R5E3a563E4z4f4jC84ADW40 5FH8UGa8oH88_HX9EHi9WHiArHmAwHXBMHvBBI9AyIBAYI7ATIFALIB9wIE9tIU9zIZ9vIN9sIV9bIT9QI29GHv96Ho98He90Gs8m 10B540H5A0N560M4_0V54114l224S4X4F5F3m6k3l7E3z7s3t9X3rA543CF3xA3409Y3l9E3j803l7G3u6l3e5J3e4T492B4I0g4k0H4y 4Il3XHe3WHx3aHx3eDm3eDM3kD93uDR3rDZ3vDa3_DW3sDF3qDX3iG43xIX3qIk3t 4005I0061245n2l5n 0EW3VEU38ED3GDs3BDH3HDD3MCv3JCQ3OCe3YCW3eCg3fCv3eD63RDI3RDR3Z 0CP3dC83XCN3MCF3SBw3OBY3VBR3QAk3PB13ZB83jBP3eBT3i 44R3b4N3X3E3d3B3i353e2d3h2e4F324D2e4E2i3l3N3q4K3p 1Hg3ZHS3VH238Go30Fj30FN37F03QEl3XDZ3XCr3tDY3cEz3YFS3BFi35Go35G_3AHN3VHa3b 0Il3WIl3EHF3HHL3NHX3MHa3X 00v3b0_3j1E3n1G3x193z1N3x1Q3p1b3t1d3p1Y3k1g3h1o3p1z3p293x2D462S3-2P3i1n3k1h3f 0763V5N3U563Y5D3Z5F3f5M3Z5l3e6f3b6x3k743g 0AY3PA83PA93V9r3a9k3W9W3a9T3U9P3X9k3p9w3lAL3oAV3jAS3U 41-4L1P4O1H4V114Q0v4d0L4m0F4j0D4W014W005605570g4j 5Hv8DI28LIl8LIl80IH7zI680 4DH3cCe3fD33iCn3sCM3rC13lC13hB73lBq3uBe3xCl3u 02h3n2l3s2h3-2m402h462x4335493N4A3L3p 07G3l7X3q7-3m8A3b8K3b7K3V 00041004J074L034W0E4V0M4N0W4S0p4Q0b4C0M4C09400C45054B 50Y6_0d750W7A0W7L0r7N0x7Z127N1J7L 4003l0241193v 5Bx3gCH3mCK3rCn3rD23kCW3fCd3YCQ3NCL3SCE3NC83PCH3UC93XCP3aCO3fC33j 49l3qA33_BW3xA93sAB3p 0FM37En38Ef3CEe3LEu3T 09V3k963W8N3b8S3j963k903b973Z9C3i 49V3S7q3T7p3X8Z3Z 4B83OBW3RCb3JBm3G 4Ff5KCz5fEc5X";
const field = (c: CanvasRenderingContext2D) => {
  for (const s of DAY_FIELD.split(" ")) {
    const P: Pt[] = [], n = (i: number) => B64.indexOf(s[i]!) * 64 + B64.indexOf(s[i + 1]!);
    for (let i = 1; i < s.length; i += 4) P.push([n(i), n(i + 2)]);
    poly(c, DAY_PAL[+s[0]!]!, P);
  }
};

export const BACKDROPS: Backdrop[] = [
  {
    id: "track", name: "Track", sky: "#7fc6fb", ground: "#76bf84",
    disc: { top: "#f48940", side: "#ba7442", ring: "#f8fae1", glow: false },
    paint(c) {
      const g = c.createLinearGradient(0, 0, 0, 195);
      g.addColorStop(0, "#7fc6fb"), g.addColorStop(1, "#c1e8f8");
      c.fillStyle = g;
      c.fillRect(-4e3, -4e3, AW + 8e3, 4195);
      band(c, "#76bf84", 200, AH + 4e3);
      field(c);
      // The three marker poles: a slate post and an orange top.
      for (const [x, y0, y1, w] of [[162, 215, 273, 9], [457.5, 208, 247, 8], [931.5, 187, 224, 6]] as const) {
        c.fillStyle = "#76718f";
        c.fillRect(x - w / 2, y0, w, y1 - y0);
        c.fillStyle = "#fd8a45";
        c.beginPath();
        c.arc(x, y0 - 0.5, w / 2 + 1.5, 0, Math.PI * 2);
        c.fill();
      }
    },
  },
  {
    id: "sunset", name: "Sunset", sky: "#2d1a4f", ground: "#20163c",
    disc: { top: "#8b74d5", side: "#7462bc", ring: "#09fafb", glow: true },
    paint(c) {
      band(c, "#2d1a4f", -4e3, 4135);
      band(c, "#4c1c69", 135, 209);
      band(c, "#8c287a", 209, 265);
      band(c, "#dd4487", 265, 453);
      c.fillStyle = "#fff4ff";
      for (const [x, y] of [[528, 15], [1154, 35], [142, 57], [393, 76], [565, 94], [1077, 98], [43, 102]] as const) c.fillRect(x, y, 4, 4);
      // The sun, cut by five stripes that widen toward the horizon (the bands show through).
      c.save();
      c.beginPath();
      c.arc(818, 217, 206, 0, Math.PI * 2);
      c.clip();
      c.fillStyle = "#fdc947";
      let y = 0;
      for (const [g0, g1] of [[193, 205], [231, 246], [267, 284], [300, 320], [333, 356], [366, 999]] as const) c.fillRect(600, y, 440, g0 - y), (y = g1);
      c.restore();
      // Two ranges: the dark silhouette, then the lit faces of the far peaks.
      poly(c, "#2d1c4e", [[0, 331], [157, 242], [340, 316], [434, 289], [683, 370], [746, 350], [900, 383], [1126, 307], [1199, 331], [1199, 453], [0, 453]]);
      poly(c, "#382260", [[161, 244], [255, 401], [321, 372], [549, 431], [683, 370], [431, 290], [346, 317], [335, 317]]);
      poly(c, "#382260", [[1199, 331], [1126, 308], [899, 387], [1097, 431], [1199, 385]]);
      // The floor: a violet strip, the pink horizon line, the dark floor and its cyan line.
      band(c, "#471d67", 453, 476);
      band(c, "#e268b4", 476, 479);
      band(c, "#281844", 479, 590);
      band(c, "#32e8f8", 590, 594);
      band(c, "#20163c", 594, AH + 4e3);
    },
  },
];
/** The picks: AUTO, then every backdrop. */
export const PICKS: readonly (readonly [string, string])[] = [["auto", "Auto"], ...BACKDROPS.map((b) => [b.id, b.name] as const)];
/** AUTO's backdrop for the theme. */
const AUTO = { day: "track", night: "sunset" };
/** A saved pick kept only when it is still a backdrop (else AUTO). */
export const pickOf = (v: unknown): string => (typeof v === "string" && BACKDROPS.some((b) => b.id === v) ? v : "auto");
/** The backdrop shown: the pick, or (AUTO) the theme's. */
export const backdropOf = (pick: string | undefined, night: boolean): Backdrop => {
  const id = pickOf(pick) === "auto" ? AUTO[night ? "night" : "day"] : pick;
  return BACKDROPS.find((b) => b.id === id)!;
};

/** The art in a w × h frame: scale `s` and offset (frame px = art px × s + d). Cover the frame, but
 *  never so close that the disc (art x 45–1155) or the bike over it (art y 80–800) leaves it; the
 *  disc stays centred across, the art centred down as far as that allows. */
export const fitOf = (w: number, h: number) => {
  const s = Math.min(Math.max(w / AW, h / AH), w / 1110, h / 720);
  return { s, dx: (w - AW * s) / 2, dy: Math.min(h - 800 * s, Math.max(-80 * s, (h - AH * s) / 2)) };
};

// The fixed camera, solved once at the art's size: a long lens (the art is drawn nearly flat), its
// distance putting the disc's widest on the art's, its pitch the disc's depth; the side's and the
// ring's heights land on the art's rows (764, 783).
const FOV = 0.3, F0 = AH / 2 / Math.tan(FOV / 2);
/** Where (x, y, z) lands, in art px from the target, for pitch p at distance d (the diorama's pinhole). */
const at = (p: number, d: number, x: number, y: number, z: number) => {
  const sp = Math.sin(p), cp = Math.cos(p), dy = y - d * sp, dz = z - d * cp, k = F0 / (-dy * sp - dz * cp);
  return [x * k, -(dy * cp - dz * sp) * k] as const;
};
/** Bisection: the x in [a, b] where g(x) = 0 (g rising). */
const solve = (g: (x: number) => number, a: number, b: number) => {
  for (let i = 0; i < 48; i++) {
    const m = (a + b) / 2;
    g(m) > 0 ? (b = m) : (a = m);
  }
  return (a + b) / 2;
};
const row = (p: number, d: number, y: number, z: number) => at(p, d, 0, y, z)[1];
let PITCH = 0.2, DIST = (R * F0) / DA;
for (let i = 0; i < 6; i++) {
  PITCH = solve((p) => row(p, DIST, 0, R) - row(p, DIST, 0, -R) - 2 * DB, 0.01, 1.2);
  // (the widest across: a little in front of the side points, where the disc is nearer)
  DIST = solve((d) => DA - Math.max(...Array.from({ length: 33 }, (_, j) => at(PITCH, d, R * Math.cos(j / 64 * Math.PI), 0, R * Math.sin(j / 64 * Math.PI))[0])), 1, 99);
}
/** The disc's centre row against the target's (perspective puts the target a little behind it). */
const MID = (row(PITCH, DIST, 0, R) + row(PITCH, DIST, 0, -R)) / 2;
const SIDE = solve((h) => row(PITCH, DIST, -h, R) - row(PITCH, DIST, 0, R) - (764 - DY - DB), 0, 1);
const RING = solve((h) => row(PITCH, DIST, -h, R) - row(PITCH, DIST, 0, R) - (783 - DY - DB), 0, 1) - SIDE;

/** The turntable's one camera for a w × h frame: fixed pitch and distance, the lens scaled with the
 *  art's fit, the target (the disc's centre) on the art's disc. Only `yaw` turns it. */
export const camOf = (w: number, h: number, yaw: number) => {
  const { s, dx, dy } = fitOf(w, h);
  return { yaw, pitch: PITCH, dist: DIST, tx: 0, ty: 0, tz: 0, fov: 2 * Math.atan(h / 2 / (F0 * s)), ox: DX * s + dx - w / 2, oy: (DY - MID) * s + dy - h / 2 };
};

type Add = (d: { shape: "cyl"; sides: number; size: number[]; pos: number[]; color: string; emissive?: boolean; pick: false; cluster: string; layer: number }) => unknown;
/** The carousel under the bike, in `b`'s colours: the ring, the faceted side, the flat top (top at y 0). */
export const plinth = (add: Add, b: Backdrop, cluster: string) => {
  const d = b.disc, D = 2 * R;
  add({ shape: "cyl", sides: 48, size: [D, RING, D], pos: [0, -SIDE - RING, 0], color: d.ring, emissive: true, pick: false, cluster, layer: 1 });
  add({ shape: "cyl", sides: 48, size: [D, SIDE, D], pos: [0, -SIDE, 0], color: d.side, pick: false, cluster, layer: 2 });
  add({ shape: "cyl", sides: 48, size: [D, 0.002, D], pos: [0, -0.002, 0], color: d.top, emissive: true, pick: false, cluster, layer: 3 });
};

/** The painted background for `b` at w × h CSS px (dpr), painted once and kept until any of those
 *  change. It paints into its own canvas only (never the turntable's). */
export function backdropCache() {
  const cv = document.createElement("canvas");
  let key = "";
  return (b: Backdrop, w: number, h: number, dpr: number) => {
    const k = [b.id, w, h, dpr].join();
    if (k === key) return cv;
    key = k;
    (cv.width = Math.round(w * dpr)), (cv.height = Math.round(h * dpr));
    const c = cv.getContext("2d")!, { s, dx, dy } = fitOf(w, h);
    c.setTransform(dpr * s, 0, 0, dpr * s, dpr * dx, dpr * dy);
    b.paint(c);
    return cv;
  };
}
