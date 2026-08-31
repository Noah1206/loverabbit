"use client";

/*
  결제 화면 — 크레딧으로 연다 (2026-08-31).

  리딩 주소는 돈을 낸 사람만 들어간다. 그 앞에 서는 자리가 여기다.
  보이는 것은 셋뿐이다: 무엇을 사는지, 몇 크레딧인지, 잔액이 되는지.

  원화 결제창(PaymentModal)은 이 화면에서 물러났다 — 크레딧이 단일 화폐다.
  서버의 계좌이체·포트원 경로는 남아 있다(세트 0원 쿠폰이 그 길을 쓴다).

  글은 아직 없다. 크레딧이 깎이는 순간 서버가 만든다(reading-gate.ts).
*/

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import SignupModal from "@/components/SignupModal";
import { listArchive, updateArchive, type ArchiveEntry } from "@/lib/archive";
import { saleCreditCost } from "@/lib/credits";
import { couponPrice, type Coupon } from "@/lib/coupons";
import { bundleOfReading } from "@/lib/bundles";
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
  const [balance, setBalance] = useState<number | null>(null);
  // 이 리딩을 0원으로 여는 쿠폰(세트 나머지 장). 있으면 크레딧보다 먼저 권한다.
  const [freeCoupon, setFreeCoupon] = useState<Coupon | null>(null);
  const [paying, setPaying] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
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
    // 크레딧 전환 전에 계좌이체를 보낸 사람 — 그 승인 흐름은 그대로 산다.
    if (found.pendingOrderId) {
      router.replace(`/payment/pending?orderId=${encodeURIComponent(String(found.pendingOrderId))}`);
      return;
    }
    trackFunnel("checkout_opened", { product: found.category });
    if (stored) {
      void fetch("/api/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: stored.token }),
      })
        .then(async (res) => (res.ok ? ((await res.json()) as { balance?: number }) : null))
        .then((data) => {
          if (typeof data?.balance === "number") setBalance(data.balance);
        })
        .catch(() => {});
      // 세트로 산 사람의 나머지 장은 0원 쿠폰으로 열린다. 크레딧 결제창이
      // 그 쿠폰을 못 보면 세트 약속("나머지 장은 무료")이 깨진다.
      void fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: stored.token }),
      })
        .then(async (res) => (res.ok ? ((await res.json()) as { coupons?: Coupon[] }) : null))
        .then((data) => {
          const free = (data?.coupons ?? []).find((item) => couponPrice(found.price, item) === 0) ?? null;
          setFreeCoupon(free);
        })
        .catch(() => {});
    }
  }, [id, router]);

  /*
    0원 쿠폰 해금 — 계좌이체 0원 경로를 그대로 탄다. 서버(/api/unlock transfer)가
    0원 주문을 만들고 그 자리에서 승인·생성까지 돌린다(reviewOrderAndFollowUp).
    크레딧 경로에 쿠폰 계산을 새로 넣으면 정산 로직이 두 벌이 된다.
  */
  const unlockWithCoupon = useCallback(async () => {
    if (!entry || !user || !freeCoupon || paying) return;
    setPaying(true);
    setError("");
    trackFunnel("checkout_submitted", { product: entry.category });
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readingId: entry.readingId,
          blob: entry.blob,
          method: "transfer",
          depositorCode: `레빗-${entry.readingId.slice(0, 4).toUpperCase()}`,
          userToken: user.token,
          couponId: freeCoupon.id,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (!res.ok || data.status !== "paid") throw new Error(data.error ?? "쿠폰 사용에 실패했어요.");
      trackFunnel("purchase_done", { product: entry.category });
      router.push(`/reading/${entry.readingId}?payment=approved`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "쿠폰 사용 중 오류가 발생했어요.");
    } finally {
      setPaying(false);
    }
  }, [entry, user, freeCoupon, paying, router]);

  const unlock = useCallback(async () => {
    if (!entry || paying) return;
    if (!user) {
      setShowSignup(true);
      return;
    }
    setPaying(true);
    setError("");
    trackFunnel("checkout_submitted", { product: entry.category });
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readingId: entry.readingId,
          blob: entry.blob,
          method: "credits",
          userToken: user.token,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        full?: string;
        report?: ArchiveEntry["report"];
        score?: number | null;
        scoreBand?: string | null;
        scoreFactors?: ArchiveEntry["scoreFactors"];
        scoreAsOf?: ArchiveEntry["scoreAsOf"];
        error?: string;
        needCredits?: boolean;
        balance?: number;
        paid?: boolean;
      };
      if (typeof data.balance === "number") setBalance(data.balance);
      if (!res.ok) {
        // 깎이긴 했는데 본문이 아직이다 — 리딩 화면이 "준비 중"을 안다.
        if (data.paid) {
          router.push(`/reading/${entry.readingId}?payment=approved`);
          return;
        }
        if (data.needCredits) {
          setError("");
          return; // 잔액 부족 안내는 아래 화면이 그린다
        }
        throw new Error(data.error ?? "결제에 실패했어요.");
      }
      if (typeof data.full === "string") {
        updateArchive(entry.readingId, {
          full: data.full,
          report: data.report ?? null,
          score: data.score ?? null,
          scoreBand: data.scoreBand ?? null,
          scoreFactors: data.scoreFactors ?? [],
          scoreAsOf: data.scoreAsOf ?? null,
          pendingOrderId: undefined,
        });
      }
      trackFunnel("purchase_done", { product: entry.category });
      router.push(`/reading/${entry.readingId}?payment=approved`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "결제 처리 중 오류가 발생했습니다.");
    } finally {
      setPaying(false);
    }
  }, [entry, user, paying, router]);

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
  const bundle = bundleOfReading(entry.category, entry.price);
  const cost = saleCreditCost(Boolean(bundle));
  const short = balance === null ? 0 : Math.max(0, cost - balance);
  const enough = balance !== null && balance >= cost;

  return (
    <main className="container reading-flow-page">
      <div className="card reading-checkout-card" style={{ display: "grid", gap: 12 }}>
        <h1 style={{ fontSize: "1.2rem" }}>{label} 전문 열기</h1>
        <p style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <b style={{ fontSize: "1.5rem", color: "var(--accent)" }}>{cost}러빗</b>
          {bundle && <small style={{ color: "var(--text-dim)" }}>세트 값 · 나머지 장 쿠폰 포함</small>}
        </p>
        <p style={{ color: "var(--text-dim)", fontSize: "0.86rem" }}>
          {user
            ? balance === null
              ? "잔액을 확인하는 중…"
              : `지금 잔액 ${balance}러빗`
            : "로그인하면 러빗으로 바로 열 수 있어요."}
        </p>

        {freeCoupon && (
          <button className="btn" style={{ width: "100%" }} onClick={() => void unlockWithCoupon()} disabled={paying}>
            {paying ? "여는 중…" : "세트 쿠폰으로 무료로 열기"}
          </button>
        )}
        {user && balance !== null && !enough && !freeCoupon ? (
          <>
            <p style={{ color: "var(--accent)", fontSize: "0.88rem" }}>
              {short}러빗이 모자라요. 충전하고 돌아오면 이 화면에서 바로 열려요.
            </p>
            <Link className="btn" href="/credits" style={{ width: "100%" }}>
              러빗 충전하러 가기
            </Link>
          </>
        ) : freeCoupon ? null : (
          <button className="btn" style={{ width: "100%" }} onClick={() => void unlock()} disabled={paying}>
            {paying ? "여는 중…" : user ? `${cost}러빗으로 열기` : "로그인하고 열기"}
          </button>
        )}
        <button className="btn btn-ghost" onClick={() => router.push("/my")}>나중에 열게요</button>
        {error && (
          <p className="reading-checkout-error" role="alert">{error}</p>
        )}
      </div>
      <p className="reading-checkout-note">100원이 1러빗이에요. 열리는 순간 전문이 만들어져요.</p>

      {showSignup && (
        <SignupModal
          reason="리딩은 계정에 묶여 보관돼요. 3초 로그인하고 열어 주세요."
          onClose={() => setShowSignup(false)}
        />
      )}
    </main>
  );
}
