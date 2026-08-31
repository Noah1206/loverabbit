import { NextRequest, NextResponse } from "next/server";

import {
  applyCredit,
  getCreditBalance,
  hasLedgerRef,
  InsufficientCreditsError,
} from "@/lib/credits-db";
import { claimReading, getReading } from "@/lib/store";
import { resolveUserToken } from "@/lib/tokens";
import {
  buildWebtoonContent,
  isFortuneType,
  nicknameFromEmail,
  webtoonUnlockRef,
  WEBTOON_FORTUNE_CONFIG,
} from "@/lib/webtoon-saju";

// 웹툰 사주 운세 하나 해금 — 서버 원장에서만 차감한다.
//
//   1. 회원·소유권 확인 (없는 것과 남의 것은 같은 404)
//   2. fortuneType·비용 검증 — 비용은 서버 설정이 정본, expectedCost 는 대조용
//   3. 이미 해금이면 재차감 없이 현재 상태 반환
//   4. 원장 차감 — (reason, ref) unique 라 동시 요청·재시도에도 한 번만 빠진다.
//      Idempotency-Key 헤더는 받아서 로그에 남긴다. 실제 멱등성은 원장 ref 가 진다 —
//      클라이언트가 키를 바꿔 보내도 같은 운세는 두 번 차감되지 않는다.
//   5. 모자라면 402 INSUFFICIENT_LUVIT — 클라이언트는 충전 페이지로 보낸다

interface Body {
  userToken?: string;
  fortuneType?: string;
  expectedCost?: number;
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ readingId: string }> }) {
  const { readingId } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as Body;
  const idempotencyKey = request.headers.get("Idempotency-Key");
  const noStore = { "Cache-Control": "private, no-store, max-age=0" };

  if (!isFortuneType(body.fortuneType)) {
    return NextResponse.json({ error: "지원하지 않는 운세예요." }, { status: 400 });
  }
  const fortuneType = body.fortuneType;
  const cost = WEBTOON_FORTUNE_CONFIG[fortuneType].unlockCost;
  if (typeof body.expectedCost === "number" && body.expectedCost !== cost) {
    // 화면이 본 가격과 서버 가격이 다르다 — 갱신하고 다시 확인하게 한다.
    return NextResponse.json({ error: "가격이 바뀌었어요. 새로고침 후 다시 시도해 주세요.", cost }, { status: 409 });
  }

  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch (error) {
    console.error("웹툰 해금 회원 확인 실패:", error);
    return NextResponse.json({ error: "회원 정보를 확인하지 못했어요." }, { status: 503 });
  }
  if (!user?.userId) {
    return NextResponse.json({ error: "로그인하면 해금할 수 있어요." }, { status: 401 });
  }

  const reading = await getReading(readingId.trim());
  if (!reading || (reading.userId != null && reading.userId !== user.userId)) {
    return NextResponse.json({ error: "리딩을 찾을 수 없어요." }, { status: 404, headers: noStore });
  }
  if (reading.userId == null) {
    await claimReading(reading.id, user.userId).catch(() => {});
  }

  const ref = webtoonUnlockRef(reading.id, fortuneType);
  const already = await hasLedgerRef(user.userId, "reading", ref);

  let newBalance: number;
  if (already) {
    // 이미 해금 — 재차감 없이 현재 잔액만
    newBalance = await getCreditBalance(user.userId);
  } else {
    try {
      newBalance = await applyCredit(user.userId, -cost, "reading", ref);
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        return NextResponse.json(
          { error: "INSUFFICIENT_LUVIT", cost, balance: await getCreditBalance(user.userId).catch(() => 0) },
          { status: 402, headers: noStore }
        );
      }
      // (reason, ref) unique 충돌 = 동시 요청이 먼저 해금함 — 성공으로 취급
      if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
        newBalance = await getCreditBalance(user.userId);
      } else {
        console.error("웹툰 해금 차감 실패:", error);
        return NextResponse.json({ error: "해금하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
      }
    }
    console.log(
      `웹툰 해금: user=${user.userId} ref=${ref} cost=${cost} idempotencyKey=${idempotencyKey ?? "-"}`
    );
  }

  const nickname = nicknameFromEmail(user.email);
  const content = buildWebtoonContent(fortuneType, nickname);

  return NextResponse.json(
    {
      unlocked: true,
      alreadyUnlocked: already,
      newBalance,
      transactionId: ref,
      panels: content.panels,
      fullText: content.fullParagraphs,
    },
    { headers: noStore }
  );
}
