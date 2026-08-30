import { NextRequest, NextResponse } from "next/server";

import { createGuinMap } from "@/lib/guin-db";
import { birthProblem, nicknameProblem, type GuinBirthInput } from "@/lib/guin-map";
import { isDatabaseConfigured } from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";

// 귀인 지도 생성. 로그인 없이 된다 — 소유권은 응답의 ownerKey 가 정본이고,
// 그 키는 이 응답 한 번 나간 뒤 브라우저 localStorage 에만 산다.

interface Body {
  nickname?: string;
  birth?: Partial<GuinBirthInput>;
  consent?: boolean;
  userToken?: string;
}

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "지도 저장소를 준비 중이에요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
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

  if (body.consent !== true) {
    return NextResponse.json({ error: "안내를 확인하고 동의해 주세요." }, { status: 400 });
  }

  // 로그인돼 있으면 계정을 이어 둔다. 안 돼 있어도 막지 않는다 — 게스트 모드.
  let userId: number | null = null;
  try {
    const user = await resolveUserToken(body.userToken);
    userId = user?.userId ?? null;
  } catch {
    userId = null;
  }

  try {
    const created = await createGuinMap({ nickname, birth, userId });
    if (!created) throw new Error("지도를 만들지 못했습니다.");
    return NextResponse.json({ token: created.token, ownerKey: created.ownerKey });
  } catch (error) {
    console.error("귀인 지도 생성 실패:", error);
    return NextResponse.json(
      { error: "지금 귀인지도에 사람이 많이 몰리고 있어요. 입력 내용은 저장되지 않았으니 잠시 후 다시 시도해주세요." },
      { status: 503 }
    );
  }
}
