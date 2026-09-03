import { NextRequest, NextResponse } from "next/server";

import {
  personalizeDailyAction,
  type PersonalizedText,
} from "@/lib/daily-action-ai";
import {
  DOMAINS,
  RELATION_FLOW,
  buildFlagAction,
  dailyFlowOf,
  seoulToday,
  type FortuneDomain,
} from "@/lib/daily-action";
import { getDailyActionText, getUserSajuProfile, saveDailyActionText } from "@/lib/database";
import { applyCredit, InsufficientCreditsError } from "@/lib/credits-db";
import { DAILY_ACTION_COST } from "@/lib/credits";
import { flipFlag, sajuProfileOf } from "@/lib/saju-profile";
import type { Ohaeng } from "@/lib/saju";
import { resolveUserToken } from "@/lib/tokens";

// 오늘의 액션 문구 개인화.
//
// 오방기를 뽑은 직후, 깃발이 펼쳐지는 2.6초 사이에 불린다. AI 가 내 명식
// 수치를 녹여 문구 넷(action/reason/avoid/토끼 말)을 다시 쓰고, 결과는
// (유저, 날짜, 흐름:영역)당 한 번만 생성해 캐시한다.
//
// 실패는 화면을 막지 않는다 — null 을 돌려주면 클라이언트는 표 문구를
// 그대로 쓴다. 표 문구가 사람이 승인한 바닥이라는 원칙은 그대로다.

const OHAENGS: Ohaeng[] = ["목", "화", "토", "금", "수"];

interface Body {
  userToken?: string;
  /** 뽑은 오방기 오행. 없으면 오늘의 일진 오행으로 계산한다. */
  ohaeng?: string;
  /** 화면이 보여줄 영역. 없으면 흐름이 고른 것. */
  domain?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const noStore = { "Cache-Control": "private, no-store, max-age=0" };

  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch {
    return NextResponse.json({ text: null }, { headers: noStore });
  }
  if (!user?.userId) return NextResponse.json({ text: null }, { status: 401, headers: noStore });

  let profile;
  try {
    profile = await getUserSajuProfile(user.userId);
  } catch {
    return NextResponse.json({ text: null }, { headers: noStore });
  }
  if (!profile?.birthdate) return NextResponse.json({ text: null }, { headers: noStore });

  const today = seoulToday();
  const flow = dailyFlowOf(profile.birthdate, profile.birthHour, today);

  const picked = OHAENGS.includes(body.ohaeng as Ohaeng) ? (body.ohaeng as Ohaeng) : null;
  const flagResult = flipFlag(flow.myElement, picked ?? flow.todayElement);
  const flowKind = RELATION_FLOW[flagResult.relation];
  const domain =
    typeof body.domain === "string" && (DOMAINS as string[]).includes(body.domain)
      ? (body.domain as FortuneDomain)
      : undefined;
  const base = buildFlagAction(flowKind, domain);

  const cacheKey = `${flowKind}:${base.domain}`;
  try {
    const cached = await getDailyActionText(user.userId, today, cacheKey);
    if (cached) return NextResponse.json({ text: cached }, { headers: noStore });
  } catch {
    /* 캐시가 죽어도 생성은 간다 */
  }

  // 새 조합 하나에 러빗 1개 (2026-09-04 운영자). 캐시에 있으면 위에서 이미
  // 나갔으니 무료 — 같은 조합을 다시 열어도 두 번 내지 않는다. 원장의
  // (reason, ref) unique 가 재시도 이중 청구를 막는다.
  const ledgerRef = `${user.userId}:${today}:${cacheKey}`;
  try {
    await applyCredit(user.userId, -DAILY_ACTION_COST, "daily_action", ledgerRef);
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json({ text: null, needCredits: true }, { headers: noStore });
    }
    console.error("오늘의 액션 러빗 차감 실패:", error);
    return NextResponse.json({ text: null }, { headers: noStore });
  }

  const text: PersonalizedText | null = await personalizeDailyAction({
    today,
    dayGanji: flow.dayGanji,
    dayMaster: flow.dayMaster,
    flow: flowKind,
    pickedOhaeng: picked,
    relationLabel: flagResult.premise,
    domain: base.domain,
    base: {
      action: base.action,
      reason: base.reason,
      avoidAction: base.avoidAction,
      rabbitLine: base.rabbit.line,
    },
    me: profile.gender ? sajuProfileOf(profile.birthdate, profile.birthHour, profile.gender) : null,
  });

  if (text) {
    try {
      await saveDailyActionText(user.userId, today, cacheKey, { ...text });
    } catch (error) {
      console.error("오늘의 액션 문구 캐시 저장 실패:", error);
    }
  } else {
    // 생성이 실패했으면 받은 것이 없다 — 차감을 되돌린다.
    try {
      await applyCredit(user.userId, DAILY_ACTION_COST, "refund", `${ledgerRef}:refund`);
    } catch (error) {
      console.error("오늘의 액션 러빗 환불 실패:", error);
    }
  }

  return NextResponse.json({ text }, { headers: noStore });
}
