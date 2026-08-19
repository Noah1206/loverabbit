import type { Metadata } from "next";
import AdSajuLanding from "@/components/AdSajuLanding";

export const metadata: Metadata = {
  title: "끝낼까, 붙잡을까? — 이별 사주 | 러브레빗",
  description: "반복되는 갈등의 원인과 관계의 흐름을 무료 운명 미리보기로 확인해 보세요.",
};

export default function BreakupDecisionLanding() {
  return <AdSajuLanding offerId="breakup_decision_990" />;
}
