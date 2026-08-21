// AI 제공사 공용 어댑터 — 리딩 생성(단발)과 추가 상담(멀티턴)이 함께 사용.
// 우선순위: Anthropic → Gemini(무료 티어) → OpenAI 호환(OpenRouter·Groq·Ollama 포함).
// 키가 하나도 없으면 null 반환 → 호출부가 데모 모드로 폴백한다.
import Anthropic from "@anthropic-ai/sdk";

export type ChatMsg = { role: "user" | "assistant"; content: string };

/**
 * 이번 호출이 실제로 청구된 토큰.
 *
 * 비용을 글자 수로 추정하면 한글 때문에 크게 어긋난다. 제공사가 돌려주는 값을
 * 그대로 실어 보내, 어떤 모델이 얼마인지 재는 쪽에서 추정 없이 쓰게 한다.
 * 돌려주지 않는 제공사도 있으므로 선택 필드다.
 */
export interface ChatUsage {
  input: number;
  output: number;
  /** 프롬프트 캐시로 할인된 입력 토큰 (있으면) */
  cached: number;
  /** 추론 모델이 따로 쓴 토큰 (있으면) */
  reasoning: number;
}

export interface ChatResult {
  text: string;
  provider: string;
  /** 실제로 응답한 모델 이름 */
  model: string;
  usage: ChatUsage | null;
}

/**
 * 어느 제공사로 보낼지 직접 지목할 때 쓴다. 지정하지 않으면 키 우선순위를 따른다.
 *
 * claude-code 만 성격이 다르다. API 키가 아니라 이미 로그인된 Claude Code CLI 를
 * 쓰므로 구독으로 청구되고, 키 우선순위에는 끼지 않는다 — 키가 없다는 이유로
 * 자동으로 골라지면 안 되고, 반대로 키가 있다는 이유로 밀려나도 안 된다.
 * 쓰려면 AI_PROVIDER=claude-code 로 못 박아야 한다.
 */
export type Provider = "anthropic" | "gemini" | "openai" | "claude-code";

const NO_USAGE: ChatUsage = { input: 0, output: 0, cached: 0, reasoning: 0 };

async function callAnthropic(
  apiKey: string,
  system: string,
  messages: ChatMsg[],
  maxTokens: number,
  modelOverride?: string
): Promise<ChatResult> {
  const client = new Anthropic({ apiKey });
  const model = modelOverride ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
  const msg = await client.messages.create({ model, max_tokens: maxTokens, system, messages });
  return {
    text: msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(""),
    provider: "anthropic",
    model,
    usage: {
      input: msg.usage?.input_tokens ?? 0,
      output: msg.usage?.output_tokens ?? 0,
      cached: msg.usage?.cache_read_input_tokens ?? 0,
      reasoning: 0,
    },
  };
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
  json: boolean,
  modelOverride?: string
): Promise<ChatResult> {
  const model = modelOverride ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
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
      return callGemini(apiKey, system, messages, maxTokens, true, json, modelOverride);
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
  const u = data?.usageMetadata;
  return {
    text,
    provider: "gemini",
    model,
    usage: u
      ? {
          input: u.promptTokenCount ?? 0,
          output: u.candidatesTokenCount ?? 0,
          cached: u.cachedContentTokenCount ?? 0,
          reasoning: u.thoughtsTokenCount ?? 0,
        }
      : null,
  };
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

async function callOpenAICompat(
  apiKey: string,
  system: string,
  messages: ChatMsg[],
  maxTokens: number,
  modelOverride?: string
): Promise<ChatResult> {
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = modelOverride ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
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
  const u = data?.usage;
  return {
    text,
    provider: "openai-compat",
    model: data?.model ?? model,
    usage: u
      ? {
          input: u.prompt_tokens ?? 0,
          output: u.completion_tokens ?? 0,
          cached: u.prompt_tokens_details?.cached_tokens ?? 0,
          reasoning: u.completion_tokens_details?.reasoning_tokens ?? 0,
        }
      : null,
  };
}

/**
 * 생성기가 하나라도 붙어 있는가.
 * 키가 아예 없으면 데모 리딩이 정상 동작(로컬 개발)이지만, 키가 있는데 실패한 것은
 * 장애다. 그 둘을 호출부가 구분할 수 있어야 데모 글을 팔지 않는다.
 */
export function isAiConfigured(): boolean {
  // 구독으로 못 박아 두었으면 확인할 키가 없다. 없다고 데모로 떨어지면 안 된다.
  // 다만 서버리스에서는 그 길이 아예 없으므로, 키를 보는 쪽으로 되돌린다.
  if (pinnedProvider() === "claude-code" && !serverlessHost()) return true;
  const { ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY } = process.env;
  return Boolean(ANTHROPIC_API_KEY || GEMINI_API_KEY || OPENAI_API_KEY);
}

/**
 * 쓸 제공사를 못 박는다.
 *
 * 아래 우선순위(ANTHROPIC -> GEMINI -> OPENAI)는 "키가 있는 곳으로 알아서 간다"는
 * 편의인데, 그 편의가 **돈이 있는 곳으로 알아서 가는** 편의이기도 하다. 실제로
 * CLI 스크립트가 .env 만 읽어 GEMINI_API_KEY 를 못 보고 유료 키로 떨어진 적이 있다.
 * 잔액이 없는 동안에는 그 길을 아예 막아 두는 편이 낫다.
 *
 *   AI_PROVIDER=gemini   이것만 쓴다. 키가 없으면 그냥 실패한다.
 *
 * 안 주면 예전처럼 우선순위대로 고른다.
 */
/**
 * 이 서버에서 구독 경로가 될 수 있는가.
 *
 * claude-code 는 로그인된 Claude Code CLI 를 프로세스로 띄운다. 그러려면 실행 파일이
 * 깔려 있어야 하고, 그 CLI 가 한 번 로그인돼 있어야 한다. 서버리스에는 둘 다 없다 —
 * 이미지에 전역 npm 설치가 없고, 로그인은 사람이 브라우저로 하는 일이라 무인 환경에서
 * 만들 수 없다.
 *
 * 그래서 여기서 미리 막는다. 안 막으면 배포는 되고, 사용자가 생성 버튼을 누른 뒤에야
 * 실패한다 — 가장 늦게 알게 되는 자리다.
 *
 * fs 를 보지 않고 환경변수만 본다. 이 파일은 클라이언트 번들에 딸려 들어가는 길이
 * 있어서(reading-images -> ai), node: 모듈을 여기서 만지면 빌드가 멈춘다.
 */
export function serverlessHost(): string | null {
  if (process.env.VERCEL) return "Vercel";
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) return "AWS Lambda";
  if (process.env.K_SERVICE) return "Cloud Run";
  if (process.env.NETLIFY) return "Netlify";
  return null;
}

