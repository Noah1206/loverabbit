"use client";

import { useEffect, useState } from "react";
import SignupModal from "@/components/SignupModal";
import { clearUser, getUser, type User } from "@/lib/user";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [showSignup, setShowSignup] = useState(false);

  useEffect(() => setUser(getUser()), []);

  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <p style={{ color: "var(--accent)", fontWeight: 800, marginBottom: 8 }}>MY LOVE RABBIT</p>
      <h1 style={{ marginBottom: 8 }}>마이</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 24 }}>
        계정과 러브레빗 이용 정보를 관리해요.
      </p>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
          <span style={{ width: 52, height: 52, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--bg-card2)", fontSize: "1.5rem" }}>🐰</span>
          <div>
            <strong>{user ? "러브레빗 회원" : "게스트"}</strong>
            <p style={{ color: "var(--text-dim)", fontSize: "0.86rem" }}>{user?.email ?? "로그인하고 상담 기록을 연결해보세요."}</p>
          </div>
        </div>
        {user ? (
          <button
            className="btn btn-ghost"
            style={{ width: "100%" }}
            onClick={() => {
              clearUser();
              setUser(null);
            }}
          >
            로그아웃
          </button>
        ) : (
          <button className="btn" style={{ width: "100%" }} onClick={() => setShowSignup(true)}>
            로그인 · 가입하기
          </button>
        )}
      </div>
      {showSignup && (
        <SignupModal
          onDone={(nextUser) => {
            setUser(nextUser);
            setShowSignup(false);
          }}
          onClose={() => setShowSignup(false)}
        />
      )}
    </main>
  );
}
