"use client";

import { useEffect } from "react";
import { peekAuthReturn } from "@/lib/auth-return";

// OAuth 공급자가 우리 콜백이 아닌 다른 화면(보통 홈)으로 code를 흘려보내는 경우가 있다.
// 그때 로그인을 포기시키지 않고 /auth/callback으로 넘겨서 세션 교환을 마무리한다.
export default function AuthCodeRescue() {
  useEffect(() => {
    const { pathname, search } = window.location;
    if (pathname.startsWith("/auth/")) return;

    const params = new URLSearchParams(search);
    const code = params.get("code");
    if (!code || params.get("error")) return;

    params.delete("code");
    const rest = params.toString();
    const fallback = `${pathname}${rest ? `?${rest}` : ""}`;
    const next = peekAuthReturn() ?? fallback;

    window.location.replace(
      `/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`
    );
  }, []);

  return null;
}
