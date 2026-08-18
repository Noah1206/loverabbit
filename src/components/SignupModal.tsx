"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import type { User } from "@/lib/user";

type SocialLoginProvider = "google" | "kakao" | "x";
type ProviderStatus = Record<SocialLoginProvider, boolean>;

const PROVIDER_LABEL: Record<SocialLoginProvider, string> = {
  google: "Google",
  kakao: "카카오",
  x: "X",
};

// 로그인 진입점은 소셜 로그인만 제공한다.
// 신규 사용자의 가입 정보와 약관 동의는 OAuth 완료 화면에서 한 번만 받는다.
export default function SignupModal({
  onClose,
  reason = "풀 리딩을 열려면 3초 가입이 필요해요",
  nextPath,
}: {
  onDone: (u: User) => void;
  onClose: () => void;
  reason?: string;
  // 로그인 완료 후 돌아올 경로. 없으면 팝업을 연 현재 화면으로 복귀한다.
  nextPath?: string;
}) {
  const { showMatureLabels } = useTheme();
  const [error, setError] = useState("");
  const [providers, setProviders] = useState<ProviderStatus | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/providers", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          google?: boolean;
          kakao?: boolean;
          x?: boolean;
        };
        if (active) {
          setProviders({
            google: data.google === true,
            kakao: data.kakao === true,
            x: data.x === true,
          });
        }
      })
      .catch(() => {
        if (active) setProviders({ google: false, kakao: false, x: false });
      });
    return () => {
      active = false;
    };
  }, []);

  const startSocialLogin = (provider: SocialLoginProvider) => {
    if (!providers?.[provider]) {
      setError(`${PROVIDER_LABEL[provider]} 로그인을 준비 중이에요.`);
      return;
    }
    const next = nextPath ?? `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/auth/login?provider=${provider}&next=${encodeURIComponent(next)}`);
  };

  return (
    <div
      className="app-modal-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="social-login-title"
      style={{
        position: "fixed", inset: 0, zIndex: 95, background: "rgba(8, 5, 14, 0.9)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
      onClick={onClose}
    >
      <div className="card" style={{ maxWidth: 380, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: "center", fontSize: "2rem" }}>🐰</div>
        <h3 id="social-login-title" style={{ textAlign: "center", margin: "8px 0 4px" }}>소셜 계정으로 시작하기</h3>
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", textAlign: "center", marginBottom: 16 }}>
          {reason}. 자주 쓰는 계정 하나만 선택하세요.
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
          <button
            type="button"
            className="social-login-button social-login-x"
            onClick={() => startSocialLogin("x")}
            disabled={providers?.x !== true}
          >
            <span className="social-x-mark" aria-hidden>X</span>
            {providers === null
              ? "로그인 확인 중…"
              : providers.x
                ? "X로 계속하기"
                : "X 로그인 준비 중"}
          </button>
        </div>

        <p className="social-login-note">
          {showMatureLabels
            ? "🔞 신규 가입은 로그인 후 최초 한 번만 성인 확인을 진행해요."
            : "신규 가입은 로그인 후 최초 한 번만 정보를 확인해요."}
        </p>
        <button className="btn btn-ghost" style={{ width: "100%", marginTop: 10 }} onClick={onClose}>다음에 할게요</button>
        {error && <p role="alert" style={{ color: "var(--accent)", fontSize: "0.85rem", marginTop: 8, textAlign: "center" }}>{error}</p>}
      </div>
    </div>
  );
}
