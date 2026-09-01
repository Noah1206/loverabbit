import { NextRequest, NextResponse } from "next/server";

import { deleteAccount } from "@/lib/credits-db";
import { resolveUserToken } from "@/lib/tokens";

/*
  회원 탈퇴 — 본인이 직접 누른다.

  개인정보 파기 요청을 사람이 받아 처리하던 것을(문의 → 10일) 버튼 하나로
  줄인다. 파기는 권리라 기다리게 할 이유가 없다.

  **무엇을 지우고 무엇을 남기는지는 DB 함수(lr_delete_account)가 정한다.**
  거래 기록은 전자상거래법이 5년을 요구하므로 행을 지우지 않고 개인정보만
  지운다 — 그 판단을 여기 옮겨 적으면 규칙이 두 벌이 된다.

  되돌릴 수 없다. 그래서 화면이 한 번 더 묻고(confirm), 여기서는 토큰으로
  본인임을 확인한 사람의 것만 지운다 — 남의 계정을 지울 길이 없어야 한다.
*/

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { userToken?: string };

  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch (error) {
    console.error("탈퇴 회원 확인 실패:", error);
    return NextResponse.json({ error: "회원 정보를 확인하지 못했어요." }, { status: 503 });
  }
  if (!user?.userId) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    const result = await deleteAccount(user.userId);
    // 누가 언제 나갔는지는 남긴다 — 개인정보가 아니라 처리 사실의 기록이다.
    console.log(`[탈퇴] userId=${user.userId} ${JSON.stringify(result)}`);
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("탈퇴 처리 실패:", error);
    return NextResponse.json(
      { error: "탈퇴를 처리하지 못했어요. 잠시 후 다시 시도하거나 문의해 주세요." },
      { status: 503 }
    );
  }
}
