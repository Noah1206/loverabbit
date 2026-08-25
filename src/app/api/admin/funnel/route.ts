import { NextRequest, NextResponse } from "next/server";

import {
  adminKeyFromAuthorization,
  isAdminApprovalConfigured,
  verifyAdminApprovalKey,
} from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildFunnelReport, type FunnelEventRow } from "@/lib/funnel-report";

/**
 * 한 번에 읽는 최대 줄 수.
 *
 * 상한에 걸리면 응답의 truncated 가 켜진다. 조용히 자르면 "최근 것만 본 숫자"를
 * 전체인 줄 알고 읽게 된다 — 그게 통계에서 가장 흔한 거짓말이다.
 */
const MAX_ROWS = 20_000;
const COLUMNS = "session_id,user_id,name,step,path,product,dwell_ms,seq,created_at";

export async function GET(request: NextRequest) {
  if (!isAdminApprovalConfigured()) {
    return NextResponse.json({ error: "관리자 승인 키가 설정되지 않았어요." }, { status: 503 });
  }
  if (!verifyAdminApprovalKey(adminKeyFromAuthorization(request.headers.get("authorization")))) {
    return NextResponse.json({ error: "관리자 인증에 실패했어요." }, { status: 401 });
  }
  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "DB 연결을 준비 중입니다." }, { status: 503 });
  }

  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get("days") ?? 7) || 7, 1), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const rows: FunnelEventRow[] = [];
    let truncated = false;
    for (let from = 0; from < MAX_ROWS; from += 1000) {
      const { data, error } = await db
        .from("lr_funnel_events")
        .select(COLUMNS)
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...((data ?? []) as FunnelEventRow[]));
      if ((data?.length ?? 0) < 1000) break;
      if (rows.length >= MAX_ROWS) truncated = true;
    }

    return NextResponse.json(
      { days, report: buildFunnelReport(rows, truncated) },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("퍼널 조회 실패:", error);
    return NextResponse.json({ error: "퍼널을 불러오지 못했어요." }, { status: 503 });
  }
}
