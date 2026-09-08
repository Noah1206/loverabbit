import type { Metadata } from "next";

import TarotView from "./TarotView";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "타로 — 뽑은 카드를 내 사주 결에 겹쳐 읽어요 | 러브레빗",
  description:
    "카드 세 장을 뽑고, 그 카드를 당신의 사주 결과 함께 읽습니다. 연애·관계·일·재물·선택 다섯 물음 중에서 골라보세요.",
  alternates: { canonical: `${SITE_URL}/tarot` },
};

export default function TarotPage() {
  return <TarotView />;
}
