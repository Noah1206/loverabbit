"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { rememberAuthReturn } from "@/lib/auth-return";
import type { User } from "@/lib/user";
import BrandMark from "@/components/BrandMark";

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
  title = "로그인하고 계속하기",
  reason = "풀 리딩을 열려면 3초 가입이 필요해요",
  nextPath,
}: {
  onDone: (u: User) => void;
  onClose: () => void;
  title?: string;
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
    // 정확한 복귀 경로(쿼리 포함)는 탭에 저장하고, OAuth에는 쿼리 없는 경로만 넘긴다.
    rememberAuthReturn(next);
    const fallbackNext = next.split("?")[0].split("#")[0];
    window.location.assign(`/auth/login?provider=${provider}&next=${encodeURIComponent(fallbackNext)}`);
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
        <div style={{ display: "flex", justifyContent: "center" }}><BrandMark size={52} /></div>
        <h3 id="social-login-title" style={{ textAlign: "center", margin: "8px 0 4px" }}>{title}</h3>
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", textAlign: "center", marginBottom: 16 }}>
          {reason}
        </p>

        <div className="social-login-stack">
          <button
            type="button"
            className="social-login-button social-login-google"
            onClick={() => startSocialLogin("google")}
            disabled={providers?.google !== true}
          >
            <span className="social-google-mark" aria-hidden>
              <svg viewBox="0 0 48 48" focusable="false">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
            </span>
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
            <span className="social-kakao-mark" aria-hidden>
              <svg viewBox="0 0 24 24" focusable="false">
                <path fill="currentColor" d="M12 3C6.48 3 2 6.54 2 10.9c0 2.82 1.87 5.29 4.68 6.68-.21.76-.75 2.72-.86 3.14-.13.53.19.52.41.38.17-.11 2.7-1.83 3.79-2.58.64.09 1.3.14 1.98.14 5.52 0 10-3.54 10-7.76C22 6.54 17.52 3 12 3z" />
              </svg>
            </span>
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
            <span className="social-x-mark" aria-hidden>
              <svg viewBox="0 0 24 24" focusable="false">
                <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
              </svg>
            </span>
            {providers === null
              ? "로그인 확인 중…"
              : providers.x
                ? "X로 계속하기"
                : "X 로그인 준비 중"}
          </button>
        </div>

        <p className="social-login-note">
          {showMatureLabels
            ? "🔞 성인용 리딩은 신규 가입 시 한 번만 성인 확인해요."
            : "신규 가입 시 정보 확인은 한 번만 진행해요."}
        </p>
        <button className="btn btn-ghost" style={{ width: "100%", marginTop: 10 }} onClick={onClose}>나중에 볼게요</button>
        {error && <p role="alert" style={{ color: "var(--accent)", fontSize: "0.85rem", marginTop: 8, textAlign: "center" }}>{error}</p>}
      </div>
    </div>
  );
}
