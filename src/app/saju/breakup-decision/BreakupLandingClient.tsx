"use client";

import { useEffect } from "react";
import Link from "next/link";
import SignupModal from "@/components/SignupModal";
import AuthReadyTransition from "@/components/AuthReadyTransition";
import { useState } from "react";
import { getUser } from "@/lib/user";
import { trackPreviewStarted, trackViewContent } from "@/lib/meta-events";
import { AD_OFFERS } from "@/lib/ad-offers";

const OFFER = AD_OFFERS.breakup_decision_990;
const LANDING = OFFER.landingType;
const FORM_PATH = `/reading?c=${OFFER.category}&offer=${OFFER.id}`;

// 랜딩 조회 1회 기록. 동의 전에는 헬퍼 내부에서 아무것도 보내지 않는다.
export function LandingTracker() {
  useEffect(() => {
    trackViewContent(LANDING);
  }, []);
  return null;
}

// CTA는 로그인 팝업을 먼저 띄우되, 로그인 후 같은 설문 단계로 정확히 복귀시킨다.
function CtaButton({ className, children }: { className: string; children: React.ReactNode }) {
  const [showSignup, setShowSignup] = useState(false);
  const [showReady, setShowReady] = useState(false);

  return (
    <>
      <Link
        href={FORM_PATH}
        className={className}
        onClick={(event) => {
          trackPreviewStarted(LANDING);
          if (getUser()) {
            event.preventDefault();
            if (!showReady) setShowReady(true);
            return;
          }
          event.preventDefault();
          setShowSignup(true);
        }}
      >
        {children}
      </Link>
      {showSignup ? (
        <SignupModal
          title={OFFER.loginTitle}
          nextPath={FORM_PATH}
          reason={OFFER.loginReason}
          onDone={() => {
            setShowSignup(false);
            setShowReady(true);
          }}
          onClose={() => setShowSignup(false)}
        />
      ) : null}
      {showReady ? <AuthReadyTransition href={FORM_PATH} /> : null}
    </>
  );
}

export function HeroCta() {
  return (
    <CtaButton className="btn lp-cta">관계 판정 시작하기</CtaButton>
  );
}

export function StickyCta() {
  return (
    <div className="lp-sticky">
      <CtaButton className="btn lp-cta lp-cta-sticky">판정 이어서 보기</CtaButton>
    </div>
  );
}
