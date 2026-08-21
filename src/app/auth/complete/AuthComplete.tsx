"use client";

import { useEffect, useRef, useState } from "react";
import { peekAuthReturn, takeAuthReturn } from "@/lib/auth-return";
import { clearPendingReferral, getPendingReferral } from "@/lib/referral";
import { saveUser, type User } from "@/lib/user";
import { trackCompleteRegistration } from "@/lib/meta-events";
import BrandMark from "@/components/BrandMark";
import BackOnError from "@/components/BackOnError";

interface SessionResult extends Partial<User> {
  needsProfile?: boolean;
  error?: string;
}

export default function AuthComplete({ nextPath }: { nextPath: string }) {
  const started = useRef(false);
  const redirectTimer = useRef<number | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [marketingOk, setMarketingOk] = useState(true);
  const [submitting, setSubmitting] = useState(true);
  const [error, setError] = useState("");
  /**
   * 몇 번 실패했는지.
   *
   * 처음 실패는 대개 한 번 더 해 보면 된다 — 네트워크가 잠깐 끊겼거나. 그래서 첫
   * 실패에는 다시 시도할 자리를 주고, 되돌아가는 것은 사람이 누를 때만 한다.
   * 두 번째부터는 정말 안 되는 것이므로 하던 자리로 저절로 되돌린다.
   */
  const [attempts, setAttempts] = useState(0);

  const finish = (data: SessionResult) => {
    if (!data.token || !data.email) throw new Error("로그인 정보를 완성하지 못했어요.");
    const user: User = {
      token: data.token,
      email: data.email,
      authProvider: data.authProvider,
      referralCode: data.referralCode,
      chatCredits: data.chatCredits,
      referralClaimed: data.referralClaimed === true,
    };
    saveUser(user);
    // 가입/로그인 완료 — 로그인 수단 이름만 보낸다. 이메일 원문은 전송하지 않는다.
    trackCompleteRegistration(data.authProvider ?? "unknown");
    if (getPendingReferral()) clearPendingReferral();
    // 팝업을 열었던 화면(쿼리 포함)이 있으면 그리로, 없으면 next 쿼리로 돌아간다.
    const destination = peekAuthReturn() ?? nextPath;
    setNeedsProfile(false);
    setCompleted(true);
    redirectTimer.current = window.setTimeout(() => {
      takeAuthReturn();
      window.location.replace(destination);
    }, 800);
  };

  const connectSession = async (profile?: { termsAccepted: boolean; marketingOk: boolean }) => {
    setSubmitting(true);
    setError("");
    try {
      const referral = getPendingReferral();
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, ...referral }),
      });
      const data = (await response.json().catch(() => ({}))) as SessionResult;
      if (!response.ok) throw new Error(data.error ?? "로그인을 완료하지 못했어요.");
      if (data.needsProfile) {
        setEmail(data.email ?? "");
        setNeedsProfile(true);
        return;
      }
      finish(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "로그인을 완료하지 못했어요.");
      setAttempts((count) => count + 1);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void connectSession();
    // connectSession intentionally runs only after the OAuth callback.
    return () => {
      if (redirectTimer.current) window.clearTimeout(redirectTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="auth-shell">
      <section className="card auth-card">
        <div className="auth-rabbit" aria-hidden><BrandMark size={44} /></div>
        {completed ? (
          <div className="auth-success" role="status" aria-live="polite">
            <span className="auth-success-check" aria-hidden="true">✓</span>
            <h1>준비 완료!</h1>
            <p>선택한 운명을 보러 이동하고 있어요.</p>
          </div>
        ) : !needsProfile ? (
          <>
            <h1>로그인 연결 중</h1>
            <p>계정과 러브레빗 기록을 안전하게 연결하고 있어요.</p>
            {submitting && <div className="auth-loader" aria-label="로그인 처리 중" />}
            {error && (
              <>
                <p className="auth-error" role="alert">{error}</p>
                {attempts < 2 && (
                  <button className="btn" type="button" onClick={() => void connectSession()}>
                    다시 시도하기
                  </button>
                )}
                {/* 두 번 실패하면 저절로 되돌린다. 그 전에는 누를 때만. */}
                <BackOnError fallback={nextPath} label="이전 화면" auto={attempts >= 2} />
              </>
            )}
          </>
        ) : (
          <>
            <span className="badge">마지막 한 단계</span>
            <h1>약관 확인 후 바로 시작해요</h1>
            <p>{email} 계정으로 로그인됐어요. 사주 정보는 다음 입력 화면에서 받습니다.</p>
            <label className="auth-check-row">
              <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
              <span>(필수) 이용약관 및 개인정보 수집에 동의합니다.</span>
            </label>
            <label className="auth-check-row auth-check-optional">
              <input type="checkbox" checked={marketingOk} onChange={(event) => setMarketingOk(event.target.checked)} />
              <span>(선택) 이벤트·혜택 소식 받기</span>
            </label>
            <button
              className="btn"
              type="button"
              disabled={!agree || submitting}
              onClick={() => void connectSession({ termsAccepted: agree, marketingOk })}
            >
              {submitting ? "가입 중…" : "가입하고 계속하기 →"}
            </button>
            {error && (
              <>
                <p className="auth-error" role="alert">{error}</p>
                <BackOnError fallback={nextPath} label="이전 화면" auto={attempts >= 2} />
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
