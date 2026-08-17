"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

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
    const initialTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setThemeState(initialTheme);
    applyTheme(initialTheme);
    setShowMatureLabelsState(window.localStorage.getItem(MATURE_LABEL_STORAGE_KEY) === "show");

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
    return () => window.removeEventListener("storage", syncPreferences);
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
