/** Where the theme choice is kept (this device only). */
export const THEME_KEY = "mitoshi-theme";

export type ThemeChoice = "dark" | "light" | "system";

/**
 * Runs before first paint (inlined in <head>; its hash is in the page CSP): the saved choice, else the OS, else dark.
 * Kept as a string so it ships without a bundle.
 */
export const THEME_INIT = `(function(){try{var c=localStorage.getItem("${THEME_KEY}");var l=c==="light"||(c==="system"&&matchMedia("(prefers-color-scheme: light)").matches);document.documentElement.dataset.theme=l?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}})();`;

export function applyTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
  const light = choice === "light" || (choice === "system" && matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.dataset.theme = light ? "light" : "dark";
}

export function currentTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "system" ? v : "dark";
  } catch {
    return "dark";
  }
}
