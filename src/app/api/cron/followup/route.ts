import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { SECOND_READING_PRICE } from "@/lib/coupons";
import { sendKakaoMemo } from "@/lib/kakao-message";
import { SITE_URL } from "@/lib/site";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/*
  결제 7일 뒤 한 통.

  사주는 시점이 바뀔 때 다시 보는 상품인데, 그 시점을 우리가 알려 주지 않으면
  다시 올 계기가 없다. 승인 7일 뒤(6~8일 창) 카카오 '나에게 보내기'로 두 번째
  리딩이 4,900원이라는 것만 알린다. 명리 주장은 넣지 않는다 — 이 문장은 규칙
  표를 거치지 않는다.

  한 주문에 한 번. metadata.followup_sent_at 이 찍히면 다시 안 보낸다.
  vercel.json 의 cron 이 매일 한 번 부른다. Authorization: Bearer CRON_SECRET.
*/
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const given = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "db" }, { status: 503 });

  const now = Date.now();
  const from = new Date(now - 8 * 86_400_000).toISOString();
  const to = new Date(now - 6 * 86_400_000).toISOString();
  const { data, error } = await db
    .from("lr_orders")
    .select("id,user_id,metadata,paid_at,updated_at")
    .eq("kind", "reading")
    .eq("status", "paid")
    .gte("updated_at", from)
    .lte("updated_at", to)
    .order("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });

  let sent = 0;
  let skipped = 0;
  const seen = new Set<number>();
  for (const order of data ?? []) {
    const meta = (order.metadata ?? {}) as Record<string, unknown>;
    const userId = Number(order.user_id);
    if (meta.followup_sent_at || seen.has(userId)) {
      skipped += 1;
      continue;
    }
    seen.add(userId);
    const ok = await sendKakaoMemo(userId, {
      text: `지난주에 본 러브레빗 리딩, 다음 질문이 남았다면 — 두 번째 리딩은 ${SECOND_READING_PRICE.toLocaleString("ko-KR")}원이에요. 내 생년월일은 저장돼 있어서 상대 생년월일만 넣으면 돼요.`,
      url: `${SITE_URL}/my`,
      buttonTitle: "내 상담 열기",
    });
    // 못 보낸 것도 찍는다 — 카카오가 아닌 사람에게 매일 다시 시도할 이유가 없다.
    await db
      .from("lr_orders")
      .update({ metadata: { ...meta, followup_sent_at: new Date().toISOString(), followup_delivered: ok } })
      .eq("id", order.id);
    if (ok) sent += 1;
    else skipped += 1;
  }
  return NextResponse.json({ sent, skipped, window: [from, to] });
}
