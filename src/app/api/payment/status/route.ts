import { NextRequest, NextResponse } from "next/server";

import { getTransferOrderForUser, isDatabaseConfigured } from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";

type StatusRequest = {
  orderId?: number;
  userToken?: string;
};

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "결제 DB 연결을 준비 중입니다." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as StatusRequest;
  const orderId = Number(body.orderId);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "주문 번호가 올바르지 않아요." }, { status: 400 });
  }

  try {
    const user = await resolveUserToken(body.userToken);
    if (!user?.userId) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    const order = await getTransferOrderForUser(orderId, user.userId);
    if (!order) {
      return NextResponse.json({ error: "주문을 찾을 수 없어요." }, { status: 404 });
    }

    return NextResponse.json(
      {
        orderId: order.id,
        readingId: order.readingId,
        status: order.status,
        amount: order.amount,
        depositorCode: order.depositorCode,
        requestedAt: order.createdAt,
        paidAt: order.paidAt,
        // 운영자가 승인·거절하며 적은 메모. 손님에게 보여 주려고 적는 것이다
        // (2026-08-27) — "입금자명이 달라요", "금액이 1,900원이 아니에요" 같은 것.
        note: typeof order.metadata.review_note === "string" ? order.metadata.review_note : null,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("계좌이체 주문 상태 확인 실패:", error);
    return NextResponse.json({ error: "입금 확인 상태를 불러오지 못했어요." }, { status: 503 });
  }
}
