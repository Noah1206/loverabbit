import { NextRequest, NextResponse } from "next/server";

import {
  completeDailyAction,
  getUserSajuProfile,
  listRecentDailyActions,
  type DailyActionRecord,
} from "@/lib/database";
import {
  DOMAINS,
  buildAllDomains,
  buildDailyAction,
  seoulToday,
  type FortuneDomain,
} from "@/lib/daily-action";
import { adminKeyFromAuthorization, verifyAdminApprovalKey } from "@/lib/admin-auth";
import { resolveUserToken } from "@/lib/tokens";

// 오늘의 사주 액션.
//
// GET 에 해당하는 조회도 POST 로 받는다 — 이 앱의 회원 확인은 본문의
// userToken 으로 하고, 다른 라우트(my-readings, profile)가 전부 그 모양이다.
// 여기만 쿼리스트링으로 토큰을 받으면 토큰이 서버 접근 로그와 리퍼러에 남는다.
//
// 행동 문구는 서버에서 만든다. 계산에 쓰는 생년월일시가 클라이언트로 나가지
// 않게 하려는 것이다 — 화면에는 완성된 문장과 근거 한 줄만 내려간다.

/** 최근 며칠을 "이미 나간 영역"으로 볼 것인가 (지시문 5절: 이전 3일) */
const RECENT_DAYS = 3;

interface Body {
  userToken?: string;
  /** "complete" 면 완료 저장, 없으면 조회 */
  intent?: "complete";
  /** 완료 저장할 영역. 화면이 지금 보고 있는 것을 그대로 돌려준다. */
  domain?: string;
  note?: string;
}

function isDomain(value: unknown): value is FortuneDomain {
  return typeof value === "string" && (DOMAINS as string[]).includes(value);
}

/** 오늘에서 n일 전의 ISO 날짜 */
function daysBefore(todayISO: string, n: number): string {
  const [y, m, d] = todayISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  // 아직 검수 중인 기능이라 관리자에게만 연다 (2026-09-01).
  //
  // 관문은 여기 하나다. 화면에서만 가리면 라우트를 직접 부르는 길이 남고,
  // 그 길에는 검사가 없다. 검수가 끝나면 이 블록만 지우면 된다 —
  // 아래 로직은 손댈 것이 없다.
  if (!verifyAdminApprovalKey(adminKeyFromAuthorization(request.headers.get("authorization")))) {
    return NextResponse.json({ error: "준비 중인 기능이에요." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;

  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch (error) {
    console.error("오늘의 액션 회원 확인 실패:", error);
    return NextResponse.json({ error: "회원 정보를 확인하지 못했어요." }, { status: 503 });
  }
  if (!user?.userId) {
    return NextResponse.json(
      { error: "로그인하면 오늘의 사주 액션을 볼 수 있어요." },
      { status: 401 }
    );
  }

  const noStore = { "Cache-Control": "private, no-store, max-age=0" };
  const today = seoulToday();

  let profile;
  try {
    profile = await getUserSajuProfile(user.userId);
  } catch (error) {
    console.error("오늘의 액션 프로필 조회 실패:", error);
    return NextResponse.json({ error: "사주 정보를 불러오지 못했어요." }, { status: 503, headers: noStore });
  }

  // 생년월일이 없으면 일진과의 관계를 잴 수 없다. 일반 운세로 둘러대지 않고
  // 무엇이 없는지 그대로 말한다 (지시문 11절).
  if (!profile?.birthdate) {
    return NextResponse.json(
      { needsProfile: true, error: "사주 정보를 입력하면 오늘의 액션을 만들 수 있어요." },
      { status: 200, headers: noStore }
    );
  }

  // ── 완료 저장 ────────────────────────────────────────────
  if (body.intent === "complete") {
    if (!isDomain(body.domain)) {
      return NextResponse.json({ error: "영역이 올바르지 않아요." }, { status: 400, headers: noStore });
    }
    // 행동 id 는 서버가 다시 만든다. 클라이언트가 준 것을 그대로 쓰면 아무
    // 문자열이나 기록에 들어간다.
    const { action } = buildDailyAction({
      birthdate: profile.birthdate,
      birthHour: profile.birthHour,
      today,
      domain: body.domain,
    });
    try {
      await completeDailyAction(user.userId, {
        date: today,
        domain: body.domain,
        actionId: action.id,
        note: typeof body.note === "string" ? body.note.slice(0, 500) : undefined,
      });
    } catch (error) {
      console.error("오늘의 액션 완료 저장 실패:", error);
      return NextResponse.json(
        { error: "완료를 저장하지 못했어요. 잠시 후 다시 눌러주세요." },
        { status: 503, headers: noStore }
      );
    }
    return NextResponse.json({ ok: true, completedDomain: body.domain }, { headers: noStore });
  }

  // ── 조회 ────────────────────────────────────────────────
  let history: DailyActionRecord[];
  try {
    history = await listRecentDailyActions(user.userId, daysBefore(today, RECENT_DAYS));
  } catch (error) {
    // 이력이 없어도 액션은 만들 수 있다. 중복 회피만 못 하게 될 뿐이라
    // 화면을 막지 않는다.
    console.error("오늘의 액션 이력 조회 실패:", error);
    history = [];
  }

  const completedToday = history.filter((row) => row.date === today).map((row) => row.domain);
  // 오늘 것은 중복 회피에 넣지 않는다 — 넣으면 완료한 순간 다른 영역으로
  // 갈아치워져, 방금 완료한 화면이 사라진다.
  const recentDomains = history
    .filter((row) => row.date !== today)
    .map((row) => row.domain)
    .filter(isDomain);

  const { action, flow } = buildDailyAction({
    birthdate: profile.birthdate,
    birthHour: profile.birthHour,
    today,
    recentDomains,
  });

  const yesterday = daysBefore(today, 1);
  const yesterdayDomain = history.find((row) => row.date === yesterday)?.domain;

  return NextResponse.json(
    {
      today,
      action,
      // 다른 운세 보기 — 오늘의 같은 흐름을 나머지 영역에 대입한 것이다.
      others: buildAllDomains({
        birthdate: profile.birthdate,
        birthHour: profile.birthHour,
        today,
      }).filter((row) => row.domain !== action.domain),
      completedToday,
      // "어제는 학업 액션을 완료했어요" 한 줄에 쓴다.
      yesterdayDomain: isDomain(yesterdayDomain) ? yesterdayDomain : null,
      birthTimeUnknown: profile.birthTimeUnknown,
      flow: { dayGanji: flow.dayGanji, dayMaster: flow.dayMaster, tenGod: flow.tenGod },
    },
    { headers: noStore }
  );
}
