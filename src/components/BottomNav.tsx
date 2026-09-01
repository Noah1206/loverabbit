"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 슬랙식 플랫 탭바 (2026-08-31).
//
// 미끄러지는 표시기·라벤더 번짐을 걷었다 — 활성 탭은 색과 선 굵기로만
// 말한다. 움직이는 부품이 없어지면서 visualIndex 상태도 같이 사라졌다:
// 활성 표시는 경로에서 곧장 나온다.
//
// 아이콘은 전부 24 격자에 stroke 로만 그린다. 채움 없음 — 활성일 때 CSS 가
// 선을 굵혀(2.4) 무게가 실린 것처럼 읽히게 한다.
//
// 탭은 넷이다. "오늘"이 두 번째 자리에 들어왔다 (2026-09-01) — 매일 열어보는
// 것이라 홈 바로 옆이 맞다. 귀인지도는 아직 만드는 중이라 탭에서 뺐다 —
// /guin 페이지는 남아 있어 주소로는 열린다. "내 사주"와 "내 상담"은 결국
// 같은 이야기라 하나로 합쳤다 (2026-08-26). 보관함은 로그인해야 열린다.
const NAV_ITEMS = [
  {
    href: "/",
    label: "홈",
    matches: (path: string) => path === "/",
    // 집 — 지붕 한 획, 몸통, 문
    icon: (
      <>
        <path d="M4 10.6 12 3.9l8 6.7" />
        <path d="M5.9 9.6V19a1.2 1.2 0 0 0 1.2 1.2h9.8a1.2 1.2 0 0 0 1.2-1.2V9.6" />
        <path d="M10 20.2v-4.9h4v4.9" />
      </>
    ),
  },
  {
    href: "/today",
    label: "오늘",
    matches: (path: string) => path.startsWith("/today"),
    // 해 — 오늘의 물건. 가운데 원과 네 방향 빛살.
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3.2v2.1M12 18.7v2.1M3.2 12h2.1M18.7 12h2.1" />
        <path d="M5.9 5.9l1.5 1.5M16.6 16.6l1.5 1.5M18.1 5.9l-1.5 1.5M7.4 16.6l-1.5 1.5" />
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
    // 말풍선 — 상담의 물건
    icon: (
      <path d="M20 6.9a2.4 2.4 0 0 0-2.4-2.4H6.4A2.4 2.4 0 0 0 4 6.9v7.2a2.4 2.4 0 0 0 2.4 2.4h2.1v3l3.8-3h5.3a2.4 2.4 0 0 0 2.4-2.4Z" />
    ),
  },
  {
    href: "/profile",
    label: "마이",
    // /rewards 는 탭에서 뺐지만 페이지는 남아 있다 (공유 링크가 그리로 간다).
    // 여기서 받지 않으면 activeIndex 가 못 찾아 0 을 돌려줘 표시가 홈으로 튄다.
    matches: (path: string) => path.startsWith("/profile") || path.startsWith("/rewards"),
    // 사람 — 머리와 어깨. 두르는 원은 뺐다, 작아질수록 선이 뭉친다.
    icon: (
      <>
        <circle cx="12" cy="8.1" r="3.4" />
        <path d="M5.4 19.8a6.9 6.9 0 0 1 13.2 0" />
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

  // 생성 대기 화면과 장별 리딩 뷰어는 몰입을 유지하도록 하단 네비게이션을 숨긴다.
  // (뷰어는 자체 장 넘김 바를 그 자리에 둔다)
  if (path === "/reading" || path.startsWith("/reading/") || path.startsWith("/product/") || path.startsWith("/set/") || path.startsWith("/saju/")) return null;

  return (
    <nav className="tabbar" aria-label="주요 메뉴">
      {NAV_ITEMS.map((item, index) => {
        const active = routeIndex === index;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? "on" : ""}
            aria-current={active ? "page" : undefined}
          >
            <span className="tabbar-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
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
