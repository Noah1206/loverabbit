"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import SignupModal from "@/components/SignupModal";
import AuthReadyTransition from "@/components/AuthReadyTransition";
import { getUser } from "@/lib/user";

// 상품 상세 고정 CTA — 비로그인 사용자는 리딩 폼으로 넘어가기 전에 로그인 팝업부터 만난다.
// 로그인 후에는 next 파라미터로 곧장 해당 상품 리딩(/reading?c=...)으로 복귀한다.
export default function ProductCtaGate({
  href,
  className,
  children,
  onClick,
  signupTitle,
  signupReason,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  signupTitle?: string;
  signupReason?: string;
}) {
  const [showSignup, setShowSignup] = useState(false);
  const [showReady, setShowReady] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <>
      <Link
        href={href}
        className={className}
        onClick={(e) => {
          onClick?.();
          if (getUser()) {
            e.preventDefault();
            if (!showReady) setShowReady(true);
            return;
          }
          e.preventDefault();
          setShowSignup(true);
        }}
      >
        {children}
      </Link>

      {/* 고정 CTA 셸은 transform·backdrop-filter로 고정 위치 기준을 만들기 때문에 모달은 body로 포털한다 */}
      {showSignup && mounted
        ? createPortal(
            <SignupModal
              title={signupTitle}
              nextPath={href}
              reason={signupReason ?? "로그인 후 선택한 사주 입력 화면으로 바로 이어져요."}
              onDone={() => {
                setShowSignup(false);
                setShowReady(true);
              }}
              onClose={() => setShowSignup(false)}
            />,
            document.body
          )
        : null}
      {showReady ? <AuthReadyTransition href={href} /> : null}
    </>
  );
}
