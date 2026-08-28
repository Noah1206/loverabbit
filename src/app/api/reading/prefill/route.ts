import { NextRequest, NextResponse } from "next/server";

import { getUserSajuProfile } from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";

/*
  두 번째 리딩의 폼을 한 칸으로 줄인다.

  첫 리딩 때 저장한 내 생년월일·시·성별(saveUserSajuProfile)을 돌려준다. 리딩
  끝의 "다음 질문"에서 온 사람은 내 정보를 다시 치지 않고 상대 생년월일만
  넣는다. 본인 것만 돌려준다 — 토큰의 주인 것.
*/
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { userToken?: string };
  try {
    const user = await resolveUserToken(body.userToken);
    if (!user?.userId) return NextResponse.json({ me: null });
    const profile = await getUserSajuProfile(user.userId);
    if (!profile) return NextResponse.json({ me: null });
    const [year, month, day] = profile.birthdate.split("-");
    return NextResponse.json({
      me: {
        year: String(Number(year)),
        month: String(Number(month)),
        day: String(Number(day)),
        hour: profile.birthTimeUnknown || profile.birthHour === null ? "unknown" : String(profile.birthHour),
        gender: profile.gender ?? "",
        calendar: "solar",
        leapMonth: false,
      },
    });
  } catch (error) {
    console.error("사주 기본 정보 미리채움 실패:", error);
    return NextResponse.json({ me: null });
  }
}
