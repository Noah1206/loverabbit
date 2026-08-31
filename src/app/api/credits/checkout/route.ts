import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getCreditPack, isFirstBuyPack } from "@/lib/credits";
import { hasPurchasedCredits } from "@/lib/credits-db";
import { createOrder, isDatabaseConfigured } from "@/lib/database";
import { getPortOneNoticeUrl } from "@/lib/portone-notice-url";
import { getPortOneServerConfig, hasAnyPortOneServerSetting } from "@/lib/portone-payment";
import { resolveUserToken } from "@/lib/tokens";

// 크레딧 팩 — 포트원(KG이니시스) 주문 생성. 리딩 결제(/api/checkout)와 같은 모양이고
// 쿠폰만 없다. 크레딧에는 쿠폰이 붙지 않는다 — 두 체계를 섞지 않는다.
interface Body {
  packId?: string;
  userToken?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const pack = getCreditPack(body.packId);
  if (!pack) return NextResponse.json({ error: "러빗 상품을 확인하지 못했어요." }, { status: 400 });

  const portOneConfig = getPortOneServerConfig();
  if (!portOneConfig) {
    return NextResponse.json(
      { error: hasAnyPortOneServerSetting() ? "포트원 결제 키 설정을 확인해주세요." : "결제 설정이 아직 완료되지 않았어요." },
      { status: 503 }
    );
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "결제 DB 연결을 준비 중입니다." }, { status: 503 });
  }

  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch (error) {
    console.error("러빗 결제 회원 확인 실패:", error);
    return NextResponse.json({ error: "로그인 정보를 확인하지 못했어요." }, { status: 503 });
  }
  if (!user?.userId) {
    return NextResponse.json({ error: "러빗을 사려면 먼저 로그인해주세요.", needSignup: true }, { status: 401 });
  }


  // 첫 구매 팩은 한 번만. 화면이 안 보여줘도 팩 id 만 알면 부를 수 있는 자리라
  // 서버가 막는다.
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

  const paymentId = `LRCP_${randomUUID().replace(/-/g, "")}`;
  try {
    await createOrder({
      userId: user.userId,
      kind: "chat_credits",
      method: "portone-pg",
      status: "pending",
      amount: pack.price,
      providerOrderId: paymentId,
      metadata: { packId: pack.id, credits: pack.credits, checkout_created_at: new Date().toISOString() },
    });
  } catch (error) {
    console.error("러빗 주문 생성 실패:", error);
    return NextResponse.json({ error: "러빗 주문을 만들지 못했어요." }, { status: 503 });
  }

  return NextResponse.json({
    orderId: paymentId,
    paymentId,
    amount: pack.price,
    orderName: `러브레빗 ${pack.name}`,
    provider: "portone",
    noticeUrl: getPortOneNoticeUrl(request.nextUrl.origin),
  });
}
