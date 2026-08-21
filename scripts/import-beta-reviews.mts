/**
 * 베타 테스트 후기를 lr_reviews 에 옮겨 담는다.
 *
 *   npm run reviews:import -- --dry-run    무엇이 들어갈지만 본다
 *   npm run reviews:import                 실제로 넣는다
 *
 * 원본은 scripts/beta-reviews.json 이고, 거기 있는 것만 들어간다. 없는 값은 채우지
 * 않는다 — 특히 별점. 베타 때는 별점을 받지 않았고, 5점으로 채워 넣으면 홈에
 * 걸리는 평균이 거짓말이 된다.
 *
 * 넣는 코드가 여기 있고 src/lib 에 없는 것은 의도다. 앱 코드에 "후기를 만들어
 * 넣는 함수"가 있으면 언젠가 요청 핸들러가 그걸 부른다. 이 길은 사람이 손으로
 * 터미널에서 돌릴 때만 열린다.
 *
 * 같은 후기를 두 번 넣지 않는다. 작성자·시각·본문으로 만든 import_key 가 이미
 * 있으면 건너뛴다. 그래서 몇 번을 돌려도 결과가 같다.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

interface RawReview {
  name: string;
  purchaseCount: number;
  product: string;
  body: string;
  /** "2026-08-21 17:51" — KST. 원본에서 잘려 모르면 null 이고, 그건 건너뛴다. */
  at: string | null;
  note?: string;
}

const SOURCE = resolve(process.cwd(), "scripts/beta-reviews.json");
const KST_OFFSET = "+09:00";

function parseKst(at: string): string {
  // "2026-08-21 17:51" -> "2026-08-21T17:51:00+09:00" -> UTC ISO
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/.exec(at.trim());
  if (!match) throw new Error(`시각 형식을 읽을 수 없어요: ${at}`);
  const [, y, mo, d, h, mi] = match;
  const parsed = new Date(`${y}-${mo}-${d}T${h.padStart(2, "0")}:${mi}:00${KST_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`시각을 해석할 수 없어요: ${at}`);
  return parsed.toISOString();
}

/** 작성자·시각·상품·본문이 같으면 같은 후기다. 원본에 고유 번호가 없어서 이걸로 대신한다. */
function importKey(review: RawReview): string {
  const seed = `${review.name}|${review.at}|${review.product}|${review.body}`;
  return `beta:${createHash("sha256").update(seed).digest("hex").slice(0, 32)}`;
}

interface Entry {
  import_key: string;
  display_name: string;
  product_label: string;
  body: string;
  purchase_count: number;
  created_at: string;
}

function load(): { entries: Entry[]; total: number; undated: RawReview[]; duplicates: number } {
  const file = JSON.parse(readFileSync(SOURCE, "utf8")) as { reviews: RawReview[] };
  const all = file.reviews ?? [];
  const undated = all.filter((review) => !review.at);

  const parsed: Entry[] = all
    .filter((review) => review.at)
    .map((review) => ({
      import_key: importKey(review),
      display_name: review.name.trim(),
      product_label: review.product.trim(),
      body: review.body.trim(),
      purchase_count: Math.max(Number(review.purchaseCount) || 1, 1),
      created_at: parseKst(review.at as string),
    }));

  // 원본 안에서 완전히 같은 줄이 겹치면 먼저 걸러낸다.
  const seen = new Set<string>();
  const entries = parsed.filter((entry) => {
    if (seen.has(entry.import_key)) return false;
    seen.add(entry.import_key);
    return true;
  });

  return { entries, total: all.length, undated, duplicates: parsed.length - entries.length };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { entries, total, undated, duplicates } = load();

  console.log(`원본 ${total}건 · 넣을 것 ${entries.length}건`);
  if (duplicates > 0) console.log(`  - 원본 안 중복 ${duplicates}건 제외`);
  for (const review of undated) {
    console.log(`  - 건너뜀 (작성 시각 없음): ${review.name} / ${review.product}`);
    if (review.note) console.log(`      ${review.note}`);
  }

  if (dryRun) {
    console.log("\n[--dry-run] 실제로 넣지 않았습니다. 들어갈 것 미리보기:");
    for (const entry of entries.slice(0, 5)) {
      console.log(`  ${entry.created_at}  ${entry.display_name}  | ${entry.product_label}`);
    }
    if (entries.length > 5) console.log(`  ... 외 ${entries.length - 5}건`);
    console.log("\n별점은 원본에 없어 넣지 않습니다 (rating = null).");
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("DB 연결이 없습니다. .env 의 SUPABASE_URL / SUPABASE_SECRET_KEY 를 확인하세요.");
    process.exitCode = 1;
    return;
  }

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: existing, error: existingError } = await db
    .from("lr_reviews")
    .select("import_key")
    .in("import_key", entries.map((entry) => entry.import_key));
  if (existingError) throw new Error(`기존 베타 후기 확인 실패: ${existingError.message}`);

  const already = new Set((existing ?? []).map((row) => String(row.import_key)));
  const fresh = entries.filter((entry) => !already.has(entry.import_key));

  if (fresh.length === 0) {
    console.log(`\n이미 ${entries.length}건 모두 들어가 있습니다. 넣을 것이 없어요.`);
    return;
  }

  const { error } = await db.from("lr_reviews").insert(
    fresh.map((entry) => ({
      ...entry,
      source: "beta",
      product_id: null,
      rating: null, // 원본에 없다. 채우지 마라.
      status: "published",
    }))
  );
  if (error) throw new Error(`베타 후기 저장 실패: ${error.message}`);

  console.log(`\n넣음 ${fresh.length}건 · 이미 있어 건너뜀 ${entries.length - fresh.length}건`);
  console.log("홈 후기 섹션에서 바로 보입니다. /admin/reviews 에서도 확인할 수 있어요.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
