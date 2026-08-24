"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import AuthReadyTransition from "@/components/AuthReadyTransition";
import { getUser } from "@/lib/user";

// 상품 상세·광고 랜딩의 고정 CTA.
//
// 여기서 로그인을 묻지 않는다 (2026-08-24, 운영자 결정).
//
// 예전에는 이 버튼을 누르는 순간 로그인 팝업이 떴다. 광고비를 태워 데려온
// 사람이 **아무것도 못 본 상태에서** 회원가입부터 요구받는 구조였다. 값도
// 안 보고 미리보기도 안 본 사람에게 가입을 묻는 자리라 거기서 대부분 빠졌다.
//
// 이제 곧장 입력 폼(/reading)으로 보낸다. 로그인은 폼을 다 채운 뒤,
// 무료 미리보기를 만들기 직전에 묻는다 (app/reading/page.tsx 의 submit).
// 그때는 생년월일·시간·상대 정보·고민까지 들여놓은 뒤라 같은 질문이라도
// 무게가 다르다. 입력한 것은 draft 로 저장돼 로그인 뒤 그대로 이어진다.
//
// 값이 새지는 않는다 - /api/reading 이 로그인 없이는 401 이라, 게이트를
// 뒤로 옮겨도 비로그인 상태로 AI 호출이 나가는 일은 없다.
export default function ProductCtaGate({
  href,
  className,
  children,
  onClick,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  const [showReady, setShowReady] = useState(false);

  return (
    <>
      <Link
        href={href}
        className={className}
        onClick={(e) => {
          onClick?.();
          // 이미 로그인한 사람에게는 전환 연출을 한 번 끼운다. 비로그인은
          // 연출 없이 바로 폼으로 - 처음 온 사람에게 한 박자라도 덜 세운다.
          if (getUser()) {
            e.preventDefault();
            if (!showReady) setShowReady(true);
          }
        }}
      >
        {children}
      </Link>

      {showReady ? <AuthReadyTransition href={href} /> : null}
    </>
  );
}
