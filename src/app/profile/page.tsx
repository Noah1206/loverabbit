"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import SignupModal from "@/components/SignupModal";
import { useTheme, type Theme } from "@/components/ThemeProvider";
import { getUser, logoutUser, saveUser, type User } from "@/lib/user";
import { REFERRAL_REWARD_PARAM } from "@/lib/referral";

export default function ProfilePage() {
  const { setTheme, showMatureLabels, setShowMatureLabels } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  // 테마 선택은 뺐다. 아이보리 하나다 (2026-08-30). 저장 형식은 그대로 두고 값만 고정한다.
  // 예전 "블랙 하나" 시절의 "dark" 가 여기 남아, 프로필만 열면 앱이 다크로 뒤집혔다.
  const selectedTheme: Theme = "light";
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");

  const loadSavedProfile = useCallback(async (account: User) => {
    setProfileLoading(true);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: account.token }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        theme?: Theme;
        showMatureLabels?: boolean;
      };
      if (response.ok) {
        if (typeof data.showMatureLabels === "boolean") {
          setShowMatureLabels(data.showMatureLabels);
        }
      }
    } catch {
      // 네트워크가 끊겨도 이 기기에 저장된 테마는 그대로 유지한다.
    } finally {
      setProfileLoading(false);
    }
  }, [setShowMatureLabels, setTheme]);

  useEffect(() => {
    const stored = getUser();
    setUser(stored);
    if (!stored) return;
    void loadSavedProfile(stored);
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
  }, [loadSavedProfile]);

  const saveThemePreference = async () => {
    setProfileSaving(true);
    setProfileNotice("");
    try {
      if (user) {
        const response = await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userToken: user.token,
            theme: selectedTheme,
            showMatureLabels,
          }),
        });
        const data = (await response.json().catch(() => ({}))) as { theme?: Theme; error?: string };
        if (!response.ok) throw new Error(data.error ?? "프로필을 저장하지 못했어요.");
      }
      setTheme(selectedTheme);
      setProfileNotice(user ? "계정에 화면 설정을 저장했어요." : "이 기기에 화면 설정을 저장했어요. 로그인하면 계정에도 저장할 수 있어요.");
    } catch (error) {
      setProfileNotice(error instanceof Error ? error.message : "화면 설정을 저장하지 못했어요.");
    } finally {
      setProfileSaving(false);
    }
  };

  const shareForCredits = async () => {
    if (!user?.referralCode) return;
    const url = `${window.location.origin}/reading?ref=${encodeURIComponent(user.referralCode)}&reward=${REFERRAL_REWARD_PARAM}`;
    const text = "러브레빗에서 내 연애 사주 무료로 미리 봤어. 너도 해봐 🐰";
    try {
      if (navigator.share) {
        await navigator.share({ title: "러브레빗 무료 사주", text, url });
        setShareNotice("공유했어요. 친구가 가입하면 50러빗이 들어와요.");
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
            onClick={async () => {
              await logoutUser();
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
      <section className="card profile-theme-card">
        <span className="badge">화면 설정</span>
        <h2>화면</h2>
        <div className="profile-label-toggle">
          <div>
            <strong>연령 안내 표시</strong>
            <p>켜면 홈 상단과 안내 영역에 연령 배지를 표시해요. 로그인 후 저장하면 다른 기기에도 적용돼요.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="연령 안내 표시"
            aria-checked={showMatureLabels}
            className={showMatureLabels ? "on" : ""}
            onClick={() => setShowMatureLabels(!showMatureLabels)}
          >
            <span aria-hidden />
          </button>
        </div>
        <button
          type="button"
          className="btn profile-theme-save"
          onClick={saveThemePreference}
          disabled={profileLoading || profileSaving}
        >
          {profileLoading ? "불러오는 중…" : profileSaving ? "저장 중…" : "화면 설정 저장"}
        </button>
        {profileNotice && <p className="profile-theme-notice" role="status">{profileNotice}</p>}
      </section>
      {user && (
        <div className="card" style={{ padding: 24, marginTop: 14 }}>
          <span className="badge">질문 러빗</span>
          <h2 style={{ fontSize: "1.15rem", margin: "12px 0 6px" }}>오늘의 질문</h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", marginBottom: 14 }}>
            저장된 내 사주와 받은 리딩을 바탕으로 한 가지를 물어요. 한 번에 5러빗.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <Link className="btn" href="/ask" style={{ flex: 1, textAlign: "center" }}>질문하기</Link>
            <Link className="btn btn-ghost" href="/credits" style={{ flex: 1, textAlign: "center" }}>러빗함</Link>
          </div>
        </div>
      )}
      {user && (
        <div className="card" style={{ padding: 24, marginTop: 14 }}>
          <span className="badge">친구 초대 보상</span>
          <h2 style={{ fontSize: "1.15rem", margin: "12px 0 6px" }}>친구가 가입하면 50러빗</h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", marginBottom: 14 }}>
            친구가 링크를 열면 질문 1회분, 가입까지 마치면 30일 안에 쓸 수 있는 쿠폰이 들어와요.
          </p>
          <button className="btn" style={{ width: "100%" }} onClick={shareForCredits} disabled={!user.referralCode}>
            친구에게 초대 링크 보내기
          </button>
          {shareNotice && <p style={{ color: "var(--gold)", fontSize: "0.82rem", marginTop: 10 }}>{shareNotice}</p>}
        </div>
      )}
      {showSignup && (
        <SignupModal
          onClose={() => setShowSignup(false)}
        />
      )}
    </main>
  );
}
