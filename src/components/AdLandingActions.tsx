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
      signupTitle="로그인하고 무료로 시작하기"
      signupReason="로그인 후 선택한 사주 입력 화면으로 바로 이어져요."
    >
      {children}
    </ProductCtaGate>
  );
}
