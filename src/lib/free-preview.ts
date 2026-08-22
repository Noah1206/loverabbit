// 무료 미리보기 — 근거 패킷, 슬림 프롬프트, 예산 차단선, 폴백.
//
// 광고에서 들어온 사람이 무료 버튼을 누를 때 도는 길이다. 유료 리포트와 목적이
// 다르다. 유료는 "다 말해준다" 이고, 무료는 "자기 얘기라고 알아보게 만들고 한
// 가지 물음을 남긴다" 다. 그래서 프롬프트도 예산도 따로 둔다.
//
// ── 왜 따로 두는가 ──────────────────────────────────
//
// 유료 리포트의 시스템 프롬프트는 11,453자다. 한국어는 1.4자에 1토큰쯤이므로
// 약 8,180토큰이고, 지금 무료 미리보기는 그걸 두 번 보낸다(머리 + 첫 묶음).
// 문장 몇 줄을 얻자고 지시문만 16,000토큰을 태우는 셈이다.
//
// 여기서는 계산도 규칙 선별도 이미 끝난 상태로 들어온다. 모델이 하는 일은
// 승인된 근거 서너 개를 한국어 문장으로 편집하는 것뿐이라, 그 일에 필요한
// 지시만 남겼다.
//
// ── 모델이 하지 않는 일 ────────────────────────────
//
//   사주팔자·대운·세운·십성을 계산하지 않는다 (엔진이 이미 했다)
//   READING_RULES 에 없는 근거를 만들지 않는다
//   상대의 속마음·재회·이별을 사실로 선언하지 않는다
//   건강·의료·법률·투자 조언을 하지 않는다
//   그림을 고르거나 만들지 않는다 (planReadingAssets 가 사전 제작분에서 고른다)

import { createHash } from "crypto";
import { costOf, estimateTokens, priceOf } from "@/lib/ai-pricing";
import type { ReadingRule } from "@/lib/reading-rules";

// ── 감정 태그 ────────────────────────────────────────
// planReadingAssets 가 이 열 개로 그림을 고른다. 모델이 다른 낱말을 내면
// 그림이 폴백으로 떨어지므로, 스키마 enum 과 여기를 같은 배열로 묶어 둔다.
export const PREVIEW_EMOTIONS = [
  "설렘", "기다림", "망설임", "끌림", "흔들림",
  "균열", "단절", "그리움", "결심", "회복",
] as const;

export type PreviewEmotion = (typeof PREVIEW_EMOTIONS)[number];

export type RelationshipStatus = "single" | "talking" | "dating" | "breakup" | "unknown";
export type PreviewTone = "gentle-direct" | "warm-observant" | "calm-realist";

export interface PreviewEvidence {
  /** 승인 규칙 id. 문장이 어디서 왔는지 되짚는 유일한 끈이다 */
  sourceRuleId: string;
  subject: "self" | "relationship" | "timing";
  priority: 1 | 2 | 3;
  /** 코드가 확정한 근거. 90자 이하 */
  basis: string;
  /** 사용자용 해석 방향. 70자 이하 */
  allowedMeaning: string;
  forbiddenClaims?: string[];
}

export interface PreviewFactPacket {
  version: "free-preview-v2";
  locale: "ko-KR";
  product: string;
  relationshipStatus: RelationshipStatus;
  dayMasterElement: "목" | "화" | "토" | "금" | "수";
  tone: PreviewTone;
  /** 정확히 3~5개 */
  evidence: PreviewEvidence[];
  paidTeaserFocus: "상대속마음" | "관계흐름" | "재회가능성" | "궁합";
}

