import { NextRequest, NextResponse } from "next/server";

import {
  adminKeyFromAuthorization,
  isAdminApprovalConfigured,
  verifyAdminApprovalKey,
} from "@/lib/admin-auth";
import { isDatabaseConfigured, listPendingTransferOrders } from "@/lib/database";

export async function GET(request: NextRequest) {
  if (!isAdminApprovalConfigured()) {
    return NextResponse.json({ error: "관리자 승인 키가 설정되지 않았어요." }, { status: 503 });
  }
  if (!verifyAdminApprovalKey(adminKeyFromAuthorization(request.headers.get("authorization")))) {
    return NextResponse.json({ error: "관리자 인증에 실패했어요." }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "결제 DB 연결을 준비 중입니다." }, { status: 503 });
  }

  try {
    const orders = await listPendingTransferOrders();
    return NextResponse.json(
      { orders },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("관리자 승인 대기 주문 조회 실패:", error);
    return NextResponse.json({ error: "승인 대기 주문을 불러오지 못했어요." }, { status: 503 });
  }
}
