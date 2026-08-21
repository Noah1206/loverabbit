"use client";

import Link from "next/link";
import { readAttribution } from "@/lib/attribution";
import { useEffect, useRef, useState } from "react";
import { listArchive, updateArchive, type ArchiveEntry } from "@/lib/archive";
import { landingTypeForProduct, trackPurchase } from "@/lib/meta-events";
import { getUser } from "@/lib/user";
import type { StructuredReport } from "@/lib/reading-prompt";

export default function PaymentSuccessClient({
  readingId,
  paymentKey,
  orderId,
  amount,
}: {
  readingId: string;
  paymentKey: string;
  orderId: string;
  amount: number;
}) {
  const started = useRef(false);
  const [full, setFull] = useState("");
  const [error, setError] = useState("");

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
        const response = await fetch("/api/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            readingId,
            method: "toss-pg",
            userToken: user.token,
            attribution: readAttribution(),
            paymentKey,
            orderId,
            amount,
          }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          full?: string;
          score?: number;
          scoreBand?: string | null;
          scoreFactors?: { label: string; delta: number; basis: string; timeVarying?: boolean }[];
          scoreAsOf?: ArchiveEntry["scoreAsOf"];
          report?: StructuredReport | null;
          error?: string;
        };
        if (!response.ok || !data.full) {
          throw new Error(data.error ?? "결제 승인을 완료하지 못했어요.");
        }
        // 전문만 받아 적고 지수를 버리면 해금 뒤에도 게이지가 "??%"로 남는다
        updateArchive(readingId, {
          full: data.full,
          score: data.score ?? null,
          scoreBand: data.scoreBand ?? null,
          scoreFactors: data.scoreFactors ?? [],
          scoreAsOf: data.scoreAsOf ?? null,
          report: data.report ?? null,
        });
        // 전환 기록 — 클라이언트 Pixel과 서버 CAPI가 같은 event_id로 한 번씩 보낸다.
        const archiveEntry = listArchive().find((entry) => entry.readingId === readingId);
        void trackPurchase({
          value: amount,
          currency: "KRW",
          transactionId: orderId,
          landingType: landingTypeForProduct(archiveEntry?.category, archiveEntry?.offerId) ?? undefined,
        });
        setFull(data.full);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "결제 승인을 완료하지 못했어요.");
      }
    };

    void confirm();
  }, [amount, orderId, paymentKey, readingId]);

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
            <Link className="btn" href={`/reading/${encodeURIComponent(readingId)}`}>내 리딩에서 다시 확인하기</Link>
          </>
        ) : full ? (
          <>
            <div className="payment-result-icon" aria-hidden>✓</div>
            <span className="badge">결제 완료</span>
            <h1>전문 리딩이 열렸어요</h1>
            <p className="payment-full-lead">{full.slice(0, 90)}…</p>
            <Link className="btn" href={`/reading/${encodeURIComponent(readingId)}?payment=approved`}>
              전문 리딩 읽으러 가기 →
            </Link>
          </>
        ) : (
          <>
            <div className="auth-loader" aria-label="결제 승인 처리 중" />
            <h1>결제를 안전하게 승인하고 있어요</h1>
            <p>창을 닫지 말고 잠시만 기다려주세요.</p>
          </>
        )}
      </section>
    </main>
  );
}
