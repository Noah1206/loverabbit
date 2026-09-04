"use client";

import { useEffect } from "react";

import { trackFunnel } from "@/lib/funnel";

/** 초대 랜딩 열람 한 줄 — 서버 컴포넌트(/invite)는 못 남겨서 이 조각이 남긴다. */
export default function InviteTracker({ product }: { product?: string }) {
  useEffect(() => {
    trackFunnel("partner_invite_view", { product });
  }, [product]);
  return null;
}
