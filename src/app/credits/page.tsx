"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import PortOneTransferForm, { PORTONE_TRANSFER_CONFIGURED } from "@/components/PortOneTransferForm";
import SignupModal from "@/components/SignupModal";
import TransferSteps from "@/components/TransferSteps";
import { TRANSFER_ACCOUNTS } from "@/components/TransferAccounts";
import {
  CREDIT_PACKS,
  CREDIT_REASON_LABEL,
  QUESTION_COST,
  creditDepositorCode,
  questionsLeft,
  type CreditLedgerEntry,
  type CreditPack,
} from "@/lib/credits";
import { PAYMENT_METHOD_OPEN } from "@/lib/pay-method";
import { REFERRAL_REWARD_PARAM } from "@/lib/referral";
import { getUser, type User } from "@/lib/user";

/*
  크레딧함 — 잔액, 내역, 충전.

  결제 수단은 리딩과 같은 것을 같은 순서로 쓴다 (pay-method.ts). 지금은 직접
  송금만 열려 있다. 크레딧에는 쿠폰이 붙지 않는다 — 리딩은 쿠폰, 질문은 크레딧.
*/

export default function CreditsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [pack, setPack] = useState<CreditPack | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [approved, setApproved] = useState(false);
  const [shareNotice, setShareNotice] = useState("");

  const load = useCallback(async (account: User) => {
    const res = await fetch("/api/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userToken: account.token }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { balance: number; ledger: CreditLedgerEntry[] };
    setBalance(data.balance);
    setLedger(data.ledger);
  }, []);

  useEffect(() => {
    const stored = getUser();
    setUser(stored);
    setChecked(true);
    setApproved(new URLSearchParams(window.location.search).get("payment") === "approved");
    if (stored) void load(stored);
  }, [load]);

  const submitTransfer = async () => {
    if (!user || !pack || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/credits/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: user.token, packId: pack.id, depositorCode: creditDepositorCode(user.token) }),
      });
      const data = (await res.json().catch(() => ({}))) as { orderId?: number; error?: string };
      if (!res.ok || !data.orderId) throw new Error(data.error ?? "입금 확인 요청을 보내지 못했어요.");
      router.push(`/payment/pending?orderId=${encodeURIComponent(String(data.orderId))}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했어요.");
      setSubmitting(false);
    }
  };

  const share = async () => {
    if (!user?.referralCode) return;
    const url = `${window.location.origin}/reading?ref=${encodeURIComponent(user.referralCode)}&reward=${REFERRAL_REWARD_PARAM}`;
    const text = "러브레빗에서 내 연애 사주 무료로 미리 봤어. 너도 해봐 🐰";
    try {
      if (navigator.share) await navigator.share({ title: "러브레빗 무료 사주", text, url });
      else await navigator.clipboard.writeText(`${text}\n${url}`);
      setShareNotice("초대 링크를 보냈어요. 친구가 열면 5크레딧, 가입하면 5,000원 쿠폰이 들어와요.");
    } catch {
      setShareNotice("");
    }
  };

  if (!checked) return <main className="container" style={{ paddingTop: 48 }} />;

  const portone = PORTONE_TRANSFER_CONFIGURED && PAYMENT_METHOD_OPEN.portone;
  const manual = TRANSFER_ACCOUNTS.length > 0 && PAYMENT_METHOD_OPEN.manual;

  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <p style={{ color: "var(--accent)", fontWeight: 800, marginBottom: 8 }}>LOVE RABBIT CREDITS</p>
      <h1 style={{ marginBottom: 8 }}>질문 크레딧</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 20 }}>
        오늘의 질문 한 번에 {QUESTION_COST}크레딧. 100원이 1크레딧이에요.
      </p>

      {approved && (
        <p className="badge" style={{ marginBottom: 14 }}>입금이 확인됐어요. 크레딧이 들어왔어요.</p>
      )}

      <div className="card" style={{ padding: 20, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <strong style={{ fontSize: "1.3rem" }}>{balance === null ? "—" : `${balance}크레딧`}</strong>
          <p style={{ color: "var(--text-dim)", fontSize: "0.84rem" }}>
            {balance === null ? "로그인하면 잔액이 보여요" : `질문 ${questionsLeft(balance)}회 남음`}
          </p>
        </div>
        <Link className="btn" href="/ask" style={{ whiteSpace: "nowrap" }}>질문하러 가기</Link>
      </div>

      {!user ? (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <p style={{ color: "var(--text-dim)", marginBottom: 14 }}>가입하면 15크레딧을 드려요.</p>
          <button className="btn" style={{ width: "100%" }} onClick={() => setShowSignup(true)}>로그인 · 가입하기</button>
        </div>
      ) : (
        <>
          <section className="card" style={{ padding: 20, marginBottom: 14 }}>
            <span className="badge">무료로 채우기</span>
            <h2 style={{ fontSize: "1.1rem", margin: "10px 0 6px" }}>친구가 초대 링크를 열면 5크레딧</h2>
            <p style={{ color: "var(--text-dim)", fontSize: "0.86rem", marginBottom: 12 }}>
              기기 하나에 한 번, 하루 다섯 번까지. 친구가 가입까지 하면 5,000원 쿠폰이 따로 들어와요.
            </p>
            <button className="btn btn-ghost" style={{ width: "100%" }} onClick={share} disabled={!user.referralCode}>
              초대 링크 보내기
            </button>
            {shareNotice && <p style={{ color: "var(--gold)", fontSize: "0.82rem", marginTop: 10 }}>{shareNotice}</p>}
          </section>

          <section className="card" style={{ padding: 20, marginBottom: 14 }}>
            <span className="badge">충전</span>
            <div style={{ display: "grid", gap: 10, margin: "12px 0" }}>
              {CREDIT_PACKS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`btn ${pack?.id === p.id ? "" : "btn-ghost"}`}
                  style={{ display: "flex", justifyContent: "space-between", width: "100%" }}
                  onClick={() => setPack(p)}
                >
                  <span>{p.credits}크레딧 · {p.note}</span>
                  <strong>{p.price.toLocaleString()}원</strong>
                </button>
              ))}
            </div>
            {pack && (
              portone ? (
                <PortOneTransferForm
                  amount={pack.price}
                  customerEmail={user.email}
                  checkoutEndpoint="/api/credits/checkout"
                  checkoutBody={{ userToken: user.token, packId: pack.id }}
                  redirectPath="/payment/credits-success"
                  buttonLabel={`${pack.price.toLocaleString()}원 계좌이체하고 충전`}
                />
              ) : manual ? (
                <div className="transfer-payment-fallback">
                  <p style={{ color: "var(--text-dim)", fontSize: "0.84rem", marginBottom: 10 }}>
                    입금자명에 <strong>{creditDepositorCode(user.token)}</strong> 를 적어 주세요. 확인되면 바로 들어와요.
                  </p>
                  <TransferSteps amount={pack.price} submitting={submitting} onSubmit={() => void submitTransfer()} />
                </div>
              ) : (
                <p className="toss-payment-config-error" role="alert">결제 수단 설정이 아직 완료되지 않았어요.</p>
              )
            )}
            {error && <p className="toss-payment-error" role="alert">{error}</p>}
          </section>

          {ledger.length > 0 && (
            <section className="card" style={{ padding: 20 }}>
              <span className="badge">내역</span>
              <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 8 }}>
                {ledger.map((row) => (
                  <li key={row.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                    <span>
                      {CREDIT_REASON_LABEL[row.reason]}
                      <small style={{ color: "var(--text-dim)", marginLeft: 8 }}>{new Date(row.createdAt).toLocaleDateString("ko-KR")}</small>
                    </span>
                    <strong style={{ color: row.delta > 0 ? "var(--gold)" : "inherit" }}>
                      {row.delta > 0 ? `+${row.delta}` : row.delta}
                    </strong>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {showSignup && (
        <SignupModal
          reason="크레딧은 계정에 묶여 있어요. 가입하면 15크레딧을 드려요."
          onDone={(next) => {
            setUser(next);
            setShowSignup(false);
            void load(next);
          }}
          onClose={() => setShowSignup(false)}
        />
      )}
    </main>
  );
}
