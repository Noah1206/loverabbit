import type { Metadata } from "next";
import AdSajuLanding from "@/components/AdSajuLanding";

export const metadata: Metadata = {
  title: "그 사람, 믿어도 되는 걸까? — 바람기 레이더 | 러브레빗",
  description:
    "상대 명식의 도화 기운과 이성운 흐름으로 흔들릴 수 있는 시기와 신호를 첫 리딩 1,900원에 확인해 보세요.",
};

export default async function BaramgiLanding({
  searchParams,
}: {
  searchParams: Promise<{ offer?: string | string[] }>;
}) {
  return <AdSajuLanding offerId="baramgi_990" searchParams={searchParams} />;
}
