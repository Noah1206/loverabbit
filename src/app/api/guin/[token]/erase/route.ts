import { NextRequest, NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/database";
import { eraseByFingerprint, loadGuinMap } from "@/lib/guin-db";
import { birthProblem, nicknameProblem, type GuinBirthInput } from "@/lib/guin-map";
import { notifyAdmin } from "@/lib/telegram";

/*
  "이 지도에서 나를 지워 주세요" — 본인이 직접 누르는 자리.

  왜 필요한가. 주인이 대신 넣은 사람(added_by_owner)은 참여자 키가 없다.
  키가 없으면 기존 삭제 API 를 못 쓴다 — 그래서 지금까지는 방침에 "요청하면
  삭제합니다" 라고 적어 놓고 실제로는 운영자가 손으로 지워야 했다. 사람이
  손으로 하는 약속은 사람이 자는 동안 지켜지지 않는다.

  본인 확인은 **지문**으로 한다. 이 지도에 들어간 사람의 별명과 생년월일을
  아는 사람만 지울 수 있다 — 그 둘은 넣은 사람과 본인만 안다. 지도에 공개된
  것은 별명뿐이라, 별명만으로는 지워지지 않는다.

  일부러 안 하는 것:
    · 목록을 돌려주지 않는다. 틀린 입력에도 "찾지 못했어요" 하나만 답한다 —
      맞히기로 남의 생일을 캐는 길을 열지 않는다.
    · 지운 뒤에도 누가 지웠는지 기록하지 않는다. 지우러 온 사람의 정보를
      새로 남기는 것은 앞뒤가 안 맞는다.
*/

interface Body {
  nickname?: string;
  birth?: Partial<GuinBirthInput>;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const nickname = (body.nickname ?? "").trim();
  const nicknameIssue = nicknameProblem(nickname);
  if (nicknameIssue) return NextResponse.json({ error: nicknameIssue }, { status: 400 });

  const birth: GuinBirthInput = {
    year: Number(body.birth?.year),
    month: Number(body.birth?.month),
    day: Number(body.birth?.day),
    // 시각은 지문에 들어가지 않는다 — 모르는 사람도 지울 수 있어야 한다.
    hour: null,
  };
  const birthIssue = birthProblem(birth);
  if (birthIssue) return NextResponse.json({ error: birthIssue }, { status: 400 });

  try {
    const map = await loadGuinMap(token);
    // 지도가 없어도 같은 말을 한다 — 어느 토큰이 살아 있는지 알려주지 않는다.
    if (!map) {
      return NextResponse.json({ error: "입력한 정보와 맞는 기록을 찾지 못했어요." }, { status: 404 });
    }

    const erased = await eraseByFingerprint(map, nickname, birth);
    if (erased === 0) {
      return NextResponse.json({ error: "입력한 정보와 맞는 기록을 찾지 못했어요." }, { status: 404 });
    }

    // 운영자는 알아야 한다 — 다만 누가 지웠는지는 적지 않는다. 지운 사실만.
    await notifyAdmin(
      [
        "[사주지도] 본인 요청으로 기록이 삭제됐어요",
        `지도 ${token.slice(0, 8)}… · ${erased}건`,
        "본인 확인(별명+생년월일)을 거친 자동 삭제입니다.",
      ].join("\n")
    );

    return NextResponse.json({ erased });
  } catch (error) {
    console.error("사주지도 본인 삭제 실패:", error);
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 503 });
  }
}
