import "server-only";

// 질문 크레딧과 질문 기록의 DB 층.
//
// 잔액은 lr_users.chat_credits 에 있고 정본은 lr_credit_ledger 다. 증감은 전부
// lr_credit_apply RPC 를 거친다 — 여기서 컬럼을 직접 더하지 않는다. database.ts
// 에 얹지 않고 따로 둔 것은 그 파일이 이미 1,500줄이라서다.

import { databaseError, getSupabaseAdmin } from "@/lib/supabase-admin";
import { mapTransferOrder, TRANSFER_ORDER_COLUMNS, type TransferOrderRecord } from "@/lib/database";
import type { CreditLedgerEntry, CreditReason } from "@/lib/credits";

export async function getCreditBalance(userId: number): Promise<number> {
  const db = getSupabaseAdmin();
  if (!db) return 0;
  const { data, error } = await db.from("lr_users").select("chat_credits").eq("id", userId).maybeSingle();
  if (error) throw databaseError("러빗 잔액 조회", error);
  return Number(data?.chat_credits ?? 0);
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super("INSUFFICIENT_CREDITS");
    this.name = "InsufficientCreditsError";
  }
}

/** 증감 한 건. 모자라면 InsufficientCreditsError. 새 잔액을 돌려준다. */
export async function applyCredit(
  userId: number,
  delta: number,
  reason: CreditReason,
  ref?: string
): Promise<number> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error("러빗 DB 연결이 없습니다.");
  const { data, error } = await db.rpc("lr_credit_apply", {
    p_user_id: userId,
    p_delta: delta,
    p_reason: reason,
    p_ref: ref ?? null,
  });
  if (error) {
    if ((error.message ?? "").includes("INSUFFICIENT_CREDITS")) throw new InsufficientCreditsError();
    throw databaseError("러빗 증감", error);
  }
  return Number(data ?? 0);
}

/**
 * 이 회원이 크레딧을 산 적이 있는가.
 *
 * 첫 구매 할인 팩의 자격을 여기서 가른다. 화면 문구로만 막으면 팩 id 를 아는
 * 사람은 계속 산다 — 결제를 시작하는 두 라우트(포트원·계좌이체)가 모두 이걸
 * 본다.
 *
 * 원장의 purchase 기록으로 센다. 잔액이 아니라 기록이다 — 사서 다 쓴 사람도
 * 첫 구매자가 아니다.
 */
export async function hasPurchasedCredits(userId: number): Promise<boolean> {
  const db = getSupabaseAdmin();
  // DB 가 없으면 확인할 방법이 없다. 막는 쪽으로 기운다 — 로컬에서 할인 팩이
  // 안 보이는 것보다 운영에서 무한히 팔리는 쪽이 나쁘다.
  if (!db) return true;
  const { count, error } = await db
    .from("lr_credit_ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("reason", "purchase");
  if (error) throw databaseError("첫 구매 여부 조회", error);
  return (count ?? 0) > 0;
}

/**
 * 이 회원이 지금까지 사주를 몇 장 열었나.
 *
 * 다음 한 장의 값을 여기서 가른다 (2·4·10러빗). 원장의 reading 기록으로
 * 센다 — 잔액이 아니라 기록이라, 러빗을 다 쓴 사람도 장수는 남는다.
 *
 * DB 가 없으면 0 을 돌려준다. 로컬에서 첫 장 값이 나오는 쪽이,
 * 운영에서 세다 실패해 열람을 막는 것보다 낫다.
 */
export async function countOpenedReadings(userId: number): Promise<number> {
  const db = getSupabaseAdmin();
  if (!db) return 0;
  const { count, error } = await db
    .from("lr_credit_ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("reason", "reading");
  if (error) throw databaseError("열어본 사주 수 조회", error);
  return count ?? 0;
}

export async function listCreditLedger(userId: number, limit = 30): Promise<CreditLedgerEntry[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("lr_credit_ledger")
    .select("id,delta,reason,balance_after,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw databaseError("러빗 내역 조회", error);
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    delta: Number(row.delta),
    reason: String(row.reason) as CreditReason,
    balanceAfter: Number(row.balance_after),
    createdAt: String(row.created_at),
  }));
}

/** 초대 링크 클릭 보상. 지급됐으면 true (기기당 1회, 초대인 하루 상한은 DB 가 센다). */
export async function rewardReferralClick(referralCode: string, deviceKey: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { data, error } = await db.rpc("lr_reward_referral_click", {
    p_referral_code: referralCode,
    p_device_key: deviceKey,
  });
  if (error) throw databaseError("초대 클릭 보상", error);
  return data === true;
}

async function findPendingCreditTransferOrder(userId: number): Promise<TransferOrderRecord | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("lr_orders")
    .select(TRANSFER_ORDER_COLUMNS)
    .eq("user_id", userId)
    .eq("kind", "chat_credits")
    .eq("method", "transfer")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw databaseError("러빗 이체 대기 주문 조회", error);
  return data ? mapTransferOrder(data as Record<string, unknown>) : null;
}

export async function createPendingCreditTransferOrder(input: {
  userId: number;
  packId: string;
  credits: number;
  amount: number;
  depositorCode: string;
}): Promise<TransferOrderRecord | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const existing = await findPendingCreditTransferOrder(input.userId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("lr_orders")
    .insert({
      user_id: input.userId,
      reading_id: null,
      kind: "chat_credits",
      method: "transfer",
      status: "pending",
      amount: input.amount,
      depositor_code: input.depositorCode,
      metadata: { packId: input.packId, credits: input.credits, requested_at: now },
      updated_at: now,
    })
    .select(TRANSFER_ORDER_COLUMNS)
    .maybeSingle();
  // 대기 주문은 한 사람에 하나다 (lr_orders_pending_transfer_chat_key). 경쟁하면 그것을 돌려준다.
  if (error?.code === "23505") return findPendingCreditTransferOrder(input.userId);
  if (error) throw databaseError("러빗 계좌이체 승인 요청 저장", error);
  return data ? { ...mapTransferOrder(data as Record<string, unknown>), created: true } : null;
}

