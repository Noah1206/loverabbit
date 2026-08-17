import { NextRequest, NextResponse } from "next/server";
import { open } from "@/lib/crypto";
import { chatComplete, type ChatMsg } from "@/lib/ai";

export const maxDuration = 60;

// 추가 상담 — 해금된 리딩에 대해 '레빗 언니'와 후속 질문 채팅.
// 이용 규칙: 풀 리딩마다 후속 질문 1회를 무료로 제공한다.
// 리딩 컨텍스트는 클라이언트가 보관한 봉인 blob에서 서버가 복호화해 사용한다.

interface Body {
  readingId: string;
  blob: string;
  question: string;
  history?: ChatMsg[];
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
- 성인 주제는 회피하지 않고 분석적으로 다루되, 표현은 절제된 은유까지 — 노골적 묘사 금지.
- 사주로 답할 수 없는 질문(의료·법률·타인 신상)은 명리의 범위 밖임을 밝히고 선을 긋는다.
- 대화가 다른 주제(재회→결혼 등)로 넘어가면, 답변 끝에 해당 리딩 상품을 한 줄로 자연스럽게 안내해도 좋다 (강매 금지, 최대 한 문장).`;
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

  const history = (body.history ?? []).slice(-MAX_HISTORY);
  const userTurns = history.filter((m) => m.role === "user").length;

  // 풀 리딩별 무료 후속 질문은 1회로 제한한다.
  if (userTurns >= 1) {
    return NextResponse.json(
      { error: "이번 리딩의 무료 추가 상담 1회를 이미 사용했어요.", limitReached: true },
      { status: 402 }
    );
  }

  try {
    const result = await chatComplete(
      chatSystemPrompt(sealed),
      [...history, { role: "user", content: body.question.trim() }],
      800
    );
    if (!result) {
      return NextResponse.json({
        answer:
          "[데모 모드] 좋은 질문이야. 근데 지금은 데모라서 진짜 답은 못 해줘 — .env에 API 키를 넣으면 레빗 언니가 제대로 대답해줄게.",
        demo: true,
      });
    }
    return NextResponse.json({ answer: result.text.trim(), provider: result.provider });
  } catch (e) {
    console.error("추가 상담 AI 호출 실패:", e);
    return NextResponse.json({ error: "잠깐 딴생각했어. 다시 물어봐줄래?" }, { status: 502 });
  }
}
