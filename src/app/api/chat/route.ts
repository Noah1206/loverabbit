import { NextRequest, NextResponse } from "next/server";
import { open } from "@/lib/crypto";
import { chatComplete, type ChatMsg } from "@/lib/ai";
import { ABSOLUTE_PATTERNS, OUT_OF_SCOPE } from "@/lib/reading-guard";
import {
  InsufficientCreditsError,
  applyCredit,
  createQuestion,
  getCreditBalance,
  settleQuestion,
} from "@/lib/credits-db";
import { QUESTION_COST } from "@/lib/credits";
import { isDatabaseConfigured } from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";

export const maxDuration = 60;

// 추가 상담 — 해금된 리딩에 대해 후속 질문 채팅.
// 이용 규칙: 풀 리딩마다 후속 질문 1회를 무료로 제공한다. 그 뒤는 /ask (크레딧).
//
// 무료 1회는 **서버가 센다** (2026-08-30). 전에는 브라우저가 보낸 history 의 user
// 턴 수로 셌는데, 새로고침하면 history 가 비어 다시 1회가 살았다. 이제 질문은
// lr_questions 에 reading_ids=[이 리딩] 으로 남고, 그 행이 있으면 무료가 끝난 것이다.
// 리딩 컨텍스트는 클라이언트가 보관한 봉인 blob에서 서버가 복호화해 사용한다.

interface Body {
  readingId: string;
  blob: string;
  question: string;
  history?: ChatMsg[];
  userToken?: string;
}

interface SealedReading {
  id: string;
  full: string;
  price: number;
  label?: string;
  chart?: { me: string; partner: string | null };
}

const MAX_HISTORY = 12; // 컨텍스트 폭주 방지
const MAX_QUESTION_LEN = 500;

function chatSystemPrompt(s: SealedReading): string {
  return `당신은 러브레빗의 수석 명리 분석가입니다. 사용자가 방금 받은 사주 리딩에 대해 후속 질문을 하는 추가 상담 중입니다.

[방금 나간 리딩]
- 종류: ${s.label ?? "연애 리딩"}
- 본인 사주: ${s.chart?.me ?? "정보 없음"}
- 상대 사주: ${s.chart?.partner ?? "없음 (단독 리딩)"}
- 리딩 전문:
${s.full}

[상담 규칙]
- 차분하고 전문적인 해요체. 점집 화술·호들갑 금지.
- 답변은 3~6문장. 판단마다 사주 근거(일간·오행·시기)를 짧게 붙인다. 리딩 전문과 모순되는 말 금지.
- 리딩 전문에 없는 십성·신살·날짜·점수를 새로 만들지 않는다.
- 단정 금지: "반드시·무조건·틀림없이·100%·확정·운명이다·재회한다·헤어진다" 같은 결과 선언을 쓰지 않는다.
- 관계 주제는 감정과 상호작용을 중심으로 분석하고 자극적인 표현은 피한다.
- 사주로 답할 수 없는 질문(의료·법률·타인 신상)은 명리의 범위 밖임을 밝히고 선을 긋는다.
- 대화가 다른 주제(재회→결혼 등)로 넘어가면, 답변 끝에 해당 리딩 상품을 한 줄로 자연스럽게 안내해도 좋다 (강매 금지, 최대 한 문장).`;
}

