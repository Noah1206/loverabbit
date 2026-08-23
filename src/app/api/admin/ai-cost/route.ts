// 어제부터 오늘까지 모델에 얼마 썼나 — 어느 길에서 났나.
//
//   curl -H "Authorization: Bearer $ADMIN_APPROVAL_KEY" \
//     "https://loverebbit.xyz/api/admin/ai-cost?days=2"
//
// 청구서가 $1.84 였는데 저장소가 셀 수 있는 것은 $0.35 였다. 다섯 배 차이인데
// 어디서 났는지 알 방법이 없었다. 이제 부를 때마다 한 줄 남기므로(lr_ai_usage),
// 여기서 그 줄들을 길별로 더한다 - 무료 미리보기가 얼마고, 결제 뒤 본문이 얼마고,
// 가드가 다시 쓴 몫이 얼마인지.
//
// 청구서와 여전히 안 맞으면, 그 차이는 이 표에 안 들어온 호출이다.

import { NextRequest, NextResponse } from "next/server";

import { adminKeyFromAuthorization, verifyAdminApprovalKey } from "@/lib/admin-auth";
import { costBreakdownOf, priceOf } from "@/lib/ai-pricing";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const KRW_PER_USD = 1450;
const MAX_TOKEN_VALUE = 1_000_000_000;
const MAX_CALLS = 10_000;

interface EstimateBody {
  model?: unknown;
  calls?: unknown;
  inputTokens?: unknown;
  cachedTokens?: unknown;
  cacheWriteTokens?: unknown;
  outputTokens?: unknown;
}

function nonNegativeInteger(value: unknown, fallback: number): number | null {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > MAX_TOKEN_VALUE) {
    return null;
  }
  return value;
}

function rounded(value: number, digits = 8): number {
  return Number(value.toFixed(digits));
}

interface Row {
  stage: string;
  model: string | null;
  calls: number | null;
  input_tokens: number | null;
  cached_tokens: number | null;
  cache_write_tokens: number | null;
  output_tokens: number | null;
  cost_usd: string | number | null;
}

export async function GET(req: NextRequest) {
  if (!verifyAdminApprovalKey(adminKeyFromAuthorization(req.headers.get("authorization")))) {
    return NextResponse.json({ error: "권한이 없어요." }, { status: 401 });
  }
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB 연결이 없어요." }, { status: 503 });

  const raw = Number(req.nextUrl.searchParams.get("days"));
  const days = Number.isFinite(raw) && raw > 0 && raw <= 90 ? Math.floor(raw) : 2;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from("lr_ai_usage")
    .select("stage, model, calls, input_tokens, cached_tokens, cache_write_tokens, output_tokens, cost_usd")
    .gte("created_at", since);
  if (error) {
    // 표가 아직 없을 수 있다. 그 사실을 숨기면 "0원이다" 로 읽힌다.
    return NextResponse.json(
      { error: "사용량 표를 읽지 못했어요. 마이그레이션이 적용됐는지 확인하세요.", detail: error.message },
      { status: 503 }
    );
  }

  const rows = (data ?? []) as Row[];
  const byStage = new Map<
    string,
    { calls: number; input: number; cached: number; cacheWrite: number; output: number; usd: number; unpriced: number }
  >();
  let unpricedRows = 0;

  for (const row of rows) {
    const key = row.stage;
    const bucket = byStage.get(key) ?? {
      calls: 0,
      input: 0,
      cached: 0,
      cacheWrite: 0,
      output: 0,
      usd: 0,
      unpriced: 0,
    };
    bucket.calls += row.calls ?? 0;
    bucket.input += row.input_tokens ?? 0;
    bucket.cached += row.cached_tokens ?? 0;
    bucket.cacheWrite += row.cache_write_tokens ?? 0;
    bucket.output += row.output_tokens ?? 0;
    // 단가를 모르는 줄은 0 으로 더하지 않고 따로 센다. 0 으로 섞으면 합계가 거짓말을 한다.
    if (row.cost_usd === null || row.cost_usd === undefined) {
      bucket.unpriced += 1;
      unpricedRows += 1;
    } else {
      bucket.usd += Number(row.cost_usd);
    }
    byStage.set(key, bucket);
  }

  const stages = [...byStage.entries()]
    .map(([stage, v]) => ({
      stage,
      calls: v.calls,
      inputTokens: v.input,
      cachedTokens: v.cached,
      cacheWriteTokens: v.cacheWrite,
      outputTokens: v.output,
      usd: Number(v.usd.toFixed(5)),
      krw: Math.round(v.usd * KRW_PER_USD),
      unpricedRows: v.unpriced,
    }))
    .sort((a, b) => b.usd - a.usd);

  const totalUsd = stages.reduce((sum, s) => sum + s.usd, 0);

  return NextResponse.json({
    since,
    days,
    rows: rows.length,
    totalUsd: Number(totalUsd.toFixed(5)),
    totalKrw: Math.round(totalUsd * KRW_PER_USD),
    // 단가를 모르는 모델이 섞여 있으면 합계가 실제보다 적다. 숨기지 않는다.
    unpricedRows,
    stages,
  });
}

