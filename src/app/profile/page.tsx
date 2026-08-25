"use client";

import { useCallback, useEffect, useState } from "react";
import SignupModal from "@/components/SignupModal";
import { useTheme, type Theme } from "@/components/ThemeProvider";
import { getUser, logoutUser, saveUser, type User } from "@/lib/user";

export default function ProfilePage() {
  const { theme, setTheme, showMatureLabels, setShowMatureLabels } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<Theme>(theme);
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
      if (response.ok && (data.theme === "dark" || data.theme === "light")) {
        setSelectedTheme(data.theme);
        setTheme(data.theme);
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
          chatCredits: status.chatCredits,
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
    const url = `${window.location.origin}/reading?ref=${encodeURIComponent(user.referralCode)}&reward=chat_credits`;
    const text = "러브레빗에서 내 연애 사주 무료로 미리 봤어. 너도 해봐 🐰";
    try {
      if (navigator.share) {
        await navigator.share({ title: "러브레빗 무료 사주", text, url });
        setShareNotice("공유했어요. 친구가 가입하면 5,000원 쿠폰과 질문권 10장이 들어와요.");
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
        <h2>테마</h2>
        <p>기본은 블랙입니다. 여기에서만 라이트 모드로 바꾸고 저장할 수 있어요.</p>
        <div className="profile-theme-options" role="radiogroup" aria-label="화면 테마">
          <button
            type="button"
            role="radio"
            aria-checked={selectedTheme === "dark"}
            className={selectedTheme === "dark" ? "on" : ""}
            onClick={() => setSelectedTheme("dark")}
          >
            <span className="theme-preview theme-preview-dark" aria-hidden />
            <strong>블랙</strong>
            <small>기본 테마</small>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={selectedTheme === "light"}
            className={selectedTheme === "light" ? "on" : ""}
            onClick={() => setSelectedTheme("light")}
          >
            <span className="theme-preview theme-preview-light" aria-hidden />
            <strong>라이트</strong>
            <small>밝은 테마</small>
          </button>
        </div>
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
          <span className="badge">친구 초대 보상</span>
          <h2 style={{ fontSize: "1.15rem", margin: "12px 0 6px" }}>친구 1명 가입 = 5,000원 쿠폰 + 질문권 10장</h2>
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
            void loadSavedProfile(nextUser);
            setShowSignup(false);
          }}
          onClose={() => setShowSignup(false)}
        />
      )}
    </main>
  );
}
