"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import SignupModal from "@/components/SignupModal";
import AuthReadyTransition from "@/components/AuthReadyTransition";
import { getUser } from "@/lib/user";
import { trackPreviewStarted, trackViewContent } from "@/lib/meta-events";
import { INNER_MIND_PARTICIPANT_COUNT } from "@/lib/participant-counts";

const LANDING = "inner_mind" as const;
// 광고에서 들어온 사람은 990원으로 받는다. 다른 네 랜딩과 같은 규칙이다 -
// 이 자리에 offer 가 없으면 광고는 990원을 말하는데 도착지는 정가라, 광고가
// 거짓말이 된다. 유저당 한 번만 먹는 것은 서버가 따로 본다.
const FORM_PATH = "/reading?c=sseom&offer=inner_mind_990";

// 개인화 질문 — 일반적 상황 선택지만 제공한다.
// 선택값은 이 기기의 sessionStorage에만 남기고, URL·광고 이벤트·로그에 넣지 않는다.
const SITUATIONS = [
  "몇 달째 진도가 안 나가는 썸",
  "밀당인지 무관심인지 헷갈리는 관계",
  "먼저 다가갈지 기다릴지 고민되는 관계",
  "이 썸을 계속할지 판단이 필요한 관계",
] as const;

const SITUATION_KEY = "loverabbit-inner-mind-situation";

export function LandingTracker() {
  useEffect(() => {
    trackViewContent(LANDING);
  }, []);
  return null;
}

export default function InnerMindFlow() {
  // 연출을 본 사람과 건너뛴 사람이 같은 설문·미리보기에 도달한다.
  const [stage, setStage] = useState<"intro" | "situation">("intro");
  const [picked, setPicked] = useState<string | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [showReady, setShowReady] = useState(false);

  const go = () => {
    trackPreviewStarted(LANDING);
    if (picked) {
      try {
        window.sessionStorage.setItem(SITUATION_KEY, picked);
      } catch {
        // 저장 실패는 흐름을 막지 않는다.
      }
    }
    if (!getUser()) {
      setShowSignup(true);
      return;
    }
    setShowReady(true);
  };

  return (
    // data-offer 는 다른 네 랜딩과 같은 표시다. 광고 점검 스크립트가 이걸 보고
    // "이 랜딩이 어떤 오퍼를 파는지" 를 읽는다.
    <div className="lp-flow" data-offer="inner_mind_990">
      {stage === "intro" ? (
        <div className="lp-intro">
          {/* 광고 소재의 속마음 후킹을 실제 판매 상품인 썸 해부 사주로 이어 준다. */}
          <div className="lp-intro-art">
            <Image
              src="/cards-pastel/sseom.jpg"
              alt="썸 해부 사주"
              fill
              priority
              sizes="(max-width: 640px) 100vw, 480px"
              style={{ objectFit: "cover", objectPosition: "center 22%" }}
            />
            <span className="lp-intro-art-tag">썸 해부 사주</span>
          </div>
          <p className="lp-intro-line">
            다정함인지 호감인지 애매했던 신호, 이 썸이 멈춘 진짜 이유부터 확인해 볼까요.
          </p>
          <div className="lp-intro-actions">
            <button type="button" className="btn lp-cta" onClick={() => setStage("situation")}>
              이 썸의 속도 무료로 확인하기
            </button>
            <button
              type="button"
              className="lp-skip"
              onClick={() => setStage("situation")}
            >
              안내 건너뛰기
            </button>
            {/* 광고가 990원을 말했다. 첫 화면에서 그 값이 안 보이면 다음 화면까지
                반신반의로 걷게 된다 - 확인은 도착 즉시가 가장 싸다. */}
            <p className="lp-price">
              미리보기는 무료 · 전체 리포트 <strong>990원</strong> <s>12,900원</s>
            </p>
          </div>
        </div>
      ) : (
        <div className="lp-situation">
          <h2 className="lp-h2">지금 상황과 가장 가까운 것을 골라주세요</h2>
          <ul className="lp-choices">
            {SITUATIONS.map((label) => (
              <li key={label}>
                <button
                  type="button"
                  className={`lp-choice${picked === label ? " is-picked" : ""}`}
                  aria-pressed={picked === label}
                  onClick={() => setPicked(label)}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
          <div className="lp-cta-wrap">
            <span className="lp-participant-badge" aria-label={`${INNER_MIND_PARTICIPANT_COUNT}명이 참여함`}>
              <span aria-hidden="true">🔥</span> {INNER_MIND_PARTICIPANT_COUNT}명이 참여함
            </span>
            <button type="button" className="btn lp-cta" onClick={go} disabled={!picked}>
              미리보기로 이동
            </button>
            {/* 광고가 990원을 말하면 랜딩도 990원을 말해야 한다. 도착지에서만
                처음 보면 그 순간이 곧 이탈이다. */}
            <p className="lp-price">
              미리보기는 무료 · 전체 리포트 <strong>990원</strong>
              <span aria-hidden> </span>
              <s>12,900원</s>
            </p>
          </div>
          <p className="lp-note">고른 항목은 해석에만 쓰이고, 주소창이나 광고 기록에는 남지 않아요.</p>
        </div>
      )}

      {showSignup ? (
        <SignupModal
          title="로그인하고 무료로 시작하기"
          nextPath={FORM_PATH}
          reason="로그인 후 썸 해부 사주 입력 화면으로 바로 이어져요."
          onDone={() => {
            setShowSignup(false);
            setShowReady(true);
          }}
          onClose={() => setShowSignup(false)}
        />
      ) : null}
      {showReady ? <AuthReadyTransition href={FORM_PATH} /> : null}
    </div>
  );
}
