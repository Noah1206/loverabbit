import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { rewardReferralClick } from "@/lib/credits-db";
import { isDatabaseConfigured } from "@/lib/database";

// 초대 링크 클릭 기록. 크레딧 보상은 없앴다 (2026-08-30) — RPC 가 기록만 남기고
// 항상 false 를 돌려준다. 라우트는 그대로 두어 링크 추적은 유지한다.
//
// 크레딧을 안 주므로 어뷰징 유인이 없어졌다. 기기 쿠키(httpOnly)로 같은 기기의
// 중복 기록만 막는다. 가입 보상(5,000원 쿠폰)은 회원 행 기준이라 별개로 살아 있다.

const COOKIE = "lr_device";
const CODE_RE = /^[A-Z0-9]{6,16}$/;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { ref?: string };
  const code = (body.ref ?? "").trim().toUpperCase();
  if (!CODE_RE.test(code)) return NextResponse.json({ rewarded: false });
  if (!isDatabaseConfigured()) return NextResponse.json({ rewarded: false });

  let deviceKey = req.cookies.get(COOKIE)?.value ?? "";
  const fresh = !/^[a-f0-9]{32}$/.test(deviceKey);
  if (fresh) deviceKey = randomBytes(16).toString("hex");

  let rewarded = false;
  try {
    rewarded = await rewardReferralClick(code, deviceKey);
  } catch (error) {
    console.error("초대 클릭 보상 실패:", error);
  }

  const res = NextResponse.json({ rewarded });
  if (fresh) {
    res.cookies.set(COOKIE, deviceKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}
