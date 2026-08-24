"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import ProductCtaGate from "@/components/ProductCtaGate";
import type { LandingType } from "@/lib/landing-types";
import {
  trackPageView,
  trackPreviewStarted,
  trackViewContent,
} from "@/lib/meta-events";

export function AdLandingTracker({ landingType }: { landingType: LandingType }) {
  useEffect(() => {
    trackPageView();
    trackViewContent(landingType);
  }, [landingType]);

  return null;
}

// 로그인 문구(loginTitle/loginReason)는 여기서 안 받는다. 로그인을 묻는
// 자리가 폼 끝으로 옮겨갔기 때문이다 - 그 문구는 /reading 이 오퍼에서
// 직접 꺼내 쓴다 (app/reading/page.tsx).
export function AdLandingCta({
  href,
  landingType,
  className,
  children,
}: {
  href: string;
  landingType: LandingType;
  className?: string;
  children: ReactNode;
}) {
  return (
    <ProductCtaGate
      href={href}
      className={className}
      onClick={() => trackPreviewStarted(landingType)}
    >
      {children}
    </ProductCtaGate>
  );
}
