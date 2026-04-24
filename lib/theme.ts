export const THEME_STORAGE_KEY = "oneflash_theme";

export const THEMES = ["dark", "light"] as const;

export type ThemeMode = (typeof THEMES)[number];

export function isThemeMode(value: string | null): value is ThemeMode {
  return value === "dark" || value === "light";
}

export function getStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeMode(storedTheme) ? storedTheme : null;
}

export function getSystemTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveTheme(): ThemeMode {
  return getStoredTheme() ?? getSystemTheme();
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export const themeBootScript = `
(() => {
  const storageKey = "${THEME_STORAGE_KEY}";
  const root = document.documentElement;

  try {
    const storedTheme = window.localStorage.getItem(storageKey);
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    const theme =
      storedTheme === "dark" || storedTheme === "light"
        ? storedTheme
        : systemTheme;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  } catch {
    const fallbackTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    root.dataset.theme = fallbackTheme;
    root.style.colorScheme = fallbackTheme;
  }
})();
`;
