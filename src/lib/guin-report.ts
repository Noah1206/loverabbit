// 귀인 지도 — AI 관계 리포트 (guin-v3, 지시문 9).
//
// AI 는 사주 계산기도 점수 계산기도 아니다. 서버가 이미 계산한 축·역할·케미와
// 참여자가 고른 관계 상태를 사용자 언어로 편집할 뿐이다. 그래서:
//   - 입력에 생년월일·원국은 없다. 파생 점수와 별명만 간다.
//   - 출력은 JSON 하나. 여기 있는 검증을 통과하지 못하면 버린다 —
//     화면의 결정론 템플릿 카드가 곧 폴백이라 따로 만들 폴백이 없다.
//   - 상태(썸·갈등 중 …)는 해석의 초점만 바꾼다. 축 점수는 이 파일에 아예 없다.

import { chatComplete } from "@/lib/ai";
import {
  AXIS_LABEL,
  GUIN_DISCLAIMER,
  STATUS_LABEL,
  axisKeysOf,
  type GuinAiReport,
  type GuinNodeView,
  type GuinRelStatus,
} from "@/lib/guin-map";

export const GUIN_REPORT_VERSION = "guin-report-v1";

// ── 관계 상태 → 해석 지시 (지시문 8.2) ────────────────────

interface ContextInstruction {
  focus: string;
  avoid: string[];
  suggestedAction: string;
}

const CONTEXT_INSTRUCTIONS: Record<GuinRelStatus, ContextInstruction> = {
  crush: {
    focus: "호감과 기대의 차이, 부담 없는 소통",
    avoid: ["상대의 마음을 확정하지 않기", "고백을 단정적으로 권하지 않기"],
    suggestedAction: "상대의 반응을 확인할 수 있는 가벼운 대화 질문 제안",
  },
  dating: {
    focus: "관계 속도와 대화 방식, 강점 유지",
    avoid: ["관계를 반드시 정의하라고 압박하지 않기", "헤어짐이나 결혼을 단정하지 않기"],
    suggestedAction: "서로의 기대를 확인하는 대화 제안",
  },
  conflict: {
    focus: "갈등의 작동 방식과 회복 대화",
    avoid: ["누가 옳은지 판정하지 않기", "상대방을 악인으로 규정하지 않기"],
    suggestedAction: "감정과 요구를 분리해 말하는 대화 문장 제안",
  },
  no_contact: {
    focus: "거리감과 사용자의 감정 정리",
    avoid: ["연락 시기나 재회를 보장하지 않기"],
    suggestedAction: "연락 전 자신의 목적을 확인하는 질문 제안",
  },
  reunion: {
    focus: "재회 후 반복 패턴과 새로운 약속",
    avoid: ["재회를 무조건 긍정하거나 부정하지 않기"],
    suggestedAction: "다시 시작하기 전에 달라져야 할 한 가지 확인",
  },
  friend: {
    focus: "관계의 강점과 현실적인 소통 방식",
    avoid: ["단정 표현"],
    suggestedAction: "관계를 이해하는 구체적인 질문 제안",
  },
  family: {
    focus: "오래된 관계에서 반복되는 패턴과 소통 방식",
    avoid: ["가족 관계의 옳고 그름을 판정하지 않기"],
    suggestedAction: "서로의 방식을 이해하는 질문 제안",
  },
  coworker: {
    focus: "협업 방식과 현실적인 도움의 교환",
    avoid: ["업무 능력을 평가하지 않기"],
    suggestedAction: "협업이 편해지는 대화 방식 제안",
  },
  unclear: {
    focus: "관계의 강점과 현실적인 소통 방식",
    avoid: ["단정 표현"],
    suggestedAction: "관계를 이해하는 구체적인 질문 제안",
  },
};

export function contextInstructionOf(status: GuinRelStatus | null): ContextInstruction {
  return CONTEXT_INSTRUCTIONS[status ?? "unclear"];
}

