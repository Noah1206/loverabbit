import { NextRequest, NextResponse } from "next/server";

import {
  adminKeyFromAuthorization,
  isAdminApprovalConfigured,
  verifyAdminApprovalKey,
} from "@/lib/admin-auth";
import { isDatabaseConfigured } from "@/lib/database";
import { reviewOrderAndFollowUp } from "@/lib/order-review";

/*
  승인이 곧 생성 시작이다 (order-review.ts). 생성은 waitUntil 로 응답 뒤에
  돌지만, 그 배경 작업도 이 함수의 수명 안에서만 산다 — 함수가 끝나면 같이
  죽는다. 선언이 없으면 플랫폼 기본값(초 단위)이라 열두 절을 만들다 중간에
  잘리고, 그 자리에서 lr_reading_resume.generating_at 만 남는다.

  그 표식은 10분간 아무도 못 집게 막으므로, 승인 직후 열러 온 손님의
  /api/unlock 도 "준비 중"(503)으로 돌아선다. 돈은 받았는데 글이 안 나오는
  구간이 여기서 생겼다.

  실제로 만드는 /api/unlock·/api/reading 과 같은 300 으로 맞춘다.
*/
export const maxDuration = 300;

type ReviewRequest = {
  decision?: "paid" | "cancelled";
  note?: string;
};

// 승인의 뒷일(쿠폰·전환·생성 시작)은 order-review.ts 에 있다. 텔레그램 버튼도
// 같은 함수를 부르므로 여기에 뭔가를 더하면 그쪽도 같이 받는다.
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
    return NextResponse.json({ error: "결제 DB 연결을 준비 중입니다." }, { status: 503 });
  }

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "주문 번호가 올바르지 않아요." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as ReviewRequest;
  if (body.decision !== "paid" && body.decision !== "cancelled") {
    return NextResponse.json({ error: "승인 또는 거절 상태를 선택해주세요." }, { status: 400 });
  }

  const result = await reviewOrderAndFollowUp(orderId, body.decision, body.note);
  if (result.ok) {
    return NextResponse.json({ orderId: result.orderId, readingId: result.readingId, status: result.status });
  }
  if (result.reason === "already_reviewed") {
    return NextResponse.json({ error: "이미 처리됐거나 존재하지 않는 주문이에요." }, { status: 409 });
  }
  if (result.reason === "not_found") {
    return NextResponse.json({ error: "승인할 주문을 찾을 수 없어요." }, { status: 404 });
  }
  return NextResponse.json({ error: "주문 승인 처리에 실패했어요." }, { status: 503 });
}
