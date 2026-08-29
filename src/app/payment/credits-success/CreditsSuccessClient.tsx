"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { getUser } from "@/lib/user";

// 포트원 결제창에서 돌아온 자리. 서버가 결제를 다시 조회해 지급한다.
export default function CreditsSuccessClient({
  paymentId,
  portOneCode,
  portOneMessage,
}: {
  paymentId: string;
  portOneCode: string;
  portOneMessage: string;
}) {
  const started = useRef(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const confirm = async () => {
      if (portOneCode) {
        setError(portOneMessage || "계좌이체를 완료하지 못했어요.");
        return;
      }
      const user = getUser();
      if (!user) {
        setError("로그인 정보가 없어 결제를 승인하지 못했어요. 고객센터에 주문번호를 알려주세요.");
        return;
      }
      try {
        const res = await fetch("/api/credits/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userToken: user.token, paymentId }),
        });
        const data = (await res.json().catch(() => ({}))) as { creditsRemaining?: number; error?: string };
        if (!res.ok || typeof data.creditsRemaining !== "number") {
          throw new Error(data.error ?? "크레딧 결제 승인을 완료하지 못했어요.");
        }
        setCredits(data.creditsRemaining);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "크레딧 결제 승인을 완료하지 못했어요.");
      }
    };
    void confirm();
  }, [paymentId, portOneCode, portOneMessage]);

  return (
    <main className="payment-result-shell">
      <section className="card payment-result-card">
        {error ? (
          <>
            <div className="payment-result-icon" aria-hidden>!</div>
            <span className="badge">승인 확인 필요</span>
            <h1>결제를 확인하고 있어요</h1>
            <p className="payment-result-error" role="alert">{error}</p>
            <p className="payment-order-reference">주문번호 {paymentId || "확인 중"}</p>
            <Link className="btn" href="/credits">크레딧함으로</Link>
          </>
        ) : credits !== null ? (
          <>
            <div className="payment-result-icon" aria-hidden>✓</div>
            <span className="badge">결제 완료</span>
            <h1>크레딧이 충전됐어요</h1>
            <p>현재 <strong>{credits}크레딧</strong></p>
            <Link className="btn" href="/ask">질문하러 가기 →</Link>
          </>
        ) : (
          <>
            <div className="auth-loader" aria-label="결제 승인 처리 중" />
            <h1>크레딧을 충전하고 있어요</h1>
            <p>창을 닫지 말고 잠시만 기다려주세요.</p>
          </>
        )}
      </section>
    </main>
  );
}
