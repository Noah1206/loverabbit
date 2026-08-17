import { NextRequest, NextResponse } from "next/server";
import { seal } from "@/lib/crypto";
import { MEMBERSHIP_PRICE } from "@/lib/store";
import { createMembership, createOrder, isDatabaseConfigured } from "@/lib/database";
import { resolveUserToken, type MembershipToken } from "@/lib/tokens";

// 밤의 멤버십 발급 — 계좌이체(선해금·후대조) 후 30일 유효 서명 토큰을 발급한다.
// 토큰은 서버 키(READING_SECRET)로 봉인되어 위조·기간 연장이 불가능하다.
// ⚠️ 진짜 정기결제(자동 갱신)는 토스페이먼츠 빌링 가맹 후 이 라우트를 빌링키 결제로 교체할 것.

const MEMBERSHIP_DAYS = 30;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { depositorCode?: string; userToken?: string };

  // 멤버십은 회원가입 필수 — 이메일이 결제 기록에 묶인다
  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch (error) {
    console.error("멤버십 회원 확인 실패:", error);
    return NextResponse.json({ error: "회원 정보를 확인하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }
  if (!user) {
    return NextResponse.json({ error: "멤버십 가입에는 회원가입이 필요해요.", needSignup: true }, { status: 401 });
  }
  if (!/^레빗M-[A-Z0-9]{4}$/u.test(body.depositorCode ?? "")) {
    return NextResponse.json({ error: "입금코드가 올바르지 않습니다." }, { status: 400 });
  }

  if (isDatabaseConfigured() && !user.userId) {
    return NextResponse.json({ error: "회원 정보를 확인하지 못했어요. 다시 가입해주세요." }, { status: 503 });
  }

  const startsAt = Date.now();
  const exp = startsAt + MEMBERSHIP_DAYS * 24 * 60 * 60 * 1000;
  let membershipId: number | undefined;
  try {
    if (user.userId) {
      const orderId = await createOrder({
        userId: user.userId,
        kind: "membership",
        method: "transfer",
        status: "pending",
        amount: MEMBERSHIP_PRICE,
        depositorCode: body.depositorCode,
      });
      membershipId =
        (await createMembership({ userId: user.userId, orderId, startsAt, expiresAt: exp })) ?? undefined;
    }
  } catch (error) {
    console.error("멤버십 저장 실패:", error);
    return NextResponse.json({ error: "멤버십 정보를 저장하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }
  if (process.env.NODE_ENV === "production" && (!isDatabaseConfigured() || !membershipId)) {
    return NextResponse.json({ error: "멤버십 DB 연결을 준비 중입니다. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  console.log(`[결제:멤버십] userId=${user.userId ?? "local"} membershipId=${membershipId ?? "local"} amount=${MEMBERSHIP_PRICE}`);

  const token = seal({
    type: "membership",
    exp,
    userId: user.userId,
    membershipId,
  } satisfies MembershipToken);
  return NextResponse.json({ token, expiresAt: exp, price: MEMBERSHIP_PRICE });
}
