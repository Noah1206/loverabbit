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
  signupTitle,
  signupReason,
  className,
  children,
}: {
  href: string;
  landingType: LandingType;
  signupTitle: string;
  signupReason: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <ProductCtaGate
      href={href}
      className={className}
      onClick={() => trackPreviewStarted(landingType)}
      signupTitle={signupTitle}
      signupReason={signupReason}
    >
      {children}
    </ProductCtaGate>
  );
}
