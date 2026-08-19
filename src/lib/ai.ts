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

async function callGemini(
  apiKey: string,
  system: string,
  messages: ChatMsg[],
  maxTokens: number,
  thinking: boolean
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
        },
        // 관계 상담이 자극적인 방향으로 흐르지 않도록 표현 안전 기준을 적용한다.
        safetySettings: [
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        ],
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) throw new Error("Gemini 응답이 비어 있음 (안전 필터 차단 가능)");
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
    ? // 추론 토큰도 이 예산에서 빠져나가므로 여유를 둔다
      { max_completion_tokens: maxTokens + 2000 }
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

export async function chatComplete(
  system: string,
  messages: ChatMsg[],
  maxTokens = 3000,
  options: { thinking?: boolean } = {}
): Promise<{ text: string; provider: string } | null> {
  const thinking = options.thinking !== false;
  const { ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY } = process.env;
  if (ANTHROPIC_API_KEY)
    return { text: await callAnthropic(ANTHROPIC_API_KEY, system, messages, maxTokens), provider: "anthropic" };
  if (GEMINI_API_KEY)
    return { text: await callGemini(GEMINI_API_KEY, system, messages, maxTokens, thinking), provider: "gemini" };
  if (OPENAI_API_KEY)
    return { text: await callOpenAICompat(OPENAI_API_KEY, system, messages, maxTokens), provider: "openai-compat" };
  return null;
}
