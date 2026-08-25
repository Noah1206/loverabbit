import { NextRequest, NextResponse } from "next/server";
import { listUserCoupons } from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";
import { couponState } from "@/lib/coupons";

// 내 쿠폰함. 상태(쓸 수 있음·붙어 있음·씀·지남)는 서버 시각으로 붙여 보낸다.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { userToken?: string };
  try {
    const user = await resolveUserToken(body.userToken);
    if (!user?.userId) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }
    const coupons = await listUserCoupons(user.userId);
    const now = Date.now();
    return NextResponse.json({
      coupons: coupons.map((coupon) => ({ ...coupon, state: couponState(coupon, now) })),
    });
  } catch (error) {
    console.error("쿠폰 조회 실패:", error);
    return NextResponse.json({ error: "쿠폰함을 불러오지 못했어요." }, { status: 503 });
  }
}