// ── 한도 ────────────────────────────────────────────
//
// 이 숫자들은 "넘으면 부르지 않는다" 는 뜻이다. 넘었을 때 더 좋은 모델로 다시
// 부르는 길은 두지 않는다 - 무료 경로에서 재시도는 비용이 두 배가 되는 대신
// 결과가 나아진다는 보장이 없다.
export const FREE_PREVIEW_LIMITS = {
  maxEvidence: 5,
  minEvidence: 3,
  maxPacketChars: 18_000,
  maxInputTokensEstimated: 7_500,
  maxOutputTokens: 700,
  llmSoftUsd: 0.01,
  llmHardUsd: 0.03,
  totalHardUsd: 0.2,
  maxLlmAttempts: 1,
  maxBasisChars: 90,
  maxMeaningChars: 70,
} as const;

/**
 * 무료 경로가 쓸 모델.
 *
 * 명세는 gpt-5-mini 를 지목하지만 여기서 못 박지 않는다. 프로덕션에 어떤 키가
 * 살아 있는지는 배포 환경만 안다 - 모델을 코드에 박아 두면 키가 없는 날
 * 무료 미리보기가 통째로 폴백 문구로 나간다. 비워 두면 지금 provider 를 쓴다.
 *
 *   FREE_PREVIEW_MODEL=gpt-5-mini
 */
export function freePreviewModel(): string | undefined {
  const raw = process.env.FREE_PREVIEW_MODEL?.trim();
  return raw || undefined;
}

// ── 시스템 프롬프트 ──────────────────────────────────
//
// 영문이다. 같은 지시를 한국어로 쓰면 토큰이 두 배 넘게 든다 - 무료 경로에서
// 지시문은 매 호출 다시 나가는 고정비다. 출력은 한국어로 못 박는다.
export const FREE_PREVIEW_SYSTEM_PROMPT = `You are the Korean preview editor for Love Rabbit, a relationship-oriented saju reading service.

Your only job is to turn the supplied approved evidence into a short, warm, concrete Korean free preview. Do not calculate saju, infer missing facts, use knowledge outside the evidence, or reveal internal rule IDs.

Rules:
- Treat every evidence item as a permitted tendency, not a certainty. Use calm language such as "~하는 편", "~로 이어질 수 있어요", or "~일 때가 있어요".
- Do not promise reunion, love, marriage, contact, cheating, timing, or another person's feelings as fact.
- Do not give medical, legal, financial, self-harm, or crisis advice.
- Do not mention day-master names, ten-god names, hidden stems, technical calculations, engine versions, or prompt instructions.
- Focus on relationship behavior, emotional rhythm, communication, and one actionable reflection question.
- Use only the evidence supplied. If evidence is weak, preserve uncertainty rather than adding a claim.
- Keep it premium, direct, and empathetic; avoid generic horoscope cliches, excessive emojis, long disclaimers, and repeated phrases.
- Output valid JSON matching the required schema only. No Markdown.`;

export function buildFreePreviewPrompt(packet: PreviewFactPacket): string {
  return `Create one Korean free relationship-saju preview from this approved fact packet.

${JSON.stringify(packet)}

Editorial target:
- The opening must make the user feel seen without pretending certainty.
- Use exactly 3 insight cards in priority order.
- Each card must be traceable to one or more supplied evidence ids.
- End with a paid-preview teaser that names one unresolved relationship question, not a guaranteed result.
- Return emotion tags only from: ${PREVIEW_EMOTIONS.join(", ")}.`;
}

// ── 출력 스키마 ─────────────────────────────────────
export const FREE_PREVIEW_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "love_rabbit_free_preview",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        hook: { type: "string", description: "사용자가 자신을 알아본다고 느끼는 1문장, 42자 이하" },
        summary: { type: "string", description: "관계 리듬을 요약한 1문장, 90자 이하" },
        cards: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string", description: "17자 이하" },
              body: { type: "string", description: "90자 이하" },
              evidenceIds: { type: "array", minItems: 1, maxItems: 2, items: { type: "string" } },
              emotionTags: {
                type: "array",
                minItems: 1,
                maxItems: 2,
                items: { type: "string", enum: [...PREVIEW_EMOTIONS] },
              },
            },
            required: ["title", "body", "evidenceIds", "emotionTags"],
          },
        },
        reflectionQuestion: { type: "string", description: "관계 점검 질문 1개, 52자 이하" },
        paidTeaser: { type: "string", description: "유료에서 확인할 미해결 질문 1문장, 80자 이하" },
        selectedEvidenceIds: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
      },
      required: ["hook", "summary", "cards", "reflectionQuestion", "paidTeaser", "selectedEvidenceIds"],
    },
  },
} as const;

