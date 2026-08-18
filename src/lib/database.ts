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

export interface DatabaseSignupResult extends DatabaseUser {
  isNew: boolean;
  referralClaimed: boolean;
}

export type DatabaseAuthProvider = "google" | "kakao" | "x";

export interface DatabaseSocialUser extends DatabaseUser {
  authUserId: string | null;
  authProvider: DatabaseAuthProvider | null;
}

export type ProfileTheme = "dark" | "light";

export interface DatabaseUserProfile {
  theme: ProfileTheme;
  displayName: string | null;
  showMatureLabels: boolean;
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

export interface DatabaseOrder {
  userId: number;
  readingId: string | null;
  status: OrderStatus;
  amount: number;
  providerOrderId: string | null;
}

export interface TransferOrderRecord {
  id: number;
  userId: number;
  readingId: string;
  email: string | null;
  category: string | null;
  status: OrderStatus;
  amount: number;
  depositorCode: string | null;
  createdAt: string;
  paidAt: string | null;
  metadata: Record<string, unknown>;
}

const SOCIAL_USER_COLUMNS =
  "id,email,birthdate,marketing_consent,referral_code,chat_credits,auth_user_id,auth_provider";

function mapSocialUser(data: Record<string, unknown>): DatabaseSocialUser {
  const provider = data.auth_provider;
  return {
    id: Number(data.id),
    email: String(data.email),
    birthdate: String(data.birthdate),
    marketingConsent: Boolean(data.marketing_consent),
    referralCode: String(data.referral_code),
    chatCredits: Number(data.chat_credits ?? 0),
    authUserId: typeof data.auth_user_id === "string" ? data.auth_user_id : null,
    authProvider:
      provider === "google" || provider === "kakao" || provider === "x" ? provider : null,
  };
}

export async function getDatabaseUserByAuthId(authUserId: string): Promise<DatabaseSocialUser | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from("lr_users")
    .select(SOCIAL_USER_COLUMNS)
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw databaseError("소셜 로그인 회원 조회", error);
  return data ? mapSocialUser(data as Record<string, unknown>) : null;
}

export async function getDatabaseUserByEmail(email: string): Promise<DatabaseSocialUser | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from("lr_users")
    .select(SOCIAL_USER_COLUMNS)
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw databaseError("이메일 회원 조회", error);
  return data ? mapSocialUser(data as Record<string, unknown>) : null;
}

export async function linkDatabaseUserAuth(
  userId: number,
  authUserId: string,
  authProvider: DatabaseAuthProvider
): Promise<DatabaseSocialUser | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from("lr_users")
    .update({
      auth_user_id: authUserId,
      auth_provider: authProvider,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .or(`auth_user_id.is.null,auth_user_id.eq.${authUserId}`)
    .select(SOCIAL_USER_COLUMNS)
    .maybeSingle();
  if (error) throw databaseError("소셜 로그인 계정 연결", error);
  return data ? mapSocialUser(data as Record<string, unknown>) : null;
}

export async function getUserProfile(userId: number): Promise<DatabaseUserProfile | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from("lr_user_profiles")
    .select("theme,display_name,show_mature_labels")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw databaseError("프로필 조회", error);
  if (!data) return null;
  return {
    theme: data.theme === "light" ? "light" : "dark",
    displayName: data.display_name ?? null,
    showMatureLabels: Boolean(data.show_mature_labels),
  };
}

export async function saveUserProfile(
  userId: number,
  input: { theme: ProfileTheme; showMatureLabels: boolean }
): Promise<DatabaseUserProfile | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from("lr_user_profiles")
    .upsert(
      {
        user_id: userId,
        theme: input.theme,
        show_mature_labels: input.showMatureLabels,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("theme,display_name,show_mature_labels")
    .single();

  if (error) throw databaseError("프로필 저장", error);
  return {
    theme: data.theme === "light" ? "light" : "dark",
    displayName: data.display_name ?? null,
    showMatureLabels: Boolean(data.show_mature_labels),
  };
}

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

export async function signupDatabaseUser(input: {
  email: string;
  birthdate: string;
  marketingConsent?: boolean;
  adultVerifiedAt?: string;
  referralCode?: string;
  referralReward?: ReferralRewardType;
  referralReadingId?: string;
}): Promise<DatabaseSignupResult | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data, error } = await db.rpc("lr_signup_with_referral", {
    p_email: input.email.trim().toLowerCase(),
    p_birthdate: input.birthdate,
    p_marketing_consent: input.marketingConsent ?? false,
    p_adult_verified_at: input.adultVerifiedAt ?? new Date().toISOString(),
    p_referral_code: input.referralCode?.trim().toUpperCase() || null,
    p_reward_type: input.referralReward ?? null,
    p_reward_reading_id: input.referralReadingId ?? null,
  });

  if (error) throw databaseError("원자적 회원가입", error);
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const result = data as Record<string, unknown>;
  return {
    id: Number(result.id),
    email: String(result.email),
    birthdate: String(result.birthdate),
    marketingConsent: Boolean(result.marketingConsent),
    referralCode: String(result.referralCode),
    chatCredits: Number(result.chatCredits ?? 0),
    isNew: Boolean(result.isNew),
    referralClaimed: Boolean(result.referralClaimed),
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

export async function getOrderByProviderOrderId(
  providerOrderId: string
): Promise<DatabaseOrder | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from("lr_orders")
    .select("user_id,reading_id,status,amount,provider_order_id")
    .eq("provider_order_id", providerOrderId)
    .maybeSingle();
  if (error) throw databaseError("주문 조회", error);
  if (!data) return null;
  return {
    userId: Number(data.user_id),
    readingId: data.reading_id ?? null,
    status: data.status as OrderStatus,
    amount: Number(data.amount),
    providerOrderId: data.provider_order_id ?? null,
  };
}

