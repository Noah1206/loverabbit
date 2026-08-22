import { NextRequest, NextResponse } from "next/server";

import { saveUserSajuProfile } from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";

// 신당 대화 중에 받은 생년월일을 저장한다.
//
// 지금까지 사주 기본 정보는 리딩을 만들 때만 저장됐다. 그래서 대화만 하는
// 손님은 영영 사주가 없었고, 도령은 "네 사주를 봐야 안다" 고 말하면서도 물어볼
// 수도 받을 수도 없었다. 여기가 그 받는 자리다.
//
// 한 번 저장되면 다음 턴부터 도령이 실제 간지를 손에 쥐고 말한다. 리딩을 살 때도
// 같은 값을 다시 묻지 않는다 - 저장 위치가 같기 때문이다.

interface Body {
  userToken?: string;
  birthdate?: string;
  birthHour?: number | null;
  birthTimeUnknown?: boolean;
  gender?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });

  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch (error) {
    console.error("신당 사주 저장 회원 확인 실패:", error);
    return NextResponse.json({ error: "회원 정보를 확인하지 못했어요." }, { status: 503 });
  }
  if (!user?.userId) {
    return NextResponse.json({ error: "로그인 후 이용할 수 있어요.", needSignup: true }, { status: 401 });
  }

  // 생년월일은 사주의 뼈대다. 형식이 어긋나면 엉뚱한 간지가 나오므로 여기서 막는다.
  const birthdate = String(body.birthdate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
    return NextResponse.json({ error: "생년월일을 YYYY-MM-DD 로 알려주세요." }, { status: 400 });
  }
  const year = Number(birthdate.slice(0, 4));
  if (year < 1900 || year > new Date().getFullYear()) {
    return NextResponse.json({ error: "생년월일을 다시 확인해주세요." }, { status: 400 });
  }

  const timeUnknown = Boolean(body.birthTimeUnknown);
  const rawHour = body.birthHour;
  const birthHour =
    timeUnknown || rawHour === null || rawHour === undefined ? null : Number(rawHour);
  if (birthHour !== null && (!Number.isInteger(birthHour) || birthHour < 0 || birthHour > 23)) {
    return NextResponse.json({ error: "태어난 시각은 0~23 사이여야 해요." }, { status: 400 });
  }

  const gender = body.gender === "F" || body.gender === "M" ? body.gender : null;
  if (!gender) {
    return NextResponse.json({ error: "성별을 알려주세요." }, { status: 400 });
  }

  try {
    await saveUserSajuProfile(user.userId, {
      birthdate,
      birthHour,
      birthTimeUnknown: timeUnknown,
      gender,
    });
  } catch (error) {
    console.error("신당 사주 저장 실패:", error);
    return NextResponse.json({ error: "사주를 저장하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
