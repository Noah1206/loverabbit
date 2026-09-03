// 오늘의 액션 AI 개인화 — 표 문구를 "내 얘기"로 다시 쓴다.
//
// 절대 규칙은 여기서도 산다: AI 는 아래 approvedFacts 에 적힌 사실 밖의
// 명리 주장을 만들 수 없고, 결과 예언("돈이 들어온다")은 방향 서술("가진
// 것을 헤아리기 좋다")로만 쓴다. 어기면 문장을 버리고 표 문구로 돌아간다 —
// 표 문구는 이미 사람이 승인한 안전한 바닥이다.
//
// 숫자는 AI 에게 맡기지 않는다 — durationMinutes 등 수치는 표 값 그대로.

import { chatComplete } from "@/lib/ai";
import type { Flow, FortuneDomain } from "@/lib/daily-action";
import { DOMAIN_LABEL } from "@/lib/daily-action";
import type { SajuProfileView } from "@/lib/saju-profile";

export interface PersonalizeFacts {
  today: string;
  dayGanji: string;
  dayMaster: string;
  flow: Flow;
  /** 오방기를 뽑았으면 그 오행과 관계 서술, 아니면 null */
  pickedOhaeng: string | null;
  relationLabel: string;
  domain: FortuneDomain;
  /** 표에서 나온 승인 문구 — AI 의 바닥이자 폴백 */
  base: { action: string; reason: string; avoidAction: string; rabbitLine: string };
  /** 내 명식 수치 (성별 없으면 null) */
  me: SajuProfileView | null;
}

export interface PersonalizedText {
  action: string;
  reason: string;
  avoidAction: string;
  rabbitLine: string;
}

/** 결과 예언·단정 표현 — 하나라도 있으면 그 생성물은 버린다 */
const BANNED = /들어온다|들어올|생긴다|당첨|횡재|대박|무조건|반드시|100\s*%|이뤄진다|합격한다|성공한다|틀림없|확실히 좋아진다/;

function clean(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s+/g, " ");
  if (!s || s.length > max || BANNED.test(s)) return null;
  return s;
}

const SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string" },
    reason: { type: "string" },
    avoidAction: { type: "string" },
    rabbitLine: { type: "string" },
  },
  required: ["action", "reason", "avoidAction", "rabbitLine"],
  additionalProperties: false,
};

/**
 * 한 사람의 오늘 문구 넷을 쓴다. AI 가 없거나(키 없음) 실패하거나 검사에
 * 걸리면 null — 호출부는 표 문구를 그대로 쓴다. 절대 throw 하지 않는다.
 */
export async function personalizeDailyAction(facts: PersonalizeFacts): Promise<PersonalizedText | null> {
  const meLines = facts.me
    ? [
        `- 오행 분포: ${facts.me.elements.map((e) => `${e.ohaeng} ${e.count}(${e.tilt})`).join(", ")}`,
        `- 강약: ${facts.me.strength.label} (${facts.me.strength.score}/100)`,
      ]
    : [];

  const system = [
    "너는 한국 사주 앱 '러브레빗'의 토끼 캐릭터다. 아래 [승인된 사실]만으로 오늘의 행동 문구를 쓴다.",
    "",
    "절대 규칙:",
    "1. [승인된 사실]에 없는 명리 주장·수치·날짜·간지를 만들지 않는다.",
    "2. 결과를 예언하지 않는다. '돈이 들어온다' 금지, '가진 것을 헤아리기 좋다'처럼 방향만 말한다.",
    "3. [바닥 문구]와 같은 뜻을 지키되, 이 사람의 오행 분포·강약을 자연스럽게 한 번 녹여 '내 얘기'로 들리게 다시 쓴다.",
    "4. 말투는 바닥 문구와 같은 짧은 반말. 한 필드당 문장 1~2개.",
    "5. JSON 만 출력한다: {\"action\",\"reason\",\"avoidAction\",\"rabbitLine\"}",
  ].join("\n");

  const user = [
    "[승인된 사실]",
    `- 오늘: ${facts.today}, 일진 ${facts.dayGanji}`,
    `- 내 일간: ${facts.dayMaster} (오늘의 흐름: ${facts.flow})`,
    facts.pickedOhaeng ? `- 뽑은 오방기: ${facts.pickedOhaeng} — ${facts.relationLabel}` : `- 관계: ${facts.relationLabel}`,
    `- 영역: ${DOMAIN_LABEL[facts.domain]}`,
    ...meLines,
    "",
    "[바닥 문구]",
    `- action: ${facts.base.action}`,
    `- reason: ${facts.base.reason}`,
    `- avoidAction: ${facts.base.avoidAction}`,
    `- rabbitLine: ${facts.base.rabbitLine}`,
  ].join("\n");

  try {
    const res = await chatComplete(system, [{ role: "user", content: user }], 700, {
      json: true,
      jsonSchema: SCHEMA,
      thinking: false,
    });
    if (!res?.text) return null;
    const raw = JSON.parse(res.text.replace(/^```(?:json)?|```$/g, "").trim()) as Record<string, unknown>;
    const action = clean(raw.action, 80);
    const reason = clean(raw.reason, 160);
    const avoidAction = clean(raw.avoidAction, 120);
    const rabbitLine = clean(raw.rabbitLine, 80);
    if (!action || !reason || !avoidAction || !rabbitLine) return null;
    return { action, reason, avoidAction, rabbitLine };
  } catch (error) {
    console.error("오늘의 액션 개인화 실패 (표 문구로 폴백):", error);
    return null;
  }
}
