import { NextRequest, NextResponse } from "next/server";
import { seal } from "@/lib/crypto";
import {
  claimReferralReward,
  isDatabaseConfigured,
  type ReferralRewardType,
  upsertDatabaseUser,
} from "@/lib/database";
import type { UserToken } from "@/lib/tokens";

// 이메일 간편가입 — 비밀번호 없이 서명 토큰 발급.
// 같은 이메일로 다시 가입하면 같은 계정 취급(토큰 재발급). 위조는 서버 키 없이는 불가.
// 가입 정보는 서버 전용 Supabase 클라이언트로 저장한다.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    birthdate?: string;
    marketingOk?: boolean;
    referralCode?: string;
    referralReadingId?: string;
    referralReward?: ReferralRewardType;
  };
  const email = body.email?.trim().toLowerCase() ?? "";
  const birthdate = body.birthdate?.trim() ?? "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "올바른 이메일을 입력해주세요." }, { status: 400 });
  }
  if (!DATE_RE.test(birthdate)) {
    return NextResponse.json({ error: "생년월일을 입력해주세요." }, { status: 400 });
  }

  const [year, month, day] = birthdate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getTime() > Date.now()
  ) {
    return NextResponse.json({ error: "올바른 생년월일을 입력해주세요." }, { status: 400 });
  }

  // 청소년 차단 — 연 나이 기준 (만 19세가 되는 해의 1월 1일부터 성인, 청소년보호법 정의)
  const birthYear = parseInt(birthdate.slice(0, 4), 10);
  const age = new Date().getFullYear() - birthYear;
  if (isNaN(birthYear) || birthYear < 1900 || age < 19) {
    return NextResponse.json(
      { error: "러브레빗은 만 19세 이상 성인 전용 서비스입니다." },
      { status: 403 }
    );
  }

  const now = new Date().toISOString();
  let userId: number | undefined;
  let referralCode: string | undefined;
  let chatCredits = 0;
  let referralClaimed = false;
  try {
    const user = await upsertDatabaseUser({
      email,
      birthdate,
      marketingConsent: body.marketingOk === true,
      adultVerifiedAt: now,
    });
    userId = user?.id;
    referralCode = user?.referralCode;
    chatCredits = user?.chatCredits ?? 0;
    if (userId) {
      const claimed = await claimReferralReward({
        referredUserId: userId,
        referralCode: body.referralCode,
        rewardType: body.referralReward,
        rewardReadingId: body.referralReadingId,
      });
      referralClaimed = claimed.granted;
    }
  } catch (error) {
    console.error("가입 정보 저장 실패:", error);
    return NextResponse.json({ error: "가입 정보를 저장하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }
  if (process.env.NODE_ENV === "production" && (!isDatabaseConfigured() || !userId)) {
    return NextResponse.json({ error: "회원 DB 연결을 준비 중입니다. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  console.log(`[가입] userId=${userId ?? "local"} marketing=${body.marketingOk === true} at=${now}`);

  const token = seal({ type: "user", email, birthdate, iat: Date.now(), userId } satisfies UserToken);
  return NextResponse.json({
    token,
    email,
    referralCode,
    chatCredits,
    referralClaimed,
  });
}