// ── 금지 표현 (지시문 9.1) ────────────────────────────────
//
// 계산이 만드는 문구는 템플릿이라 애초에 이런 말이 없다. 이 목록은 AI 출력
// 전용 그물이다 — 하나라도 걸리면 리포트 전체를 버리고 템플릿으로 간다.

export const GUIN_REPORT_FORBIDDEN = [
  "운명",
  "반드시",
  "절대",
  "무조건",
  "최악",
  "나쁜 사람",
  "헤어지세요",
  "헤어져야",
  "이별해야",
  "차단",
] as const;

// ── 프롬프트 ──────────────────────────────────────────────

const SYSTEM = `당신은 러브레빗의 관계 리딩 편집자입니다.
서버가 계산한 관계 축 점수·역할과 사용자가 고른 실제 관계 상태를 바탕으로,
따뜻하고 구체적이며 과장되지 않은 한국어 관계 리포트를 작성합니다.

절대 하지 말 것:
1. 생년월일이나 사주를 새로 계산하지 마세요. 입력 JSON에 없는 사실을 만들지 마세요.
2. 점수·역할·축 이름을 바꾸거나 새 점수를 만들지 마세요.
3. 상대방의 마음을 확정하거나 독심술처럼 표현하지 마세요.
4. 운명·반드시·절대·무조건·최악·나쁜 사람 같은 단정 표현을 쓰지 마세요.
5. 이별·결혼·고백·연락 여부를 명령하거나 보장하지 마세요.
6. 의료·법률·재무 판단으로 확장하지 마세요.

작성 원칙:
1. 사주 구조는 기본 성향으로, 관계 상태는 현재 상황으로 구분해 쓰세요.
2. 관계 방향(누가 누구에게 어떤 역할인가)을 혼동하지 마세요.
3. 강점 2개와 주의점 1개를 균형 있게, 시도할 수 있는 대화 질문 1개를 제안하세요.
4. 상태가 사주 점수를 바꾼 것처럼 말하지 마세요.

반드시 JSON 객체 하나만 반환하세요. 다른 텍스트를 붙이지 마세요.`;

/** OpenAI 계열에 실을 스키마 — 키 이름까지 못 박는다 (ai.ts jsonSchema 참고). */
const REPORT_SCHEMA = {
  name: "guin_relationship_report",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "summary",
      "roleExplanation",
      "strengths",
      "caution",
      "currentContext",
      "suggestedAction",
      "conversationPrompt",
      "disclaimer",
    ],
    properties: {
      summary: { type: "string", maxLength: 180 },
      roleExplanation: { type: "string", maxLength: 220 },
      strengths: { type: "array", minItems: 2, maxItems: 2, items: { type: "string", maxLength: 100 } },
      caution: { type: "string", maxLength: 180 },
      currentContext: { type: "string", maxLength: 240 },
      suggestedAction: { type: "string", maxLength: 180 },
      conversationPrompt: { type: "string", maxLength: 120 },
      disclaimer: { type: "string", maxLength: 140 },
    },
  },
} as const;

export interface GuinReportInput {
  ownerNickname: string;
  participantNickname: string;
  /** 정방향 — 주인의 관계 세계에서 참여자가 어떤 역할인가 */
  node: GuinNodeView;
  status: GuinRelStatus | null;
  /** 참여자가 남긴 선택 입력 (봉인을 연 평문). 로그로 내보내지 마라. */
  userNote?: string | null;
}

