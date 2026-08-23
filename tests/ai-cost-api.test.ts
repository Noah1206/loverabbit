import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { NextRequest } from "next/server";

import { POST } from "../src/app/api/admin/ai-cost/route";
import { costBreakdownOf } from "../src/lib/ai-pricing";

const previousAdminKey = process.env.ADMIN_APPROVAL_KEY;
const previousModel = process.env.OPENAI_MODEL;
const adminKey = "test-admin-key-123456789";

before(() => {
  process.env.ADMIN_APPROVAL_KEY = adminKey;
  process.env.OPENAI_MODEL = "gpt-5.6";
});

after(() => {
  if (previousAdminKey === undefined) delete process.env.ADMIN_APPROVAL_KEY;
  else process.env.ADMIN_APPROVAL_KEY = previousAdminKey;
  if (previousModel === undefined) delete process.env.OPENAI_MODEL;
  else process.env.OPENAI_MODEL = previousModel;
});

function request(body: unknown, authorized = true) {
  return new NextRequest("http://localhost/api/admin/ai-cost", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorized ? { authorization: `Bearer ${adminKey}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

test("GPT-5.6 promo rates split fresh, cached, cache-write, and output costs", () => {
  const result = costBreakdownOf("gpt-5.6", {
    input: 1_000,
    cached: 500,
    cacheWrite: 250,
    output: 100,
  });

  assert.deepEqual(result?.ratesUsdPerMillion, {
    freshInput: 4,
    cachedInput: 0.4,
    cacheWrite: 5,
    output: 20,
  });
  assert.equal(result?.usd.total, 0.00445);
});

test("cost estimate API never calls fetch or creates a billable request", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("network must not be called");
  }) as typeof fetch;

  try {
    const response = await POST(
      request({
        calls: 2,
        inputTokens: 1_000,
        cachedTokens: 500,
        cacheWriteTokens: 250,
        outputTokens: 100,
      })
    );
    const json = await response.json();

    assert.equal(response.status, 200);
    assert.equal(fetchCalls, 0);
    assert.equal(json.mode, "estimate-only");
    assert.equal(json.openAiApiCalled, false);
    assert.equal(json.openAiBillable, false);
    assert.equal(json.model, "gpt-5.6");
    assert.equal(json.usd.total, 0.0089);
    assert.equal(json.krw.rounded, 13);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cost estimate API requires admin auth and rejects overlapping input buckets", async () => {
  const unauthorized = await POST(request({}, false));
  assert.equal(unauthorized.status, 401);

  const invalid = await POST(
    request({ inputTokens: 100, cachedTokens: 80, cacheWriteTokens: 30, outputTokens: 0 })
  );
  assert.equal(invalid.status, 400);
});
