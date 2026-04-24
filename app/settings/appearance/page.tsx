"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  getStoredTheme,
  getSystemTheme,
  type ThemeMode,
} from "@/lib/theme";

const themeOptions: Array<{
  value: ThemeMode;
  label: string;
  description: string;
}> = [
  {
    value: "dark",
    label: "Dark",
    description: "Keeps the original contrast-heavy workspace.",
  },
  {
    value: "light",
    label: "Light",
    description: "Switches the app to a brighter desktop-style canvas.",
  },
];

const noopSubscribe = () => () => {};

const subscribeToSystemTheme = (onStoreChange: () => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
};

export default function AppearancePage() {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemTheme,
    (): ThemeMode => "dark"
  );
  const [themePreferenceOverride, setThemePreferenceOverride] = useState<ThemeMode | null>(null);

  const themePreference = themePreferenceOverride ?? (hydrated ? getStoredTheme() : null);
  const theme = themePreference ?? systemTheme;

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (themePreferenceOverride === null) {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, themePreferenceOverride);
    }

    applyTheme(theme);
  }, [hydrated, theme, themePreferenceOverride]);

  return (
    <div className="max-w-3xl motion-enter">
      <h2 className="mb-2 text-2xl font-bold">Appearance</h2>
      <p className="mb-8 text-muted-foreground">
        Choose a visual theme for oneflash.
      </p>

      <div className="motion-stagger-children grid gap-6">
        <section className="rounded-xl border border-border-strong bg-surface-soft p-5 motion-enter motion-enter-delay-1 motion-hover-lift">
          <h3 className="mb-1 text-lg font-semibold">Theme</h3>
          <p className="mb-4 text-sm text-muted">
            Choose how oneflash should look across landing, auth, settings, and Finder views.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setThemePreferenceOverride(option.value)}
                className={`motion-list-row rounded-xl border p-4 text-left transition-colors ${
                  theme === option.value
                    ? "border-blue-500/60 bg-blue-500/10 text-foreground"
                    : "border-border-strong bg-surface-elevated text-muted-foreground hover:border-border hover:bg-hover"
                }`}
              >
                <div className="text-sm font-semibold">{option.label}</div>
                <div className="mt-1 text-sm text-muted">{option.description}</div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

