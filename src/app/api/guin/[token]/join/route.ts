import { NextRequest, NextResponse } from "next/server";

import { joinGuinMap, listGuinNodes, loadGuinMap } from "@/lib/guin-db";
import { birthProblem, nicknameProblem, shapeMapView, type GuinBirthInput } from "@/lib/guin-map";
import { isDatabaseConfigured } from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";

// 친구 참여 — 이 화면이 2차 바이럴의 심장이다 (지시문 3.5).
//
// 친구는 **자기** 생년월일을 직접 넣는다. 남의 정보를 대신 넣는 입력은 없다.
// idempotencyKey 로 더블클릭·새로고침이 중복 참여자를 만들지 않는다.

const BUSY = "지금 귀인지도에 사람이 많이 몰리고 있어요. 입력 내용은 저장되지 않았으니 잠시 후 다시 시도해주세요.";

interface Body {
  nickname?: string;
  birth?: Partial<GuinBirthInput>;
  consent?: boolean;
  idempotencyKey?: string;
  userToken?: string;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isDatabaseConfigured()) return NextResponse.json({ error: BUSY }, { status: 503 });

  let map;
  try {
    map = await loadGuinMap(token);
  } catch (error) {
    console.error("귀인 지도 조회 실패:", error);
    return NextResponse.json({ error: BUSY }, { status: 503 });
  }
  if (!map) return NextResponse.json({ error: "이 지도를 찾을 수 없어요. 링크를 다시 확인해 주세요." }, { status: 404 });
  if (map.status !== "active") {
    return NextResponse.json({ error: "지도 주인이 지금 링크를 잠가 뒀어요." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;

  const nickname = (body.nickname ?? "").trim();
  const nicknameIssue = nicknameProblem(nickname);
  if (nicknameIssue) return NextResponse.json({ error: nicknameIssue }, { status: 400 });

  const birth: GuinBirthInput = {
    year: Number(body.birth?.year),
    month: Number(body.birth?.month),
    day: Number(body.birth?.day),
    hour: body.birth?.hour === null || body.birth?.hour === undefined ? null : Number(body.birth.hour),
  };
  const birthIssue = birthProblem(birth);
  if (birthIssue) return NextResponse.json({ error: birthIssue }, { status: 400 });

  if (body.consent !== true) return NextResponse.json({ error: "안내를 확인하고 동의해 주세요." }, { status: 400 });

  const idempotencyKey = (body.idempotencyKey ?? "").trim();
  if (idempotencyKey.length < 8 || idempotencyKey.length > 64) {
    return NextResponse.json({ error: "요청을 확인하지 못했어요. 새로고침 후 다시 시도해 주세요." }, { status: 400 });
  }

  let userId: number | null = null;
  try {
    const user = await resolveUserToken(body.userToken);
    userId = user?.userId ?? null;
  } catch {
    userId = null;
  }

  try {
    const joined = await joinGuinMap({ map, nickname, birth, idempotencyKey, userId });
    if (!joined.ok) {
      if (joined.reason === "full") {
        return NextResponse.json({ error: "이 지도는 자리가 가득 찼어요." }, { status: 409 });
      }
      return NextResponse.json({ error: BUSY }, { status: 503 });
    }
    // 참여를 마친 사람에게는 지도가 열린다 — 자기 결과 카드와 함께.
    const nodes = await listGuinNodes(map.id);
    const view = shapeMapView({
      token: map.shareToken,
      ownerNickname: map.ownerNickname,
      showScores: map.showScores,
      nodes,
      viewer: "participant",
    });
    return NextResponse.json({
      participantKey: joined.participantKey,
      participantId: joined.node.id,
      node: map.showScores ? joined.node : { ...joined.node, score: null },
      map: view,
    });
  } catch (error) {
    console.error("귀인 지도 참여 실패:", error);
    return NextResponse.json({ error: BUSY }, { status: 503 });
  }
}
