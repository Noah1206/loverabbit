import type { Metadata } from "next";
import InnerMindFlow, { LandingTracker } from "./InnerMindLandingClient";

// 속마음 광고 전용 랜딩 — 실제 판매 상품인 썸 해부 사주의 내용으로 연결한다.
// 연결 상품: 썸 해부 사주(sseom). 리딩 폼은 /reading?c=sseom 로 이어진다.

export const metadata: Metadata = {
  title: "이 썸, 왜 진도가 안 나갈까? — 썸 해부 사주 | 러브레빗",
  description:
    "정체된 썸의 브레이크와 상대의 신호, 관계가 움직일 타이밍을 무료 미리보기로 확인해 보세요.",
  robots: { index: true, follow: true },
};

export default function InnerMindLanding() {
  return (
    <main className="lp" data-landing="inner_mind">
      <LandingTracker />

      <section className="lp-hero">
        <span className="badge">속마음 · 썸 해부 사주</span>
        {/* 몰입형 화면이지만 스크린리더가 읽을 제목은 반드시 남긴다. */}
        <h1 className="lp-h1">이 썸, 왜 진도가 안 나갈까?</h1>
        <InnerMindFlow />
      </section>

      <section className="lp-section">
        <div className="card lp-tier">
          <h2 className="lp-h2">무료 미리보기와 전체 리포트</h2>
          <p className="lp-tier-body">
            무료 미리보기에서는 두 사람의 관계 속도와 흐름을 먼저 확인합니다. 전체 리포트에서는
            성사 가능성, 브레이크를 밟는 쪽, 상대의 신호와 고백 타이밍까지 살펴봅니다.
          </p>
          <p className="lp-disclaimer">오락 목적의 콘텐츠입니다.</p>
        </div>
      </section>
    </main>
  );
}
