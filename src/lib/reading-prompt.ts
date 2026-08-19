// 사주 리포트 생성 계약 — 프롬프트, 입력 JSON, 출력 스키마, 파서.
//
// 역할 분리가 이 파일의 존재 이유다.
//   계산(saju.ts) -> 규칙(saju-facts.ts) -> [여기: 문장 번역] -> 렌더링
// AI는 saju_facts에 있는 값만 근거로 쓰고, 명리 사실을 새로 만들지 않는다.

import type { SajuFacts } from "@/lib/saju-facts";

export interface ReportSectionOut {
  id: string; // core | relationship | work | timing
  navLabel: string;
  title: string;
  summary: string;
  paragraphs: string[];
  factsUsed: string[];
  watchOut?: string;
}

export interface SummaryCardOut {
  label: string;
  value: string;
  detail: string;
  factsUsed: string[];
}

export interface ActionQuestionOut {
  question: string;
  whyItMatters: string;
}

export interface StructuredReport {
  meta: {
    title: string;
    headline: string;
    readingTimeMin: number;
    disclaimer: string;
    confidenceNote: string;
  };
  summaryCards: SummaryCardOut[];
  sections: ReportSectionOut[];
  actionQuestions: ActionQuestionOut[];
  characterNote: { characterId: string; name: string; message: string } | null;
  nextStep: { label: string; description: string; recommendedFocus: string } | null;
}

export const READING_SYSTEM_PROMPT = `# ROLE
너는 러브레빗의 '사주 리포트 에디터'다.
너는 계산기가 아니다. 입력 JSON의 saju_facts에 있는 값만 근거로 사용하며,
그 구조를 사용자가 이해할 수 있는 한국어 리포트로 번역한다.

# BRAND VOICE
- 정갈하고, 은밀하고, 다정하다. 해요체로 쓴다.
- 명리를 읽어주는 사람의 확신을 갖고 쓴다. 애매한 유보로 도망치지 않는다.
  판단은 분명하게 내리고, 그 판단이 명식의 어디에서 나왔는지 함께 말한다.
- 사주 용어는 처음 한 번만 짧게 괄호로 풀어주고, 이후에는 생활 언어로 바꾼다.
  (예: '관성(규칙과 책임을 대하는 방식)' -> 이후에는 '규칙을 대하는 방식')
- 칭찬만 나열하지 않는다. 강점과 흔들릴 때의 패턴을 함께 다룬다.
- 한 섹션에는 하나의 핵심 메시지만 둔다.
- 각 섹션은 이 호흡을 지킨다: 근거가 되는 구조를 한 번 말하고, 생활 속 모습을 한 번 보여준 뒤, 지금 할 수 있는 것으로 닫는다.
- 한 문단은 2~3문장, 한 문장은 35~65자 안팎으로 쓴다.

# WHAT THE READER PAID FOR
- 구체적인 시기를 짚는다. 대운·세운·월운을 근거로 몇 월 구간이 어떤 성격인지 분명히 말한다.
- 상대의 마음과 태도를 읽어준다. 상대 명식이 주어졌다면 그 사람이 지금 어떤 상태인지 명식 근거와 함께 말한다.
- 결론을 미루지 않는다. 가능성이 높은지 낮은지, 지금이 움직일 때인지 기다릴 때인지 답한다.
- 행동 가이드는 실행할 수 있는 문장으로 쓴다. '어떻게 해야 할지 생각해 보세요' 같은 빈 조언을 쓰지 않는다.

# EVIDENCE POLICY
- saju_facts에 없는 사실(일주론, 계산되지 않은 대운)은 만들어내지 않는다.
- 신살은 saju_facts.shinsal에 계산되어 있다. 거기 있는 것만 이름과 자리를 그대로 쓰고,
  목록에 없는 신살은 언급하지 않는다. 자리를 옮기거나 개수를 바꾸지 않는다.
- 사실에 기댄 문장을 쓸 때마다 그 섹션의 facts_used 배열에 근거를 남긴다.
  (예: "strength.label=신약", "elementBalance.수=0", "luckContext.yearly.tenGod=정인")
- 시기를 말할 때는 반드시 luckContext(대운·세운·월운)에서 출발한다. 근거 없는 달을 지어내지 않는다.
- 계산 노트(calculation_notes)에 시각 미상 같은 한계가 있으면 confidence_note에 반영한다.

# LIMITS
- 의료·법률·재무는 판정하지 않는다. 진단명, 법적 판단, 투자·대출 지시를 쓰지 않는다.
- 자해나 위기 신호가 읽히면 그 대목에서는 점을 풀지 말고, 사람에게 도움을 청하라고 짧게 권한다.
- 불안이나 죄책감을 키워 결제를 재촉하지 않는다. 결제·서비스·화면을 언급하지 않는다.

# OUTPUT CONTRACT
- 반드시 지정 JSON 하나만 출력한다. JSON 밖에 설명 문장, 마크다운, 코드펜스를 덧붙이지 않는다.
- headline 42~65자, 각 section.summary 280~650자, section.paragraphs는 2~3개, action_questions는 정확히 3개.
- character_note.message는 2문장 이하.`;

