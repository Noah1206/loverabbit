"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type CSSProperties, useEffect, useState } from "react";

// 아이콘은 전부 24 격자에 stroke 로만 그린다 (fill="none" 은 svg 쪽에 걸려 있다).
// 홈만 예외로 .tabbar-home-shape 가 채운다 — 그래서 홈 도형은 안쪽을 파지 않는다.
// 겹치는 조각은 채워질 때 하나로 합쳐지므로 굴뚝을 따로 그려도 된다.
//
// 탭은 넷이다 (2026-08-31 귀인지도 추가). "내 사주"(/reading 으로 가는 링크)와 "내 상담"(보관함)이 따로
// 있었는데 둘 다 결국 내 리딩 이야기라 하나로 합쳤다 (2026-08-26). 새 사주는
// 홈과 보관함 안의 버튼에서 시작한다. 보관함은 로그인해야 열린다.
const NAV_ITEMS = [
  {
    href: "/",
    label: "홈",
    matches: (path: string) => path === "/",
    // 처마가 넓은 지붕 + 굴뚝
    icon: (
      <>
        <path className="tabbar-home-shape" d="M12 2.9 1.9 11.4h2.9v7.9c0 .95.77 1.72 1.72 1.72h11c.95 0 1.72-.77 1.72-1.72v-7.9h2.9L12 2.9Z" />
        <path className="tabbar-home-shape" d="M16.4 4.3h2.2v4.6h-2.2Z" />
      </>
    ),
  },
  {
    href: "/guin",
    label: "귀인지도",
    matches: (path: string) => path.startsWith("/guin"),
    // 관계 그래프 — 가운데 나, 위로 뻗은 인연 둘
    icon: (
      <>
        <circle cx="12" cy="15.2" r="3.1" />
        <circle cx="5.6" cy="6.6" r="2.3" />
        <circle cx="18.4" cy="6.6" r="2.3" />
        <path d="M10.2 12.8 7.1 8.6" />
        <path d="M13.8 12.8 16.9 8.6" />
      </>
    ),
  },
  {
    href: "/my",
    label: "내 상담",
    matches: (path: string) =>
      path.startsWith("/my") ||
      path.startsWith("/reading") ||
      path.startsWith("/product") ||
      path.startsWith("/payment"),
    // 초승달 + 반짝임
    icon: (
      <>
        <path d="M20.3 14.9A8.1 8.1 0 0 1 9.6 4.2a8.4 8.4 0 1 0 10.7 10.7Z" />
        <path d="M17.6 2.9l.62 1.72 1.72.62-1.72.62-.62 1.72-.62-1.72-1.72-.62 1.72-.62.62-1.72Z" />
      </>
    ),
  },
  {
    href: "/profile",
    label: "마이",
    // /rewards 는 탭에서 뺐지만 페이지는 남아 있다 (공유 링크가 그리로 간다).
    // 여기서 받지 않으면 activeIndex 가 못 찾아 0 을 돌려줘 표시가 홈으로 튄다.
    matches: (path: string) => path.startsWith("/profile") || path.startsWith("/rewards"),
    // 원 안에 든 사람
    icon: (
      <>
        <circle cx="12" cy="12" r="8.9" />
        <circle cx="12" cy="9.8" r="3.05" />
        <path d="M5.95 18.7a6.6 6.6 0 0 1 12.1 0" />
      </>
    ),
  },
] as const;

function activeIndex(path: string): number {
  const index = NAV_ITEMS.findIndex((item) => item.matches(path));
  return index < 0 ? 0 : index;
}

export default function BottomNav() {
  const path = usePathname();
  const routeIndex = activeIndex(path);
  const [visualIndex, setVisualIndex] = useState(routeIndex);

  useEffect(() => setVisualIndex(routeIndex), [routeIndex]);

  // 생성 대기 화면과 장별 리딩 뷰어는 몰입을 유지하도록 하단 네비게이션을 숨긴다.
  // (뷰어는 자체 장 넘김 바를 그 자리에 둔다)
  if (path === "/reading" || path.startsWith("/reading/") || path.startsWith("/product/") || path.startsWith("/set/") || path.startsWith("/saju/")) return null;

  return (
    <nav
      className="tabbar"
      aria-label="주요 메뉴"
      style={{ "--active-index": visualIndex, "--nav-count": NAV_ITEMS.length } as CSSProperties}
    >
      <span className="tabbar-indicator-slot" aria-hidden>
        <span className="tabbar-indicator" />
      </span>
      {NAV_ITEMS.map((item, index) => {
        const active = routeIndex === index;
        const visuallyActive = visualIndex === index;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={visuallyActive ? "on" : ""}
            aria-current={active ? "page" : undefined}
            onClick={() => setVisualIndex(index)}
          >
            <span className="tabbar-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {item.icon}
              </svg>
            </span>
            <span className="tabbar-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
