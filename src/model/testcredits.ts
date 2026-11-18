// Test credits: `?credits=inf` (or `?money=inf`) on the page, for trying every bike, part and
// upgrade. The game then plays a copy of the saved profile, held in memory only: credits topped up
// after every purchase and ride (buying never costs), the showroom's unlocks open, and nothing is
// saved, so taking the param off loads the real profile exactly as it was. Online is off with it
// (a free-bought bike must not ride against real people). Without the param nothing changes.
import type { Profile } from "./profile.ts";

/** What the session's copy always holds (the most a profile keeps: ./profile.ts normalize). */
export const TEST_CREDITS = 9_999_999;
const ON = new Set(["inf", "infinite", "infinity", "∞"]);
/** Whether the page asks for test credits (`search`: location.search, or its params). */
export function testCredits(search: string | URLSearchParams): boolean {
  const q = typeof search === "string" ? new URLSearchParams(search) : search;
  return ["credits", "money"].some((k) => ON.has((q.get(k) ?? "").trim().toLowerCase()));
}
/** The profile with its credits topped up (a new object; the one passed in is left alone). */
export const topUp = (p: Profile): Profile => (p.credits === TEST_CREDITS ? p : { ...p, credits: TEST_CREDITS });
