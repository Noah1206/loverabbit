// 모델별 단가.
//
// 이 표가 없던 동안 scripts/reading-preview.mts 가 **모델과 무관하게** GPT-5 단가로
// 원가를 찍었다. gpt-4o-mini 로 바꿔 돌려도 화면에는 열여섯 배 비싼 숫자가 뜬다.
// 원가를 보고 모델을 고르는데 그 숫자가 틀리면, 고르는 일 자체가 틀린다.
//
// 값은 공급사 공개 단가(100만 토큰당 USD)다. 바뀌면 여기만 고친다.
// 캐시 입력은 같은 시스템 프롬프트를 조각마다 다시 보내는 우리 구조에서 크게 먹는다 —
// 리포트 하나가 조각 대여섯이고, 그 조각마다 12,000자짜리 지시가 통째로 다시 나간다.

export interface ModelPrice {
  /** 100만 입력 토큰당 USD */
  input: number;
  /** 100만 캐시 적중 입력 토큰당 USD. 없으면 input 과 같게 본다. */
  cachedInput?: number;
  /** 100만 출력 토큰당 USD */
  output: number;
  note?: string;
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  // ── OpenAI ──
  "gpt-5.6": { input: 1.25, cachedInput: 0.125, output: 10.0, note: "지금 .env 가 가리키는 모델" },
  "gpt-4o-mini": {
    input: 0.15,
    output: 0.6,
    note: "코드 기본값. 경쟁사(폭스바니)가 공개한 단가와 같은 급.",
  },
  "gpt-4o": { input: 2.5, cachedInput: 1.25, output: 10.0 },

  // ── Google ──
  // 견주기용으로 남겨 둔다. 무료 티어는 하루 20요청·분당 5요청이라 상품에는 못 쓴다 —
  // 한 번 재 봤더니 같은 프롬프트에서 위반 92건, 구조 용어 33회가 나왔다.
  "gemini-2.5-flash": { input: 0.3, output: 2.5, note: "견주기용. 상품 경로에 쓰지 않는다." },

  // ── Anthropic ──
  "claude-sonnet-5": { input: 3.0, cachedInput: 0.3, output: 15.0 },
};

/** 모델 이름이 판마다 조금씩 다르다 (gpt-4o-mini-2024-07-18 같은 꼬리표) */
export function priceOf(model: string | undefined | null): ModelPrice | null {
  if (!model) return null;
  if (MODEL_PRICES[model]) return MODEL_PRICES[model];
  const prefix = Object.keys(MODEL_PRICES)
    .filter((key) => model.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? MODEL_PRICES[prefix] : null;
}

export interface TokenUsage {
  input: number;
  output: number;
  cached?: number | null;
}

/** 이 사용량이면 얼마인가. 단가를 모르는 모델이면 null. */
export function costOf(model: string | undefined | null, usage: TokenUsage | null): number | null {
  const price = priceOf(model);
  if (!price || !usage) return null;
  const cached = usage.cached ?? 0;
  const fresh = Math.max(0, usage.input - cached);
  const cachedRate = price.cachedInput ?? price.input;
  return (fresh * price.input + cached * cachedRate + usage.output * price.output) / 1_000_000;
}

/**
 * 같은 사용량을 다른 모델로 돌렸다면 얼마였을까.
 *
 * 모델을 고르는 자리에서 필요한 것은 "지금 얼마인가"보다 "바꾸면 얼마인가"다.
 */
export function compareCost(usage: TokenUsage | null): Array<{ model: string; cost: number; note?: string }> {
  if (!usage) return [];
  return Object.keys(MODEL_PRICES)
    .map((model) => ({ model, cost: costOf(model, usage) ?? 0, note: MODEL_PRICES[model].note }))
    .sort((a, b) => a.cost - b.cost);
}

/**
 * 글자 수로 토큰을 어림한다.
 *
 * 한국어는 토크나이저가 잘게 쪼개서 영어보다 토큰을 많이 먹는다. 실측으로 맞춘 값이다 —
 * jaehoe 15절 리포트의 실제 청구액($0.2208)을 이 비율로 되짚으면 오차가 2% 안쪽이다.
 * 어디까지나 어림이고, 정확한 값은 응답의 usage 를 쓴다.
 */
export const KOREAN_CHARS_PER_TOKEN = 1.4;

export function estimateTokens(chars: number): number {
  return Math.round(chars / KOREAN_CHARS_PER_TOKEN);
}
