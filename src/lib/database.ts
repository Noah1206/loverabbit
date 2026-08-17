import "server-only";

import { databaseError, getSupabaseAdmin, isDatabaseConfigured } from "@/lib/supabase-admin";

export interface DatabaseUser {
  id: number;
  email: string;
  birthdate: string;
  marketingConsent: boolean;
  referralCode: string;
  chatCredits: number;
}

export type ReferralRewardType = "reading_unlock" | "chat_credits";

export interface ReferralStatus {
  referralCode: string;
  chatCredits: number;
  readingUnlocked: boolean;
}

export type OrderKind = "reading";
export type OrderMethod = "transfer" | "toss-pg" | "mock";
export type OrderStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded";

export async function upsertDatabaseUser(input: {
  email: string;
  birthdate: string;
  marketingConsent?: boolean;
  adultVerifiedAt?: string;
}): Promise<DatabaseUser | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const email = input.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const values: Record<string, unknown> = {
    email,
    birthdate: input.birthdate,
    updated_at: now,
  };
  if (typeof input.marketingConsent === "boolean") {
    values.marketing_consent = input.marketingConsent;
  }
  if (input.adultVerifiedAt) {
    values.adult_verification_method = "self_attested";
    values.adult_verified_at = input.adultVerifiedAt;
  }

  const { data, error } = await db
    .from("lr_users")
    .upsert(values, { onConflict: "email", defaultToNull: false })
    .select("id,email,birthdate,marketing_consent,referral_code,chat_credits")
    .single();

  if (error) throw databaseError("사용자 저장", error);
  return {
    id: Number(data.id),
    email: data.email,
    birthdate: data.birthdate,
    marketingConsent: data.marketing_consent,
    referralCode: data.referral_code,
    chatCredits: Number(data.chat_credits ?? 0),
  };
}

export async function getReferralStatus(
  userId: number,
  readingId?: string
): Promise<ReferralStatus | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const userQuery = db
    .from("lr_users")
    .select("referral_code,chat_credits")
    .eq("id", userId)
    .maybeSingle();
  const readingQuery = readingId
    ? db
        .from("lr_readings")
        .select("unlocked")
        .eq("id", readingId)
        .eq("user_id", userId)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const [{ data: user, error: userError }, { data: reading, error: readingError }] =
    await Promise.all([userQuery, readingQuery]);

  if (userError) throw databaseError("추천 정보 조회", userError);
  if (readingError) throw databaseError("추천 리딩 조회", readingError);
  if (!user) return null;
  return {
    referralCode: user.referral_code,
    chatCredits: Number(user.chat_credits ?? 0),
    readingUnlocked: Boolean(reading?.unlocked),
  };
}

async function changeChatCredits(
  userId: number,
  delta: number
): Promise<number | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  // Compare-and-swap keeps simultaneous reward/usage requests from overwriting each other.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: user, error: readError } = await db
      .from("lr_users")
      .select("chat_credits")
      .eq("id", userId)
      .maybeSingle();
    if (readError) throw databaseError("질문권 조회", readError);
    if (!user) return null;

    const current = Number(user.chat_credits ?? 0);
    const next = current + delta;
    if (next < 0) return null;
    const { data: updated, error: updateError } = await db
      .from("lr_users")
      .update({ chat_credits: next, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("chat_credits", current)
      .select("chat_credits")
      .maybeSingle();
    if (updateError) throw databaseError("질문권 변경", updateError);
    if (updated) return Number(updated.chat_credits);
  }
  throw new Error("질문권 변경이 겹쳤어요. 잠시 후 다시 시도해주세요.");
}

export async function useChatCredit(userId: number): Promise<number | null> {
  return changeChatCredits(userId, -1);
}

export async function restoreChatCredit(userId: number): Promise<number | null> {
  return changeChatCredits(userId, 1);
}

export async function claimReferralReward(input: {
  referredUserId: number;
  referralCode?: string;
  rewardType?: ReferralRewardType;
  rewardReadingId?: string;
}): Promise<{ granted: boolean; rewardType?: ReferralRewardType }> {
  const db = getSupabaseAdmin();
  const code = input.referralCode?.trim().toUpperCase();
  if (!db || !code || !input.rewardType) return { granted: false };

  const { data: referrer, error: referrerError } = await db
    .from("lr_users")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();
  if (referrerError) throw databaseError("추천인 조회", referrerError);
  if (!referrer || Number(referrer.id) === input.referredUserId) return { granted: false };

  const referrerId = Number(referrer.id);
  let readingId: string | null = null;
  if (input.rewardType === "reading_unlock") {
    if (!input.rewardReadingId) return { granted: false };
    const { data: reading, error: readingError } = await db
      .from("lr_readings")
      .select("id")
      .eq("id", input.rewardReadingId)
      .eq("user_id", referrerId)
      .maybeSingle();
    if (readingError) throw databaseError("추천 리딩 확인", readingError);
    if (!reading) return { granted: false };
    readingId = reading.id;
  }

  const { data: referral, error: insertError } = await db
    .from("lr_referrals")
    .insert({
      referrer_user_id: referrerId,
      referred_user_id: input.referredUserId,
      reward_type: input.rewardType,
      reward_reading_id: readingId,
      reward_amount: input.rewardType === "chat_credits" ? 10 : 0,
    })
    .select("id")
    .maybeSingle();
  if (insertError?.code === "23505") return { granted: false };
  if (insertError) throw databaseError("추천 보상 기록", insertError);
  if (!referral) return { granted: false };

  if (input.rewardType === "reading_unlock" && readingId) {
    const { error: unlockError } = await db
      .from("lr_readings")
      .update({
        unlocked: true,
        payment: {
          method: "referral",
          referredUserId: input.referredUserId,
          at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", readingId)
      .eq("user_id", referrerId);
    if (unlockError) throw databaseError("추천 리딩 해금", unlockError);
  } else {
    await changeChatCredits(referrerId, 10);
  }

  return { granted: true, rewardType: input.rewardType };
}

export async function createOrder(input: {
  userId: number;
  readingId?: string;
  kind: OrderKind;
  method: OrderMethod;
  status: OrderStatus;
  amount: number;
  providerOrderId?: string;
  depositorCode?: string;
  metadata?: Record<string, unknown>;
}): Promise<number | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const now = new Date().toISOString();
  const values = {
    user_id: input.userId,
    reading_id: input.readingId ?? null,
    kind: input.kind,
    method: input.method,
    status: input.status,
    amount: input.amount,
    provider_order_id: input.providerOrderId ?? null,
    depositor_code: input.depositorCode ?? null,
    metadata: input.metadata ?? {},
    paid_at: input.status === "paid" ? now : null,
    updated_at: now,
  };
  const query = input.providerOrderId
    ? db.from("lr_orders").upsert(values, { onConflict: "provider_order_id" })
    : db.from("lr_orders").insert(values);
  const { data, error } = await query
    .select("id")
    .single();

  if (error) throw databaseError("주문 저장", error);
  return Number(data.id);
}

export { isDatabaseConfigured };
