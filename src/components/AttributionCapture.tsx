"use client";

// 광고에서 온 표시를 받아 두는 자리.
//
// 랜딩 페이지마다 붙이지 않고 레이아웃에 둔다. 광고 링크는 다섯 개 랜딩 말고도
// 어디로든 향할 수 있고(상품 페이지, 리딩 폼), 그때마다 컴포넌트를 하나씩 붙이는
// 것을 잊으면 그 소재만 조용히 집계에서 빠진다.
//
// 쿼리는 useSearchParams 가 아니라 window.location 에서 읽는다. 전자를 레이아웃
// 에서 쓰면 사이트의 모든 정적 페이지가 정적 생성에서 빠져 버린다 — 광고 표시
// 하나 받자고 치를 값이 아니다. 어차피 브라우저에서만 도는 코드다.
//
// 동의와 무관하게 받아 둔다. 이건 우리 주문에 "어느 광고가 팔았는가" 를 적는
// 1차 기록이지 광고 플랫폼으로 나가는 값이 아니다. Meta 로 보내는 쪽은
// meta-events.ts 가 동의 없이는 한 건도 내보내지 않는다.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureAttribution } from "@/lib/attribution";

export default function AttributionCapture() {
  const pathname = usePathname();

  useEffect(() => {
    captureAttribution(window.location.search, window.location.pathname);
  }, [pathname]);

  return null;
}
