"use client";

/*
  결제 화면.

  리딩 주소는 이제 돈을 낸 사람만 들어간다. 그 앞에 서는 자리가 여기다.

  여기서는 명식도 목차도 보여주지 않는다 (2026-08-26 운영자 결정). 사기 전에
  보이는 것은 무엇을 사는지와 얼마인지, 어디로 보내는지 셋뿐이다. 명식은 계산이
  공짜라 보여줄 수도 있었지만, 그것부터 읽기 시작하면 결제 화면이 다시 읽을거리가
  된다 — 표지에서 119명이 그만두던 자리가 그런 화면이었다.

  글은 아직 없다. 입금이 승인되는 순간 서버가 만든다(reading-gate.ts).
*/

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import PaymentModal from "@/components/PaymentModal";
import { uploadReceipt } from "@/lib/receipt-upload";
import { listArchive, updateArchive, type ArchiveEntry } from "@/lib/archive";
import { readAttribution } from "@/lib/attribution";
import { hasMarketingConsent } from "@/lib/consent";
import { trackFunnel } from "@/lib/funnel";
import { PRODUCT_MAP } from "@/lib/products";
import { getUser, type User } from "@/lib/user";

export default function ReadingCheckoutPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const router = useRouter();

  const [entry, setEntry] = useState<ArchiveEntry | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const found = listArchive().find((row) => row.readingId === id) ?? null;
    const stored = getUser();
    setEntry(found);
    setUser(stored);
    setReady(true);
    if (!found) return;
    // 이미 열린 리딩은 여기 있을 이유가 없다. 결제한 사람을 결제 화면에 세우면
    // 두 번 낸 줄 안다.
    if (found.full) {
      router.replace(`/reading/${id}`);
      return;
    }
    if (found.pendingOrderId) {
      router.replace(`/payment/pending?orderId=${encodeURIComponent(String(found.pendingOrderId))}`);
      return;
    }
    trackFunnel("checkout_opened", { product: found.category });
  }, [id, router]);

  const depositorCode = entry ? `레빗-${entry.readingId.slice(0, 4).toUpperCase()}` : "";

  const confirmTransfer = useCallback(
    async (couponId: string | undefined, receipt: File) => {
      if (!entry) return;
      setPaying(true);
      setError("");
      // 계좌번호를 보고 닫은 사람과 실제로 보낸 사람은 다르다. 여기가 그 경계다.
      trackFunnel("checkout_submitted", { product: entry.category });
      try {
        const res = await fetch("/api/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            readingId: entry.readingId,
            blob: entry.blob,
            method: "transfer",
            depositorCode,
            userToken: user?.token,
            couponId,
            // 어느 광고가 팔았는지. 승인은 몇 시간 뒤에 나고 그때는 이 기기가 없다.
            attribution: readAttribution(),
            marketingConsent: hasMarketingConsent(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "입금 확인 요청 실패");
        if (!Number.isSafeInteger(Number(data.orderId))) {
          throw new Error("승인 대기 주문 번호를 받지 못했어요.");
        }
        updateArchive(entry.readingId, { pendingOrderId: Number(data.orderId) });
        // 사진은 주문 뒤에 붙는다. 실패해도 주문은 살아 있다 — 대기 화면이 다시 받는다.
        const sent = await uploadReceipt(Number(data.orderId), user?.token, receipt);
        router.push(
          `/payment/pending?orderId=${encodeURIComponent(String(data.orderId))}${sent ? "&receipt=sent" : ""}`
        );
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "결제 처리 중 오류가 발생했습니다.");
      } finally {
        setPaying(false);
      }
    },
    [entry, depositorCode, user, router]
  );

  if (!ready) {
    return (
      <main className="container reading-flow-page">
        <p className="reading-checkout-note" aria-live="polite">불러오는 중…</p>
      </main>
    );
  }

  if (!entry) {
    return (
      <main className="container reading-flow-page">
        <div className="card reading-checkout-card">
          <h1>결제할 사주를 찾지 못했어요</h1>
          <p>사주는 받은 기기에 보관돼요. 다른 기기·브라우저에서 세운 것은 여기서 열 수 없어요.</p>
          <Link className="btn" href="/reading">새 사주 세우기 →</Link>
        </div>
      </main>
    );
  }

  const label = PRODUCT_MAP[entry.category]?.shortLabel ?? entry.label;

  return (
    <main className="container reading-flow-page">
      {/*
        PaymentModal 을 그대로 쓴다. 이 화면 전용 결제 폼을 따로 만들면 계좌·쿠폰·
        입금 확인이 두 벌이 되고, 그중 하나는 반드시 뒤처진다. 원래도 화면 전체를
        덮는 모양이라 페이지로 세워도 같은 그림이다.
      */}
      <PaymentModal
        readingId={entry.readingId}
        price={entry.price}
        userToken={user?.token ?? ""}
        customerEmail={user?.email ?? ""}
        depositorCode={depositorCode}
        paying={paying}
        onTransferSubmitted={confirmTransfer}
        onClose={() => router.push("/my")}
      />
      {error && (
        <p className="reading-checkout-error" role="alert">
          {error}
        </p>
      )}
      <p className="reading-checkout-note">{label} · 입금이 확인되면 전문이 열립니다.</p>
    </main>
  );
}
