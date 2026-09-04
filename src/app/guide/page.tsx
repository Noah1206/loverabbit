import type { Metadata } from "next";
import Link from "next/link";

import { READING_PRICE_TIERS } from "@/lib/credits";

/*
  처음 온 사람을 위한 가이드 (2026-09-04).

  glowy.korea 의 베딕 리포트 화면 문법을 빌렸다 — 흰 바탕, 가운데 캐릭터,
  자간 넓힌 작은 라벨, 큰 제목에 강조색 한 단어, 연회색 둥근 카드.
  테마와 무관하게 항상 밝다 — 색을 하드코딩한다(guide- CSS 참고).

  걸음마다 다른 자세의 토끼가 다른 몸짓(애니메이션)으로 선다.
  토끼 그림은 투데이 것(public/assets/today)을 그대로 쓴다.
*/

export const metadata: Metadata = {
  title: "러브레빗에 처음 오셨다면? — 사용 가이드",
  description: "리딩 받는 법, 러빗 충전, 매일 무료 운세까지 — 러브레빗 사용법 한눈에.",
};

const FIRST = READING_PRICE_TIERS[0];

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
          안녕, 나는 레빗이야. 생년월일 하나로 네 사주를 세우고,
          연애·재물·오늘의 흐름까지 읽어줘. 3분이면 감이 올 거야.
        </p>
      </section>

      {/* ── 1. 리딩 받기 ── */}
      <section className="guide-section">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="guide-rabbit-sm anim-wiggle" src="/assets/today/rabbit-siksang-hanbok.webp" alt="" width={120} height={120} />
        <p className="guide-step">S T E P · 1</p>
        <h2 className="guide-h2">사주 리딩 받기</h2>
        <p className="guide-accent-line">생년월일만 있으면 돼</p>
        <p className="guide-body">
          홈에서 궁금한 리딩을 고르고 생년월일을 넣으면, 네 명식(태어난 순간의
          여덟 글자)을 세워서 장·절로 나눠 읽어줘. 태어난 시간을 모르면
          &ldquo;모름&rdquo;으로 둬도 돼.
        </p>
        <div className="guide-card">
          <p className="guide-card-label">이런 걸 볼 수 있어</p>
          <ul>
            <li>그 사람과 나의 속궁합·상성</li>
            <li>재회 — 아직 마음이 남아 있는지</li>
            <li>연애할 때 드러나는 진짜 나</li>
            <li>재물운, 올해의 흐름</li>
          </ul>
        </div>
      </section>

      {/* ── 2. 러빗 ── */}
      <section className="guide-section">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="guide-rabbit-sm anim-bob" src="/assets/today/rabbit-jaeseong-hanbok.webp" alt="" width={120} height={120} />
        <p className="guide-step">S T E P · 2</p>
        <h2 className="guide-h2">러빗이 뭐야?</h2>
        <p className="guide-accent-line">여기서 쓰는 화폐야</p>
        <p className="guide-body">
          리딩 전문을 열거나, 오늘의 운세를 내 명식에 맞춰 풀거나, 리딩에 대해
          질문할 때 러빗을 써. 첫 장은 {FIRST}러빗으로 열 수 있어.
        </p>
        <div className="guide-card">
          <p className="guide-card-label">러빗으로 하는 것</p>
          <ul>
            <li>리딩 전문 열기 — 첫 장 {FIRST}러빗</li>
            <li>오늘의 운세, 내 명식으로 풀기 — 1러빗</li>
            <li>리딩 보고 궁금한 것 질문하기</li>
          </ul>
        </div>
      </section>

      {/* ── 3. 충전 ── */}
      <section className="guide-section">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="guide-rabbit-sm anim-nod" src="/assets/today/rabbit-gwanseong-hanbok.webp" alt="" width={120} height={120} />
        <p className="guide-step">S T E P · 3</p>
        <h2 className="guide-h2">러빗 충전하기</h2>
        <p className="guide-accent-line">계좌이체로 안전하게</p>
        <p className="guide-body">
          충전함에서 팩을 고르면 입금 계좌와 <strong>입금 코드</strong>가 나와.
          코드를 받는 분 통장 메모에 적어 보내면 확인 후 바로 러빗이 들어와 —
          보통 몇 분이면 돼.
        </p>
        <div className="guide-card">
          <p className="guide-card-label">기다리는 동안</p>
          <ul>
            <li>입금 확인되면 화면이 저절로 바뀌어</li>
            <li>혹시 오래 걸리면 문의하기로 알려줘 — 바로 확인해줄게</li>
          </ul>
        </div>
      </section>

      {/* ── 4. 매일 오는 재미 ── */}
      <section className="guide-section">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="guide-rabbit-sm anim-sway" src="/assets/today/rabbit-obanggi.webp" alt="" width={120} height={120} />
        <p className="guide-step">매 일</p>
        <h2 className="guide-h2">오늘의 사주 액션</h2>
        <p className="guide-accent-line">오방기 뽑고, 오늘의 행동 한 줄</p>
        <p className="guide-body">
          아래 탭의 <strong>오늘의 사주</strong>에서 매일 오방기를 하나 뽑아.
          오늘의 행동 한 줄은 공짜야. 왜 그 행동인지, 뭘 피해야 하는지 —
          네 명식으로 맞춘 풀이는 1러빗이면 열려.
        </p>
      </section>

      {/* ── CTA ── */}
      <section className="guide-cta">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="guide-rabbit anim-pop" src="/assets/today/rabbit-bigyeop-hanbok.webp" alt="" width={150} height={150} />
        <h2 className="guide-h2">준비됐어?</h2>
        <p className="guide-body" style={{ textAlign: "center" }}>
          생년월일 하나면 시작이야. 네 이야기를 들려줄게.
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
