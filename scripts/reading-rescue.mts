// 승인은 났는데 글이 안 나온 리딩을 되살린다.
//
// 승인 라우트에 maxDuration 이 없던 동안, 승인 직후 시작된 생성은 플랫폼 기본
// 시간에 잘렸다. 잘린 자리에는 lr_reading_resume.generating_at 표식만 남고,
// 그 표식은 10분간 아무도 못 집게 막는다 — 손님이 열면 "준비 중"(503)만 돈다.
//
// 이 스크립트는 그렇게 묶인 리딩을 찾아 표식을 놓고, 그 자리에서 본문을 마저
// 만든다. 서버리스가 아니라 여기서 돌리므로 시간 제한이 없다.
//
//   npx tsx scripts/reading-rescue.mts                 묶인 것 목록만 (아무것도 안 고침)
//   npx tsx scripts/reading-rescue.mts --fix           전부 이어서 만든다
//   npx tsx scripts/reading-rescue.mts --fix --id <리딩id>
//
// 필요한 환경변수는 앱과 같다 (.env.local — SUPABASE 키와 AI 키).

import { getSupabaseAdmin } from "../src/lib/supabase-admin";
import { getReading } from "../src/lib/store";
import { finishReading } from "../src/lib/reading-finish";
import { releaseGeneration } from "../src/lib/reading-resume";

const FIX = process.argv.includes("--fix");
const idAt = process.argv.indexOf("--id");
const ONLY = idAt >= 0 ? process.argv[idAt + 1] : null;

async function main() {
  const db = getSupabaseAdmin();
  if (!db) throw new Error("SUPABASE 설정이 없습니다 (.env.local 을 불러왔는지 확인하세요).");

  // 해금됐는데 아직 재개 정보가 남아 있는 리딩 = 돈은 냈는데 본문이 안 끝난 것.
  // 완성되면 재개 정보는 지워지므로, 남아 있다는 것 자체가 미완성이라는 뜻이다.
  const { data: pending, error } = await db
    .from("lr_reading_resume")
    .select("reading_id,generating_at");
  if (error) throw error;

  const rows: {
    id: string;
    generatingAt: string | null;
    category: string;
    email: string | null;
    orderId: number | null;
  }[] = [];
  for (const row of pending ?? []) {
    const id = String(row.reading_id);
    if (ONLY && id !== ONLY) continue;
    const reading = await getReading(id);
    if (!reading?.unlocked) continue; // 결제까지 안 간 리딩은 원래 이 상태가 정상이다

    // 누구의 리딩인지 같이 보여준다 — 문의한 손님을 골라내려면 이게 있어야 한다.
    let email: string | null = null;
    let orderId: number | null = null;
    try {
      const { data: order } = await db
        .from("lr_orders")
        .select("id,user_id")
        .eq("reading_id", id)
        .eq("status", "paid")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      orderId = order?.id ? Number(order.id) : null;
      if (order?.user_id) {
        const { data: user } = await db
          .from("lr_users")
          .select("email")
          .eq("id", order.user_id)
          .maybeSingle();
        email = (user?.email as string | undefined) ?? null;
      }
    } catch {
      // 누구인지 못 찾아도 되살리는 데는 지장이 없다.
    }

    rows.push({
      id,
      generatingAt: row.generating_at ?? null,
      category: reading.category ?? "",
      email,
      orderId,
    });
  }

  if (rows.length === 0) {
    console.log("돈은 냈는데 본문이 안 끝난 리딩: 없음");
    return;
  }

  console.log(`돈은 냈는데 본문이 안 끝난 리딩 ${rows.length}건:`);
  for (const row of rows) {
    console.log(
      `  ${row.id}  ${row.category}  주문=${row.orderId ?? "?"}  ${row.email ?? "?"}  표식=${row.generatingAt ?? "없음"}`
    );
  }
  if (!FIX) {
    console.log("\n--fix 를 붙이면 이어서 만듭니다.");
    return;
  }

  for (const row of rows) {
    console.log(`\n[${row.id}] 이어 만드는 중…`);
    // 죽은 표식을 먼저 놓는다. 안 놓으면 claimGeneration 이 비켜서서 아무 일도 안 한다.
    await releaseGeneration(row.id).catch(() => {});
    try {
      const stored = await getReading(row.id);
      if (!stored) {
        console.log(`  리딩을 찾을 수 없음 — 건너뜀`);
        continue;
      }
      const finished = await finishReading({
        readingId: row.id,
        stored,
        partialReport: null,
        storedFull: stored.full ?? "",
      });
      console.log(finished.incomplete ? `  아직 미완성 — 다시 돌려주세요` : `  완성`);
    } catch (e) {
      console.error(`  실패:`, e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
