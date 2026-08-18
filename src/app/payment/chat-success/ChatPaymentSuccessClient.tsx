"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { getUser, saveUser } from "@/lib/user";

export default function ChatPaymentSuccessClient({
  characterId,
  paymentKey,
  orderId,
  amount,
}: {
  characterId: string;
  paymentKey: string;
  orderId: string;
  amount: number;
}) {
  const started = useRef(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [error, setError] = useState("");
  const shrineHref = `/shrine/${encodeURIComponent(characterId || "hwarin")}?payment=approved`;

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const confirm = async () => {
      const user = getUser();
      if (!user) {
        setError("로그인 정보가 없어 결제를 승인하지 못했어요. 고객센터에 주문번호를 알려주세요.");
        return;
      }
      try {
        const response = await fetch("/api/chat-payment/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userToken: user.token,
            paymentKey,
            orderId,
            amount,
          }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          creditsRemaining?: number;
          error?: string;
        };
        if (!response.ok || typeof data.creditsRemaining !== "number") {
          throw new Error(data.error ?? "대화권 결제 승인을 완료하지 못했어요.");
        }
        saveUser({ ...user, chatCredits: data.creditsRemaining });
        setCredits(data.creditsRemaining);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "대화권 결제 승인을 완료하지 못했어요.");
      }
    };

    void confirm();
  }, [amount, orderId, paymentKey]);

  return (
    <main className="payment-result-shell">
      <section className="card payment-result-card">
        {error ? (
          <>
            <div className="payment-result-icon" aria-hidden>!</div>
            <span className="badge">승인 확인 필요</span>
            <h1>결제를 확인하고 있어요</h1>
            <p className="payment-result-error" role="alert">{error}</p>
            <p className="payment-order-reference">주문번호 {orderId}</p>
            <Link className="btn" href={shrineHref}>대화로 돌아가기</Link>
          </>
        ) : credits !== null ? (
          <>
            <div className="payment-result-icon" aria-hidden>✓</div>
            <span className="badge">결제 완료</span>
            <h1>대화권이 충전됐어요</h1>
            <p>현재 대화권 <strong>{credits}회</strong> · 끊긴 대화부터 바로 이어갈 수 있어요.</p>
            <Link className="btn" href={shrineHref}>캐릭터에게 돌아가기 →</Link>
          </>
        ) : (
          <>
            <div className="auth-loader" aria-label="결제 승인 처리 중" />
            <h1>대화권을 충전하고 있어요</h1>
            <p>창을 닫지 말고 잠시만 기다려주세요.</p>
          </>
        )}
      </section>
    </main>
  );
}
