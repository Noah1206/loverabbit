import { NextRequest, NextResponse } from "next/server";

import {
  adminKeyFromAuthorization,
  isAdminApprovalConfigured,
  verifyAdminApprovalKey,
} from "@/lib/admin-auth";
import { isDatabaseConfigured, reviewTransferOrder } from "@/lib/database";

type ReviewRequest = {
  decision?: "paid" | "cancelled";
  note?: string;
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

  try {
    const reviewed = await reviewTransferOrder(orderId, body.decision, body.note);
    if (!reviewed) {
      return NextResponse.json({ error: "승인할 주문을 찾을 수 없어요." }, { status: 404 });
    }
    return NextResponse.json(reviewed);
  } catch (error) {
    console.error("관리자 계좌이체 승인 실패:", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("PENDING_TRANSFER_ORDER_NOT_FOUND")) {
      return NextResponse.json({ error: "이미 처리됐거나 존재하지 않는 주문이에요." }, { status: 409 });
    }
    return NextResponse.json({ error: "주문 승인 처리에 실패했어요." }, { status: 503 });
  }
}
