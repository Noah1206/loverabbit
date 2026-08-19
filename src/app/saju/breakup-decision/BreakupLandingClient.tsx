"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SignupModal from "@/components/SignupModal";
import { useState } from "react";
import { getUser } from "@/lib/user";
import { trackPreviewStarted, trackViewContent } from "@/lib/meta-events";

const LANDING = "breakup_decision" as const;
const FORM_PATH = "/reading?c=ibyeol";

// 랜딩 조회 1회 기록. 동의 전에는 헬퍼 내부에서 아무것도 보내지 않는다.
export function LandingTracker() {
  useEffect(() => {
    trackViewContent(LANDING);
  }, []);
  return null;
}

// CTA는 로그인 팝업을 먼저 띄우되, 로그인 후 같은 설문 단계로 정확히 복귀시킨다.
function CtaButton({ className, children }: { className: string; children: React.ReactNode }) {
  const router = useRouter();
  const [showSignup, setShowSignup] = useState(false);

  return (
    <>
      <Link
        href={FORM_PATH}
        className={className}
        onClick={(event) => {
          trackPreviewStarted(LANDING);
          if (getUser()) return;
          event.preventDefault();
          setShowSignup(true);
        }}
      >
        {children}
      </Link>
      {showSignup ? (
        <SignupModal
          nextPath={FORM_PATH}
          reason="리딩 결과를 안전하게 받아보려면 로그인이 필요해요"
          onDone={() => {
            setShowSignup(false);
            router.push(FORM_PATH);
          }}
          onClose={() => setShowSignup(false)}
        />
      ) : null}
    </>
  );
}

export function HeroCta() {
  return (
    <CtaButton className="btn lp-cta">무료 관계 판정 시작하기</CtaButton>
  );
}

export function StickyCta() {
  return (
    <div className="lp-sticky">
      <CtaButton className="btn lp-cta lp-cta-sticky">무료 판정 이어서 보기</CtaButton>
    </div>
  );
}
