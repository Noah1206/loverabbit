import { NextRequest, NextResponse } from "next/server";

import {
  adminKeyFromAuthorization,
  isAdminApprovalConfigured,
  verifyAdminApprovalKey,
} from "@/lib/admin-auth";
import { isDatabaseConfigured, moderateReview } from "@/lib/database";

// 후기 내리기·되돌리기.
//
// 내릴 때 사유를 반드시 받는다. 별점이 낮다는 이유로 조용히 걷어내면 남아 있는
// 후기 전체가 거짓말이 된다. 도배·욕설·개인정보처럼 댈 수 있는 사유가 있을 때만
// 내려가야 하고, 그 사유는 DB에 남는다 (lr_reviews.hidden_reason).

const MIN_REASON = 2;

type ModerateRequest = {
  status?: "published" | "hidden";
  reason?: string;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminApprovalConfigured()) {
    return NextResponse.json({ error: "관리자 승인 키가 설정되지 않았어요." }, { status: 503 });
  }
  if (!verifyAdminApprovalKey(adminKeyFromAuthorization(request.headers.get("authorization")))) {
    return NextResponse.json({ error: "관리자 인증에 실패했어요." }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "후기 DB 연결을 준비 중입니다." }, { status: 503 });
  }

  const { id } = await params;
  const reviewId = Number(id);
  if (!Number.isSafeInteger(reviewId) || reviewId <= 0) {
    return NextResponse.json({ error: "후기 번호가 올바르지 않아요." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as ModerateRequest;
  if (body.status !== "published" && body.status !== "hidden") {
    return NextResponse.json({ error: "노출 상태를 선택해주세요." }, { status: 400 });
  }

  const reason = (body.reason ?? "").trim();
  if (body.status === "hidden" && reason.length < MIN_REASON) {
    return NextResponse.json(
      { error: "후기를 내리는 사유를 적어주세요 (도배·욕설·개인정보 등)." },
      { status: 400 }
    );
  }

  try {
    const updated = await moderateReview(reviewId, body.status, reason);
    if (!updated) {
      return NextResponse.json({ error: "후기를 찾을 수 없어요." }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error("후기 상태 변경 실패:", error);
    return NextResponse.json({ error: "후기 상태를 바꾸지 못했어요." }, { status: 503 });
  }
}
