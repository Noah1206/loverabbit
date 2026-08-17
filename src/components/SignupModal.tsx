"use client";

import { useState } from "react";
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
        referralCode: data.referralCode,
        chatCredits: data.chatCredits,
      };
      saveUser(u);
      if (data.referralClaimed) clearPendingReferral();
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
        <h3 style={{ textAlign: "center", margin: "8px 0 4px" }}>3초 회원가입</h3>
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", textAlign: "center", marginBottom: 16 }}>
          {reason}. 비밀번호 없이 이메일이면 끝.
        </p>

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
