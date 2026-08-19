import type { Metadata } from "next";
import InnerMindFlow, { LandingTracker } from "./InnerMindLandingClient";

// 속마음 광고 전용 랜딩 — 몰입형 도입을 두되 접근성과 전환을 함께 만족시킨다.
// 연결 상품: 썸 해부 사주(sseom). 리딩 폼은 /reading?c=sseom 로 이어진다.

export const metadata: Metadata = {
  title: "상대의 마음과 관계의 흐름을 정리해 보는 속마음 리포트 — 러브레빗",
  description:
    "관계의 흐름과 다음 질문을 정리해 보는 속마음 리포트. 무료 미리보기로 먼저 확인해 보세요.",
  robots: { index: true, follow: true },
};

export default function InnerMindLanding() {
  return (
    <main className="lp" data-landing="inner_mind">
      <LandingTracker />

      <section className="lp-hero">
        <span className="badge">속마음</span>
        {/* 몰입형 화면이지만 스크린리더가 읽을 제목은 반드시 남긴다. */}
        <h1 className="lp-h1">상대의 마음과 관계의 흐름을 정리해 보는 속마음 리포트</h1>
        <InnerMindFlow />
      </section>

      <section className="lp-section">
        <div className="card lp-tier">
          <h2 className="lp-h2">무료 미리보기와 전체 리포트</h2>
          <p className="lp-tier-body">
            무료 미리보기에서는 관계 흐름의 요약을 제공합니다. 전체 리포트에는 세부 해석과 질문
            가이드가 포함됩니다.
          </p>
          <p className="lp-disclaimer">오락 목적의 콘텐츠입니다.</p>
        </div>
      </section>
    </main>
  );
}
