"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getUser } from "@/lib/user";

export type Theme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  showMatureLabels: boolean;
  setShowMatureLabels: (show: boolean) => void;
  /** 19금 — 켠 사람에게만 성인 등급 연출이 나간다 */
  adultMode: boolean;
  setAdultMode: (on: boolean) => void;
};

const THEME_STORAGE_KEY = "loverabbit-theme";
const MATURE_LABEL_STORAGE_KEY = "loverabbit-mature-labels";
// 성인 등급 연출 스위치. 상품 이름 노출(mature-labels)과는 다른 축이라 따로 둔다 -
// 야한 제목을 보는 것과 야한 연출을 보는 것은 같은 결정이 아니다.
const ADULT_STORAGE_KEY = "loverabbit-adult-mode";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [showMatureLabels, setShowMatureLabelsState] = useState(false);
  // 기본은 꺼짐. 첫 화면이 성인 연출로 시작하는 일은 없어야 한다.
  const [adultMode, setAdultModeState] = useState(false);

  useEffect(() => {
    let active = true;
    // 테마는 아이보리 하나다 (2026-08-30). 저장된 값·서버 값이 다크여도 따르지 않는다.
    const initialTheme: Theme = "light";
    setThemeState(initialTheme);
    applyTheme(initialTheme);
    setShowMatureLabelsState(window.localStorage.getItem(MATURE_LABEL_STORAGE_KEY) === "show");
    setAdultModeState(window.localStorage.getItem(ADULT_STORAGE_KEY) === "on");

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
          if (profile.theme === "light") {
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
        const nextTheme: Theme = "light";
        setThemeState(nextTheme);
        applyTheme(nextTheme);
      }
      if (event.key === MATURE_LABEL_STORAGE_KEY) {
        setShowMatureLabelsState(event.newValue === "show");
      }
      if (event.key === ADULT_STORAGE_KEY) {
        setAdultModeState(event.newValue === "on");
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

  const setAdultMode = useCallback((on: boolean) => {
    setAdultModeState(on);
    window.localStorage.setItem(ADULT_STORAGE_KEY, on ? "on" : "off");
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, showMatureLabels, setShowMatureLabels, adultMode, setAdultMode }),
    [adultMode, setAdultMode, setShowMatureLabels, setTheme, showMatureLabels, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
