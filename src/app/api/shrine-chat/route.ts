import { NextRequest, NextResponse } from "next/server";
import { chatComplete, type ChatMsg } from "@/lib/ai";
import { FREE_CHAT_TURNS } from "@/lib/chat-products";
import { CHARACTERS } from "@/lib/characters";
import { restoreChatCredit, useChatCredit } from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";

export const maxDuration = 60;

// 신당 캐릭터 챗 — 도령과의 몰입형 롤플레잉 대화.
// 이용 규칙: 무료 대화 5턴을 제공한다.

interface Body {
  characterId: string;
  question: string;
  history?: ChatMsg[];
  userToken?: string;
}

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

  let creditUserId: number | undefined;
  let creditsRemaining: number | undefined;
  if (userTurns >= FREE_CHAT_TURNS) {
    try {
      const user = await resolveUserToken(body.userToken);
      if (!user?.userId) {
        return NextResponse.json(
          { error: "추가 질문권을 사용하려면 먼저 가입해주세요.", needSignup: true, limitReached: true },
          { status: 401 }
        );
      }
      creditsRemaining = (await useChatCredit(user.userId)) ?? undefined;
      if (creditsRemaining === undefined) {
        return NextResponse.json(
          {
            error: `무료 대화 ${FREE_CHAT_TURNS}번을 모두 사용했어요. 로그인 후 대화권을 결제하면 바로 이어갈 수 있어요.`,
            limitReached: true,
            paymentRequired: true,
          },
          { status: 402 }
        );
      }
      creditUserId = user.userId;
    } catch (error) {
      console.error("캐릭터챗 질문권 확인 실패:", error);
      return NextResponse.json({ error: "질문권을 확인하지 못했어요." }, { status: 503 });
    }
  }

  try {
    const result = await chatComplete(
      character.persona,
      [...history, { role: "user", content: body.question.trim() }],
      600
    );
    if (!result) {
      if (creditUserId) await restoreChatCredit(creditUserId);
      return NextResponse.json({
        answer: `*${character.name}이 잠시 향을 바라본다*\n\n[데모 모드] 오늘은 신의 목소리가 들리지 않는 날이군. (.env에 API 키를 넣으면 대화가 시작됩니다)`,
        demo: true,
      });
    }
    return NextResponse.json({ answer: result.text.trim(), creditsRemaining });
  } catch (e) {
    if (creditUserId) {
      await restoreChatCredit(creditUserId).catch((refundError) =>
        console.error("질문권 복구 실패:", refundError)
      );
    }
    console.error("신당 챗 AI 호출 실패:", e);
    return NextResponse.json({ error: "향 연기가 짙어 잠시 답을 못 들었어요. 다시 말해주세요." }, { status: 502 });
  }
}
