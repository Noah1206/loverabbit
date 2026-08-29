import { NextRequest, NextResponse } from "next/server";

import { getCreditBalance, listCreditLedger } from "@/lib/credits-db";
import { CREDIT_PACKS, QUESTION_COST } from "@/lib/credits";
import { resolveUserToken } from "@/lib/tokens";

// 크레딧 잔액과 내역. 화면(/credits, /ask, /profile)이 본다.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { userToken?: string };
  try {
    const user = await resolveUserToken(body.userToken);
    if (!user?.userId) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    const [balance, ledger] = await Promise.all([
      getCreditBalance(user.userId),
      listCreditLedger(user.userId),
    ]);
    return NextResponse.json(
      { balance, ledger, cost: QUESTION_COST, packs: CREDIT_PACKS },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("크레딧 조회 실패:", error);
    return NextResponse.json({ error: "크레딧을 불러오지 못했어요." }, { status: 503 });
  }
}
