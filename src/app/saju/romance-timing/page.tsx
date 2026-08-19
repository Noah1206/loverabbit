import type { Metadata } from "next";
import AdSajuLanding from "@/components/AdSajuLanding";

export const metadata: Metadata = {
  title: "이번 사랑, 언제 시작될까? — 연애운 사주 | 러브레빗",
  description: "인연이 가까워지는 시기와 만남의 경로를 무료 운명 미리보기로 확인해 보세요.",
};

export default function RomanceTimingLanding() {
  return <AdSajuLanding offerId="romance_timing_990" />;
}
