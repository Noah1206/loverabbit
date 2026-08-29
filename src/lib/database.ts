import "server-only";

import { databaseError, getSupabaseAdmin, isDatabaseConfigured } from "@/lib/supabase-admin";
import { PRODUCT_MAP } from "@/lib/products";
import { maskName, type ReviewSource, type ReviewStatus } from "@/lib/reviews";
import { isCouponUsable, toCouponKind, type Coupon } from "@/lib/coupons";

export interface DatabaseUser {
  id: number;
  email: string;
  birthdate: string | null;
  marketingConsent: boolean;
  referralCode: string;
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

/**
 * 쿠폰 보상의 DB 값. 캐릭터챗 시절 이름이 그대로 남았다 — lr_referrals 의
 * reward_type 체크 제약과, 그 행이 생길 때 5,000원 쿠폰을 발행하는 트리거
 * (lr_issue_referral_coupon)가 이 문자열에 걸려 있다. 이름을 바꾸려면
 * 마이그레이션이 먼저다. 실제 보상은 쿠폰이다.
 */
export const REFERRAL_COUPON_REWARD = "chat_credits";

export type ReferralRewardType = "reading_unlock" | typeof REFERRAL_COUPON_REWARD;

export interface ReferralStatus {
  referralCode: string;
  readingUnlocked: boolean;
}

export type OrderKind = "reading" | "membership";
export type OrderMethod = "transfer" | "toss-pg" | "portone-pg" | "mock";
export type OrderStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded";

export interface DatabaseOrder {
  userId: number;
  readingId: string | null;
  kind: OrderKind;
  method: OrderMethod;
  status: OrderStatus;
  amount: number;
  providerOrderId: string | null;
  metadata: Record<string, unknown>;
}

export interface TransferOrderRecord {
  id: number;
  userId: number;
  readingId: string | null;
  kind: OrderKind;
  email: string | null;
  category: string | null;
  status: OrderStatus;
  amount: number;
  depositorCode: string | null;
  createdAt: string;
  paidAt: string | null;
  metadata: Record<string, unknown>;
  /** 이 호출에서 새로 만들어졌는지. 이미 대기 중이던 주문이 돌아오면 false — 알림을 다시 보내지 않기 위해 */
  created?: boolean;
}

const SOCIAL_USER_COLUMNS =
  "id,email,birthdate,marketing_consent,referral_code,auth_user_id,auth_provider";

function mapSocialUser(data: Record<string, unknown>): DatabaseSocialUser {
  const provider = data.auth_provider;
  return {
    id: Number(data.id),
    email: String(data.email),
    birthdate: typeof data.birthdate === "string" ? data.birthdate : null,
    marketingConsent: Boolean(data.marketing_consent),
    referralCode: String(data.referral_code),
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
    .select("id,email,birthdate,marketing_consent,referral_code")
    .single();

  if (error) throw databaseError("사용자 저장", error);
  return {
    id: Number(data.id),
    email: data.email,
    birthdate: data.birthdate,
    marketingConsent: data.marketing_consent,
    referralCode: data.referral_code,
  };
}

export async function signupDatabaseUser(input: {
  email: string;
  birthdate: string | null;
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
    p_adult_verified_at: input.adultVerifiedAt ?? null,
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
    birthdate: typeof result.birthdate === "string" ? result.birthdate : null,
    marketingConsent: Boolean(result.marketingConsent),
    referralCode: String(result.referralCode),
    isNew: Boolean(result.isNew),
    referralClaimed: Boolean(result.referralClaimed),
  };
}

export async function saveUserSajuProfile(
  userId: number,
  input: {
    birthdate: string;
    birthHour: number | null;
    birthTimeUnknown: boolean;
    gender: "F" | "M";
  }
): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error("회원 DB가 연결되지 않았어요.");

  const { error } = await db.rpc("lr_save_saju_profile", {
    p_user_id: userId,
    p_birthdate: input.birthdate,
    p_birth_hour: input.birthHour,
    p_birth_time_unknown: input.birthTimeUnknown,
    p_gender: input.gender,
  });
  if (error) throw databaseError("사주 기본 정보 저장", error);
}

export interface SajuProfile {
  birthdate: string;
  birthHour: number | null;
  birthTimeUnknown: boolean;
  gender: "F" | "M" | null;
}

/**
 * 저장해 둔 사주 기본 정보를 읽는다.
 *
 * 한번 받아 둔 생년월일을 다음 리딩에서 다시 묻지 않기 위한 눈이다.
 */
export async function getUserSajuProfile(userId: number): Promise<SajuProfile | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from("lr_user_profiles")
    .select("saju_birthdate,saju_birth_hour,saju_birth_time_unknown,saju_gender")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw databaseError("사주 기본 정보 조회", error);
  if (!data?.saju_birthdate) return null;

