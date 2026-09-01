"use client";

import { useTheme } from "@/components/ThemeProvider";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import BrandMark from "@/components/BrandMark";
import { useEscape } from "@/lib/use-escape";

// 로그인 진입점은 소셜 로그인만 제공한다.
// 신규 사용자의 가입 정보와 약관 동의는 OAuth 완료 화면에서 한 번만 받는다.
export default function SignupModal({
  onClose,
  title = "로그인하고 계속하기",
  reason = "풀 리딩을 열려면 3초 가입이 필요해요",
  nextPath,
}: {
  onClose: () => void;
  title?: string;
  reason?: string;
  // 로그인 완료 후 돌아올 경로. 없으면 팝업을 연 현재 화면으로 복귀한다.
  nextPath?: string;
}) {
  const { showMatureLabels } = useTheme();
  useEscape(onClose);
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

        <SocialLoginButtons nextPath={nextPath} />

        <p className="social-login-note">
          {showMatureLabels
            ? "성인 확인과 사주 정보 입력은 로그인 후 바로 이어져요."
            : "사주 정보 입력은 로그인 후 바로 이어져요."}
        </p>
        <button className="btn btn-ghost" style={{ width: "100%", marginTop: 10 }} onClick={onClose}>나중에 볼게요</button>
      </div>
    </div>
  );
}
