"use client";

// 소셜 로그인 버튼 세 장. 팝업(SignupModal)과 마이 화면이 같이 쓴다 —
// 두 벌로 두면 한쪽만 고쳐지고, 그날부터 두 화면의 로그인이 달라진다.

import { useEffect, useState } from "react";

import { rememberAuthReturn } from "@/lib/auth-return";

export type SocialLoginProvider = "google" | "kakao" | "x";
type ProviderStatus = Record<SocialLoginProvider, boolean>;

const PROVIDER_LABEL: Record<SocialLoginProvider, string> = {
  google: "Google",
  kakao: "카카오",
  x: "X",
};

export default function SocialLoginButtons({ nextPath }: { nextPath?: string }) {
  const [providers, setProviders] = useState<ProviderStatus | null>(null);
  const [error, setError] = useState("");

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

  const start = (provider: SocialLoginProvider) => {
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

  const labelOf = (provider: SocialLoginProvider, ready: string, pending: string) =>
    providers === null ? "로그인 확인 중…" : providers[provider] ? ready : pending;

  return (
    <>
      <div className="social-login-stack">
        <button
          type="button"
          className="social-login-button social-login-google"
          onClick={() => start("google")}
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
          {labelOf("google", "Google로 계속하기", "Google 로그인 준비 중")}
        </button>
        <button
          type="button"
          className="social-login-button social-login-kakao"
          onClick={() => start("kakao")}
          disabled={providers?.kakao !== true}
        >
          <span className="social-kakao-mark" aria-hidden>
            <svg viewBox="0 0 24 24" focusable="false">
              <path fill="currentColor" d="M12 3C6.48 3 2 6.54 2 10.9c0 2.82 1.87 5.29 4.68 6.68-.21.76-.75 2.72-.86 3.14-.13.53.19.52.41.38.17-.11 2.7-1.83 3.79-2.58.64.09 1.3.14 1.98.14 5.52 0 10-3.54 10-7.76C22 6.54 17.52 3 12 3z" />
            </svg>
          </span>
          {labelOf("kakao", "카카오로 계속하기", "카카오 로그인 준비 중")}
        </button>
        <button
          type="button"
          className="social-login-button social-login-x"
          onClick={() => start("x")}
          disabled={providers?.x !== true}
        >
          <span className="social-x-mark" aria-hidden>
            <svg viewBox="0 0 24 24" focusable="false">
              <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
            </svg>
          </span>
          {labelOf("x", "X로 계속하기", "X 로그인 준비 중")}
        </button>
      </div>
      {error && (
        <p className="social-login-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