  return {
    birthdate: String(data.saju_birthdate),
    birthHour: data.saju_birth_hour === null ? null : Number(data.saju_birth_hour),
    birthTimeUnknown: Boolean(data.saju_birth_time_unknown),
    gender: data.saju_gender === "F" || data.saju_gender === "M" ? data.saju_gender : null,
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
    .select("referral_code")
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
    readingUnlocked: Boolean(reading?.unlocked),
  };
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
      reward_amount: 0,
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
  }
  // 쿠폰 보상은 여기서 주지 않는다 — lr_referrals 행이 생기면 DB 트리거가
  // 5,000원 쿠폰을 발행한다.

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
    .select("user_id,reading_id,kind,method,status,amount,provider_order_id,metadata")
    .eq("provider_order_id", providerOrderId)
    .maybeSingle();
  if (error) throw databaseError("주문 조회", error);
  if (!data) return null;
  return {
    userId: Number(data.user_id),
    readingId: data.reading_id ?? null,
    kind: data.kind as OrderKind,
    method: data.method as OrderMethod,
    status: data.status as OrderStatus,
    amount: Number(data.amount),
    providerOrderId: data.provider_order_id ?? null,
    metadata:
      data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
        ? (data.metadata as Record<string, unknown>)
        : {},
  };
}

const TRANSFER_ORDER_COLUMNS =
  "id,user_id,reading_id,kind,status,amount,depositor_code,metadata,created_at,paid_at";

function mapTransferOrder(
  row: Record<string, unknown>,
  email: string | null = null,
  category: string | null = null
): TransferOrderRecord {
  const status = row.status;
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    readingId: typeof row.reading_id === "string" ? row.reading_id : null,
    kind: row.kind === "membership" ? row.kind : "reading",
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
  /** 어느 광고가 팔았는지 등, 주문에 함께 남길 것 */
  metadata?: Record<string, unknown>;
}): Promise<TransferOrderRecord | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const existing = await findPendingTransferOrder(input.userId, input.readingId);
  if (existing) return { ...existing, created: false };

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
      metadata: { requested_at: now, ...input.metadata },
      updated_at: now,
    })
    .select(TRANSFER_ORDER_COLUMNS)
    .maybeSingle();

  if (error?.code === "23505") {
    const raced = await findPendingTransferOrder(input.userId, input.readingId);
    return raced ? { ...raced, created: false } : null;
  }
  if (error) throw databaseError("계좌이체 승인 요청 저장", error);
  return data ? { ...mapTransferOrder(data as Record<string, unknown>), created: true } : null;
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
    .eq("method", "transfer")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw databaseError("승인 대기 주문 목록 조회", error);

  const rows = (data ?? []) as Record<string, unknown>[];
  const userIds = [...new Set(rows.map((row) => Number(row.user_id)).filter(Number.isFinite))];
  const readingIds = [
    ...new Set(
      rows
        .map((row) => (typeof row.reading_id === "string" ? row.reading_id : null))
        .filter((value): value is string => Boolean(value))
    ),
  ];

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
): Promise<{ orderId: number; readingId: string | null; status: "paid" | "cancelled" } | null> {
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
    readingId: typeof row.reading_id === "string" ? row.reading_id : null,
    status: row.review_status === "cancelled" ? "cancelled" : "paid",
  };
}

/**
 * 전환 한 건을 보내는 데 필요한 것만.
 *
 * 승인이 끝난 뒤에 부른다. 결제를 요청하던 순간에 떠 둔 값(metadata.meta)이
 * 여기 들어 있고, 그게 없으면 Meta 로 보낼 수 있는 전환도 없다.
 */
export interface OrderConversion {
  orderId: number;
  readingId: string | null;
  category: string | null;
  amount: number;
  /** 결제를 요청한 시각(ms). 광고 성과는 승인 시각이 아니라 이 시각에 붙어야 한다. */
  requestedAtMs: number | null;
  attribution: unknown;
  meta: {
    consent?: boolean;
    fbp?: string;
    fbc?: string;
    ip?: string;
    userAgent?: string;
    at?: number;
  } | null;
}

