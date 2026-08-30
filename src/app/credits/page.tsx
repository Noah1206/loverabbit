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
  listPriceOf,
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
  // 서버가 정한다. 한 번이라도 산 사람에게는 정가 팩이 온다.
  const [packs, setPacks] = useState<CreditPack[]>(CREDIT_PACKS);
  const [firstBuy, setFirstBuy] = useState(false);
  // 가입 직후 여기로 넘어왔는가. 그러면 원래 가려던 화면으로 이어 갈 자리를 준다.
  const [welcome, setWelcome] = useState(false);
  const [nextPath, setNextPath] = useState<string | null>(null);

  const load = useCallback(async (account: User) => {
    const res = await fetch("/api/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userToken: account.token }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      balance: number;
      ledger: CreditLedgerEntry[];
      packs?: CreditPack[];
      firstBuy?: boolean;
    };
    setBalance(data.balance);
    setLedger(data.ledger);
    if (data.packs?.length) setPacks(data.packs);
    setFirstBuy(data.firstBuy === true);
  }, []);

  useEffect(() => {
    const stored = getUser();
    setUser(stored);
    setChecked(true);
    const params = new URLSearchParams(window.location.search);
    setApproved(params.get("payment") === "approved");
    setWelcome(params.get("welcome") === "1");
    // 바깥 주소로 튀지 않게 우리 경로만 받는다.
    const next = params.get("next");
    setNextPath(next && next.startsWith("/") && !next.startsWith("//") ? next : null);
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
      setShareNotice("초대 링크를 보냈어요. 친구가 가입하면 5,000원 쿠폰이 들어와요.");
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

      {welcome && firstBuy && (
        <section className="card" style={{ padding: 20, marginBottom: 14, borderColor: "var(--gold)" }}>
          <span className="badge">처음 오셨네요</span>
          <h2 style={{ fontSize: "1.15rem", margin: "10px 0 6px" }}>첫 충전만 이 값이에요</h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.86rem" }}>
            질문 한 번에 {QUESTION_COST}크레딧이 들어요. 아래에서 고르면 바로 물어볼 수 있어요.
          </p>
          {nextPath && (
            <Link
              className="btn btn-ghost"
              href={nextPath}
              style={{ width: "100%", marginTop: 12 }}
            >
              나중에 하고 보던 화면으로
            </Link>
          )}
        </section>
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
          <p style={{ color: "var(--text-dim)", marginBottom: 14 }}>로그인하면 첫 구매 할인가를 볼 수 있어요.</p>
          <button className="btn" style={{ width: "100%" }} onClick={() => setShowSignup(true)}>로그인 · 가입하기</button>
        </div>
      ) : (
        <>
          <section className="card" style={{ padding: 20, marginBottom: 14 }}>
            <span className="badge">친구 초대</span>
            <h2 style={{ fontSize: "1.1rem", margin: "10px 0 6px" }}>친구가 가입하면 5,000원 쿠폰</h2>
            <p style={{ color: "var(--text-dim)", fontSize: "0.86rem", marginBottom: 12 }}>
              쿠폰은 리딩 결제에 쓸 수 있어요.
            </p>
            <button className="btn btn-ghost" style={{ width: "100%" }} onClick={share} disabled={!user.referralCode}>
              초대 링크 보내기
            </button>
            {shareNotice && <p style={{ color: "var(--gold)", fontSize: "0.82rem", marginTop: 10 }}>{shareNotice}</p>}
          </section>

          <section className="card" style={{ padding: 20, marginBottom: 14 }}>
            <span className="badge">{firstBuy ? "첫 구매 할인" : "충전"}</span>
            {firstBuy && (
              <p style={{ color: "var(--gold)", fontSize: "0.86rem", margin: "10px 0 0" }}>
                처음 오셨네요. 첫 충전은 한 번만 이 값으로 드려요.
              </p>
            )}
            <div style={{ display: "grid", gap: 10, margin: "12px 0" }}>
              {packs.map((p) => {
                const list = listPriceOf(p);
                const off = list > p.price ? Math.round((1 - p.price / list) * 100) : 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`btn ${pack?.id === p.id ? "" : "btn-ghost"}`}
                    style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 10 }}
                    onClick={() => setPack(p)}
                  >
                    <span>
                      {p.credits}크레딧 · {p.note}
                      {firstBuy && off > 0 && (
                        <strong style={{ color: "var(--gold)", marginLeft: 6 }}>{off}% 할인</strong>
                      )}
                    </span>
                    <strong>{p.price.toLocaleString()}원</strong>
                  </button>
                );
              })}
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
          reason="크레딧은 계정에 묶여 있어요. 로그인하고 충전해 주세요."
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
