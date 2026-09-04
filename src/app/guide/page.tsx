import type { Metadata } from "next";
import Link from "next/link";

import { READING_PRICE_TIERS, REFERRAL_SIGNUP_CREDITS } from "@/lib/credits";

/*
  처음 온 사람을 위한 가이드 (2026-09-04, 같은 날 개정).

  glowy 문법은 유지하되 섹션마다 옷이 다르다 — 흰 단계 카드, 어두운 러빗
  카드, 파스텔 투데이 카드, 그라데이션 초대 배너. 같은 틀이 반복되면 스크롤이
  한 화면처럼 읽히고, 사람은 두 번째 섹션부터 건너뛴다.

  줄바꿈은 문장이 끝나는 자리에서만 <br/> 로 끊는다.
  토끼는 걸음마다 자세도 몸짓(애니메이션)도 다르다.
*/

export const metadata: Metadata = {
  title: "러브레빗에 처음 오셨다면? — 사용 가이드",
  description: "리딩 받는 법, 러빗, 매일 무료 운세, 친구 초대 보상까지 — 러브레빗 사용법 한눈에.",
};

const [FIRST, SECOND, THIRD] = READING_PRICE_TIERS;

export default function GuidePage() {
  return (
    <main className="guide">
      {/* ── 히어로 ── */}
      <section className="guide-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="guide-rabbit anim-float" src="/assets/today/rabbit-hello-hanbok.webp" alt="" width={180} height={180} />
        <p className="guide-eyebrow">L O V E R A B B I T · 가이드</p>
        <h1 className="guide-h1">
          러브레빗에
          <br />
          <em>처음</em> 오셨다면?
        </h1>
        <p className="guide-sub">
          안녕, 나는 레빗이야.
          <br />
          생년월일 하나로 네 사주를 세우고 연애·재물·오늘의 흐름까지 읽어줘.
          <br />
          3분이면 감이 올 거야.
        </p>
      </section>

      {/* ── 친구 초대 — 그라데이션 배너 ── */}
      <section className="guide-invite">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="guide-invite-rabbit anim-pop" src="/assets/today/rabbit-bigyeop-hanbok.webp" alt="" width={110} height={110} />
        <div className="guide-invite-copy">
          <strong>친구를 데려오면 {REFERRAL_SIGNUP_CREDITS}러빗</strong>
          <span>
            친구가 내 초대 링크로 가입하면 {REFERRAL_SIGNUP_CREDITS}러빗을 줘.
            <br />
            초대 링크는 리딩 결과 화면에 있어.
          </span>
        </div>
      </section>

      {/* ── 1. 리딩 받기 — 번호 달린 세로 단계 ── */}
      <section className="guide-section">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="guide-rabbit-sm anim-wiggle" src="/assets/today/rabbit-siksang-hanbok.webp" alt="" width={120} height={120} />
        <h2 className="guide-h2">리딩, 이렇게 받는 거야</h2>
        <ol className="guide-steps">
          <li>
            <i>1</i>
            <div>
              <strong>궁금한 리딩을 골라</strong>
              <span>
                속궁합·재회·연애 성향·재물운 — 홈에서 하나 고르면 돼.
              </span>
            </div>
          </li>
          <li>
            <i>2</i>
            <div>
              <strong>생년월일을 넣어</strong>
              <span>
                태어난 시간을 모르면 &ldquo;모름&rdquo;으로 둬도 돼.
                <br />
                음력 생일도 그대로 넣으면 내가 바꿔서 계산해.
                <br />
                한 번 넣으면 저장돼서 다음 리딩부턴 안 쳐도 돼.
              </span>
            </div>
          </li>
          <li>
            <i>3</i>
            <div>
              <strong>전문을 열어</strong>
              <span>
                네 명식으로 장·절을 나눠 읽어줘 — 보통 12,000자쯤 돼.
                <br />
                읽다가 궁금한 건 그 자리에서 나한테 질문할 수 있어.
              </span>
            </div>
          </li>
        </ol>
      </section>

      {/* ── 2. 러빗 — 어두운 카드 ── */}
      <section className="guide-dark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="guide-rabbit-sm anim-bob" src="/assets/today/rabbit-jaeseong-hanbok.webp" alt="" width={110} height={110} />
        <h2 className="guide-h2">러빗이 뭐냐면</h2>
        <p className="guide-dark-body">
          여기서 쓰는 화폐야.
          <br />
          리딩 전문을 열고, 오늘의 운세를 풀고, 질문할 때 써.
        </p>
        <div className="guide-tiers">
          <div className="is-now">
            <small>첫 장</small>
            <strong>{FIRST}러빗</strong>
          </div>
          <div>
            <small>둘째 장</small>
            <strong>{SECOND}러빗</strong>
          </div>
          <div>
            <small>그 다음</small>
            <strong>{THIRD}러빗</strong>
          </div>
        </div>
        <p className="guide-dark-note">
          솔직하게 말할게 — 첫 장이 제일 싸.
          <br />
          제일 궁금한 것부터 여는 게 이득이야.
        </p>
      </section>

      {/* ── 3. 투데이 — 파스텔 카드 ── */}
      <section className="guide-pastel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="guide-rabbit-sm anim-sway" src="/assets/today/rabbit-obanggi.webp" alt="" width={120} height={120} />
        <h2 className="guide-h2">매일 공짜로 주는 것</h2>
        <p className="guide-pastel-body">
          아래 탭 <strong>오늘의 사주</strong>에서 매일 오방기를 하나 뽑아.
          <br />
          오늘의 행동 한 줄은 매일 공짜야.
          <br />
          왜 그 행동인지, 뭘 피해야 하는지 — 네 명식으로 맞춘 풀이는 1러빗이면 열려.
        </p>
        <Link href="/today" className="guide-pastel-link">오방기 뽑으러 가기 ›</Link>
      </section>

      {/* ── CTA ── */}
      <section className="guide-cta">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="guide-rabbit anim-nod" src="/assets/today/rabbit-gwanseong-hanbok.webp" alt="" width={150} height={150} />
        <h2 className="guide-h2">준비됐어?</h2>
        <p className="guide-body" style={{ textAlign: "center" }}>
          생년월일 하나면 시작이야.
          <br />
          네 이야기를 들려줄게.
        </p>
        <Link href="/reading" className="guide-cta-btn">
          내 사주 보러 가기 →
        </Link>
        <Link href="/" className="guide-cta-sub">
          먼저 둘러볼래
        </Link>
      </section>
    </main>
  );
}
