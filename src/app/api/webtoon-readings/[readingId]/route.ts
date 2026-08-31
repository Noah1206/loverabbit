import { NextRequest, NextResponse } from "next/server";

import { getCreditBalance, hasLedgerRef } from "@/lib/credits-db";
import { claimReading, getReading } from "@/lib/store";
import { resolveUserToken } from "@/lib/tokens";
import {
  isFortuneType,
  nicknameFromEmail,
  panelsForState,
  webtoonUnlockRef,
  WEBTOON_FORTUNE_CONFIG,
} from "@/lib/webtoon-saju";
import { webtoonContentFor } from "@/lib/webtoon-generate";

// 웹툰 사주 상태 조회 — 운세 하나의 패널·텍스트·해금 상태·잔액을 돌려준다.
//
// 해금 상태의 정본은 크레딧 원장이다: (reason='reading', ref='webtoon:{id}:{fortune}')
// 기록이 있으면 해금. 별도 테이블이 없고, unique 인덱스가 이중 차감을 막는다.
//
// 유료 문장(전체 패널 오버레이·상세 분석)은 unlocked 일 때만 응답에 실린다 —
// 내려주는 길이 둘이면 그중 하나는 검증을 건너뛴다 (/api/my-readings 와 같은 원칙).

// 문장을 처음 만드는 호출에 AI 한 번이 든다. 캐시가 차면 그 뒤로는 DB 조회뿐이다.
export const maxDuration = 120;

interface Body {
  userToken?: string;
  fortuneType?: string;
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ readingId: string }> }) {
  const { readingId } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as Body;
  const noStore = { "Cache-Control": "private, no-store, max-age=0" };

  if (!isFortuneType(body.fortuneType)) {
    return NextResponse.json({ error: "지원하지 않는 운세예요." }, { status: 400 });
  }
  const fortuneType = body.fortuneType;

  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch (error) {
    console.error("웹툰 사주 회원 확인 실패:", error);
    return NextResponse.json({ error: "회원 정보를 확인하지 못했어요." }, { status: 503 });
  }
  if (!user?.userId) {
    return NextResponse.json({ error: "로그인하면 웹툰 사주를 볼 수 있어요." }, { status: 401 });
  }

  const reading = await getReading(readingId.trim());
  // 없는 것과 남의 것을 같은 404 로 — id 로 존재 여부를 캐게 두지 않는다.
  if (!reading || (reading.userId != null && reading.userId !== user.userId)) {
    return NextResponse.json({ error: "리딩을 찾을 수 없어요." }, { status: 404, headers: noStore });
  }
  // 아직 계정에 안 묶인 리딩이면 지금 묶는다 (기존 해금 흐름과 같은 규칙)
  if (reading.userId == null) {
    await claimReading(reading.id, user.userId).catch(() => {});
  }

  const ref = webtoonUnlockRef(reading.id, fortuneType);
  const [unlocked, balance] = await Promise.all([
    hasLedgerRef(user.userId, "reading", ref),
    getCreditBalance(user.userId),
  ]);

  const nickname = nicknameFromEmail(user.email);
  // 명식으로 쓴 문장. 프로필이 없거나 가드에 걸리면 고정 카피가 온다.
  const { content } = await webtoonContentFor(reading.id, user.userId, fortuneType, nickname);
  const config = WEBTOON_FORTUNE_CONFIG[fortuneType];

  return NextResponse.json(
    {
      readingId: reading.id,
      fortuneType,
      subjectNickname: nickname,
      narrator: "loverabbit",
      unlocked,
      luvitCost: config.unlockCost,
      luvitBalance: balance,
      coverImageUrl: content.coverImageUrl,
      previewText: content.previewText,
      previewPoints: content.previewPoints,
      panels: panelsForState(content.panels, unlocked),
      fullText: unlocked ? content.fullParagraphs : undefined,
    },
    { headers: noStore }
  );
}
