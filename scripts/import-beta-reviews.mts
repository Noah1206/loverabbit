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
 * 상품명과 구매 횟수도 붙이지 않는다. 베타 때 상품 이름은 그것 자체가 다른
 * 점술가·다른 서비스를 가리키고, 구매 횟수는 그 플랫폼에서 산 횟수다.
 *
 * 넣는 코드가 여기 있고 src/lib 에 없는 것은 의도다. 앱 코드에 "후기를 만들어
 * 넣는 함수"가 있으면 언젠가 요청 핸들러가 그걸 부른다. 이 길은 사람이 손으로
 * 터미널에서 돌릴 때만 열린다.
 *
 * 몇 번을 돌려도 DB가 이 파일과 같아진다. 없는 것은 넣고, 이미 있는데 표기가
 * 달라진 것은 맞춘다. 작성자·시각·본문으로 만든 import_key 로 같은 후기인지 본다.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

interface RawReview {
  name: string;
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

/**
 * 작성자와 작성 시각이 같으면 같은 후기다. 원본에 고유 번호가 없어서 이걸로 대신한다.
 *
 * 본문은 열쇠에 넣지 않는다. 넣으면 본문을 한 글자만 고쳐도 같은 후기가 낯선
 * 것이 되어 통째로 다시 들어간다 — 상품명으로 한 번, 본문으로 또 한 번 겪을
 * 뻔했다. 사람이 나중에 고칠 수 있는 값은 열쇠에 넣지 마라.
 */
function importKey(review: RawReview): string {
  const seed = `${review.name}|${review.at}`;
  return `beta:${createHash("sha256").update(seed).digest("hex").slice(0, 32)}`;
}

interface Entry {
  import_key: string;
  display_name: string;
  body: string;
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
      body: review.body.trim(),
      created_at: parseKst(review.at as string),
    }));

  // (작성자, 시각)이 겹치면 같은 후기로 보고 엉뚱한 행을 덮어쓴다. 먼저 막는다.
  const pairs = new Map<string, number>();
  for (const entry of parsed) {
    const key = `${entry.display_name}|${entry.created_at}`;
    pairs.set(key, (pairs.get(key) ?? 0) + 1);
  }
  const collided = [...pairs.entries()].filter(([, n]) => n > 1);
  if (collided.length > 0) {
    throw new Error(
      `작성자와 시각이 겹치는 후기가 있어요. 같은 후기로 취급돼 하나가 덮어써집니다: ${collided
        .map(([key]) => key)
        .join(", ")}`
    );
  }

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
    console.log(`  - 건너뜀 (작성 시각 없음): ${review.name} — "${review.body.slice(0, 20)}…"`);
    if (review.note) console.log(`      ${review.note}`);
  }

  if (dryRun) {
    console.log("\n[--dry-run] 실제로 넣지 않았습니다. 들어갈 것 미리보기:");
    for (const entry of entries.slice(0, 5)) {
      console.log(`  ${entry.created_at}  ${entry.display_name}  "${entry.body.slice(0, 24)}"`);
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

  // 이미 들어가 있는 베타 후기를 전부 가져와, 작성자·시각·본문으로 맞춰 본다.
  //
  // import_key 로 찾지 않는 것은 의도다. 열쇠 계산식을 한 번이라도 손대면 같은
  // 후기가 낯선 것이 되어 통째로 다시 들어간다. 사람이 바꿀 수 없는 세 가지로
  // 맞추면 그런 일이 없다. 중복 자체는 import_key 의 unique 제약이 막는다.
  const { data: existing, error: existingError } = await db
    .from("lr_reviews")
    .select("id,import_key,product_label,display_name,purchase_count,body,created_at")
    .eq("source", "beta")
    .limit(1000);
  if (existingError) throw new Error(`기존 베타 후기 확인 실패: ${existingError.message}`);

  const identity = (displayName: string, createdAt: string) =>
    `${displayName}|${new Date(createdAt).getTime()}`;

  const found = new Map<string, Record<string, unknown>>();
  for (const row of existing ?? []) {
    found.set(
      identity(String(row.display_name), String(row.created_at)),
      row as Record<string, unknown>
    );
  }

  const fresh: Entry[] = [];
  const stale: { row: Record<string, unknown>; entry: Entry }[] = [];
  for (const entry of entries) {
    const row = found.get(identity(entry.display_name, entry.created_at));
    if (!row) {
      fresh.push(entry);
      continue;
    }
    // 이미 있는데 파일과 달라진 것. 본문을 다시 쓰거나 상품명을 뗀 경우가 여기 걸린다.
    if (
      row.body !== entry.body ||
      row.product_label !== null ||
      row.purchase_count !== null ||
      row.import_key !== entry.import_key
    ) {
      stale.push({ row, entry });
    }
  }

  for (const { row, entry } of stale) {
    const { error } = await db
      .from("lr_reviews")
      .update({
        body: entry.body,
        product_label: null,
        product_id: null,
        purchase_count: null,
        import_key: entry.import_key,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id as number);
    if (error) throw new Error(`후기 #${row.id} 갱신 실패: ${error.message}`);
    if (row.body !== entry.body) {
      console.log(`  고침 #${row.id}  ${entry.display_name}: "${String(row.body).slice(0, 24)}…" -> "${entry.body.slice(0, 24)}…"`);
    }
  }

  if (fresh.length > 0) {
    const { error } = await db.from("lr_reviews").insert(
      fresh.map((entry) => ({
        ...entry,
        source: "beta",
        product_id: null,
        product_label: null, // 베타 상품명은 다른 서비스를 가리킨다. 붙이지 않는다.
        purchase_count: null, // 베타 플랫폼에서 산 횟수다. 여기 붙일 근거가 없다.
        rating: null, // 원본에 없다. 채우지 마라.
        status: "published",
      }))
    );
    if (error) throw new Error(`베타 후기 저장 실패: ${error.message}`);
  }

  const untouched = entries.length - fresh.length - stale.length;
  console.log(`
넣음 ${fresh.length}건 · 고침 ${stale.length}건 · 그대로 ${untouched}건`);
  if (fresh.length > 0 || stale.length > 0) {
    console.log("홈 후기 섹션에 바로 반영됩니다. /admin/reviews 에서도 확인할 수 있어요.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
