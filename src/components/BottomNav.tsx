"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import loveRabbitLogo from "../../public/logo.png";

// FAB 위 튜토리얼 말풍선 — 한 번 닫으면 다시 안 뜬다
const FAB_TIP_KEY = "fab-tip-dismissed";

// 플랫 탭바 + 가운데 원형 FAB (2026-09-04).
//
// 바는 원래대로 바닥에 붙은 면이고, "오늘"만 fab 표시를 달아
// 바의 윗선을 뚫고 솟는 큰 원형 버튼이 된다. 스타일은 전부
// globals.css 의 .tabbar 가 진다. 활성 표시는 경로에서 곧장 나온다.
//
// 아이콘은 전부 24 격자에 stroke 로만 그린다. 채움 없음 — 활성일 때 CSS 가
// 선을 굵혀(2.4) 무게가 실린 것처럼 읽히게 한다.
//
// 탭은 셋이다. "오늘"이 검수를 마치고 두 번째 자리로 돌아왔다 (2026-09-02) —
// 매일 열어보는 것이라 홈 옆이 맞다. 귀인지도는 아직 만드는 중이라 뺐다 —
// /guin 페이지는 남아 있어 주소로는 열린다. "내 상담"은 탭에서 빼고
// 마이 페이지 안으로 넣었다 (2026-09-03) — /my 페이지는 그대로 있다.
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
    label: "오늘의 사주",
    fab: true, // 가운데 큰 원형 버튼 — 바 위로 솟고, 밑에 라벨이 보인다
    matches: (path: string) => path.startsWith("/today"),
    // 오늘의 사주를 보는 곳 — 브랜드 얼굴(원형 토끼 로고)을 그대로 얹는다.
    // stroke 아이콘 대신 이미지라, 렌더에서 logo 플래그로 분기한다.
    logo: true as const,
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

function activeIndex(path: string): number {
  const index = NAV_ITEMS.findIndex((item) => item.matches(path));
  return index < 0 ? 0 : index;
}

export default function BottomNav() {
  const path = usePathname();
  const routeIndex = activeIndex(path);

  // 하이드레이션 불일치를 피하려고 마운트 뒤에만 켠다
  const [showTip, setShowTip] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(FAB_TIP_KEY)) setShowTip(true);
    } catch {}
  }, []);
  const dismissTip = () => {
    setShowTip(false);
    try {
      localStorage.setItem(FAB_TIP_KEY, "1");
    } catch {}
  };

  // 생성 대기 화면과 장별 리딩 뷰어는 몰입을 유지하도록 하단 네비게이션을 숨긴다.
  // (뷰어는 자체 장 넘김 바를 그 자리에 둔다)
  if (path === "/reading" || path.startsWith("/reading/") || path.startsWith("/product/") || path.startsWith("/set/") || path.startsWith("/saju/")) return null;

  return (
    <nav className="tabbar" aria-label="주요 메뉴">
      {showTip && !path.startsWith("/today") && (
        <div className="fab-tip" role="status">
          오늘의 사주 보러가기
          <button type="button" aria-label="안내 닫기" onClick={dismissTip}>
            ×
          </button>
        </div>
      )}
      {NAV_ITEMS.map((item, index) => {
        const active = routeIndex === index;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[active ? "on" : "", "fab" in item && item.fab ? "fab" : ""].join(" ").trim()}
            aria-current={active ? "page" : undefined}
          >
            <span className="tabbar-icon" aria-hidden>
              {"fab" in item && item.fab ? (
                <Image src={loveRabbitLogo} alt="" width={44} height={44} sizes="44px" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  {item.icon}
                </svg>
              )}
            </span>
            <span className="tabbar-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
