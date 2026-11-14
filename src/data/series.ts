// The Race Series, as data: the tiers (each a championship of rounds), the points table, the prize
// money per round and the championship bonus, the rivals' names and how hard they ride. Logic lives
// in ../model/series.ts; numbers live here, so balancing the series is one diff. All names original.

export type TierId = "rookie" | "pro" | "masters";

export interface Tier {
  id: TierId;
  name: string;
  blurb: string;
  /** Rounds in the championship (a new generated track each). */
  rounds: number;
  /** Track difficulty (0..1, ../modes/race/generate.ts) at the first round and the last. */
  diff: [number, number];
  /** The rivals: the tier of the model they ride (1..4, of the player's class, one per rival), their
   *  mod levels (power, gearing, suspension all at this level), their nerve (share of the line's
   *  speed: ../modes/race/course.ts RaceOpts). */
  rivals: { tiers: [number, number, number]; mods: number; nerve: [number, number] };
  /** Prize per round by finishing place (1st..4th), a clean-round bonus, and the championship bonus by final place. */
  prize: number[];
  clean: number;
  bonus: number[];
  /** Entry: open, or this tier finished in the top `UNLOCK_TOP` first. */
  after: TierId | null;
}

/** A tier opens once the one before it is finished in the top two. */
export const UNLOCK_TOP = 2;
/** Points per round by finishing place (1st..4th); a rider who leaves the round scores nothing. */
export const POINTS = [25, 18, 15, 12];

export const TIERS: Tier[] = [
  {
    id: "rookie", name: "ROOKIE CUP", blurb: "Four rounds on flowing tracks. Rivals on stock starters.", rounds: 4, diff: [0, 0.3],
    rivals: { tiers: [1, 1, 1], mods: 0, nerve: [0.88, 0.95] }, prize: [360, 240, 160, 100], clean: 60, bonus: [1200, 700, 400, 0], after: null,
  },
  {
    id: "pro", name: "PRO CIRCUIT", blurb: "Five rounds, tighter turns, triples. Rivals on modded mid-range bikes.", rounds: 5, diff: [0.35, 0.65],
    rivals: { tiers: [2, 2, 3], mods: 1, nerve: [0.93, 0.98] }, prize: [600, 400, 270, 170], clean: 100, bonus: [2500, 1500, 900, 0], after: "rookie",
  },
  {
    id: "masters", name: "NEON MASTERS", blurb: "Six rounds of hairpins, S-bends and big air. Rivals on the best bikes there are.", rounds: 6, diff: [0.7, 1],
    rivals: { tiers: [3, 4, 4], mods: 2, nerve: [0.96, 1] }, prize: [950, 640, 430, 270], clean: 160, bonus: [5000, 3000, 1800, 0], after: "pro",
  },
];
export const tier = (id: string) => TIERS.find((t) => t.id === id) ?? TIERS[0]!;

/** Rival riders: three are drawn per championship (by its seed), each with a plate. */
export const RIVAL_NAMES = ["KAI VOLTA", "REN STATIC", "JUNO HAZE", "MIKO RIFT", "DEX NOVA", "SOL VANTA", "ZURI FLUX", "ORI CHROME", "TAVI GRID", "NYX ARCADE", "BO LUMEN", "IZZY SPARK"];
