import { NextRequest, NextResponse } from "next/server";

import {
  loadGuinMap,
  participantIdOfKey,
  removeGuinParticipant,
  setGuinRelationshipContext,
} from "@/lib/guin-db";
import { normalizeStatus } from "@/lib/guin-map";
import { isDatabaseConfigured } from "@/lib/database";

// 관계 노드 삭제 — 주인이 지도에서 빼거나, 참여자가 자기 기록을 거둔다.
// 행을 실제로 지우고(관계 cascade), 두 번 불러도 같은 답이다 (멱등).

// PATCH — 참여자 본인이 실제 관계 상태를 고르면 저장하고, 그 문맥으로
// AI 리포트를 만든다 (guin-v3). AI 실패는 오류가 아니다 — 상태만 저장되고
// 화면은 결정론 템플릿 카드로 폴백한다.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    participantKey?: string;
    status?: string;
    note?: string;
  };

  const status = normalizeStatus(body.status);
  if (!status) return NextResponse.json({ error: "관계 상태를 확인해 주세요." }, { status: 400 });
  // 자유입력에도 개인정보 필터를 건다 — 전화번호·이메일·링크 차단 (지시문 8.1).
  const note = (body.note ?? "").trim().slice(0, 300);
  if (note && /01[016789][ .-]?\d{3,4}[ .-]?\d{4}|@|https?:|www\./i.test(note)) {
    return NextResponse.json(
      { error: "전화번호·주소·연락처 같은 개인정보는 입력하지 마세요." },
      { status: 400 }
    );
  }

  try {
    const map = await loadGuinMap(token);
    if (!map) return NextResponse.json({ error: "이 지도를 찾을 수 없어요." }, { status: 404 });
    // 자기 관계에만 상태를 붙일 수 있다 — 주인이 남의 상태를 대신 정하지 않는다.
    const selfId = await participantIdOfKey(map.id, body.participantKey);
    if (selfId !== id) return NextResponse.json({ error: "이 기록을 고칠 권한이 없어요." }, { status: 403 });

    const outcome = await setGuinRelationshipContext({ map, participantId: id, status, note });
    if (!outcome.ok) return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 503 });
    return NextResponse.json({ ok: true, contextStatus: status, aiReport: outcome.aiReport });
  } catch (error) {
    console.error("귀인 관계 상태 저장 실패:", error);
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
}

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
