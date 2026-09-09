"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 플랫 탭바 (2026-09-09).
//
// 가운데가 원형 FAB 이던 것을 걷었다 — 셋이 같은 크기의 선 아이콘으로 선다.
// 스타일은 전부 globals.css 의 .tabbar 가 진다. 활성 표시는 경로에서 곧장
// 나온다.
//
// 아이콘은 전부 24 격자에 stroke 로만 그린다. 채움 없음 — 활성일 때 CSS 가
// 선을 굵혀(2.4) 무게가 실린 것처럼 읽히게 한다.
//
// 탭은 셋이다. 가운데 자리는 2026-09-09 에 "오늘의 사주"에서 "사주지도"로
// 바뀌었다 (운영자) — 오늘의 사주는 홈에서 이미 배너로 들어가고, 지도는
// 홈에서 슬라이드 한 장 안에 묻혀 있어 여기 세우는 편이 낫다. /today 는
// 그대로 살아 있고 홈과 주소로 들어간다. "내 상담"은 탭에서 빼고 마이
// 페이지 안으로 넣었다 (2026-09-03) — /my 페이지는 그대로 있다.
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
    href: "/guin",
    label: "사주지도",
    matches: (path: string) => path.startsWith("/guin"),
    // 궤도 위 별 — 지도 화면의 문법 그대로. 원형 FAB 을 걷으면서(2026-09-09
    // 운영자) 옆 둘과 같은 선 아이콘으로 돌아왔다.
    icon: (
      <>
        {/* 나침반 (2026-09-09). 궤도 타원은 22px 에서 눈으로 읽혔다 — 가운데
            점이 눈동자가 된다. 지도를 여는 자리라 나침반이 뜻도 더 곧다. */}
        <circle cx="12" cy="12" r="8.6" />
        <path d="M15.1 8.9l-1.9 4.4-4.3 1.8 1.9-4.4z" />
      </>
    ),
  },
  {
    href: "/profile",
    label: "마이",
    // /my(내 상담)·/rewards 는 탭에서 뺐지만 페이지는 남아 있다. 여기서 받지
    // 않으면 activeIndex 가 못 찾아 0 을 돌려줘 표시가 홈으로 튄다.
    matches: (path: string) =>
      path.startsWith("/profile") ||
      path.startsWith("/rewards") ||
      path.startsWith("/my") ||
      path.startsWith("/payment"),
    // 사람 — 머리와 어깨. 두르는 원은 뺐다, 작아질수록 선이 뭉친다.
    icon: (
      <>
        <circle cx="12" cy="8.1" r="3.4" />
        <path d="M5.4 19.8a6.9 6.9 0 0 1 13.2 0" />
      </>
    ),
  },
] as const;

export default function BottomNav() {
  const path = usePathname();

  const items = NAV_ITEMS;
  const found = items.findIndex((item) => item.matches(path));
  const routeIndex = found < 0 ? 0 : found;
  // 생성 대기 화면과 장별 리딩 뷰어는 몰입을 유지하도록 하단 네비게이션을 숨긴다.
  // (뷰어는 자체 장 넘김 바를 그 자리에 둔다)
  if (path === "/reading" || path.startsWith("/reading/") || path.startsWith("/product/") || path.startsWith("/set/") || path.startsWith("/saju/")) return null;

  return (
    <nav className="tabbar" aria-label="주요 메뉴">
      {items.map((item, index) => {
        const active = routeIndex === index;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? "on" : undefined}
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
