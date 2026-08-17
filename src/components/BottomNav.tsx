"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 앱형 하단 탭바 — 전 페이지 공통. 미구현 탭은 준비중 안내.
export default function BottomNav() {
  const path = usePathname();
  const soon = (name: string) => alert(`${name}은(는) 오픈 준비 중이에요 🐰`);

  return (
    <nav className="tabbar">
      <Link href="/" className={path === "/" ? "on" : ""}>
        <span className="ico">🏠</span>홈
      </Link>
      <Link href="/reading" className={path === "/reading" ? "on" : ""}>
        <span className="ico">🔮</span>리딩
      </Link>
      <Link href="/my" className={path === "/my" ? "on" : ""}>
        <span className="ico">📜</span>내 상담
      </Link>
      <Link href="/membership" className={path === "/membership" ? "on" : ""}>
        <span className="ico">🌙</span>멤버십
      </Link>
      <button onClick={() => soon("마이")}>
        <span className="ico">👤</span>마이
      </button>
    </nav>
  );
}
