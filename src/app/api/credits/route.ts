import { NextRequest, NextResponse } from "next/server";

import { countOpenedReadings, getCreditBalance, hasPurchasedCredits, listCreditLedger } from "@/lib/credits-db";
import { CREDIT_PACKS, FIRST_BUY_PACKS, QUESTION_COST, readingPriceForCount } from "@/lib/credits";
import { resolveUserToken } from "@/lib/tokens";

// 크레딧 잔액과 내역. 화면(/credits, /ask, /profile)이 본다.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { userToken?: string };
  try {
    const user = await resolveUserToken(body.userToken);
    if (!user?.userId) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    const [balance, ledger, bought, opened] = await Promise.all([
      getCreditBalance(user.userId),
      listCreditLedger(user.userId),
      hasPurchasedCredits(user.userId),
      countOpenedReadings(user.userId),
    ]);
    // 산 적 없으면 할인 팩을 보여준다. 자격 판단은 서버가 한 것이고, 결제
    // 라우트가 같은 기준으로 한 번 더 막는다 — 화면만 믿지 않는다.
    const firstBuy = !bought;
    return NextResponse.json(
      {
        balance,
        ledger,
        cost: QUESTION_COST,
        // 이 사람이 다음 사주 한 장에 낼 값 (2·4·10러빗). 화면이 이걸 적어야
        // 결제창에서 다른 숫자를 보지 않는다 — 깎는 값의 정본은 unlock 라우트다.
        readingCost: readingPriceForCount(opened),
        openedReadings: opened,
        firstBuy,
        packs: firstBuy ? FIRST_BUY_PACKS : CREDIT_PACKS,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("러빗 조회 실패:", error);
    return NextResponse.json({ error: "러빗을 불러오지 못했어요." }, { status: 503 });
  }
}
