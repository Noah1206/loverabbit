"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import SignupModal from "@/components/SignupModal";
import { getUser } from "@/lib/user";
import { trackPreviewStarted, trackViewContent } from "@/lib/meta-events";

const LANDING = "inner_mind" as const;
const FORM_PATH = "/reading?c=sseom";

// 개인화 질문 — 일반적 상황 선택지만 제공한다.
// 선택값은 이 기기의 sessionStorage에만 남기고, URL·광고 이벤트·로그에 넣지 않는다.
const SITUATIONS = [
  "관계가 멀어진 느낌",
  "연락이 뜸해진 관계",
  "헤어진 뒤 남은 질문",
  "말하기 어려운 관계",
] as const;

const SITUATION_KEY = "loverabbit-inner-mind-situation";

export function LandingTracker() {
  useEffect(() => {
    trackViewContent(LANDING);
  }, []);
  return null;
}

export default function InnerMindFlow() {
  const router = useRouter();
  // 연출을 본 사람과 건너뛴 사람이 같은 설문·미리보기에 도달한다.
  const [stage, setStage] = useState<"intro" | "situation">("intro");
  const [picked, setPicked] = useState<string | null>(null);
  const [showSignup, setShowSignup] = useState(false);

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
    router.push(FORM_PATH);
  };

  return (
    <div className="lp-flow">
      {stage === "intro" ? (
        <div className="lp-intro">
          {/* 광고 소재가 해월신당·해월도령으로 나가므로 랜딩 첫 화면도 같은 얼굴로 받는다. */}
          <div className="lp-intro-art">
            <Image
              src="/characters/haewol.jpg"
              alt="해월도령"
              fill
              priority
              sizes="(max-width: 640px) 100vw, 480px"
              style={{ objectFit: "cover", objectPosition: "center 22%" }}
            />
            <span className="lp-intro-art-tag">해월신당</span>
          </div>
          <p className="lp-intro-line">
            말로 다 묻지 못한 것들이 있다면, 하나씩 정리해 볼까요.
          </p>
          <div className="lp-intro-actions">
            <button type="button" className="btn lp-cta" onClick={() => setStage("situation")}>
              속마음 미리보기 시작하기
            </button>
            <button
              type="button"
              className="lp-skip"
              onClick={() => setStage("situation")}
            >
              안내 건너뛰기
            </button>
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
          <button type="button" className="btn lp-cta" onClick={go} disabled={!picked}>
            미리보기로 이동
          </button>
          <p className="lp-note">고른 항목은 해석에만 쓰이고, 주소창이나 광고 기록에는 남지 않아요.</p>
        </div>
      )}

      {showSignup ? (
        <SignupModal
          nextPath={FORM_PATH}
          reason="미리보기 결과를 저장하려면 로그인이 필요해요"
          onDone={() => {
            setShowSignup(false);
            router.push(FORM_PATH);
          }}
          onClose={() => setShowSignup(false)}
        />
      ) : null}
    </div>
  );
}
