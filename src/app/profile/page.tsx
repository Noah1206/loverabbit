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
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");


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


  /* 되돌릴 수 없는 일이라 두 번 묻는다 — 한 번은 무엇이 사라지는지, 한 번은
     정말인지. 지우고 나면 이 기기의 로그인도 함께 걷고 홈으로 보낸다. */
  const withdraw = async () => {
    if (!user || deleting) return;
    if (!window.confirm("탈퇴하면 계정 정보와 리딩 내용이 지워져요. 되돌릴 수 없어요. 계속할까요?")) return;
    if (!window.confirm("정말 탈퇴할까요? 남은 러빗도 함께 사라져요.")) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: user.token }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "탈퇴를 처리하지 못했어요.");
      // 서버에서 지웠으니 이 기기에 남은 것도 함께 걷는다.
      await logoutUser();
      window.location.replace("/");
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : "탈퇴를 처리하지 못했어요.");
      setDeleting(false);
    }
  };

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
          {/* 로그인한 사람에게만 얼굴 자리를 준다 (2026-09-01 운영자). 게스트의
              빈 동그라미는 "내 자리"가 아니라 비어 있는 칸으로만 읽혔다. */}
          {user && (
            <span
              aria-hidden
              style={{ width: 52, height: 52, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--bg-card2)", color: "var(--text-dim)" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8.1" r="3.4" fill="currentColor" />
                <path d="M5.4 19.8a6.9 6.9 0 0 1 13.2 0" />
              </svg>
            </span>
          )}
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

      {/* 탈퇴 — 사람을 기다리지 않는다. 파기는 권리라, 누르면 그 자리에서 지운다.
          되돌릴 수 없으므로 한 번 더 묻고, 무엇이 남는지도 미리 밝힌다. */}
      {user && (
        <div className="card" style={{ padding: 24, marginTop: 14 }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: 6 }}>회원 탈퇴</h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.86rem", marginBottom: 14 }}>
            계정 정보와 리딩 내용, 사주 정보를 그 자리에서 지워요. 결제 기록은 법에 따라 5년간
            보관해요. 남은 러빗은 돌려드릴 수 없으니 먼저 써 주세요.
          </p>
          {deleteError && (
            <p style={{ color: "var(--accent)", fontSize: "0.84rem", marginBottom: 10 }} role="alert">
              {deleteError}
            </p>
          )}
          <button
            className="btn btn-ghost"
            style={{ width: "100%" }}
            disabled={deleting}
            onClick={() => void withdraw()}
          >
            {deleting ? "지우는 중…" : "탈퇴하기"}
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
