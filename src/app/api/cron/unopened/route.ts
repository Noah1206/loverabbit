import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { sendKakaoMemo } from "@/lib/kakao-message";
import { SITE_URL } from "@/lib/site";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/*
  돈 내고 안 열어본 리딩 한 통 (2026-09-04).

  해금된 리딩의 1할쯤이 한 번도 안 열린다 — 승인이 몇 시간 뒤라 그 사이
  잊는다. 산 물건이 있다는 알림이라 광고가 아니고, 마케팅 동의와 무관하게
  보낸다. 명리 주장은 넣지 않는다.

  창은 열린 지 12시간~7일. 12시간 전에는 아직 볼 참일 수 있고, 7일이 지난
  건 굳었다. 한 리딩에 한 번 — payment.unopened_nudge_at 이 찍히면 다시 안
  보낸다. 발송 실패(비카카오 로그인)도 찍는다: 매일 다시 시도할 이유가 없다.

  vercel.json 의 cron 이 매일 11시(KST)에 부른다. Authorization: Bearer CRON_SECRET.
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
  const from = new Date(now - 7 * 86_400_000).toISOString();
  const to = new Date(now - 12 * 3_600_000).toISOString();
  const { data, error } = await db
    .from("lr_readings")
    .select("id,user_id,payment,updated_at")
    .eq("unlocked", true)
    .eq("paid_view_count", 0)
    .gte("updated_at", from)
    .lte("updated_at", to)
    .order("updated_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });

  let sent = 0;
  let skipped = 0;
  const seen = new Set<number>();
  for (const reading of data ?? []) {
    const payment = (reading.payment ?? {}) as Record<string, unknown>;
    const userId = Number(reading.user_id);
    // 한 사람에게 하루 한 통 — 리딩을 여러 장 안 열었어도 알림은 하나다.
    if (payment.unopened_nudge_at || seen.has(userId)) {
      skipped += 1;
      continue;
    }
    seen.add(userId);
    const ok = await sendKakaoMemo(userId, {
      title: "🐰 리딩이 기다리고 있어요",
      text: "결제하신 러브레빗 리딩이 아직 열리지 않았어요. 러빗은 이미 쓰였으니, 준비된 전문을 지금 열어보세요.",
      imageUrl: `${SITE_URL}/assets/home/welcome-poster.webp`,
      url: `${SITE_URL}/reading/${encodeURIComponent(String(reading.id))}`,
      buttonTitle: "내 리딩 열기",
    });
    await db
      .from("lr_readings")
      .update({ payment: { ...payment, unopened_nudge_at: new Date().toISOString(), unopened_nudge_delivered: ok } })
      .eq("id", reading.id);
    if (ok) sent += 1;
    else skipped += 1;
  }
  return NextResponse.json({ sent, skipped, window: [from, to] });
}