export function buildGuinReportPrompt(input: GuinReportInput): { system: string; user: string } {
  const { node } = input;
  const axes = Object.fromEntries(axisKeysOf(node.axes).map((key) => [AXIS_LABEL[key], node.axes![key]]));
  const payload = {
    owner: { nickname: input.ownerNickname },
    participant: { nickname: input.participantNickname },
    direction: {
      설명: `${input.ownerNickname}의 관계 세계에서 ${input.participantNickname}이(가) 하는 역할`,
      role: node.roleLabel,
      roleTagline: node.roleTagline,
      secondaryRole: node.secondaryRoleLabel ?? null,
      chemistry: node.score,
      axes,
    },
    reverse: node.reverse
      ? {
          설명: `${input.participantNickname}의 관계 세계에서 ${input.ownerNickname}이(가) 하는 역할`,
          role: node.reverse.roleLabel,
          chemistry: node.reverse.score,
        }
      : null,
    relationshipContext: {
      status: input.status,
      statusLabel: input.status ? STATUS_LABEL[input.status] : null,
      userNote: input.userNote?.trim() || null,
    },
    contextInstruction: contextInstructionOf(input.status),
    baseInterpretation: {
      strengths: node.strengths,
      cautions: node.cautions,
      conversationPrompt: node.conversationPrompt,
    },
  };
  return {
    system: SYSTEM,
    user: `다음 JSON만을 근거로 관계 리포트를 작성하세요.\n\n[INPUT_JSON]\n${JSON.stringify(payload)}\n[/INPUT_JSON]\n\n반드시 이 형태의 JSON만 반환하세요: {"summary":string(≤180자),"roleExplanation":string(≤220자),"strengths":[string,string](각 ≤100자),"caution":string(≤180자),"currentContext":string(≤240자),"suggestedAction":string(≤180자),"conversationPrompt":string(≤120자),"disclaimer":string(≤140자)}`,
  };
}

// ── 응답 검증 ─────────────────────────────────────────────

const LIMITS: Record<keyof Omit<GuinAiReport, "strengths">, number> = {
  summary: 180,
  roleExplanation: 220,
  caution: 180,
  currentContext: 240,
  suggestedAction: 180,
  conversationPrompt: 120,
  disclaimer: 140,
};

function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.length < 1 || text.length > max) return null;
  return text;
}

/**
 * 모델 응답 → 검증된 리포트. 실패 이유를 구분하지 않고 null 하나로 접는다 —
 * 어떤 실패든 대응은 같다(템플릿 폴백).
 */
export function parseGuinAiReport(text: string): GuinAiReport | null {
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

    const fields = {} as Record<keyof typeof LIMITS, string>;
    let broken = false;
    for (const key of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
      const value = cleanString(raw[key], LIMITS[key]);
      if (!value) {
        broken = true;
        break;
      }
      fields[key] = value;
    }
    if (broken) continue;

    const strengths = Array.isArray(raw.strengths)
      ? raw.strengths.map((item) => cleanString(item, 100)).filter((item): item is string => item !== null)
      : [];
    if (strengths.length !== 2) continue;

    const report: GuinAiReport = { ...fields, strengths: [strengths[0], strengths[1]] };
    const all = [...Object.values(fields), ...strengths].join("\n");
    if (GUIN_REPORT_FORBIDDEN.some((word) => all.includes(word))) return null;
    return report;
  }
  return null;
}

/**
 * 리포트 생성 한 번. AI 미설정·호출 실패·검증 실패 전부 null — 호출부는
 * null 이면 아무것도 저장하지 않고, 화면은 템플릿 카드로 산다.
 */
export async function generateGuinAiReport(input: GuinReportInput): Promise<GuinAiReport | null> {
  const { system, user } = buildGuinReportPrompt(input);
  try {
    const result = await chatComplete(system, [{ role: "user", content: user }], 900, {
      thinking: false,
      jsonSchema: REPORT_SCHEMA,
    });
    if (!result?.text) return null;
    const report = parseGuinAiReport(result.text);
    // 고지는 모델 문구 대신 서비스 표준 문구로 통일한다 — 화면과 어긋나지 않게.
    return report ? { ...report, disclaimer: GUIN_DISCLAIMER } : null;
  } catch {
    return null;
  }
}
