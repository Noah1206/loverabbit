import type { Metadata } from "next";
import AdSajuLanding from "@/components/AdSajuLanding";

export const metadata: Metadata = {
  title: "우리 둘, 잘 맞을까? — 궁합 사주 | 러브레빗",
  description: "두 사람의 성향과 관계 온도, 부딪히는 지점을 무료 운명 미리보기로 확인해 보세요.",
};

export default function CompatibilityLanding() {
  return <AdSajuLanding offerId="compatibility_990" />;
}
