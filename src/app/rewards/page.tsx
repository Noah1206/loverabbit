"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SignupModal from "@/components/SignupModal";
import { getUser, saveUser, type User } from "@/lib/user";

export default function RewardsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = async (stored: User) => {
    const res = await fetch("/api/referral/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userToken: stored.token }),
    });
    if (!res.ok) return;
    const status = await res.json();
    const next = {
      ...stored,
      referralCode: status.referralCode,
      chatCredits: status.chatCredits,
    };
    setUser(next);
    saveUser(next);
  };

  useEffect(() => {
    const stored = getUser();
    setUser(stored);
    if (stored) void refresh(stored);
  }, []);

  const share = async () => {
    if (!user?.referralCode) return;
    const url = `${window.location.origin}/reading?ref=${encodeURIComponent(user.referralCode)}&reward=chat_credits`;
    const text = "연애 사주 무료 미리보기 해봤어? 러브레빗에서 같이 해보자 🐰";
    try {
      if (navigator.share) {
        await navigator.share({ title: "러브레빗 무료 사주", text, url });
        setNotice("공유했어요. 친구가 가입하면 질문권 10장이 자동 지급돼요.");
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setNotice("초대 링크를 복사했어요.");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setNotice("공유 링크를 만들지 못했어요. 다시 시도해주세요.");
      }
    }
  };

  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <p style={{ color: "var(--accent)", fontWeight: 800, marginBottom: 8 }}>LOVE RABBIT REWARDS</p>
      <h1 style={{ marginBottom: 8 }}>친구 초대 보상</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 24 }}>
        친구 한 명이 내 링크로 가입하면 원하는 보상이 자동으로 지급돼요.
      </p>

      <div className="card" style={{ padding: 24, marginBottom: 14 }}>
        <span className="badge">보상 01</span>
        <h2 style={{ fontSize: "1.2rem", margin: "12px 0 6px" }}>내 리딩 전문 무료 해금</h2>
        <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", marginBottom: 16 }}>
          무료 미리보기를 만든 뒤 해당 결과의 초대 버튼을 공유하세요. 친구가 가입하면 그 리딩이 0원으로 열려요.
        </p>
        <Link className="btn btn-ghost" href="/reading">무료 미리보기 만들기 →</Link>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <span className="badge">보상 02</span>
        <h2 style={{ fontSize: "1.2rem", margin: "12px 0 6px" }}>캐릭터챗 질문권 10장</h2>
        <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", marginBottom: 8 }}>
          현재 보유 질문권 <strong style={{ color: "var(--accent)" }}>{user?.chatCredits ?? 0}장</strong>
        </p>
        <p style={{ color: "var(--text-dim)", fontSize: "0.78rem", marginBottom: 16 }}>
          링크 클릭이 아니라 친구의 가입 완료를 기준으로 지급됩니다.
        </p>
        <button className="btn" style={{ width: "100%" }} onClick={user ? share : () => setShowSignup(true)} disabled={Boolean(user && !user.referralCode)}>
          {user ? "친구에게 초대 링크 보내기" : "가입하고 초대 보상 받기"}
        </button>
        {notice && <p style={{ color: "var(--gold)", fontSize: "0.82rem", marginTop: 10 }}>{notice}</p>}
      </div>

      {showSignup && (
        <SignupModal
          reason="친구 초대 보상을 받으려면 가입이 필요해요"
          onDone={(next) => {
            setUser(next);
            setShowSignup(false);
            void refresh(next);
          }}
          onClose={() => setShowSignup(false)}
        />
      )}
    </main>
  );
}
