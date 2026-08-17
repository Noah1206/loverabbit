import { NextRequest, NextResponse } from "next/server";
import { chatComplete, type ChatMsg } from "@/lib/ai";
import { CHARACTERS } from "@/lib/characters";
import { validateMembershipToken } from "@/lib/tokens";

export const maxDuration = 60;

// 신당 캐릭터 챗 — 도령과의 몰입형 롤플레잉 대화.
// 과금 규칙: 무료 5턴 → 이후 멤버십 필요 (402 → 클라이언트가 멤버십 CTA 표시).

interface Body {
  characterId: string;
  question: string;
  history?: ChatMsg[];
  membershipToken?: string;
}

const FREE_TURNS = 5;
const MAX_HISTORY = 20;
const MAX_LEN = 500;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  const character = body ? CHARACTERS[body.characterId] : undefined;

  if (!character || !body?.question?.trim()) {
    return NextResponse.json({ error: "도령에게 할 말을 입력해주세요." }, { status: 400 });
  }
  if (body.question.length > MAX_LEN) {
    return NextResponse.json({ error: "한 번에 너무 길어요. 500자 안으로 나눠 말해주세요." }, { status: 400 });
  }

  const history = (body.history ?? []).slice(-MAX_HISTORY);
  const userTurns = history.filter((m) => m.role === "user").length;

  if (userTurns >= FREE_TURNS) {
    let membership;
    try {
      membership = await validateMembershipToken(body.membershipToken);
    } catch (error) {
      console.error("신당 멤버십 확인 실패:", error);
      return NextResponse.json({ error: "멤버십을 확인하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 503 });
    }
    if (!membership) {
      return NextResponse.json(
        {
          error: `${character.name}과의 무료 대화 ${FREE_TURNS}번을 다 썼어요. 멤버십이면 밤새 대화할 수 있어요.`,
          needMembership: true,
        },
        { status: 402 }
      );
    }
  }

  try {
    const result = await chatComplete(
      character.persona,
      [...history, { role: "user", content: body.question.trim() }],
      600
    );
    if (!result) {
      return NextResponse.json({
        answer: `*${character.name}이 잠시 향을 바라본다*\n\n[데모 모드] 오늘은 신의 목소리가 들리지 않는 날이군. (.env에 API 키를 넣으면 대화가 시작됩니다)`,
        demo: true,
      });
    }
    return NextResponse.json({ answer: result.text.trim() });
  } catch (e) {
    console.error("신당 챗 AI 호출 실패:", e);
    return NextResponse.json({ error: "향 연기가 짙어 잠시 답을 못 들었어요. 다시 말해주세요." }, { status: 502 });
  }
}
