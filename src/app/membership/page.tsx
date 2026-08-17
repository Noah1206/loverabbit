"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PaymentModal from "@/components/PaymentModal";
import SignupModal from "@/components/SignupModal";
import { getUser, type User } from "@/lib/user";

const MEMBERSHIP_PRICE = 27900;
const STORAGE_KEY = "loverabbit_membership_v1";

const BENEFITS = [
  ["🔓", "모든 리딩 무제한", "단품 7,900원 리딩을 30일간 횟수 제한 없이"],
  ["🐰", "14종 리딩 전부 포함", "속궁합부터 이별 부검까지, 새로 나오는 리딩도 자동 포함"],
  ["🌙", "이 사람 저 사람 다 물어보세요", "궁합 상대를 바꿔가며 몇 번을 봐도 추가 요금 없음"],
];

export default function MembershipPage() {
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [depositorCode] = useState(
    () => `레빗M-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  );

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved?.expiresAt > Date.now()) setExpiresAt(saved.expiresAt);
    } catch {}
    setUser(getUser());
  }, []);

  const activate = async () => {
    setPaying(true);
    setError("");
    try {
      const res = await fetch("/api/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositorCode, userToken: user?.token }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "멤버십 발급 실패");
      const data = await res.json();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: data.token, expiresAt: data.expiresAt }));
      setExpiresAt(data.expiresAt);
      setShowPay(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setPaying(false);
    }
  };

  const active = expiresAt !== null && expiresAt > Date.now();

  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <span className="badge">MEMBERSHIP</span>
      <h1 style={{ margin: "12px 0 6px" }}>🌙 밤의 멤버십</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 24 }}>
        월 {MEMBERSHIP_PRICE.toLocaleString()}원 — 궁금할 때마다 결제하는 대신, 한 달 동안 마음껏.
      </p>

      {active ? (
        <div className="card" style={{ marginBottom: 20, borderColor: "var(--accent)" }}>
          <strong style={{ color: "var(--accent)" }}>🎉 멤버십 이용 중</strong>
          <p style={{ fontSize: "0.9rem", marginTop: 6 }}>
            {new Date(expiresAt!).toLocaleDateString("ko-KR")} 까지 모든 리딩이 무료로 열립니다.
          </p>
          <Link href="/reading" className="btn" style={{ marginTop: 14, display: "inline-block" }}>
            리딩 보러 가기 →
          </Link>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 12, marginBottom: 22 }}>
            {BENEFITS.map(([icon, title, desc]) => (
              <div key={title} className="card" style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <span style={{ fontSize: "1.6rem" }}>{icon}</span>
                <div>
                  <strong>{title}</strong>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="card" style={{ textAlign: "center", marginBottom: 20 }}>
            <p style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>리딩 4번이면 뽕 뽑는 가격</p>
            <p style={{ fontSize: "1.6rem", fontWeight: 800, margin: "4px 0 12px" }}>
              {MEMBERSHIP_PRICE.toLocaleString()}원 <span style={{ fontSize: "0.9rem", color: "var(--text-dim)", fontWeight: 400 }}>/ 30일</span>
            </p>
            <button className="btn" style={{ width: "100%" }} onClick={() => (user ? setShowPay(true) : setShowSignup(true))}>
              {user ? "멤버십 시작하기 →" : "가입하고 멤버십 시작하기 →"}
            </button>
            <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 10 }}>
              자동 갱신 없음 — 만료되면 알아서 끝나요. 부담 없이.
            </p>
          </div>
        </>
      )}
      {error && <p style={{ color: "var(--accent)", marginBottom: 12 }}>{error}</p>}

      {showSignup && (
        <SignupModal
          reason="멤버십 가입에는 3초 회원가입이 필요해요"
          onDone={(u) => {
            setUser(u);
            setShowSignup(false);
            setShowPay(true);
          }}
          onClose={() => setShowSignup(false)}
        />
      )}

      {showPay && (
        <PaymentModal
          price={MEMBERSHIP_PRICE}
          depositorCode={depositorCode}
          paying={paying}
          doneLabel="이체 완료했어요 → 멤버십 시작"
          onDone={activate}
          onClose={() => setShowPay(false)}
        />
      )}
    </main>
  );
}
