import { NextRequest, NextResponse } from "next/server";

import {
  adminKeyFromAuthorization,
  isAdminApprovalConfigured,
  verifyAdminApprovalKey,
} from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/*
  돈은 받았는데 글이 안 나온 리딩을 서버에서 짚어 본다.

  로컬에서는 못 본다 — 운영 키는 Vercel 에만 있다. 그래서 진단은 그 환경 안에서
  돌아야 한다.

  읽기만 한다. 고치지 않는다. 무엇이 잘못됐는지 먼저 알고 나서 고쳐야 한다.
*/
export const maxDuration = 60;

// /api/reading 의 mockReading 이 글머리에 박는 문자열. 키가 없을 때 저장되는
// 글이라, 이게 보이면 "생성이 실패한 게 아니라 데모가 팔렸다"는 뜻이다.
const DEMO_MARK = "[데모 모드";

export async function GET(request: NextRequest) {
  if (!isAdminApprovalConfigured()) {
    return NextResponse.json({ error: "관리자 승인 키가 설정되지 않았어요." }, { status: 503 });
  }
  if (!verifyAdminApprovalKey(adminKeyFromAuthorization(request.headers.get("authorization")))) {
    return NextResponse.json({ error: "관리자 인증에 실패했어요." }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB 연결이 없어요." }, { status: 503 });

  // 2. 돈은 냈는데(unlocked) 글이 비었거나 데모인 리딩.
  const { data: readings, error } = await db
    .from("lr_readings")
    .select("id,category,full_text,unlocked,created_at,user_id")
    .eq("unlocked", true)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json({ error: `리딩 조회 실패: ${error.message}` }, { status: 503 });
  }

  const broken = (readings ?? [])
    .map((row) => {
      const full = typeof row.full_text === "string" ? row.full_text : "";
      // 빈 글과 데모 글은 원인이 다르다. 빈 글은 생성이 못 끝난 것이고,
      // 데모 글은 키가 없어 미리 만들어 둔 글이 저장된 것이다.
      const kind = !full.trim() ? "empty" : full.includes(DEMO_MARK) ? "demo" : null;
      return kind ? { id: row.id, category: row.category, kind, createdAt: row.created_at, userId: row.user_id } : null;
    })
    .filter((row) => row !== null);

  // 3. 아직 안 끝난 생성 표식이 남아 있는가.
  const { data: resume } = await db
    .from("lr_reading_resume")
    .select("reading_id,generating_at,updated_at")
    .limit(100);

  return NextResponse.json({
    // 제공사·키 상태는 /api/admin/model-routing 이 이미 답한다. 여기서 또 세면
    // 두 곳의 답이 갈리는 날이 온다.
    checkedUnlocked: readings?.length ?? 0,
    brokenCount: broken.length,
    broken,
    resumeRows: (resume ?? []).map((row) => ({
      readingId: row.reading_id,
      generatingAt: row.generating_at ?? null,
    })),
  });
}
