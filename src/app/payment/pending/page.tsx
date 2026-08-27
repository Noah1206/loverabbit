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
  /** 운영자가 승인·거절하며 손님에게 남긴 말 */
  note?: string | null;
};

export default function PaymentPendingPage() {
  const router = useRouter();
  const finishingRef = useRef(false);
  const [order, setOrder] = useState<StatusResponse | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [retryNonce, setRetryNonce] = useState(0);
  // 이체 화면 캡처. 올리면 운영자가 텔레그램에서 사진을 보고 바로 승인한다.
  // 결제 화면에서 사진을 올리고 왔으면(?receipt=sent) 처음부터 "받았어요" 로 시작한다.
  const [receipt, setReceipt] = useState<"idle" | "sending" | "sent">(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("receipt") === "sent"
      ? "sent"
      : "idle"
  );
  const [receiptError, setReceiptError] = useState("");

  const uploadReceipt = async (file: File | undefined) => {
    if (!file || !order) return;
    const user = getUser();
    if (!user?.token) {
      setReceiptError("로그인이 풀렸어요. 다시 로그인해주세요.");
      return;
    }
    setReceipt("sending");
    setReceiptError("");
    try {
      const form = new FormData();
      form.set("orderId", String(order.orderId));
      form.set("userToken", user.token);
      form.set("file", file);
      const res = await fetch("/api/payment/receipt", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "사진을 보내지 못했어요.");
      setReceipt("sent");
    } catch (reason) {
      setReceipt("idle");
      setReceiptError(reason instanceof Error ? reason.message : "사진을 보내지 못했어요.");
    }
  };

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
        scoreAsOf: data.scoreAsOf ?? null,
        report: data.report ?? null,
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
        <h1>
          {rejected ? "입금 승인이 보류됐어요" : "입금 확인을 기다리고 있어요"}
        </h1>
        {rejected ? (
          <p>
            <strong>계좌에서 입금을 찾지 못했어요.</strong> 이체가 실제로 빠져나갔는지
            확인한 뒤 다시 요청해주세요. 이미 보내셨다면 다시 요청하면서
            <strong> 이체 완료 화면 캡처를 올려주세요</strong> — 사진을 보고 바로 승인해드릴게요.
          </p>
        ) : (
          <p>
            관리자가 입금을 확인하면 자동으로 풀 리딩이 열리고
            <strong> 내 상담 페이지로 이동합니다.</strong>
          </p>
        )}

        {order && (
          <dl className="payment-order-summary">
            <div><dt>주문번호</dt><dd>#{order.orderId}</dd></div>
            <div><dt>결제금액</dt><dd>{order.amount.toLocaleString()}원</dd></div>
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

        {/* 캡처 한 장이 통장 대조보다 빠르다. 운영자는 사진을 보고 승인하고,
            통장은 나중에 맞춘다. 사진 없이도 승인은 되므로 강요하지 않는다. */}
        {!rejected && order?.status === "pending" && (
          <div className={`payment-receipt${receipt === "sent" ? " sent" : ""}`}>
            {receipt === "sent" ? (
              <p>
                <strong>이체 화면을 받았어요.</strong> 관리자가 사진을 보고 바로 승인해드릴게요.
              </p>
            ) : (
              <>
                <p>
                  <strong>더 빨리 열고 싶다면</strong> 이체 완료 화면을 올려주세요. 사진을 보고 바로 승인해드려요.
                </p>
                <label className={`btn payment-receipt-btn${receipt === "sending" ? " busy" : ""}`}>
                  {receipt === "sending" ? "보내는 중…" : "📷 이체 완료 화면 올리기"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={receipt === "sending"}
                    onChange={(event) => {
                      void uploadReceipt(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
              </>
            )}
            {receiptError && <p className="payment-error">{receiptError}</p>}
          </div>
        )}


        {order?.note && (
          <div className="payment-admin-note" role="status">
            <strong>운영자 메모</strong>
            <p>{order.note}</p>
          </div>
        )}


        <div className="payment-pending-actions">
          {rejected && order?.readingId ? (
            <Link className="btn" href={`/reading/${encodeURIComponent(order.readingId)}/checkout`}>
              다시 요청하고 이체 화면 올리기
            </Link>
          ) : (
            <button className="btn" onClick={() => setRetryNonce((value) => value + 1)} disabled={checking && !error}>
              지금 다시 확인하기
            </button>
          )}
          <Link className="btn btn-ghost" href="/my">내 상담으로 돌아가기</Link>
        </div>
        <small>입금코드가 다르면 확인이 늦어질 수 있어요. 이 페이지는 닫지 않아도 됩니다.</small>
      </section>
    </main>
  );
}
