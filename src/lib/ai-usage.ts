// 모델 호출의 값을 남긴다.
//
// 청구서가 $1.84 였는데 저장소가 셀 수 있는 것은 $0.35 였다. 다섯 배 차이인데
// 어디서 났는지 알 방법이 없었다 — usage 를 응답에서 받아 쓰면서 어디에도 남기지
// 않았기 때문이다. 재생성인지, 가드 재작성인지, 실패한 호출인지 사후에 못 가린다.
//
// **기록이 리딩을 막지 않는다.** 여기서 실패해도 조용히 삼킨다. 돈은 이미 나갔고,
// 장부를 못 적었다고 산 사람의 글까지 막을 이유는 없다.

import "server-only";

import { costOf } from "@/lib/ai-pricing";
import type { ChatUsage } from "@/lib/ai";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** 어느 길에서 난 값인가 */
export type UsageStage = "free_preview" | "reading" | "unlock" | "rewrite" | "chat";

export interface UsageRecord {
  readingId?: string | null;
  stage: UsageStage;
  category?: string | null;
  provider?: string | null;
  model?: string | null;
  /** 이 줄이 대표하는 호출 수. 조각을 묶어 한 줄로 남길 때가 있다. */
  calls: number;
  usage: ChatUsage | null;
}

/**
 * 한 줄 남긴다. 실패해도 던지지 않는다.
 *
 * await 를 붙이든 안 붙이든 호출부가 느려지지 않게, 실패는 여기서 끝낸다.
 */
export async function recordAiUsage(record: UsageRecord): Promise<void> {
  try {
    const db = getSupabaseAdmin();
    if (!db) return;

    const usage = record.usage;
    const { error } = await db.from("lr_ai_usage").insert({
      reading_id: record.readingId ?? null,
      stage: record.stage,
      category: record.category ?? null,
      provider: record.provider ?? null,
      model: record.model ?? null,
      calls: Math.max(0, Math.round(record.calls)),
      input_tokens: Math.max(0, usage?.input ?? 0),
      cached_tokens: Math.max(0, usage?.cached ?? 0),
      output_tokens: Math.max(0, usage?.output ?? 0),
      // 단가를 모르는 모델이면 null 로 남는다. 0 으로 적으면 "공짜였다" 는
      // 거짓말이 되고, 그 거짓말은 합계에서 조용히 섞인다.
      cost_usd: costOf(record.model, usage),
    });
    if (error) console.error("사용량 기록 실패:", error.message);
  } catch (error) {
    console.error("사용량 기록 실패:", error);
  }
}