export function pinnedProvider(): Provider | null {
  const raw = process.env.AI_PROVIDER;
  if (raw === "anthropic" || raw === "gemini" || raw === "openai" || raw === "claude-code") {
    return raw;
  }
  if (raw) {
    console.warn(
      `AI_PROVIDER="${raw}" 는 알 수 없는 값입니다. anthropic | gemini | openai 중 하나여야 합니다. ` +
        `못 박지 않고 키 우선순위대로 고릅니다.`
    );
  }
  return null;
}

export async function chatComplete(
  system: string,
  messages: ChatMsg[],
  maxTokens = 3000,
  options: { thinking?: boolean; json?: boolean; provider?: Provider; model?: string } = {}
): Promise<ChatResult | null> {
  const thinking = options.thinking !== false;
  const json = options.json === true;
  const { ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY } = process.env;
  // 부르는 쪽이 지목하지 않았으면 환경이 못 박은 것을 따른다.
  options = options.provider ? options : { ...options, provider: pinnedProvider() ?? undefined };

  // 제공사를 지목한 경우 — 키 우선순위를 건너뛴다. 모델을 바꿔가며 재는 쪽에서 쓴다.
  // 지목한 제공사의 키가 없으면 조용히 다른 곳으로 새지 않고 그냥 실패한다.
  if (options.provider) {
    // 키를 보지 않는다. 구독으로 도는 길이라 확인할 키가 없다.
    //
    // 부를 때가 되어서야 불러온다. 맨 위에서 import 하면 ai-claude-code 가 쓰는
    // node:child_process·node:fs 가 **클라이언트 번들까지 따라 들어와** next build 가
    // 통째로 멈춘다 (reading/[id]/page.tsx -> reading-images -> ai 로 이어지는 길).
    // 서버에서만 도는 길이므로 그 자리에서 부르면 번들 그래프에 안 걸린다.
    if (options.provider === "claude-code") {
      const host = serverlessHost();
      if (host) {
        // 조용히 다른 곳으로 새지 않는다. 구독으로 돌리라고 못 박아 둔 서버가
        // 몰래 종량과금으로 넘어가면, 그 사실을 청구서에서 알게 된다.
        throw new Error(
          `AI_PROVIDER=claude-code 는 ${host} 에서 쓸 수 없습니다. ` +
            `Claude Code CLI 실행 파일과 로그인된 세션이 필요한데 서버리스에는 둘 다 없습니다. ` +
            `AI_PROVIDER 를 openai 또는 anthropic 으로 바꾸거나, CLI 를 둘 수 있는 서버에 올리세요.`
        );
      }
      const { callClaudeCode } = await import("@/lib/ai-claude-code");
      return callClaudeCode(system, messages, options.model);
    }
    if (options.provider === "anthropic")
      return ANTHROPIC_API_KEY
        ? callAnthropic(ANTHROPIC_API_KEY, system, messages, maxTokens, options.model)
        : null;
    if (options.provider === "gemini")
      return GEMINI_API_KEY
        ? callGemini(GEMINI_API_KEY, system, messages, maxTokens, thinking, json, options.model)
        : null;
    return OPENAI_API_KEY
      ? callOpenAICompat(OPENAI_API_KEY, system, messages, maxTokens, options.model)
      : null;
  }

  if (ANTHROPIC_API_KEY) return callAnthropic(ANTHROPIC_API_KEY, system, messages, maxTokens, options.model);
  if (GEMINI_API_KEY) return callGemini(GEMINI_API_KEY, system, messages, maxTokens, thinking, json, options.model);
  if (OPENAI_API_KEY) return callOpenAICompat(OPENAI_API_KEY, system, messages, maxTokens, options.model);
  return null;
}

/** 여러 호출의 사용량을 하나로 더한다. */
export function sumUsage(parts: (ChatUsage | null | undefined)[]): ChatUsage {
  return parts.reduce<ChatUsage>(
    (acc, u) =>
      u
        ? {
            input: acc.input + u.input,
            output: acc.output + u.output,
            cached: acc.cached + u.cached,
            reasoning: acc.reasoning + u.reasoning,
          }
        : acc,
    { ...NO_USAGE }
  );
}
