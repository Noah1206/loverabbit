"use client";

import { useEffect, useState } from "react";
import { REFERRAL_SIGNUP_CREDITS } from "@/lib/credits";
import Link from "next/link";
import InquiryButton from "@/components/InquiryButton";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { getUser, logoutUser, saveUser, type User } from "@/lib/user";
import { REFERRAL_REWARD_PARAM } from "@/lib/referral";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
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
        };
        setUser(next);
        saveUser(next);
      })
      .catch(() => undefined);
  }, []);


  const shareForCredits = async () => {
    if (!user?.referralCode) return;
    const url = `${window.location.origin}/reading?ref=${encodeURIComponent(user.referralCode)}&reward=${REFERRAL_REWARD_PARAM}`;
    const text = "러브레빗에서 내 연애 사주 무료로 미리 봤어. 너도 해봐 🐰";
    try {
      if (navigator.share) {
        await navigator.share({ title: "러브레빗 무료 사주", text, url });
        setShareNotice(`공유했어요. 친구가 가입하면 ${REFERRAL_SIGNUP_CREDITS}러빗이 들어와요.`);
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
          {/* 게스트는 빈 사람. 토끼는 브랜드의 얼굴이지 내 얼굴이 아니다 — 로그인하면
              내 자리가 채워진다는 것을 아이콘이 먼저 말한다. */}
          <span
            aria-hidden
            style={{ width: 52, height: 52, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--bg-card2)", color: "var(--text-dim)" }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8.1" r="3.4" fill={user ? "currentColor" : "none"} />
              <path d="M5.4 19.8a6.9 6.9 0 0 1 13.2 0" />
            </svg>
          </span>
          <div>
            <strong>{user ? "러브레빗 회원" : "게스트"}</strong>
            <p style={{ color: "var(--text-dim)", fontSize: "0.86rem" }}>{user?.email ?? "로그인하고 상담 기록을 연결해보세요."}</p>
          </div>
        </div>
        {user ? (
          <button
            className="btn btn-ghost"
            style={{ width: "100%" }}
            onClick={async () => {
              await logoutUser();
              setUser(null);
            }}
          >
            로그아웃
          </button>
        ) : (
          /* 팝업을 한 번 더 열게 하지 않는다 — 여기가 이미 로그인하러 온 자리다. */
          <SocialLoginButtons />
        )}
      </div>

      {/* 탈퇴 — 개인정보처리방침이 "문의하기로 받아 10일 안에 처리한다"고 약속한
          그 경로를 눈에 보이게 둔다. 약속만 있고 누를 자리가 없으면 없는 것과 같다. */}
      {user && (
        <div className="card" style={{ padding: 24, marginTop: 14 }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: 6 }}>회원 탈퇴</h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.86rem", marginBottom: 14 }}>
            탈퇴하면 계정 정보와 리딩 결과를 지체 없이 파기해요. 남은 러빗은 돌려드릴 수 없으니
            먼저 써 주세요. 문의로 접수하면 10일 안에 처리해 드려요.
          </p>
          <button
            className="btn btn-ghost"
            style={{ width: "100%" }}
            onClick={() => window.dispatchEvent(new Event("loverabbit:inquiry"))}
          >
            탈퇴 문의하기
          </button>
        </div>
      )}
      {user && (
        <div className="card" style={{ padding: 24, marginTop: 14 }}>
          <span className="badge">친구 초대 보상</span>
          <h2 style={{ fontSize: "1.15rem", margin: "12px 0 6px" }}>친구가 가입하면 {REFERRAL_SIGNUP_CREDITS}러빗</h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", marginBottom: 14 }}>
            친구가 링크를 열면 질문 1회분, 가입까지 마치면 30일 안에 쓸 수 있는 쿠폰이 들어와요.
          </p>
          <button className="btn" style={{ width: "100%" }} onClick={shareForCredits} disabled={!user.referralCode}>
            친구에게 초대 링크 보내기
          </button>
          {shareNotice && <p style={{ color: "var(--gold)", fontSize: "0.82rem", marginTop: 10 }}>{shareNotice}</p>}
        </div>
      )}

      {/* 문의창 본체. 위 "탈퇴 문의하기"가 쏘는 이벤트를 이것이 받는다. */}
      <InquiryButton />
    </main>
  );
}
