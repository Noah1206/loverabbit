import { NextRequest, NextResponse } from "next/server";

import { loadGuinMap, removeGuinParticipant } from "@/lib/guin-db";
import { isDatabaseConfigured } from "@/lib/database";

// 관계 노드 삭제 — 주인이 지도에서 빼거나, 참여자가 자기 기록을 거둔다.
// 행을 실제로 지우고(관계 cascade), 두 번 불러도 같은 답이다 (멱등).

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    ownerKey?: string;
    participantKey?: string;
  };

  try {
    const map = await loadGuinMap(token);
    // 지도가 이미 없으면 노드도 없다 — 삭제는 이미 이루어진 셈이다.
    if (!map) return NextResponse.json({ ok: true });
    const outcome = await removeGuinParticipant({
      map,
      participantId: id,
      ownerKey: body.ownerKey,
      participantKey: body.participantKey,
    });
    if (outcome === "forbidden") {
      return NextResponse.json({ error: "이 기록을 지울 권한이 없어요." }, { status: 403 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("귀인 지도 참여자 삭제 실패:", error);
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
}
