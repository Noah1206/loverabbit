import { NextRequest, NextResponse } from "next/server";

import {
  claimGuinMap,
  deleteGuinMap,
  isOwnerKey,
  listGuinNodes,
  loadGuinMap,
  ownerPersonaOf,
  participantIdOfKey,
  updateGuinMap,
} from "@/lib/guin-db";
import { shapeMapView } from "@/lib/guin-map";
import { isDatabaseConfigured } from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";

// 지도 한 장. 조회(GET)·설정(PATCH)·삭제(DELETE).
//
// 누가 보느냐가 응답을 가른다: 참여 전 방문자는 노드를 받지 못한다 — 지도는
// 참여해야 보인다 (지시문 3.5). 이 구분은 화면이 아니라 여기서 난다.

const BUSY = "지금 귀인지도에 사람이 많이 몰리고 있어요. 잠시 후 다시 시도해주세요.";

async function resolveMap(token: string) {
  if (!isDatabaseConfigured()) return { error: NextResponse.json({ error: BUSY }, { status: 503 }) };
  const map = await loadGuinMap(token).catch((error) => {
    console.error("귀인 지도 조회 실패:", error);
    return undefined;
  });
  if (map === undefined) return { error: NextResponse.json({ error: BUSY }, { status: 503 }) };
  if (map === null)
    return { error: NextResponse.json({ error: "이 지도를 찾을 수 없어요. 링크를 다시 확인해 주세요." }, { status: 404 }) };
  return { map };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveMap(token);
  if ("error" in resolved) return resolved.error;
  const { map } = resolved;

  const ownerKey = request.headers.get("x-guin-owner-key");
  const participantKey = request.headers.get("x-guin-participant-key");

  try {
    const owner = isOwnerKey(map, ownerKey);
    // 주인이 링크를 잠갔으면(disabled) 주인 말고는 아무도 못 본다.
    if (map.status === "disabled" && !owner) {
      return NextResponse.json({ error: "지도 주인이 지금 링크를 잠가 뒀어요." }, { status: 403 });
    }
    const participantId = owner ? null : await participantIdOfKey(map.id, participantKey);
    const viewer = owner ? "owner" : participantId ? "participant" : "stranger";
    const nodes = viewer === "stranger" ? [] : await listGuinNodes(map.id);
    // 방문자에게도 역할 분포는 보여줘야 하므로(공유 카드 문구) 전체 수를 따로 센다.
    const allNodes = viewer === "stranger" ? await listGuinNodes(map.id) : nodes;
    const view = shapeMapView({
      token: map.shareToken,
      ownerNickname: map.ownerNickname,
      showScores: map.showScores,
      nodes: allNodes,
      viewer,
    });

    return NextResponse.json(
      {
        ...view,
        linkEnabled: map.status === "active",
        claimed: map.ownerUserId !== null,
        myParticipantId: participantId,
        ownerPersona: ownerPersonaOf(map),
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("귀인 지도 응답 실패:", error);
    return NextResponse.json({ error: BUSY }, { status: 503 });
  }
}

interface PatchBody {
  ownerKey?: string;
  showScores?: boolean;
  linkEnabled?: boolean;
  /** 게스트로 만든 지도를 로그인한 계정에 잇는다 */
  claimUserToken?: string;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveMap(token);
  if ("error" in resolved) return resolved.error;
  const { map } = resolved;

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  if (!isOwnerKey(map, body.ownerKey)) {
    return NextResponse.json({ error: "지도 주인만 설정을 바꿀 수 있어요." }, { status: 403 });
  }

  try {
    await updateGuinMap({
      map,
      ...(body.showScores === undefined ? {} : { showScores: body.showScores === true }),
      ...(body.linkEnabled === undefined ? {} : { status: body.linkEnabled ? "active" : "disabled" }),
    });
    if (body.claimUserToken && map.ownerUserId === null) {
      const user = await resolveUserToken(body.claimUserToken).catch(() => null);
      if (user?.userId) await claimGuinMap(map.id, user.userId);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("귀인 지도 설정 실패:", error);
    return NextResponse.json({ error: BUSY }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveMap(token);
  // 이미 없는 지도의 삭제는 성공이다 — 멱등.
  if ("error" in resolved && resolved.error) {
    return resolved.error.status === 404 ? NextResponse.json({ ok: true }) : resolved.error;
  }
  if (!("map" in resolved) || !resolved.map) return NextResponse.json({ ok: true });
  const { map } = resolved;

  const body = (await request.json().catch(() => ({}))) as { ownerKey?: string };
  if (!isOwnerKey(map, body.ownerKey)) {
    return NextResponse.json({ error: "지도 주인만 지울 수 있어요." }, { status: 403 });
  }
  try {
    await deleteGuinMap(map.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("귀인 지도 삭제 실패:", error);
    return NextResponse.json({ error: BUSY }, { status: 503 });
  }
}