function guardHits(text: string): string[] {
  const hits: string[] = [];
  for (const [re, label] of ABSOLUTE_PATTERNS) if (re.test(text)) hits.push(label);
  for (const [re, label] of OUT_OF_SCOPE) if (re.test(text)) hits.push(label);
  return hits;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.readingId || !body?.blob || !body?.question?.trim()) {
    return NextResponse.json({ error: "질문을 입력해주세요." }, { status: 400 });
  }
  if (body.question.length > MAX_QUESTION_LEN) {
    return NextResponse.json({ error: "질문이 너무 길어요. 500자 안으로 부탁해." }, { status: 400 });
  }

  const sealed = open<SealedReading>(body.blob);
  if (!sealed || sealed.id !== body.readingId) {
    return NextResponse.json({ error: "리딩 정보를 확인할 수 없습니다." }, { status: 404 });
  }

  // 무료 1회는 계정에 묶인다. 로그인 없이는 셀 수 없으므로 열지 않는다.
  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch {
    user = null;
  }
  const userId = user?.userId;
  if (isDatabaseConfigured() && !userId) {
    return NextResponse.json({ error: "추가 상담은 로그인 후 이용할 수 있어요.", needSignup: true }, { status: 401 });
  }
  /*
    무료 1회는 없앴다 (2026-08-30). 리딩에 딸린 상담도 크레딧을 쓴다.

    잔액 확인만 여기서 하고, 실제 차감은 답을 만들기 직전에 한다 — 먼저 깎으면
    모델 호출이 실패했을 때 되돌릴 자리가 늘어난다.
  */
  if (userId) {
    let balance;
    try {
      balance = await getCreditBalance(userId);
    } catch (error) {
      console.error("크레딧 잔액 조회 실패:", error);
      return NextResponse.json({ error: "크레딧을 확인하지 못했어요." }, { status: 503 });
    }
    if (balance < QUESTION_COST) {
      return NextResponse.json(
        {
          error: `크레딧이 모자라요. 질문 한 번에 ${QUESTION_COST}크레딧이 들어요.`,
          needCredits: true,
          balance,
        },
        { status: 402 }
      );
    }
  }

  const history = (body.history ?? []).slice(-MAX_HISTORY);
  const question = body.question.trim();
  const record = userId ? await createQuestion({ userId, question, readingIds: [body.readingId] }).catch(() => null) : null;

  /** 답을 못 준 경우 되돌린다. 원장에 refund 로 남는다. */
  const refund = async () => {
    if (!userId) return;
    try {
      await applyCredit(userId, QUESTION_COST, "refund", record ? String(record.id) : undefined);
    } catch (error) {
      console.error("크레딧 환불 실패:", error);
    }
  };

  // 여기서 깎는다. 잔액이 그 사이에 비었으면(다른 탭에서 썼다면) RPC 가 막는다.
  if (userId) {
    try {
      await applyCredit(userId, -QUESTION_COST, "question", record ? String(record.id) : undefined);
    } catch (error) {
      if (record) await settleQuestion(record.id, { failed: true }).catch(() => {});
      if (error instanceof InsufficientCreditsError) {
        return NextResponse.json(
          { error: `크레딧이 모자라요. 질문 한 번에 ${QUESTION_COST}크레딧이 들어요.`, needCredits: true },
          { status: 402 }
        );
      }
      console.error("크레딧 차감 실패:", error);
      return NextResponse.json({ error: "크레딧을 쓰지 못했어요." }, { status: 503 });
    }
  }

  try {
    const system = chatSystemPrompt(sealed);
    let result = await chatComplete(system, [...history, { role: "user", content: question }], 800);
    if (!result) {
      if (record) await settleQuestion(record.id, { failed: true }).catch(() => {});
      await refund();
      return NextResponse.json({
        answer:
          "[데모 모드] 좋은 질문이야. 근데 지금은 데모라서 진짜 답은 못 해줘 — .env에 API 키를 넣으면 레빗 언니가 제대로 대답해줄게.",
        demo: true,
      });
    }
    let answer = result.text.trim();
    const hits = guardHits(answer);
    if (hits.length > 0) {
      result = await chatComplete(
        system,
        [
          ...history,
          { role: "user", content: question },
          { role: "assistant", content: answer },
          { role: "user", content: `방금 답에 금지 표현이 있어요 (${hits.join(", ")}). 같은 내용을 단정 없이, 흐름과 경향으로 다시 써 주세요.` },
        ],
        800
      );
      answer = result?.text.trim() ?? "";
      if (!answer || guardHits(answer).length > 0) throw new Error("CHAT_GUARD_FAILED");
    }
    if (record) await settleQuestion(record.id, { answer }).catch(() => {});
    return NextResponse.json({ answer, provider: result?.provider });
  } catch (e) {
    console.error("추가 상담 AI 호출 실패:", e);
    if (record) await settleQuestion(record.id, { failed: true }).catch(() => {});
    // 답을 못 줬으면 크레딧도 돌려준다. 못 돌려줘도 응답은 내보낸다 —
    // 원장에 refund 가 없으면 운영자가 손으로 채울 수 있다.
    await refund();
    return NextResponse.json({ error: "잠깐 딴생각했어. 다시 물어봐줄래?" }, { status: 502 });
  }
}
