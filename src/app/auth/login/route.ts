import { NextRequest, NextResponse } from "next/server";
import { authErrorUrl, requestOrigin, safeNextPath } from "@/lib/auth-navigation";
import {
  createSupabaseServerClient,
  getSocialProviderStatus,
  type SocialProvider,
} from "@/lib/supabase-server";

function isSocialProvider(value: string | null): value is SocialProvider {
  return value === "google" || value === "kakao" || value === "x";
}

function authError(request: NextRequest, reason: string) {
  // 돌아갈 자리를 들려 보낸다. 실패했다고 홈으로 보내면 하려던 일이 사라진다.
  const next = request.nextUrl.searchParams.get("next");
  return NextResponse.redirect(authErrorUrl(request, reason, next));
}

export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get("provider");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (!isSocialProvider(provider)) return authError(request, "invalid_provider");

  try {
    const providers = await getSocialProviderStatus();
    if (!providers[provider]) return authError(request, "provider_disabled");

    const supabase = await createSupabaseServerClient();
    const redirectTo = new URL("/auth/callback", requestOrigin(request));
    redirectTo.searchParams.set("next", next);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectTo.toString(),
        skipBrowserRedirect: true,
        ...(provider === "kakao"
          ? { scopes: "account_email profile_nickname talk_message" }
          : provider === "google"
            ? { queryParams: { prompt: "select_account" } }
            : {}),
      },
    });
    if (error || !data.url) {
      console.error("OAuth 시작 실패:", error);
      return authError(request, "oauth_start_failed");
    }
    return NextResponse.redirect(data.url);
  } catch (error) {
    console.error("OAuth 시작 처리 실패:", error);
    return authError(request, "oauth_start_failed");
  }
}
