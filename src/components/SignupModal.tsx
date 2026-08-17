"use client";

import { useEffect, useState } from "react";
import { saveUser, type User } from "@/lib/user";
import { clearPendingReferral, getPendingReferral } from "@/lib/referral";

// 3초 간편가입 모달 — 이메일 + 동의만. 결제 직전 관문으로 사용된다.
export default function SignupModal({
  onDone,
  onClose,
  reason = "풀 리딩을 열려면 3초 가입이 필요해요",
}: {
  onDone: (u: User) => void;
  onClose: () => void;
  reason?: string;
}) {
  const [email, setEmail] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [agree, setAgree] = useState(false);
  const [marketingOk, setMarketingOk] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [providers, setProviders] = useState<{ google: boolean; kakao: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/providers", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          google?: boolean;
          kakao?: boolean;
        };
        if (active) {
          setProviders({ google: data.google === true, kakao: data.kakao === true });
        }
      })
      .catch(() => {
        if (active) setProviders({ google: false, kakao: false });
      });
    return () => {
      active = false;
    };
  }, []);

  const startSocialLogin = (provider: "google" | "kakao") => {
    if (!providers?.[provider]) {
      setError(`${provider === "google" ? "Google" : "카카오"} 로그인을 준비 중이에요.`);
      return;
    }
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/auth/login?provider=${provider}&next=${encodeURIComponent(next)}`);
  };

  // 청소년보호법 기준(연 나이 19세: 만 19세가 되는 해의 1월 1일부터 성인)
  const isAdult = (() => {
    const y = parseInt(birthdate.slice(0, 4), 10);
    return !isNaN(y) && new Date().getFullYear() - y >= 19;
  })();
  const underage = birthdate.length >= 4 && !isAdult;

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const referral = getPendingReferral();
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, birthdate, marketingOk, ...referral }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "가입 실패");
      const u = {
        token: data.token,
        email: data.email,
        authProvider: data.authProvider,
        referralCode: data.referralCode,
        chatCredits: data.chatCredits,
        referralClaimed: data.referralClaimed === true,
      };
      saveUser(u);
      if (referral) clearPendingReferral();
      onDone(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 95, background: "rgba(8, 5, 14, 0.9)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
      onClick={onClose}
    >
      <div className="card" style={{ maxWidth: 420, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: "center", fontSize: "2rem" }}>🐰</div>
        <h3 style={{ textAlign: "center", margin: "8px 0 4px" }}>로그인 · 회원가입</h3>
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", textAlign: "center", marginBottom: 16 }}>
          {reason}. 자주 쓰는 계정으로 빠르게 시작하세요.
        </p>

        <div className="social-login-stack">
          <button
            type="button"
            className="social-login-button social-login-google"
            onClick={() => startSocialLogin("google")}
            disabled={providers?.google !== true}
          >
            <span className="social-google-mark" aria-hidden>G</span>
            {providers === null
              ? "로그인 확인 중…"
              : providers.google
                ? "Google로 계속하기"
                : "Google 로그인 준비 중"}
          </button>
          <button
            type="button"
            className="social-login-button social-login-kakao"
            onClick={() => startSocialLogin("kakao")}
            disabled={providers?.kakao !== true}
          >
            <span className="social-kakao-mark" aria-hidden>💬</span>
            {providers === null
              ? "로그인 확인 중…"
              : providers.kakao
                ? "카카오로 계속하기"
                : "카카오 로그인 준비 중"}
          </button>
        </div>

        <div className="signup-divider"><span>또는 이메일로 계속</span></div>

        <div className="field">
          <label>이메일</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label>생년월일 <span style={{ color: "var(--accent)" }}>— 만 19세 이상만 가입할 수 있어요 🔞</span></label>
          <input
            type="date"
            value={birthdate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setBirthdate(e.target.value)}
          />
          {underage && (
            <p style={{ color: "var(--accent)", fontSize: "0.82rem", marginTop: 6 }}>
              러브레빗은 성인 전용 서비스예요. 청소년은 이용할 수 없습니다.
            </p>
          )}
        </div>

        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2 }} />
          <span style={{ fontSize: "0.85rem", color: "var(--text)" }}>(필수) 성인 콘텐츠 열람에 동의하며, 이용약관·개인정보 수집에 동의합니다.</span>
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 16, cursor: "pointer" }}>
          <input type="checkbox" checked={marketingOk} onChange={(e) => setMarketingOk(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2 }} />
          <span style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>(선택) 이벤트·혜택 소식 받기</span>
        </label>

        <button className="btn" style={{ width: "100%" }} onClick={submit} disabled={!agree || !email.trim() || !isAdult || submitting}>
          {submitting ? "가입 중…" : "가입하고 계속하기 →"}
        </button>
        <button className="btn btn-ghost" style={{ width: "100%", marginTop: 10 }} onClick={onClose}>다음에 할게요</button>
        <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 10, textAlign: "center" }}>
          이미 가입했다면 같은 이메일을 입력하면 돼요.
        </p>
        {error && <p style={{ color: "var(--accent)", fontSize: "0.85rem", marginTop: 8 }}>{error}</p>}
      </div>
    </div>
  );
}