export interface ReadingInput {
  facts: SajuFacts;
  partnerFacts: SajuFacts | null;
  productLabel: string;
  outline: string[];
  focus: string;
  currentScene: string;
  characterId: string | null;
  characterName: string | null;
  now: Date;
}

/** 모델에 넘길 입력 JSON — 계산 결과와 사용자 맥락만 담는다 */
export function buildReadingInput(input: ReadingInput): string {
  const payload = {
    subject: {
      birth_calendar: "solar",
      birth_timezone: "Asia/Seoul",
      privacy_mode: "alias_only",
    },
    saju_facts: input.facts,
    partner_saju_facts: input.partnerFacts,
    user_context: {
      focus: input.focus,
      current_scene: input.currentScene || null,
      desired_depth: "full",
      today: `${input.now.getFullYear()}-${String(input.now.getMonth() + 1).padStart(2, "0")}`,
    },
    delivery: {
      report_type: input.productLabel,
      outline: input.outline,
      character: input.characterId,
      character_name: input.characterName,
      tone: "calm_editorial",
    },
  };
  return JSON.stringify(payload, null, 2);
}

export function buildReadingUserPrompt(inputJson: string): string {
  return `입력 JSON을 사용해 report_type에 맞는 러브레빗 사주 리포트를 작성해.

우선순위는 다음과 같아.
1. 계산 데이터와 facts_used의 정합성
2. 사용자의 current_scene에 대한 구체적인 답 — 시기와 결론을 분명히 짚는다
3. delivery.outline의 순서와 개수를 그대로 따른 sections 구성
4. 읽기 쉬운 문장과 해요체

출력 JSON 스키마:
{
  "report_meta": {
    "title": "string",
    "headline": "string",
    "reading_time_min": 3,
    "disclaimer": "string",
    "confidence_note": "string"
  },
  "summary_cards": [
    {"label": "나의 중심", "value": "string", "detail": "string", "facts_used": ["string"]},
    {"label": "관계의 결", "value": "string", "detail": "string", "facts_used": ["string"]},
    {"label": "지금의 흐름", "value": "string", "detail": "string", "facts_used": ["string"]}
  ],
  "sections": [
    {
      "id": "core|relationship|work|timing",
      "nav_label": "string",
      "title": "string",
      "summary": "string",
      "paragraphs": ["string", "string"],
      "facts_used": ["string"],
      "watch_out": "string"
    }
  ],
  "action_questions": [
    {"question": "지금 확인하거나 실행할 것 한 가지", "why_it_matters": "그게 왜 지금인지 명식 근거로"}
  ],
  "character_note": {
    "character_id": "string",
    "name": "string",
    "message": "string"
  },
  "next_step": {
    "label": "string",
    "description": "string",
    "recommended_focus": "relationship|work|timing"
  }
}

sections는 delivery.outline의 각 항목마다 하나씩, 같은 순서로 만든다. title은 outline 문구를 그대로 쓰거나 다듬어 쓴다.

입력 JSON:
${inputJson}`;
}

type RawSection = {
  id?: string;
  nav_label?: string;
  title?: string;
  summary?: string;
  paragraphs?: unknown;
  facts_used?: unknown;
  watch_out?: string;
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : [];
}

/**
 * 모델 응답에서 JSON을 꺼낸다. 코드펜스나 앞뒤 잡음이 붙어 나오는 경우가 있어
 * 첫 중괄호부터 마지막 중괄호까지를 잘라 한 번 더 시도한다.
 */
