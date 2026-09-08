import { NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/database";
import { listGuinNodes, loadGuinMap } from "@/lib/guin-db";

/*
  공유받은 사람이 보는 결과 한 장.

  왜 따로 있나 — 지도 GET 은 방문자(stranger)에게 노드를 하나도 주지 않는다.
  남의 지도에 누가 있는지가 그대로 새면 안 되기 때문이고, 그 규칙은 그대로 둔다.

  그런데 바이럴은 그 반대를 요구한다. "민지는 내 귀인 1위였어" 를 받은 민지가
  링크를 열었을 때, 생년월일부터 요구받으면 거기서 끝난다. 자기 결과를 먼저
  보여줘야 "그럼 얘는 나한테 뭐지?" 가 나온다.

  그래서 딱 한 사람만 돌려준다. 주인이 공유 링크에 실어 보낸 그 사람이다.
  지도의 다른 사람은 여전히 안 보인다.

  나가지 않는 것:
    · 다른 참여자 — 이 한 명뿐이다
    · 생년월일 — 애초에 노드에 없다(봉인 저장)
    · 관계 상태·리포트 — 본인만 보는 값이라 여기서 뗀다
    · 점수 — 지도 설정(showScores)이 꺼져 있으면 가린다
*/

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  try {
    const map = await loadGuinMap(token);
    if (!map) return NextResponse.json({ error: "이 지도를 찾을 수 없어요." }, { status: 404 });
    // 주인이 링크를 잠갔으면 공유받은 사람도 못 본다 — 지도 GET 과 같은 규칙.
    if (map.status !== "active") {
      return NextResponse.json({ error: "지도 주인이 지금 링크를 잠가 뒀어요." }, { status: 403 });
    }

    const nodes = await listGuinNodes(map.id);
    const node = nodes.find((item) => item.id === id);
    if (!node) return NextResponse.json({ error: "이 결과를 찾을 수 없어요." }, { status: 404 });

    return NextResponse.json(
      {
        ownerNickname: map.ownerNickname,
        person: {
          id: node.id,
          nickname: node.nickname,
          roleLabel: node.roleLabel,
          roleTagline: node.roleTagline,
          score: map.showScores ? node.score : null,
          strengths: node.strengths,
          // 역방향(그 사람에게 주인은 무엇인가)은 여기서 주지 않는다.
          // 그것이 이 화면이 파는 궁금증이다 — 자기 지도를 만들어야 나온다.
        },
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("사주지도 결과 공유 조회 실패:", error);
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 503 });
  }
}