export async function completeCreditOrder(
  providerOrderId: string,
  userId: number
): Promise<{ orderId: number; creditsRemaining: number } | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.rpc("lr_complete_chat_credit_order", {
    p_provider_order_id: providerOrderId,
    p_user_id: userId,
  });
  if (error) throw databaseError("러빗 결제 완료", error);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return { orderId: Number(row.order_id), creditsRemaining: Number(row.credits_remaining) };
}

/**
 * 회원 탈퇴 — 개인정보를 지우고 거래 기록은 남긴다.
 *
 * 무엇을 지우고 무엇을 남기는지는 DB 함수가 정한다(lr_delete_account).
 * 규칙을 여기 옮겨 적으면 두 벌이 되고, 컬럼이 늘 때 한쪽만 고쳐진다.
 *
 * 같은 요청이 두 번 와도 안전하다 — 두 번째는 alreadyDeleted 로 돌아온다.
 */
export async function deleteAccount(
  userId: number
): Promise<{ deleted?: boolean; alreadyDeleted?: boolean; readingsCleared?: number }> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error("탈퇴 DB 연결이 없습니다.");
  const { data, error } = await db.rpc("lr_delete_account", { p_user_id: userId });
  if (error) throw databaseError("회원 탈퇴", error);
  return (data ?? {}) as { deleted?: boolean; alreadyDeleted?: boolean; readingsCleared?: number };
}

// ── 질문 ─────────────────────────────────────────────────────────────────────

export interface QuestionRecord {
  id: string;
  question: string;
  answer: string | null;
  readingIds: string[];
  status: "pending" | "answered" | "failed";
  createdAt: string;
  answeredAt: string | null;
}

function mapQuestion(row: Record<string, unknown>): QuestionRecord {
  return {
    id: String(row.id),
    question: String(row.question),
    answer: typeof row.answer === "string" ? row.answer : null,
    readingIds: Array.isArray(row.reading_ids) ? row.reading_ids.map(String) : [],
    status: row.status === "answered" || row.status === "failed" ? row.status : "pending",
    createdAt: String(row.created_at),
    answeredAt: typeof row.answered_at === "string" ? row.answered_at : null,
  };
}

export async function createQuestion(input: {
  userId: number;
  question: string;
  readingIds: string[];
}): Promise<QuestionRecord | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("lr_questions")
    .insert({ user_id: input.userId, question: input.question, reading_ids: input.readingIds })
    .select("*")
    .maybeSingle();
  if (error) throw databaseError("질문 저장", error);
  return data ? mapQuestion(data as Record<string, unknown>) : null;
}

export async function settleQuestion(
  id: string,
  outcome: { answer: string } | { failed: true }
): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  const patch =
    "answer" in outcome
      ? { answer: outcome.answer, status: "answered", answered_at: new Date().toISOString() }
      : { status: "failed" };
  const { error } = await db.from("lr_questions").update(patch).eq("id", id);
  if (error) throw databaseError("질문 마감", error);
}

export async function listQuestions(userId: number, limit = 20): Promise<QuestionRecord[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("lr_questions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw databaseError("질문 목록 조회", error);
  return (data ?? []).map((row) => mapQuestion(row as Record<string, unknown>));
}

/** 이 리딩에 이미 답한 질문이 있는가 — 리딩당 무료 1회를 서버가 센다. */
export async function countQuestionsForReading(userId: number, readingId: string): Promise<number> {
  const db = getSupabaseAdmin();
  if (!db) return 0;
  const { count, error } = await db
    .from("lr_questions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .contains("reading_ids", [readingId])
    .neq("status", "failed");
  if (error) throw databaseError("리딩 질문 수 조회", error);
  return count ?? 0;
}

export interface ContextReading {
  id: string;
  category: string;
  full: string;
  chart: { me: string; partner: string | null };
  createdAt: string;
}

/**
 * 답변의 근거가 될 해금 리딩 — 본인 것, 최근 순, 전문 포함.
 *
 * 상대 사주는 리딩 본문 안에 이미 녹아 있는 범위까지만 딸려 간다. 여기서 상대
 * 생년월일을 따로 꺼내 주지 않는다 — 저장된 상대 정보를 다시 쓰지 않는 것이 규칙이다.
 */
export async function listUnlockedReadingsForContext(userId: number, limit = 3): Promise<ContextReading[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("lr_readings")
    .select("id,category,full_text,chart,created_at")
    .eq("user_id", userId)
    .eq("unlocked", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw databaseError("질문 근거 리딩 조회", error);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    category: String(row.category),
    full: String(row.full_text),
    chart: (row.chart ?? { me: "", partner: null }) as ContextReading["chart"],
    createdAt: String(row.created_at),
  }));
}

/**
 * (reason, ref) 원장 기록이 이미 있는가 — 웹툰 해금처럼 원장 자체가
 * 해금 상태의 정본인 곳에서 쓴다. unique 인덱스가 이중 차감을 막는다.
 */
export async function hasLedgerRef(userId: number, reason: CreditReason, ref: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { count, error } = await db
    .from("lr_credit_ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("reason", reason)
    .eq("ref", ref);
  if (error) throw databaseError("원장 ref 조회", error);
  return (count ?? 0) > 0;
}