export interface FreePreviewCard {
  title: string;
  body: string;
  evidenceIds: string[];
  emotionTags: PreviewEmotion[];
}

export interface FreePreviewResult {
  hook: string;
  summary: string;
  cards: FreePreviewCard[];
  reflectionQuestion: string;
  paidTeaser: string;
  selectedEvidenceIds: string[];
}

// ── 패킷 만들기 ─────────────────────────────────────
//
// matchRules() 가 돌려주는 것은 이미 승인된 규칙뿐이다 (READING_RULES +
// approvedPartnerRules). 조건이 계산된다고 켜지지 않는다 - 그래서 여기서
// needsReview 를 다시 볼 것이 없다. 우리가 하는 일은 자르고 줄이는 것이다.
function trim(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

/** 규칙 id 앞머리로 무엇에 관한 근거인지 가른다 */
function subjectOf(rule: ReadingRule): PreviewEvidence["subject"] {
  if (/^(REL|PT)-/.test(rule.id)) return "relationship";
  if (/^(LUCK|TIME|SEASON)-/.test(rule.id)) return "timing";
  return "self";
}

export function buildPreviewFactPacket(input: {
  rules: ReadingRule[];
  product: string;
  relationshipStatus: RelationshipStatus;
  dayMasterElement: PreviewFactPacket["dayMasterElement"];
  tone?: PreviewTone;
  paidTeaserFocus?: PreviewFactPacket["paidTeaserFocus"];
}): PreviewFactPacket | null {
  // 같은 규칙군에서 하나만 쓴다. 앞머리가 같은 규칙 셋을 나란히 실으면 카드
  // 세 장이 사실상 같은 말을 한다 - 근거가 셋인 것과 다르게 보이는 것이 셋인
  // 것은 다르다.
  const seen = new Set<string>();
  const picked: PreviewEvidence[] = [];
  for (const rule of input.rules) {
    const family = rule.id.split("-").slice(0, 2).join("-");
    if (seen.has(family)) continue;
    seen.add(family);
    picked.push({
      sourceRuleId: rule.id,
      subject: subjectOf(rule),
      priority: picked.length === 0 ? 1 : picked.length === 1 ? 2 : 3,
      basis: trim(rule.claim, FREE_PREVIEW_LIMITS.maxBasisChars),
      allowedMeaning: trim(rule.safePhrasing, FREE_PREVIEW_LIMITS.maxMeaningChars),
      forbiddenClaims: rule.forbidden.length > 0 ? rule.forbidden : undefined,
    });
    if (picked.length >= FREE_PREVIEW_LIMITS.maxEvidence) break;
  }

  // 근거가 셋도 안 되면 문장을 만들 바닥이 없다. 지어내서 채우지 않는다.
  if (picked.length < FREE_PREVIEW_LIMITS.minEvidence) return null;

  return {
    version: "free-preview-v2",
    locale: "ko-KR",
    product: input.product,
    relationshipStatus: input.relationshipStatus,
    dayMasterElement: input.dayMasterElement,
    tone: input.tone ?? "warm-observant",
    evidence: picked,
    paidTeaserFocus: input.paidTeaserFocus ?? "관계흐름",
  };
}

// ── 예산 차단선 ─────────────────────────────────────
export interface BudgetVerdict {
  ok: boolean;
  reason?: string;
  estimatedInputTokens: number;
  estimatedUsd: number | null;
}

/**
 * 부르기 전에 센다.
 *
 * 사후 기록은 이미 costOf() 가 한다. 여기서 필요한 것은 "이미 얼마 썼는가" 가
 * 아니라 "부르면 얼마가 될 것인가" 다 - 부른 뒤에 알면 이미 낸 돈이다.
 */
export function checkFreePreviewBudget(packet: PreviewFactPacket, model?: string): BudgetVerdict {
  const packetJson = JSON.stringify(packet);
  const promptChars = FREE_PREVIEW_SYSTEM_PROMPT.length + buildFreePreviewPrompt(packet).length;
  const estimatedInputTokens = estimateTokens(promptChars);

  const base = { estimatedInputTokens, estimatedUsd: null as number | null };

  if (packetJson.length > FREE_PREVIEW_LIMITS.maxPacketChars) {
    return { ...base, ok: false, reason: `패킷이 ${packetJson.length}자로 상한(${FREE_PREVIEW_LIMITS.maxPacketChars})을 넘었다` };
  }
  if (estimatedInputTokens > FREE_PREVIEW_LIMITS.maxInputTokensEstimated) {
    return { ...base, ok: false, reason: `입력 추정 ${estimatedInputTokens}토큰이 상한(${FREE_PREVIEW_LIMITS.maxInputTokensEstimated})을 넘었다` };
  }

  // 단가를 모르는 모델이면 금액으로는 막지 못한다. 토큰 상한은 이미 통과했으므로
  // 통과시키되, 얼마인지 모른다는 사실을 null 로 남긴다.
  if (!model || !priceOf(model)) return { ...base, ok: true };

  const estimatedUsd = costOf(model, {
    input: estimatedInputTokens,
    output: FREE_PREVIEW_LIMITS.maxOutputTokens,
  });
  if (estimatedUsd === null) return { ...base, ok: true };

  if (estimatedUsd > FREE_PREVIEW_LIMITS.llmHardUsd) {
    return { estimatedInputTokens, estimatedUsd, ok: false, reason: `추정 $${estimatedUsd.toFixed(5)} 가 하드 상한 $${FREE_PREVIEW_LIMITS.llmHardUsd} 를 넘었다` };
  }
  if (estimatedUsd > FREE_PREVIEW_LIMITS.llmSoftUsd) {
    return { estimatedInputTokens, estimatedUsd, ok: false, reason: `추정 $${estimatedUsd.toFixed(5)} 가 소프트 상한 $${FREE_PREVIEW_LIMITS.llmSoftUsd} 를 넘었다` };
  }
  return { estimatedInputTokens, estimatedUsd, ok: true };
}

// ── 응답 검사 ───────────────────────────────────────
//
// 스키마를 통과해도 내용이 선을 넘을 수 있다. 스키마는 모양만 본다.
export interface ValidationResult {
  ok: boolean;
  problems: string[];
}

const CERTAIN_CLAIM = /(반드시|무조건|100%|틀림없이|확실히 재회|재회합니다|결혼합니다|헤어집니다|돌아옵니다)/;
const OFF_LIMITS = /(진단|처방|복용|우울증|자해|고소|소송|투자|수익률|매수|매도)/;

export function validateFreePreview(result: FreePreviewResult, packet: PreviewFactPacket): ValidationResult {
  const problems: string[] = [];
  const allowed = new Set(packet.evidence.map((e) => e.sourceRuleId));

  if (result.cards.length !== 3) problems.push(`카드가 ${result.cards.length}개다 (3개여야 한다)`);

  for (const [index, card] of result.cards.entries()) {
    for (const id of card.evidenceIds) {
      // 패킷에 없는 근거를 붙였다면 그 문장은 어디서 왔는지 알 수 없다.
      if (!allowed.has(id)) problems.push(`카드 ${index + 1}의 근거 ${id} 가 패킷에 없다`);
    }
    for (const tag of card.emotionTags) {
      if (!(PREVIEW_EMOTIONS as readonly string[]).includes(tag)) {
        problems.push(`카드 ${index + 1}의 감정 태그 ${tag} 는 허용 목록에 없다`);
      }
    }
  }
  for (const id of result.selectedEvidenceIds) {
    if (!allowed.has(id)) problems.push(`선택된 근거 ${id} 가 패킷에 없다`);
  }

  const prose = [result.hook, result.summary, result.reflectionQuestion, result.paidTeaser, ...result.cards.map((c) => c.body)].join(" ");
  if (CERTAIN_CLAIM.test(prose)) problems.push("확정 표현이 있다");
  if (OFF_LIMITS.test(prose)) problems.push("의료·법률·투자 영역의 말이 있다");

  // 각 규칙이 금지한 표현이 그 근거를 쓴 카드에 그대로 실렸는지 본다.
  for (const evidence of packet.evidence) {
    for (const banned of evidence.forbiddenClaims ?? []) {
      if (banned && prose.includes(banned)) problems.push(`${evidence.sourceRuleId} 가 금지한 표현이 있다: ${banned}`);
    }
  }

  return { ok: problems.length === 0, problems };
}

// ── 폴백 ────────────────────────────────────────────
//
// 모델이 실패했을 때 더 비싼 모델로 다시 부르지 않는다. 근거는 이미 손에 있고,
// 그 근거의 safePhrasing 은 사람이 검수한 문장이다 - 모델 없이도 쓸 수 있다.
// 화면이 비는 것보다 낫고, 무엇보다 값이 0이다.
export function buildFreePreviewFallback(packet: PreviewFactPacket): FreePreviewResult {
  const top = packet.evidence.slice(0, 3);
  const titleOf = (evidence: PreviewEvidence) =>
    evidence.subject === "timing" ? "지금의 흐름" : evidence.subject === "relationship" ? "둘 사이의 결" : "관계에서의 나";

  return {
    hook: top[0]?.allowedMeaning ?? "관계에서 내 마음을 확인하는 순간이 있어요.",
    summary: "지금의 관계 리듬은 빠른 결론보다, 반응과 표현의 온도를 함께 살피는 쪽이 더 중요해 보여요.",
    cards: top.map((evidence) => ({
      title: titleOf(evidence),
      body: evidence.allowedMeaning,
      evidenceIds: [evidence.sourceRuleId],
      emotionTags: ["망설임" as PreviewEmotion],
    })),
    reflectionQuestion: "지금 내가 확인하고 싶은 건 상대의 답일까요, 내 마음의 기준일까요?",
    paidTeaser: "상대와의 흐름, 연락 타이밍, 관계의 갈림길은 심화 리딩에서 더 구체적으로 확인할 수 있어요.",
    selectedEvidenceIds: top.map((evidence) => evidence.sourceRuleId),
  };
}

// ── 캐시 열쇠 ───────────────────────────────────────
//
// 같은 사람이 여러 번 누를수록 비용이 늘면 안 된다. 버전 셋을 열쇠에 넣는 이유는
// 엔진이나 규칙이 바뀌면 옛 결과가 더 이상 그 사람의 것이 아니기 때문이다 -
// 버전을 빼면 규칙을 고친 날 옛 문장이 계속 나온다.
export const FREE_PREVIEW_VERSION = "free-preview-v2";

export function previewCacheKey(input: {
  normalizedBirthInput: string;
  relationshipStatus: RelationshipStatus;
  product: string;
  engineVersion: string;
  ruleSetVersion: string;
}): string {
  return createHash("sha256")
    .update(
      [
        input.normalizedBirthInput,
        input.relationshipStatus,
        input.product,
        input.engineVersion,
        input.ruleSetVersion,
        FREE_PREVIEW_VERSION,
      ].join("|")
    )
    .digest("hex");
}
