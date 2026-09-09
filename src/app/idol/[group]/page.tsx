import { notFound } from "next/navigation";

import IdolGroupView from "./IdolGroupView";
import { IDOL_GROUPS, IDOL_GROUP_MAP } from "@/lib/idols";

export function generateStaticParams() {
  return IDOL_GROUPS.map((g) => ({ group: g.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  const g = IDOL_GROUP_MAP.get(group);
  if (!g) return {};
  return {
    title: `${g.label} 궁합 — 최애와 나, 무슨 사이?`,
    description: `${g.label} 멤버와 내 사주가 만나는 자리를 봅니다.`,
  };
}

export default async function IdolGroupPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  const g = IDOL_GROUP_MAP.get(group);
  if (!g) notFound();
  return <IdolGroupView group={g} />;
}
