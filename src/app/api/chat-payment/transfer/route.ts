import { NextRequest, NextResponse } from "next/server";

import { chatDepositorCode, getChatProduct } from "@/lib/chat-products";
import { createPendingChatTransferOrder, isDatabaseConfigured } from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";
import { notifyAdmin, reviewButtons } from "@/lib/telegram";

interface Body {
  productId?: string;
  userToken?: string;
  depositorCode?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const product = getChatProduct(body.productId);
  if (!product) {
    return NextResponse.json({ error: "대화권 상품을 확인하지 못했어요." }, { status: 400 });
  }
  if (!process.env.NEXT_PUBLIC_BANK_NAME || !process.env.NEXT_PUBLIC_BANK_ACCOUNT) {
    return NextResponse.json({ error: "계좌이체 결제 설정이 아직 완료되지 않았어요." }, { status: 503 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "결제 DB 연결을 준비 중입니다." }, { status: 503 });
  }

  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch (error) {
    console.error("캐릭터챗 계좌이체 회원 확인 실패:", error);
    return NextResponse.json({ error: "로그인 정보를 확인하지 못했어요." }, { status: 503 });
  }
  if (!user?.userId || !body.userToken) {
    return NextResponse.json({ error: "대화권을 결제하려면 먼저 로그인해주세요.", needSignup: true }, { status: 401 });
  }

  const expectedCode = chatDepositorCode(body.userToken);
  if (body.depositorCode !== expectedCode) {
    return NextResponse.json({ error: "입금코드가 올바르지 않아요." }, { status: 400 });
  }

  try {
    const order = await createPendingChatTransferOrder({
      userId: user.userId,
      productId: product.id,
      credits: product.credits,
      amount: product.price,
      depositorCode: expectedCode,
    });
    if (!order) throw new Error("승인 대기 주문을 만들 수 없습니다.");
    // 리딩 이체와 같은 이유 — 사람이 승인해야 풀리는 주문은 사람에게 알린다.
    // 새로 만든 주문일 때만. 다시 누르면 기존 대기 주문이 돌아오고, 알림은 이미 갔다.
    if (order.created) await notifyAdmin(
      [
        "[입금 확인 요청] 대화권",
        `주문 #${order.id} · ${order.amount.toLocaleString()}원 · ${product.credits}회권`,
        `입금코드 ${order.depositorCode}`,
        "https://loverebbit.xyz/admin/payments",
      ].join("\n"),
      reviewButtons(order.id)
    );
    return NextResponse.json({
      orderId: order.id,
      status: order.status,
      amount: order.amount,
      credits: product.credits,
      depositorCode: order.depositorCode,
    });
  } catch (error) {
    console.error("캐릭터챗 계좌이체 승인 요청 실패:", error);
    return NextResponse.json({ error: "입금 확인 요청을 저장하지 못했어요." }, { status: 503 });
  }
}
