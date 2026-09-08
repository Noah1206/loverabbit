import { NextRequest, NextResponse } from "next/server";

import { isDatabaseConfigured, getUserSajuProfile } from "@/lib/database";
import { buildAllDomains } from "@/lib/period-fortune";
import { resolveUserToken } from "@/lib/tokens";

/*
  이번 주 / 이번 달의 결.

  오늘의 액션(api/daily-action)과 같은 자리에서, 같은 프로필을 보고, 같은
  흐름 축으로 답한다. 다른 것은 재는 단위뿐이다 — 그래서 이 라우트는 표를
  꺼내 오기만 하고 아무것도 저장하지 않는다. 완료 기록도, 크레딧도 없다.

  값이 들지 않는 이유: 표를 읽는 일이라 모델을 부르지 않는다
  (period-fortune.ts 첫머리). 무료로 반복해서 볼 수 있는 것이 이 서비스에
  거의 없었고, 그 구멍을 메우려고 만든 화면이라 여기서 과금하면 뜻이 없다.
*/

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    userToken?: string;
    period?: string;
  };

  const period = body.period === "month" ? "month" : "week";

  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch (error) {
    console.error("기간 운세 회원 확인 실패:", error);
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
  if (!user?.userId) {
    return NextResponse.json(
      { error: "로그인하면 이번 주·이번 달 운세를 볼 수 있어요." },
      { status: 401 }
    );
  }

  const noStore = { "Cache-Control": "private, no-store, max-age=0" };

  let profile;
  try {
    profile = await getUserSajuProfile(user.userId);
  } catch (error) {
    console.error("기간 운세 프로필 조회 실패:", error);
    return NextResponse.json(
      { error: "사주 정보를 못 불러왔어요. 다시 해주세요." },
      { status: 503, headers: noStore }
    );
  }

  // 생년월일이 없으면 흐름을 잴 수 없다. 일반 운세로 둘러대지 않고 무엇이
  // 없는지 그대로 말한다 — daily-action 라우트와 같은 규칙이다.
  if (!profile?.birthdate) {
    return NextResponse.json(
      { needsProfile: true, error: "사주 정보를 입력하면 이번 주 운세를 만들 수 있어요." },
      { status: 200, headers: noStore }
    );
  }

  const [y, m, d] = profile.birthdate.split("-").map(Number);
  const list = buildAllDomains({
    year: y,
    month: m,
    day: d,
    hour: profile.birthHour,
    period,
  });

  return NextResponse.json(
    { period, items: list },
    { headers: noStore }
  );
}
