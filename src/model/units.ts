// Display units: distances and speeds as the rider reads them. Physics and saved numbers stay in
// world units (1 is about a metre); this only formats them. Imperial (miles, mph) is the default.
export type Units = "imperial" | "metric";
export const UNITS: readonly Units[] = ["imperial", "metric"];
/** Miles in a kilometre. */
export const MI_PER_KM = 0.621371;
/** World units (about metres) in the chosen unit: miles or kilometres. */
export const far = (u: number, units: Units = "imperial") => (units === "metric" ? u / 1000 : (u / 1000) * MI_PER_KM);
/** World units as a label: "1.70 MI" or "1.70 KM". */
export const dist = (u: number, units: Units = "imperial") => `${far(u, units).toFixed(2)} ${units === "metric" ? "KM" : "MI"}`;
/** Speed readouts are scaled for feel (owner, 2026-11-18): the table is small, so a world unit a
 *  second reads SPEED_DISPLAY times faster (a top-tier bike reads 70+ mph). Display only: physics,
 *  distances and saved numbers are untouched. */
export const SPEED_DISPLAY = 1.6;
/** Units a second as the number on a readout: mph or km/h, scaled for feel. */
export const perHour = (ups: number, units: Units = "imperial") => far(ups * 3600 * SPEED_DISPLAY, units);
/** Units a second as a label: "36 MPH" or "58 KM/H" (10 units/s). */
export const speed = (ups: number, units: Units = "imperial") => `${Math.round(perHour(ups, units))} ${units === "metric" ? "KM/H" : "MPH"}`;
