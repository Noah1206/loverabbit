import { NextResponse } from "next/server";
import { getSocialProviderStatus } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getSocialProviderStatus(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("소셜 로그인 공급자 상태 조회 실패:", error);
    return NextResponse.json(
      { google: false, kakao: false, error: "소셜 로그인 설정을 확인하지 못했어요." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
