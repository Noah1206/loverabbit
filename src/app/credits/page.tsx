"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import PortOneTransferForm, { PORTONE_TRANSFER_CONFIGURED } from "@/components/PortOneTransferForm";
import PurchaseNotice from "@/components/PurchaseNotice";
import SignupModal from "@/components/SignupModal";
import TransferSteps from "@/components/TransferSteps";
import { TRANSFER_ACCOUNTS } from "@/components/TransferAccounts";
import {
  CREDIT_PACKS,
  CREDIT_REASON_LABEL,
  listPriceOf,
  KRW_PER_CREDIT,
  READING_PRICE_TIERS,
  creditDepositorCode,
  type CreditLedgerEntry,
  type CreditPack,
  REFERRAL_SIGNUP_CREDITS,
} from "@/lib/credits";
import { peekCreditsReturn, rememberCreditsReturn } from "@/lib/credits-return";
import { PAYMENT_METHOD_OPEN } from "@/lib/pay-method";
import { REFERRAL_REWARD_PARAM } from "@/lib/referral";
import { getUser, type User } from "@/lib/user";
import loveRabbitLogo from "../../../public/logo.png";

/*
  크레딧함 — 잔액, 내역, 충전.

  결제 수단은 리딩과 같은 것을 같은 순서로 쓴다 (pay-method.ts). 지금은 직접
  송금만 열려 있다. 크레딧에는 쿠폰이 붙지 않는다.
*/

