import type { Metadata } from "next";
import AdSajuLanding from "@/components/AdSajuLanding";

export const metadata: Metadata = {
  title: "그 사람과 나는, 가까워질수록 더 잘 맞을까? — 19금 속궁합 사주 | 러브레빗",
  description: "두 사람의 끌림 구조와 친밀도 상성, 주도권과 완급을 무료 미리보기로 확인해 보세요.",
};

export default function MatureCompatibilityLanding() {
  return <AdSajuLanding offerId="mature_compatibility_990" />;
}
