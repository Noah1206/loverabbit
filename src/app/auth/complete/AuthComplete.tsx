"use client";

import { useEffect, useRef, useState } from "react";
import { clearPendingReferral, getPendingReferral } from "@/lib/referral";
import { saveUser, type User } from "@/lib/user";

interface SessionResult extends Partial<User> {
  needsProfile?: boolean;
  error?: string;
}

export default function AuthComplete({ nextPath }: { nextPath: string }) {
  const started = useRef(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [email, setEmail] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [agree, setAgree] = useState(false);
  const [marketingOk, setMarketingOk] = useState(true);
  const [submitting, setSubmitting] = useState(true);
  const [error, setError] = useState("");

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
    if (getPendingReferral()) clearPendingReferral();
    window.location.replace(nextPath);
  };

  const connectSession = async (profile?: { birthdate: string; marketingOk: boolean }) => {
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
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void connectSession();
    // connectSession intentionally runs only after the OAuth callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const birthYear = Number.parseInt(birthdate.slice(0, 4), 10);
  const isAdult = Number.isFinite(birthYear) && new Date().getFullYear() - birthYear >= 19;

  return (
    <main className="auth-shell">
      <section className="card auth-card">
        <div className="auth-rabbit" aria-hidden>🐰</div>
        {!needsProfile ? (
          <>
            <h1>로그인 연결 중</h1>
            <p>계정과 러브레빗 기록을 안전하게 연결하고 있어요.</p>
            {submitting && <div className="auth-loader" aria-label="로그인 처리 중" />}
            {error && (
              <>
                <p className="auth-error" role="alert">{error}</p>
                <button className="btn" type="button" onClick={() => void connectSession()}>
                  다시 시도하기
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <span className="badge">마지막 한 단계</span>
            <h1>성인 확인</h1>
            <p>{email} 계정으로 시작해요. 최초 한 번만 입력하면 됩니다.</p>
            <div className="field auth-profile-field">
              <label>생년월일 <span>— 만 19세 이상</span></label>
              <input
                type="date"
                value={birthdate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setBirthdate(event.target.value)}
              />
            </div>
            <label className="auth-check-row">
              <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
              <span>(필수) 성인 콘텐츠 열람 및 이용약관·개인정보 수집에 동의합니다.</span>
            </label>
            <label className="auth-check-row auth-check-optional">
              <input type="checkbox" checked={marketingOk} onChange={(event) => setMarketingOk(event.target.checked)} />
              <span>(선택) 이벤트·혜택 소식 받기</span>
            </label>
            <button
              className="btn"
              type="button"
              disabled={!agree || !isAdult || submitting}
              onClick={() => void connectSession({ birthdate, marketingOk })}
            >
              {submitting ? "가입 중…" : "가입하고 계속하기 →"}
            </button>
            {error && <p className="auth-error" role="alert">{error}</p>}
          </>
        )}
      </section>
    </main>
  );
}
