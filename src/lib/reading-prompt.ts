// 사주 리포트 생성 계약 — 프롬프트, 입력 JSON, 출력 스키마, 파서.
//
// 역할 분리가 이 파일의 존재 이유다.
//   계산(saju.ts) -> 규칙(saju-facts.ts) -> [여기: 문장 번역] -> 렌더링
// AI는 saju_facts에 있는 값만 근거로 쓰고, 명리 사실을 새로 만들지 않는다.

import type { SajuFacts } from "@/lib/saju-facts";
import { rulesForPrompt, type ReadingRule } from "@/lib/reading-rules";

export interface ReportSectionOut {
  id: string; // core | relationship | work | timing
  navLabel: string;
  title: string;
  summary: string;
  paragraphs: string[];
  factsUsed: string[];
  /** 이 절이 근거로 삼은 검수 규칙 id */
  ruleIds: string[];
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
- matched_rules는 이 명식에서 검수를 통과한 해석 목록이다. 해석의 뼈대는 여기서만 가져온다.
  각 규칙의 narrative_claim을 관계 장면으로 번역하고, safe_phrasing의 어법으로 감싼다.
  forbidden_claims에 적힌 말은 어떤 방식으로도 쓰지 않는다.
- matched_rules에 없는 명리 판단을 새로 세우지 않는다. 다만 계산값(시기, 글자, 개수)을
  그대로 인용하는 것은 언제나 허용된다.
- saju_facts에 없는 사실(일주론, 계산되지 않은 대운)은 만들어내지 않는다.
- 신살은 saju_facts.shinsal에 계산되어 있다. 거기 있는 것만 이름과 자리를 그대로 쓰고,
  목록에 없는 신살은 언급하지 않는다. 자리를 옮기거나 개수를 바꾸지 않는다.
- 사실에 기댄 문장은 마음껏 쓰되, facts_used 배열에는 **그 절의 판단을 떠받치는
  결정적인 근거 3개만** 남긴다. 나열이 길수록 독자는 덜 읽는다.
  내 명식은 경로를 그대로, 상대 명식은 앞에 "상대."를 붙여 짧게 적는다.
  (예: "strength.label=신약", "luckContext.yearly.tenGod=정인", "상대.shinsal=홍염=일지")
  facts_used에는 saju_facts와 partner_saju_facts의 계산값만 적는다. user_context나
  delivery는 근거가 아니다 — 사용자가 쓴 고민을 근거로 되돌려주지 않는다.
- 시기를 말할 때는 반드시 luckContext(대운·세운·월운)에서 출발한다. 근거 없는 달을 지어내지 않는다.
- saju_facts.limits에 시각 미상 같은 계산 한계가 적혀 있으면 confidence_note에 반영한다.

# LIMITS
- 의료·법률·재무는 판정하지 않는다. 진단명, 법적 판단, 투자·대출 지시를 쓰지 않는다.
- 자해나 위기 신호가 읽히면 그 대목에서는 점을 풀지 말고, 사람에게 도움을 청하라고 짧게 권한다.
- 불안이나 죄책감을 키워 결제를 재촉하지 않는다. 결제·서비스·화면을 언급하지 않는다.

# OUTPUT CONTRACT
- JSON 객체 하나만 출력한다. 코드펜스, 설명 문장, 마크다운을 덧붙이지 않는다.
- **모든 문장은 예외 없이 해요체로 끝낸다.** 이건 브랜드 목소리라 어기면 폐기된다.
  합쇼체(-습니다/-입니다/-합니다/-됩니다)로 끝난 문장이 하나라도 있으면 안 된다.
  가집니다→가져요, 보입니다→보여요, 있습니다→있어요, 없습니다→없어요,
  됩니다→돼요, 합니다→해요, 만듭니다→만들어요, 짚어냅니다→짚어내요,
  이었습니다→이었어요, 그렇습니다→그래요, 아닙니다→아니에요, 드립니다→드려요.
  문어체 종결(-이다/-한다/-지요/-랍니다)도 쓰지 않는다.
- facts_used는 "경로=값" 꼴로 **정확히 3개**. 경로만 적지 않는다.
  상대 명식은 "partner_saju_facts." 대신 "상대."로 줄여 적는다.
  (예: "strength.label=신약", "상대.luckContext.yearly.tenGod=편재")
- 어떤 규칙을 썼는지는 facts_used가 아니라 rule_ids에 적는다.
- 목차 제목에 '반드시' 같은 단정 표현이 들어 있어도 본문으로 옮기지 않는다.
  제목은 상품 문구라 그대로 쓰지만, 네가 쓰는 문장에는 반드시·무조건·틀림없이·100%를
  쓰지 않는다. '특히', '주로', '이 지점에서' 처럼 단정하지 않는 말로 바꾼다.

## 지시가 "머리"일 때
{"report_meta":{"headline":"string","confidence_note":"string"},
"summary_cards":[{"label":"나의 중심","value":"string","detail":"string","facts_used":["string"]},{"label":"관계의 결","value":"string","detail":"string","facts_used":["string"]},{"label":"지금의 흐름","value":"string","detail":"string","facts_used":["string"]}],
"action_questions":[{"question":"string","why_it_matters":"string"},{"question":"string","why_it_matters":"string"},{"question":"string","why_it_matters":"string"}],
"character_note":{"character_id":"string","name":"string","message":"string"},
"next_step":{"label":"string","description":"string","recommended_focus":"relationship|work|timing"}}

- summary_cards는 정확히 3개, label은 위의 것을 그대로 쓴다.
- action_questions는 정확히 3개. 리포트를 다 읽은 사람이 오늘 해볼 수 있는 것으로 쓴다.
- headline 42~65자. 계산값에 근거한 판단을 담는다.
- character_note.message는 2문장 이하. sections는 만들지 않는다.

## 지시가 "본문"일 때
{"sections":[{"n":1,"summary":"string","paragraphs":["string","string"],"facts_used":["string"],"rule_ids":["string"],"watch_out":"string"}]}

- sections 길이는 지시받은 항목 수와 정확히 같다. 합치거나 건너뛰지 않는다.
- n은 지시에 붙은 항목 번호를 그대로 적는다. 제목은 다시 적지 않는다 — 서버가 붙인다.
- summary는 280~360자. 판단과 그 근거를 여기서 끝낸다. 짧게 끝내면 그 리포트는 폐기된다.
- paragraphs는 2개, 각 100~150자. 요약에서 한 말을 다시 설명하지 않는다.
  첫 문단은 그 판단이 **실제 장면에서 어떻게 보이는지**, 둘째 문단은 **지금 할 일**을 쓴다.
`;

export interface ReadingInput {
  facts: SajuFacts;
  partnerFacts: SajuFacts | null;
  /** 이 명식에서 켜진 검수 규칙 — 해석의 뼈대가 된다 */
  matchedRules: ReadingRule[];
  productLabel: string;
  outline: string[];
  focus: string;
  currentScene: string;
  characterId: string | null;
  characterName: string | null;
  now: Date;
}

/**
 * 계산 결과에서 모델이 실제로 인용하는 것만 남긴다.
 *
 * 원본 SajuFacts를 그대로 실으면 한 리딩에 입력 6만 자가 나간다 — 조각마다
 * 같은 명식을 다시 보내기 때문에 낭비가 조각 수만큼 곱해진다. 여기서 줄이는
 * 한 글자는 요청 수만큼 줄어든다.
 *
 * 지우는 것: 들여쓰기, 매번 같은 계산 주석, 신살 유도 과정.
 * 남기는 것: 근거로 인용될 수 있는 값 전부. facts_used의 경로가 바뀌지 않도록
 * 키 이름은 그대로 둔다.
 */
function slimFacts(facts: SajuFacts) {
  const pillar = (p: { stem: string; branch: string } | null) => (p ? `${p.stem}${p.branch}` : null);
  return {
    gender: facts.gender,
    fourPillars: {
      year: pillar(facts.fourPillars.year),
      month: pillar(facts.fourPillars.month),
      day: pillar(facts.fourPillars.day),
      hour: pillar(facts.fourPillars.hour),
    },
    dayMaster: facts.dayMaster,
    dayMasterElement: facts.dayMasterElement,
    elementBalance: facts.elementBalance,
    missingElements: facts.missingElements,
    strength: facts.strength,
    // 배열 7개를 자리별 한 줄로 접는다. "tenGods.일지" 경로는 그대로 살아 있다.
    tenGods: Object.fromEntries(facts.tenGods.map((t) => [t.position, `${t.character} ${t.tenGod}`])),
    dominantTenGods: facts.dominantTenGods,
    notableRelations: facts.notableRelations.map((r) => r.label),
    // basis(유도 과정)는 빼고 이름과 자리만 남긴다. 모델이 인용하는 것은 그 둘뿐이다.
    shinsal: facts.shinsal.map((f) => `${f.name}=${f.positions.join(",")}`),
    luckContext: facts.luckContext,
    // 매번 같은 계산 주석(표준시·진태양시·절기)은 뺀다. confidence_note에 반영해야 할
    // 한계(시각 미상, 음력 변환)만 남긴다.
    limits: facts.calculationNotes.filter((n) => LIMIT_NOTE.test(n)),
  };
}

/** confidence_note에 반영해야 할 한계만 골라내는 표시 */
const LIMIT_NOTE = /(미상|모름|음력|추정|불명)/;

/** 모델에 넘길 입력 JSON — 계산 결과와 사용자 맥락만 담는다 */
export function buildReadingInput(input: ReadingInput): string {
  const payload = {
    saju_facts: slimFacts(input.facts),
    partner_saju_facts: input.partnerFacts ? slimFacts(input.partnerFacts) : null,
    matched_rules: rulesForPrompt(input.matchedRules),
    user_context: {
      focus: input.focus,
      current_scene: input.currentScene || null,
      today: `${input.now.getFullYear()}-${String(input.now.getMonth() + 1).padStart(2, "0")}`,
    },
    delivery: {
      report_type: input.productLabel,
      character_name: input.characterName,
    },
  };
  // 들여쓰기를 빼면 같은 내용이 3분의 2 크기가 된다. 모델은 압축 JSON도 그대로 읽는다.
  return JSON.stringify(payload);
}

type RawSection = {
  id?: string;
  nav_label?: string;
  title?: string;
  summary?: string;
  paragraphs?: unknown;
  facts_used?: unknown;
  rule_ids?: unknown;
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
        // title과 reading_time_min은 화면 어디에도 쓰이지 않는다. 모델에게 시키지 않고
        // 여기서 채운다 — 출력 토큰이 곧 비용이라, 안 읽는 글자를 사지 않는다.
        title: typeof meta.title === "string" ? meta.title : "",
        headline: typeof meta.headline === "string" ? meta.headline : "",
        readingTimeMin: typeof meta.reading_time_min === "number" ? meta.reading_time_min : 6,
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
          ruleIds: asStringArray(section.rule_ids),
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
