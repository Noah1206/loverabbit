// 무료 미리보기 한 건을 실제로 만든다 — 캐시 → 패킷 → 예산 → 1회 호출 → 검사 → 폴백.
//
// free-preview.ts 는 재료(타입·프롬프트·한도·검사)이고, 여기는 그 재료로 도는 길이다.
// 나눈 이유는 재료 쪽이 순수 함수라 테스트가 쉽고, 이 파일만 모델과 시계를 만지기
// 때문이다.
//
// ── 지키는 것 ──────────────────────────────────────
//
//   호출은 한 번. 실패해도 다시 부르지 않는다.
//   비싼 모델로 갈아타는 폴백은 없다. 실패하면 규칙 문장으로 답한다.
//   부르기 전에 값을 세고, 넘으면 아예 안 부른다.
//   같은 사람이 다시 눌러도 다시 부르지 않는다.

import { chatComplete, effectiveProvider } from "@/lib/ai";
import { costOf } from "@/lib/ai-pricing";
import {
  FREE_PREVIEW_LIMITS,
  FREE_PREVIEW_SCHEMA,
  FREE_PREVIEW_SYSTEM_PROMPT,
  buildFreePreviewFallback,
  buildFreePreviewPrompt,
  buildPreviewFactPacket,
  checkFreePreviewBudget,
  freePreviewModel,
  previewCacheKey,
  validateFreePreview,
  type FreePreviewResult,
  type PreviewFactPacket,
  type RelationshipStatus,
} from "@/lib/free-preview";
import type { ReadingRule } from "@/lib/reading-rules";

export type FreePreviewSource = "llm" | "fallback" | "cache";

export interface FreePreviewTelemetry {
  source: FreePreviewSource;
  llmCalls: number;
  cacheHit: boolean;
  model?: string;
  provider?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedUsd?: number | null;
  actualUsd?: number | null;
  /** 왜 폴백으로 갔는가. 정상이면 비어 있다 */
  reason?: string;
  /** 검사에서 걸린 것들 — 폴백으로 갔더라도 무엇이 문제였는지 남긴다 */
  problems?: string[];
  evidenceIds: string[];
}

export interface FreePreviewOutcome {
  result: FreePreviewResult;
  packet: PreviewFactPacket | null;
  telemetry: FreePreviewTelemetry;
}

// ── 캐시 ────────────────────────────────────────────
//
// 프로세스 안에만 산다. 서버리스에서는 인스턴스가 식으면 같이 사라지므로,
// 같은 인스턴스로 다시 들어온 재클릭만 잡는다. 그래도 넣어 두는 이유는 광고
// 유입에서 흔한 것이 "뒤로 갔다 다시 누르기" 이고 그건 대개 같은 인스턴스로
// 돌아오기 때문이다.
//
// 진짜 0원을 보장하려면 저장소가 필요하다. 열쇠는 previewCacheKey() 로 이미
// 나와 있으니, 표가 생기면 이 Map 만 갈아 끼우면 된다.
const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 500;
const cache = new Map<string, { at: number; result: FreePreviewResult; evidenceIds: string[] }>();