/**
 * @param ref 숫자면 주문 번호, 문자열이면 결제사 주문 번호(LRP_...)로 찾는다.
 *   계좌이체는 우리 주문 번호로, 포트원은 결제 번호로 가리키는 게 자연스럽다 —
 *   각각 그 경로에서 브라우저와 서버가 함께 아는 값이다.
 */
export async function getOrderConversion(ref: number | string): Promise<OrderConversion | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const query = db.from("lr_orders").select("id,reading_id,amount,metadata,created_at");
  const { data, error } = await (typeof ref === "number"
    ? query.eq("id", ref).maybeSingle()
    // 같은 결제 번호로 pending 과 paid 두 줄이 남는다(결제 완료가 새 줄을 만든다).
    // 스냅샷은 처음 만든 줄에 있으므로 오래된 것부터 본다.
    : query.eq("provider_order_id", ref).order("id", { ascending: true }).limit(1).maybeSingle());
  if (error) throw databaseError("전환 정보 조회", error);
  if (!data) return null;

  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  const meta = metadata.meta && typeof metadata.meta === "object"
    ? (metadata.meta as OrderConversion["meta"])
    : null;

  // 어느 상품이었는지. 광고 소재별 성과를 볼 때 랜딩을 되짚는 데 쓴다.
  let category: string | null = null;
  if (typeof data.reading_id === "string") {
    const { data: reading } = await db
      .from("lr_readings")
      .select("category")
      .eq("id", data.reading_id)
      .maybeSingle();
    category = typeof reading?.category === "string" ? reading.category : null;
  }

  const requestedAt = meta?.at ?? Date.parse(String(data.created_at));
  return {
    orderId: Number(data.id),
    readingId: typeof data.reading_id === "string" ? data.reading_id : null,
    category,
    amount: Number(data.amount),
    requestedAtMs: Number.isFinite(requestedAt) ? Number(requestedAt) : null,
    attribution: metadata.attribution ?? null,
    meta,
  };
}

// ── 문의함 ───────────────────────────────────────────────────────────────────

// "chat" 은 캐릭터챗 시절에 접수된 옛 문의에만 남아 있다. 새 문의는 고를 수 없다.
export type InquiryCategory = "payment" | "reading" | "chat" | "account" | "bug" | "etc";
export type InquiryStatus = "open" | "done";

export interface InquiryRecord {
  id: number;
  userId: number | null;
  userEmail: string | null;
  email: string | null;
  category: InquiryCategory;
  message: string;
  pagePath: string | null;
  status: InquiryStatus;
  adminNote: string | null;
  createdAt: string;
}

const INQUIRY_COLUMNS = "id,user_id,email,category,message,page_path,status,admin_note,created_at";

function mapInquiry(row: Record<string, unknown>, userEmail: string | null = null): InquiryRecord {
  return {
    id: Number(row.id),
    userId: row.user_id === null || row.user_id === undefined ? null : Number(row.user_id),
    userEmail,
    email: typeof row.email === "string" ? row.email : null,
    category: String(row.category) as InquiryCategory,
    message: String(row.message),
    pagePath: typeof row.page_path === "string" ? row.page_path : null,
    status: row.status === "done" ? "done" : "open",
    adminNote: typeof row.admin_note === "string" ? row.admin_note : null,
    createdAt: String(row.created_at),
  };
}

export async function createInquiry(input: {
  userId: number | null;
  email: string | null;
  category: InquiryCategory;
  message: string;
  pagePath: string | null;
}): Promise<InquiryRecord | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("lr_inquiries")
    .insert({
      user_id: input.userId,
      email: input.email,
      category: input.category,
      message: input.message,
      page_path: input.pagePath,
    })
    .select(INQUIRY_COLUMNS)
    .maybeSingle();
  if (error) throw databaseError("문의 저장", error);
  return data ? mapInquiry(data as Record<string, unknown>) : null;
}

