"use client";

import { useEffect, useState } from "react";
import SignupModal from "@/components/SignupModal";
import { clearUser, getUser, saveUser, type User } from "@/lib/user";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [shareNotice, setShareNotice] = useState("");

  useEffect(() => {
    const stored = getUser();
    setUser(stored);
    if (!stored) return;
    fetch("/api/referral/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userToken: stored.token }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((status) => {
        if (!status) return;
        const next = {
          ...stored,
          referralCode: status.referralCode,
          chatCredits: status.chatCredits,
        };
        setUser(next);
        saveUser(next);
      })
      .catch(() => undefined);
  }, []);

  const shareForCredits = async () => {
    if (!user?.referralCode) return;
    const url = `${window.location.origin}/reading?ref=${encodeURIComponent(user.referralCode)}&reward=chat_credits`;
    const text = "러브레빗에서 내 연애 사주 무료로 미리 봤어. 너도 해봐 🐰";
    try {
      if (navigator.share) {
        await navigator.share({ title: "러브레빗 무료 사주", text, url });
        setShareNotice("공유했어요. 친구가 가입하면 질문권 10장이 들어와요.");
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareNotice("초대 링크를 복사했어요.");
      }
    } catch {
      setShareNotice("");
    }
  };

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
      {user && (
        <div className="card" style={{ padding: 24, marginTop: 14 }}>
          <span className="badge">친구 초대 보상</span>
          <h2 style={{ fontSize: "1.15rem", margin: "12px 0 6px" }}>친구 1명 가입 = 캐릭터챗 질문권 10장</h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", marginBottom: 14 }}>
            현재 질문권 <strong style={{ color: "var(--accent)" }}>{user.chatCredits ?? 0}장</strong>
          </p>
          <button className="btn" style={{ width: "100%" }} onClick={shareForCredits} disabled={!user.referralCode}>
            친구에게 초대 링크 보내기
          </button>
          {shareNotice && <p style={{ color: "var(--gold)", fontSize: "0.82rem", marginTop: 10 }}>{shareNotice}</p>}
        </div>
      )}
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
