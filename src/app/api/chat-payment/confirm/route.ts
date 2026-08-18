import { NextRequest, NextResponse } from "next/server";

import {
  completeChatCreditOrder,
  getOrderByProviderOrderId,
  getReferralStatus,
  isDatabaseConfigured,
} from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";

interface Body {
  userToken?: string;
  paymentKey?: string;
  orderId?: string;
  amount?: number;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "토스페이먼츠 결제 설정이 완료되지 않았어요." }, { status: 503 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "결제 DB 연결을 준비 중입니다." }, { status: 503 });
  }

  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch (error) {
    console.error("캐릭터챗 결제 승인 회원 확인 실패:", error);
    return NextResponse.json({ error: "로그인 정보를 확인하지 못했어요." }, { status: 503 });
  }
  if (!user?.userId || !body.paymentKey || !body.orderId || !Number.isSafeInteger(body.amount)) {
    return NextResponse.json({ error: "결제 정보가 올바르지 않아요." }, { status: 400 });
  }

  let order;
  try {
    order = await getOrderByProviderOrderId(body.orderId);
  } catch (error) {
    console.error("캐릭터챗 결제 주문 조회 실패:", error);
    return NextResponse.json({ error: "결제 주문을 확인하지 못했어요." }, { status: 503 });
  }
  if (
    !order ||
    order.userId !== user.userId ||
    order.kind !== "chat_credits" ||
    order.readingId !== null ||
    order.amount !== body.amount
  ) {
    return NextResponse.json({ error: "서버 주문 정보와 일치하지 않아요." }, { status: 400 });
  }
  if (order.status === "paid") {
    const status = await getReferralStatus(user.userId);
    return NextResponse.json({ creditsRemaining: status?.chatCredits ?? 0, alreadyPaid: true });
  }
  if (order.status !== "pending") {
    return NextResponse.json({ error: "결제할 수 없는 주문 상태예요." }, { status: 409 });
  }

  const response = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      paymentKey: body.paymentKey,
      orderId: body.orderId,
      amount: order.amount,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: `결제 승인 실패: ${error?.message ?? response.status}` },
      { status: 402 }
    );
  }

  try {
    const completed = await completeChatCreditOrder(body.orderId, user.userId);
    if (!completed) throw new Error("결제 완료 주문을 찾지 못했습니다.");
    return NextResponse.json({
      orderId: completed.orderId,
      creditsRemaining: completed.creditsRemaining,
    });
  } catch (error) {
    console.error("캐릭터챗 결제 승인 결과 저장 실패:", error);
    return NextResponse.json(
      { error: "결제는 승인됐지만 대화권 저장에 실패했어요. 주문번호로 고객센터에 문의해주세요." },
      { status: 503 }
    );
  }
}
