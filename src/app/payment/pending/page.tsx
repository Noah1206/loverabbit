"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { listArchive, updateArchive } from "@/lib/archive";
import { getUser } from "@/lib/user";

type PaymentStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded";

type StatusResponse = {
  orderId: number;
  readingId: string;
  status: PaymentStatus;
  amount: number;
  depositorCode: string | null;
  requestedAt: string;
  paidAt: string | null;
};

export default function PaymentPendingPage() {
  const router = useRouter();
  const finishingRef = useRef(false);
  const [order, setOrder] = useState<StatusResponse | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const orderId = Number(new URLSearchParams(window.location.search).get("orderId"));
    const user = getUser();

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      setError("주문 번호가 올바르지 않아요.");
      setChecking(false);
      return;
    }
    if (!user) {
      setError("입금 확인 상태를 보려면 다시 로그인해주세요.");
      setChecking(false);
      return;
    }

    const finishApprovedPayment = async (status: StatusResponse) => {
      if (finishingRef.current || stopped) return;
      finishingRef.current = true;
      setChecking(true);
      const archive = listArchive().find((entry) => entry.readingId === status.readingId);
      const response = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readingId: status.readingId,
          blob: archive?.blob,
          userToken: user.token,
        }),
      });
      const data = await response.json();
      if (!response.ok || typeof data.full !== "string") {
        finishingRef.current = false;
        throw new Error(data.error ?? "승인된 리딩을 열지 못했어요.");
      }
      updateArchive(status.readingId, {
        full: data.full,
        score: data.score ?? null,
        scoreBand: data.scoreBand ?? null,
        scoreFactors: data.scoreFactors ?? [],
        pendingOrderId: undefined,
      });
      router.replace(`/reading/${encodeURIComponent(status.readingId)}?payment=approved`);
    };

    const checkStatus = async () => {
      try {
        setChecking(true);
        const response = await fetch("/api/payment/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, userToken: user.token }),
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "입금 확인 상태를 불러오지 못했어요.");
        if (stopped) return;
        const next = data as StatusResponse;
        setOrder(next);
        setError("");

        if (next.status === "paid") {
          await finishApprovedPayment(next);
          return;
        }
        if (next.status === "cancelled" || next.status === "failed" || next.status === "refunded") {
          updateArchive(next.readingId, { pendingOrderId: undefined });
          setChecking(false);
          return;
        }
        timer = setTimeout(checkStatus, 3000);
      } catch (reason) {
        if (stopped) return;
        setError(reason instanceof Error ? reason.message : "입금 확인 상태를 불러오지 못했어요.");
        setChecking(false);
      }
    };

    void checkStatus();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [retryNonce, router]);

  const rejected = order && order.status !== "pending" && order.status !== "paid";

  return (
    <main className="container payment-pending-page">
      <section className="card payment-pending-card">
        <div className={`payment-status-orb${rejected ? " rejected" : ""}`} aria-hidden>
          {rejected ? "×" : order?.status === "paid" ? "✓" : "₩"}
        </div>
        <span className="badge">계좌이체 확인</span>
        <h1>{rejected ? "입금 승인이 보류됐어요" : "입금 확인을 기다리고 있어요"}</h1>
        <p>
          관리자가 통장 입금 내역과 입금코드를 확인하면 자동으로 풀 리딩이 열리고
          <strong> 내 상담 페이지로 이동합니다.</strong>
        </p>

        {order && (
          <dl className="payment-order-summary">
            <div><dt>주문번호</dt><dd>#{order.orderId}</dd></div>
            <div><dt>결제금액</dt><dd>{order.amount.toLocaleString()}원</dd></div>
            <div><dt>입금코드</dt><dd>{order.depositorCode ?? "확인 중"}</dd></div>
            <div><dt>현재상태</dt><dd>{rejected ? "확인 필요" : "승인 대기"}</dd></div>
          </dl>
        )}

        {!rejected && (
          <div className="payment-polling-note">
            <span className="payment-polling-dot" aria-hidden />
            {checking ? "3초마다 승인 여부를 확인하고 있어요" : "상태 확인을 다시 시도해주세요"}
          </div>
        )}

        {error && <p className="payment-error">{error}</p>}

        <div className="payment-pending-actions">
          <button className="btn" onClick={() => setRetryNonce((value) => value + 1)} disabled={checking && !error}>
            지금 다시 확인하기
          </button>
          <Link className="btn btn-ghost" href="/my">내 상담으로 돌아가기</Link>
        </div>
        <small>입금코드가 다르면 확인이 늦어질 수 있어요. 이 페이지는 닫지 않아도 됩니다.</small>
      </section>
    </main>
  );
}
