import { NextRequest, NextResponse } from "next/server";

import {
  adminKeyFromAuthorization,
  isAdminApprovalConfigured,
  verifyAdminApprovalKey,
} from "@/lib/admin-auth";
import { isDatabaseConfigured, reviewInquiry } from "@/lib/database";

type ReviewRequest = {
  status?: "open" | "done";
  note?: string;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminApprovalConfigured()) {
    return NextResponse.json({ error: "관리자 승인 키가 설정되지 않았어요." }, { status: 503 });
  }
  if (!verifyAdminApprovalKey(adminKeyFromAuthorization(request.headers.get("authorization")))) {
    return NextResponse.json({ error: "관리자 인증에 실패했어요." }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "문의 DB 연결을 준비 중입니다." }, { status: 503 });
  }

  const { id } = await params;
  const inquiryId = Number(id);
  if (!Number.isSafeInteger(inquiryId) || inquiryId <= 0) {
    return NextResponse.json({ error: "문의 번호가 올바르지 않아요." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as ReviewRequest;
  if (body.status !== "open" && body.status !== "done") {
    return NextResponse.json({ error: "처리 상태를 선택해주세요." }, { status: 400 });
  }

  try {
    const updated = await reviewInquiry(inquiryId, body.status, body.note);
    if (!updated) {
      return NextResponse.json({ error: "문의를 찾을 수 없어요." }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error("문의 상태 변경 실패:", error);
    return NextResponse.json({ error: "문의 상태를 바꾸지 못했어요." }, { status: 503 });
  }
}
