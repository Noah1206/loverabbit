import type { Metadata } from "next";
import AdSajuLanding from "@/components/AdSajuLanding";

export const metadata: Metadata = {
  title: "말보다 먼저 맞는 온도 — 속궁합 사주 | 러브레빗",
  description: "두 사람의 끌림과 주도권, 가까워질수록 드러나는 친밀도 상성을 무료로 확인해 보세요.",
};

export default function IntimateCompatibilityLanding() {
  return <AdSajuLanding offerId="intimate_compatibility_990" />;
}
