import "server-only";

// 질문 하나에 답을 만든다 — 크레딧 5장짜리.
//
// 근거는 둘이다. 저장된 내 사주 프로필로 계산한 명식, 그리고 그 사람이 이미 산
// 리딩 전문(최근 3건). 리딩 전문에는 상대 이야기가 들어 있을 수 있고 그건 그대로
// 쓴다 — 산 리포트 안의 문장이다. 하지만 상대 생년월일을 따로 꺼내 새로 계산하지는
// 않는다. 저장된 상대 정보를 재사용하지 않는 것이 규칙이다.
//
// 가드: 리포트용 checkReport 는 구조화 리포트를 받는다. 여기는 자유 문장이라
// 같은 표(ABSOLUTE_PATTERNS·OUT_OF_SCOPE)를 문장에 직접 댄다. 걸리면 한 번
// 다시 시키고, 또 걸리면 답을 내보내지 않고 크레딧을 되돌린다.

import { chatComplete } from "@/lib/ai";
import { ABSOLUTE_PATTERNS, OUT_OF_SCOPE } from "@/lib/reading-guard";
import { chartSummary, computeSaju } from "@/lib/saju";
import { PRODUCT_MAP } from "@/lib/products";
import type { ContextReading } from "@/lib/credits-db";
import type { SajuProfile } from "@/lib/database";

export interface QuestionContext {
  profile: SajuProfile | null;
  readings: ContextReading[];
}

export interface QuestionOutcome {
  answer: string;
  provider: string;
  retried: boolean;
}

/** 리딩 전문은 길다. 세 건이면 3만 자가 넘어가므로 앞부분만 싣는다. */
const READING_EXCERPT = 4000;

function violations(text: string): string[] {
  const hits: string[] = [];
  for (const [re, label] of ABSOLUTE_PATTERNS) if (re.test(text)) hits.push(label);
  for (const [re, label] of OUT_OF_SCOPE) if (re.test(text)) hits.push(label);
  return hits;
}

export function myChartSummary(profile: SajuProfile | null): string | null {
  if (!profile) return null;
  const [y, m, d] = profile.birthdate.split("-").map(Number);
  if (!y || !m || !d) return null;
  return chartSummary(
    computeSaju({ year: y, month: m, day: d, hour: profile.birthTimeUnknown ? null : profile.birthHour })
  );
}

/*
  명식이 없는 경우의 문구는 이제 거의 쓰이지 않는다.

  /api/question 이 프로필 없는 질문을 차감 전에 막기 때문이다(2026-08-30).
  그래도 자리는 남긴다 — 프로필을 못 읽는 장애 때 여기까지 올 수 있고,
  그때 빈 문자열을 넣으면 모델이 명식을 지어낸다.

  전에는 "사주를 입력하면 더 정확히 볼 수 있다고 안내하세요" 였다. 그런데
  사주만 따로 입력하는 화면이 이 서비스에 없다 — 리딩 폼이 유일한 입구다.
  따라갈 곳 없는 안내를 시키는 문장이라 걷었다.
*/
export function questionSystemPrompt(ctx: QuestionContext): string {
  const me = myChartSummary(ctx.profile);
  const readings = ctx.readings
    .map((r, i) => {
      const label = PRODUCT_MAP[r.category]?.title ?? r.category;
      const partner = r.chart.partner ? ` · 상대 ${r.chart.partner}` : "";
      return `[리딩 ${i + 1} · ${label}${partner}]\n${r.full.slice(0, READING_EXCERPT)}`;
    })
    .join("\n\n");

  return `당신은 러브레빗의 수석 명리 분석가입니다. 회원이 러빗을 내고 오늘의 질문 하나를 합니다.

[회원 명식]
${me ?? "저장된 사주 정보가 없습니다. 명식 없이 일반적인 흐름만 말하세요."}

[회원이 이미 받은 리딩]
${readings || "아직 받은 리딩이 없습니다."}

[답변 규칙]
- 차분한 해요체. 4~8문장. 점집 화술·호들갑 금지.
- 위 명식과 리딩 전문 안에서만 말합니다. 거기 없는 십성·신살·대운·날짜·점수를 새로 만들지 않습니다.
- 상대에 관해서는 리딩 전문에 이미 적힌 범위까지만. 상대 생년월일을 묻거나 새로 계산하지 않습니다.
- 단정 금지: "반드시·무조건·틀림없이·100%·확정·운명이다·재회한다·헤어진다" 같은 결과 선언을 쓰지 않습니다. 흐름과 경향으로 말합니다.
- 의료·법률·투자 판단은 명리의 범위 밖임을 밝히고 선을 긋습니다.
- 질문이 다른 리딩 주제로 넘어가면 답 끝에 그 리딩을 한 문장으로만 안내해도 됩니다 (강매 금지).`;
}

export async function answerQuestion(question: string, ctx: QuestionContext): Promise<QuestionOutcome | null> {
  const system = questionSystemPrompt(ctx);
  const first = await chatComplete(system, [{ role: "user", content: question }], 900, { thinking: false });
  if (!first) return null;
  let text = first.text.trim();
  let retried = false;
  const hits = violations(text);
  if (hits.length > 0) {
    retried = true;
    const again = await chatComplete(
      system,
      [
        { role: "user", content: question },
        { role: "assistant", content: text },
        { role: "user", content: `방금 답에 금지 표현이 있어요 (${hits.join(", ")}). 같은 내용을 단정 없이, 흐름과 경향으로 다시 써 주세요.` },
      ],
      900,
      { thinking: false }
    );
    if (!again) return null;
    text = again.text.trim();
    if (violations(text).length > 0) {
      throw new Error("QUESTION_GUARD_FAILED");
    }
  }
  return { answer: text, provider: first.provider, retried };
}
