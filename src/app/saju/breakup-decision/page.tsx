import type { Metadata } from "next";
import { HeroCta, LandingTracker, StickyCta } from "./BreakupLandingClient";

// 이별결정 광고 전용 랜딩 — 광고 카피와 첫 화면 메시지를 일치시켜 이탈을 줄인다.
// 연결 상품: 이별 부검 리포트(ibyeol). 리딩 폼은 /reading?c=ibyeol 로 이어진다.

export const metadata: Metadata = {
  title: "이 관계를 이어갈지 정리할지, 판단의 기준을 정리해 보세요 — 러브레빗",
  description:
    "두 사람의 사주 흐름과 관계 질문을 바탕으로, 관계의 지속 가능성과 다음 대화의 기준을 리포트로 정리합니다.",
  robots: { index: true, follow: true },
};

const OUTCOMES = [
  {
    title: "관계의 반복 원인",
    body: "같은 다툼이 왜 되풀이되는지, 두 사람의 기질에서 겹치는 지점을 짚어요.",
  },
  {
    title: "상대와 나의 관계 흐름",
    body: "지금 두 사람이 서로에게 어떤 시기를 지나고 있는지 흐름으로 봐요.",
  },
  {
    title: "관계 유지·거리두기·정리의 판단 기준",
    body: "무엇을 근거로 결정할지, 판단의 기준선을 세 갈래로 정리해요.",
  },
  {
    title: "다음 대화를 위한 질문 가이드",
    body: "상대에게 무엇부터 물어볼지, 대화를 여는 질문을 문장으로 드려요.",
  },
];

export default function BreakupDecisionLanding() {
  return (
    <main className="lp" data-landing="breakup_decision">
      <LandingTracker />

      <section className="lp-hero">
        <span className="badge">이별결정</span>
        <h1 className="lp-h1">이 관계를 이어갈지 정리할지, 판단의 기준을 정리해 보세요</h1>
        <p className="lp-sub">
          두 사람의 사주 흐름과 관계 질문을 바탕으로, 관계의 지속 가능성과 다음 대화의 기준을
          리포트로 정리합니다.
        </p>
        <HeroCta />
        <p className="lp-note">생년월일만 있으면 시작할 수 있어요. 결과는 계정에 저장돼요.</p>
      </section>

      <section className="lp-section">
        <h2 className="lp-h2">리포트에 담기는 것</h2>
        <ul className="lp-grid">
          {OUTCOMES.map((item) => (
            <li key={item.title} className="card lp-card">
              <h3 className="lp-card-title">{item.title}</h3>
              <p className="lp-card-body">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="lp-section">
        <div className="card lp-tier">
          <h2 className="lp-h2">무료 미리보기와 전체 리포트</h2>
          <p className="lp-tier-body">
            무료 미리보기에서 관계 흐름의 핵심을 확인하고, 전체 리포트에서 세부 해석과 실행 가이드를
            확인할 수 있습니다.
          </p>
          <p className="lp-disclaimer">오락 목적의 콘텐츠입니다.</p>
        </div>
      </section>

      <StickyCta />
    </main>
  );
}
