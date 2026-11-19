// The page's light/dark switch, remembered (localStorage "dom-virus:theme": the key saved choices already use).
export function toggleTheme() {
  const html = document.documentElement, next = html.dataset.theme === "light" ? "dark" : "light";
  html.dataset.theme = next;
  try {
    localStorage.setItem("dom-virus:theme", next);
  } catch {}
}
