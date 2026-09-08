import type { Metadata } from "next";

import PeriodView from "./PeriodView";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "이번 주·이번 달 운세 — 내 사주로 보는 흐름 | 러브레빗",
  description:
    "내 일간과 이번 주·이번 달의 기운이 어떤 관계인지로 읽는 흐름. 연애·재물·일·건강 여덟 영역을 무료로 봅니다.",
  alternates: { canonical: `${SITE_URL}/period` },
};

export default function PeriodPage() {
  return <PeriodView />;
}