const TRANSFER_ORDER_COLUMNS =
  "id,user_id,reading_id,status,amount,depositor_code,metadata,created_at,paid_at";

function mapTransferOrder(
  row: Record<string, unknown>,
  email: string | null = null,
  category: string | null = null
): TransferOrderRecord {
  const status = row.status;
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    readingId: String(row.reading_id),
    email,
    category,
    status:
      status === "paid" || status === "failed" || status === "cancelled" || status === "refunded"
        ? status
        : "pending",
    amount: Number(row.amount),
    depositorCode: typeof row.depositor_code === "string" ? row.depositor_code : null,
    createdAt: String(row.created_at),
    paidAt: typeof row.paid_at === "string" ? row.paid_at : null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
  };
}

async function findPendingTransferOrder(userId: number, readingId: string) {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("lr_orders")
    .select(TRANSFER_ORDER_COLUMNS)
    .eq("user_id", userId)
    .eq("reading_id", readingId)
    .eq("kind", "reading")
    .eq("method", "transfer")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw databaseError("대기 중인 계좌이체 주문 조회", error);
  return data ? mapTransferOrder(data as Record<string, unknown>) : null;
}

export async function createPendingTransferOrder(input: {
  userId: number;
  readingId: string;
  amount: number;
  depositorCode: string;
}): Promise<TransferOrderRecord | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const existing = await findPendingTransferOrder(input.userId, input.readingId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("lr_orders")
    .insert({
      user_id: input.userId,
      reading_id: input.readingId,
      kind: "reading",
      method: "transfer",
      status: "pending",
      amount: input.amount,
      depositor_code: input.depositorCode,
      metadata: { requested_at: now },
      updated_at: now,
    })
    .select(TRANSFER_ORDER_COLUMNS)
    .maybeSingle();

  if (error?.code === "23505") {
    return findPendingTransferOrder(input.userId, input.readingId);
  }
  if (error) throw databaseError("계좌이체 승인 요청 저장", error);
  return data ? mapTransferOrder(data as Record<string, unknown>) : null;
}

export async function getTransferOrderForUser(
  orderId: number,
  userId: number
): Promise<TransferOrderRecord | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("lr_orders")
    .select(TRANSFER_ORDER_COLUMNS)
    .eq("id", orderId)
    .eq("user_id", userId)
    .eq("kind", "reading")
    .eq("method", "transfer")
    .maybeSingle();
  if (error) throw databaseError("계좌이체 주문 상태 조회", error);
  return data ? mapTransferOrder(data as Record<string, unknown>) : null;
}

export async function listPendingTransferOrders(): Promise<TransferOrderRecord[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("lr_orders")
    .select(TRANSFER_ORDER_COLUMNS)
    .eq("kind", "reading")
    .eq("method", "transfer")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw databaseError("승인 대기 주문 목록 조회", error);

  const rows = (data ?? []) as Record<string, unknown>[];
  const userIds = [...new Set(rows.map((row) => Number(row.user_id)).filter(Number.isFinite))];
  const readingIds = [...new Set(rows.map((row) => String(row.reading_id)).filter(Boolean))];

  const usersById = new Map<number, string>();
  if (userIds.length > 0) {
    const { data: users, error: usersError } = await db
      .from("lr_users")
      .select("id,email")
      .in("id", userIds);
    if (usersError) throw databaseError("승인 대기 주문 회원 조회", usersError);
    for (const user of users ?? []) usersById.set(Number(user.id), String(user.email));
  }

  const categoriesById = new Map<string, string>();
  if (readingIds.length > 0) {
    const { data: readings, error: readingsError } = await db
      .from("lr_readings")
      .select("id,category")
      .in("id", readingIds);
    if (readingsError) throw databaseError("승인 대기 주문 리딩 조회", readingsError);
    for (const reading of readings ?? []) {
      categoriesById.set(String(reading.id), String(reading.category));
    }
  }

  return rows.map((row) =>
    mapTransferOrder(
      row,
      usersById.get(Number(row.user_id)) ?? null,
      categoriesById.get(String(row.reading_id)) ?? null
    )
  );
}

export async function reviewTransferOrder(
  orderId: number,
  decision: "paid" | "cancelled",
  note?: string
): Promise<{ orderId: number; readingId: string; status: "paid" | "cancelled" } | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.rpc("lr_review_transfer_order", {
    p_order_id: orderId,
    p_decision: decision,
    p_note: note?.trim().slice(0, 500) || null,
  });
  if (error) throw databaseError("계좌이체 주문 승인", error);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return {
    orderId: Number(row.order_id),
    readingId: String(row.reading_id),
    status: row.review_status === "cancelled" ? "cancelled" : "paid",
  };
}

export { isDatabaseConfigured };
