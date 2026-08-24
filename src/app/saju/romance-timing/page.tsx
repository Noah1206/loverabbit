import type { Metadata } from "next";
import AdSajuLanding from "@/components/AdSajuLanding";

export const metadata: Metadata = {
  title: "내 다음 인연은 언제 어디서 올까? — 인연 타이밍 | 러브레빗",
  description: "인연의 창이 열리는 시기와 만남의 경로, 다음 상대의 윤곽을 무료 미리보기로 확인해 보세요.",
};

export default async function RomanceTimingLanding({
  searchParams,
}: {
  searchParams: Promise<{ offer?: string | string[] }>;
}) {
  return <AdSajuLanding offerId="romance_timing_990" searchParams={searchParams} />;
}