/** 도배 방지 — 같은 회원(또는 같은 이메일)이 최근에 보낸 건수를 센다. */
export async function countRecentInquiries(
  who: { userId: number } | { email: string },
  sinceIso: string
): Promise<number> {
  const db = getSupabaseAdmin();
  if (!db) return 0;
  let query = db
    .from("lr_inquiries")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sinceIso);
  query = "userId" in who ? query.eq("user_id", who.userId) : query.eq("email", who.email);
  const { count, error } = await query;
  if (error) throw databaseError("최근 문의 수 확인", error);
  return count ?? 0;
}

export async function listInquiries(status?: InquiryStatus): Promise<InquiryRecord[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  let query = db
    .from("lr_inquiries")
    .select(INQUIRY_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw databaseError("문의 목록 조회", error);

  const rows = (data ?? []) as Record<string, unknown>[];
  const userIds = [...new Set(rows.map((row) => Number(row.user_id)).filter(Number.isFinite))];
  const emailsById = new Map<number, string>();
  if (userIds.length > 0) {
    const { data: users, error: usersError } = await db
      .from("lr_users")
      .select("id,email")
      .in("id", userIds);
    if (usersError) throw databaseError("문의 작성자 조회", usersError);
    for (const user of users ?? []) emailsById.set(Number(user.id), String(user.email));
  }
  return rows.map((row) => mapInquiry(row, emailsById.get(Number(row.user_id)) ?? null));
}

export async function reviewInquiry(
  id: number,
  status: InquiryStatus,
  note?: string
): Promise<InquiryRecord | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (typeof note === "string") patch.admin_note = note.trim() || null;
  const { data, error } = await db
    .from("lr_inquiries")
    .update(patch)
    .eq("id", id)
    .select(INQUIRY_COLUMNS)
    .maybeSingle();
  if (error) throw databaseError("문의 상태 변경", error);
  return data ? mapInquiry(data as Record<string, unknown>) : null;
}

// ── 후기 ─────────────────────────────────────────────────────────────────────
//
// 출처가 둘이다 (lr_reviews.source):
//
//   live  지금 사이트에서 결제하고 리딩을 열어 본 사람이 직접 남긴 것.
//         주인인지·해금됐는지 확인을 화면이 아니라 여기서 한다 — 화면 쪽 검사는
//         요청을 직접 만들면 그냥 지나간다.
//
//   beta  베타 테스트 때 받은 후기를 운영자가 옮겨 담은 것.
//         별점·상품명·구매 횟수가 없다 — 셋 다 여기서 셀 근거가 없는 값이다.
//         넣는 길은 여기에 없다 — scripts/import-beta-reviews.mts 가 자기 클라이언트로
//         직접 넣는다. 앱 코드에 넣는 함수를 두면 언젠가 요청 핸들러가 그걸 부른다.

export interface ReviewRecord {
  id: number;
  source: ReviewSource;
  userId: number | null;
  readingId: string | null;
  displayName: string;
  productId: string | null;
  productLabel: string | null;
  rating: number | null;
  body: string | null;
  purchaseCount: number | null;
  status: ReviewStatus;
  hiddenReason: string | null;
  createdAt: string;
}

export interface AdminReviewRecord extends ReviewRecord {
  importKey: string | null;
}

/** 후기를 남길 자격이 없을 때의 이유 — 화면이 상황에 맞는 문구를 고르라고 구분해 둔다. */
export type ReviewRejection = "not_found" | "not_owner" | "locked" | "already_reviewed";

const REVIEW_COLUMNS =
  "id,source,user_id,reading_id,display_name,product_id,product_label,rating,body,purchase_count,status,hidden_reason,created_at";

function mapReview(row: Record<string, unknown>): ReviewRecord {
  return {
    id: Number(row.id),
    source: row.source === "beta" ? "beta" : "live",
    userId: row.user_id === null || row.user_id === undefined ? null : Number(row.user_id),
    readingId: typeof row.reading_id === "string" ? row.reading_id : null,
    displayName: String(row.display_name),
    productId: typeof row.product_id === "string" ? row.product_id : null,
    productLabel: typeof row.product_label === "string" ? row.product_label : null,
    rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
    body: typeof row.body === "string" ? row.body : null,
    purchaseCount: row.purchase_count === null || row.purchase_count === undefined ? null : Number(row.purchase_count),
    status: row.status === "hidden" ? "hidden" : "published",
    hiddenReason: typeof row.hidden_reason === "string" ? row.hidden_reason : null,
    createdAt: String(row.created_at),
  };
}

