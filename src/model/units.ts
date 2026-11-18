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
/** Units a second as a label: "27 MPH" or "43 KM/H". */
export const speed = (ups: number, units: Units = "imperial") => `${Math.round(far(ups * 3600, units))} ${units === "metric" ? "KM/H" : "MPH"}`;
