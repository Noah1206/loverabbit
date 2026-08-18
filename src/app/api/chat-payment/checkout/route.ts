import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getChatProduct } from "@/lib/chat-products";
import { createOrder, isDatabaseConfigured } from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";

interface Body {
  productId?: string;
  userToken?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const product = getChatProduct(body.productId);
  if (!product) {
    return NextResponse.json({ error: "대화권 상품을 확인하지 못했어요." }, { status: 400 });
  }
  if (!process.env.TOSS_SECRET_KEY || !process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY) {
    return NextResponse.json({ error: "토스페이먼츠 결제 설정이 아직 완료되지 않았어요." }, { status: 503 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "결제 DB 연결을 준비 중입니다." }, { status: 503 });
  }

  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch (error) {
    console.error("캐릭터챗 결제 회원 확인 실패:", error);
    return NextResponse.json({ error: "로그인 정보를 확인하지 못했어요." }, { status: 503 });
  }
  if (!user?.userId) {
    return NextResponse.json({ error: "대화권을 결제하려면 먼저 로그인해주세요.", needSignup: true }, { status: 401 });
  }

  const providerOrderId = `LRC_${randomUUID().replace(/-/g, "")}`;
  try {
    await createOrder({
      userId: user.userId,
      kind: "chat_credits",
      method: "toss-pg",
      status: "pending",
      amount: product.price,
      providerOrderId,
      metadata: {
        productId: product.id,
        credits: product.credits,
        checkout_created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("캐릭터챗 결제 주문 생성 실패:", error);
    return NextResponse.json({ error: "대화권 주문을 만들지 못했어요." }, { status: 503 });
  }

  return NextResponse.json({
    orderId: providerOrderId,
    amount: product.price,
    orderName: product.name,
  });
}
