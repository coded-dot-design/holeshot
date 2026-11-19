// `?touchlog` on the page: a small on-screen log of the last touch and pointer events (type, pointer
// type, the element actually hit inside the game's shadow root, x/y), for finding why a control
// does not answer on a real phone. Off by default; nothing is saved or sent.
export function touchLog(search: string) {
  if (typeof document !== "object" || !new URLSearchParams(search).has("touchlog")) return;
  const box = document.createElement("pre");
  box.style.cssText = "position:fixed;left:4px;top:40%;z-index:2147483647;margin:0;padding:4px 6px;max-inline-size:62vw;background:#000c;color:#3bff9b;font:10px/1.3 ui-monospace,monospace;pointer-events:none;white-space:pre-wrap";
  document.body.append(box);
  const lines: string[] = [];
  const name = (n: EventTarget | undefined) => {
    const e = n as Element | undefined;
    if (!e || !e.tagName) return "?";
    const c = typeof e.className === "string" ? e.className : (e.getAttribute && e.getAttribute("class")) || "";
    return e.tagName.toLowerCase() + (c ? "." + c.trim().split(/\s+/).slice(0, 2).join(".") : "");
  };
  const log = (e: Event) => {
    const p = e as PointerEvent & TouchEvent;
    const path = e.composedPath();
    const x = p.clientX ?? p.changedTouches?.[0]?.clientX, y = p.clientY ?? p.changedTouches?.[0]?.clientY;
    const host = path.find((n) => (n as Element).classList?.contains?.("hs-rocker"));
    lines.push(`${e.type}${p.pointerType ? "/" + p.pointerType : ""} ${Math.round(x ?? -1)},${Math.round(y ?? -1)} ${name(path[0])}${host ? " ✓rocker" : ""}${e.defaultPrevented ? " prevented" : ""}`);
    if (lines.length > 14) lines.shift();
    box.textContent = lines.join("\n");
    // 60 ms after a press on the rocker: what it made of it (its lit zone, the game's gas/brake).
    const rk = host as HTMLElement | undefined;
    if (rk && e.type === "pointerdown") setTimeout(() => {
      const g = (window as unknown as { game?: { getSnapshot(): { run?: { gas?: number; brake?: number } } } }).game;
      const run = g ? g.getSnapshot().run : undefined;
      lines.push(`  → zone=${rk.dataset.zone ?? "-"} gas=${run?.gas ?? "?"} brake=${run?.brake ?? "?"}`);
      if (lines.length > 14) lines.shift();
      box.textContent = lines.join("\n");
    }, 60);
  };
  for (const t of ["pointerdown", "pointerup", "pointercancel", "lostpointercapture", "touchstart", "touchend", "touchcancel"]) addEventListener(t, log, { capture: true, passive: true });
}
