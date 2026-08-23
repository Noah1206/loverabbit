import assert from "node:assert/strict";
import test from "node:test";

import { chatComplete } from "../src/lib/ai";
import { costOf } from "../src/lib/ai-pricing";
import { READING_SYSTEM_PROMPT, systemPromptFor } from "../src/lib/reading-prompt";

test("머리와 본문은 서로 필요 없는 출력 계약을 보내지 않는다", () => {
  const head = systemPromptFor("head");
  const body = systemPromptFor("body");

  assert.match(head, /지시가 "머리"일 때/);
  assert.doesNotMatch(head, /지시가 "본문"일 때/);
  assert.match(body, /지시가 "본문"일 때/);
  assert.doesNotMatch(body, /지시가 "머리"일 때/);
  assert.ok(head.length < READING_SYSTEM_PROMPT.length);
  assert.ok(body.length < READING_SYSTEM_PROMPT.length);
});

test("GPT-5.6 요청은 반복 JSON 끝에 명시적 캐시 지점을 둔다", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const envNames = ["OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_BASE_URL", "AI_PROVIDER"] as const;
  const originalEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  let body: Record<string, unknown> | null = null;

  try {
    process.env.OPENAI_API_KEY = "test-key-never-sent";
    process.env.OPENAI_MODEL = "gpt-5.6";
    process.env.AI_PROVIDER = "openai";
    delete process.env.OPENAI_BASE_URL;

    globalThis.fetch = (async (_input, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          model: "gpt-5.6",
          choices: [{ message: { content: "{}" } }],
          usage: {
            prompt_tokens: 1200,
            completion_tokens: 5,
            prompt_tokens_details: { cached_tokens: 800, cache_write_tokens: 300 },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as typeof fetch;

    const result = await chatComplete("공통 규칙", [{ role: "user", content: "지시: 본문" }], 100, {
      provider: "openai",
      model: "gpt-5.6",
      json: true,
      promptCache: {
        key: "paid-reading:v2:3",
        prefix: "입력:\n{\"same\":true}\n\n",
        enabled: true,
      },
    });

    const request = body as unknown as Record<string, unknown>;
    assert.ok(request);
    assert.equal(request.prompt_cache_key, "paid-reading:v2:3");
    assert.deepEqual(request.prompt_cache_options, { mode: "explicit", ttl: "30m" });
    const messages = request.messages as Array<{ role: string; content: unknown }>;
    const user = messages[1].content as Array<Record<string, unknown>>;
    assert.equal(user[0].text, "입력:\n{\"same\":true}\n\n");
    assert.deepEqual(user[0].prompt_cache_breakpoint, { mode: "explicit" });
    assert.equal(user[1].text, "지시: 본문");
    assert.equal(result?.usage?.cached, 800);
    assert.equal(result?.usage?.cacheWrite, 300);
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of envNames) {
      const value = originalEnv[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("한 번뿐인 호출은 프리픽스를 보내되 유료 캐시 쓰기는 끈다", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const envNames = ["OPENAI_API_KEY", "OPENAI_BASE_URL"] as const;
  const originalEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  let body: Record<string, unknown> | null = null;

  try {
    process.env.OPENAI_API_KEY = "test-key-never-sent";
    delete process.env.OPENAI_BASE_URL;
    globalThis.fetch = (async (_input, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({ model: "gpt-5.6", choices: [{ message: { content: "{}" } }] }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as typeof fetch;

    await chatComplete("공통 규칙", [{ role: "user", content: "지시: 머리" }], 100, {
      provider: "openai",
      model: "gpt-5.6",
      promptCache: { key: "paid-reading:v2:3", prefix: "입력:\n{}\n\n", enabled: false },
    });

    const request = body as unknown as Record<string, unknown>;
    assert.ok(request);
    assert.equal(request.prompt_cache_key, undefined);
    assert.equal(request.prompt_cache_options, undefined);
    const messages = request.messages as Array<{ role: string; content: string }>;
    assert.equal(messages[1].content, "입력:\n{}\n\n지시: 머리");
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of envNames) {
      const value = originalEnv[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("GPT-5.6 원가는 캐시 쓰기 할증을 별도로 계산한다", () => {
  assert.equal(costOf("gpt-5.6", { input: 1000, output: 0, cacheWrite: 1000 }), 0.005);
});
