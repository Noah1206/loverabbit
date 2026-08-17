import { NextRequest, NextResponse } from "next/server";
import { getReferralStatus } from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    userToken?: string;
    readingId?: string;
  };

  try {
    const user = await resolveUserToken(body.userToken);
    if (!user?.userId) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }
    const status = await getReferralStatus(user.userId, body.readingId);
    if (!status) {
      return NextResponse.json({ error: "추천 정보를 찾지 못했어요." }, { status: 404 });
    }
    return NextResponse.json(status);
  } catch (error) {
    console.error("추천 보상 조회 실패:", error);
    return NextResponse.json({ error: "추천 보상을 확인하지 못했어요." }, { status: 503 });
  }
}
