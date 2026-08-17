"use client";

import { useTheme } from "@/components/ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={isDark ? "라이트 테마로 전환" : "다크 테마로 전환"}
      title={isDark ? "라이트 테마로 전환" : "다크 테마로 전환"}
    >
      <span aria-hidden>{isDark ? "☀️" : "🌙"}</span>
      <span>{isDark ? "LIGHT" : "DARK"}</span>
    </button>
  );
}
