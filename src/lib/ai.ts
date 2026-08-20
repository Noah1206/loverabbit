// AI 제공사 공용 어댑터 — 리딩 생성(단발)과 추가 상담(멀티턴)이 함께 사용.
// 우선순위: Anthropic → Gemini(무료 티어) → OpenAI 호환(OpenRouter·Groq·Ollama 포함).
// 키가 하나도 없으면 null 반환 → 호출부가 데모 모드로 폴백한다.
import Anthropic from "@anthropic-ai/sdk";

export type ChatMsg = { role: "user" | "assistant"; content: string };

async function callAnthropic(apiKey: string, system: string, messages: ChatMsg[], maxTokens: number): Promise<string> {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
    max_tokens: maxTokens,
    system,
    messages,
  });
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * 안전 등급 문턱.
 *
 * 속궁합·연애 기질처럼 친밀함을 다루는 상품이 있어, 성적 표현 기준이 조이면
 * 응답이 통째로 비어 돌아온다(= 결제 가능한 상품 하나가 죽는다). 기본값은 그대로
 * 두되 환경변수로 열어둔다 — 실제로 막히는지는 키를 꽂고 속궁합으로 재봐야 안다.
 */
function safetyThreshold(): string {
  const raw = process.env.GEMINI_SAFETY_SEXUAL;
  const allowed = ["BLOCK_NONE", "BLOCK_ONLY_HIGH", "BLOCK_MEDIUM_AND_ABOVE", "BLOCK_LOW_AND_ABOVE"];
  return raw && allowed.includes(raw) ? raw : "BLOCK_MEDIUM_AND_ABOVE";
}

async function callGemini(
  apiKey: string,
  system: string,
  messages: ChatMsg[],
  maxTokens: number,
  thinking: boolean,
  json: boolean
): Promise<string> {
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          maxOutputTokens: maxTokens,
          // Gemini 2.5는 '생각' 토큰도 maxOutputTokens에서 쓴다. 캐릭터 대화처럼
          // 추론이 필요 없는 호출에서 이걸 켜두면 답이 문장 중간에 잘린다.
          ...(thinking ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
          // JSON을 받기로 한 호출은 형식을 모델 쪽에서 강제한다. 앞뒤에 설명이나
          // 코드펜스가 붙어 나오면 조각 하나가 통째로 날아간다.
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
        // 관계 상담이 자극적인 방향으로 흐르지 않도록 표현 안전 기준을 적용한다.
        safetySettings: [
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: safetyThreshold() },
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        ],
      }),
    }
  );
  if (!res.ok) {
    const detail = await res.text();
    // Gemini 3.x 일부 모델은 thinkingConfig를 400으로 거절한다(필드 이름이 바뀌었다).
    // 모델 하나 잘못 고른 것 때문에 리딩이 전부 죽지 않도록, 그 옵션만 빼고 한 번 더 시도한다.
    if (res.status === 400 && !thinking && /thinking/i.test(detail)) {
      console.warn(`Gemini ${model}이 thinkingConfig를 거절함 — 해당 옵션 없이 재시도`);
      return callGemini(apiKey, system, messages, maxTokens, true, json);
    }
    throw new Error(`Gemini API ${res.status}: ${detail}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) {
    // 왜 비었는지를 남긴다. 안전 필터 차단과 토큰 소진은 대응이 전혀 다른데,
    // "응답이 비어 있음"만 찍히면 로그를 봐도 어느 쪽인지 알 수 없다.
    const blocked = data?.promptFeedback?.blockReason;
    const finish = data?.candidates?.[0]?.finishReason;
    const ratings = data?.candidates?.[0]?.safetyRatings
      ?.filter((r: { blocked?: boolean }) => r.blocked)
      ?.map((r: { category?: string }) => r.category)
      ?.join(",");
    throw new Error(
      `Gemini 응답이 비어 있음 (blockReason=${blocked ?? "none"} finishReason=${finish ?? "none"}` +
        `${ratings ? ` blocked=${ratings}` : ""})`
    );
  }
  return text;
}

// OpenAI 호환 chat/completions — OPENAI_BASE_URL만 바꾸면 OpenRouter, Groq, 로컬 Ollama도 동작
/**
 * gpt-5 계열과 o 시리즈는 추론 모델이라 채팅 API의 규약이 다르다.
 *   - max_tokens 를 받지 않는다 (max_completion_tokens 를 써야 한다)
 *   - temperature 는 기본값(1)만 허용한다
 * 둘 다 400으로 즉시 거절되므로, 모델 이름만 바꾸면 리딩이 전부 데모로 떨어진다.
 * 실제 API에 물어 확인한 제약이다 (2026-08 기준).
 */
function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o[1-9])/.test(model);
}

async function callOpenAICompat(apiKey: string, system: string, messages: ChatMsg[], maxTokens: number): Promise<string> {
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const budget = isReasoningModel(model)
    ? {
        // 추론 토큰도 이 예산에서 빠져나가므로 여유를 둔다
        max_completion_tokens: maxTokens + 2000,
        // 리딩은 계산이 이미 끝난 상태에서 문장만 쓰는 일이라 깊은 추론이 필요 없다.
        // 기본값으로 두면 대기 시간만 늘어난다. OPENAI_REASONING_EFFORT로 조정할 수 있다.
        reasoning_effort: process.env.OPENAI_REASONING_EFFORT ?? "low",
      }
    : { max_tokens: maxTokens, temperature: 0.9 };
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      ...budget,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI 호환 API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI 호환 API 응답이 비어 있음");
  return text;
}

/**
 * 생성기가 하나라도 붙어 있는가.
 * 키가 아예 없으면 데모 리딩이 정상 동작(로컬 개발)이지만, 키가 있는데 실패한 것은
 * 장애다. 그 둘을 호출부가 구분할 수 있어야 데모 글을 팔지 않는다.
 */
export function isAiConfigured(): boolean {
  const { ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY } = process.env;
  return Boolean(ANTHROPIC_API_KEY || GEMINI_API_KEY || OPENAI_API_KEY);
}

export async function chatComplete(
  system: string,
  messages: ChatMsg[],
  maxTokens = 3000,
  options: { thinking?: boolean; json?: boolean } = {}
): Promise<{ text: string; provider: string } | null> {
  const thinking = options.thinking !== false;
  const json = options.json === true;
  const { ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY } = process.env;
  if (ANTHROPIC_API_KEY)
    return { text: await callAnthropic(ANTHROPIC_API_KEY, system, messages, maxTokens), provider: "anthropic" };
  if (GEMINI_API_KEY)
    return { text: await callGemini(GEMINI_API_KEY, system, messages, maxTokens, thinking, json), provider: "gemini" };
  if (OPENAI_API_KEY)
    return { text: await callOpenAICompat(OPENAI_API_KEY, system, messages, maxTokens), provider: "openai-compat" };
  return null;
}
