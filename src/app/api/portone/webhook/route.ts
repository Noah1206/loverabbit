import { Webhook } from "@portone/server-sdk";
import { NextRequest, NextResponse } from "next/server";

import { finalizePortOnePayment, getPortOneServerConfig } from "@/lib/portone-payment";
import { PortOnePaymentError } from "@/lib/portone-validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = process.env.PORTONE_WEBHOOK_SECRET?.trim() ?? "";
  const config = getPortOneServerConfig();
  if (!secret || !config) {
    return NextResponse.json({ error: "포트원 웹훅 설정이 완료되지 않았습니다." }, { status: 503 });
  }

  const payload = await request.text();
  let webhook;
  try {
    webhook = await Webhook.verify(secret, payload, Object.fromEntries(request.headers.entries()));
  } catch (error) {
    console.error("포트원 웹훅 서명 검증 실패:", error);
    return NextResponse.json({ error: "웹훅 서명이 올바르지 않습니다." }, { status: 400 });
  }

  if (webhook.type !== "Transaction.Paid") {
    return NextResponse.json({ ok: true, ignored: true });
  }
  if (webhook.data.storeId !== config.storeId) {
    return NextResponse.json({ error: "웹훅 상점 정보가 일치하지 않습니다." }, { status: 400 });
  }

  try {
    const completed = await finalizePortOnePayment(webhook.data.paymentId);
    return NextResponse.json({
      ok: true,
      paymentId: completed.paymentId,
      alreadyPaid: completed.alreadyPaid,
    });
  } catch (error) {
    console.error("포트원 웹훅 결제 반영 실패:", error);
    const status = error instanceof PortOnePaymentError ? error.status : 503;
    return NextResponse.json(
      {
        error:
          error instanceof PortOnePaymentError
            ? error.message
            : "결제 반영 중 서버 오류가 발생했습니다.",
      },
      { status }
    );
  }
}
