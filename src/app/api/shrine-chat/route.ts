import { NextRequest, NextResponse } from "next/server";
import { chatComplete, type ChatMsg } from "@/lib/ai";
import { FREE_CHAT_TURNS } from "@/lib/chat-products";
import { CHARACTERS } from "@/lib/characters";
import {
  FREE_TURNS_UNTRACKED,
  restoreChatCredit,
  restoreFreeChatTurn,
  useChatCredit,
  useFreeChatTurn,
} from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";

export const maxDuration = 60;

// 신당 캐릭터 챗 — 도령과의 몰입형 롤플레잉 대화.
// 이용 규칙: 로그인은 첫 대화부터 필수. 계정당 무료 5턴을 쓰고 나면 대화권(크레딧) 결제가 필요하다.
// 무료 소진량은 브라우저 기록이 아니라 서버(lr_users.chat_free_turns_used)가 센다.

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

  // 1) 로그인 확인 — 무료 대화도 로그인해야 쓸 수 있다.
  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch (error) {
    console.error("캐릭터챗 회원 확인 실패:", error);
    return NextResponse.json({ error: "회원 정보를 확인하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }
  if (!user?.userId) {
    return NextResponse.json(
      { error: "신당 대화는 로그인 후 이용할 수 있어요.", needSignup: true },
      { status: 401 }
    );
  }

  // 2) 무료 5턴 → 소진되면 대화권 차감
  let creditUserId: number | undefined;
  let creditsRemaining: number | undefined;
  let freeTurnsRemaining: number | undefined;
  try {
    const freeLeft = await useFreeChatTurn(user.userId, FREE_CHAT_TURNS);
    if (freeLeft === FREE_TURNS_UNTRACKED) {
      // 마이그레이션 미적용 DB — 로그인 게이트는 그대로 두고 통과시킨다
    } else if (freeLeft === null) {
      creditsRemaining = (await useChatCredit(user.userId)) ?? undefined;
      if (creditsRemaining === undefined) {
        return NextResponse.json(
          {
            error: `무료 대화 ${FREE_CHAT_TURNS}번을 모두 사용했어요. 대화권을 결제하면 바로 이어갈 수 있어요.`,
            limitReached: true,
            paymentRequired: true,
          },
          { status: 402 }
        );
      }
      creditUserId = user.userId;
    } else {
      freeTurnsRemaining = freeLeft;
    }
  } catch (error) {
    console.error("캐릭터챗 이용량 확인 실패:", error);
    return NextResponse.json({ error: "대화 이용량을 확인하지 못했어요." }, { status: 503 });
  }

  const history = (body.history ?? []).slice(-MAX_HISTORY);

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
        creditsRemaining,
        freeTurnsRemaining,
      });
    }
    return NextResponse.json({ answer: result.text.trim(), creditsRemaining, freeTurnsRemaining });
  } catch (e) {
    // 답을 못 받았으면 방금 깎은 무료 턴/대화권을 돌려준다.
    if (creditUserId) {
      await restoreChatCredit(creditUserId).catch((refundError) =>
        console.error("질문권 복구 실패:", refundError)
      );
    } else if (freeTurnsRemaining !== undefined && freeTurnsRemaining >= 0) {
      await restoreFreeChatTurn(user.userId).catch((refundError) =>
        console.error("무료 대화 복구 실패:", refundError)
      );
    }
    console.error("신당 챗 AI 호출 실패:", e);
    return NextResponse.json({ error: "향 연기가 짙어 잠시 답을 못 들었어요. 다시 말해주세요." }, { status: 502 });
  }
}
