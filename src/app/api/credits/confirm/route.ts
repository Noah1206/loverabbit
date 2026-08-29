import { NextRequest, NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/database";
import { finalizePortOnePayment } from "@/lib/portone-payment";
import { PortOnePaymentError } from "@/lib/portone-validation";
import { resolveUserToken } from "@/lib/tokens";

// 포트원 결제 뒤 돌아온 브라우저가 부른다. 웹훅이 먼저 끝냈으면 잔액만 돌아온다.
interface Body {
  userToken?: string;
  paymentId?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "결제 DB 연결을 준비 중입니다." }, { status: 503 });
  }
  if (!body.paymentId) return NextResponse.json({ error: "결제 번호를 확인하지 못했어요." }, { status: 400 });

  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch (error) {
    console.error("크레딧 결제 승인 회원 확인 실패:", error);
    return NextResponse.json({ error: "로그인 정보를 확인하지 못했어요." }, { status: 503 });
  }
  if (!user?.userId) return NextResponse.json({ error: "결제 정보가 올바르지 않아요." }, { status: 400 });

  try {
    const completed = await finalizePortOnePayment(body.paymentId, { userId: user.userId, kind: "chat_credits" });
    return NextResponse.json({
      paymentId: completed.paymentId,
      amount: completed.amount,
      creditsRemaining: completed.creditsRemaining ?? 0,
      alreadyPaid: completed.alreadyPaid,
    });
  } catch (error) {
    console.error("크레딧 포트원 결제 검증 실패:", error);
    const status = error instanceof PortOnePaymentError ? error.status : 503;
    return NextResponse.json(
      { error: error instanceof PortOnePaymentError ? error.message : "결제 확인 중 오류가 발생했어요. 잠시 후 다시 확인해주세요." },
      { status }
    );
  }
}
