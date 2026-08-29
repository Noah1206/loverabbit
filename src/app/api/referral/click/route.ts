import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { rewardReferralClick } from "@/lib/credits-db";
import { isDatabaseConfigured } from "@/lib/database";

// 초대 링크 클릭 → 초대인에게 5크레딧.
//
// "클릭만 해도" 는 어뷰징이 쉬운 보상이라 상한을 둘로 둔다. 기기 하나는 초대인
// 하나에게 한 번만 (httpOnly 쿠키 = 기기), 초대인은 하루 5회까지 (DB 가 센다).
// 쿠키를 지우면 다시 받을 수 있다 — 그래서 하루 상한이 있다. 가입 보상(쿠폰)과는
// 별개고, 가입 보상은 기기가 아니라 회원 행 기준이라 이 구멍이 없다.
//
// 자기 링크를 자기가 여는 것도 여기서는 못 막는다. 하루 25크레딧(500원어치)이
// 상한이므로 감수한다.

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
