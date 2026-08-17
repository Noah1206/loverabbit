import { NextRequest, NextResponse } from "next/server";
import { requestOrigin, safeNextPath } from "@/lib/auth-navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (!code) {
    return NextResponse.redirect(new URL("/auth/error?reason=missing_code", requestOrigin(request)));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("OAuth 코드 교환 실패:", error);
      return NextResponse.redirect(
        new URL("/auth/error?reason=session_exchange_failed", requestOrigin(request))
      );
    }
    const completeUrl = new URL("/auth/complete", requestOrigin(request));
    completeUrl.searchParams.set("next", next);
    return NextResponse.redirect(completeUrl);
  } catch (error) {
    console.error("OAuth 콜백 처리 실패:", error);
    return NextResponse.redirect(
      new URL("/auth/error?reason=session_exchange_failed", requestOrigin(request))
    );
  }
}