export function parseStructuredReport(text: string): StructuredReport | null {
  const attempts = [text.trim()];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) attempts.push(fenced[1].trim());
  const braced = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (braced.length > 2) attempts.push(braced);

  for (const candidate of attempts) {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      continue;
    }
    const meta = (raw.report_meta ?? {}) as Record<string, unknown>;
    const sections = Array.isArray(raw.sections) ? (raw.sections as RawSection[]) : [];
    if (sections.length === 0) continue;

    const character = raw.character_note as Record<string, unknown> | undefined;
    const next = raw.next_step as Record<string, unknown> | undefined;

    return {
      meta: {
        title: typeof meta.title === "string" ? meta.title : "",
        headline: typeof meta.headline === "string" ? meta.headline : "",
        readingTimeMin: typeof meta.reading_time_min === "number" ? meta.reading_time_min : 3,
        disclaimer:
          typeof meta.disclaimer === "string" && meta.disclaimer.trim()
            ? meta.disclaimer
            : "오락 및 자기성찰을 위한 참고 해석이에요.",
        confidenceNote: typeof meta.confidence_note === "string" ? meta.confidence_note : "",
      },
      summaryCards: (Array.isArray(raw.summary_cards) ? raw.summary_cards : [])
        .map((card) => card as Record<string, unknown>)
        .filter((card) => typeof card.label === "string" && typeof card.value === "string")
        .map((card) => ({
          label: card.label as string,
          value: card.value as string,
          detail: typeof card.detail === "string" ? card.detail : "",
          factsUsed: asStringArray(card.facts_used),
        })),
      sections: sections
        .filter((section) => typeof section.title === "string" && section.title.trim())
        .map((section) => ({
          id: typeof section.id === "string" ? section.id : "core",
          navLabel: typeof section.nav_label === "string" && section.nav_label.trim() ? section.nav_label : (section.title as string),
          title: section.title as string,
          summary: typeof section.summary === "string" ? section.summary : "",
          paragraphs: asStringArray(section.paragraphs),
          factsUsed: asStringArray(section.facts_used),
          watchOut: typeof section.watch_out === "string" ? section.watch_out : undefined,
        })),
      actionQuestions: (Array.isArray(raw.action_questions) ? raw.action_questions : [])
        .map((item) => item as Record<string, unknown>)
        .filter((item) => typeof item.question === "string")
        .map((item) => ({
          question: item.question as string,
          whyItMatters: typeof item.why_it_matters === "string" ? item.why_it_matters : "",
        }))
        .slice(0, 3),
      characterNote:
        character && typeof character.message === "string"
          ? {
              characterId: typeof character.character_id === "string" ? character.character_id : "",
              name: typeof character.name === "string" ? character.name : "",
              message: character.message,
            }
          : null,
      nextStep:
        next && typeof next.label === "string"
          ? {
              label: next.label,
              description: typeof next.description === "string" ? next.description : "",
              recommendedFocus: typeof next.recommended_focus === "string" ? next.recommended_focus : "relationship",
            }
          : null,
    };
  }
  return null;
}

/**
 * 구조화 리포트를 기존 저장 형식(티저 + 본문 텍스트)으로 옮긴다.
 * 결제·보관함·추가 상담이 모두 이 텍스트를 쓰고 있어, 구조가 바뀌어도 뒤가 깨지지 않게 한다.
 */
export function reportToText(report: StructuredReport): { teaser: string; full: string } {
  const teaser = [
    report.meta.headline,
    report.summaryCards.map((card) => `${card.label}: ${card.value}`).join(" / "),
    report.summaryCards[0]?.detail ?? "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 600);

  const body = report.sections
    .map((section) => {
      const lines = [`■ ${section.title}`, section.summary, ...section.paragraphs];
      if (section.watchOut) lines.push(`살펴볼 점: ${section.watchOut}`);
      return lines.filter(Boolean).join("\n");
    })
    .join("\n\n");

  const questions = report.actionQuestions.length
    ? `\n\n■ 스스로 확인할 세 가지\n${report.actionQuestions.map((q, i) => `${i + 1}. ${q.question} — ${q.whyItMatters}`).join("\n")}`
    : "";
  const note = report.characterNote ? `\n\n■ ${report.characterNote.name}의 한마디\n${report.characterNote.message}` : "";

  return { teaser, full: `${body}${questions}${note}`.trim() };
}
