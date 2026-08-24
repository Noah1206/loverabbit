import type { Metadata } from "next";
import AdSajuLanding from "@/components/AdSajuLanding";

export const metadata: Metadata = {
  title: "내 다음 인연은 언제 어디서 올까? — 인연 타이밍 | 러브레빗",
  description:
    "인연의 창이 열리는 시기와 만남의 경로, 다음 상대의 윤곽까지. 올해의 연애운 리포트 안에서 무료 미리보기로 확인해 보세요.",
};

// 이 랜딩이 팔던 인연 타이밍(insun)은 2026-08-24 에 올해의 연애운(yeonae)으로
// 합쳐졌다. 주소를 지우지 않는 이유는 하나다 - 이미 돌고 있는 메타 소재가
// /saju/romance-timing?offer=romance_timing_990 을 그대로 들고 있다. 여기서
// 리다이렉트를 걸면 쿼리가 살아도 랜딩 각도가 바뀌고, 지우면 유료 클릭이 404 다.

export default async function RomanceTimingLanding({
  searchParams,
}: {
  searchParams: Promise<{ offer?: string | string[] }>;
}) {
  return <AdSajuLanding offerId="romance_timing_990" searchParams={searchParams} />;
}
