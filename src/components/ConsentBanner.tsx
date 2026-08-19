"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readConsent, writeConsent } from "@/lib/consent";

// 쿠키 동의 배너 — 선택하기 전까지 마케팅 이벤트는 하나도 발송되지 않는다.
// 서비스 이용에 필요한 기능(로그인·결제)은 동의 여부와 무관하게 동작한다.
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readConsent() === "unset");
  }, []);

  if (!visible) return null;

  const choose = (state: "granted" | "denied") => {
    writeConsent(state);
    setVisible(false);
  };

  return (
    <div className="consent-banner" role="dialog" aria-live="polite" aria-label="쿠키 사용 동의">
      <p className="consent-banner-text">
        광고 성과 측정을 위해 마케팅 쿠키를 사용해도 될까요? 거부해도 리딩과 신당 대화는 그대로 이용할 수 있어요.{" "}
        <Link href="/privacy">개인정보처리방침</Link>
      </p>
      <div className="consent-banner-actions">
        <button type="button" className="btn btn-ghost consent-btn" onClick={() => choose("denied")}>
          거부
        </button>
        <button type="button" className="btn consent-btn" onClick={() => choose("granted")}>
          동의
        </button>
      </div>
    </div>
  );
}
