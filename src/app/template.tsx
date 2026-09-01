import type { ReactNode } from "react";

// 페이지가 바뀔 때마다 이 컴포넌트가 새로 마운트된다 — 그래서 진입 애니메이션을
// 여기 한 곳에 두면 모든 화면이 같은 문법으로 들어온다 (2026-09-01 운영자:
// 오른쪽에서 미끄러져 들어오게).
export default function Template({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="route-slide-in">{children}</div>
      <div className="route-transition-veil" aria-hidden="true" />
    </>
  );
}
