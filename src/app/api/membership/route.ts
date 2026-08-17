import { NextRequest, NextResponse } from "next/server";
import { seal, open } from "@/lib/crypto";
import { MEMBERSHIP_PRICE } from "@/lib/store";

// 밤의 멤버십 발급 — 계좌이체(선해금·후대조) 후 30일 유효 서명 토큰을 발급한다.
// 토큰은 서버 키(READING_SECRET)로 봉인되어 위조·기간 연장이 불가능하다.
// ⚠️ 진짜 정기결제(자동 갱신)는 토스페이먼츠 빌링 가맹 후 이 라우트를 빌링키 결제로 교체할 것.

const MEMBERSHIP_DAYS = 30;

export interface MembershipToken {
  type: "membership";
  exp: number; // epoch ms
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { depositorCode?: string; userToken?: string };

  // 멤버십은 회원가입 필수 — 이메일이 결제 기록에 묶인다
  const u = body.userToken ? open<{ type: string; email: string }>(body.userToken) : null;
  if (u?.type !== "user" || !u.email) {
    return NextResponse.json({ error: "멤버십 가입에는 회원가입이 필요해요.", needSignup: true }, { status: 401 });
  }
  if (!body.depositorCode) {
    return NextResponse.json({ error: "입금코드가 없습니다." }, { status: 400 });
  }

  const exp = Date.now() + MEMBERSHIP_DAYS * 24 * 60 * 60 * 1000;
  // Vercel 대시보드 → Logs에서 입금코드로 통장 내역과 대조
  console.log(
    `[결제:멤버십] user=${u.email} code=${body.depositorCode} amount=${MEMBERSHIP_PRICE} exp=${new Date(exp).toISOString()}`
  );

  const token = seal({ type: "membership", exp } satisfies MembershipToken);
  return NextResponse.json({ token, expiresAt: exp, price: MEMBERSHIP_PRICE });
}
