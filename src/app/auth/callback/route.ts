import { NextRequest, NextResponse } from "next/server";
import { authErrorUrl, requestOrigin, safeNextPath } from "@/lib/auth-navigation";
import { saveKakaoTokens } from "@/lib/kakao-message";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (!code) {
    return NextResponse.redirect(authErrorUrl(request, "missing_code", next));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("OAuth 코드 교환 실패:", error);
      return NextResponse.redirect(authErrorUrl(request, "session_exchange_failed", next));
    }

    // 카카오 토큰은 이 순간에만 손에 들어온다. Supabase 는 저장하지 않는다.
    // 승인 알림(kakao-message.ts)이 이 토큰으로 나간다. 저장에 실패해도 로그인은 된다.
    const session = data.session;
    if (
      session?.provider_token &&
      session.user?.app_metadata?.provider === "kakao"
    ) {
      await saveKakaoTokens({
        authUserId: session.user.id,
        accessToken: session.provider_token,
        refreshToken: session.provider_refresh_token ?? null,
        scopes: null,
      });
    }

    const completeUrl = new URL("/auth/complete", requestOrigin(request));
    completeUrl.searchParams.set("next", next);
    return NextResponse.redirect(completeUrl);
  } catch (error) {
    console.error("OAuth 콜백 처리 실패:", error);
    return NextResponse.redirect(authErrorUrl(request, "session_exchange_failed", next));
  }
}
