import { NextRequest, NextResponse } from "next/server";
import { authErrorUrl, requestOrigin, safeNextPath } from "@/lib/auth-navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (!code) {
    return NextResponse.redirect(authErrorUrl(request, "missing_code", next));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("OAuth 코드 교환 실패:", error);
      return NextResponse.redirect(authErrorUrl(request, "session_exchange_failed", next));
    }
    const completeUrl = new URL("/auth/complete", requestOrigin(request));
    completeUrl.searchParams.set("next", next);
    return NextResponse.redirect(completeUrl);
  } catch (error) {
    console.error("OAuth 콜백 처리 실패:", error);
    return NextResponse.redirect(authErrorUrl(request, "session_exchange_failed", next));
  }
}
