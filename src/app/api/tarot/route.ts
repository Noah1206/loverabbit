import { NextRequest, NextResponse } from "next/server";

import { chatComplete } from "@/lib/ai";
import { TAROT_COST } from "@/lib/credits";
import {
  InsufficientCreditsError,
  applyCredit,
  getCreditBalance,
} from "@/lib/credits-db";
import { getUserSajuProfile, isDatabaseConfigured } from "@/lib/database";
import { checkTarot, type TarotReport } from "@/lib/tarot-guard";
import {
  TAROT_SYSTEM_PROMPT,
  buildTarotFacts,
  drawFor,
  isTopic,
} from "@/lib/tarot-reading";
import { resolveUserToken } from "@/lib/tokens";

export const maxDuration = 60;

/*
  타로 한 번 뽑기.

  순서가 중요하다. **뽑기 → 생성 → 검사 → 과금** 이다.

  과금을 맨 뒤에 두는 이유: 생성이나 검사가 실패했는데 러빗이 빠지면 그건
  받지 않은 것에 값을 받은 것이다. 반대로 과금을 먼저 하고 되돌리는 방식은
  되돌림이 실패할 자리를 하나 더 만든다 — 채팅 라우트가 그 길을 쓰는데,
  거기는 스트리밍이라 어쩔 수 없었다. 여기는 한 번에 끝나므로 뒤에 둔다.

  카드는 서버가 뽑는다. 화면이 뽑으면 새로고침으로 원하는 카드가 나올 때까지
  다시 뽑을 수 있고, 그건 타로가 아니라 뽑기다.
*/

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    userToken?: string;
    topic?: string;
  };

  if (!isTopic(body.topic)) {
    return NextResponse.json({ error: "무엇을 물을지 골라 주세요." }, { status: 400 });
  }

  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch (error) {
    console.error("타로 회원 확인 실패:", error);
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
  if (!user?.userId) {
    return NextResponse.json({ error: "로그인하면 타로를 볼 수 있어요." }, { status: 401 });
  }

  const noStore = { "Cache-Control": "private, no-store, max-age=0" };

  // 잔액을 먼저 본다 — 생성에 돈을 쓰고 나서 모자란 걸 알면 그 비용이 버려진다
  let balance: number;
  try {
    balance = await getCreditBalance(user.userId);
  } catch (error) {
    console.error("타로 잔액 조회 실패:", error);
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 503, headers: noStore });
  }
  if (balance < TAROT_COST) {
    return NextResponse.json(
      { error: "러빗이 모자라요.", needsCredits: true, cost: TAROT_COST, balance },
      { status: 402, headers: noStore }
    );
  }

  // 명식이 있어야 "그 사람의 결" 을 겹칠 수 있다. 없으면 카드만 남는데,
  // 그건 이 상품이 팔기로 한 것과 다르다 — 둘러대지 않고 그대로 말한다.
  let profile;
  try {
    profile = await getUserSajuProfile(user.userId);
  } catch (error) {
    console.error("타로 프로필 조회 실패:", error);
    return NextResponse.json({ error: "사주 정보를 못 불러왔어요." }, { status: 503, headers: noStore });
  }
  if (!profile?.birthdate) {
    return NextResponse.json(
      { needsProfile: true, error: "사주 정보를 입력하면 카드를 당신 결에 겹쳐 읽어요." },
      { status: 200, headers: noStore }
    );
  }

  // ── 1. 뽑기 ──
  const draw = drawFor(body.topic);
  const { packet } = buildTarotFacts({
    draw,
    birthdate: profile.birthdate,
    birthHour: profile.birthHour,
    gender: profile.gender === "M" ? "M" : "F",
  });

  // ── 2. 생성 ──
  let report: TarotReport | null = null;
  try {
    const result = await chatComplete(
      TAROT_SYSTEM_PROMPT,
      [{ role: "user", content: JSON.stringify(packet) }],
      2000,
      { json: true }
    );
    report = result ? parseReport(result.text) : null;
  } catch (error) {
    console.error("타로 생성 실패:", error);
  }
  if (!report) {
    return NextResponse.json(
      { error: "카드를 읽지 못했어요. 잠시 후 다시 해주세요." },
      { status: 503, headers: noStore }
    );
  }

  // ── 3. 검사 ──
  const guard = checkTarot(report, draw);
  if (!guard.ok) {
    // 한 번만 다시 시킨다. 두 번째도 걸리면 내보내지 않는다 — 걸린 채로
    // 나가는 것보다 안 나가는 편이 낫다.
    console.warn("타로 가드 위반:", guard.violations.map((v) => v.detail));
    try {
      const retry = await chatComplete(
        TAROT_SYSTEM_PROMPT,
        [
          { role: "user", content: JSON.stringify(packet) },
          {
            role: "user",
            content: `직전 답이 아래에 걸렸어. 같은 카드로 다시 써 줘.\n${guard.violations
              .map((v) => `- ${v.detail}`)
              .join("\n")}`,
          },
        ],
        2000,
        { json: true }
      );
      const second = retry ? parseReport(retry.text) : null;
      if (second && checkTarot(second, draw).ok) {
        report = second;
      } else {
        return NextResponse.json(
          { error: "카드를 읽지 못했어요. 잠시 후 다시 해주세요." },
          { status: 503, headers: noStore }
        );
      }
    } catch (error) {
      console.error("타로 재생성 실패:", error);
      return NextResponse.json(
        { error: "카드를 읽지 못했어요. 잠시 후 다시 해주세요." },
        { status: 503, headers: noStore }
      );
    }
  }

  // ── 4. 과금 ──
  //
  // 여기까지 왔으면 사람이 받을 것이 손에 있다. ref 에 뽑은 시각을 넣어
  // (reason, ref) unique 가 같은 뽑기의 이중 청구를 막게 한다.
  try {
    await applyCredit(user.userId, -TAROT_COST, "tarot", `${user.userId}:${draw.drawnAt}`);
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: "러빗이 모자라요.", needsCredits: true },
        { status: 402, headers: noStore }
      );
    }
    console.error("타로 과금 실패:", error);
    // 과금이 실패해도 결과는 준다. 받을 것을 만들어 두고 돈을 못 받은 것은
    // 우리 쪽 손해지만, 만들어 놓고 안 주는 것은 사용자 쪽 손해다.
  }

  return NextResponse.json({ draw, report, cost: TAROT_COST }, { headers: noStore });
}

/** 모델 답에서 JSON 을 꺼낸다 — 코드펜스로 감싸 오는 경우가 있다 */
function parseReport(raw: string): TarotReport | null {
  const tryParse = (t: string): TarotReport | null => {
    try {
      const v = JSON.parse(t) as TarotReport;
      return Array.isArray(v?.cards) && typeof v?.closing === "string" ? v : null;
    } catch {
      return null;
    }
  };
  const direct = tryParse(raw.trim());
  if (direct) return direct;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    const inner = tryParse(fenced[1].trim());
    if (inner) return inner;
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return tryParse(raw.slice(start, end + 1));
  return null;
}
