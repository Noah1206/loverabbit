import "server-only";

// 리딩 저장소 — Supabase를 기본으로 사용하고 로컬 개발에서만 파일로 폴백한다.
// 결제 전에는 풀 리딩이 클라이언트로 절대 나가지 않게 하는 핵심 서버 모듈.
import { promises as fs } from "fs";
import path from "path";
import { databaseError, getSupabaseAdmin } from "@/lib/supabase-admin";
import { PRODUCT_MAP } from "@/lib/products";
import { resolveAdOffer } from "@/lib/ad-offers";
import type { SealedScore } from "@/lib/saju-score";

const DIR = path.join(process.cwd(), "data", "readings");

// 기본가 — 카탈로그에 없는 카테고리로 들어온 리딩의 폴백.
export const READING_PRICE = 9900;

// 상품별 판매가는 카탈로그(products.ts)가 단일 소스다.
export function priceFor(category: string, offerId?: string | null): number {
  const offer = resolveAdOffer(category, offerId);
  if (offer) return offer.price;
  return PRODUCT_MAP[category]?.price ?? READING_PRICE;
}

export interface StoredReading {
  id: string;
  userId?: number;
  createdAt: string;
  category: string;
  teaser: string;
  full: string;
  chart: { me: string; partner: string | null };
  provider: string;
  price: number;
  score?: number;
  scoreLabel?: string | null;
  /**
   * 발급 시점에 봉인된 지수. 지수는 대운·세운을 보므로 해가 바뀌면 값이 달라지는데,
   * 이미 판 리딩의 숫자는 변하면 안 된다. 그래서 계산은 발급 때 한 번만 하고,
   * 값·구간·근거·본 운(asOf)을 통째로 여기 남긴다. 이후 조회는 전부 이걸 읽는다.
   */
  scoreSeal?: SealedScore | null;
  unlocked: boolean;
  // 결제 기록 — 계좌이체는 입금코드로 통장 내역과 사후 대조한다
  payment?: {
    method: "toss-pg" | "portone-pg" | "transfer" | "mock" | "referral";
    depositorCode?: string;
    referredUserId?: number;
    at: string;
  };
}

interface ReadingRow {
  id: string;
  user_id: number | null;
  category: string;
  teaser: string;
  full_text: string;
  chart: StoredReading["chart"];
  provider: string;
  price: number;
  score: number | null;
  score_label: string | null;
  score_seal: SealedScore | null;
  unlocked: boolean;
  payment: StoredReading["payment"] | null;
  created_at: string;
}

function fromRow(row: ReadingRow): StoredReading {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    createdAt: row.created_at,
    category: row.category,
    teaser: row.teaser,
    full: row.full_text,
    chart: row.chart,
    provider: row.provider,
    price: row.price,
    score: row.score ?? undefined,
    scoreLabel: row.score_label,
    scoreSeal: row.score_seal ?? null,
    unlocked: row.unlocked,
    payment: row.payment ?? undefined,
  };
}

function fileOf(id: string): string | null {
  // UUID 형식만 허용 — 경로 조작 방지
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return null;
  return path.join(DIR, `${id}.json`);
}