/**
 * 리딩을 결제해 본 적이 있는가 — 광고 오퍼(1,900원 미끼)의 자격 검사.
 *
 * 미끼는 첫 구매 전까지만이다 (운영자 결정, 2026-08-22: 광고 보고 온 유저
 * 한정, 유저별 한 번). 오퍼 id 는 광고 URL 에 그대로 실리는 공개값이라,
 * 이 검사가 없으면 링크를 아는 누구든 언제까지고 1,900원에 산다.
 * 대화권만 산 사람은 아직 리딩 첫 구매 전이므로 미끼 대상으로 남긴다.
 */
export async function hasPaidReadingOrder(userId: number): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { count, error } = await db
    .from("lr_orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", "reading")
    .eq("status", "paid")
    .limit(1);
  if (error) throw databaseError("첫 구매 확인", error);
  return (count ?? 0) > 0;
}

/** 이 사람이 결제를 끝낸 주문 수 — 후기의 "N번 구매" 로 굳어진다. */
async function countPaidOrders(userId: number): Promise<number> {
  const db = getSupabaseAdmin();
  if (!db) return 0;
  const { count, error } = await db
    .from("lr_orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "paid");
  if (error) throw databaseError("구매 횟수 확인", error);
  return count ?? 0;
}

/** 표시 이름을 저장 시점에 가려서 굳힌다. 그래서 조회 경로는 이메일을 볼 일이 없다. */
async function maskedNameFor(userId: number): Promise<string> {
  const db = getSupabaseAdmin();
  if (!db) return maskName(null, null);

  const [{ data: user }, { data: profile }] = await Promise.all([
    db.from("lr_users").select("email").eq("id", userId).maybeSingle(),
    db.from("lr_user_profiles").select("display_name").eq("user_id", userId).maybeSingle(),
  ]);

  const displayName = typeof profile?.display_name === "string" ? profile.display_name : null;
  const email = typeof user?.email === "string" ? user.email : null;
  return maskName(displayName, email);
}

/**
 * 후기 저장. 리딩 주인이 아니거나 아직 해금 전이면 저장하지 않고 이유를 돌려준다.
 * 리딩 한 건에 후기는 하나다 (reading_id unique).
 */
export async function createReview(input: {
  userId: number;
  readingId: string;
  rating: number;
  body: string | null;
}): Promise<{ review: ReviewRecord } | { rejected: ReviewRejection }> {
  const db = getSupabaseAdmin();
  if (!db) return { rejected: "not_found" };

  const { data: reading, error: readingError } = await db
    .from("lr_readings")
    .select("id,user_id,category,unlocked")
    .eq("id", input.readingId)
    .maybeSingle();
  if (readingError) throw databaseError("후기 대상 리딩 조회", readingError);
  if (!reading) return { rejected: "not_found" };
  if (Number(reading.user_id) !== input.userId) return { rejected: "not_owner" };
  if (reading.unlocked !== true) return { rejected: "locked" };

  const [purchaseCount, displayName] = await Promise.all([
    countPaidOrders(input.userId),
    maskedNameFor(input.userId),
  ]);

  // 표시용 상품명은 저장 시점에 굳힌다. 나중에 카탈로그에서 이름을 바꿔도
  // 후기에 붙은 이름은 그 사람이 실제로 산 그때의 이름이어야 한다.
  const productId = String(reading.category);
  const productLabel = PRODUCT_MAP[productId]?.title ?? productId;

  const { data, error } = await db
    .from("lr_reviews")
    .insert({
      source: "live",
      user_id: input.userId,
      reading_id: input.readingId,
      display_name: displayName,
      product_id: productId,
      product_label: productLabel,
      rating: input.rating,
      body: input.body,
      purchase_count: Math.max(purchaseCount, 1),
    })
    .select(REVIEW_COLUMNS)
    .maybeSingle();

  // 23505 = unique 위반. 같은 리딩에 두 번째 후기를 쓴 것이다.
  if (error?.code === "23505") return { rejected: "already_reviewed" };
  if (error) throw databaseError("후기 저장", error);
  if (!data) return { rejected: "not_found" };
  return { review: mapReview(data as Record<string, unknown>) };
}

/** 이 리딩에 이미 후기를 썼는지 — 결과 화면이 폼을 띄울지 결정할 때 쓴다. */
export async function getReviewForReading(readingId: string): Promise<ReviewRecord | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("lr_reviews")
    .select(REVIEW_COLUMNS)
    .eq("reading_id", readingId)
    .maybeSingle();
  if (error) throw databaseError("후기 조회", error);
  return data ? mapReview(data as Record<string, unknown>) : null;
}