function cacheGet(key: string) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(key);
    return null;
  }
  // 다시 넣어 최근 것으로 올린다 — Map 은 넣은 순서를 지킨다.
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cacheSet(key: string, result: FreePreviewResult, evidenceIds: string[]) {
  cache.set(key, { at: Date.now(), result, evidenceIds });
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** 테스트에서 상태를 비운다 */
export function clearFreePreviewCache() {
  cache.clear();
}

// ── 본체 ────────────────────────────────────────────

export interface FreePreviewInput {
  rules: ReadingRule[];
  product: string;
  relationshipStatus: RelationshipStatus;
  dayMasterElement: PreviewFactPacket["dayMasterElement"];
  /** 캐시 열쇠용. 생년 정보 원문은 열쇠 안에서 해시로만 남는다 */
  normalizedBirthInput: string;
  engineVersion: string;
  ruleSetVersion: string;
}

export async function runFreePreview(input: FreePreviewInput): Promise<FreePreviewOutcome> {
  const key = previewCacheKey({
    normalizedBirthInput: input.normalizedBirthInput,
    relationshipStatus: input.relationshipStatus,
    product: input.product,
    engineVersion: input.engineVersion,
    ruleSetVersion: input.ruleSetVersion,
  });

  const hit = cacheGet(key);
  if (hit) {
    return {
      result: hit.result,
      packet: null,
      telemetry: { source: "cache", llmCalls: 0, cacheHit: true, evidenceIds: hit.evidenceIds, actualUsd: 0 },
    };
  }

  const packet = buildPreviewFactPacket({
    rules: input.rules,
    product: input.product,
    relationshipStatus: input.relationshipStatus,
    dayMasterElement: input.dayMasterElement,
  });

  // 근거가 셋도 안 되면 만들 바닥이 없다. 지어내지 않고, 부르지도 않는다.
  // 화면은 비지 않아야 하므로 근거를 가리키지 않는 안내 문구로 답한다.
  if (!packet) {
    return {
      result: {
        hook: "아직 이 사주에서 뽑아낼 근거가 넉넉하지 않아요.",
        summary: "정보를 조금 더 채우면 관계의 결을 더 또렷하게 볼 수 있어요.",
        cards: [],
        reflectionQuestion: "지금 가장 확인하고 싶은 한 가지는 무엇인가요?",
        paidTeaser: "생년 정보를 채우면 두 사람의 흐름을 더 구체적으로 볼 수 있어요.",
        selectedEvidenceIds: [],
      },
      packet: null,
      telemetry: { source: "fallback", llmCalls: 0, cacheHit: false, reason: "근거 부족", evidenceIds: [] },
    };
  }

  // 모델 이름은 제공사마다 다른 말이다. gpt-5-mini 를 Anthropic 에 넘기면 그
  // 호출은 실패하고, 무료 미리보기가 통째로 폴백으로 떨어진다 - 화면은 멀쩡해
  // 보이고 문장만 조용히 통조림이 된다. 제공사가 안 맞으면 지목을 버린다.
  const provider = effectiveProvider();
  const wanted = freePreviewModel();
  const model = wanted && provider === "openai" ? wanted : undefined;
  if (wanted && !model) {
    console.warn(
      `FREE_PREVIEW_MODEL="${wanted}" 는 OpenAI 모델 이름인데 지금 제공사는 ${provider ?? "없음"} 입니다. ` +
        `지목을 무시하고 그 제공사의 기본 모델로 부릅니다.`
    );
  }
  const budget = checkFreePreviewBudget(packet, model);
  const evidenceIds = packet.evidence.map((e) => e.sourceRuleId);

  // 값이 넘으면 부르지 않는다. 더 싼 모델로 바꿔 다시 재는 길도 두지 않는다 —
  // 그건 결국 "어떻게든 부른다" 이고, 상한선의 뜻이 사라진다.
  if (!budget.ok) {
    cacheSet(key, buildFreePreviewFallback(packet), evidenceIds);
    return {
      result: buildFreePreviewFallback(packet),
      packet,
      telemetry: {
        source: "fallback",
        llmCalls: 0,
        cacheHit: false,
        model,
        inputTokens: budget.estimatedInputTokens,
        estimatedUsd: budget.estimatedUsd,
        reason: budget.reason,
        evidenceIds,
      },
    };
  }

  let raw: Awaited<ReturnType<typeof chatComplete>> = null;
  let failure: string | undefined;
  // 여기를 지난 순간 한 번은 시도한 것이다. 성공 여부와 무관하게 1로 센다 —
  // "몇 번 불렀나" 를 성공한 것만 세면 장애가 났을 때 숫자가 거짓말을 한다.
  const llmCalls = 1;
  try {
    raw = await chatComplete(
      FREE_PREVIEW_SYSTEM_PROMPT,
      [{ role: "user", content: buildFreePreviewPrompt(packet) }],
      FREE_PREVIEW_LIMITS.maxOutputTokens,
      // 생각 토큰을 끈다. 계산은 이미 끝났고 여기서 하는 일은 문장 쓰기다.
      // Gemini 는 생각 토큰도 출력 상한에서 빼가므로, 켜두면 JSON 이 잘린다.
      // 스키마를 실어 키 이름까지 못 박는다. json: true 만으로는 모양이 안 맞는다.
      { thinking: false, json: true, model, jsonSchema: FREE_PREVIEW_SCHEMA }
    );
  } catch (error) {
    failure = error instanceof Error ? error.message : "호출 실패";
  }

  // 왜 못 읽었는지는 원문을 봐야 안다. 폴백은 조용해서, 이 줄이 없으면
  // "모델이 이상한 걸 줬다" 까지만 알고 무엇을 줬는지는 영원히 모른다.
  if (process.env.FREE_PREVIEW_DEBUG === "1") {
    console.log("[free-preview] 원문 " + (raw?.text?.length ?? 0) + "자, 추론 " + (raw?.usage?.reasoning ?? 0) + "토큰");
    console.log((raw?.text ?? "(없음)").slice(0, 1200));
  }
  const parsed = raw?.text ? safeParse(raw.text) : null;
  const problems = parsed ? validateFreePreview(parsed, packet).problems : [];

  if (!parsed || problems.length > 0) {
    const fallback = buildFreePreviewFallback(packet);
    cacheSet(key, fallback, evidenceIds);
    return {
      result: fallback,
      packet,
      telemetry: {
        source: "fallback",
        llmCalls,
        cacheHit: false,
        model: raw?.model ?? model,
        provider: raw?.provider,
        inputTokens: raw?.usage?.input,
        outputTokens: raw?.usage?.output,
        estimatedUsd: budget.estimatedUsd,
        actualUsd: raw ? costOf(raw.model, raw.usage ?? null) : null,
        reason: failure ?? (parsed ? "검사 위반" : "응답을 읽지 못함"),
        problems: problems.length > 0 ? problems : undefined,
        evidenceIds,
      },
    };
  }

  cacheSet(key, parsed, evidenceIds);
  return {
    result: parsed,
    packet,
    telemetry: {
      source: "llm",
      llmCalls,
      cacheHit: false,
      model: raw?.model ?? model,
      provider: raw?.provider,
      inputTokens: raw?.usage?.input,
      outputTokens: raw?.usage?.output,
      estimatedUsd: budget.estimatedUsd,
      actualUsd: costOf(raw?.model, raw?.usage ?? null),
      evidenceIds,
    },
  };
}

/** 코드펜스나 앞뒤 잡음이 붙어 오는 경우가 있어 중괄호 구간을 한 번 더 시도한다 */
function safeParse(text: string): FreePreviewResult | null {
  const attempts = [text.trim()];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) attempts.push(fenced[1].trim());
  const braced = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (braced.length > 2) attempts.push(braced);

  for (const candidate of attempts) {
    try {
      const raw = JSON.parse(candidate) as FreePreviewResult;
      if (raw && Array.isArray(raw.cards) && typeof raw.hook === "string") return raw;
    } catch {
      // 다음 후보를 본다
    }
  }
  return null;
}

/** 카드의 감정 태그를 삽화 선택기가 먹는 모양으로 넘긴다 */
export function emotionTagsForAssets(result: FreePreviewResult): string[][] {
  return result.cards.map((card) => [...card.emotionTags]);
}
