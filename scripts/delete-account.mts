/*
  회원 탈퇴 처리 — 개인정보 파기 요청이 들어왔을 때 운영자가 직접 돌린다.

    npm run account:delete -- --email someone@example.com --dry
    npm run account:delete -- --email someone@example.com --yes

  --dry 로 먼저 무엇이 지워지는지 보고, --yes 를 붙여야 실제로 지운다.
  되돌릴 수 없으므로 두 단계로 나눴다.

  지우는 것과 남기는 것은 DB 함수(lr_delete_account)가 정한다 — 규칙을 두
  곳에 두면 한쪽만 고쳐지는 날이 온다. 여기는 그 함수를 부르고 결과를 사람이
  읽을 수 있게 보여 줄 뿐이다.
*/

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!url || !key) {
  // 로컬 .env.local 에는 대개 publishable 키만 있다. 이 작업은 서버 키로만
  // 할 수 있으므로(RLS 를 지나야 한다) 키를 앞에 붙여 한 번만 쓰게 안내한다.
  console.error(`
회원 정보를 지우려면 서버 키가 필요해요. Vercel 환경변수에서 값을 가져와
이 명령 앞에 붙여 주세요 (기록에 남지 않게 한 번만 씁니다):

  SUPABASE_URL=https://xxxx.supabase.co \\
  SUPABASE_SECRET_KEY=sb_secret_... \\
  npm run account:delete -- --email someone@example.com

지금 읽힌 값: URL ${url ? "있음" : "없음"} · SECRET_KEY ${key ? "있음" : "없음"}
`);
  process.exit(1);
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const email = (arg("email") ?? "").trim().toLowerCase();
if (!email) {
  console.error('이메일이 필요해요: --email someone@example.com [--dry | --yes]');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const { data: user, error: findError } = await db
  .from("lr_users")
  .select("id,email,created_at")
  .eq("email", email)
  .maybeSingle();

if (findError) {
  console.error("회원 조회 실패:", findError.message);
  process.exit(1);
}
if (!user) {
  console.error(`그런 회원이 없어요: ${email}`);
  process.exit(1);
}

// 무엇이 지워지는지 먼저 센다. 사람이 확인하고 누르라는 뜻이다.
const countOf = async (table: string, column: string) => {
  const { count } = await db.from(table).select("id", { count: "exact", head: true }).eq(column, user.id);
  return count ?? 0;
};

const [readings, questions, inquiries, orders] = await Promise.all([
  countOf("lr_readings", "user_id"),
  countOf("lr_questions", "user_id"),
  countOf("lr_inquiries", "user_id"),
  countOf("lr_orders", "user_id"),
]);

console.log(`\n회원 #${user.id} — ${user.email} (가입 ${String(user.created_at).slice(0, 10)})`);
console.log("\n지웁니다");
console.log(`  리딩 본문·명식   ${readings}건 (행은 남고 내용만 비웁니다)`);
console.log(`  질문·답변        ${questions}건`);
console.log(`  문의             ${inquiries}건`);
console.log("  사주 프로필      생년월일·시각·성별");
console.log("  귀인지도         내가 만든 지도와 참여 기록");
console.log("  계정             이메일·생년월일·소셜 연결");
console.log("\n남깁니다 (전자상거래법·정산)");
console.log(`  주문             ${orders}건 — 결제 기록은 5년 보관 의무`);
console.log("  러빗 원장        증감 기록. 금액 정산의 근거");

if (!has("yes")) {
  console.log("\n실제로 지우려면 --yes 를 붙여 다시 실행하세요. (되돌릴 수 없습니다)\n");
  process.exit(0);
}

const { data, error } = await db.rpc("lr_delete_account", { p_user_id: user.id });
if (error) {
  console.error("\n탈퇴 처리 실패:", error.message);
  process.exit(1);
}

console.log("\n처리했습니다:", JSON.stringify(data));
console.log("개인정보처리방침이 약속한 대로 계정 정보와 리딩 내용을 파기했고,");
console.log("거래 기록은 법정 기간 동안 남겨 두었습니다.\n");
