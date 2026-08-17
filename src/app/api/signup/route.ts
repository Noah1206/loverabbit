import { NextRequest, NextResponse } from "next/server";
import { seal } from "@/lib/crypto";

// 이메일 간편가입 — 비밀번호 없이 서명 토큰 발급.
// 같은 이메일로 다시 가입하면 같은 계정 취급(토큰 재발급). 위조는 서버 키 없이는 불가.
// 가입 로그는 Vercel Logs에서 확인 (마케팅 수신 동의 포함) — 추후 DB 도입 시 이 라우트만 교체.

export interface UserToken {
  type: "user";
  email: string;
  birthdate: string;
  iat: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    birthdate?: string;
    marketingOk?: boolean;
  };
  const email = body.email?.trim().toLowerCase() ?? "";
  const birthdate = body.birthdate?.trim() ?? "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "올바른 이메일을 입력해주세요." }, { status: 400 });
  }
  if (!DATE_RE.test(birthdate)) {
    return NextResponse.json({ error: "생년월일을 입력해주세요." }, { status: 400 });
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

  console.log(
    `[가입] email=${email} birth=${birthdate} marketing=${body.marketingOk === true} at=${new Date().toISOString()}`
  );

  const token = seal({ type: "user", email, birthdate, iat: Date.now() } satisfies UserToken);
  return NextResponse.json({ token, email });
}
