import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getPublicSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) {
    throw new Error("Supabase Auth 환경 변수가 설정되지 않았습니다.");
  }
  return { url, publishableKey };
}

export async function createSupabaseServerClient() {
  const { url, publishableKey } = getPublicSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // A Server Component cannot write cookies. Route Handlers that refresh
          // or exchange sessions can, and are the only callers that require it.
        }
      },
    },
  });
}

export type SocialProvider = "google" | "kakao" | "x";

export async function getSocialProviderStatus(): Promise<Record<SocialProvider, boolean>> {
  const { url, publishableKey } = getPublicSupabaseConfig();
  const response = await fetch(new URL("/auth/v1/settings", url), {
    headers: { apikey: publishableKey },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Supabase Auth 설정을 확인하지 못했습니다 (${response.status}).`);
  }
  const settings = (await response.json()) as {
    external?: Partial<Record<SocialProvider | "twitter", boolean>>;
  };
  return {
    google: settings.external?.google === true,
    kakao: settings.external?.kakao === true,
    // GoTrue's public settings response keeps the historical `twitter` key
    // even though the current Supabase JS OAuth 2.0 provider name is `x`.
    x: settings.external?.x === true || settings.external?.twitter === true,
  };
}
