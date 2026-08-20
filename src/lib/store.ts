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
    method: "toss-pg" | "transfer" | "mock" | "referral";
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
