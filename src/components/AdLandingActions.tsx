"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
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
    <Link
      href={href}
      className={className}
      onClick={() => trackPreviewStarted(landingType)}
    >
      {children}
    </Link>
  );
}
