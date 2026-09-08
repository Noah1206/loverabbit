import { NextRequest, NextResponse } from "next/server";

import { isOwnerKey, joinGuinMap, listGuinNodes, loadGuinMap } from "@/lib/guin-db";
import { birthProblem, nicknameProblem, shapeMapView, type GuinBirthInput } from "@/lib/guin-map";
import { isDatabaseConfigured } from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";

// 지도에 사람이 앉는 자리. 들어오는 길이 둘이다.
//
// 1. **친구가 직접** — 초대 링크를 열고 자기 생년월일을 넣는다. 원래 있던 길이고,
//    본인이 넣은 것이라 가장 정확하다.
// 2. **주인이 대신** (2026-09-08, ownerKey 필요) — 내가 친구의 생일을 넣는다.
//    링크를 보내고 기다리는 것만으로는 지도가 채워지지 않아서 열었다 (지도 6개에
//    참여자 0명이었다). 대신 넣은 사람은 addedByOwner 로 표시해 구분한다.
//
// 2번은 남의 생년월일을 본인 동의 없이 받는 길이다. 그래서 셋을 지킨다.
//   · ownerKey 를 확인한다 — 남의 지도에 사람을 심을 수 없다.
//   · 생년월일은 다른 참여 경로와 똑같이 봉인해 저장한다(sealBirth). 평문으로
//     보관하지 않고 응답에도 실리지 않는다.
//   · 화면이 별명을 권한다. 실명을 요구하지 않는다.
//
// idempotencyKey 로 더블클릭·새로고침이 중복 참여자를 만들지 않는다.

const BUSY = "지금 귀인지도에 사람이 많이 몰리고 있어요. 입력 내용은 저장되지 않았으니 잠시 후 다시 시도해주세요.";

interface Body {
  nickname?: string;
  birth?: Partial<GuinBirthInput>;
  consent?: boolean;
  idempotencyKey?: string;
  userToken?: string;
  /** 주인이 대신 넣을 때만. 있으면 그 키가 이 지도의 주인인지 확인한다. */
  ownerKey?: string;
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

  /*
    주인이 대신 넣는 것인가.

    ownerKey 가 왔고 그것이 이 지도의 주인 키일 때만 참이다. 키가 틀리면 그냥
    보통 참여로 떨어뜨리지 않고 막는다 — 주인인 척하려 한 요청이기 때문이다.
  */
  const byOwner = typeof body.ownerKey === "string" && body.ownerKey.length > 0;
  if (byOwner && !isOwnerKey(map, body.ownerKey)) {
    return NextResponse.json({ error: "이 지도의 주인만 사람을 추가할 수 있어요." }, { status: 403 });
  }

  // 동의는 본인이 넣을 때 받는 것이다. 주인이 대신 넣는 자리에서는 본인이
  // 없으므로 물을 수 없다 — 대신 화면이 별명을 권하고, 나중에 그 친구가
  // 직접 들어오면 그때 본인 동의를 받는다.
  if (!byOwner && body.consent !== true) {
    return NextResponse.json({ error: "안내를 확인하고 동의해 주세요." }, { status: 400 });
  }

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
    const joined = await joinGuinMap({ map, nickname, birth, idempotencyKey, userId, addedByOwner: byOwner });
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
      selfParticipantId: joined.node.id,
    });
    return NextResponse.json({
      participantKey: joined.participantKey,
      participantId: joined.node.id,
      node: map.showScores
        ? joined.node
        : {
            ...joined.node,
            score: null,
            // 역방향 점수도 같이 가린다 (shapeMapView 와 같은 규칙).
            reverse: joined.node.reverse ? { ...joined.node.reverse, score: null, axes: null } : null,
          },
      map: view,
      // 이미 참여한 기록이 있어 기존 결과를 돌려준 경우 — 화면이 안내한다.
      replayed: joined.replayed,
    });
  } catch (error) {
    console.error("귀인 지도 참여 실패:", error);
    return NextResponse.json({ error: BUSY }, { status: 503 });
  }
}