/**
 * 노출 중인 후기. 홈은 본문이 있는 것만 보여주지만, 평균과 개수는 별점만 남긴
 * 후기까지 모두 세야 실제 만족도가 된다. 그래서 둘을 따로 돌려준다.
 *
 * 평균은 별점이 있는 후기(live)로만 낸다 — 베타 후기에는 별점이 없고, 없는 것을
 * 5점으로 치면 평균이 실제보다 높아진다.
 */
export async function listPublishedReviews(input: {
  limit: number;
  productId?: string;
}): Promise<{
  rows: ReviewRecord[];
  total: number;
  average: number | null;
  ratedCount: number;
}> {
  const db = getSupabaseAdmin();
  if (!db) return { rows: [], total: 0, average: null, ratedCount: 0 };

  let ratingQuery = db.from("lr_reviews").select("rating").eq("status", "published");
  if (input.productId) ratingQuery = ratingQuery.eq("product_id", input.productId);
  const { data: ratings, error: ratingError } = await ratingQuery;
  if (ratingError) throw databaseError("후기 평점 집계", ratingError);

  const all = ratings ?? [];
  const scores = all
    .map((row) => (row.rating === null || row.rating === undefined ? null : Number(row.rating)))
    .filter((score): score is number => score !== null && Number.isFinite(score));
  const average =
    scores.length > 0
      ? Math.round((scores.reduce((sum, n) => sum + n, 0) / scores.length) * 10) / 10
      : null;

  let query = db
    .from("lr_reviews")
    .select(REVIEW_COLUMNS)
    .eq("status", "published")
    .not("body", "is", null)
    .order("created_at", { ascending: false })
    .limit(input.limit);
  if (input.productId) query = query.eq("product_id", input.productId);
  const { data, error } = await query;
  if (error) throw databaseError("후기 목록 조회", error);

  // 뽑는 순서와 보여주는 순서를 나눈다.
  //
  // 뽑을 때는 최신순이어야 한다. limit 이 걸리는 날 잘려 나가는 쪽은 오래된
  // 후기여야지, 방금 받은 후기가 아니다. 오름차순으로 질의하면 정확히 반대가
  // 되어 새 후기가 조용히 사라진다.
  //
  // 그렇게 뽑은 것을 뒤집어 내보낸다. 화면은 오래된 것부터 본다.
  const rows = ((data ?? []) as Record<string, unknown>[]).map(mapReview).reverse();

  return {
    rows,
    total: all.length,
    average,
    ratedCount: scores.length,
  };
}

/** 관리자 화면 — 내려간 것까지 전부 본다. */
export async function listReviewsForAdmin(status?: ReviewStatus): Promise<AdminReviewRecord[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  let query = db
    .from("lr_reviews")
    .select(`${REVIEW_COLUMNS},import_key`)
    .order("created_at", { ascending: false })
    .limit(300);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw databaseError("후기 목록 조회", error);

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    ...mapReview(row),
    importKey: typeof row.import_key === "string" ? row.import_key : null,
  }));
}

/**
 * 후기 내리기·되돌리기.
 *
 * 내릴 때 사유를 반드시 받는 것은 실수가 아니다. 낮은 별점을 조용히 걷어내면
 * 남은 후기 전체가 거짓말이 된다. 도배·욕설·개인정보처럼 댈 수 있는 사유가
 * 있을 때만 내려가야 하고, 그 사유는 기록으로 남는다.
 */
export async function moderateReview(
  id: number,
  status: ReviewStatus,
  reason?: string
): Promise<ReviewRecord | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  patch.hidden_reason = status === "hidden" ? (reason ?? "").trim() : null;
  const { data, error } = await db
    .from("lr_reviews")
    .update(patch)
    .eq("id", id)
    .select(REVIEW_COLUMNS)
    .maybeSingle();
  if (error) throw databaseError("후기 상태 변경", error);
  return data ? mapReview(data as Record<string, unknown>) : null;
}

export { isDatabaseConfigured };

// ── 쿠폰 ──
// 발급은 DB 트리거가 한다(가입·추천 보상). 여기는 읽기와 주문에 붙이기·마감뿐.

