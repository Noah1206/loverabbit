import { NextRequest, NextResponse } from "next/server";

import { creditDepositorCode, getCreditPack, isFirstBuyPack } from "@/lib/credits";
import { createPendingCreditTransferOrder, hasPurchasedCredits } from "@/lib/credits-db";
import { isDatabaseConfigured } from "@/lib/database";
import { notifyAdmin, reviewButtons } from "@/lib/telegram";
import { resolveUserToken } from "@/lib/tokens";

// 크레딧 팩 — 직접 송금. 지금 실제로 돈이 들어오는 유일한 길이다 (pay-method.ts).
// 관리자가 /admin/payments 에서 승인하면 lr_review_transfer_order 가 지급한다.
interface Body {
  packId?: string;
  userToken?: string;
  depositorCode?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const pack = getCreditPack(body.packId);
  if (!pack) return NextResponse.json({ error: "러빗 상품을 확인하지 못했어요." }, { status: 400 });
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
    console.error("러빗 계좌이체 회원 확인 실패:", error);
    return NextResponse.json({ error: "로그인 정보를 확인하지 못했어요." }, { status: 503 });
  }
  if (!user?.userId || !body.userToken) {
    return NextResponse.json({ error: "러빗을 사려면 먼저 로그인해주세요.", needSignup: true }, { status: 401 });
  }

  const expectedCode = creditDepositorCode(body.userToken);
  if (body.depositorCode !== expectedCode) {
    return NextResponse.json({ error: "입금코드가 올바르지 않아요." }, { status: 400 });
  }

  // 첫 구매 팩은 한 번만. 포트원 쪽과 같은 규칙이다 — 결제로 가는 길이 둘인데
  // 한쪽에만 걸면 그쪽으로 계속 산다.
  if (isFirstBuyPack(pack.id)) {
    let bought;
    try {
      bought = await hasPurchasedCredits(user.userId);
    } catch (error) {
      console.error("첫 구매 여부 확인 실패:", error);
      return NextResponse.json({ error: "구매 자격을 확인하지 못했어요." }, { status: 503 });
    }
    if (bought) {
      return NextResponse.json(
        { error: "첫 구매 할인은 한 번만 쓸 수 있어요.", firstBuyUsed: true },
        { status: 409 }
      );
    }
  }

  try {
    const order = await createPendingCreditTransferOrder({
      userId: user.userId,
      packId: pack.id,
      credits: pack.credits,
      amount: pack.price,
      depositorCode: expectedCode,
    });
    if (!order) throw new Error("승인 대기 주문을 만들 수 없습니다.");
    // 같은 주문은 한 번만 알린다 — 리딩 이체와 같은 이유.
    if (order.created) {
      await notifyAdmin(
        [
          "[입금 확인 요청] 질문 러빗",
          `주문 #${order.id} · ${order.amount.toLocaleString()}원 · ${pack.credits}러빗`,
          `입금코드 ${order.depositorCode}`,
          "https://loverebbit.xyz/admin/payments",
        ].join("\n"),
        reviewButtons(order.id)
      );
    }
    return NextResponse.json({
      orderId: order.id,
      status: order.status,
      amount: order.amount,
      credits: pack.credits,
      depositorCode: order.depositorCode,
    });
  } catch (error) {
    console.error("러빗 계좌이체 승인 요청 실패:", error);
    return NextResponse.json({ error: "입금 확인 요청을 저장하지 못했어요." }, { status: 503 });
  }
}