/*
  아기자기 화이트 가격표 (2026-08-31, 운영자 참고 화면).
  흰 시트 + 색 타이틀 바 + 크림 MENU 배너 + 구분선 가격표가 뼈대다.
  스타일은 전부 globals.css 의 .credits-cute 스코프에 있다.
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
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    // 포트원 결제창을 다녀오면 쿼리가 사라진다 — 탭에 남겨 두고, 없으면 남긴 것을 꺼낸다.
    if (safeNext) rememberCreditsReturn(safeNext);
    setNextPath(safeNext ?? peekCreditsReturn());
    if (!stored) return;
    void load(stored);
    // 승인은 손님이 화면을 보는 사이 뒤에서 일어난다 — 리로드 없이 잔액이
    // 채워지게 주기적으로, 그리고 탭에 돌아온 순간 다시 읽는다.
    const tick = setInterval(() => void load(stored), 5000);
    const onFocus = () => void load(stored);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
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
      setShareNotice(`초대 링크를 보냈어요. 친구가 가입하면 ${REFERRAL_SIGNUP_CREDITS}러빗이 들어와요.`);
    } catch {
      setShareNotice("");
    }
  };

  if (!checked) return <main className="container" style={{ paddingTop: 48 }} />;

  const portone = PORTONE_TRANSFER_CONFIGURED && PAYMENT_METHOD_OPEN.portone;
  const manual = TRANSFER_ACCOUNTS.length > 0 && PAYMENT_METHOD_OPEN.manual;

  // BEST 배지 — 할인율이 가장 큰 팩. 전부 0% 면 제일 큰 팩(단가가 유리).
  const bestId = packs.reduce((best, p) => {
    const offOf = (x: CreditPack) => (listPriceOf(x) > x.price ? 1 - x.price / listPriceOf(x) : 0);
    return offOf(p) > offOf(best) || (offOf(p) === offOf(best) && p.credits > best.credits) ? p : best;
  }, packs[0]);

  return (
    <main className="container credits-cute" style={{ paddingTop: 48 }}>
      <h1 style={{ marginBottom: 8 }}>러빗 충전소</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 20 }}>
        사주를 러빗으로 열어요.
      </p>

      {/* 잔액 — 시트 위의 내 지갑 */}
      <div className="cc-card cc-balance">
        <div>
          <p className="cc-balance-label">내 러빗</p>
          <strong className="cc-balance-num">
            {balance === null ? "—" : <><em>{balance}</em>러빗</>}
          </strong>
          <p className="cc-balance-sub">
            {balance === null ? "로그인하면 잔액이 보여요" : "사주를 열 때 쓰여요"}
          </p>
        </div>
      </div>

      {approved && (
        <p className="cc-card" style={{ background: "#eefaf3", borderColor: "#bfe6d2", color: "#1f7a4d", fontWeight: 700, fontSize: "0.88rem" }}>
          입금이 확인됐어요. 러빗이 들어왔어요 🐰
        </p>
      )}

      {/* 결제 도중에 충전하러 온 사람 — 돌아갈 길을 눈앞에 둔다 */}
      {nextPath && !welcome && (
        <Link className="cc-btn cc-btn-soft cc-btn-block" href={nextPath} style={{ marginBottom: 14 }}>
          하던 결제로 돌아가기 →
        </Link>
      )}

      {welcome && firstBuy && (
        <section className="cc-card" style={{ borderColor: "var(--cc-pink)", borderWidth: 2 }}>
          <p className="cc-head">처음 오셨네요 — 첫 충전만 이 값이에요</p>
          <p style={{ fontSize: "0.84rem" }}>
            첫 사주 한 장에 {READING_PRICE_TIERS[0]}러빗이 들어요. 아래에서 고르면 바로 열 수 있어요.
          </p>
          {nextPath && (
            <Link className="cc-btn cc-btn-soft cc-btn-block" href={nextPath} style={{ marginTop: 12 }}>
              나중에 하고 보던 화면으로
            </Link>
          )}
        </section>
      )}

      {/* ── 가격표 시트 (참고 화면의 뼈대) ── */}
      <section className="cc-sheet">
        <div className="cc-bar">
          <span>러빗 가격표</span>
          <Image src={loveRabbitLogo} alt="" width={30} height={30} className="cc-bar-logo" />
        </div>

        {/* MENU 배너 — 환율을 그림 한 장으로 */}
        <div className="cc-menu">
          <div className="cc-menu-inner">
            <p className="cc-menu-title">
              <span className="cc-spark" aria-hidden>✦ </span>MENU<span className="cc-spark" aria-hidden> ✦</span>
            </p>
            <div className="cc-ovals">
              <div>
                <span className="cc-oval pink">1러빗</span>
                <p className="cc-oval-price">{KRW_PER_CREDIT.toLocaleString()}원</p>
              </div>
              <div>
                <span className="cc-oval lav">첫 사주</span>
                <p className="cc-oval-price">{READING_PRICE_TIERS[0]}러빗</p>
              </div>
            </div>
            <p className="cc-menu-note">
              러빗으로 사주를 열어요
              <br />쓰지 않은 러빗은 그대로 남아 있어요
            </p>
          </div>
        </div>

        {!user ? (
          <div style={{ padding: 16, textAlign: "center" }}>
            <p style={{ color: "var(--cc-dim)", fontSize: "0.88rem", marginBottom: 12 }}>
              러빗은 계정에 쌓여요. 로그인하고 충전해 주세요.
            </p>
            <button className="cc-btn cc-btn-block" onClick={() => setShowSignup(true)}>
              로그인 · 가입하기
            </button>
          </div>
        ) : (
          <>
            {packs.map((p) => {
              const list = listPriceOf(p);
              const off = list > p.price ? Math.round((1 - p.price / list) * 100) : 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`cc-row${pack?.id === p.id ? " on" : ""}`}
                  onClick={() => setPack(p)}
                >
                  <span>
                    <span className="cc-row-name">
                      {p.name}
                      {p.id === bestId.id && <span className="cc-best">BEST</span>}
                    </span>
                    <span className="cc-row-sub" style={{ display: "block" }}>
                      <span className="pink">{p.credits}러빗</span>
                      <span className="orange"> · {p.note}</span>
                      {firstBuy && off > 0 && <span className="lav"> · {off}% 할인!</span>}
                    </span>
                  </span>
                  <span className="cc-row-price">{p.price.toLocaleString()}원</span>
                </button>
              );
            })}

            {!pack ? (
              <div className="cc-cta-idle">상품을 선택하세요</div>
            ) : (
              <div className="cc-cta-wrap">
                {portone ? (
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
                    <p style={{ color: "var(--cc-dim)", fontSize: "0.84rem", marginBottom: 10 }}>
                      입금자명에 <strong>{creditDepositorCode(user.token)}</strong> 를 적어 주세요. 확인되면 바로 들어와요.
                    </p>
                    <TransferSteps amount={pack.price} submitting={submitting} onSubmit={() => void submitTransfer()} />
                  </div>
                ) : (
                  <p className="toss-payment-config-error" role="alert">결제 수단 설정이 아직 완료되지 않았어요.</p>
                )}
                {error && <p className="toss-payment-error" role="alert">{error}</p>}
              </div>
            )}
          </>
        )}
        <PurchaseNotice kind="credits" />
      </section>

      {user && (
        <>
          <section className="cc-card">
            <p className="cc-head">친구가 가입하면 {REFERRAL_SIGNUP_CREDITS}러빗 🎁</p>
            <p style={{ fontSize: "0.84rem", marginBottom: 12 }}>러빗으로 사주를 열어요.</p>
            <button className="cc-btn cc-btn-soft cc-btn-block" onClick={share} disabled={!user.referralCode}>
              초대 링크 보내기
            </button>
            {shareNotice && <p style={{ color: "#1f7a4d", fontSize: "0.82rem", marginTop: 10 }}>{shareNotice}</p>}
          </section>

          {ledger.length > 0 && (
            <section className="cc-card">
              <p className="cc-head">내역</p>
              <ul className="cc-ledger">
                {ledger.map((row) => (
                  <li key={row.id}>
                    <span>
                      {CREDIT_REASON_LABEL[row.reason]}
                      <small>{new Date(row.createdAt).toLocaleDateString("ko-KR")}</small>
                    </span>
                    <strong className={row.delta > 0 ? "cc-plus" : "cc-minus"}>
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
          reason="러빗은 계정에 묶여 있어요. 로그인하고 충전해 주세요."
          onClose={() => setShowSignup(false)}
        />
      )}
    </main>
  );
}