const COUPON_COLUMNS =
  "id,kind,discount,fixed_price,expires_at,used_at,reserved_at,order:lr_orders(status,method,created_at)";

function mapCoupon(row: Record<string, unknown>): Coupon {
  const order = row.order && typeof row.order === "object" && !Array.isArray(row.order)
    ? (row.order as Record<string, unknown>)
    : null;
  // 할인 쿠폰은 discount 만, 정액가 쿠폰은 fixed_price 만 차 있다 (DB 제약).
  // 없는 쪽을 0 으로 접으면 "0원 할인"과 구분이 사라지므로 null 로 남긴다.
  return {
    id: String(row.id),
    kind: toCouponKind(row.kind),
    discount: row.discount == null ? null : Number(row.discount),
    fixedPrice: row.fixed_price == null ? null : Number(row.fixed_price),
    expiresAt: String(row.expires_at),
    usedAt: typeof row.used_at === "string" ? row.used_at : null,
    reservedAt: typeof row.reserved_at === "string" ? row.reserved_at : null,
    reservedOrder: order
      ? { status: String(order.status), method: String(order.method), createdAt: String(order.created_at) }
      : null,
  };
}

export async function listUserCoupons(userId: number): Promise<Coupon[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("lr_coupons")
    .select(COUPON_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw databaseError("쿠폰 조회", error);
  return (data ?? []).map((row) => mapCoupon(row as unknown as Record<string, unknown>));
}

/** 이 사람이 지금 쓸 수 있는 쿠폰이면 돌려준다. 남의 것, 쓴 것, 지난 것은 null. */
export async function getUsableCoupon(couponId: string, userId: number): Promise<Coupon | null> {
  const coupons = await listUserCoupons(userId);
  const found = coupons.find((coupon) => coupon.id === couponId);
  return found && isCouponUsable(found) ? found : null;
}

/** 쿠폰을 주문에 붙인다. 결제가 끝나야 소진되고, 주문이 취소되면 풀린다. */
export async function reserveCoupon(couponId: string, userId: number, orderId: number): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  const { error } = await db
    .from("lr_coupons")
    .update({ order_id: orderId, reserved_at: new Date().toISOString() })
    .eq("id", couponId)
    .eq("user_id", userId)
    .is("used_at", null);
  if (error) throw databaseError("쿠폰 예약", error);
}

/**
 * 주문의 결말을 쿠폰에 옮긴다. 결제됐으면 소진, 취소됐으면 놓아 준다.
 * 주문 번호로 찾으므로 metadata 를 읽을 필요가 없다 - 승인·웹훅·토스 어느 길이든 같다.
 */
/** 주문이 세트 주문이면 { userId, bundleId }. metadata.bundle 에 적혀 있다. */
export async function readOrderBundle(orderId: number): Promise<{ userId: number; bundleId: string } | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.from("lr_orders").select("user_id,metadata").eq("id", orderId).maybeSingle();
  if (error) throw databaseError("세트 주문 확인", error);
  const bundleId = (data?.metadata as Record<string, unknown> | null)?.bundle;
  if (!data || typeof bundleId !== "string") return null;
  return { userId: Number(data.user_id), bundleId };
}

/**
 * 세트의 나머지 리딩을 여는 0원 쿠폰. 세트 승인 한 번에 한 번 부른다 —
 * 승인 RPC 가 pending 만 바꾸므로 같은 주문으로 두 번 오지 않는다.
 */
export async function issueBundleCoupons(userId: number, count: number): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db || count <= 0) return;
  const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const rows = Array.from({ length: count }, () => ({
    user_id: userId,
    kind: "bundle",
    discount: null,
    fixed_price: 0,
    expires_at: expiresAt,
  }));
  const { error } = await db.from("lr_coupons").insert(rows);
  if (error) throw databaseError("세트 쿠폰 발급", error);
}

export async function settleCouponsForOrder(orderId: number, outcome: "paid" | "released"): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  const patch =
    outcome === "paid"
      ? { used_at: new Date().toISOString() }
      : { order_id: null, reserved_at: null };
  const { error } = await db
    .from("lr_coupons")
    .update(patch)
    .eq("order_id", orderId)
    .is("used_at", null);
  if (error) throw databaseError("쿠폰 마감", error);
}
