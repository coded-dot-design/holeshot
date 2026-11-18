// The page's light/dark switch, shared with the DOM VIRUS family (localStorage "dom-virus:theme").
export function toggleTheme() {
  const html = document.documentElement, next = html.dataset.theme === "light" ? "dark" : "light";
  html.dataset.theme = next;
  try {
    localStorage.setItem("dom-virus:theme", next);
  } catch {}
}
