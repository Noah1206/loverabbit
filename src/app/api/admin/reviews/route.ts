import { NextRequest, NextResponse } from "next/server";

import {
  adminKeyFromAuthorization,
  isAdminApprovalConfigured,
  verifyAdminApprovalKey,
} from "@/lib/admin-auth";
import { isDatabaseConfigured, listReviewsForAdmin } from "@/lib/database";
import type { ReviewStatus } from "@/lib/reviews";

export async function GET(request: NextRequest) {
  if (!isAdminApprovalConfigured()) {
    return NextResponse.json({ error: "관리자 승인 키가 설정되지 않았어요." }, { status: 503 });
  }
  if (!verifyAdminApprovalKey(adminKeyFromAuthorization(request.headers.get("authorization")))) {
    return NextResponse.json({ error: "관리자 인증에 실패했어요." }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "후기 DB 연결을 준비 중입니다." }, { status: 503 });
  }

  const requested = request.nextUrl.searchParams.get("status");
  const status: ReviewStatus | undefined =
    requested === "published" || requested === "hidden" ? requested : undefined;

  try {
    const reviews = await listReviewsForAdmin(status);
    return NextResponse.json(
      { reviews },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("후기 목록 조회 실패:", error);
    return NextResponse.json({ error: "후기를 불러오지 못했어요." }, { status: 503 });
  }
}
