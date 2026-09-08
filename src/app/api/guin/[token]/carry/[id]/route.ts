import { NextRequest, NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/database";
import { carryBirthForReading, isOwnerKey, loadGuinMap } from "@/lib/guin-db";

/*
  사주지도에서 유료 상세(속궁합)로 넘어갈 때, 두 사람의 생년월일을 폼에 실어 준다.

  왜 서버가 주나 — 참여자의 생년월일은 봉인 저장이라 화면에 온 적이 없다
  (지도 응답에도, 결과 카드에도 없다). 그 규칙은 그대로 둔다. 다만 지도 주인이
  "이 사람과의 상세 궁합" 을 사려고 할 때 생년월일을 다시 치게 하는 것은
  이미 가진 값을 버리는 일이다.

  그래서 딱 이 순간에만, **주인 키를 확인하고**, 그 한 사람의 값을 돌려준다.

  지키는 것:
    · ownerKey 가 맞아야 한다 — 남의 지도에서 남의 생일을 꺼낼 수 없다.
    · 한 사람만. 지도 전체를 훑는 길이 되지 않게 id 를 지목해야 한다.
    · 돌려주는 것은 생년월일과 시각뿐이다. 별명 말고는 아무것도 더 싣지 않는다.
*/

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { ownerKey?: string };

  try {
    const map = await loadGuinMap(token);
    if (!map) return NextResponse.json({ error: "이 지도를 찾을 수 없어요." }, { status: 404 });
    if (!isOwnerKey(map, body.ownerKey)) {
      return NextResponse.json({ error: "이 지도의 주인만 볼 수 있어요." }, { status: 403 });
    }

    const carried = carryBirthForReading(map, id);
    const resolved = await carried;
    if (!resolved) return NextResponse.json({ error: "이 사람을 찾을 수 없어요." }, { status: 404 });

    return NextResponse.json(resolved, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    console.error("사주지도 → 리딩 값 전달 실패:", error);
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 503 });
  }
}
