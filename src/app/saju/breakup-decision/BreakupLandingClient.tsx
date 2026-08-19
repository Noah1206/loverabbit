"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SignupModal from "@/components/SignupModal";
import { useState } from "react";
import { getUser } from "@/lib/user";
import { trackPreviewStarted, trackViewContent } from "@/lib/meta-events";

const LANDING = "breakup_decision" as const;
const FORM_PATH = "/reading?c=ibyeol&offer=breakup_decision_990";

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
          title="로그인하고 무료로 시작하기"
          nextPath={FORM_PATH}
          reason="로그인 후 이별 사주 입력 화면으로 바로 이어져요."
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
