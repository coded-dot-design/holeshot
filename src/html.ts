// Small HTML helpers the shell's cards and the garage share: numbers, escaping, a condition bar.
export const num = (n: number) => Math.round(n).toLocaleString("en-US");
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/** A labelled 0..1 bar; `state` marks a worn part ("worn", "risk", "failed"), `low` the old red line. */
export const bar = (v: number, label: string, state = "") => `<span class="dh-bar" style="--v:${Math.max(0, Math.min(1, v)).toFixed(3)}"${v < 0.35 ? " data-low" : ""}${state ? ` data-state="${state}"` : ""}><em>${label}</em><i></i><b>${Math.round(v * 100)}%</b></span>`;
