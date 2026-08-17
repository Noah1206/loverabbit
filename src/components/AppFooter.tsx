"use client";

import { useTheme } from "@/components/ThemeProvider";

export default function AppFooter() {
  const { showMatureLabels } = useTheme();

  return (
    <footer className="app-footer">
      <p>
        {showMatureLabels
          ? "러브레빗 LoveRabbit · 만 19세 이상 전용 서비스"
          : "러브레빗 LoveRabbit · AI 기반 연애·인연 리딩 서비스"}
      </p>
      <p>본 서비스의 리딩은 오락 목적이며 의학적·법률적 조언이 아닙니다.</p>
    </footer>
  );
}
