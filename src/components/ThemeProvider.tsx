"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getUser } from "@/lib/user";

export type Theme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  showMatureLabels: boolean;
  setShowMatureLabels: (show: boolean) => void;
};

const THEME_STORAGE_KEY = "loverabbit-theme";
const MATURE_LABEL_STORAGE_KEY = "loverabbit-mature-labels";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [showMatureLabels, setShowMatureLabelsState] = useState(false);

  useEffect(() => {
    let active = true;
    const initialTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setThemeState(initialTheme);
    applyTheme(initialTheme);
    setShowMatureLabelsState(window.localStorage.getItem(MATURE_LABEL_STORAGE_KEY) === "show");

    const account = getUser();
    if (account) {
      void fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: account.token }),
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((profile: { theme?: Theme; showMatureLabels?: boolean } | null) => {
          if (!active || !profile) return;
          if (profile.theme === "dark" || profile.theme === "light") {
            setThemeState(profile.theme);
            applyTheme(profile.theme);
            window.localStorage.setItem(THEME_STORAGE_KEY, profile.theme);
          }
          if (typeof profile.showMatureLabels === "boolean") {
            setShowMatureLabelsState(profile.showMatureLabels);
            window.localStorage.setItem(
              MATURE_LABEL_STORAGE_KEY,
              profile.showMatureLabels ? "show" : "hide"
            );
          }
        })
        .catch(() => undefined);
    }

    const syncPreferences = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        const nextTheme: Theme = event.newValue === "light" ? "light" : "dark";
        setThemeState(nextTheme);
        applyTheme(nextTheme);
      }
      if (event.key === MATURE_LABEL_STORAGE_KEY) {
        setShowMatureLabelsState(event.newValue === "show");
      }
    };

    window.addEventListener("storage", syncPreferences);
    return () => {
      active = false;
      window.removeEventListener("storage", syncPreferences);
    };
  }, []);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }, []);

  const setShowMatureLabels = useCallback((show: boolean) => {
    setShowMatureLabelsState(show);
    window.localStorage.setItem(MATURE_LABEL_STORAGE_KEY, show ? "show" : "hide");
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, showMatureLabels, setShowMatureLabels }),
    [setShowMatureLabels, setTheme, showMatureLabels, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
