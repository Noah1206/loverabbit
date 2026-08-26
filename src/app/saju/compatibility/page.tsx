import type { Metadata } from "next";
import AdSajuLanding from "@/components/AdSajuLanding";

export const metadata: Metadata = {
  title: "우리 둘, 잘 맞을까? — 궁합 사주 | 러브레빗",
  description: "두 사람의 성향과 관계 온도, 부딪히는 지점을 첫 리딩 990원에 확인해 보세요.",
};

export default async function CompatibilityLanding({
  searchParams,
}: {
  searchParams: Promise<{ offer?: string | string[] }>;
}) {
  return <AdSajuLanding offerId="compatibility_990" searchParams={searchParams} />;
}