export async function saveReading(r: StoredReading): Promise<void> {
  const db = getSupabaseAdmin();
  if (db) {
    const { error } = await db.from("lr_readings").upsert(
      {
        id: r.id,
        user_id: r.userId ?? null,
        category: r.category,
        teaser: r.teaser,
        full_text: r.full,
        chart: r.chart,
        provider: r.provider,
        price: r.price,
        score: r.score ?? null,
        score_label: r.scoreLabel ?? null,
        score_seal: r.scoreSeal ?? null,
        unlocked: r.unlocked,
        payment: r.payment ?? null,
        created_at: r.createdAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) throw databaseError("리딩 저장", error);
    return;
  }

  if (process.env.NODE_ENV === "production" && process.env.ALLOW_FILE_STORE !== "true") {
    throw new Error("Supabase 환경변수가 없어 운영 리딩을 저장할 수 없습니다.");
  }

  await fs.mkdir(DIR, { recursive: true });
  const f = fileOf(r.id);
  if (!f) throw new Error("invalid reading id");
  await fs.writeFile(f, JSON.stringify(r), "utf8");
}

/**
 * 내 리딩 목록 — 계정으로 묶인 리딩을 DB 에서 읽는다.
 *
 * 보관함(localStorage)은 기기 하나에 갇힌다. 폰으로 결제한 사람이 PC 에서 열거나
 * 브라우저 데이터를 지우면 돈 낸 리딩이 "찾을 수 없음"이 됐다. DB 가 정본이다.
 *
 * full_text 는 여기서 절대 선택하지 않는다. 목록은 미결제 리딩도 담는데,
 * 전문이 실리는 순간 결제 전에 풀 리딩이 새는 구멍이 된다. 전문은 해금 검증을
 * 거치는 /api/unlock 한 곳으로만 나간다.
 */
export interface ReadingListItem {
  id: string;
  category: string;
  teaser: string;
  chart: StoredReading["chart"];
  price: number;
  scoreLabel: string | null;
  unlocked: boolean;
  createdAt: string;
}

export async function listReadingsByUser(userId: number, limit = 50): Promise<ReadingListItem[]> {
  const db = getSupabaseAdmin();
  // 파일 폴백에는 사용자별 색인이 없다. 로컬 개발은 로컬 보관함으로 충분하다.
  if (!db) return [];
  const { data, error } = await db
    .from("lr_readings")
    .select("id,category,teaser,chart,price,score_label,unlocked,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw databaseError("내 리딩 목록 조회", error);
  return ((data ?? []) as {
    id: string; category: string; teaser: string; chart: StoredReading["chart"];
    price: number; score_label: string | null; unlocked: boolean; created_at: string;
  }[]).map((row) => ({
    id: row.id,
    category: row.category,
    teaser: row.teaser,
    chart: row.chart,
    price: row.price,
    scoreLabel: row.score_label,
    unlocked: row.unlocked === true,
    createdAt: row.created_at,
  }));
}
export async function getReading(id: string): Promise<StoredReading | null> {
  const f = fileOf(id);
  if (!f) return null;

  const db = getSupabaseAdmin();
  if (db) {
    const { data, error } = await db
      .from("lr_readings")
      .select("id,user_id,category,teaser,full_text,chart,provider,price,score,score_label,score_seal,unlocked,payment,created_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw databaseError("리딩 조회", error);
    return data ? fromRow(data as ReadingRow) : null;
  }

  try {
    return JSON.parse(await fs.readFile(f, "utf8")) as StoredReading;
  } catch {
    return null;
  }
}

/**
 * 주인 없는 리딩을 계정에 붙인다.
 *
 * 무료 미리보기는 로그인 없이 만들어진다(2026-08-25). 그 리딩은 user_id 가 비어
 * 있고 기기 보관함에만 산다. 결제를 시작하는 순간 - 주문이 생기는 순간 - 그때의
 * 계정에 붙여 둔다. 계좌이체 승인 RPC(lr_review_transfer_order)는 user_id 를
 * 건드리지 않으므로, 여기서 안 붙이면 입금 승인 뒤 다른 기기에서 열 때
 * "내 리딩"에 없다.
 *
 * 이미 주인이 있는 리딩은 절대 바꾸지 않는다(.is user_id null). 호출부는 그
 * 전에 "주인이 있으면 나여야 한다"를 따로 검사한다.
 */
export async function claimReading(id: string, userId: number): Promise<void> {
  const db = getSupabaseAdmin();
  if (db) {
    const { error } = await db
      .from("lr_readings")
      .update({ user_id: userId, updated_at: new Date().toISOString() })
      .eq("id", id)
      .is("user_id", null);
    if (error) throw databaseError("리딩 귀속", error);
    return;
  }
  const r = await getReading(id);
  if (!r || r.userId) return;
  r.userId = userId;
  await saveReading(r);
}

export async function markUnlocked(
  id: string,
  payment: StoredReading["payment"],
  userId?: number
): Promise<StoredReading | null> {
  const db = getSupabaseAdmin();
  if (db) {
    const updates: Record<string, unknown> = {
      unlocked: true,
      payment,
      updated_at: new Date().toISOString(),
    };
    if (userId) updates.user_id = userId;

    const { data, error } = await db
      .from("lr_readings")
      .update(updates)
      .eq("id", id)
      .select("id,user_id,category,teaser,full_text,chart,provider,price,score,score_label,score_seal,unlocked,payment,created_at")
      .maybeSingle();
    if (error) throw databaseError("리딩 해금", error);
    return data ? fromRow(data as ReadingRow) : null;
  }

  const r = await getReading(id);
  if (!r) return null;
  r.unlocked = true;
  r.payment = payment;
  await saveReading(r);
  return r;
}

/**
 * 리딩을 열었다고 표시한다.
 *
 * **세는 일이 읽는 일을 막지 않는다.** 실패해도 던지지 않고 조용히 삼킨다 —
 * 장부를 못 적었다고 돈 낸 사람의 글까지 막을 이유가 없다(ai-usage.ts 와 같은 규칙).
 *
 * **호출부는 await 해야 한다.** void 로 던지면 응답을 돌려준 뒤 서버리스 함수가
 * 얼어붙어 RPC 가 출발도 못 한 채 사라진다. 실패를 안에서 삼키므로 await 해도
 * 응답이 막히지 않는다 — 기다리는 것은 짧은 RPC 하나뿐이다.
 *
 * paid=true 는 전문이 실제로 나간 순간에만 준다. 전문이 나가는 길은 /api/unlock
 * 하나뿐이라 무료 열람과 섞이지 않는다.
 *
 * 파일 폴백(로컬 무설정)에서는 아무것도 하지 않는다. 조회수는 운영에서만 뜻이 있다.
 */
export async function markReadingViewed(id: string, opts?: { paid?: boolean }): Promise<void> {
  try {
    const db = getSupabaseAdmin();
    if (!db || !fileOf(id)) return;
    const { error } = await db.rpc("lr_mark_reading_viewed", {
      p_reading_id: id,
      p_paid: opts?.paid ?? false,
    });
    if (error) console.error("리딩 열람 기록 실패:", error.message);
  } catch (error) {
    console.error("리딩 열람 기록 실패:", error);
  }
}
