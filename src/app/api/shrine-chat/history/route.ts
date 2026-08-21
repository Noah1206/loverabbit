import { NextRequest, NextResponse } from "next/server";

import { CHARACTERS } from "@/lib/characters";
import { listShrineMessages } from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";

// 신당 대화 이력 조회 — 화면이 다시 열릴 때 서버에 남은 대화를 이어 받는 곳.
//
// 답이 오는 중에 새로고침한 사람이 여기서 그 답을 만난다. 서버는 질문권을
// 깎고 답을 만들어 lr_shrine_messages 에 남겼는데, 클라이언트만 못 받았던
// 것이다. 기기를 바꿔도 같은 길로 대화가 따라온다.

interface Body {
  userToken?: string;
  characterId?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const character = CHARACTERS[body.characterId ?? ""];
  if (!character) {
    return NextResponse.json({ error: "캐릭터를 확인하지 못했어요." }, { status: 400 });
  }

  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch (error) {
    console.error("신당 이력 회원 확인 실패:", error);
    return NextResponse.json({ error: "회원 정보를 확인하지 못했어요." }, { status: 503 });
  }
  if (!user?.userId) {
    return NextResponse.json({ error: "로그인하면 대화 기록을 볼 수 있어요." }, { status: 401 });
  }

  try {
    const messages = await listShrineMessages(user.userId, character.id);
    return NextResponse.json(
      { messages },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("신당 이력 조회 실패:", error);
    return NextResponse.json({ error: "대화 기록을 불러오지 못했어요." }, { status: 503 });
  }
}
