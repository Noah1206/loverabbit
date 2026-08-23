import type { Metadata } from "next";
import AdSajuLanding from "@/components/AdSajuLanding";

export const metadata: Metadata = {
  title: "나한테 도화살, 진짜 있을까? — 도화살 진단 | 러브레빗",
  description: "명식 속 도화의 개수와 위치, 매력이 발동하는 순간과 도화 사용법을 무료 미리보기로 확인해 보세요.",
};

export default function DohwasalLanding() {
  return <AdSajuLanding offerId="dohwasal_990" />;
}
