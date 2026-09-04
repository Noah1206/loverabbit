"use client";

import { useEffect, useRef, useState } from "react";
import { peekAuthReturn, takeAuthReturn } from "@/lib/auth-return";
import { peekReadingDraft } from "@/lib/reading-draft";
import { clearPendingReferral, getPendingReferral } from "@/lib/referral";
import { saveUser, type User } from "@/lib/user";
import { trackCompleteRegistration } from "@/lib/meta-events";
import BrandMark from "@/components/BrandMark";
import RabbitLoader from "@/components/RabbitLoader";
import BackOnError from "@/components/BackOnError";

interface SessionResult extends Partial<User> {
  needsProfile?: boolean;
  error?: string;
  /** 이번에 회원 행이 새로 생겼는가 (첫 구매 안내를 띄울지 판단) */
  isNewUser?: boolean;
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
  // 로그인은 됐는데 이 기기에 남기지 못한 경우 — 실패가 아니라 주의사항이다
  const [storageWarning, setStorageWarning] = useState(false);
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
      referralClaimed: data.referralClaimed === true,
    };
    /* 저장이 막힌 브라우저(프라이빗 모드 등)여도 로그인 자체는 성공했다.
       실패를 예외로 올리면 성공한 로그인이 "실패"로 표시된다 — 알리기만 하고
       가던 길은 그대로 간다. */
    const stored = saveUser(user);
    if (!stored) setStorageWarning(true);
    // 가입/로그인 완료 — 로그인 수단 이름만 보낸다. 이메일 원문은 전송하지 않는다.
    trackCompleteRegistration(data.authProvider ?? "unknown");
    if (getPendingReferral()) clearPendingReferral();
    /*
      가입만 하면 아무것도 못 한다 (2026-08-30 무료 크레딧 폐지).

      질문에는 크레딧이 들고, 크레딧은 사야만 생긴다. 그 사실을 "질문하려다
      막히는 자리" 에서 알게 하면 그 사람은 그냥 나간다. 그래서 처음 온 사람은
      돌아갈 화면 대신 충전함으로 보내 첫 구매 할인을 먼저 보게 한다.

      한 번이라도 산 사람은 해당 없다 — /credits 가 서버에 물어 정가를 보여준다.
      원래 가려던 화면은 쿼리로 넘겨, 충전함에서 이어 갈 수 있게 둔다.
    */
    const back = peekAuthReturn() ?? nextPath;
    /*
      리딩 초안을 들고 온 사람은 새 회원이라도 충전함에 세우지 않는다 (2026-09-04).

      폼을 다 채우고 로그인하러 나온 사람이다 — 그 초안이 곧 주문이고, 폼으로
      돌아가면 저장된 초안이 자동 재개되어 생성→결제로 이어진다. 충전함으로
      돌리면 방금 채운 폼과 상관없는 가격표 앞에 서고, 거기서 나간다
      (퍼널: 폼 완주자의 2/3가 이 관문 뒤에서 사라졌다).
    */
    const destination = data.isNewUser && !peekReadingDraft()
      ? `/credits?welcome=1&next=${encodeURIComponent(back)}`
      : back;
    setNeedsProfile(false);
    setCompleted(true);
    // 저장에 실패한 사람에게는 그 안내를 읽을 시간을 준다 — 800ms 는 너무 짧다
    redirectTimer.current = window.setTimeout(() => {
      takeAuthReturn();
      window.location.replace(destination);
    }, stored ? 800 : 3200);
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
            {storageWarning && (
              // 로그인은 됐다. 다만 이 브라우저가 저장을 막아 다음에 다시 물어본다.
              <p className="auth-storage-warning">
                이 브라우저는 로그인 정보를 저장하지 않아요(시크릿 모드 등). 지금은 그대로
                이어지지만, 창을 닫으면 다시 로그인해야 해요.
              </p>
            )}
          </div>
        ) : !needsProfile ? (
          <>
            {submitting ? (
              <RabbitLoader
                message="로그인을 연결하고 있어요"
                sub="계정과 러브레빗 기록을 안전하게 잇는 중이에요."
              />
            ) : (
              <>
                <h1>로그인 연결 중</h1>
                <p>계정과 러브레빗 기록을 안전하게 연결하고 있어요.</p>
              </>
            )}
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
              {/* 동의를 받으면서 읽을 길을 함께 준다 — 문서는 이제 실제로 있다 */}
              <span>
                (필수){" "}
                <a href="/terms" target="_blank" rel="noreferrer">이용약관</a> 및{" "}
                <a href="/privacy" target="_blank" rel="noreferrer">개인정보 수집</a>에 동의합니다.
              </span>
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
