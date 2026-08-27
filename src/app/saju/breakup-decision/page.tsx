import type { Metadata } from "next";
import AdSajuLanding from "@/components/AdSajuLanding";

export const metadata: Metadata = {
  title: "그 연애는 어디서부터 어긋났을까? — 이별 부검 리포트 | 러브레빗",
  description: "끝난 연애의 진짜 사인과 반복 패턴, 다음 연애를 위한 처방을 첫 리딩 4,900원에 확인해 보세요.",
};

export default async function BreakupDecisionLanding({
  searchParams,
}: {
  searchParams: Promise<{ offer?: string | string[] }>;
}) {
  return <AdSajuLanding offerId="breakup_decision_990" searchParams={searchParams} />;
}