/**
 * Pure price calculator. This handler never imports or calls the model client,
 * so checking a scenario cannot create an OpenAI charge.
 */
export async function POST(req: NextRequest) {
  if (!verifyAdminApprovalKey(adminKeyFromAuthorization(req.headers.get("authorization")))) {
    return NextResponse.json({ error: "권한이 없어요." }, { status: 401 });
  }

  let body: EstimateBody;
  try {
    body = (await req.json()) as EstimateBody;
  } catch {
    return NextResponse.json({ error: "JSON 요청 본문이 필요해요." }, { status: 400 });
  }

  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : process.env.OPENAI_MODEL?.trim() || "gpt-5.6";
  const calls = nonNegativeInteger(body.calls, 1);
  const input = nonNegativeInteger(body.inputTokens, 0);
  const cached = nonNegativeInteger(body.cachedTokens, 0);
  const cacheWrite = nonNegativeInteger(body.cacheWriteTokens, 0);
  const output = nonNegativeInteger(body.outputTokens, 0);

  if (
    calls === null ||
    calls < 1 ||
    calls > MAX_CALLS ||
    input === null ||
    cached === null ||
    cacheWrite === null ||
    output === null
  ) {
    return NextResponse.json(
      { error: `토큰은 0~${MAX_TOKEN_VALUE.toLocaleString()}, calls는 1~${MAX_CALLS.toLocaleString()} 정수여야 해요.` },
      { status: 400 }
    );
  }
  if (cached + cacheWrite > input) {
    return NextResponse.json(
      { error: "cachedTokens와 cacheWriteTokens의 합은 inputTokens보다 클 수 없어요." },
      { status: 400 }
    );
  }

  const unitPrice = priceOf(model);
  if (!unitPrice) {
    return NextResponse.json({ error: `${model} 단가가 등록되어 있지 않아요.` }, { status: 400 });
  }

  const totalUsage = {
    input: input * calls,
    cached: cached * calls,
    cacheWrite: cacheWrite * calls,
    output: output * calls,
  };
  const breakdown = costBreakdownOf(model, totalUsage);
  if (!breakdown) {
    return NextResponse.json({ error: "비용을 계산하지 못했어요." }, { status: 400 });
  }

  return NextResponse.json({
    mode: "estimate-only",
    openAiApiCalled: false,
    openAiBillable: false,
    model,
    pricingNote: unitPrice.note ?? null,
    calls,
    perCallTokens: { input, cached, cacheWrite, output },
    totalTokens: totalUsage,
    ratesUsdPerMillion: breakdown.ratesUsdPerMillion,
    usd: {
      freshInput: rounded(breakdown.usd.freshInput),
      cachedInput: rounded(breakdown.usd.cachedInput),
      cacheWrite: rounded(breakdown.usd.cacheWrite),
      output: rounded(breakdown.usd.output),
      total: rounded(breakdown.usd.total),
    },
    krw: {
      rate: KRW_PER_USD,
      total: rounded(breakdown.usd.total * KRW_PER_USD, 2),
      rounded: Math.round(breakdown.usd.total * KRW_PER_USD),
    },
  });
}
