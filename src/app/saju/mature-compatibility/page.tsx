import type { Metadata } from "next";
import AdSajuLanding from "@/components/AdSajuLanding";

export const metadata: Metadata = {
  title: "밤이 되면 달라지는 궁합 — 19금 사주 | 러브레빗",
  description: "성인 관계의 끌림과 친밀감, 두 사람의 완급을 사주 해석으로 살펴보세요.",
};

export default function MatureCompatibilityLanding() {
  return <AdSajuLanding offerId="mature_compatibility_990" />;
}
